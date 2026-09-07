const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');

// @desc Submit a leave application
// @route POST /api/leave
// @access Private (Student)
const submitLeave = async (req, res) => {
  try {
    const { classId, leaveType, startDate, endDate, reason, documentUrl } = req.body;

    if (!classId || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: 'Class, dates, and reason are required' });
    }

    const leave = await LeaveRequest.create({
      student: req.user._id,
      classId,
      leaveType: leaveType || 'MEDICAL',
      startDate,
      endDate,
      reason,
      documentUrl: documentUrl || '',
    });

    const populated = await LeaveRequest.findById(leave._id)
      .populate('classId', 'subjectName subjectCode')
      .populate('student', 'name rollNumber');

    res.status(201).json({ message: 'Leave application submitted successfully', leave: populated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc Get student's leave requests
// @route GET /api/leave/my
// @access Private (Student)
const getMyLeaves = async (req, res) => {
  try {
    const leaves = await LeaveRequest.find({ student: req.user._id })
      .populate('classId', 'subjectName subjectCode')
      .sort({ createdAt: -1 });

    res.json({ leaves });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc Get leave requests for classes taught by logged in teacher
// @route GET /api/leave/teacher
// @access Private (Teacher / Admin)
const getTeacherLeaves = async (req, res) => {
  try {
    const leaves = await LeaveRequest.find()
      .populate('student', 'name rollNumber department photoUrl')
      .populate('classId', 'subjectName subjectCode teacher')
      .sort({ createdAt: -1 });

    // Filter if role is teacher
    const filtered = req.user.role === 'ADMIN' 
      ? leaves 
      : leaves.filter(l => l.classId && l.classId.teacher && l.classId.teacher.toString() === req.user._id.toString());

    res.json({ leaves: filtered });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc Review (Approve / Reject) a leave request
// @route PATCH /api/leave/:id/status
// @access Private (Teacher / Admin)
const updateLeaveStatus = async (req, res) => {
  try {
    const { status, teacherNotes } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    leave.status = status;
    leave.teacherNotes = teacherNotes || '';
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    await leave.save();

    const updated = await LeaveRequest.findById(leave._id)
      .populate('student', 'name rollNumber')
      .populate('classId', 'subjectName subjectCode');

    res.json({ message: `Leave request ${status.toLowerCase()}`, leave: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  submitLeave,
  getMyLeaves,
  getTeacherLeaves,
  updateLeaveStatus,
};
