const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      // e.g. "MANUAL_OVERRIDE", "USER_DELETED", "PHOTO_DELETED", "STATUS_TOGGLED"
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    targetClass: {
      type: String,
      default: null, // classId string
    },
    details: {
      type: mongoose.Schema.Types.Mixed, // free-form JSON for extra context
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
