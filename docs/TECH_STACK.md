# 🛠️ Technical Architecture & Stack Specifications (TECH_STACK.md)
## Smart Classroom Face Attendance System

---

## 📑 Table of Contents
1. [Technology Stack Overview](#1-technology-stack-overview)
2. [Frontend Architecture (Vite + React 18 + TailwindCSS)](#2-frontend-architecture-vite--react-18--tailwindcss)
3. [Backend Architecture (Node.js + Express + Mongoose)](#3-backend-architecture-nodejs--express--mongoose)
4. [Machine Learning Microservice (Python + OpenCV YuNet + SFace)](#4-machine-learning-microservice-python--opencv-yunet--sface)
5. [V2 Multi-PKL Vector Engine Architecture](#5-v2-multi-pkl-vector-engine-architecture)
6. [V2 Dedicated Multi-Threading Worker Engine](#6-v2-dedicated-multi-threading-worker-engine)
7. [Database Schemas & Data Structures](#7-database-schemas--data-structures)
8. [API Endpoint Contracts (REST & ML API)](#8-api-endpoint-contracts-rest--ml-api)
9. [Environment & Credentials Management](#9-environment--credentials-management)
10. [V1 to V2 Developer Implementation Roadmap](#10-v1-to-v2-developer-implementation-roadmap)

---

## 1. 🛠️ Technology Stack Overview

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      VITE + REACT 18 FRONTEND                          │
 │  - UI Framework: React 18 + Vite (HMR)                                 │
 │  - Styling: TailwindCSS + Lucide Icons + Glassmorphism Tokens          │
 │  - State & Router: React Router DOM v6 + Context API / Zustand         │
 │  - Camera Capture: HTML5 MediaDevices API + Canvas Rendering           │
 └───────────────────┬────────────────────────────────┬───────────────────┘
                     │ HTTP / REST (JWT Auth)         │ WebSocket / Base64 Stream
                     ▼                                ▼
 ┌────────────────────────────────────────┐   ┌───────────────────────────┐
 │       NODE.JS / EXPRESS BACKEND        │   │  PYTHON FLASK ML SERVICE  │
 │ - Server: Node.js 18+ / Express.js 4   │   │ - Server: Python 3.10+    │
 │ - ORM: Mongoose 8+ (MongoDB Atlas)     │◄─►│ - CV Engine: OpenCV 4.8+  │
 │ - Auth: JSON Web Tokens + Bcrypt       │   │ - Detector: YuNet ONNX    │
 │ - Exports: ExcelJS + CSV Parser        │   │ - Embedder: SFace ONNX    │
 └───────────────────┬────────────────────┘   │ - Threading: Concurrent   │
                     │                        └───────────────────────────┘
                     ▼
         ┌───────────────────────┐
         │   MONGODB ATLAS DB    │
         │ - Cluster: attendance │
         │ - Users, Classes,     │
         │   Attendance Logs     │
         └───────────────────────┘
```

| Layer | Primary Technologies | Key Libraries / Packages |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, Vite 5, TailwindCSS 3 | `lucide-react`, `clsx`, `tailwind-merge`, `axios`, `socket.io-client` |
| **Backend REST API** | Node.js 18+, Express.js 4 | `mongoose`, `jsonwebtoken`, `bcryptjs`, `cors`, `dotenv`, `exceljs` |
| **Database** | MongoDB Atlas 6.0+ | `attendance` cluster with indexed collections |
| **ML Microservice** | Python 3.10+, Flask 3 / FastAPI | `opencv-python`, `numpy`, `pillow`, `gunicorn`, `concurrent.futures` |
| **Biometric Neural Nets** | OpenCV ONNX Micro-Models | `face_detection_yunet_2023mar.onnx`, `face_recognition_sface_2021dec.onnx` |

---

## 2. 🎨 Frontend Architecture (Vite + React 18 + TailwindCSS)

### 2.1 Design Tokens & Aesthetic Principles
The UI follows modern **Glassmorphism** and **Sleek Dark/Light Mode** principles using TailwindCSS utility classes:
- **Color Palette**:
  - Primary Accent: Deep Indigo / Violet (`bg-indigo-600`, `text-indigo-400`)
  - Success State (Confirmation Hold): Emerald Green (`bg-emerald-500/20`, `border-emerald-500`, `text-emerald-400`)
  - Dark Mode Background: Slate 900 (`bg-slate-900`, `bg-slate-800/50` for glass containers)
  - Typography: Inter / Outfit font family (`font-sans`)
- **Micro-Animations**: Smooth transitions on modal popups, button hovers (`transition-all duration-300 ease-in-out`), and pulsing camera status indicators.

### 2.2 Dashboard Component Tree
```
src/
├── components/
│   ├── common/
│   │   ├── Navbar.jsx
│   │   ├── Sidebar.jsx
│   │   ├── Modal.jsx               <-- Reusable smooth modal with backdrop blur
│   │   ├── StatusBadge.jsx
│   │   └── ConfirmationBanner.jsx  <-- 7-Second GREEN hold banner modal
│   ├── camera/
│   │   ├── CameraModal.jsx         <-- HTML5 webcam stream + Canvas frame grabber
│   │   └── FrameOverlay.jsx        <-- Face bounding box rendering canvas
│   └── tables/
│       ├── AttendanceTable.jsx
│       └── RosterTable.jsx
├── pages/
│   ├── login/
│   │   └── LoginPage.jsx
│   ├── admin/
│   │   ├── AdminDashboard.jsx
│   │   ├── ManageUsers.jsx
│   │   └── ManageClasses.jsx
│   ├── teacher/
│   │   ├── TeacherDashboard.jsx
│   │   ├── LiveSession.jsx         <-- Live attendance engine controller
│   │   └── AttendanceReports.jsx
│   └── student/
│       ├── StudentDashboard.jsx
│       └── EnrollmentModal.jsx
```

### 2.3 7-Second State Banner Modal Logic
```javascript
// State Machine inside LiveSession.jsx
const [sessionState, setSessionState] = useState('SCANNING'); // 'SCANNING' | 'LOCKED_CONFIRMED'
const [activeStudent, setActiveStudent] = useState(null);

const handleFrameResult = (result) => {
  if (sessionState === 'SCANNING' && result.matched) {
    setActiveStudent(result.student);
    setSessionState('LOCKED_CONFIRMED');
    
    // Play subtle success chime audio
    playChimeSound();
    
    // Hold green confirmation banner for 7 seconds
    setTimeout(() => {
      setSessionState('SCANNING');
      setActiveStudent(null);
    }, 7000);
  }
};
```

---

## 3. ⚙️ Backend Architecture (Node.js + Express + Mongoose)

### 3.1 Directory Structure
```
backend/
├── config/
│   └── db.js                 <-- Mongoose Atlas connection setup
├── controllers/
│   ├── authController.js     <-- JWT issuance & password verification
│   ├── userController.js     <-- CRUD for Admins, Teachers, Students
│   ├── classController.js    <-- Class section & roster mapping
│   └── attendanceController.js <-- Attendance query & export controllers
├── middleware/
│   ├── authMiddleware.js     <-- JWT verification
│   └── roleMiddleware.js     <-- Access guards (ADMIN, TEACHER, STUDENT)
├── models/
│   ├── User.js
│   ├── Class.js
│   ├── Attendance.js
│   └── AuditLog.js
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── classRoutes.js
│   └── attendanceRoutes.js
└── server.js
```

---

## 4. 🧠 Machine Learning Microservice (Python + OpenCV YuNet + SFace)

### 4.1 Neural Model Pipeline
1. **OpenCV YuNet (`face_detection_yunet_2023mar.onnx`)**:
   - Deep anchor-based face detector capable of detecting faces in real-time ($< 5\text{ ms}$).
   - Generates bounding box coordinates $[x, y, w, h]$ and 5-point facial landmarks (right eye, left eye, nose tip, right mouth corner, left mouth corner).
2. **Face Alignment & Normalization**:
   - Aligns the detected face crop using affine transformation based on eye landmarks to standard $112 \times 112$ pixels.
3. **OpenCV SFace (`face_recognition_sface_2021dec.onnx`)**:
   - ArcFace feature extraction model generating a normalized 128-dimensional floating-point vector.
4. **Cosine Similarity Matching**:
   $$\text{Cosine Similarity} = \frac{\mathbf{v}_1 \cdot \mathbf{v}_2}{\|\mathbf{v}_1\| \|\mathbf{v}_2\|}$$
   - Threshold $\ge 0.36$ indicates a confident identity match.

---

## 5. 📦 V2 Multi-PKL Vector Engine Architecture

### 5.1 Multi-PKL File Storage Layout
To support multiple concurrent classes without cross-class vector pollution, student embeddings are partitioned by `classId`:

```
ml/
├── models/
│   ├── face_detection_yunet_2023mar.onnx
│   └── face_recognition_sface_2021dec.onnx
├── class_dbs/
│   ├── CS101_SECA_db.pkl     <-- Scoped vectors for CS101 Section A
│   ├── CS102_SECB_db.pkl     <-- Scoped vectors for CS102 Section B
│   └── EE201_SECA_db.pkl     <-- Scoped vectors for EE201 Section A
└── multi_pkl_engine.py      <-- Multi-PKL Index & LRU Manager
```

### 5.2 Multi-PKL LRU Cache Manager
```python
import pickle
import numpy as np
from pathlib import Path
from collections import OrderedDict

class MultiPKLEngine:
    def __init__(self, db_dir="ml/class_dbs", max_cached_classes=10):
        self.db_dir = Path(db_dir)
        self.cache = OrderedDict()  # LRU cache of classId -> (matrix, roll_numbers, metadata)
        self.max_cached = max_cached_classes

    def get_class_matrix(self, class_id):
        if class_id in self.cache:
            # Move to end (most recently used)
            self.cache.move_to_end(class_id)
            return self.cache[class_id]

        pkl_path = self.db_dir / f"{class_id}_db.pkl"
        if not pkl_path.exists():
            raise FileNotFoundError(f"PKL database for class {class_id} does not exist.")

        with open(pkl_path, "rb") as f:
            data = pickle.load(f)

        roll_numbers = []
        vectors = []

        for roll_no, student_data in data["STUDENTS"].items():
            for feat in student_data["features"]:
                roll_numbers.append((roll_no, student_data["name"]))
                vectors.append(feat)

        matrix = np.array(vectors, dtype=np.float32) if vectors else np.empty((0, 128))
        
        # Evict oldest entry if cache exceeds limit
        if len(self.cache) >= self.max_cached:
            self.cache.popitem(last=False)

        self.cache[class_id] = (matrix, roll_numbers)
        return self.cache[class_id]

    def match_face(self, class_id, query_vector, threshold=0.36):
        matrix, student_info = self.get_class_matrix(class_id)
        if matrix.shape[0] == 0:
            return None, 0.0

        # Scoped batch matrix dot-product
        sims = np.dot(matrix, query_vector)
        best_idx = np.argmax(sims)
        best_score = float(sims[best_idx])

        if best_score >= threshold:
            roll_no, name = student_info[best_idx]
            return {"rollNumber": roll_no, "name": name}, best_score

        return None, best_score
```

---

## 6. 🧵 V2 Dedicated Multi-Threading Worker Engine

### 6.1 Producer-Consumer Queue Model
To ensure HTTP server routes and WebSocket connections remain zero-latency, frame decoding and neural net inference are delegated to background threads:

```
[ Client Webcam Feed ]
         │ (HTTP Base64 POST / WebSocket)
         ▼
┌─────────────────────────────────┐
│  Flask/FastAPI Event Loop       │  <-- Non-blocking: pushes frame task to Queue
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ Async ThreadSafe Queue (Max 30) │
└────────────────┬────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  ThreadPoolExecutor (4 Dedicated Worker Threads)       │
│  - Worker 1: Decode Base64 Image to OpenCV Mat          │
│  - Worker 2: YuNet Face Detection & Crop Normalization │
│  - Worker 3: SFace 128-D Vector Extraction              │
│  - Worker 4: Scoped Dot-Product Match against PKL      │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│ Async Result Callback           │  <-- Triggers WebSocket push & DB Save
└─────────────────────────────────┘
```

### 6.2 Python Multi-Thread Worker Implementation Snippet
```python
from concurrent.futures import ThreadPoolExecutor
import queue
import threading

class DedicatedMLWorkerPool:
    def __init__(self, max_workers=4):
        self.executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="MLWorker")
        self.multi_pkl = MultiPKLEngine()

    def process_frame_async(self, class_id, base64_frame, callback):
        # Submit async task to dedicated worker pool
        future = self.executor.submit(self._worker_task, class_id, base64_frame)
        future.add_done_callback(lambda f: callback(f.result()))

    def _worker_task(self, class_id, base64_frame):
        # Step 1: Decode image
        frame = decode_base64_to_cv2(base64_frame)
        if frame is None:
            return {"matched": False, "error": "Invalid frame"}

        # Step 2: YuNet face detection
        faces = detect_faces_yunet(frame)
        if not faces:
            return {"matched": False, "reason": "No face detected"}

        # Step 3: SFace 128-D vector extraction
        vector = extract_sface_embedding(frame, faces[0])

        # Step 4: Multi-PKL matrix matching
        match, score = self.multi_pkl.match_face(class_id, vector)
        if match:
            return {"matched": True, "student": match, "confidence": score}

        return {"matched": False, "reason": "Low confidence match", "confidence": score}
```

---

## 7. 🗄️ Database Schemas & Data Structures

### 7.1 Mongoose Schemas

#### User Schema (`backend/models/User.js`)
```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'TEACHER', 'STUDENT'], required: true },
  department: { type: String, required: true },
  rollNumber: { type: String, unique: true, sparse: true },
  photoUrl: { type: String, default: '' },
  embeddings: { type: [[Number]], default: [] }, // Array of 128-D vectors
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
```

#### Class Schema (`backend/models/Class.js`)
```javascript
const classSchema = new mongoose.Schema({
  classId: { type: String, required: true, unique: true }, // e.g. "CS101_SECA"
  className: { type: String, required: true },
  department: { type: String, required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);
```

#### Attendance Schema (`backend/models/Attendance.js`)
```javascript
const attendanceSchema = new mongoose.Schema({
  classId: { type: String, required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rollNumber: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['PRESENT', 'ABSENT'], default: 'PRESENT' },
  confidence: { type: Number, required: true },
  verifiedVia: { type: String, enum: ['FACE_AI', 'MANUAL_OVERRIDE'], default: 'FACE_AI' }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
```

---

## 8. 📡 API Endpoint Contracts (REST & ML API)

### 8.1 Auth & User REST APIs (`Express`)
- `POST /api/auth/login`: Authenticates credentials and returns JWT token.
- `POST /api/users/create`: Admin endpoint to onboard Teacher or Student accounts.
- `GET /api/classes/assigned`: Teacher endpoint returning assigned class sections.
- `POST /api/attendance/manual-override`: Teacher endpoint to override attendance state.

### 8.2 Flask ML Microservice Endpoints
- `POST /api/ml/enroll-face`: Receives `rollNumber`, `classId`, and `image_base64`. Generates 128-D vector and appends to `<class_id>_db.pkl`.
- `POST /api/ml/load-class-db`: Pre-loads `<class_id>_db.pkl` into memory matrix cache.
- `POST /api/ml/process-frame`: Accepts `classId` and `frame_base64`. Runs frame detection and matrix matching.

---

## 9. 🔐 Environment & Credentials Management

System configuration variables are stored securely in `.env` files (never committed to repository):

```env
# Node.js Express Server Configuration (.env)
PORT=5000
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key_2026

# MongoDB Atlas Connection (referencing docs/crdentals)
MONGODB_URI=mongodb+srv://hariramji3423n_db_user:vjgIjXr4QhxpJLnv@attendance.veakfwq.mongodb.net/attendance?retryWrites=true&w=majority

# Flask ML Microservice URL
ML_SERVICE_URL=http://127.0.0.1:5001
```

---

## 10. 🗺️ V1 to V2 Developer Implementation Roadmap

```
Phase 1: Base Setup (V1)       Phase 2: Core MERN (V1)         Phase 3: Multi-PKL (V2)        Phase 4: Multi-Threading (V2)
┌──────────────────────┐      ┌──────────────────────┐        ┌──────────────────────┐       ┌──────────────────────┐
│ • Vite React App     │ ───► │ • Express & Mongo DB │ ─────► │ • Multi-PKL Engine   │ ────► │ • Worker Thread Pool │
│ • Tailwind Styling   │      │ • Auth & User Routes │        │ • Section Isolation  │       │ • WebSocket Engine   │
│ • Camera Modal UI    │      │ • Single-PKL Flask ML│        │ • LRU Vector Cache   │       │ • Live Stream Engine │
└──────────────────────┘      └──────────────────────┘        └──────────────────────┘       └──────────────────────┘
```

1. **Step 1 (Frontend Foundation)**: Set up Vite + React project with TailwindCSS and Lucide React. Build responsive layouts, login form, dashboard shells, and camera canvas modal with 7-second confirmation hold banner.
2. **Step 2 (Express Backend & Database)**: Configure Mongoose connection using MongoDB Atlas URI. Implement User, Class, Attendance models, JWT authentication middleware, and RBAC guards.
3. **Step 3 (Flask ML Integration)**: Build Python Flask microservice integrating OpenCV YuNet and SFace ONNX models. Implement face detection, landmark alignment, 128-D embedding extraction, and cosine similarity matching.
4. **Step 4 (V2 Multi-PKL Engine)**: Create section-isolated `.pkl` generator (`ml/class_dbs/<class_id>_db.pkl`) and implement the `MultiPKLEngine` class with LRU cache eviction.
5. **Step 5 (V2 Dedicated Multi-Threading)**: Implement `ThreadPoolExecutor` worker pool inside Flask/FastAPI. Wrap frame decoding and matrix dot-product operations in async futures to guarantee zero-latency execution.
