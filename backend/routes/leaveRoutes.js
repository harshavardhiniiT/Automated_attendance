const express = require('express');
const {
  submitLeave,
  getMyLeaves,
  getTeacherLeaves,
  updateLeaveStatus,
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', authorize('STUDENT'), submitLeave);
router.get('/my', authorize('STUDENT'), getMyLeaves);
router.get('/teacher', authorize('TEACHER', 'ADMIN'), getTeacherLeaves);
router.patch('/:id/status', authorize('TEACHER', 'ADMIN'), updateLeaveStatus);

module.exports = router;
