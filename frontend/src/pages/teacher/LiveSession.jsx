import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Camera, ArrowLeft, MapPin, Power, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import ConfirmationBanner from '../../components/ConfirmationBanner';
import api from '../../api/axios';

export default function LiveSession() {
  const location = useLocation();
  const navigate = useNavigate();

  const [classId, setClassId] = useState(location.state?.classId || '');
  const [classList, setClassList] = useState([]);
  const [sessionState, setSessionState] = useState('SCANNING'); // 'SCANNING' | 'LOCKED_CONFIRMED'
  const [lockedStudent, setLockedStudent] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Select a course section to start live face attendance.');
  const [geoCoords, setGeoCoords] = useState(null);
  const [logs, setLogs] = useState([]);
  const [toast, setToast] = useState('');
  const [pklStatus, setPklStatus] = useState('');
  const [detectedBox, setDetectedBox] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isProcessingRef = useRef(false);
  const lastLoggedTimesRef = useRef({}); // RollNumber -> Timestamp map to prevent duplicate logs within 15s

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  // Fetch assigned classes & load section roster
  const [roster, setRoster] = useState([]);
  const [submittingSession, setSubmittingSession] = useState(false);

  const fetchClassRoster = useCallback((cid) => {
    if (!cid) return;
    api.get(`/classes/${cid}`)
      .then((res) => {
        const cls = res.data.class;
        if (cls && cls.students) {
          const initialRoster = cls.students.map((s) => ({
            studentId: s._id,
            rollNumber: s.rollNumber || s.email,
            name: s.name,
            department: s.department || cls.department || 'General',
            status: 'ABSENT',
            verifiedVia: 'UNCHECKED',
            confidence: 0.0,
          }));
          setRoster(initialRoster);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/classes/assigned')
      .then((res) => {
        const list = res.data.classes || [];
        setClassList(list);
        if (!classId && list.length > 0) {
          setClassId(list[0].classId);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (classId) {
      fetchClassRoster(classId);
    }
  }, [classId, fetchClassRoster]);

  const startCamera = async () => {
    if (!classId) {
      showToast('Please select a course section first!');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setStatusMsg('Live Face AI Recognition active. Scanning video stream...');
      setPklStatus('Ephemeral PKL Cache Active');
    } catch (err) {
      showToast('Camera access denied or unavailable: ' + err.message);
    }
  };

  const endSession = async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setStatusMsg('Select a course section to start live face attendance.');
    setPklStatus('');
    setDetectedBox(null);

    try {
      await api.delete('/ml/clear-pkls');
    } catch {}
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const toggleStudentStatus = (studentId, newStatus) => {
    setRoster((prev) =>
      prev.map((s) =>
        s.studentId === studentId
          ? { ...s, status: newStatus, verifiedVia: newStatus === 'PRESENT' ? 'MANUAL_OVERRIDE' : newStatus === 'ON_DUTY' ? 'ON_DUTY' : 'MANUAL_OVERRIDE' }
          : s
      )
    );
  };

  const handleBatchSessionSubmit = async () => {
    if (!classId || roster.length === 0) return;
    setSubmittingSession(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const payload = {
        classId,
        date: today,
        students: roster.map((s) => ({
          studentId: s.studentId,
          rollNumber: s.rollNumber,
          status: s.status,
          verifiedVia: s.verifiedVia === 'UNCHECKED' ? 'MANUAL_ENTRY' : s.verifiedVia,
          confidence: s.status === 'PRESENT' ? 1.0 : 0.0,
        })),
      };

      const res = await api.post('/attendance/batch-session-submit', payload);
      showToast(res.data.message || 'Attendance session submitted and locked successfully!');
      fetchClassRoster(classId);
    } catch (err) {
      showToast(err.response?.data?.message || 'Session submission failed', 'danger');
    } finally {
      setSubmittingSession(false);
    }
  };

  const sendFrameToML = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive || !classId) return;
    if (sessionState === 'LOCKED_CONFIRMED' || isProcessingRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const frameBase64 = canvas.toDataURL('image/jpeg', 0.7);
    isProcessingRef.current = true;

    try {
      const { data } = await api.post('/ml/process-frame', { classId, frame_base64: frameBase64 });

      if (data.detected) {
        setDetectedBox({
          bbox: data.bbox || [],
          name: data.matched ? data.name : 'Unrecognized Person',
          confidence: data.confidencePct ? `${data.confidencePct}%` : '',
          matched: data.matched,
        });
      } else {
        setDetectedBox(null);
      }

      if (data.matched && data.rollNumber) {
        const roll = data.rollNumber.toUpperCase();
        const now = Date.now();
        const lastLogged = lastLoggedTimesRef.current[roll] || 0;

        // Automatically check student PRESENT in active roster state
        setRoster((prev) =>
          prev.map((s) =>
            s.rollNumber.toUpperCase() === roll
              ? { ...s, status: 'PRESENT', verifiedVia: 'FACE_AI', confidence: data.confidence || 0.9 }
              : s
          )
        );

        // Anti-Duplicate 15-Second Hold Filter
        if (now - lastLogged > 15000) {
          lastLoggedTimesRef.current[roll] = now;
          setSessionState('LOCKED_CONFIRMED');

          const displayConfidence = data.confidencePct || (data.confidence ? data.confidence * 100 : 85);
          const matchInfo = {
            name: data.name,
            rollNumber: data.rollNumber,
            department: data.department || 'General',
            confidence: displayConfidence,
          };
          setLockedStudent(matchInfo);

          setLogs((prev) => [
            { time: new Date().toLocaleTimeString(), name: data.name, roll: data.rollNumber, confidence: `${Number(displayConfidence).toFixed(1)}%` },
            ...prev,
          ]);

          api.post('/attendance/log', {
            classId,
            studentId: data.studentId || data.rollNumber,
            rollNumber: data.rollNumber,
            confidence: data.confidence || (data.confidencePct ? data.confidencePct / 100 : 0.85),
          }).catch(() => {});
        }
      }
    } catch {
    } finally {
      isProcessingRef.current = false;
    }
  }, [cameraActive, classId, sessionState]);

  useEffect(() => {
    let interval;
    if (cameraActive && sessionState === 'SCANNING') {
      interval = setInterval(sendFrameToML, 400);
    }
    return () => clearInterval(interval);
  }, [cameraActive, sessionState, sendFrameToML]);

  const handleDismissBanner = () => {
    setSessionState('SCANNING');
    setLockedStudent(null);
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {toast && (
          <div style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 200,
            background: 'var(--color-surface)', border: '1px solid var(--color-accent-light)',
            borderRadius: '0.85rem', padding: '0.85rem 1.25rem', color: 'var(--color-text)',
            fontSize: '0.875rem', fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: 450
          }}>
            <CheckCircle2 size={18} color="var(--color-success)" style={{ flexShrink: 0 }} />
            <span>{toast}</span>
          </div>
        )}

        {sessionState === 'LOCKED_CONFIRMED' && lockedStudent && (
          <ConfirmationBanner student={lockedStudent} onDismiss={handleDismissBanner} />
        )}

        {/* Console Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <button className="btn-ghost" onClick={() => navigate('/teacher')} style={{ padding: '0.5rem 0.75rem' }}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  Live AI Camera & Hybrid Session Console
                </h1>
                <span className="badge badge-teacher" style={{ fontSize: '0.7rem' }}>
                  <ShieldCheck size={12} /> High-Precision (0.48 Cutoff)
                </span>
              </div>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginTop: '0.15rem' }}>Run Face AI once or stream camera feed, adjust student roster presences, and submit final session</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <select
              className="input-field"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              style={{ minWidth: 220 }}
              disabled={cameraActive}
            >
              {classList.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.className} ({c.classId})
                </option>
              ))}
            </select>
            {!cameraActive ? (
              <button className="btn-primary" onClick={startCamera}>
                <Camera size={18} /> Start Session
              </button>
            ) : (
              <button className="btn-danger" onClick={endSession}>
                <Power size={17} /> End Session & Delete PKL
              </button>
            )}
          </div>
        </div>

        {/* Status, PKL Ephemeral Bar & Geofence */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, padding: '0.85rem 1.35rem', borderRadius: '0.85rem',
            background: cameraActive ? 'var(--color-success-bg)' : 'var(--color-accent-glow)',
            border: `1px solid ${cameraActive ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'}`,
            fontSize: '0.875rem', color: cameraActive ? 'var(--color-success)' : 'var(--color-accent-light)',
            fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            {cameraActive && <div className="pulse-dot" />}
            {statusMsg}
          </div>

          {pklStatus && (
            <div style={{
              padding: '0.85rem 1.35rem', borderRadius: '0.85rem',
              background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)',
              fontSize: '0.825rem', color: '#c084fc', fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: '0.55rem'
            }}>
              {pklStatus}
            </div>
          )}

          {geoCoords && (
            <div style={{
              padding: '0.85rem 1.35rem', borderRadius: '0.85rem',
              background: 'var(--color-info-bg)', border: '1px solid rgba(6,182,212,0.3)',
              fontSize: '0.825rem', color: 'var(--color-info)', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: '0.55rem',
            }}>
              <MapPin size={16} />
              Geofence Active: {geoCoords.lat}° N, {geoCoords.lng}° E (±{geoCoords.accuracy}m)
            </div>
          )}
        </div>

        {/* Main Camera & Real-time Logs Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="glass" style={{
            padding: '1rem', position: 'relative', minHeight: 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '1.25rem', overflow: 'hidden'
          }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.85rem', display: cameraActive ? 'block' : 'none' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {!cameraActive && (
              <div style={{ textAlign: 'center', color: 'var(--color-muted)' }}>
                <Camera size={54} color="var(--color-accent-light)" style={{ opacity: 0.4, marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.1rem', color: 'var(--color-text)', fontWeight: 800 }}>Webcam Console Standby</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '0.35rem', maxWidth: 380 }}>
                  Select a course section above and click "Start Session" to open live biometric recognition with ephemeral PKL generation.
                </p>
              </div>
            )}

            {cameraActive && sessionState === 'SCANNING' && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                <div style={{
                  position: 'absolute', top: '1.25rem', left: '1.25rem',
                  background: 'rgba(0,0,0,0.75)', padding: '0.4rem 0.85rem',
                  borderRadius: '999px', fontSize: '0.75rem', color: 'var(--color-success)',
                  fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem',
                  backdropFilter: 'blur(10px)', border: '1px solid rgba(16,185,129,0.3)',
                }}>
                  <div className="pulse-dot" />
                  HIGH-ACCURACY RECOGNITION (0.48 THRESHOLD)
                </div>

                {detectedBox && (
                  <div
                    style={{
                      position: 'absolute', left: '50%', top: '50%',
                      transform: 'translate(-50%, -50%)', width: '55%', height: '65%',
                      border: `2px dashed ${detectedBox.matched ? 'var(--color-success)' : 'var(--color-danger)'}`,
                      borderRadius: '1.25rem',
                      boxShadow: `0 0 30px ${detectedBox.matched ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'}`,
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                      paddingTop: '0.65rem', transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        background: detectedBox.matched ? 'var(--color-success)' : 'var(--color-danger)',
                        color: '#ffffff', fontWeight: 800, fontSize: '0.85rem',
                        padding: '0.35rem 0.95rem', borderRadius: '999px',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '0.4rem'
                      }}
                    >
                      {detectedBox.matched ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      {detectedBox.name} {detectedBox.confidence && `(${detectedBox.confidence})`}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live Activity Feed Sidebar */}
          <div className="glass" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>AI Frame Detection Log</h3>
              <span className="badge badge-present">{logs.length} Logged</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 340, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {logs.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', textAlign: 'center', padding: '2.5rem 0' }}>
                  No student logged yet in this live session.
                </div>
              ) : logs.map((log, idx) => (
                <div key={idx} style={{
                  padding: '0.75rem 0.9rem', background: 'var(--color-surface2)',
                  border: '1px solid var(--color-border)', borderRadius: '0.75rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{log.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.1rem' }}>{log.roll} · {log.time}</div>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-success)' }}>{log.confidence}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* HYBRID SESSION ROSTER & MANUAL TOGGLE CONTROL */}
        <div className="glass glow-card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                Course Roster Verification ({roster.length} Enrolled Students)
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
                Face AI automatically checks off recognized students. Click single toggle buttons to override any student's status before submitting!
              </p>
            </div>

            <button
              className="btn-primary"
              onClick={handleBatchSessionSubmit}
              disabled={submittingSession || roster.length === 0}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', fontSize: '0.95rem', padding: '0.65rem 1.35rem' }}
            >
              <ShieldCheck size={18} /> {submittingSession ? 'Locking Session...' : 'Submit & Lock Final Attendance Session'}
            </button>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll Number</th>
                  <th>Student Name</th>
                  <th>Department</th>
                  <th>Verification Mode</th>
                  <th style={{ textAlign: 'center' }}>Presence Status Toggle</th>
                </tr>
              </thead>
              <tbody>
                {roster.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>No students enrolled in this course section roster.</td></tr>
                ) : (
                  roster.map((s) => (
                    <tr key={s.studentId}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--color-accent-light)' }}>{s.rollNumber}</td>
                      <td style={{ fontWeight: 800, color: 'var(--color-text)' }}>{s.name}</td>
                      <td style={{ fontSize: '0.825rem', color: 'var(--color-muted)' }}>{s.department}</td>
                      <td style={{ fontSize: '0.825rem', fontWeight: 700, color: s.verifiedVia === 'FACE_AI' ? 'var(--color-success)' : 'var(--color-muted)' }}>
                        {s.verifiedVia === 'FACE_AI' ? '🤖 Face AI Recognized' : s.verifiedVia === 'ON_DUTY' ? '🏆 On Duty Approved' : '✏️ Manual Entry'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', background: 'var(--color-surface2)', padding: '0.25rem', borderRadius: '0.65rem', border: '1px solid var(--color-border)' }}>
                          <button
                            type="button"
                            onClick={() => toggleStudentStatus(s.studentId, 'PRESENT')}
                            style={{
                              padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 800, borderRadius: '0.45rem', border: 'none',
                              background: s.status === 'PRESENT' ? '#10b981' : 'transparent',
                              color: s.status === 'PRESENT' ? '#ffffff' : 'var(--color-muted)', cursor: 'pointer'
                            }}
                          >
                            P (Present)
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStudentStatus(s.studentId, 'ABSENT')}
                            style={{
                              padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 800, borderRadius: '0.45rem', border: 'none',
                              background: s.status === 'ABSENT' ? '#f43f5e' : 'transparent',
                              color: s.status === 'ABSENT' ? '#ffffff' : 'var(--color-muted)', cursor: 'pointer'
                            }}
                          >
                            A (Absent)
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStudentStatus(s.studentId, 'ON_DUTY')}
                            style={{
                              padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 800, borderRadius: '0.45rem', border: 'none',
                              background: s.status === 'ON_DUTY' ? '#f59e0b' : 'transparent',
                              color: s.status === 'ON_DUTY' ? '#ffffff' : 'var(--color-muted)', cursor: 'pointer'
                            }}
                          >
                            OD (On Duty)
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
