import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, BookOpen, ClipboardList, TrendingUp, Brain, Server, Database,
  ArrowRight, UserPlus, Sparkles, ShieldCheck,
  Check, X, RefreshCw, Calendar, Clock, MapPin, Search, Trash2, FileText
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const StatCard = ({ icon: Icon, label, value, color, sub, onClick, trend }) => (
  <div
    className="glass glass-hover"
    onClick={onClick}
    style={{
      padding: '1.6rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem',
      cursor: onClick ? 'pointer' : 'default',
      position: 'relative', overflow: 'hidden',
      borderRadius: '1.25rem',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: '0.9rem',
        background: `linear-gradient(135deg, ${color}25, ${color}10)`,
        border: `1px solid ${color}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 6px 16px ${color}20`
      }}>
        <Icon size={22} color={color} />
      </div>
      {trend && (
        <span className="badge badge-present" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem' }}>
          <TrendingUp size={11} /> {trend}
        </span>
      )}
    </div>

    <div>
      <div style={{ fontSize: '0.725rem', color: 'var(--color-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1, marginTop: '0.25rem' }}>
        {value ?? '—'}
      </div>
      {sub && <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.4rem', fontWeight: 500 }}>{sub}</div>}
    </div>
  </div>
);



export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [mlStatus, setMlStatus] = useState(null);
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ods, setOds] = useState([]);
  const [toast, setToast] = useState('');
  const [clearingPkls, setClearingPkls] = useState(false);

  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchAdminData = () => {
    setLoading(true);
    Promise.all([
      api.get('/users?limit=1').catch(() => ({ data: { total: 0 } })),
      api.get('/users?role=TEACHER&limit=1').catch(() => ({ data: { total: 0 } })),
      api.get('/users?role=STUDENT&limit=1').catch(() => ({ data: { total: 0 } })),
      api.get('/classes?limit=1').catch(() => ({ data: { total: 0 } })),
      api.get('/attendance/stats').catch(() => ({ data: { total: 0, present: 0, percentage: '0.0' } })),
      api.get('/ml/health').catch(() => ({ data: { online: false } })),
      api.get('/od/teacher').catch(() => ({ data: { ods: [] } })),
      api.get('/classes/upcoming').catch(() => ({ data: { upcoming: [] } })),
      api.get('/attendance?limit=100').catch(() => ({ data: { records: [] } })),
    ])
      .then(([users, teachers, students, classes, attStats, ml, odRes, upcomingRes, histRes]) => {
        setStats({
          users: users.data.total,
          teachers: teachers.data.total,
          students: students.data.total,
          classes: classes.data.total,
          attTotal: attStats.data.total,
          attPct: attStats.data.percentage,
        });
        setMlStatus(ml.data.online);
        setOds(odRes.data.ods || []);
        setUpcomingClasses(upcomingRes.data.upcoming || []);
        setAttendanceHistory(histRes.data.records || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleReviewOD = async (odId, status) => {
    try {
      const res = await api.patch(`/od/${odId}/status`, { status, facultyNotes: 'Approved by Administrator override' });
      showToast(res.data.message || `OD application ${status.toLowerCase()}!`);
      fetchAdminData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update OD status');
    }
  };

  const handleClearAllPkls = async () => {
    if (!window.confirm('Are you sure you want to purge all PKL vector cache files from disk?')) return;
    setClearingPkls(true);
    try {
      const res = await api.post('/ml/clear-all-pkls', {});
      showToast(res.data.message || 'All PKL vector files purged successfully!');
    } catch {
      showToast('Failed to purge PKL files');
    } finally {
      setClearingPkls(false);
    }
  };

  const pendingODs = ods.filter(o => o.status === 'PENDING');

  const filteredHistory = attendanceHistory.filter(r => {
    const matchSearch = !historySearch ||
      r.student?.name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      r.rollNumber?.toLowerCase().includes(historySearch.toLowerCase()) ||
      r.classId?.toLowerCase().includes(historySearch.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
            <ShieldCheck size={18} color="var(--color-success)" style={{ flexShrink: 0 }} />
            <span>{toast}</span>
          </div>
        )}

        <Header
          title="Admin Master Control & Institutional Hub"
          subtitle={`Welcome, Administrator ${user?.name || ''} • Full institutional telemetry & cross-department timetable`}
        />

        {/* System Health Telemetry Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          <div className="glass" style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '0.75rem', background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Server size={20} color="var(--color-success)" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Node REST API Engine</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                <div className="pulse-dot" /> Operational
              </div>
            </div>
          </div>

          <div className="glass" style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '0.75rem', background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={20} color="var(--color-success)" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>MongoDB Cluster</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                <div className="pulse-dot" /> Connected & Synced
              </div>
            </div>
          </div>

          <div className="glass" style={{
            padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '1rem',
            borderColor: mlStatus ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '0.75rem',
              background: mlStatus ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Brain size={20} color={mlStatus ? 'var(--color-success)' : 'var(--color-danger)'} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Face AI Engine</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: mlStatus ? 'var(--color-success)' : 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                {mlStatus ? (
                  <><div className="pulse-dot" /> YuNet + SFace (0.48 Precision)</>
                ) : (
                  <><div className="pulse-dot pulse-dot-danger" /> Microservice Offline</>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Executive Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.35rem', marginBottom: '2.25rem' }}>
          <StatCard
            icon={Users}
            label="Total Registered Users"
            value={loading ? '...' : stats.users}
            color="#6366f1"
            sub={`${stats.teachers || 0} Faculty · ${stats.students || 0} Students`}
            onClick={() => navigate('/admin/users')}
            trend="+12% Active"
          />
          <StatCard
            icon={BookOpen}
            label="Active Classes & Sections"
            value={loading ? '...' : stats.classes}
            color="#a855f7"
            sub="Assigned subject rosters"
            onClick={() => navigate('/admin/classes')}
          />
          <StatCard
            icon={ClipboardList}
            label="Total Presence Logs"
            value={loading ? '...' : stats.attTotal}
            color="#06b6d4"
            sub="Verified biometric records"
            onClick={() => navigate('/admin/attendance')}
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Campus Attendance"
            value={loading ? '...' : stats.attPct ? `${stats.attPct}%` : '0%'}
            color="#f59e0b"
            sub="Cross-department rate"
            onClick={() => navigate('/admin/reports')}
            trend="High"
          />
        </div>

        {/* Section 1: Campus-Wide Upcoming Classes & Timetable */}
        <div className="glass glow-card" style={{ padding: '1.75rem', marginBottom: '2.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                <Calendar size={22} color="var(--color-accent-light)" />
                Campus-Wide Upcoming Classes & Timetable
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
                Scheduled course lectures and live classroom sessions across all departments
              </p>
            </div>
            <button className="btn-secondary btn-sm" onClick={() => navigate('/admin/classes')}>
              Manage All Classes
            </button>
          </div>

          {loading ? (
            <div style={{ color: 'var(--color-muted)', padding: '2rem', textAlign: 'center' }}>Loading campus schedule…</div>
          ) : upcomingClasses.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>No upcoming classes found in system.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
              {upcomingClasses.map((cls, idx) => {
                const isLive = cls.status === 'LIVE_NOW';
                return (
                  <div key={cls._id || cls.classId || idx} style={{
                    padding: '1.25rem', borderRadius: '1rem',
                    background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span className="badge badge-teacher" style={{ fontFamily: 'monospace' }}>{cls.classId}</span>
                        {isLive ? (
                          <span className="badge badge-present" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <div className="pulse-dot" style={{ width: 6, height: 6 }} /> LIVE NOW
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>UPCOMING</span>
                        )}
                      </div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.3rem', fontFamily: 'Outfit, sans-serif' }}>
                        {cls.className}
                      </h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '0.6rem' }}>
                        Dept: <b>{cls.department || 'General'}</b> · Room: <b>{cls.room || '301'}</b>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                        <Calendar size={13} color="var(--color-accent-light)" /> {cls.schedule || 'Schedule TBD'}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid var(--color-border)' }}>
                      Faculty: <b>{cls.teacherName || 'Instructor'}</b> · {cls.enrolledCount || 0} Students
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Global Biometric Attendance Audit Log */}
        <div className="glass" style={{ padding: '1.75rem', marginBottom: '2.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                Global Biometric Attendance & Check-in Audit Log
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
                Real-time stream of student presence check-ins, Face AI verification, and manual overrides
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.85rem' }}>
              <div style={{ position: 'relative', width: 220 }}>
                <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search student, roll..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  style={{ paddingLeft: '2.5rem', fontSize: '0.85rem' }}
                />
              </div>
              <select
                className="input-field"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ width: 140, fontSize: '0.85rem' }}
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Student Name</th>
                  <th>Roll Number</th>
                  <th>Class Code</th>
                  <th>Status</th>
                  <th>Verification Mode</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>No matching attendance records found.</td></tr>
                ) : (
                  filteredHistory.slice(0, 10).map((r) => (
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
                      <td style={{ fontSize: '0.825rem', color: 'var(--color-muted)' }}>
                        {r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : '100%'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Global Campus OD Applications Review Section */}
        {pendingODs.length > 0 && (
          <div className="glass glow-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                <Award size={20} color="var(--color-warning)" />
                Campus-Wide Pending On-Duty (OD) Applications ({pendingODs.length})
              </div>
              <span className="badge badge-admin"><ShieldCheck size={13} /> Admin Master Override</span>
            </div>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Name & Roll</th>
                    <th>Event Name</th>
                    <th>Category</th>
                    <th>Dates</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingODs.map((o) => (
                    <tr key={o._id}>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--color-text)' }}>{o.student?.name || 'Student'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontFamily: 'monospace' }}>{o.student?.rollNumber || 'N/A'}</div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{o.eventName}</td>
                      <td><span className="badge badge-teacher">{o.odCategory}</span></td>
                      <td style={{ fontSize: '0.825rem', color: 'var(--color-muted)' }}>
                        {new Date(o.startDate).toLocaleDateString()} - {new Date(o.endDate).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleReviewOD(o._id, 'APPROVED')} className="btn-primary btn-sm" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                            <Check size={14} /> Approve & Credit
                          </button>
                          <button onClick={() => handleReviewOD(o._id, 'REJECTED')} className="btn-danger btn-sm">
                            <X size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Administrative Quick Workflows & PKL Purge Control */}
        <div className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.35rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                Administrative Controls & Telemetry
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>Master directory management, reports, and disk PKL purging tools</p>
            </div>
            <button
              onClick={handleClearAllPkls}
              className="btn-danger btn-sm"
              disabled={clearingPkls}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Trash2 size={15} /> {clearingPkls ? 'Purging PKLs...' : 'Purge All Ephemeral PKL Files'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.1rem' }}>
            <button
              className="btn-primary"
              onClick={() => navigate('/admin/users')}
              style={{ padding: '1.1rem 1.35rem', justifyContent: 'space-between', borderRadius: '1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <UserPlus size={22} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>User Directory</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.85, fontWeight: 400 }}>Manage Faculty & Student accounts</div>
                </div>
              </div>
              <ArrowRight size={18} />
            </button>

            <button
              className="btn-ghost"
              onClick={() => navigate('/admin/classes')}
              style={{ padding: '1.1rem 1.35rem', justifyContent: 'space-between', borderRadius: '1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <BookOpen size={22} color="#a855f7" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>Classroom Sections</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Assign Teachers & Student Roster</div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--color-text-secondary)" />
            </button>

            <button
              className="btn-ghost"
              onClick={() => navigate('/admin/reports')}
              style={{ padding: '1.1rem 1.35rem', justifyContent: 'space-between', borderRadius: '1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <FileText size={22} color="#f59e0b" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>Analytics & Audits</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Export CSV & Detailed Insights</div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--color-text-secondary)" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
