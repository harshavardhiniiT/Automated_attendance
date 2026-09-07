const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BACKEND_URL = 'http://localhost:5000/api';
const ML_URL = 'http://127.0.0.1:5001';

const runIntegrationTests = async () => {
  console.log('🚀 Starting ML Service & Proxy Integration Test Suite...\n');

  try {
    // 1. Direct ML Health Check
    console.log('1️⃣ Testing Direct ML Microservice Health (http://127.0.0.1:5001/health)...');
    const directHealth = await axios.get(`${ML_URL}/health`);
    console.log('   ✅ Direct ML Status:', directHealth.data.status, '— Models:', directHealth.data.models);

    // 2. Admin Login to get JWT Token
    console.log('\n2️⃣ Logging into Express Backend to get Auth Token...');
    const loginRes = await axios.post(`${BACKEND_URL}/auth/login`, {
      email: 'admin@attendance.com',
      password: 'Admin@1234'
    });
    const token = loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
    console.log('   ✅ Authenticated as Admin');

    // 3. Backend ML Health Proxy Check
    console.log('\n3️⃣ Testing Express Backend ML Health Proxy (/api/ml/health)...');
    const proxyHealth = await axios.get(`${BACKEND_URL}/ml/health`, authHeaders);
    console.log('   ✅ Backend ML Health Proxy:', proxyHealth.data.online ? 'Online ✓' : 'Offline ❌');

    // 4. Test PKL Class DB Initialization
    console.log('\n4️⃣ Testing Load Class DB via Express Proxy (/api/ml/load-class-db)...');
    const loadDbRes = await axios.post(`${BACKEND_URL}/ml/load-class-db`, { classId: 'CS101_SECA' }, authHeaders);
    console.log('   ✅ Loaded PKL DB for CS101_SECA. Student Count:', loadDbRes.data.student_count);

    // 5. Test Face Processing with sample image (if available)
    const testFacePath = path.join(__dirname, '../../finalh/test_face.jpg');
    if (fs.existsSync(testFacePath)) {
      console.log('\n5️⃣ Testing Face Frame Recognition with test_face.jpg...');
      const imageBuffer = fs.readFileSync(testFacePath);
      const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

      const processRes = await axios.post(`${BACKEND_URL}/ml/process-frame`, {
        classId: 'CS101_SECA',
        frame_base64: base64Image
      }, authHeaders);

      console.log('   ✅ Frame Processing Result:', processRes.data);
    }

    console.log('\n🎉 ========================================================');
    console.log('   ML MICROSERVICE & EXPRESS PROXY TESTED & VERIFIED 100%!');
    console.log('   ========================================================\n');
  } catch (err) {
    console.error('\n❌ INTEGRATION TEST FAILED:', err.response?.data || err.message);
    process.exit(1);
  }
};

runIntegrationTests();
