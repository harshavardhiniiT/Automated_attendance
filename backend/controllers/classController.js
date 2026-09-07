const Class = require('../models/Class');
const User = require('../models/User');

// ─── GET /api/classes ─────────────────────────────────────────────────────────
const getClasses = async (req, res) => {
  const { department, teacherId, search } = req.query;
  const filter = {};
  if (department) filter.department = new RegExp(department, 'i');
  if (teacherId) filter.teacher = teacherId;
  if (search) filter.$or = [{ className: new RegExp(search, 'i') }, { classId: new RegExp(search, 'i') }];

  const classes = await Class.find(filter)
    .populate('teacher', 'name email department employeeId')
    .populate('students', 'name rollNumber department photoUrl')
    .sort({ createdAt: -1 });

  const formatted = classes.map((c) => {
    const doc = c.toObject();
    const isEnrolled = doc.students?.some(s => s._id?.toString() === req.user._id?.toString());
    return { ...doc, isEnrolled };
  });

  res.json({ classes: formatted, total: formatted.length });
};

// ─── GET /api/classes/upcoming ────────────────────────────────────────────────
// User-specific upcoming classes & weekly schedule controller
const getUpcomingClasses = async (req, res) => {
  let classesFilter = {};

  if (req.user.role === 'STUDENT') {
    classesFilter = {
      $or: [
        { students: req.user._id },
        { department: req.user.department || '' },
      ],
    };
  } else if (req.user.role === 'TEACHER') {
    classesFilter = { teacher: req.user._id };
  }

  let classes = await Class.find(classesFilter)
    .populate('teacher', 'name email department employeeId')
    .populate('students', 'name rollNumber department photoUrl')
    .sort({ className: 1 });

  // If student is not enrolled in any, fallback to all active classes so they see system timetable
  if (req.user.role === 'STUDENT' && classes.length === 0) {
    classes = await Class.find({ isActive: true })
      .populate('teacher', 'name email department')
      .populate('students', 'name rollNumber department photoUrl')
      .limit(6);
  }

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayIndex = new Date().getDay();
  const currentDayName = daysOfWeek[todayIndex];
  const now = new Date();
  const currentHour = now.getHours();

  const upcomingList = [];

  classes.forEach((cls) => {
    // Parse schedule string or default
    const schedStr = cls.schedule || 'Mon/Wed 10:00 AM - 11:30 AM';
    const isToday = schedStr.toLowerCase().includes(currentDayName.toLowerCase().slice(0, 3)) || schedStr.includes('Daily') || true;

    let status = 'UPCOMING';
    // Dummy live check for current hour between 9 AM and 5 PM
    if (isToday && currentHour >= 9 && currentHour <= 17 && (cls.classId.charCodeAt(0) % 2 === 0)) {
      status = 'LIVE_NOW';
    }

    upcomingList.push({
      _id: cls._id,
      classId: cls.classId,
      className: cls.className,
      subject: cls.subject || cls.className,
      department: cls.department,
      teacherName: cls.teacher?.name || 'Faculty Instructor',
      teacherEmail: cls.teacher?.email || '',
      room: cls.room || 'Hall 301',
      schedule: cls.schedule || '10:00 AM - 11:30 AM',
      enrolledCount: cls.students?.length || 0,
      isEnrolled: cls.students?.some(s => s._id?.toString() === req.user._id?.toString()),
      status,
      day: currentDayName,
      time: cls.schedule || '10:00 AM - 11:30 AM',
      createdAt: cls.createdAt,
    });
  });

  res.json({ upcoming: upcomingList, total: upcomingList.length, today: currentDayName });
};

// ─── GET /api/classes/assigned ────────────────────────────────────────────────
// Teacher: only their assigned classes
const getAssignedClasses = async (req, res) => {
  const classes = await Class.find({ teacher: req.user._id })
    .populate('teacher', 'name email')
    .populate('students', 'name rollNumber department photoUrl');
  res.json({ classes });
};

// ─── GET /api/classes/:id ─────────────────────────────────────────────────────
const getClassById = async (req, res) => {
  const cls = await Class.findById(req.params.id)
    .populate('teacher', 'name email department')
    .populate('students', 'name rollNumber department photoUrl embeddings');
  if (!cls) return res.status(404).json({ message: 'Class not found' });
  res.json({ class: cls });
};

const { syncClassDbHelper } = require('./mlController');

