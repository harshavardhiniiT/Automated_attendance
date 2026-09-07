import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import api from '../../api/axios';
import {
  Users, BookOpen, Camera, Search, ArrowLeft,
  Calendar, CheckCircle2, XCircle, Download,
  Check, X, FileSpreadsheet, UserCheck, UserX, Percent
} from 'lucide-react';

export default function ClassroomAttendance() {
  const location = useLocation();
  const navigate = useNavigate();

  const todayStr = new Date().toISOString().split('T')[0];

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [recordsMap, setRecordsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/classes/assigned');
      const loadedClasses = res.data.classes || [];
      setClasses(loadedClasses);

      if (location.state?.classId) {
        const found = loadedClasses.find((c) => c.classId === location.state.classId);
        if (found) loadClassAttendance(found, dateFilter);
      }
    } catch {
      showToast('Failed to load assigned classes');
    } finally {
      setLoading(false);
    }
  };

  const loadClassAttendance = useCallback(async (cls, targetDate = dateFilter) => {
    setSelectedClass(cls);
    setLoading(true);
    try {
      const classRes = await api.get(`/classes/${cls._id}`);
      const enrolled = classRes.data.class?.students || [];
      setEnrolledStudents(enrolled);

      const dateParam = targetDate ? `&date=${targetDate}` : '';
      const attRes = await api.get(`/attendance?classId=${cls.classId}${dateParam}`);
      const logs = attRes.data.records || [];

      const map = {};
      logs.forEach((rec) => {
        if (rec.student?._id) map[rec.student._id] = rec;
        if (rec.rollNumber) map[rec.rollNumber.toUpperCase()] = rec;
      });
      setRecordsMap(map);
    } catch {
      showToast(`Failed to load attendance details for ${cls.className}`);
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    if (selectedClass) {
      loadClassAttendance(selectedClass, dateFilter);
    }
  }, [dateFilter, loadClassAttendance, selectedClass]);

  const handleSetStatus = async (student, newStatus) => {
    if (!selectedClass) return;
    const studentKey = student._id || student.rollNumber;
    setSavingId(studentKey);

    const existingRecord = recordsMap[student._id] || recordsMap[student.rollNumber?.toUpperCase()];

    try {
      let updatedRecord;
      if (existingRecord?._id) {
        const res = await api.patch(`/attendance/${existingRecord._id}/override`, { status: newStatus });
        updatedRecord = res.data.record;
      } else {
        const res = await api.post('/attendance/log', {
          classId: selectedClass.classId,
          studentId: student._id,
          rollNumber: student.rollNumber,
          status: newStatus,
          date: dateFilter || todayStr,
          verifiedVia: 'MANUAL_ENTRY',
        });
        updatedRecord = res.data.record;
      }

      setRecordsMap((prev) => ({
        ...prev,
        [student._id]: updatedRecord,
        [student.rollNumber?.toUpperCase()]: updatedRecord,
      }));

      showToast(`${student.name} marked as ${newStatus}`);
    } catch {
      showToast(`Failed to update status for ${student.name}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleBulkAction = async (targetStatus) => {
    if (!selectedClass || enrolledStudents.length === 0) return;
    setLoading(true);
    let updatedCount = 0;

    try {
      for (const student of enrolledStudents) {
        const existingRecord = recordsMap[student._id] || recordsMap[student.rollNumber?.toUpperCase()];
        if (existingRecord?.status === targetStatus) continue;

        if (existingRecord?._id) {
          await api.patch(`/attendance/${existingRecord._id}/override`, { status: targetStatus });
        } else {
          await api.post('/attendance/log', {
            classId: selectedClass.classId,
            studentId: student._id,
            rollNumber: student.rollNumber,
            status: targetStatus,
            date: dateFilter || todayStr,
            verifiedVia: 'MANUAL_ENTRY',
          });
        }
        updatedCount++;
      }
      showToast(`Bulk update: ${updatedCount} students marked ${targetStatus}`);
      await loadClassAttendance(selectedClass, dateFilter);
    } catch {
      showToast('Bulk update encountered errors');
    } finally {
      setLoading(false);
    }
  };

  const rosterItems = enrolledStudents.map((std) => {
    const rec = recordsMap[std._id] || recordsMap[std.rollNumber?.toUpperCase()];
    return {
      student: std,
      record: rec,
      status: rec ? rec.status : 'NOT_MARKED',
      verifiedVia: rec ? rec.verifiedVia : null,
      confidence: rec ? rec.confidence : null,
    };
  });

  const totalEnrolled = rosterItems.length;
  const presentCount = rosterItems.filter((i) => i.status === 'PRESENT').length;
  const absentCount = rosterItems.filter((i) => i.status === 'ABSENT').length;
  const attendanceRate = totalEnrolled > 0 ? ((presentCount / totalEnrolled) * 100).toFixed(1) : '0.0';

  const filteredRoster = rosterItems.filter((item) => {
    const matchSearch =
      !search ||
      item.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
      item.student?.rollNumber?.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      !statusFilter ||
      (statusFilter === 'NOT_MARKED' ? item.status === 'NOT_MARKED' : item.status === statusFilter);
    return matchSearch && matchStatus;
  });

  const handleExportCSV = async () => {
    if (!selectedClass) return;
    try {
      const response = await api.get(`/attendance/export/csv?classId=${selectedClass.classId}${dateFilter ? `&date=${dateFilter}` : ''}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_${selectedClass.classId}_${dateFilter || 'all'}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      showToast('Failed to export CSV');
    }
  };

  const handleExportExcel = async () => {
    if (!selectedClass) return;
    try {
      const response = await api.get(`/attendance/export/excel?classId=${selectedClass.classId}${dateFilter ? `&date=${dateFilter}` : ''}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Attendance_${selectedClass.classId}_${dateFilter || 'all'}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      showToast('Failed to export Excel document');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Header title="Classroom Roster & Attendance" subtitle="Manage student presence, manual overrides, and export reports" />
        {toast && (
          <div style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 200,
            background: 'var(--color-surface)', border: '1px solid var(--color-accent-light)',
            borderRadius: '0.85rem', padding: '0.85rem 1.25rem', color: 'var(--color-text)',
            fontSize: '0.875rem', fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}>
            <CheckCircle2 size={18} color="var(--color-success)" />
            {toast}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {selectedClass && (
              <button className="btn-ghost" onClick={() => setSelectedClass(null)} style={{ padding: '0.5rem 0.75rem' }}>
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)' }}>
                {selectedClass ? `${selectedClass.className} (${selectedClass.classId})` : 'Classroom Attendance Roster'}
              </h1>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginTop: '0.15rem' }}>
                {selectedClass ? 'Take attendance, override individual student records, or launch live session' : 'Select a course section below to review student presence'}
              </p>
            </div>
          </div>

          {selectedClass && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => navigate('/teacher/live', { state: { classId: selectedClass.classId } })}>
                <Camera size={18} /> AI Camera Session
              </button>
              <button className="btn-ghost" onClick={handleExportCSV}>
                <Download size={16} /> CSV
              </button>
              <button className="btn-secondary" onClick={handleExportExcel}>
                <FileSpreadsheet size={16} /> Excel
              </button>
            </div>
          )}
        </div>

        {/* VIEW 1: CLASS SECTIONS */}
        {!selectedClass && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-muted)' }}>
                Loading classroom sections...
              </div>
            ) : classes.length === 0 ? (
              <div className="glass" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--color-muted)' }}>
                <BookOpen size={52} color="var(--color-accent-light)" style={{ opacity: 0.35, marginBottom: '1rem' }} />
                <h3 style={{ color: 'var(--color-text)', fontSize: '1.2rem', fontWeight: 800 }}>No assigned classes found</h3>
                <p style={{ fontSize: '0.875rem', marginTop: '0.35rem' }}>Contact administrator to assign classes to your account.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.35rem' }}>
                {classes.map((cls) => {
                  const studentCount = cls.students?.length || 0;
                  return (
                    <div key={cls._id} className="glass glass-hover" style={{ padding: '1.6rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                          <span className="badge badge-teacher">{cls.department || 'General'}</span>
                          <span style={{ fontSize: '0.88rem', color: 'var(--color-accent-light)', fontWeight: 800, fontFamily: 'monospace' }}>
                            {cls.classId}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.35rem', fontFamily: 'Outfit, sans-serif' }}>
                          {cls.className}
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '1.1rem' }}>
                          {cls.subject ? `Subject: ${cls.subject}` : 'Course Section'} {cls.schedule ? `· ${cls.schedule}` : ''}
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem 1rem', background: 'var(--color-surface2)', borderRadius: '0.75rem', marginBottom: '1.35rem', border: '1px solid var(--color-border)' }}>
                          <Users size={18} color="var(--color-accent-light)" />
                          <span style={{ fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 700 }}>{studentCount} Enrolled Students</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                          className="btn-primary"
                          onClick={() => loadClassAttendance(cls, dateFilter)}
                          style={{ flex: 1, fontSize: '0.875rem', justifyContent: 'center' }}
                        >
                          Review Attendance Roster
                        </button>
                        <button
                          className="btn-ghost"
                          onClick={() => navigate('/teacher/live', { state: { classId: cls.classId } })}
                          style={{ padding: '0.6rem 0.9rem' }}
                          title="Start Live AI Session"
                        >
                          <Camera size={18} color="var(--color-success)" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: ROSTER & OVERRIDES */}
        {selectedClass && (
          <div>
            {/* Stats Summary Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.1rem', marginBottom: '1.75rem' }}>
              <div className="glass glass-hover" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: 'var(--color-accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={22} color="var(--color-accent-light)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Enrolled Roster</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>{totalEnrolled}</div>
                </div>
              </div>

              <div className="glass glass-hover" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--color-success)' }}>
                <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={22} color="var(--color-success)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 700, textTransform: 'uppercase' }}>Present</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)', fontFamily: 'Outfit, sans-serif' }}>{presentCount}</div>
                </div>
              </div>

              <div className="glass glass-hover" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--color-danger)' }}>
                <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: 'var(--color-danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserX size={22} color="var(--color-danger)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 700, textTransform: 'uppercase' }}>Absent</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-danger)', fontFamily: 'Outfit, sans-serif' }}>{absentCount}</div>
                </div>
              </div>

              <div className="glass glass-hover" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: '0.75rem', background: 'var(--color-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Percent size={22} color="var(--color-info)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Attendance Rate</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-info)', fontFamily: 'Outfit, sans-serif' }}>{attendanceRate}%</div>
                </div>
              </div>
            </div>

            {/* Filter and Bulk Action Controls */}
            <div className="glass" style={{ padding: '1.35rem', marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '0.85rem', flex: 1, minWidth: 300, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                    <Search size={17} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Search student by name or roll number..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ paddingLeft: '2.6rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <Calendar size={18} color="var(--color-accent-light)" />
                    <input
                      type="date"
                      className="input-field"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      style={{ width: 160 }}
                    />
                  </div>

                  <select
                    className="input-field"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ width: 140 }}
                  >
                    <option value="">All Statuses</option>
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                    <option value="NOT_MARKED">Not Marked</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <button className="btn-primary btn-sm" onClick={() => handleBulkAction('PRESENT')}>
                    <CheckCircle2 size={15} /> Mark All Present
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => handleBulkAction('ABSENT')}>
                    <XCircle size={15} /> Mark All Absent
                  </button>
                </div>
              </div>
            </div>

            {/* Roster Table */}
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Status</th>
                    <th>Confidence</th>
                    <th>Verified Via</th>
                    <th style={{ textAlign: 'center' }}>Attendance Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-muted)' }}>Loading roster...</td></tr>
                  ) : filteredRoster.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-muted)' }}>No matching students found.</td></tr>
                  ) : (
                    filteredRoster.map(({ student, record, status, verifiedVia, confidence }) => {
                      const isPresent = status === 'PRESENT';
                      const isAbsent = status === 'ABSENT';
                      const isSaving = savingId === (student._id || student.rollNumber);

                      const confPct = confidence !== null && confidence !== undefined
                        ? (confidence > 1 ? `${Number(confidence).toFixed(1)}%` : `${(Number(confidence) * 100).toFixed(1)}%`)
                        : '—';

                      return (
                        <tr key={student._id || student.rollNumber}>
                          <td style={{ color: 'var(--color-muted)', fontSize: '0.85rem', fontWeight: 600 }}>{dateFilter}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--color-accent-light)' }}>{student.rollNumber}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{
                                width: 34, height: 34, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.85rem', fontWeight: 800, color: '#fff',
                                overflow: 'hidden', flexShrink: 0
                              }}>
                                {student.photoUrl ? (
                                  <img src={student.photoUrl} alt={student.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  (student.name?.[0] || '?').toUpperCase()
                                )}
                              </div>
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{student.name}</span>
                            </div>
                          </td>
                          <td>
                            {isPresent && <span className="badge badge-present"><CheckCircle2 size={13} /> Present</span>}
                            {isAbsent && <span className="badge badge-absent"><XCircle size={13} /> Absent</span>}
                            {!isPresent && !isAbsent && <span className="badge" style={{ background: 'var(--color-surface2)', color: 'var(--color-muted)' }}>Not Marked</span>}
                          </td>
                          <td style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>{confPct}</td>
                          <td>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: verifiedVia === 'FACE_AI' ? 'var(--color-success)' : 'var(--color-accent-light)' }}>
                              {verifiedVia || '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              <button
                                className="btn-primary btn-sm"
                                onClick={() => handleSetStatus(student, 'PRESENT')}
                                disabled={isSaving || isPresent}
                                style={{ opacity: isPresent ? 0.4 : 1 }}
                              >
                                <Check size={14} /> Present
                              </button>
                              <button
                                className="btn-danger btn-sm"
                                onClick={() => handleSetStatus(student, 'ABSENT')}
                                disabled={isSaving || isAbsent}
                                style={{ opacity: isAbsent ? 0.4 : 1 }}
                              >
                                <X size={14} /> Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
