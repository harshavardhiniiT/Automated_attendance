require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

const runTests = async () => {
  console.log('🚀 Starting Backend REST API Test Suite...\n');
  let adminToken = '';
  let teacherId = '';
  let studentId = '';
  let classMongoId = '';
  let attendanceRecordId = '';

  try {
    // 1. Health Check
    console.log('1️⃣ Testing Health Check Endpoint...');
    const health = await axios.get('http://localhost:5000/health');
    console.log('   STATUS:', health.data.status, '—', health.data.service);

    // 2. Admin Login
    console.log('\n2️⃣ Testing Admin Login (/api/auth/login)...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: process.env.ADMIN_EMAIL || 'admin@attendance.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@1234'
    });
    adminToken = loginRes.data.token;
    console.log('   ✅ JWT Token received successfully for:', loginRes.data.user.name);

    const authHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };

    // 3. Verify Token (/api/auth/me)
    console.log('\n3️⃣ Testing Auth Me Endpoint (/api/auth/me)...');
    const meRes = await axios.get(`${API_URL}/auth/me`, authHeaders);
    console.log('   ✅ Verified Auth User:', meRes.data.user.name, `[${meRes.data.user.role}]`);

    // 4. Create Teacher User
    console.log('\n4️⃣ Testing User Creation: Teacher (/api/users)...');
    const teacherData = {
      name: 'Prof. Alan Turing',
      email: `turing_${Date.now()}@attendance.com`,
      password: 'Teacher@1234',
      role: 'TEACHER',
      department: 'Computer Science'
    };
    const teacherRes = await axios.post(`${API_URL}/users`, teacherData, authHeaders);
    teacherId = teacherRes.data.user._id;
    console.log('   ✅ Teacher Created:', teacherRes.data.user.name, `(ID: ${teacherId})`);

    // 5. Create Student User
    console.log('\n5️⃣ Testing User Creation: Student (/api/users)...');
    const rollNo = `CS${Math.floor(1000 + Math.random() * 9000)}`;
    const studentData = {
      name: 'Grace Hopper',
      email: `hopper_${Date.now()}@attendance.com`,
      password: 'Student@1234',
      role: 'STUDENT',
      department: 'Computer Science',
      rollNumber: rollNo
    };
    const studentRes = await axios.post(`${API_URL}/users`, studentData, authHeaders);
    studentId = studentRes.data.user._id;
    console.log('   ✅ Student Created:', studentRes.data.user.name, `(Roll: ${rollNo}, ID: ${studentId})`);

    // 6. List Users
    console.log('\n6️⃣ Testing User Listing & Search (/api/users)...');
    const usersRes = await axios.get(`${API_URL}/users?role=STUDENT`, authHeaders);
    console.log(`   ✅ Found ${usersRes.data.total} student(s) in system.`);

    // 7. Update User
    console.log('\n7️⃣ Testing User Update (/api/users/:id)...');
    const updateRes = await axios.put(`${API_URL}/users/${studentId}`, { department: 'Computer Science & AI' }, authHeaders);
    console.log('   ✅ Updated Student Department:', updateRes.data.user.department);

    // 8. Create Class
    console.log('\n8️⃣ Testing Class Creation (/api/classes)...');
    const classCode = `CS${Math.floor(100 + Math.random() * 900)}_SECA`;
    const classData = {
      classId: classCode,
      className: 'Data Structures & Algorithms',
      subject: 'Data Structures',
      department: 'Computer Science & AI',
      teacherId: teacherId,
      schedule: 'Mon/Wed 10:00-11:30 AM',
      room: 'Lab 302'
    };
    const classRes = await axios.post(`${API_URL}/classes`, classData, authHeaders);
    classMongoId = classRes.data.class._id;
    console.log('   ✅ Class Created:', classRes.data.class.className, `(Code: ${classCode})`);

    // 9. Add Student to Class Roster
    console.log('\n9️⃣ Testing Class Roster Mapping (/api/classes/:id/students)...');
    const rosterRes = await axios.post(`${API_URL}/classes/${classMongoId}/students`, { studentId: studentId }, authHeaders);
    console.log('   ✅ Enrolled student into class roster. Total enrolled:', rosterRes.data.class.students.length);

    // 10. Log Attendance
    console.log('\n🔟 Testing Attendance Logging (/api/attendance/log)...');
    const attData = {
      classId: classCode,
      studentId: studentId,
      rollNumber: rollNo,
      confidence: 0.94,
      date: new Date().toISOString().split('T')[0]
    };
    const attRes = await axios.post(`${API_URL}/attendance/log`, attData, authHeaders);
    attendanceRecordId = attRes.data.record._id;
    console.log('   ✅ Attendance Logged:', attRes.data.record.status, `(Confidence: ${attRes.data.record.confidence * 100}%)`);

    // 11. Fetch Attendance Stats & Logs
    console.log('\n1️⃣1️⃣ Testing Attendance Queries (/api/attendance & /api/attendance/stats)...');
    const statsRes = await axios.get(`${API_URL}/attendance/stats?classId=${classCode}`, authHeaders);
    console.log(`   ✅ Attendance Stats for ${classCode}: Total: ${statsRes.data.total}, Present: ${statsRes.data.present}, Percentage: ${statsRes.data.percentage}%`);

    // 12. Manual Override
    console.log('\n1️⃣2️⃣ Testing Attendance Manual Override (/api/attendance/:id/override)...');
    const overrideRes = await axios.patch(`${API_URL}/attendance/${attendanceRecordId}/override`, { status: 'ABSENT' }, authHeaders);
    console.log('   ✅ Manual Override Success:', overrideRes.data.message);

    // 13. Test CSV / Excel Export
    console.log('\n1️⃣3️⃣ Testing Attendance CSV & Excel Exports...');
    const csvRes = await axios.get(`${API_URL}/attendance/export/csv?classId=${classCode}`, authHeaders);
    console.log('   ✅ CSV Export generated. Lines count:', csvRes.data.split('\n').length);

    const excelRes = await axios.get(`${API_URL}/attendance/export/excel?classId=${classCode}`, { ...authHeaders, responseType: 'arraybuffer' });
    console.log('   ✅ Excel Export generated. Buffer size:', excelRes.data.byteLength, 'bytes');

    console.log('\n🎉 ========================================================');
    console.log('   ALL BACKEND REST API ENDPOINTS TESTED AND VERIFIED PERFECTLY!');
    console.log('   ========================================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.response?.data || err.message);
    process.exit(1);
  }
};

runTests();
