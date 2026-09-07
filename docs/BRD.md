# 💼 Business Requirements Document (BRD)
## Smart Classroom Face Attendance System

---

## 📄 Document Information
- **Project Title**: Smart Classroom Face Attendance System
- **Document Version**: 1.0.0
- **Authors**: Antigravity AI Engineering Team
- **Target Release**: V1 (MERN Core MVP) & V2 (Multi-PKL & Multi-Threaded Scale Engine)
- **Status**: Approved Blueprint
- **Date**: August 26, 2026

---

## 1. 🎯 Executive Summary

Educational institutions currently lose an estimated 7 to 12 minutes per lecture on manual paper-based attendance callouts. Manual systems suffer from human errors, proxy attendance ("buddy punching"), physical record loss, and lack of real-time administrative visibility.

The **Smart Classroom Face Attendance System** is an enterprise-ready biometric web platform designed to automate classroom attendance using non-intrusive face recognition. The platform delivers instant presence logging, high-visibility visual confirmations, role-based dashboards for Administrators, Teachers, and Students, and automated reporting.

The system is structured into two strategic releases:
- **V1 (Base MERN MVP)**: A clean, reliable single-class MERN stack application featuring Vite React + TailwindCSS UI, REST APIs, and a Python Flask ML microservice (OpenCV YuNet + SFace).
- **V2 (Enterprise Scale)**: An advanced multi-classroom engine featuring dedicated multi-threaded ML worker pipelines, section-isolated `.pkl` vector indexing, LRU vector caching, and real-time WebSocket state synchronization.

---

## 2. 🚀 Business Objectives & Vision

### 2.1 Strategic Goals
- **Eliminate Attendance Overhead**: Reduce attendance logging time per 60-minute class session from ~10 minutes down to **< 30 seconds**.
- **100% Proxy Prevention**: Leverage biometric 128-dimensional facial embedding vectors mapped strictly to enrolled student profiles.
- **Instant Auditability**: Provide real-time presence progress bars for students and automated CSV/Excel reports for department heads and system administrators.
- **Privacy & Compliance**: Store mathematical vector representations instead of raw face images, satisfying data privacy regulations.

### 2.2 Key Performance Indicators (KPIs)
| KPI Metric | Baseline (Manual System) | Target V1 (MERN Core) | Target V2 (Multi-PKL Engine) |
| :--- | :--- | :--- | :--- |
| **Attendance Logging Time** | 8 – 12 minutes | < 60 seconds per section | < 15 seconds (walk-through) |
| **Biometric Match Accuracy** | N/A (Manual Signatures) | $\ge 98.5\%$ | $\ge 99.4\%$ |
| **Frame Processing Latency** | N/A | $\le 45\text{ ms}$ | $\le 15\text{ ms}$ (Multi-threaded) |
| **Buddy Punching Rate** | 10 – 15% estimated | 0% | 0% |
| **Report Generation Time** | Days / End-of-month | Instant (1-click export) | Instant (Real-time analytics) |

---

## 3. 👥 Stakeholder Personas & User Roles

```
                      ┌─────────────────────────────────────────┐
                      │          SYSTEM STAKEHOLDERS            │
                      └────────────────────┬────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│   SYSTEM ADMIN   │             │ FACULTY / TEACHER│             │     STUDENT      │
├──────────────────┤             ├──────────────────┤             ├──────────────────┤
│ - Manage Users   │             │ - Manage Classes │             │ - View Attendance│
│ - Departments    │             │ - Start Sessions │             │ - Progress Bars  │
│ - Master Reports │             │ - Manual Override│             │ - Course Status  │
└──────────────────┘             └──────────────────┘             └──────────────────┘
```

### 3.1 System Administrator (`ADMIN`)
- **Profile**: IT Manager or Department Head managing the institution's digital infrastructure.
- **Core Needs**: Centralized user provisioning (Teachers/Students), department hierarchy management, institution-wide attendance auditing, system log monitoring.

### 3.2 Faculty / Instructor (`TEACHER`)
- **Profile**: Classroom professor or lab instructor conducting course lectures.
- **Core Needs**: Effortless session initiation, live camera stream feedback with high-visibility confirmation modals, manual attendance overrides for edge cases, single-click report exports.