// ─── POST /api/classes ────────────────────────────────────────────────────────
const createClass = async (req, res) => {
  let { classId, className, subject, department, teacherId, schedule, room } = req.body;

  if (req.user.role === 'TEACHER' && !teacherId) {
    teacherId = req.user._id;
  }
  if (!department && req.user.department) {
    department = req.user.department;
  }

  if (!classId || !className || !department || !teacherId || !schedule || !schedule.trim()) {
    return res.status(400).json({ message: 'Class ID, class name, department, faculty teacher, and schedule date/time are required' });
  }

  const teacher = await User.findOne({ _id: teacherId, role: { $in: ['TEACHER', 'ADMIN'] } });
  if (!teacher) return res.status(404).json({ message: 'Assigned teacher user not found' });

  const exists = await Class.findOne({ classId: classId.toUpperCase() });
  if (exists) return res.status(409).json({ message: `Class ID "${classId.toUpperCase()}" already exists` });

  const cls = await Class.create({ classId: classId.toUpperCase(), className, subject, department, teacher: teacherId, schedule, room });
  await cls.populate('teacher', 'name email');

  // Generate initial PKL database file for the newly created class
  try {
    await syncClassDbHelper(cls.classId);
  } catch (err) {
    console.log(`Initial PKL sync for ${cls.classId}:`, err.message);
  }

  res.status(201).json({ message: 'Class created successfully', class: cls });
};

// ─── PUT /api/classes/:id ─────────────────────────────────────────────────────
const updateClass = async (req, res) => {
  const allowed = ['className', 'subject', 'department', 'schedule', 'room', 'isActive', 'teacher'];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  const cls = await Class.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
    .populate('teacher', 'name email')
    .populate('students', 'name rollNumber');
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  try {
    await syncClassDbHelper(cls.classId);
  } catch (err) {}

  res.json({ message: 'Class updated', class: cls });
};

// ─── DELETE /api/classes/:id ──────────────────────────────────────────────────
// KEY FEATURE: Cascades deletion to Attendance records & Python ML PKL files
const deleteClass = async (req, res) => {
  const cls = await Class.findById(req.params.id);
  if (!cls) return res.status(404).json({ message: 'Class not found' });

  const Attendance = require('../models/Attendance');
  const { proxy } = require('./mlController');

  // 1. Delete associated Attendance records for this class
  await Attendance.deleteMany({ classId: cls.classId });

  // 2. Delete PKL database file in Flask ML service
  try {
    await proxy(`/api/class-db/${cls.classId}`, {}, 'delete');
  } catch (err) {
    console.log(`ML PKL cleanup notice for ${cls.classId}:`, err.message);
  }

  // 3. Delete Class document from MongoDB
  await Class.findByIdAndDelete(req.params.id);

  res.json({ message: `Class "${cls.className}" (${cls.classId}) & associated attendance records deleted.` });
};

// ─── POST /api/classes/:id/students ───────────────────────────────────────────
const addStudentToClass = async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: 'studentId required' });

  const student = await User.findOne({ _id: studentId, role: 'STUDENT' });
  if (!student) return res.status(404).json({ message: 'Student not found' });

  const cls = await Class.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { students: studentId } },
    { new: true }
  ).populate('students', 'name rollNumber department photoUrl');

  if (!cls) return res.status(404).json({ message: 'Class not found' });

  // Sync updated student pictures and data to class PKL
  try {
    await syncClassDbHelper(cls.classId);
  } catch (err) {}

  res.json({ message: `${student.name} added to class`, class: cls });
};

// ─── DELETE /api/classes/:id/students/:studentId ──────────────────────────────
const removeStudentFromClass = async (req, res) => {
  const { id, studentId } = req.params;
  const student = await User.findById(studentId);

  const cls = await Class.findByIdAndUpdate(
    id,
    { $pull: { students: studentId } },
    { new: true }
  ).populate('students', 'name rollNumber department');

  if (!cls) return res.status(404).json({ message: 'Class not found' });

  // Unindex student from Python ML PKL file if rollNumber exists
  if (student && student.rollNumber) {
    try {
      const { proxy } = require('./mlController');
      await proxy(`/api/class-students/${cls.classId}/${student.rollNumber}`, {}, 'delete');
    } catch (err) {}
  }

  try {
    await syncClassDbHelper(cls.classId);
  } catch (err) {}

  res.json({ message: `${student?.name || 'Student'} removed from class`, class: cls });
};

module.exports = { getClasses, getAssignedClasses, getClassById, getUpcomingClasses, createClass, updateClass, deleteClass, addStudentToClass, removeStudentFromClass };
