const axios = require('axios');
const User = require('../models/User');
const Class = require('../models/Class');

const ML_URL = () => process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

/** Generic proxy helper */
const proxy = async (endpoint, data, method = 'post') => {
  if (method.toLowerCase() === 'delete') {
    const response = await axios.delete(`${ML_URL()}${endpoint}`, { timeout: 30000 });
    return response.data;
  }
  const response = await axios.post(`${ML_URL()}${endpoint}`, data, { timeout: 30000 });
  return response.data;
};

/** Helper to build/sync class PKL in Python microservice from MongoDB */
const syncClassDbHelper = async (classId, extraStudents = []) => {
  if (!classId) return null;
  const cid = classId.toUpperCase();
  const cls = await Class.findOne({ $or: [{ classId: cid }, { classId: classId }] }).populate('students');

  const studentsPayload = [];
  if (cls && cls.students) {
    cls.students.forEach((s) => {
      let feats = s.embeddings || [];
      if (Array.isArray(feats) && feats.length > 0 && typeof feats[0] === 'number') {
        feats = [feats];
      }
      studentsPayload.push({
        rollNumber: s.rollNumber || s.email,
        name: s.name,
        department: s.department || cls.department || 'General',
        features: feats,
        photoUrl: s.photoUrl || '',
      });
    });
  }

  if (Array.isArray(extraStudents) && extraStudents.length > 0) {
    extraStudents.forEach((es) => {
      if (es.rollNumber || es.roll_number) {
        let feats = es.features || es.embeddings || [];
        if (Array.isArray(feats) && feats.length > 0 && typeof feats[0] === 'number') {
          feats = [feats];
        }
        studentsPayload.push({
          rollNumber: es.rollNumber || es.roll_number,
          name: es.name || es.studentName || 'Student',
          department: es.department || 'General',
          features: feats,
          photoUrl: es.photoUrl || es.photo_url || '',
          image_base64: es.image_base64 || es.imageBase64 || '',
        });
      }
    });
  }

  try {
    const result = await proxy('/api/load-class-db', { classId: cid, students: studentsPayload });
    if (result && result.new_embeddings && Array.isArray(result.new_embeddings)) {
      for (const item of result.new_embeddings) {
        if (item.rollNumber && item.embedding) {
          await User.findOneAndUpdate(
            { rollNumber: item.rollNumber.toUpperCase() },
            { $addToSet: { embeddings: item.embedding } }
          );
        }
      }
    }
    return result;
  } catch (err) {
    console.error(`Error syncing PKL for class ${cid}:`, err.message);
    return null;
  }
};

// ─── POST /api/ml/enroll-face ─────────────────────────────────────────────────
const enrollFace = async (req, res) => {
  const { rollNumber, classId, image_base64 } = req.body;
  if (!rollNumber || !classId || !image_base64) {
    return res.status(400).json({ message: 'rollNumber, classId, and image_base64 required' });
  }

  const student = await User.findOne({ rollNumber: rollNumber.toUpperCase() });
  if (!student) return res.status(404).json({ message: 'Student not found in database' });

  const result = await proxy('/api/enroll-face', {
    rollNumber: rollNumber.toUpperCase(),
    classId: classId.toUpperCase(),
    image_base64,
    studentName: student.name,
    department: student.department,
  });

  // Save the returned embedding vector into MongoDB
  if (result.embedding) {
    await User.findByIdAndUpdate(student._id, { $addToSet: { embeddings: result.embedding } });
  }

  res.json({ message: 'Face enrolled successfully', vectorCount: result.vector_count, studentName: student.name });
};

// ─── POST /api/ml/load-class-db ───────────────────────────────────────────────
// Dynamically builds/loads the class PKL in memory from MongoDB embeddings & student photos
const loadClassDb = async (req, res) => {
  const { classId, students: reqStudents } = req.body;
  if (!classId) return res.status(400).json({ message: 'classId required' });

  const result = await syncClassDbHelper(classId, reqStudents);
  if (result) {
    return res.json(result);
  }
  res.status(500).json({ message: 'Failed to build PKL for class ' + classId });
};

// ─── POST /api/ml/process-frame ───────────────────────────────────────────────
const processFrame = async (req, res) => {
  const { classId, frame_base64 } = req.body;
  if (!classId || !frame_base64) return res.status(400).json({ message: 'classId and frame_base64 required' });

  const result = await proxy('/api/process-frame', { classId: classId.toUpperCase(), frame_base64 });
  res.json(result);
};

// ─── DELETE /api/ml/clean-class-db ───────────────────────────────────────────
// Wipes the temporary PKL file from disk after attendance session finishes
const cleanClassDb = async (req, res) => {
  const { classId } = req.body;
  if (!classId) return res.status(400).json({ message: 'classId required' });

  try {
    const result = await proxy(`/api/class-db/${classId.toUpperCase()}`, {}, 'delete');
    res.json({ message: `PKL database cleaned for ${classId.toUpperCase()}`, ...result });
  } catch (err) {
    res.json({ message: `Clean PKL finished for ${classId.toUpperCase()}` });
  }
};

// ─── GET /api/ml/health ───────────────────────────────────────────────────────
const mlHealth = async (req, res) => {
  try {
    const { data } = await axios.get(`${ML_URL()}/health`, { timeout: 5000 });
    res.json({ online: true, ...data });
  } catch {
    res.json({ online: false, message: 'ML service is not reachable' });
  }
};

// ─── POST /api/ml/start-session ──────────────────────────────────────────────
const startSession = async (req, res) => {
  const { classId } = req.body;
  if (!classId) return res.status(400).json({ message: 'classId required' });

  // First sync student database for this class from MongoDB into ephemeral PKL
  await syncClassDbHelper(classId);

  const result = await proxy('/api/start-session', { classId: classId.toUpperCase() });
  res.json(result);
};

// ─── POST /api/ml/stop-session ───────────────────────────────────────────────
const stopSession = async (req, res) => {
  const { classId } = req.body;
  if (!classId) return res.status(400).json({ message: 'classId required' });

  const result = await proxy('/api/stop-session', { classId: classId.toUpperCase() });
  res.json(result);
};

// ─── POST /api/ml/clear-all-pkls ──────────────────────────────────────────────
const clearAllPkls = async (req, res) => {
  try {
    const result = await proxy('/api/clear-all-dbs', {});
    res.json({ message: 'All PKL vector databases cleared', ...result });
  } catch (err) {
    res.json({ message: 'PKL reset completed' });
  }
};

module.exports = {
  enrollFace,
  loadClassDb,
  processFrame,
  cleanClassDb,
  clearAllPkls,
  mlHealth,
  syncClassDbHelper,
  startSession,
  stopSession,
  proxy,
};



