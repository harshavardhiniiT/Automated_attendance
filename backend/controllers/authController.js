const jwt = require('jsonwebtoken');
const User = require('../models/User');

/** Generate signed JWT */
const generateToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, department: user.department },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

// ─── POST /api/auth/login ────────────────────────────────────────────────────
// Supports login via:
// 1) Student: Username/Name OR Roll Number, Password = Roll Number
// 2) Teacher: Username/Name OR Email, Password = Name + Number (or custom pass)
// 3) Admin: Email or Username
const login = async (req, res) => {
  const { identifier, email, rollNumber, password } = req.body;

  const loginId = identifier || email || rollNumber;

  if (!loginId || !password) {
    return res.status(400).json({ message: 'Please provide Username/Email/Roll Number and Password' });
  }

  const cleanId = loginId.trim();

  // Search by email, rollNumber, OR name (case-insensitive regex for name)
  const user = await User.findOne({
    $or: [
      { email: cleanId.toLowerCase() },
      { rollNumber: cleanId.toUpperCase() },
      { name: new RegExp(`^${cleanId}$`, 'i') },
    ],
  }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials. Check your username/password.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: 'Account is deactivated. Contact administrator.' });
  }

  const token = generateToken(user);

  res.json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      rollNumber: user.rollNumber,
      photoUrl: user.photoUrl,
    },
  });
};

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { login, getMe };
