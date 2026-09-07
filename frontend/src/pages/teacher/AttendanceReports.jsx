import { useState, useEffect, useCallback } from 'react';
import { Download, FileSpreadsheet, Filter, RefreshCw } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import api from '../../api/axios';

export default function AttendanceReports() {
  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [classFilter, setClassFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (classFilter) params.set('classId', classFilter);
      if (dateFilter) params.set('date', dateFilter);
      const { data } = await api.get(`/attendance?${params}`);
      setRecords(data.records);
      setTotal(data.total);
    } catch { showToast('Failed to load attendance records'); }
    finally { setLoading(false); }
  }, [classFilter, dateFilter]);

  useEffect(() => {
    api.get('/classes').then((res) => setClasses(res.data.classes)).catch(() => {});
    fetchReports();
  }, [fetchReports]);

  const handleOverride = async (recordId, currentStatus) => {
    const newStatus = currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    try {
      await api.patch(`/attendance/${recordId}/override`, { status: newStatus });
      showToast(`Updated status to ${newStatus}`);
      fetchReports();
    } catch { showToast('Override failed'); }
  };

  const handleDownloadCSV = () => {
    const url = `/api/attendance/export/csv${classFilter ? `?classId=${classFilter}` : ''}`;
    window.open(url, '_blank');
  };

  const handleDownloadExcel = () => {
    const url = `/api/attendance/export/excel${classFilter ? `?classId=${classFilter}` : ''}`;
    window.open(url, '_blank');
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {toast && (
          <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 200, background: 'rgba(30,41,59,0.95)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '0.75rem', padding: '0.85rem 1.25rem', color: '#f1f5f9', fontSize: '0.875rem', fontWeight: 500, backdropFilter: 'blur(10px)' }}>
            {toast}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9' }}>Attendance Reports</h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{total} recorded logs</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-ghost" onClick={fetchReports}><RefreshCw size={15} /></button>
            <button className="btn-ghost" onClick={handleDownloadCSV}><Download size={15} /> CSV</button>
            <button className="btn-success" onClick={handleDownloadExcel}><FileSpreadsheet size={15} /> Excel</button>
          </div>
        </div>

        {/* Filters */}
        <div className="glass" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            <Filter size={16} /> Filters:
          </div>
          <select className="input-field" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">All Course Classes</option>
            {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className} ({c.classId})</option>)}
          </select>
          <input type="date" className="input-field" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{ maxWidth: 180 }} />
          {(classFilter || dateFilter) && (
            <button className="btn-ghost" onClick={() => { setClassFilter(''); setDateFilter(''); }} style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}>
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
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
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>Loading logs…</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No attendance records found</td></tr>
                ) : records.map((r) => (
                  <tr key={r._id}>
                    <td style={{ color: '#94a3b8' }}>{r.date}</td>
                    <td><span className="badge badge-teacher" style={{ fontFamily: 'monospace' }}>{r.classId}</span></td>
                    <td style={{ fontFamily: 'monospace', color: '#f1f5f9' }}>{r.rollNumber}</td>
                    <td style={{ fontWeight: 600, color: '#f1f5f9' }}>{r.student?.name || 'Enrolled Student'}</td>
                    <td>
                      <span className={`badge ${r.status === 'PRESENT' ? 'badge-present' : 'badge-absent'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ color: '#94a3b8' }}>{(r.confidence * 100).toFixed(1)}%</td>
                    <td style={{ fontSize: '0.78rem', color: '#64748b' }}>{r.verifiedVia}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-ghost"
                        onClick={() => handleOverride(r._id, r.status)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      >
                        Toggle Status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
