import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Trash2, Upload, ToggleLeft, ToggleRight, Search, RefreshCw,
  Edit3, Copy, Check, GraduationCap, Briefcase, AlertTriangle, Database,
  ShieldCheck, Camera, Sparkles, Image, ShieldAlert
} from 'lucide-react';
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

export default function ManageUsers() {
  const [activeTab, setActiveTab] = useState('STUDENT'); // 'STUDENT' | 'TEACHER'
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showClearDbModal, setShowClearDbModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null); // User for cascading delete modal
  const [deletingUser, setDeletingUser] = useState(false);
  const [clearingDb, setClearingDb] = useState(false);

  const [editingUser, setEditingUser] = useState(null); // null = Create, object = Edit
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STUDENT',
    department: 'Computer Science & Engineering',
    rollNumber: '',
    employeeId: '',
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('role', activeTab);
      params.set('excludeAdmin', 'true');
      if (search) params.set('search', search);
      if (departmentFilter) params.set('department', departmentFilter);

      const { data } = await api.get(`/users?${params}`);
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      showToast('Failed to load user directory', 'danger');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, departmentFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenCreate = (defaultRole = activeTab) => {
    setEditingUser(null);
    setCreatedCredentials(null);
    setFormError('');
    setForm({
      name: '',
      email: '',
      password: '',
      role: defaultRole,
      department: DEPARTMENTS[0],
      rollNumber: '',
      employeeId: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setCreatedCredentials(null);
    setFormError('');
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'STUDENT',
      department: user.department || DEPARTMENTS[0],
      rollNumber: user.rollNumber || '',
      employeeId: user.employeeId || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.email || !payload.email.trim()) delete payload.email;
      if (!payload.password || !payload.password.trim()) delete payload.password;
      if (payload.role === 'STUDENT') {
        delete payload.employeeId;
      } else if (payload.role === 'TEACHER') {
        delete payload.rollNumber;
      }

      if (editingUser) {
        await api.put(`/users/${editingUser._id}`, payload);
        showToast(`User "${form.name}" updated successfully`);
        setShowModal(false);
        fetchUsers();
      } else {
        const { data } = await api.post('/users', payload);
        showToast(`${form.role} "${form.name}" created successfully`);
        setCreatedCredentials({
          name: data.user.name,
          email: data.user.email,
          password: data.defaultPassword,
          uniqueId: data.user.rollNumber || data.user.employeeId || '—',
          role: data.user.role,
        });
        fetchUsers();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteUser = (user) => {
    setUserToDelete(user);
  };

  const handleExecuteDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      const { data } = await api.delete(`/users/${userToDelete._id}`);
      showToast(data.message || `Deleted ${userToDelete.name}`);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete operation failed', 'danger');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleClearDatabase = async () => {
    setClearingDb(true);
    try {
      const { data } = await api.post('/users/clear-db');
      showToast(data.message, 'success');
      setShowClearDbModal(false);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Clear DB failed', 'danger');
    } finally {
      setClearingDb(false);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const { data } = await api.patch(`/users/${user._id}/toggle-active`);
      showToast(`User ${data.isActive ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch {
      showToast('Status update failed', 'danger');
    }
  };

  const handlePhotoUpload = async (userId, file) => {
    const fd = new FormData();
    fd.append('photo', file);
    try {
      await api.post(`/users/${userId}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('Photo uploaded & face biometrics extracted successfully!');
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Photo upload failed', 'danger');
    }
  };

  const handleRemovePhoto = async (user) => {
    if (!confirm(`Delete Cloudinary photo for ${user.name}?`)) return;
    try {
      await api.delete(`/users/${user._id}/photo`);
      showToast(`Photo removed for ${user.name}`);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Photo removal failed', 'danger');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

        <Header title="User Directory & Biometrics" subtitle="Enterprise student & faculty provision, Cloudinary photos, and face embeddings" />

        {/* Action Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)' }}>
              Institutional User Directory
            </h2>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', marginTop: '0.15rem' }}>
              Manage campus users, assign roll numbers/employee IDs, and sync biometric face vectors.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn-ghost" onClick={fetchUsers} title="Refresh list">
              <RefreshCw size={17} />
            </button>
            <button
              className="btn-ghost"
              onClick={() => setShowClearDbModal(true)}
              style={{ color: 'var(--color-danger)', borderColor: 'rgba(244,63,94,0.3)' }}
              title="Purge all database & Cloudinary test records"
            >
              <Database size={17} /> Purge System DB
            </button>
            <button className="btn-primary" onClick={() => handleOpenCreate(activeTab)}>
              <UserPlus size={18} /> Add {activeTab === 'STUDENT' ? 'Student' : 'Faculty'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)',
          paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              onClick={() => setActiveTab('STUDENT')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.55rem',
                padding: '0.65rem 1.35rem', borderRadius: '0.75rem', border: 'none',
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeTab === 'STUDENT' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'transparent',
                color: activeTab === 'STUDENT' ? '#ffffff' : 'var(--color-muted)',
              }}
            >
              <GraduationCap size={19} />
              Enrolled Students
            </button>
            <button
              onClick={() => setActiveTab('TEACHER')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.55rem',
                padding: '0.65rem 1.35rem', borderRadius: '0.75rem', border: 'none',
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeTab === 'TEACHER' ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'transparent',
                color: activeTab === 'TEACHER' ? '#ffffff' : 'var(--color-muted)',
              }}
            >
              <Briefcase size={19} />
              Academic Faculty
            </button>
          </div>

          <div style={{ fontSize: '0.875rem', color: 'var(--color-muted)', fontWeight: 700 }}>
            {total} {activeTab === 'STUDENT' ? 'Students' : 'Faculty members'} registered
          </div>
        </div>

        {/* Search & Filters */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.35rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 420 }}>
            <Search size={17} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
            <input
              className="input-field"
              placeholder={activeTab === 'STUDENT' ? 'Search by name, email, roll number…' : 'Search by name, email, employee ID…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.6rem' }}
            />
          </div>

          <select
            className="input-field"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            style={{ maxWidth: 280 }}
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {/* Main Table */}
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{activeTab === 'STUDENT' ? 'Student Profile' : 'Faculty Member'}</th>
                <th>Department</th>
                <th>{activeTab === 'STUDENT' ? 'Roll Number' : 'Employee ID'}</th>
                <th>{activeTab === 'STUDENT' ? 'Biometric Vector Status' : 'Assigned Courses'}</th>
                <th>Account Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted)' }}>
                    Loading institutional directory…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted)' }}>
                    No {activeTab.toLowerCase()} records match filters. Click "Add {activeTab === 'STUDENT' ? 'Student' : 'Faculty'}" to register.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div
                          style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: activeTab === 'STUDENT' ? 'linear-gradient(135deg,#6366f1,#4338ca)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: '1rem', color: '#fff', flexShrink: 0,
                            overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            position: 'relative'
                          }}
                        >
                          {u.photoUrl ? (
                            <img src={u.photoUrl} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            u.name[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {u.name}
                            {u.photoUrl && <Sparkles size={13} color="var(--color-accent-light)" />}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>{u.department}</td>

                    <td>
                      <span
                        style={{
                          fontFamily: 'monospace', fontWeight: 800,
                          color: activeTab === 'STUDENT' ? 'var(--color-accent-light)' : '#c084fc',
                          background: activeTab === 'STUDENT' ? 'var(--color-accent-glow)' : 'rgba(139,92,246,0.12)',
                          padding: '0.3rem 0.7rem', borderRadius: '0.5rem', fontSize: '0.85rem',
                          border: '1px solid rgba(99,102,241,0.2)'
                        }}
                      >
                        {activeTab === 'STUDENT' ? u.rollNumber || '—' : u.employeeId || '—'}
                      </span>
                    </td>

                    <td>
                      {activeTab === 'STUDENT' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {u.photoUrl ? (
                            <span className="badge badge-present" style={{ fontSize: '0.725rem', gap: '0.3rem' }}>
                              <Camera size={12} /> Biometrics Synced
                            </span>
                          ) : (
                            <span className="badge badge-absent" style={{ fontSize: '0.725rem', gap: '0.3rem' }}>
                              <ShieldAlert size={12} /> Photo Needed
                            </span>
                          )}
                          <label style={{ cursor: 'pointer' }}>
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => e.target.files[0] && handlePhotoUpload(u._id, e.target.files[0])}
                            />
                            <span className="btn-ghost btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.725rem' }} title="Upload face image to Cloudinary">
                              <Upload size={12} /> {u.photoUrl ? 'Replace' : 'Upload'}
                            </span>
                          </label>
                          {u.photoUrl && (
                            <button
                              onClick={() => handleRemovePhoto(u)}
                              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.1rem' }}
                              title="Delete photo from Cloudinary"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {u.assignedClasses && u.assignedClasses.length > 0 ? (
                            u.assignedClasses.map((cls) => (
                              <span
                                key={cls._id}
                                style={{
                                  fontSize: '0.75rem', padding: '0.2rem 0.55rem',
                                  background: 'var(--color-surface2)', borderRadius: '0.4rem',
                                  color: 'var(--color-text)', border: '1px solid var(--color-border)',
                                }}
                              >
                                {cls.classId}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Unassigned</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td>
                      <span className={`badge ${u.isActive ? 'badge-present' : 'badge-absent'}`}>
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => handleOpenEdit(u)}
                          title="Edit User & Password"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => handleToggleActive(u)}
                          title={u.isActive ? 'Deactivate Account' : 'Activate Account'}
                        >
                          {u.isActive ? <ToggleRight size={17} color="var(--color-success)" /> : <ToggleLeft size={17} color="var(--color-muted)" />}
                        </button>
                        <button
                          className="btn-danger btn-sm"
                          onClick={() => confirmDeleteUser(u)}
                          title="Delete User (Cascading Purge)"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Cascading User Delete Confirmation Modal */}
        {userToDelete && (
          <Modal title={`Cascading Purge Confirmation: ${userToDelete.name}`} onClose={() => setUserToDelete(null)} maxWidth={500}>
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
                  <strong style={{ color: 'var(--color-danger)', fontSize: '0.98rem' }}>
                    Permanently delete "{userToDelete.name}" ({userToDelete.role})?
                  </strong>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.825rem', color: 'var(--color-muted)' }}>
                    This operation will trigger <strong>100% cascading cleanup</strong>:
                  </p>
                  <ul style={{ marginTop: '0.4rem', paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    <li>Delete photo image from Cloudinary cloud storage</li>
                    <li>Unenroll student from all active class rosters</li>
                    <li>Delete all attendance logs for this student</li>
                    <li>Un-index face vectors from Python ML <code>.pkl</code> database files</li>
                  </ul>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem' }}>
                <button
                  className="btn-danger"
                  onClick={handleExecuteDeleteUser}
                  disabled={deletingUser}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {deletingUser ? 'Purging Everything…' : 'Yes, Delete Everything'}
                </button>
                <button className="btn-ghost" onClick={() => setUserToDelete(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Full Database Purge Modal */}
        {showClearDbModal && (
          <Modal title="Confirm System Database Purge" onClose={() => setShowClearDbModal(false)} maxWidth={500}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  background: 'var(--color-danger-bg)', border: '1px solid rgba(244,63,94,0.3)',
                  borderRadius: '1rem', padding: '1.15rem', color: 'var(--color-text)',
                  fontSize: '0.875rem', lineHeight: 1.5, display: 'flex', gap: '0.85rem', alignItems: 'flex-start',
                }}
              >
                <AlertTriangle size={28} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong style={{ color: 'var(--color-danger)', fontSize: '0.98rem' }}>Wipe all campus operational data?</strong>
                  <p style={{ marginTop: '0.4rem', fontSize: '0.825rem', color: 'var(--color-muted)' }}>
                    This will perform a full reset:
                  </p>
                  <ul style={{ marginTop: '0.4rem', paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    <li>Destroy ALL user images stored in Cloudinary</li>
                    <li>Purge non-admin Students and Teachers from MongoDB</li>
                    <li>Delete all Class sections and Attendance history</li>
                    <li>Delete all Python ML <code>.pkl</code> vector files from disk</li>
                  </ul>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.85rem' }}>
                <button
                  className="btn-danger"
                  onClick={handleClearDatabase}
                  disabled={clearingDb}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {clearingDb ? 'Purging Campus Database…' : 'Purge All Campus Data'}
                </button>
                <button className="btn-ghost" onClick={() => setShowClearDbModal(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Create / Edit Modal */}
        {showModal && (
          <Modal
            title={editingUser ? `Edit ${form.role}: ${editingUser.name}` : `Register New ${form.role}`}
            onClose={() => setShowModal(false)}
            maxWidth={540}
          >
            {createdCredentials ? (
              <div
                style={{
                  background: 'var(--color-success-bg)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: '1rem', padding: '1.35rem', marginBottom: '1rem',
                }}
              >
                <div style={{ color: 'var(--color-success)', fontWeight: 800, fontSize: '1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Check size={20} /> Account Provisioned Successfully!
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
                  Share these login credentials with the user:
                </p>

                <div
                  style={{
                    background: 'var(--color-surface2)', borderRadius: '0.75rem',
                    padding: '1rem', fontFamily: 'monospace', fontSize: '0.875rem',
                    lineHeight: 1.6, color: 'var(--color-text)', border: '1px solid var(--color-border)',
                  }}
                >
                  <div><strong>Name:</strong> {createdCredentials.name}</div>
                  <div><strong>Email:</strong> {createdCredentials.email}</div>
                  <div><strong>Password:</strong> {createdCredentials.password}</div>
                  <div><strong>ID / Code:</strong> {createdCredentials.uniqueId}</div>
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', marginTop: '1.25rem' }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() =>
                      copyToClipboard(
                        `DigiCampus Credentials:\nRole: ${createdCredentials.role}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nID: ${createdCredentials.uniqueId}`
                      )
                    }
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? 'Copied!' : 'Copy Credentials'}
                  </button>
                  <button className="btn-ghost" onClick={() => setShowModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {formError && (
                  <div
                    style={{
                      background: 'var(--color-danger-bg)', border: '1px solid rgba(244,63,94,0.3)',
                      borderRadius: '0.75rem', padding: '0.75rem 1rem', color: 'var(--color-danger)',
                      fontSize: '0.875rem', fontWeight: 600
                    }}
                  >
                    {formError}
                  </div>
                )}

                {/* Role Switcher */}
                {!editingUser && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
                      Account Role
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, role: 'STUDENT' })}
                        style={{
                          padding: '0.65rem', borderRadius: '0.65rem',
                          border: form.role === 'STUDENT' ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                          background: form.role === 'STUDENT' ? 'var(--color-accent-glow)' : 'transparent',
                          color: form.role === 'STUDENT' ? 'var(--color-accent-light)' : 'var(--color-muted)',
                          fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        Enrolled Student
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, role: 'TEACHER' })}
                        style={{
                          padding: '0.65rem', borderRadius: '0.65rem',
                          border: form.role === 'TEACHER' ? '2px solid #8b5cf6' : '1px solid var(--color-border)',
                          background: form.role === 'TEACHER' ? 'rgba(139,92,246,0.15)' : 'transparent',
                          color: form.role === 'TEACHER' ? '#c084fc' : 'var(--color-muted)',
                          fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        Academic Faculty
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                    Full Name *
                  </label>
                  <input
                    className="input-field"
                    placeholder={form.role === 'STUDENT' ? 'e.g. Grace Hopper' : 'e.g. Prof. Alan Turing'}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {form.role === 'STUDENT' ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                        Roll Number *
                      </label>
                      <input
                        className="input-field"
                        placeholder="e.g. CS9867"
                        value={form.rollNumber}
                        onChange={(e) => setForm({ ...form, rollNumber: e.target.value })}
                        required={!editingUser}
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                        Employee ID / Code
                      </label>
                      <input
                        className="input-field"
                        placeholder="e.g. EMP-TCH-101"
                        value={form.employeeId}
                        onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                      Department *
                    </label>
                    <select
                      className="input-field"
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      required
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                    Email Address {editingUser ? '*' : '(Auto-generated if empty)'}
                  </label>
                  <input
                    className="input-field"
                    type="email"
                    placeholder="user@attendance.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required={!!editingUser}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                    Password {editingUser ? '(Leave blank to keep unchanged)' : '(Defaults to Roll No / Employee ID)'}
                  </label>
                  <input
                    className="input-field"
                    type="text"
                    placeholder={editingUser ? 'Enter new password if changing' : form.role === 'STUDENT' ? 'Defaults to Roll Number' : 'Defaults to Employee ID'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.85rem', marginTop: '0.75rem' }}>
                  <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                    {saving ? 'Saving…' : editingUser ? 'Update User' : `Register ${form.role}`}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </Modal>
        )}
      </main>
    </div>
  );
}
