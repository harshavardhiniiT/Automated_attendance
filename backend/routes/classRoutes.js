const express = require('express');
const {
  getClasses, getAssignedClasses, getClassById, getUpcomingClasses,
  createClass, updateClass, deleteClass,
  addStudentToClass, removeStudentFromClass,
} = require('../controllers/classController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

// Routes accessible to authenticated users
router.get('/', getClasses);
router.get('/upcoming', getUpcomingClasses);
router.get('/assigned', requireRole('TEACHER'), getAssignedClasses);
router.get('/:id', getClassById);
router.post('/', requireRole('ADMIN', 'TEACHER'), createClass);
router.put('/:id', requireRole('ADMIN'), updateClass);
router.delete('/:id', requireRole('ADMIN'), deleteClass);

// Roster management — Admin or Teacher
router.post('/:id/students', requireRole('ADMIN', 'TEACHER'), addStudentToClass);
router.delete('/:id/students/:studentId', requireRole('ADMIN', 'TEACHER'), removeStudentFromClass);

module.exports = router;
