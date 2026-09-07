/**
 * Seed Script — Creates the default ADMIN user
 * Run: node scripts/seedAdmin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
// Use Google DNS to bypass ISP SRV lookup failures
require('dns').setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const exists = await User.findOne({ email: process.env.ADMIN_EMAIL });
    if (exists) {
      console.log(`⚠️  Admin already exists: ${exists.email}`);
      process.exit(0);
    }

    const admin = await User.create({
      name: process.env.ADMIN_NAME || 'System Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@attendance.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@1234',
      role: 'ADMIN',
      department: process.env.ADMIN_DEPARTMENT || 'Administration',
      isActive: true,
    });

    console.log(`\n🎉 Admin created successfully!`);
    console.log(`   Email   : ${admin.email}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Admin@1234'}`);
    console.log(`   Role    : ${admin.role}\n`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
};

seedAdmin();
