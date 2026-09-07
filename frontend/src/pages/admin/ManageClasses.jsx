import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Trash2, UserPlus, Users, Search, RefreshCw, CheckCircle2, Cpu, AlertTriangle, Clock, Calendar } from 'lucide-react';
import SchedulePicker from '../../components/SchedulePicker';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';
import Modal from '../../components/Modal';
import ToastNotification from '../../components/ToastNotification';
import api from '../../api/axios';

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication',
  'Information Technology',
  'Data Science & AI',
  'Mechanical Engineering',
  'Electrical & Electronics',
  'Civil Engineering',
  'Business Administration',
];

export default function ManageClasses() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showRoster, setShowRoster] = useState(null);
  const [classToDelete, setClassToDelete] = useState(null);
  const [deletingClass, setDeletingClass] = useState(false);
  const [syncingClassId, setSyncingClassId] = useState(null);

  const [form, setForm] = useState({
    classId: '',
    className: '',
    subject: '',
    department: DEPARTMENTS[0],
    teacherId: '',
    schedule: '',
    room: '',
  });

  const [creating, setCreating] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [classRes, teacherRes, studentRes] = await Promise.all([
        api.get(`/classes${search ? `?search=${search}` : ''}`),
        api.get('/users?role=TEACHER&limit=100'),
        api.get('/users?role=STUDENT&limit=200'),
      ]);
      setClasses(classRes.data.classes);
      setTeachers(teacherRes.data.users);
      setAllStudents(studentRes.data.users);
    } catch {
      showToast('Failed to load courses & rosters', 'danger');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.schedule || !form.schedule.trim()) {
      showToast('Class schedule date, days, and time are required to create a class!', 'danger');
      return;
    }
    setCreating(true);
    try {
      await api.post('/classes', form);
      showToast(`Class section "${form.className}" created & PKL initialized!`);
      setShowCreate(false);
      setForm({ classId: '', className: '', subject: '', department: DEPARTMENTS[0], teacherId: '', schedule: '', room: '' });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Creation failed', 'danger');
    } finally {
      setCreating(false);
    }
  };

  const confirmDeleteClass = (cls) => {
    setClassToDelete(cls);
  };

  const handleExecuteDeleteClass = async () => {
    if (!classToDelete) return;
    setDeletingClass(true);
    try {
      const { data } = await api.delete(`/classes/${classToDelete._id}`);
      showToast(data.message || `Deleted ${classToDelete.className}`);
      setClassToDelete(null);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete operation failed', 'danger');
    } finally {
      setDeletingClass(false);
    }
  };

  const handleSyncPkl = async (cls) => {
    setSyncingClassId(cls._id);
    try {
      const { data } = await api.post('/ml/load-class-db', { classId: cls.classId });
      showToast(`PKL vector index synced for ${cls.classId} (${data.student_count || 0} students matrix loaded)`);
    } catch {
      showToast(`PKL sync notice: ML microservice offline`, 'warning');
    } finally {
      setSyncingClassId(null);
    }
  };

  const handleAddStudentToRoster = async () => {
    if (!selectedStudentId || !showRoster) return;
    try {
      const { data } = await api.post(`/classes/${showRoster._id}/students`, { studentId: selectedStudentId });
      setShowRoster(data.class);
      showToast('Enrolled student into class section roster & updated face PKL');
      setSelectedStudentId('');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Enrollment failed', 'danger');
    }
  };

  const handleRemoveStudentFromRoster = async (studentId) => {
    if (!showRoster) return;
    try {
      const { data } = await api.delete(`/classes/${showRoster._id}/students/${studentId}`);
      setShowRoster(data.class);
      showToast('Student removed from class roster & PKL unindexed');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Removal failed', 'danger');
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

        <Header title="Classroom & Roster Configuration" subtitle="Create course sections, assign faculty instructors, and manage student rosters" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Institutional Course Sections ({classes.length})
            </h2>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginTop: '0.15rem' }}>Configured academic classes, schedule, room allocation, and ML vector databases</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-ghost" onClick={fetchData} title="Refresh classes"><RefreshCw size={17} /></button>
            <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus size={18} /> Provision Course Section</button>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '1.35rem', maxWidth: 380, position: 'relative' }}>
          <Search size={17} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
          <input className="input-field" placeholder="Search class name, code, or department…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '2.6rem' }} />
        </div>

        {/* Grid of Classes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.35rem' }}>
          {loading ? (
            <div style={{ color: 'var(--color-muted)', padding: '2.5rem 0' }}>Loading academic course sections…</div>
          ) : classes.length === 0 ? (
            <div style={{ color: 'var(--color-muted)', padding: '2.5rem 0' }}>No course sections found. Click "Provision Course Section" to create one.</div>
          ) : classes.map((c) => (
            <div key={c._id} className="glass glass-hover" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <span className="badge badge-teacher" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.classId}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 600 }}>{c.department}</span>
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '0.35rem', fontFamily: 'Outfit, sans-serif' }}>{c.className}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.85rem' }}>
                  Faculty Instructor: <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{c.teacher?.name || 'Unassigned'}</span>
                </p>

                <div style={{ fontSize: '0.825rem', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontWeight: 500 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={14} color="var(--color-accent-light)" />
                    <span><b>Schedule:</b> {c.schedule || 'Schedule TBD'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-muted)', fontSize: '0.78rem' }}>
                    <span>📍 Room: <b>{c.room || 'TBD'}</b></span>
                    {c.createdAt && (
                      <span style={{ opacity: 0.85 }}>• Added {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.35rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <button className="btn-ghost btn-sm" onClick={() => setShowRoster(c)} style={{ gap: '0.35rem' }}>
                  <Users size={15} /> Roster ({c.students?.length || 0})
                </button>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => handleSyncPkl(c)}
                    disabled={syncingClassId === c._id}
                    title="Sync face biometrics PKL vector database"
                  >
                    <Cpu size={14} color="var(--color-accent-light)" /> {syncingClassId === c._id ? 'Syncing…' : 'Sync PKL'}
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => confirmDeleteClass(c)} title="Delete Course Section">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Delete Class Confirmation Modal */}
        {classToDelete && (
          <Modal title={`Confirm Delete Class Section: ${classToDelete.classId}`} onClose={() => setClassToDelete(null)} maxWidth={480}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  background: 'var(--color-danger-bg)', border: '1px solid rgba(244,63,94,0.3)',
                  borderRadius: '1rem', padding: '1.15rem', color: 'var(--color-text)',
                  fontSize: '0.875rem', lineHeight: 1.5, display: 'flex', gap: '0.85rem', alignItems: 'flex-start',
                }}
              >
                <AlertTriangle size={26} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: 'var(--color-danger)', fontSize: '0.98rem' }}>Delete "{classToDelete.className}" ({classToDelete.classId})?</strong>
                  <p style={{ marginTop: '0.4rem', fontSize: '0.825rem', color: 'var(--color-muted)' }}>
                    This operation will cascade and remove:
                  </p>
                  <ul style={{ marginTop: '0.4rem', paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    <li>All logged student attendance history for this class</li>
                    <li>The Python ML <code>{classToDelete.classId}_db.pkl</code> vector database file</li>
                  </ul>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem' }}>
                <button
                  className="btn-danger"
                  onClick={handleExecuteDeleteClass}
                  disabled={deletingClass}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {deletingClass ? 'Deleting Section…' : 'Yes, Delete Section'}
                </button>
                <button className="btn-ghost" onClick={() => setClassToDelete(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Create Class Modal */}
        {showCreate && (
          <Modal title="Provision New Academic Course Section" onClose={() => setShowCreate(false)}>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>Class ID Code *</label>
                  <input className="input-field" placeholder="e.g. CS101_SECA" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>Department *</label>
                  <select className="input-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>Course Section Title *</label>
                <input className="input-field" placeholder="e.g. Data Structures Section A" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} required />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>Assigned Faculty Instructor *</label>
                <select className="input-field" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} required>
                  <option value="">Select Faculty Member</option>
                  {teachers.map((t) => <option key={t._id} value={t._id}>{t.name} ({t.department} - {t.employeeId || t.email})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>Room / Lab Hall</label>
                <input className="input-field" placeholder="e.g. Lab 302 / Block B" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                  Class Schedule & Calendar Date * <span style={{ color: 'var(--color-danger, #f43f5e)', fontSize: '0.75rem' }}>(Required)</span>
                </label>
                <SchedulePicker value={form.schedule} onChange={(val) => setForm((prev) => ({ ...prev, schedule: val }))} />
              </div>
              <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.75rem' }}>
                <button type="submit" className="btn-primary" disabled={creating} style={{ flex: 1, justifyContent: 'center' }}>
                  {creating ? 'Provisioning…' : 'Provision Class Section'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Roster Management Modal */}
        {showRoster && (
          <Modal title={`Class Roster: ${showRoster.className} (${showRoster.classId})`} onClose={() => setShowRoster(null)} maxWidth={660}>
            <div style={{ marginBottom: '1.35rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Enroll Student to Course Roster
              </label>
              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <select className="input-field" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                  <option value="">Select Student to Enroll</option>
                  {allStudents
                    .filter((s) => !showRoster.students?.some((st) => String(st._id || st) === String(s._id)))
                    .map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.rollNumber || s.email}) — {s.department}
                      </option>
                    ))}
                </select>
                <button className="btn-primary" onClick={handleAddStudentToRoster} disabled={!selectedStudentId}>
                  <UserPlus size={16} /> Enroll
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <input
                className="input-field"
                placeholder="Search enrolled students…"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
              />
            </div>

            <div className="data-table-container" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Roll Number</th>
                    <th>Department</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {!showRoster.students || showRoster.students.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '2rem' }}>No students enrolled in this class section yet.</td></tr>
                  ) : showRoster.students
                    .filter((st) => !rosterSearch || st.name?.toLowerCase().includes(rosterSearch.toLowerCase()) || st.rollNumber?.toLowerCase().includes(rosterSearch.toLowerCase()))
                    .map((st) => (
                    <tr key={st._id || st}>
                      <td style={{ fontWeight: 700, color: 'var(--color-text)' }}>{st.name || 'Enrolled Student'}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--color-accent-light)', fontWeight: 700 }}>{st.rollNumber || '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>{st.department || showRoster.department}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-danger btn-sm" onClick={() => handleRemoveStudentFromRoster(st._id || st)}>
                          Unenroll
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
}
