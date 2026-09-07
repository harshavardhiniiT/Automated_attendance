const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // never returned in queries by default
    },
    role: {
      type: String,
      enum: ['ADMIN', 'TEACHER', 'STUDENT'],
      required: [true, 'Role is required'],
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    rollNumber: {
      type: String,
      unique: true,
      sparse: true, // allows null for non-student roles
      uppercase: true,
      trim: true,
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true, // allows null for non-teacher roles
      uppercase: true,
      trim: true,
    },
    // Cloudinary photo storage
    photoUrl: {
      type: String,
      default: '',
    },
    cloudinaryPublicId: {
      type: String,
      default: '',
    },
    // 128-D ArcFace embedding vectors (array of arrays for multiple photo enrollments)
    embeddings: {
      type: [[Number]],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash password before save (Mongoose 7+ async hook — no next() needed)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare plain password with hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
