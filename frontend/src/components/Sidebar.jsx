import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, ClipboardList,
  Video, BarChart2, LogOut, ChevronRight,
  Brain, Sparkles, Calendar, Award, Clock, History
} from 'lucide-react';

const adminLinks = [
  { icon: LayoutDashboard, label: 'Dashboard Control', path: '/admin' },
  { icon: BookOpen,        label: 'Manage Classes',   path: '/admin/classes' },
  { icon: Users,           label: 'Manage Users',     path: '/admin/users' },
  { icon: ClipboardList,   label: 'Global History',   path: '/admin/attendance' },
  { icon: BarChart2,       label: 'Analytics Reports', path: '/admin/reports' },
];

const teacherLinks = [
  { icon: LayoutDashboard, label: 'Dashboard Hub',    path: '/teacher' },
  { icon: Video,           label: 'Live AI Camera',   path: '/teacher/live' },
  { icon: ClipboardList,   label: 'Class Roster',     path: '/teacher/attendance' },
  { icon: BarChart2,       label: 'Course Reports',   path: '/teacher/reports' },
];

const studentLinks = [
  { icon: LayoutDashboard, label: 'Dashboard',        path: '/student' },
  { icon: History,         label: 'Attendance History', path: '/student/attendance' },
];

const linksByRole = { ADMIN: adminLinks, TEACHER: teacherLinks, STUDENT: studentLinks };

const roleBadgeColors = {
  ADMIN: '#c084fc',
  TEACHER: '#818cf8',
  STUDENT: '#38bdf8',
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const links = linksByRole[user?.role] || [];

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className="sidebar">
      {/* Brand Logo */}
      <div
        onClick={() => navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.85rem',
          marginBottom: '2.25rem', padding: '0 0.4rem', cursor: 'pointer'
        }}
      >
        <div style={{
          width: 44, height: 44,
          background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          borderRadius: '1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(99,102,241,0.4)',
          position: 'relative'
        }}>
          <Brain size={24} color="white" />
        </div>
        <div>
          <div style={{
            fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem',
            color: 'var(--color-text)', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', gap: '0.35rem'
          }}>
            DigiCampus
          </div>
          <div style={{ fontSize: '0.725rem', color: 'var(--color-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Sparkles size={11} color="var(--color-accent-light)" /> Smart ERP v2.0
          </div>
        </div>
      </div>

      {/* User Info Profile Card */}
      <div style={{
        background: 'var(--color-surface2)',
        border: '1px solid var(--color-border)',
        borderRadius: '1rem',
        padding: '0.95rem',
        marginBottom: '1.75rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1.05rem', color: 'white', flexShrink: 0,
            overflow: 'hidden', border: '2px solid rgba(255,255,255,0.15)',
            boxShadow: '0 4px 12px rgba(99,102,241,0.25)'
          }}>
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (user?.name?.[0] || '?').toUpperCase()
            )}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{
              fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {user?.name}
            </div>
            <div style={{
              fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em',
              color: roleBadgeColors[user?.role] || 'var(--color-accent-light)', marginTop: '0.1rem'
            }}>
              {user?.role}
            </div>
          </div>
        </div>
        {user?.department && (
          <div style={{
            fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.6rem',
            paddingLeft: '0.25rem', borderTop: '1px dashed var(--color-border)', paddingTop: '0.45rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span>Dept:</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{user.department}</span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{
          fontSize: '0.675rem', fontWeight: 800, color: 'var(--color-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.6rem 0.4rem'
        }}>
          Main Menu
        </div>
        {links.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path || (path !== '/admin' && path !== '/teacher' && path !== '/student' && location.pathname.startsWith(path));
          return (
            <button
              key={label}
              className={`sidebar-link${active ? ' active' : ''}`}
              onClick={() => navigate(path)}
            >
              <Icon size={19} color={active ? 'var(--color-accent-light)' : 'var(--color-muted)'} />
              <span style={{ flex: 1, fontWeight: active ? 700 : 500 }}>{label}</span>
              {active && <ChevronRight size={15} color="var(--color-accent-light)" />}
            </button>
          );
        })}
      </nav>

      {/* Sign Out Button */}
      <button
        className="sidebar-link"
        onClick={handleLogout}
        style={{
          marginTop: '1.25rem', color: 'var(--color-danger)',
          borderTop: '1px solid var(--color-border)', paddingTop: '1.1rem',
          borderRadius: '0.75rem'
        }}
      >
        <LogOut size={19} />
        <span style={{ fontWeight: 600 }}>Sign Out</span>
      </button>
    </aside>
  );
}
