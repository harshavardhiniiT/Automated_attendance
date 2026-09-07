const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    classId: {
      type: String,
      required: [true, 'Class ID is required'],
      index: true,
      uppercase: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required'],
      index: true,
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      uppercase: true,
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      // Stored as "YYYY-MM-DD" for easy range queries
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT'],
      default: 'PRESENT',
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    verifiedVia: {
      type: String,
      enum: ['FACE_AI', 'MANUAL_OVERRIDE', 'MANUAL_ENTRY', 'ON_DUTY', 'HYBRID_VERIFICATION', 'UNCHECKED'],
      default: 'FACE_AI',
    },
  },
  { timestamps: true }
);

// Compound index: one status record per student per class per date
attendanceSchema.index({ classId: 1, student: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
