const express = require('express');
const {
  getAttendance, getStats, logAttendance, manualOverride, exportCSV, exportExcel, getCourseSummary, batchSessionSubmit,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getAttendance);                                       // All roles (filtered per role in controller)
router.get('/stats', getStats);                                       // All roles
router.get('/course-summary', getCourseSummary);                       // All roles (course breakdown with expandable session logs)
router.post('/log', requireRole('ADMIN', 'TEACHER'), logAttendance); // Log face-AI attendance
router.post('/batch-session-submit', requireRole('ADMIN', 'TEACHER'), batchSessionSubmit); // Hybrid AI + Manual Session submit
router.patch('/:id/override', requireRole('ADMIN', 'TEACHER'), manualOverride);
router.get('/export/csv', requireRole('ADMIN', 'TEACHER'), exportCSV);
router.get('/export/excel', requireRole('ADMIN', 'TEACHER'), exportExcel);

module.exports = router;
