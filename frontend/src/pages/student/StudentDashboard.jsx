import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle, AlertTriangle, Search, Calculator,
  Calendar, Plus, Clock, Sparkles, X, Award,
  MapPin, RefreshCw
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import ERPCourseBreakdown from '../../components/ERPCourseBreakdown';
import api from '../../api/axios';

const OD_CATEGORIES = [
  { value: 'TECHNICAL_SYMPOSIUM', label: 'Technical Symposium / Hackathon / Paper Pres.', icon: '💻' },
  { value: 'SPORTS_MEET', label: 'Inter-College Sports / Athletic Meet', icon: '🏆' },
  { value: 'PLACEMENT_DRIVE', label: 'Campus Placement / Interview Drive', icon: '💼' },
  { value: 'CULTURALS', label: 'Cultural Fest / Arts Competition', icon: '🎭' },
  { value: 'MEDICAL_OD', label: 'Medical OD / Hospitalization', icon: '🏥' },
];

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, percentage: 0, eligible: true });
  const [history, setHistory] = useState([]);
  const [classList, setClassList] = useState([]);
  const [upcomingList, setUpcomingList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Tabs
  const [scheduleTab, setScheduleTab] = useState('TODAY'); // 'TODAY' | 'ALL'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // 75% Calculator state
  const [targetPercentage, setTargetPercentage] = useState(75);
  const [upcomingClasses, setUpcomingClasses] = useState(20);

  // OD Applications state
  const [ods, setOds] = useState([]);
  const [showODModal, setShowODModal] = useState(false);
  const [odForm, setOdForm] = useState({
    classId: '',
    odCategory: 'TECHNICAL_SYMPOSIUM',
    eventName: '',
    organizingBody: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
  });
  const [submittingOD, setSubmittingOD] = useState(false);
  const [odMessage, setOdMessage] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = () => {
    setLoading(true);
    Promise.all([
      api.get('/attendance/stats').catch(() => ({ data: { total: 0, present: 0, absent: 0, percentage: 0, eligible: true } })),
      api.get('/attendance?limit=200').catch(() => ({ data: { records: [] } })),
      api.get('/classes/upcoming').catch(() => ({ data: { upcoming: [] } })),
      api.get('/classes').catch(() => ({ data: { classes: [] } })),
      api.get('/od/my').catch(() => ({ data: { ods: [] } })),
    ])
      .then(([statsRes, histRes, upcomingRes, classRes, odRes]) => {
        setStats(statsRes.data);
        const records = histRes.data.records || [];
        setHistory(records);
        setOds(odRes.data.ods || []);
        
        const upcoming = upcomingRes.data.upcoming || [];
        setUpcomingList(upcoming);

        const allClasses = classRes.data.classes || [];
        // Filter classes where student is enrolled or has attendance history
        const enrolled = allClasses.filter(c =>
          c.isEnrolled ||
          c.students?.some(s => s._id === user?._id || s === user?._id) ||
          records.some(r => r.classId === c.classId)
        );
        const activeClasses = enrolled.length > 0 ? enrolled : allClasses;
        setClassList(activeClasses);

        if (activeClasses.length > 0 && !odForm.classId) {
          setOdForm(prev => ({ ...prev, classId: activeClasses[0]._id || activeClasses[0].classId }));
        }
      })
      .finally(() => setLoading(false));
  };

  const handleODSubmit = async (e) => {
    e.preventDefault();
    setSubmittingOD(true);
    setOdMessage('');
    try {
      await api.post('/od', odForm);
      setOdMessage('On Duty (OD) application submitted successfully!');
      setTimeout(() => {
        setShowODModal(false);
        setOdMessage('');
        fetchDashboardData();
      }, 1200);
    } catch (err) {
      setOdMessage(err.response?.data?.message || 'Failed to submit OD application');
    } finally {
      setSubmittingOD(false);
    }
  };

  // 75% Calculator Logic
  const calcTargetResult = () => {
    const present = stats.present || 0;
    const total = stats.total || 0;
    const targetRatio = (targetPercentage || 75) / 100;

    if (total === 0) return { status: 'NO_DATA', text: 'No attendance records logged yet.' };

    const currentPerc = (present / total) * 100;

    if (currentPerc >= targetPercentage) {
      const maxSkips = Math.floor((present / targetRatio) - total);
      return {
        status: 'SAFE',
        value: Math.max(0, maxSkips),
        text: maxSkips > 0
          ? `You can miss up to ${maxSkips} upcoming lecture${maxSkips > 1 ? 's' : ''} and still satisfy your ${targetPercentage}% target!`
          : `You are exactly at your ${targetPercentage}% requirement! Attend your next class to stay safe.`
      };
    } else {
      const reqClasses = Math.ceil((targetRatio * total - present) / (1 - targetRatio));
      return {
        status: 'NEED_MORE',
        value: reqClasses,
        text: `You MUST attend the next ${reqClasses} consecutive lecture${reqClasses > 1 ? 's' : ''} (or get OD approved) to reach your ${targetPercentage}% eligibility target.`
      };
    }
  };

  const calcResult = calcTargetResult();

  // Subject-wise stats calculation
  const subjectStats = classList.map(cls => {
    const classRecords = history.filter(r => r.classId === cls.classId || r.classId === cls._id);
    const total = classRecords.length;
    const present = classRecords.filter(r => r.status === 'PRESENT').length;
    const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : (stats.percentage || 0);
    const eligible = parseFloat(percentage) >= 75;

    return {
      id: cls._id || cls.classId,
      classId: cls.classId,
      className: cls.className || cls.subjectName || 'Course',
      subject: cls.subject || cls.className,
      teacherName: cls.teacher?.name || 'Faculty Instructor',
      room: cls.room || 'Hall 301',
      schedule: cls.schedule || '10:00 AM - 11:30 AM',
      total,
      present,
      absent: total - present,
      percentage: parseFloat(percentage),
      eligible,
    };
  });

  // Filter history records
  const filteredHistory = history.filter(r => {
    const matchSearch = !search ||
      r.classId?.toLowerCase().includes(search.toLowerCase()) ||
      r.date?.includes(search) ||
      r.verifiedVia?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    const matchDate = !dateFilter || r.date === dateFilter;
    return matchSearch && matchStatus && matchDate;
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Header
          title="Student Dashboard & Attendance Portal"
          subtitle={`Welcome back, ${user?.name || 'Student'} • Roll No: ${user?.rollNumber || 'N/A'} • ${user?.department || 'General Department'}`}
        />

        {/* Top Personal Identity & Eligibility Banner */}
        <div style={{
          padding: '1.75rem 2rem',
          borderRadius: '1.25rem',
          marginBottom: '2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem',
          background: stats.eligible
            ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.05))'
            : 'linear-gradient(135deg, rgba(244,63,94,0.12), rgba(225,29,72,0.05))',
          border: `1px solid ${stats.eligible ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
          boxShadow: stats.eligible ? '0 10px 30px rgba(16,185,129,0.08)' : '0 10px 30px rgba(244,63,94,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.35rem' }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: stats.eligible ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
            }}>
              {stats.eligible ? <CheckCircle size={34} color="var(--color-success)" /> : <AlertTriangle size={34} color="var(--color-danger)" />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                  {user?.name || 'Student Portal'}
                </div>
                <span className={`badge ${stats.eligible ? 'badge-present' : 'badge-absent'}`} style={{ fontSize: '0.75rem' }}>
                  {stats.eligible ? 'Exam Eligible ✓' : 'Shortage Alert ⚠️'}
                </span>
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', marginTop: '0.25rem', fontWeight: 500 }}>
                {stats.eligible
                  ? 'Your overall attendance satisfies mandatory university eligibility criteria (≥75.0%).'
                  : 'Attendance is below 75%. Apply for On Duty (OD) or ensure 100% presence in upcoming classes.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowODModal(true)}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #a855f7, #6366f1)', padding: '0.65rem 1.25rem' }}
            >
              <Award size={18} /> Apply for On Duty (OD)
            </button>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '2.8rem', fontWeight: 900, fontFamily: 'Outfit, sans-serif',
                color: stats.eligible ? 'var(--color-success)' : 'var(--color-danger)', lineHeight: 1
              }}>
                {stats.percentage}%
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 700, marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cumulative Attendance ({stats.present}/{stats.total} Classes)
              </div>
            </div>
          </div>
        </div>

        {/* ERP University Course Breakdown & Telemetry */}
        <ERPCourseBreakdown />

        {/* Section 1: Upcoming Classes & Daily Timetable */}
        <div id="upcoming" className="glass glow-card" style={{ padding: '1.75rem', marginBottom: '2.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                <Calendar size={22} color="var(--color-accent-light)" />
                Upcoming Classes & Daily Timetable
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
                Personalized class schedule, live sessions, and classroom assignments
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--color-surface2)', padding: '0.3rem', borderRadius: '0.75rem', border: '1px solid var(--color-border)' }}>
              <button
                className={`btn-sm ${scheduleTab === 'TODAY' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setScheduleTab('TODAY')}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
              >
                Today's Schedule
              </button>
              <button
                className={`btn-sm ${scheduleTab === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setScheduleTab('ALL')}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
              >
                Enrolled Courses Timetable
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ color: 'var(--color-muted)', padding: '2rem', textAlign: 'center' }}>Loading upcoming class timetable…</div>
          ) : (upcomingList.length === 0 && classList.length === 0) ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.875rem' }}>
              No upcoming classes scheduled for your department.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
              {(scheduleTab === 'TODAY' ? upcomingList : classList).map((cls, idx) => {
                const isLive = cls.status === 'LIVE_NOW';
                return (
                  <div
                    key={cls._id || cls.classId || idx}
                    style={{
                      padding: '1.35rem',
                      borderRadius: '1.1rem',
                      background: isLive ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(99,102,241,0.05))' : 'var(--color-surface2)',
                      border: `1px solid ${isLive ? 'rgba(16,185,129,0.4)' : 'var(--color-border)'}`,
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      position: 'relative', overflow: 'hidden'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span className="badge badge-teacher" style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                          {cls.classId}
                        </span>
                        {isLive ? (
                          <span className="badge badge-present" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.6rem' }}>
                            <div className="pulse-dot" style={{ width: 7, height: 7 }} /> LIVE NOW
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={11} /> UPCOMING
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.35rem', fontFamily: 'Outfit, sans-serif' }}>
                        {cls.className || cls.subject}
                      </h3>
                      <div style={{ fontSize: '0.825rem', color: 'var(--color-muted)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>Instructor:</span> <strong style={{ color: 'var(--color-text)' }}>{cls.teacherName || cls.teacher?.name || 'Faculty'}</strong>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                          <Calendar size={14} color="var(--color-accent-light)" />
                          <span>{cls.schedule || cls.time || 'Schedule TBD'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-muted)', fontSize: '0.78rem' }}>
                          <MapPin size={14} color="var(--color-accent-light)" />
                          <span>Room / Lab: <b>{cls.room || 'Hall 301'}</b></span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '1.1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>
                        {cls.enrolledCount ? `${cls.enrolledCount} enrolled students` : 'Enrolled'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        Biometric AI Active <Sparkles size={11} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Course Attendance & Progress Breakdown */}
        <div className="glass" style={{ padding: '1.75rem', marginBottom: '2.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                Course Attendance Breakdown
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>Subject-wise presence stats, total lectures, and exam eligibility status</p>
            </div>
            <button onClick={fetchDashboardData} className="btn-ghost btn-sm" title="Refresh data">
              <RefreshCw size={15} /> Refresh
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {subjectStats.map((sub) => (
              <div key={sub.id} style={{
                padding: '1.25rem', borderRadius: '1rem',
                background: 'var(--color-surface2)', border: '1px solid var(--color-border)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span className="badge badge-teacher" style={{ fontFamily: 'monospace' }}>{sub.classId}</span>
                    <span className={`badge ${sub.eligible ? 'badge-present' : 'badge-absent'}`}>
                      {sub.percentage}%
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.35rem' }}>
                    {sub.className}
                  </h4>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
                    {sub.teacherName} · Room {sub.room}
                  </div>
                </div>

                <div>
                  {/* Progress Bar */}
                  <div style={{ height: 8, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden', marginBottom: '0.6rem' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, sub.percentage)}%`,
                      background: sub.eligible ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f43f5e, #e11d48)',
                      borderRadius: 99, transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 600 }}>
                    <span>Present: <b style={{ color: 'var(--color-success)' }}>{sub.present}</b></span>
                    <span>Absent: <b style={{ color: 'var(--color-danger)' }}>{sub.absent}</b></span>
                    <span>Total: {sub.total}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: 75% Calculator & OD Quick Applications */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2.25rem' }}>
          {/* Target Calculator Widget */}
          <div className="calc-card glow-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem' }}>
                  <Calculator size={20} color="var(--color-accent-light)" />
                  75% Attendance Requirement Simulator
                </div>
                <span className="badge badge-teacher">Target: {targetPercentage}%</span>
              </div>

              <p style={{ fontSize: '0.825rem', color: 'var(--color-muted)', marginBottom: '1.1rem' }}>
                Calculate how many upcoming lectures you can miss or MUST attend to maintain exam eligibility.
              </p>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', display: 'block', marginBottom: '0.35rem' }}>Target %</label>
                  <input
                    type="number"
                    className="input-field"
                    value={targetPercentage}
                    onChange={(e) => setTargetPercentage(Number(e.target.value))}
                    min={50}
                    max={100}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', display: 'block', marginBottom: '0.35rem' }}>Est. Remaining Classes</label>
                  <input
                    type="number"
                    className="input-field"
                    value={upcomingClasses}
                    onChange={(e) => setUpcomingClasses(Number(e.target.value))}
                    min={1}
                  />
                </div>
              </div>
            </div>

            <div style={{
              padding: '0.95rem 1.1rem',
              borderRadius: '0.85rem',
              background: calcResult.status === 'SAFE' ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
              border: `1px solid ${calcResult.status === 'SAFE' ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
              fontSize: '0.85rem', fontWeight: 600, color: calcResult.status === 'SAFE' ? 'var(--color-success)' : 'var(--color-danger)'
            }}>
              💡 {calcResult.text}
            </div>
          </div>

          {/* Quick OD Info Card */}
          <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem' }}>
                  <Award size={20} color="var(--color-warning)" />
                  On-Duty (OD) Credit Portal
                </div>
                <span className="badge badge-warning">OD Count: {ods.length}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
                Participating in hackathons, sports tournaments, placement drives, or medical leave? Apply for official On-Duty credit to protect your attendance percentage.
              </p>
            </div>

            <button
              onClick={() => setShowODModal(true)}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #a855f7, #6366f1)', padding: '0.75rem' }}
            >
              <Plus size={16} /> Submit New OD Application
            </button>
          </div>
        </div>

        {/* Section 4: Submitted OD Applications Table */}
        {ods.length > 0 && (
          <div className="glass glow-card" style={{ padding: '1.5rem', marginBottom: '2.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                <Award size={20} color="var(--color-accent-light)" /> My On-Duty (OD) Applications ({ods.length})
              </div>
              <button className="btn-secondary btn-sm" onClick={() => setShowODModal(true)}>
                <Plus size={14} /> New OD Application
              </button>
            </div>

            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event / Activity</th>
                    <th>OD Category</th>
                    <th>Host / Organizing Body</th>
                    <th>Dates</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ods.map((o) => (
                    <tr key={o._id}>
                      <td style={{ fontWeight: 700 }}>{o.eventName}</td>
                      <td><span className="badge badge-teacher">{o.odCategory ? o.odCategory.replace('_', ' ') : 'OD'}</span></td>
                      <td style={{ fontSize: '0.825rem', color: 'var(--color-text-secondary)' }}>{o.organizingBody}</td>
                      <td style={{ fontSize: '0.825rem', color: 'var(--color-muted)' }}>
                        {new Date(o.startDate).toLocaleDateString()} - {new Date(o.endDate).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`badge ${o.status === 'APPROVED' ? 'badge-present' : o.status === 'REJECTED' ? 'badge-absent' : 'badge-warning'}`}>
                          {o.status === 'APPROVED' ? 'PRESENT (OD)' : o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 5: Biometric & OD Attendance History */}
        <div className="glass" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.35rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                Complete Attendance History & Logs
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
                Biometric face recognition check-ins, manual entries, and approved OD records
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 200 }}>
                <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search class or mode..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.5rem', fontSize: '0.85rem' }}
                />
              </div>

              <input
                type="date"
                className="input-field"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                style={{ width: 145, fontSize: '0.85rem' }}
              />

              <select
                className="input-field"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ width: 135, fontSize: '0.85rem' }}
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
                  <th>Course Code</th>
                  <th>Status</th>
                  <th>Verification Mode</th>
                  <th>AI Confidence Score</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '2rem' }}>Loading presence records...</td></tr>
                ) : filteredHistory.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '2rem' }}>No matching attendance records found.</td></tr>
                ) : (
                  filteredHistory.map(r => (
                    <tr key={r._id}>
                      <td style={{ color: 'var(--color-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                        {r.date} {r.timestamp ? `• ${new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </td>
                      <td><span className="badge badge-teacher" style={{ fontFamily: 'monospace' }}>{r.classId}</span></td>
                      <td>
                        <span className={`badge ${r.status === 'PRESENT' ? 'badge-present' : 'badge-absent'}`}>
                          {r.verifiedVia === 'ON_DUTY' ? 'PRESENT (OD)' : r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.825rem', color: r.verifiedVia === 'ON_DUTY' ? '#c084fc' : r.verifiedVia === 'FACE_AI' ? 'var(--color-success)' : 'var(--color-accent-light)', fontWeight: 700 }}>
                        {r.verifiedVia || 'FACE_AI'}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                        {r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : '100%'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal for OD Application */}
        {showODModal && (
          <div className="modal-backdrop">
            <div className="modal-box" style={{ maxWidth: 540 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                  <Award color="var(--color-accent-light)" /> Apply for On Duty (OD)
                </div>
                <button onClick={() => setShowODModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {odMessage && (
                <div style={{
                  padding: '0.85rem', borderRadius: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem',
                  background: odMessage.includes('success') ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                  color: odMessage.includes('success') ? 'var(--color-success)' : 'var(--color-danger)',
                  border: `1px solid ${odMessage.includes('success') ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`
                }}>
                  {odMessage}
                </div>
              )}

              <form onSubmit={handleODSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Select Course Section</label>
                  <select
                    className="input-field"
                    value={odForm.classId}
                    onChange={(e) => setOdForm({ ...odForm, classId: e.target.value })}
                    required
                  >
                    {classList.map(c => (
                      <option key={c._id || c.classId} value={c._id || c.classId}>
                        {c.className || c.subjectName || c.classId} ({c.classId})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>OD Category</label>
                    <select
                      className="input-field"
                      value={odForm.odCategory}
                      onChange={(e) => setOdForm({ ...odForm, odCategory: e.target.value })}
                    >
                      {OD_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Event / Activity Name</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. National Hackathon 2026"
                      value={odForm.eventName}
                      onChange={(e) => setOdForm({ ...odForm, eventName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Organizing Institution / Body</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. IIT Madras / PSG Tech"
                    value={odForm.organizingBody}
                    onChange={(e) => setOdForm({ ...odForm, organizingBody: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Start Date</label>
                    <input
                      type="date"
                      className="input-field"
                      value={odForm.startDate}
                      onChange={(e) => setOdForm({ ...odForm, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>End Date</label>
                    <input
                      type="date"
                      className="input-field"
                      value={odForm.endDate}
                      onChange={(e) => setOdForm({ ...odForm, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Justification / Details</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Describe your role or participation details..."
                    value={odForm.reason}
                    onChange={(e) => setOdForm({ ...odForm, reason: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn-ghost" onClick={() => setShowODModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submittingOD}>
                    {submittingOD ? 'Submitting...' : 'Submit OD Application'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
