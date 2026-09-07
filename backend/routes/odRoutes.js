const express = require('express');
const {
  submitOD,
  getMyODs,
  getTeacherODs,
  reviewOD,
} = require('../controllers/odController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', authorize('STUDENT'), submitOD);
router.get('/my', authorize('STUDENT'), getMyODs);
router.get('/teacher', authorize('TEACHER', 'ADMIN'), getTeacherODs);
router.patch('/:id/status', authorize('TEACHER', 'ADMIN'), reviewOD);

module.exports = router;
