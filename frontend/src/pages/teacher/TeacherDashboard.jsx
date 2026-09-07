import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Users, ClipboardList, Plus, Camera, Sparkles, CheckCircle2,
  Award, Check, X, Download, Calendar, Clock, MapPin, Search, History
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import Modal from '../../components/Modal';
import SchedulePicker from '../../components/SchedulePicker';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [upcomingList, setUpcomingList] = useState([]);
  const [ods, setOds] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ classId: '', className: '', subject: '', department: '', schedule: '', room: '' });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };

  const fetchAssigned = () => {
    setLoading(true);
    Promise.all([
      api.get('/classes/assigned').catch(() => ({ data: { classes: [] } })),
      api.get('/classes/upcoming').catch(() => ({ data: { upcoming: [] } })),
      api.get('/od/teacher').catch(() => ({ data: { ods: [] } })),
      api.get('/attendance?limit=100').catch(() => ({ data: { records: [] } })),
    ])
      .then(([classRes, upcomingRes, odRes, histRes]) => {
        setClasses(classRes.data.classes || []);
        setUpcomingList(upcomingRes.data.upcoming || []);
        setOds(odRes.data.ods || []);
        setHistory(histRes.data.records || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAssigned(); }, []);

  const handleReviewOD = async (odId, status) => {
    try {
      const res = await api.patch(`/od/${odId}/status`, { status, facultyNotes: `Reviewed by course instructor` });
      showToast(res.data.message || `OD application ${status.toLowerCase()}!`);
      fetchAssigned();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update OD status');
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!form.schedule || !form.schedule.trim()) {
      showToast('Class schedule date, days, and time are required to create a class!');
      return;
    }
    setCreating(true);
    try {
      await api.post('/classes', form);
      showToast(`Course Section "${form.className}" created successfully!`);
      setShowCreateModal(false);
      setForm({ classId: '', className: '', subject: '', department: '', schedule: '', room: '' });
      fetchAssigned();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create class section');
    } finally { setCreating(false); }
  };

  const exportReportCSV = (cls) => {
    const headers = "Student Name,Roll Number,Department,Status\n";
    const sampleRows = (cls.students || []).map(s => `"${s.name || 'Student'}","${s.rollNumber || 'N/A'}","${s.department || 'General'}",Enrolled`).join("\n");
    const blob = new Blob([headers + sampleRows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cls.classId}_Roster_Report.csv`;
    a.click();
    showToast(`Exported CSV roster report for ${cls.classId}`);
  };

  const pendingODs = ods.filter(o => o.status === 'PENDING');

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {toast && (
          <div style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 200,
            background: 'var(--color-surface)', border: '1px solid var(--color-accent-light)',
            borderRadius: '0.85rem', padding: '0.85rem 1.25rem', color: 'var(--color-text)',
            fontSize: '0.875rem', fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: 420
          }}>
            <CheckCircle2 size={18} color="var(--color-success)" style={{ flexShrink: 0 }} />
            <span>{toast}</span>
          </div>
        )}

        <Header
          title="Faculty Classroom & Attendance Command Center"
          subtitle={`Welcome, ${user?.name || 'Faculty'} • Department: ${user?.department || 'Academic'} • ${user?.email || ''}`}
        />

        {/* Section 1: Upcoming Teaching Schedule */}
        <div className="glass glow-card" style={{ padding: '1.75rem', marginBottom: '2.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                <Calendar size={22} color="var(--color-accent-light)" />
                Upcoming Teaching Schedule & Live AI Launcher
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
                Launch live camera biometric attendance for your active course sections
              </p>
            </div>

            <button className="btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> Provision Course Section
            </button>
          </div>

          {loading ? (
            <div style={{ color: 'var(--color-muted)', padding: '2rem', textAlign: 'center' }}>Loading teaching schedule…</div>
          ) : classes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>
              No course sections provisioned yet. Create your first course section below!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
              {classes.map((cls, idx) => {
                const isLive = idx === 0 || cls.classId.charCodeAt(0) % 2 === 0;
                return (
                  <div key={cls._id || cls.classId} style={{
                    padding: '1.35rem', borderRadius: '1.1rem',
                    background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span className="badge badge-teacher" style={{ fontFamily: 'monospace' }}>{cls.classId}</span>
                        {isLive ? (
                          <span className="badge badge-present" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.6rem' }}>
                            <div className="pulse-dot" style={{ width: 7, height: 7 }} /> LIVE SESSION
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                            <Clock size={11} /> UPCOMING
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.35rem', fontFamily: 'Outfit, sans-serif' }}>
                        {cls.className}
                      </h3>
                      <div style={{ fontSize: '0.825rem', color: 'var(--color-muted)', marginBottom: '0.85rem' }}>
                        {cls.department || 'Department'} · Room <b>{cls.room || 'Lab 301'}</b>
                      </div>

                      <div style={{ fontSize: '0.825rem', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Calendar size={14} color="var(--color-accent-light)" />
                          <span><b>Schedule:</b> {cls.schedule || 'Schedule TBD'}</span>
                        </div>
                        {cls.createdAt && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', opacity: 0.85 }}>
                            Added {new Date(cls.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1.2rem', paddingTop: '0.9rem', borderTop: '1px solid var(--color-border)' }}>
                      <button
                        className="btn-primary btn-sm"
                        style={{ flex: 1, justifyContent: 'center', padding: '0.55rem' }}
                        onClick={() => navigate('/teacher/live', { state: { classId: cls.classId, className: cls.className } })}
                      >
                        <Camera size={15} /> Launch AI Camera
                      </button>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => navigate('/teacher/attendance', { state: { classId: cls.classId } })}
                      >
                        <ClipboardList size={15} /> Roster
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Pending OD Applications Queue */}
        {pendingODs.length > 0 && (
          <div className="glass glow-card" style={{ padding: '1.5rem', marginBottom: '2.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                <Award size={20} color="var(--color-warning)" />
                Pending Student On Duty (OD) Applications ({pendingODs.length})
              </div>
              <span className="badge badge-warning">Requires Instructor Action</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '1rem' }}>
              {pendingODs.map(o => (
                <div key={o._id} style={{
                  padding: '1.1rem 1.25rem', borderRadius: '1rem',
                  background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                        {o.student?.name || 'Student'}
                      </span>
                      <span className="badge badge-teacher" style={{ fontFamily: 'monospace' }}>
                        {o.student?.rollNumber || 'N/A'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-accent-light)', fontWeight: 800, marginBottom: '0.25rem' }}>
                      🏆 {o.eventName}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
                      Host: <b>{o.organizingBody}</b> • {new Date(o.startDate).toLocaleDateString()} to {new Date(o.endDate).toLocaleDateString()}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                      "{o.reason}"
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => handleReviewOD(o._id, 'APPROVED')}
                      className="btn-primary btn-sm"
                      style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #059669)', justifyContent: 'center' }}
                    >
                      <Check size={14} /> Approve & Credit OD
                    </button>
                    <button
                      onClick={() => handleReviewOD(o._id, 'REJECTED')}
                      className="btn-danger btn-sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Course Sections Roster & Export Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
              My Course Roster & Classroom Sections ({classes.length})
            </h2>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginTop: '0.15rem' }}>View student enrollment lists and export CSV presence logs</p>
          </div>

          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} /> Provision Course Section
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.35rem', marginBottom: '2.25rem' }}>
          {classes.map((cls) => (
            <div key={cls._id} className="glass glass-hover" style={{ padding: '1.6rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <span className="badge badge-teacher" style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{cls.classId}</span>
                  <button
                    onClick={() => exportReportCSV(cls)}
                    title="Export CSV Roster Report"
                    style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700 }}
                  >
                    <Download size={14} color="var(--color-accent-light)" /> Export Roster
                  </button>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.4rem', fontFamily: 'Outfit, sans-serif' }}>
                  {cls.className}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '1.2rem', fontWeight: 500 }}>
                  {cls.department || 'General'} {cls.room ? `· Room ${cls.room}` : ''} · {cls.students ? `${cls.students.length} Enrolled Students` : 'Roster Active'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', paddingTop: '1.1rem', borderTop: '1px solid var(--color-border)' }}>
                <button
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => navigate('/teacher/live', { state: { classId: cls.classId, className: cls.className } })}
                >
                  <Camera size={17} /> Live AI Session
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => navigate('/teacher/attendance', { state: { classId: cls.classId } })}
                >
                  <ClipboardList size={17} /> Roster
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Section 4: Class Attendance History Logs */}
        <div className="glass" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                Recent Classroom Attendance Sessions
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
                Latest attendance logs captured via AI Camera or manual faculty override
              </p>
            </div>
            <button className="btn-secondary btn-sm" onClick={() => navigate('/teacher/reports')}>
              View Full Reports & Analytics
            </button>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Student Name</th>
                  <th>Roll Number</th>
                  <th>Course Section</th>
                  <th>Status</th>
                  <th>Verification Mode</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>No recent attendance sessions logged yet.</td></tr>
                ) : (
                  history.slice(0, 8).map((r) => (
                    <tr key={r._id}>
                      <td style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{r.date}</td>
                      <td style={{ fontWeight: 800 }}>{r.student?.name || r.rollNumber}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.825rem' }}>{r.student?.rollNumber || r.rollNumber}</td>
                      <td><span className="badge badge-teacher">{r.classId}</span></td>
                      <td>
                        <span className={`badge ${r.status === 'PRESENT' ? 'badge-present' : 'badge-absent'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.825rem', color: 'var(--color-accent-light)', fontWeight: 700 }}>
                        {r.verifiedVia || 'FACE_AI'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal to Create Class Section */}
        {showCreateModal && (
          <Modal title="Provision Course Section" onClose={() => setShowCreateModal(false)}>
            <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>Class ID Code</label>
                  <input className="input-field" placeholder="e.g. CS101_SECA" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>Department</label>
                  <input className="input-field" placeholder="Computer Science" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>Course / Section Name</label>
                <input className="input-field" placeholder="e.g. Data Structures & Algorithms Sec A" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>Room / Lab</label>
                <input className="input-field" placeholder="Lab 302" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                  Class Schedule & Calendar Date * <span style={{ color: 'var(--color-danger, #f43f5e)', fontSize: '0.75rem' }}>(Required)</span>
                </label>
                <SchedulePicker value={form.schedule} onChange={(val) => setForm((prev) => ({ ...prev, schedule: val }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={creating}>{creating ? 'Creating...' : 'Provision Section'}</button>
              </div>
            </form>
          </Modal>
        )}
      </main>
    </div>
  );
}
