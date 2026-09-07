const ODRequest = require('../models/ODRequest');
const Attendance = require('../models/Attendance');

// @desc Submit On Duty (OD) application
// @route POST /api/od
// @access Private (Student)
const submitOD = async (req, res) => {
  try {
    const { classId, odCategory, eventName, organizingBody, startDate, endDate, reason, proofDocumentUrl } = req.body;

    if (!classId || !eventName || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'Class, event name, dates, and reason are required for OD application' });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ message: 'OD Start Date cannot be after End Date' });
    }

    const od = await ODRequest.create({
      student: req.user._id,
      classId,
      odCategory: odCategory || 'TECHNICAL_SYMPOSIUM',
      eventName,
      organizingBody: organizingBody || 'College Host Institution',
      startDate,
      endDate,
      reason,
      proofDocumentUrl: proofDocumentUrl || '',
    });

    const populated = await ODRequest.findById(od._id)
      .populate('classId', 'subjectName subjectCode className')
      .populate('student', 'name rollNumber department');

    res.status(201).json({ message: 'On Duty (OD) application submitted successfully!', od: populated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc Get student's OD applications
// @route GET /api/od/my
// @access Private (Student)
const getMyODs = async (req, res) => {
  try {
    const ods = await ODRequest.find({ student: req.user._id })
      .populate('classId', 'subjectName subjectCode className')
      .sort({ createdAt: -1 });

    res.json({ ods });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc Get OD applications for faculty / admin queue
// @route GET /api/od/teacher
// @access Private (Teacher / Admin)
const getTeacherODs = async (req, res) => {
  try {
    const ods = await ODRequest.find()
      .populate('student', 'name rollNumber department photoUrl')
      .populate('classId', 'subjectName subjectCode className teacher')
      .sort({ createdAt: -1 });

    const filtered = req.user.role === 'ADMIN'
      ? ods
      : ods.filter(o => o.classId && o.classId.teacher && o.classId.teacher.toString() === req.user._id.toString());

    res.json({ ods: filtered });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc Review (Approve / Reject) an OD request
// @route PATCH /api/od/:id/status
// @access Private (Teacher / Admin)
const reviewOD = async (req, res) => {
  try {
    const { status, facultyNotes } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Status must be APPROVED or REJECTED' });
    }

    const od = await ODRequest.findById(req.params.id)
      .populate('student', 'name rollNumber')
      .populate('classId', 'classId subjectName className');

    if (!od) {
      return res.status(404).json({ message: 'OD application not found' });
    }

    od.status = status;
    od.facultyNotes = facultyNotes || '';
    od.reviewedBy = req.user._id;
    od.reviewedAt = new Date();
    await od.save();

    // If APPROVED: Credit attendance as PRESENT (ON_DUTY) for dates in range
    if (status === 'APPROVED') {
      const cur = new Date(od.startDate);
      const end = new Date(od.endDate);

      while (cur <= end) {
        const dateStr = cur.toISOString().split('T')[0];
        const classCode = od.classId?.classId || 'GENERAL';

        await Attendance.findOneAndUpdate(
          {
            student: od.student._id,
            classId: classCode,
            date: dateStr,
          },
          {
            student: od.student._id,
            classId: classCode,
            date: dateStr,
            status: 'PRESENT',
            verifiedVia: 'ON_DUTY',
            confidence: 1.0,
            rollNumber: od.student?.rollNumber || '',
            timestamp: new Date(),
          },
          { upsert: true, new: true }
        );

        cur.setDate(cur.getDate() + 1);
      }
    }

    const updated = await ODRequest.findById(od._id)
      .populate('student', 'name rollNumber')
      .populate('classId', 'subjectName subjectCode className');

    res.json({
      message: `OD application ${status.toLowerCase()} successfully! ${status === 'APPROVED' ? 'Attendance credited as PRESENT (ON_DUTY).' : ''}`,
      od: updated,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  submitOD,
  getMyODs,
  getTeacherODs,
  reviewOD,
};
