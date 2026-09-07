require('dotenv').config();
require('express-async-errors');

// Server entry point - updated schema support
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { runStartupChecks } = require('./config/startupCheck');

// ── Route imports ──────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const classRoutes = require('./routes/classRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const mlRoutes = require('./routes/mlRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const odRoutes = require('./routes/odRoutes');

// ── Connect to MongoDB ─────────────────────────────────────────────────────
connectDB();

const app = express();

// ── Global Middleware ──────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174'
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));  // Support base64 image payloads
app.use(express.urlencoded({ extended: true }));

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Smart Attendance Backend', timestamp: new Date().toISOString() });
});

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/od', odRoutes);

// ── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({ message: `Duplicate value for field: ${field}` });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ID format: ${err.value}` });
  }

  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

// ── Start Server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`\n🚀 Smart Attendance Backend running on http://localhost:${PORT}`);
  console.log(`📡 ML Service expected at: ${process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001'}`);
  console.log(`🌍 Accepting CORS from: http://localhost:5173, http://localhost:5174\n`);

  await runStartupChecks();
});
