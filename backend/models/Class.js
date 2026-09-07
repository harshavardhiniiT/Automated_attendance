const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    classId: {
      type: String,
      required: [true, 'Class ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      // e.g. "CS101_SECA"
    },
    className: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
      // e.g. "CS101 - Data Structures Section A"
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned teacher is required'],
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    schedule: {
      type: String,
      required: [true, 'Class schedule date and time are required'],
      trim: true,
    },
    room: {
      type: String,
      default: '',
    },
    academicTerm: {
      type: String,
      default: 'AY 2026-2027 ODD (SEM III,V,VII,IX)',
      trim: true,
    },
    semester: {
      type: String,
      default: 'Semester V',
      trim: true,
    },
    courseCode: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Class', classSchema);
