import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function ToastNotification({ message, type = 'info', onClose }) {
  if (!message) return null;

  const bgMap = {
    success: 'var(--color-success-bg)',
    danger: 'var(--color-danger-bg)',
    warning: 'var(--color-warning-bg)',
    info: 'var(--color-info-bg)',
  };

  const borderMap = {
    success: 'var(--color-success)',
    danger: 'var(--color-danger)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
  };

  const IconMap = {
    success: CheckCircle2,
    danger: AlertTriangle,
    warning: AlertTriangle,
    info: Info,
  };

  const Icon = IconMap[type] || Info;

  return (
    <div
      style={{
        position: 'fixed',
        top: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.85rem 1.2rem',
        borderRadius: '1rem',
        background: 'var(--color-surface)',
        border: `1px solid ${borderMap[type]}`,
        boxShadow: '0 12px 35px rgba(0, 0, 0, 0.25)',
        color: 'var(--color-text)',
        animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: '420px',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: bgMap[type],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={borderMap[type]} />
      </div>
      <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.35 }}>
        {message}
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-muted)',
          cursor: 'pointer',
          padding: '0.2rem',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
