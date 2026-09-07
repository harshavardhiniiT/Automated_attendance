import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';

/**
 * 7-second green PRESENT confirmation banner.
 * Props: student { name, rollNumber, department, confidence }
 *        onDismiss — called after 7 seconds
 */
export default function ConfirmationBanner({ student, onDismiss }) {
  const [remaining, setRemaining] = useState(7);

  // 🔊 Audio Voice Announcement via Web Speech API
  useEffect(() => {
    if (student?.name && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel(); // cancel any ongoing speech
        const speechText = `Attendance confirmed for ${student.name}`;
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch {}
    }
  }, [student]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(interval); onDismiss(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDismiss]);

  return (
    <div className="confirm-banner">
      <div className="confirm-banner-card pulse-glow">
        <div style={{ marginBottom: '1rem' }}>
          <CheckCircle size={64} color="#10b981" strokeWidth={1.5} />
        </div>
        <div style={{ fontSize: '0.85rem', color: '#6ee7b7', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
          ATTENDANCE CONFIRMED
        </div>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f1f5f9', fontFamily: 'Outfit, sans-serif', marginBottom: '0.25rem' }}>
          {student.name}
        </div>
        <div style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
          {student.rollNumber} · {student.department}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#10b981', marginBottom: '1.5rem' }}>
          ✅ PRESENT — {student.confidence > 1 ? Number(student.confidence).toFixed(1) : (Number(student.confidence) * 100).toFixed(1)}% confidence
        </div>

        {/* Countdown ring */}
        <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto' }}>
          <svg width="64" height="64" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(16,185,129,0.2)" strokeWidth="4" />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="#10b981"
              strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - remaining / 7)}`}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', color: '#10b981' }}>
            {remaining}
          </div>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#64748b' }}>
          Resetting for next student in {remaining}s…
        </div>
      </div>
    </div>
  );
}
