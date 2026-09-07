const mongoose = require('mongoose');

const odRequestSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
    },
    odCategory: {
      type: String,
      enum: ['TECHNICAL_SYMPOSIUM', 'SPORTS_MEET', 'PLACEMENT_DRIVE', 'CULTURALS', 'MEDICAL_OD'],
      default: 'TECHNICAL_SYMPOSIUM',
    },
    eventName: {
      type: String,
      required: true,
      trim: true,
    },
    organizingBody: {
      type: String,
      default: 'College Event',
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    proofDocumentUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    facultyNotes: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ODRequest', odRequestSchema);
