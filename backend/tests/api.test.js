const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';

test('API Health Check Endpoint', async (t) => {
  const res = await fetch(`${BASE_URL}/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.ok(data.service.includes('Attendance'));
});

test('Auth API - Admin Login & JWT Token issuance', async (t) => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@attendance.com', password: 'Admin@1234' }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.token, 'Response must contain JWT token');
  assert.equal(data.user.role, 'ADMIN');

  // Test User Directory API with JWT
  const userRes = await fetch(`${BASE_URL}/api/users?limit=5`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  assert.equal(userRes.status, 200);
  const userData = await userRes.json();
  assert.ok(Array.isArray(userData.users));

  // Test Classes API
  const classRes = await fetch(`${BASE_URL}/api/classes`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  assert.equal(classRes.status, 200);
  const classData = await classRes.json();
  assert.ok(Array.isArray(classData.classes));

  // Test Attendance Stats API
  const statsRes = await fetch(`${BASE_URL}/api/attendance/stats`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  assert.equal(statsRes.status, 200);
  const statsData = await statsRes.json();
  assert.ok('total' in statsData);
  assert.ok('present' in statsData);
  assert.ok('percentage' in statsData);
});

test('Auth API - Student Login & OD Request API', async (t) => {
  // Student login via email or roll number
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: '23CS001', password: 'StudentPass123' }),
  });

  if (res.status === 200) {
    const data = await res.json();
    assert.equal(data.user.role, 'STUDENT');

    // Fetch student ODs
    const odRes = await fetch(`${BASE_URL}/api/od/my`, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    assert.equal(odRes.status, 200);
    const odData = await odRes.json();
    assert.ok(Array.isArray(odData.ods));
  }
});
