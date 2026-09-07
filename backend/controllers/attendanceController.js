const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const ExcelJS = require('exceljs');

// ─── GET /api/attendance ──────────────────────────────────────────────────────
// Query: classId, date, startDate, endDate, studentId, status
const getAttendance = async (req, res) => {
  const { classId, date, startDate, endDate, studentId, status, page = 1, limit = 100 } = req.query;
  const filter = {};

  if (classId) filter.classId = classId.toUpperCase();
  if (date) filter.date = date;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = startDate;
    if (endDate) filter.date.$lte = endDate;
  }
  if (studentId) filter.student = studentId;
  if (status) filter.status = status.toUpperCase();

  // Teachers can only see their class attendance
  if (req.user.role === 'TEACHER') {
    const teacherClasses = await Class.find({ teacher: req.user._id }).distinct('classId');
    filter.classId = { $in: teacherClasses };
    if (classId && teacherClasses.includes(classId.toUpperCase())) {
      filter.classId = classId.toUpperCase();
    }
  }

  // Students only see their own records
  if (req.user.role === 'STUDENT') {
    filter.student = req.user._id;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .populate('student', 'name rollNumber department photoUrl')
      .sort({ date: -1, timestamp: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Attendance.countDocuments(filter),
  ]);

  res.json({ records, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

// ─── GET /api/attendance/stats ────────────────────────────────────────────────
const getStats = async (req, res) => {
  const { classId, studentId } = req.query;
  const filter = {};
  if (classId) filter.classId = classId.toUpperCase();
  if (studentId) filter.student = studentId;
  if (req.user.role === 'STUDENT') filter.student = req.user._id;

  const [total, present, absent] = await Promise.all([
    Attendance.countDocuments(filter),
    Attendance.countDocuments({ ...filter, status: 'PRESENT' }),
    Attendance.countDocuments({ ...filter, status: 'ABSENT' }),
  ]);

  const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : '0.0';
  res.json({ total, present, absent, percentage: parseFloat(percentage), eligible: parseFloat(percentage) >= 75 });
};

// ─── POST /api/attendance/log ─────────────────────────────────────────────────
// Called when face is recognized or manual attendance logged
const logAttendance = async (req, res) => {
  const { classId, studentId, rollNumber, confidence, date, status, verifiedVia } = req.body;
  if (!classId) return res.status(400).json({ message: 'classId is required' });

  const rollInput = (rollNumber || '').trim().toUpperCase();

  const mongoose = require('mongoose');
  let studentUser = null;

  if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
    studentUser = await User.findById(studentId);
  }
  if (!studentUser && rollInput) {
    studentUser = await User.findOne({ rollNumber: rollInput });
  }

  if (!studentUser) {
    return res.status(404).json({ message: `Student profile not found for ${rollInput || studentId}` });
  }

  const roll = studentUser.rollNumber || rollInput;

  const today = date || new Date().toISOString().split('T')[0];
  const targetStatus = (status || 'PRESENT').toUpperCase();
  const defaultVia = req.user?.role ? 'MANUAL_ENTRY' : 'FACE_AI';

  try {
    const record = await Attendance.findOneAndUpdate(
      { classId: classId.toUpperCase(), student: studentUser._id, date: today },
      {
        status: targetStatus,
        confidence: confidence !== undefined ? confidence : (targetStatus === 'PRESENT' ? 1.0 : 0.0),
        verifiedVia: verifiedVia || defaultVia,
        rollNumber: roll,
        timestamp: new Date(),
      },
      { upsert: true, new: true }
    ).populate('student', 'name rollNumber department photoUrl');

    res.status(201).json({ message: `Attendance updated to ${targetStatus}`, record });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Attendance already recorded for today' });
    }
    throw err;
  }
};

// ─── PATCH /api/attendance/:id/override ──────────────────────────────────────
const manualOverride = async (req, res) => {
  const { status } = req.body;
  if (!['PRESENT', 'ABSENT'].includes(status)) {
    return res.status(400).json({ message: 'Status must be PRESENT or ABSENT' });
  }

  const record = await Attendance.findById(req.params.id);
  if (!record) return res.status(404).json({ message: 'Attendance record not found' });

  const oldStatus = record.status;
  record.status = status;
  record.verifiedVia = 'MANUAL_OVERRIDE';
  await record.save();

  await AuditLog.create({
    action: 'MANUAL_OVERRIDE',
    performedBy: req.user._id,
    targetUser: record.student,
    targetClass: record.classId,
    details: { from: oldStatus, to: status, date: record.date },
    ipAddress: req.ip,
  });

  res.json({ message: `Status changed from ${oldStatus} to ${status}`, record });
};

// ─── GET /api/attendance/export/csv ──────────────────────────────────────────
const exportCSV = async (req, res) => {
  const { classId, startDate, endDate } = req.query;
  const filter = {};
  if (classId) filter.classId = classId.toUpperCase();
  if (startDate) filter.date = { ...filter.date, $gte: startDate };
  if (endDate) filter.date = { ...filter.date, $lte: endDate };

  const records = await Attendance.find(filter)
    .populate('student', 'name rollNumber department')
    .sort({ date: -1 });

  const csv = [
    'Date,Class ID,Roll Number,Student Name,Department,Status,Confidence,Verified Via',
    ...records.map((r) =>
      `${r.date},${r.classId},${r.rollNumber},"${r.student?.name || 'N/A'}","${r.student?.department || 'N/A'}",${r.status},${(r.confidence * 100).toFixed(1)}%,${r.verifiedVia}`
    ),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance_${classId || 'all'}_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
};

// ─── GET /api/attendance/export/excel ────────────────────────────────────────
const exportExcel = async (req, res) => {
  const { classId, startDate, endDate } = req.query;
  const filter = {};
  if (classId) filter.classId = classId.toUpperCase();
  if (startDate) filter.date = { ...filter.date, $gte: startDate };
  if (endDate) filter.date = { ...filter.date, $lte: endDate };

  const records = await Attendance.find(filter)
    .populate('student', 'name rollNumber department')
    .sort({ date: -1 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Attendance System';
  const sheet = workbook.addWorksheet('Attendance Report');

  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Class ID', key: 'classId', width: 18 },
    { header: 'Roll Number', key: 'rollNumber', width: 20 },
    { header: 'Student Name', key: 'name', width: 28 },
    { header: 'Department', key: 'department', width: 22 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Confidence (%)', key: 'confidence', width: 16 },
    { header: 'Verified Via', key: 'verifiedVia', width: 18 },
  ];

  // Style header row
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };

  records.forEach((r) => {
    const row = sheet.addRow({
      date: r.date,
      classId: r.classId,
      rollNumber: r.rollNumber,
      name: r.student?.name || 'N/A',
      department: r.student?.department || 'N/A',
      status: r.status,
      confidence: parseFloat((r.confidence * 100).toFixed(1)),
      verifiedVia: r.verifiedVia,
    });
    if (r.status === 'PRESENT') {
      row.getCell('status').font = { color: { argb: 'FF059669' }, bold: true };
    } else {
      row.getCell('status').font = { color: { argb: 'FFDC2626' }, bold: true };
    }
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="attendance_${classId || 'all'}_${new Date().toISOString().split('T')[0]}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
};

// ─── GET /api/attendance/course-summary ──────────────────────────────────────
// Returns Course Name, Attended, Scheduled, Percentage %, Present Count, Absent Count, OD Count, and session details
const getCourseSummary = async (req, res) => {
  try {
    const studentId = req.user.role === 'STUDENT' ? req.user._id : req.query.studentId;
    const { term } = req.query;

    const classFilter = {};
    if (studentId) {
      classFilter.$or = [{ students: studentId }, { department: req.user?.department || '' }];
    }
    if (term) {
      classFilter.academicTerm = term;
    }

    const allClasses = await Class.find(classFilter)
      .populate('teacher', 'name email department')
      .populate('students', 'name rollNumber department photoUrl')
      .lean();

    const attendanceFilter = {};
    if (studentId) attendanceFilter.student = studentId;

    const allRecords = await Attendance.find(attendanceFilter)
      .populate('student', 'name rollNumber department')
      .sort({ date: -1, timestamp: -1 })
      .lean();

    let totalSessionsAll = 0;
    let presentCountAll = 0;
    let absentCountAll = 0;
    let odCountAll = 0;

    const courses = allClasses.map((cls) => {
      const clsRecords = allRecords.filter(r => r.classId === cls.classId || r.classId === cls._id?.toString());
      const scheduled = clsRecords.length > 0 ? clsRecords.length : 1;
      const present = clsRecords.filter(r => r.status === 'PRESENT' && r.verifiedVia !== 'ON_DUTY').length;
      const od = clsRecords.filter(r => r.verifiedVia === 'ON_DUTY' || r.status === 'ON_DUTY').length;
      const attended = present + od;
      const absent = Math.max(0, scheduled - attended);
      const percentage = scheduled > 0 ? parseFloat(((attended / scheduled) * 100).toFixed(2)) : 0.0;

      totalSessionsAll += scheduled;
      presentCountAll += present;
      absentCountAll += absent;
      odCountAll += od;

      const sessions = clsRecords.map(r => ({
        _id: r._id,
        date: r.date,
        time: r.timestamp ? new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '09:15 AM',
        status: r.status,
        verifiedVia: r.verifiedVia || 'FACE_AI',
        markedFrom: r.verifiedVia === 'ON_DUTY' ? 'ON_DUTY' : r.verifiedVia === 'FACE_AI' ? 'Face AI' : 'Class attendance',
        confidencePct: r.confidence ? (r.confidence * 100).toFixed(1) : '100.0',
      }));

      return {
        _id: cls._id,
        classId: cls.classId,
        className: cls.className || cls.subject || 'Course Section',
        subject: cls.subject || cls.className,
        courseCode: cls.courseCode || cls.classId,
        academicTerm: cls.academicTerm || 'AY 2026-2027 ODD (SEM III,V,VII,IX)',
        semester: cls.semester || 'Semester V',
        attended,
        scheduled,
        percentage,
        present,
        absent,
        od,
        sessions,
      };
    });

    const overallPercentage = totalSessionsAll > 0 ? parseFloat((((presentCountAll + odCountAll) / totalSessionsAll) * 100).toFixed(2)) : 0.0;

    res.json({
      term: term || 'AY 2026-2027 ODD (SEM III,V,VII,IX)',
      totalSessions: totalSessionsAll,
      present: presentCountAll,
      absent: absentCountAll,
      od: odCountAll,
      overallPercentage,
      courses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/attendance/batch-session-submit ──────────────────────────────
// Allows teacher to run Face AI detection once, manually adjust roster presences, and submit session
const batchSessionSubmit = async (req, res) => {
  try {
    const { classId, date, students } = req.body;
    if (!classId || !Array.isArray(students)) {
      return res.status(400).json({ message: 'classId and students array are required' });
    }

    const sessionDate = date || new Date().toISOString().split('T')[0];
    const cid = classId.toUpperCase();
    const now = new Date();

    const ops = students.map((s) => ({
      updateOne: {
        filter: { classId: cid, student: s.studentId, date: sessionDate },
        update: {
          $set: {
            classId: cid,
            student: s.studentId,
            rollNumber: (s.rollNumber || '').toUpperCase(),
            date: sessionDate,
            status: (s.status || 'PRESENT').toUpperCase(),
            verifiedVia: s.verifiedVia || 'HYBRID_VERIFICATION',
            confidence: s.confidence !== undefined ? s.confidence : 1.0,
            timestamp: now,
          },
        },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      await Attendance.bulkWrite(ops);
    }

    await AuditLog.create({
      action: 'BATCH_SESSION_SUBMIT',
      performedBy: req.user._id,
      targetClass: cid,
      details: { date: sessionDate, count: students.length },
      ipAddress: req.ip,
    });

    res.json({ message: `Attendance session submitted successfully for ${students.length} students in ${cid}`, count: students.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getAttendance, getStats, logAttendance, manualOverride, exportCSV, exportExcel, getCourseSummary, batchSessionSubmit };
