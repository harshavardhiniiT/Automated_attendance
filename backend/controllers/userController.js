const User = require('../models/User');
const Class = require('../models/Class');
const AuditLog = require('../models/AuditLog');
const { cloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const streamifier = require('streamifier');

/** Helper: upload buffer to Cloudinary and return { url, public_id } */
const uploadBufferToCloudinary = (buffer, folder = 'attendance/students') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }] },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// ─── GET /api/users ─────────────────────────────────────────────────────────
const getUsers = async (req, res) => {
  const { role, department, search, excludeAdmin, page = 1, limit = 100 } = req.query;
  const filter = {};
  
  if (role) {
    filter.role = role.toUpperCase();
  } else if (excludeAdmin === 'true' || excludeAdmin === undefined) {
    // Default: Exclude ADMIN from operational user lists
    filter.role = { $ne: 'ADMIN' };
  }

  if (department) filter.department = new RegExp(department, 'i');
  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { rollNumber: new RegExp(search, 'i') },
      { employeeId: new RegExp(search, 'i') },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [rawUsers, total] = await Promise.all([
    User.find(filter).select('-password -embeddings').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    User.countDocuments(filter),
  ]);

  // Attach associated classes to users
  const userIds = rawUsers.map((u) => u._id);
  const classes = await Class.find({
    $or: [{ teacher: { $in: userIds } }, { students: { $in: userIds } }],
  }).select('className classId teacher students department schedule room').lean();

  const users = rawUsers.map((u) => {
    let assignedClasses = [];
    if (u.role === 'TEACHER') {
      assignedClasses = classes.filter((c) => String(c.teacher) === String(u._id));
    } else if (u.role === 'STUDENT') {
      assignedClasses = classes.filter((c) => c.students.some((sId) => String(sId) === String(u._id)));
    }
    return { ...u, assignedClasses };
  });

  res.json({ users, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

// ─── GET /api/users/:id ──────────────────────────────────────────────────────
const getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password').lean();
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Attach class details
  const classes = await Class.find({
    $or: [{ teacher: user._id }, { students: user._id }],
  }).select('className classId schedule room').lean();

  res.json({ user: { ...user, assignedClasses: classes } });
};

// ─── POST /api/users ─────────────────────────────────────────────────────────
const createUser = async (req, res) => {
  let { name, email, password, role, department, rollNumber, employeeId } = req.body;

  if (!name || !role || !department) {
    return res.status(400).json({ message: 'Name, role, and department are required' });
  }

  // Auto-generate email if missing
  if (!email || !email.trim()) {
    const sanitizeName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    email = `${sanitizeName}_${Date.now()}@attendance.com`;
  }

  // Sanitize rollNumber / employeeId - set to undefined if empty so sparse unique index works
  if (rollNumber && rollNumber.trim()) {
    rollNumber = rollNumber.trim().toUpperCase();
  } else {
    rollNumber = undefined;
  }

  if (employeeId && employeeId.trim()) {
    employeeId = employeeId.trim().toUpperCase();
  } else {
    employeeId = undefined;
  }

  if (role === 'STUDENT' && !rollNumber) {
    return res.status(400).json({ message: 'Roll number is required for student account' });
  }
  if (role === 'TEACHER' && !employeeId) {
    // Generate default employee ID if not provided
    const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
    employeeId = `EMP-${cleanName || 'TCH'}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Auto-assign default password if not provided
  if (!password || !password.trim()) {
    if (role === 'STUDENT') {
      password = rollNumber; // Student default password = Roll Number
    } else if (role === 'TEACHER') {
      password = employeeId || `${name.replace(/[^a-zA-Z0-9]/g, '')}123`;
    } else {
      password = 'Admin@1234';
    }
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(409).json({ message: 'Email already registered' });

  if (rollNumber) {
    const rollExists = await User.findOne({ rollNumber });
    if (rollExists) return res.status(409).json({ message: `Roll number ${rollNumber} already exists` });
  }

  if (employeeId) {
    const empExists = await User.findOne({ employeeId });
    if (empExists) return res.status(409).json({ message: `Employee ID ${employeeId} already exists` });
  }

  const userData = { name, email, password, role, department };
  if (rollNumber) userData.rollNumber = rollNumber;
  if (employeeId) userData.employeeId = employeeId;

  const user = await User.create(userData);
  const safe = user.toObject();
  delete safe.password;
  delete safe.embeddings;

  res.status(201).json({ message: 'User created successfully', user: safe, defaultPassword: password });
};

// ─── PUT /api/users/:id ──────────────────────────────────────────────────────
const updateUser = async (req, res) => {
  const allowedFields = ['name', 'department', 'rollNumber', 'employeeId', 'isActive', 'email', 'role'];
  const updates = {};
  allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (updates.rollNumber !== undefined) {
    if (updates.rollNumber && String(updates.rollNumber).trim()) {
      updates.rollNumber = String(updates.rollNumber).trim().toUpperCase();
    } else {
      delete updates.rollNumber;
    }
  }
  if (updates.employeeId !== undefined) {
    if (updates.employeeId && String(updates.employeeId).trim()) {
      updates.employeeId = String(updates.employeeId).trim().toUpperCase();
    } else {
      delete updates.employeeId;
    }
  }

  // Password update handled separately for security if provided
  if (req.body.password && req.body.password.trim()) {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.password = req.body.password; // triggers pre-save bcrypt hash
    allowedFields.forEach((f) => { if (updates[f] !== undefined) user[f] = updates[f]; });
    await user.save();
    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.embeddings;
    return res.json({ message: 'User & password updated successfully', user: safeUser });
  }

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password -embeddings');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ message: 'User updated', user });
};

// ─── DELETE /api/users/:id ───────────────────────────────────────────────────
// KEY FEATURE: 100% Cascading deletion — removes Cloudinary photo, class references, attendance logs, and ML PKL vectors
const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // 1. Delete photo from Cloudinary if it exists
  if (user.cloudinaryPublicId || user.photoUrl) {
    try {
      await deleteFromCloudinary(user.cloudinaryPublicId || user.photoUrl);
    } catch (err) {
      console.log(`Cloudinary photo deletion notice for ${user._id}:`, err.message);
    }
  }

  const Attendance = require('../models/Attendance');
  const mlController = require('./mlController');

  if (user.role === 'STUDENT') {
    // 2. Delete all attendance records for this student
    await Attendance.deleteMany({ student: user._id });

    // 3. Remove student reference from all Class rosters
    const enrolledClasses = await Class.find({ students: user._id });
    await Class.updateMany({ students: user._id }, { $pull: { students: user._id } });

    // 4. Remove student vector from Python ML PKL files
    if (user.rollNumber) {
      for (const cls of enrolledClasses) {
        await mlController.proxy(`/api/class-students/${cls.classId}/${user.rollNumber}`, {}, 'delete').catch(() => null);
      }
    }
  } else if (user.role === 'TEACHER') {
    // 5. Unassign teacher from any assigned classes
    await Class.updateMany({ teacher: user._id }, { $unset: { teacher: '' } });
  }

  // 6. Delete user record from MongoDB
  await User.findByIdAndDelete(req.params.id);

  // 7. Write Audit log
  await AuditLog.create({
    action: 'USER_DELETED',
    performedBy: req.user._id,
    targetUser: user._id,
    details: { deletedName: user.name, deletedRole: user.role, hadPhoto: !!(user.cloudinaryPublicId || user.photoUrl) },
    ipAddress: req.ip,
  });

  res.json({ message: `User "${user.name}" and all associated attendance, class rosters, Cloudinary photos, and biometrics deleted.` });
};

// ─── PATCH /api/users/:id/toggle-active ──────────────────────────────────────
const toggleActive = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.isActive = !user.isActive;
  await user.save();

  await AuditLog.create({
    action: 'STATUS_TOGGLED',
    performedBy: req.user._id,
    targetUser: user._id,
    details: { newStatus: user.isActive ? 'ACTIVE' : 'DEACTIVATED' },
    ipAddress: req.ip,
  });

  res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive });
};

// ─── POST /api/users/:id/photo ────────────────────────────────────────────────
// Upload/replace student photo — auto-deletes old Cloudinary image first
const uploadPhoto = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image file provided' });

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Delete old photo from Cloudinary if exists
  if (user.cloudinaryPublicId || user.photoUrl) {
    await deleteFromCloudinary(user.cloudinaryPublicId || user.photoUrl);
  }

  // Upload new photo
  const result = await uploadBufferToCloudinary(req.file.buffer);
  user.photoUrl = result.secure_url;
  user.cloudinaryPublicId = result.public_id;
  await user.save();

  // If user is a student, automatically extract face vector & sync PKLs
  if (user.role === 'STUDENT') {
    try {
      const b64 = req.file.buffer.toString('base64');
      const image_base64 = `data:image/jpeg;base64,${b64}`;
      const mlController = require('./mlController');
      const classes = await Class.find({ students: user._id });
      for (const cls of classes) {
        const enrollRes = await mlController.proxy('/api/enroll-face', {
          rollNumber: user.rollNumber,
          classId: cls.classId,
          image_base64,
          studentName: user.name,
          department: user.department,
        }).catch(() => null);

        if (enrollRes && enrollRes.embedding) {
          await User.findByIdAndUpdate(user._id, { $addToSet: { embeddings: enrollRes.embedding } });
        }
      }
    } catch (e) {
      console.log('Embedding extraction on photo upload notice:', e.message);
    }
  }

  res.json({ message: 'Photo uploaded successfully', photoUrl: user.photoUrl });
};

// ─── DELETE /api/users/:id/photo ──────────────────────────────────────────────
const deletePhoto = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (!user.cloudinaryPublicId && !user.photoUrl) {
    return res.status(400).json({ message: 'No photo to delete' });
  }

  await deleteFromCloudinary(user.cloudinaryPublicId || user.photoUrl);
  user.photoUrl = '';
  user.cloudinaryPublicId = '';
  await user.save();

  await AuditLog.create({
    action: 'PHOTO_DELETED',
    performedBy: req.user._id,
    targetUser: user._id,
    details: { studentName: user.name },
    ipAddress: req.ip,
  });

  res.json({ message: 'Photo deleted from Cloudinary and database' });
};

// ─── GET /api/users/:id/embeddings ───────────────────────────────────────────
const getEmbeddings = async (req, res) => {
  const user = await User.findById(req.params.id).select('name rollNumber embeddings');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ name: user.name, rollNumber: user.rollNumber, enrolledVectors: user.embeddings.length, embeddings: user.embeddings });
};

// ─── DELETE /api/users/:id/embeddings ────────────────────────────────────────
const clearEmbeddings = async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { embeddings: [] } }, { new: true }).select('name rollNumber');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ message: `Face embeddings cleared for ${user.name}` });
};

// ─── POST /api/users/clear-db ─────────────────────────────────────────────────
// KEY FEATURE: 100% System Purge — Removes Cloudinary images, MongoDB users/classes/attendance, and ML vector files
const clearDatabase = async (req, res) => {
  const Attendance = require('../models/Attendance');
  const mlController = require('./mlController');

  // 1. Fetch all non-admin users with Cloudinary photos
  const usersWithPhotos = await User.find({
    role: { $ne: 'ADMIN' },
    $or: [
      { cloudinaryPublicId: { $exists: true, $ne: '' } },
      { photoUrl: { $regex: 'cloudinary', $options: 'i' } },
    ],
  }).select('cloudinaryPublicId photoUrl');

  let photosPurged = 0;
  for (const u of usersWithPhotos) {
    const target = u.cloudinaryPublicId || u.photoUrl;
    if (target) {
      const result = await deleteFromCloudinary(target);
      if (result) photosPurged++;
    }
  }

  // 2. Delete non-admin users, classes, and attendance records from MongoDB
  const [deletedUsers, deletedClasses, deletedAttendance] = await Promise.all([
    User.deleteMany({ role: { $ne: 'ADMIN' } }),
    Class.deleteMany({}),
    Attendance.deleteMany({}),
  ]);

  // 3. Clear all Python ML PKL files
  try {
    await mlController.proxy('/api/clear-all-dbs', {});
  } catch (e) {
    console.log('Notice clearing ML PKLs:', e.message);
  }

  // 4. Audit Log
  await AuditLog.create({
    action: 'DATABASE_CLEARED',
    performedBy: req.user?._id || null,
    details: {
      usersRemoved: deletedUsers.deletedCount,
      classesRemoved: deletedClasses.deletedCount,
      attendanceRecordsRemoved: deletedAttendance.deletedCount,
      cloudinaryPhotosPurged: photosPurged,
    },
    ipAddress: req.ip,
  });

  res.json({
    message: 'Database reset successful! All test students, teachers, classes, attendance records, Cloudinary photos, and ML vector files cleared.',
    summary: {
      usersRemoved: deletedUsers.deletedCount,
      classesRemoved: deletedClasses.deletedCount,
      attendanceRecordsRemoved: deletedAttendance.deletedCount,
      cloudinaryPhotosPurged: photosPurged,
    },
  });
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleActive,
  uploadPhoto,
  deletePhoto,
  getEmbeddings,
  clearEmbeddings,
  clearDatabase,
};
