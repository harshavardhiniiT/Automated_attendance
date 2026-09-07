const express = require('express');
const {
  getUsers, getUserById, createUser, updateUser, deleteUser,
  toggleActive, uploadPhoto, deletePhoto, getEmbeddings, clearEmbeddings, clearDatabase,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

// All user routes require authentication
router.use(protect);

// Admin + Teacher — list user directory
router.get('/', requireRole('ADMIN', 'TEACHER'), getUsers);
router.post('/', requireRole('ADMIN'), createUser);
router.post('/clear-db', requireRole('ADMIN'), clearDatabase);
router.delete('/:id', requireRole('ADMIN'), deleteUser);
router.patch('/:id/toggle-active', requireRole('ADMIN'), toggleActive);

// Admin + Teacher — view individual users
router.get('/:id', requireRole('ADMIN', 'TEACHER'), getUserById);
router.put('/:id', requireRole('ADMIN'), updateUser);

// Photo routes — Admin only can upload/delete student photos
router.post('/:id/photo', requireRole('ADMIN'), upload.single('photo'), uploadPhoto);
router.delete('/:id/photo', requireRole('ADMIN'), deletePhoto);

// Embeddings
router.get('/:id/embeddings', requireRole('ADMIN', 'TEACHER'), getEmbeddings);
router.delete('/:id/embeddings', requireRole('ADMIN'), clearEmbeddings);

module.exports = router;
