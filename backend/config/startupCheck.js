const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;

const ML_DIR = path.join(__dirname, '../../ml');
const MODELS_DIR = path.join(ML_DIR, 'models');
const YUNET_PATH = path.join(MODELS_DIR, 'face_detection_yunet.onnx');
const SFACE_PATH = path.join(MODELS_DIR, 'face_recognition_sface.onnx');

// Find best python executable
const getPythonCmd = () => {
  const localVenv = path.join(__dirname, '../../.venv/Scripts/python.exe');
  if (fs.existsSync(localVenv)) return localVenv;
  return 'python';
};

/**
 * 1. Check & Auto-Download ONNX AI Models if missing
 */
const checkAndDownloadModels = () => {
  if (!fs.existsSync(YUNET_PATH) || !fs.existsSync(SFACE_PATH)) {
    console.log('⬇️  ONNX AI Models missing in ml/models/ — Auto-downloading YuNet & SFace models...');
    const pythonCmd = getPythonCmd();
    const result = spawnSync(pythonCmd, ['download_models.py'], { cwd: ML_DIR, stdio: 'inherit', windowsHide: true });
    if (result.status === 0) {
      console.log('✅ ONNX AI Models downloaded successfully!');
    } else {
      console.error('⚠️  Failed to auto-download models. Ensure python is installed.');
    }
  } else {
    console.log('✅ ONNX AI Models Present: YuNet (Detector) + SFace (ArcFace 128-D)');
  }
};

/**
 * 2. Check Cloudinary credentials status
 */
const checkCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && cloudName !== 'your_cloud_name' && apiKey && apiKey !== 'your_api_key' && apiSecret) {
    console.log(`☁️  Cloudinary Configured: Cloud [${cloudName}]`);
    return true;
  } else {
    console.log('⚠️  Cloudinary: Placeholder credentials in .env (Add your credentials to enable cloud photo storage)');
    return false;
  }
};

/**
 * 3. Check & Auto-Start Flask ML Microservice
 */
const ensureMlServiceRunning = async () => {
  const mlUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';
  try {
    await axios.get(`${mlUrl}/health`, { timeout: 2000 });
    console.log(`🧠 ML Microservice Online at ${mlUrl}`);
  } catch {
    console.log(`⚡ Spawning Python ML Microservice on ${mlUrl}...`);
    const pythonCmd = getPythonCmd();

    // Check if python packages are installed, if not auto pip install
    const testPy = spawnSync(pythonCmd, ['-c', 'import flask, flask_cors, cv2, numpy'], { cwd: ML_DIR, windowsHide: true });
    if (testPy.status !== 0) {
      console.log('📦 Installing Python dependencies from ml/requirements.txt...');
      const pipCmd = pythonCmd.replace('python.exe', 'pip.exe');
      spawnSync(pipCmd, ['install', '-r', 'requirements.txt'], { cwd: ML_DIR, stdio: 'inherit', windowsHide: true });
    }

    const mlProcess = spawn(pythonCmd, ['app.py'], { cwd: ML_DIR, stdio: 'ignore', detached: true, windowsHide: true });
    mlProcess.unref();

    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        await axios.get(`${mlUrl}/health`, { timeout: 1000 });
        console.log(`✅ ML Microservice Verified & Ready on ${mlUrl}`);
        break;
      } catch {}
    }
  }
};

/**
 * Main System Startup Verification
 */
const runStartupChecks = async () => {
  console.log('\n========================================================');
  console.log('🎓 SMART CLASSROOM FACE ATTENDANCE SYSTEM — INITIALIZING');
  console.log('========================================================');

  checkAndDownloadModels();
  checkCloudinary();
  await ensureMlServiceRunning();
};

module.exports = { runStartupChecks };
