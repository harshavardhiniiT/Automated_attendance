import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Brain, Eye, EyeOff, AlertCircle, ShieldCheck, User, Lock, Sparkles, ArrowRight } from 'lucide-react';

const ROLE_REDIRECT = { ADMIN: '/admin', TEACHER: '/teacher', STUDENT: '/student' };

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login({ identifier: form.identifier, password: form.password });
      navigate(ROLE_REDIRECT[user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (identifier, password) => {
    setForm({ identifier, password });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #141b2d 0%, #090d16 100%)',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated Ambient Orbs */}
      <div className="orb-animated" style={{
        position: 'absolute', width: 550, height: 550, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
        top: '-15%', left: '-10%', pointerEvents: 'none'
      }} />
      <div className="orb-animated" style={{
        position: 'absolute', width: 450, height: 450, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)',
        bottom: '-10%', right: '-5%', pointerEvents: 'none', animationDelay: '-5s'
      }} />

      <div className="glass" style={{
        width: '100%', maxWidth: 450, padding: '2.75rem 2.25rem',
        boxShadow: '0 25px 60px -15px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)',
        position: 'relative', zIndex: 10
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 1.2rem',
            background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
            borderRadius: '1.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(99,102,241,0.45)',
          }}>
            <Brain size={32} color="white" />
          </div>
          <h1 style={{
            fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 800,
            color: 'var(--color-text)', marginBottom: '0.35rem', letterSpacing: '-0.03em'
          }}>
            DigiCampus
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
            AI Biometric Face Attendance System
          </p>
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
            borderRadius: '0.85rem', padding: '0.85rem 1rem', marginBottom: '1.5rem',
            fontSize: '0.85rem', color: '#fda4af', animation: 'fadeIn 0.2s ease'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.45rem' }}>
              Username / Roll No / Email
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="var(--color-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                id="identifier"
                type="text"
                className="input-field"
                placeholder="Enter username or email"
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                required
                autoFocus
                style={{ paddingLeft: '2.8rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.45rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--color-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className="input-field"
                placeholder="Enter password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                style={{ paddingLeft: '2.8rem', paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex'
                }}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%', justifyContent: 'center', padding: '0.85rem',
              marginTop: '0.5rem', fontSize: '0.95rem', borderRadius: '0.85rem'
            }}
          >
            {loading ? 'Authenticating...' : (
              <>
                <span>Sign In to Portal</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Fill Helper */}
        <div style={{
          marginTop: '2rem', padding: '1.1rem',
          background: 'var(--color-surface2)', borderRadius: '1rem',
          border: '1px solid var(--color-border)', fontSize: '0.78rem'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            color: 'var(--color-accent-light)', fontWeight: 800, marginBottom: '0.65rem'
          }}>
            <ShieldCheck size={16} /> QUICK DEMO LOGINS (CLICK TO FILL)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => handleQuickFill('admin@attendance.com', 'Admin@1234')}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.4rem 0.65rem', borderRadius: '0.5rem', background: 'var(--color-surface)',
                border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <span>👑 <b>Admin</b>: admin@attendance.com</span>
              <span className="badge badge-admin">Fill</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('TeacherName123', 'Password123')}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.4rem 0.65rem', borderRadius: '0.5rem', background: 'var(--color-surface)',
                border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <span>👨‍🏫 <b>Teacher</b>: TeacherName123</span>
              <span className="badge badge-teacher">Fill</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('21CS042', 'StudentPass123')}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.4rem 0.65rem', borderRadius: '0.5rem', background: 'var(--color-surface)',
                border: '1px solid var(--color-border)', color: 'var(--color-text)', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <span>🎓 <b>Student</b>: 21CS042</span>
              <span className="badge badge-student">Fill</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
