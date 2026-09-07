import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, maxWidth = 560 }) {
  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
