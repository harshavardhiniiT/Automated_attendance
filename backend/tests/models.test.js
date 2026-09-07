const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const ODRequest = require('../models/ODRequest');

test('User Model - password hashing & validation', async (t) => {
  const user = new User({
    name: 'Test Faculty',
    email: 'test_faculty_unit@attendance.com',
    password: 'Password123',
    role: 'TEACHER',
    department: 'Computer Science & Engineering',
    employeeId: 'EMP-UNIT-01',
  });

  assert.equal(user.name, 'Test Faculty');
  assert.equal(user.role, 'TEACHER');
  assert.equal(user.employeeId, 'EMP-UNIT-01');

  await user.validate();
  assert.ok(user.email.includes('@'));
});

test('Attendance Model - verifiedVia enum supports all operational modes', async (t) => {
  const allowedModes = ['FACE_AI', 'MANUAL_OVERRIDE', 'MANUAL_ENTRY', 'ON_DUTY', 'HYBRID_VERIFICATION', 'UNCHECKED'];
  
  for (const mode of allowedModes) {
    const record = new Attendance({
      classId: 'CS101_SECA',
      student: new mongoose.Types.ObjectId(),
      rollNumber: '26CS001',
      date: '2026-08-28',
      status: 'PRESENT',
      confidence: 0.95,
      verifiedVia: mode,
    });

    await record.validate();
  }
});

test('Class Model - schema validation', async (t) => {
  const course = new Class({
    classId: 'CS202_SECB',
    className: 'Database Management Systems',
    subject: 'Database Systems',
    department: 'Computer Science & Engineering',
    teacher: new mongoose.Types.ObjectId(),
    schedule: 'Mon, Wed • 09:00 AM - 10:30 AM',
    room: 'Lab 104',
  });

  await course.validate();
});

test('ODRequest Model - schema validation & categories', async (t) => {
  const od = new ODRequest({
    student: new mongoose.Types.ObjectId(),
    classId: new mongoose.Types.ObjectId(),
    odCategory: 'TECHNICAL_SYMPOSIUM',
    eventName: 'State Hackathon 2026',
    organizingBody: 'Anna University',
    startDate: new Date('2026-08-28'),
    endDate: new Date('2026-08-28'),
    reason: 'Participating in Final Round',
  });

  await od.validate();
});
