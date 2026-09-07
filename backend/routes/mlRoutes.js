const express = require('express');
const { enrollFace, loadClassDb, processFrame, cleanClassDb, clearAllPkls, mlHealth, startSession, stopSession } = require('../controllers/mlController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/health', protect, mlHealth);
router.post('/start-session', protect, requireRole('ADMIN', 'TEACHER'), startSession);
router.post('/stop-session', protect, requireRole('ADMIN', 'TEACHER'), stopSession);
router.post('/enroll-face', protect, requireRole('ADMIN', 'TEACHER'), enrollFace);
router.post('/load-class-db', protect, requireRole('ADMIN', 'TEACHER'), loadClassDb);
router.post('/process-frame', protect, requireRole('ADMIN', 'TEACHER'), processFrame);
router.post('/clean-class-db', protect, requireRole('ADMIN', 'TEACHER'), cleanClassDb);
router.post('/clear-all-pkls', protect, requireRole('ADMIN'), clearAllPkls);

module.exports = router;

