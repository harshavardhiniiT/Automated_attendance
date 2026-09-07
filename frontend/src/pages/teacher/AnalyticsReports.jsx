import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import api from '../../api/axios';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Download, Search, CheckCircle2, XCircle,
  FileSpreadsheet, Check
} from 'lucide-react';

const COLORS = ['#10b981', '#f43f5e', '#6366f1', '#f59e0b'];

export default function AnalyticsReports() {
  const [records, setRecords] = useState([]);
  const [classList, setClassList] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  useEffect(() => {
    fetchData();
  }, [selectedClass]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [classRes, attendanceRes] = await Promise.all([
        api.get('/classes/assigned'),
        api.get(`/attendance${selectedClass ? `?classId=${selectedClass}` : ''}`),
      ]);
      setClassList(classRes.data.classes || []);
      setRecords(attendanceRes.data.records || []);
    } catch {
      showToast('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    try {
      await api.patch(`/attendance/${id}/override`, { status: newStatus });
      setRecords((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: newStatus, verifiedVia: 'MANUAL_OVERRIDE' } : r))
      );
      showToast(`Status updated to ${newStatus}`);
    } catch {
      showToast('Failed to update status');
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get(`/attendance/export/csv${selectedClass ? `?classId=${selectedClass}` : ''}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_Report_${selectedClass || 'All'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      showToast('Failed to export CSV');
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await api.get(`/attendance/export/excel${selectedClass ? `?classId=${selectedClass}` : ''}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_Report_${selectedClass || 'All'}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      showToast('Failed to export Excel');
    }
  };

  const filteredRecords = records.filter((r) => {
    const matchSearch =
      !search ||
      r.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.rollNumber?.toLowerCase().includes(search.toLowerCase());
    const matchDate = !dateFilter || r.date === dateFilter;
    return matchSearch && matchDate;
  });

  const totalPresent = records.filter((r) => r.status === 'PRESENT').length;
  const totalAbsent = records.filter((r) => r.status === 'ABSENT').length;
  const overallRate = records.length > 0 ? ((totalPresent / records.length) * 100).toFixed(1) : '0.0';

  const dateMap = {};
  records.forEach((r) => {
    if (!dateMap[r.date]) dateMap[r.date] = { date: r.date, present: 0, total: 0 };
    dateMap[r.date].total += 1;
    if (r.status === 'PRESENT') dateMap[r.date].present += 1;
  });
  const trendData = Object.values(dateMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      rate: parseFloat(((d.present / d.total) * 100).toFixed(1)),
      present: d.present,
      absent: d.total - d.present,
    }));

  const classMap = {};
  records.forEach((r) => {
    const cid = r.classId || 'General';
    if (!classMap[cid]) classMap[cid] = { classId: cid, present: 0, total: 0 };
    classMap[cid].total += 1;
    if (r.status === 'PRESENT') classMap[cid].present += 1;
  });
  const classComparisonData = Object.values(classMap).map((c) => ({
    classId: c.classId,
    rate: parseFloat(((c.present / c.total) * 100).toFixed(1)),
    present: c.present,
    total: c.total,
  }));

  const pieData = [
    { name: 'Present', value: totalPresent },
    { name: 'Absent', value: totalAbsent },
  ];

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Header title="Analytics & Export Reports" subtitle="Visual charts, attendance trends, and CSV/Excel downloads" />
        {toast && (
          <div style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 200,
            background: 'var(--color-surface)', border: '1px solid var(--color-accent-light)',
            borderRadius: '0.85rem', padding: '0.85rem 1.25rem', color: 'var(--color-text)',
            fontSize: '0.875rem', fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            <Check size={18} color="var(--color-success)" />
            {toast}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Attendance Analytics & Reports
            </h1>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>Interactive analytics, attendance rates & export tools</p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-ghost" onClick={handleExportCSV}>
              <Download size={16} /> Export CSV
            </button>
            <button className="btn-primary" onClick={handleExportExcel}>
              <FileSpreadsheet size={16} /> Export Excel
            </button>
          </div>
        </div>

        {/* KPI Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.35rem', marginBottom: '1.75rem' }}>
          <div className="glass glass-hover" style={{ padding: '1.4rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>OVERALL ATTENDANCE RATE</div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'Outfit, sans-serif' }}>
              {overallRate}%
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.35rem' }}>Threshold Target: 75.0%</div>
          </div>

          <div className="glass glass-hover" style={{ padding: '1.4rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>TOTAL LOGGED EVENTS</div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--color-accent-light)', fontFamily: 'Outfit, sans-serif' }}>
              {records.length}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.35rem' }}>{totalPresent} Present · {totalAbsent} Absent</div>
          </div>

          <div className="glass glass-hover" style={{ padding: '1.4rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>ACTIVE SECTIONS</div>
            <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--color-info)', fontFamily: 'Outfit, sans-serif' }}>
              {classList.length}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', marginTop: '0.35rem' }}>Course sections</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.35rem', marginBottom: '1.75rem' }}>
          {/* Trend Area Chart */}
          <div className="glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '1.1rem', fontFamily: 'Outfit, sans-serif' }}>
              📈 Attendance Rate Trend Over Time (%)
            </h3>
            <div style={{ width: '100%', height: 280 }}>
              {trendData.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-muted)' }}>
                  No historical trend data recorded yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" stroke="var(--color-muted)" style={{ fontSize: '0.75rem' }} />
                    <YAxis domain={[0, 100]} stroke="var(--color-muted)" style={{ fontSize: '0.75rem' }} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', color: 'var(--color-text)' }} />
                    <Area type="monotone" dataKey="rate" stroke="#6366f1" fillOpacity={1} fill="url(#colorRate)" name="Attendance Rate (%)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Distribution Donut Chart */}
          <div className="glass" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '1.1rem', fontFamily: 'Outfit, sans-serif' }}>
              📊 Present vs Absent
            </h3>
            <div style={{ width: '100%', height: 280 }}>
              {records.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-muted)' }}>
                  No data to display.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', color: 'var(--color-text)' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Section Comparison Bar Chart */}
        {classComparisonData.length > 0 && (
          <div className="glass" style={{ padding: '1.5rem', marginBottom: '1.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '1.1rem', fontFamily: 'Outfit, sans-serif' }}>
              🏢 Section Comparison — Attendance Rate (%)
            </h3>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="classId" stroke="var(--color-muted)" style={{ fontSize: '0.75rem' }} />
                  <YAxis domain={[0, 100]} stroke="var(--color-muted)" style={{ fontSize: '0.75rem' }} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', color: 'var(--color-text)' }} />
                  <Bar dataKey="rate" fill="#10b981" radius={[6, 6, 0, 0]} name="Attendance Rate (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Detailed Attendance Roster Log */}
        <div className="glass" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.35rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
              Comprehensive Attendance Logs
            </h3>

            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
              <select
                className="input-field"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                style={{ minWidth: 180 }}
              >
                <option value="">All Course Classes</option>
                {classList.map((c) => (
                  <option key={c.classId} value={c.classId}>{c.className} ({c.classId})</option>
                ))}
              </select>

              <div style={{ position: 'relative', width: 220 }}>
                <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search student..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>

              <input
                type="date"
                className="input-field"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
          </div>

          <div className="data-table-container">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-muted)' }}>
                Loading report data...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-muted)' }}>
                No attendance records found matching filters.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Class ID</th>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Status</th>
                    <th>Confidence</th>
                    <th>Verified Via</th>
                    <th style={{ textAlign: 'right' }}>Override</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => {
                    const isPresent = r.status === 'PRESENT';
                    const confPct = r.confidence ? (r.confidence > 1 ? `${Number(r.confidence).toFixed(1)}%` : `${(Number(r.confidence) * 100).toFixed(1)}%`) : '—';
                    return (
                      <tr key={r._id}>
                        <td style={{ color: 'var(--color-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{r.date}</td>
                        <td>
                          <span className="badge badge-teacher" style={{ fontFamily: 'monospace' }}>
                            {r.classId}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--color-accent-light)' }}>{r.rollNumber}</td>
                        <td style={{ fontWeight: 700, color: 'var(--color-text)' }}>{r.student?.name || r.rollNumber}</td>
                        <td>
                          <span className={`badge ${isPresent ? 'badge-present' : 'badge-absent'}`}>
                            {isPresent ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                            {r.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{confPct}</td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: r.verifiedVia === 'FACE_AI' ? 'var(--color-success)' : 'var(--color-accent-light)', fontWeight: 700 }}>
                            {r.verifiedVia || 'FACE_AI'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-ghost btn-sm"
                            onClick={() => handleToggleStatus(r._id, r.status)}
                          >
                            Toggle Status
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