### 3.3 Student (`STUDENT`)
- **Profile**: Enrolled college student attending multiple subject sections.
- **Core Needs**: Fast facial enrollment during onboarding, transparent visibility into subject-wise attendance percentages, instant eligibility alerts for university exam thresholds.

---

## 4. 🧭 Scope Matrix: V1 vs V2 Release Strategy

```
                          PROJECT ROADMAP EVOLUTION
                          
   V1: MERN Core MVP                        V2: Enterprise Multi-Threaded Engine
┌──────────────────────────────┐          ┌────────────────────────────────────────┐
│ • Vite + React 18 + Tailwind │          │ • Dedicated Worker Thread Pool         │
│ • Express REST APIs          │ ───────► │ • Multi-PKL Vector Databases           │
│ • Single Active Class DB     │          │ • WebSocket Real-Time Sync             │
│ • 7-Sec State Banner Modal   │          │ • Concurrent Classroom Streams         │
└──────────────────────────────┘          └────────────────────────────────────────┘
```

### 4.1 V1 Release Scope (Base MERN + Vite React + Tailwind)
- **Frontend**: Vite + React 18 single-page application built with TailwindCSS, Lucide React icons, dark/light theme options, responsive sidebar layouts, and accessible modals.
- **Backend**: Node.js/Express.js REST API providing role-based JWT authentication (`ADMIN`, `TEACHER`, `STUDENT`) and MongoDB database management.
- **Facial Recognition**: Single-active class vector loading via Python Flask microservice (OpenCV YuNet face detector + SFace 128-D embedding extractor).
- **Attendance Modal & UX**: Smooth camera modal with a 7-second visual confirmation hold banner ("`PRESENT: Student Name (Roll No)`") preventing duplicate frame logs.
- **Reporting**: Basic CSV/Excel download for teachers per class session.

### 4.2 V2 Release Scope (Enterprise Multi-PKL & Multi-Threaded Engine)
- **Dedicated Multi-Threading**: Producer-consumer queue model for webcam stream ingestion using Python `ThreadPoolExecutor` or `asyncio`. Frame decoding, landmark detection, and embedding extraction run in dedicated worker threads without blocking main API execution.
- **Multi-PKL Section Indexing**: Independent, section-isolated binary vector files (`ml/class_dbs/<class_id>_db.pkl`). Supports multiple concurrent classes running attendance simultaneously across different classrooms without vector cross-contamination.
- **LRU Vector Caching**: Memory-mapped vector matrices pre-loaded in RAM with Least Recently Used (LRU) cache management for sub-15ms dot-product matching.
- **Real-Time WebSockets**: Socket.io / WebSocket integration pushing live attendance events to teacher dashboards and administrative wallboards.
- **Liveness Detection & Security**: Passive anti-spoofing landmarks (blink detection / depth verification) to prevent picture/video spoofing.

---

## 5. 🛡️ Business Risks & Mitigation Strategies

| Risk Description | Severity | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Low Light / Poor Camera Hardware** | Medium | Face detection drops | YuNet deep anchor detector operates effectively down to low lighting; UI warns teacher if contrast drops below threshold. |
| **Photo / Screen Spoofing (V1)** | Medium | Fraudulent attendance | V1 enforces live webcam capture inside classroom session; V2 introduces passive blink and 3D landmark liveness checks. |
| **Server Latency Under Heavy Frame Traffic** | High | UI freezing / delayed logs | V2 introduces dedicated multi-threading worker queues, separating frame ingestion from HTTP response loops. |
| **Biometric Privacy Concerns** | High | Legal / Compliance pushback | Raw images are discarded immediately after embedding generation; system strictly stores non-reconstructible 128-D floating-point vectors. |

---

## 6. 🏁 Acceptance Criteria & Success Metrics

1. **System Setup**: Admin can onboard departments, teachers, students, and courses in $< 5$ minutes.
2. **Facial Registration**: Student photo enrollment takes $< 3$ seconds to extract landmarks and save 128-D vectors into MongoDB and `.pkl` vector files.
3. **Classroom Session**: Teacher launches a live webcam session with 1 click; recognized students trigger a green visual banner hold for 7 seconds.
4. **Data Integrity**: Attendance logs in MongoDB contain accurate timestamps, class IDs, roll numbers, and confidence scores ($ \ge 0.36 $ cosine threshold).
5. **V2 Scalability**: Multi-threaded ML engine processes up to 60 FPS without dropping frames or blocking HTTP requests.
