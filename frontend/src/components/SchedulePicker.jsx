import { useState, useEffect } from 'react';
import { Calendar, Clock, Check, Sparkles } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SchedulePicker({ value, onChange }) {
  const [scheduleType, setScheduleType] = useState('RECURRING'); // 'RECURRING' | 'SPECIFIC_DATE' | 'CUSTOM'
  const [selectedDays, setSelectedDays] = useState(['Mon', 'Wed']);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');
  const [specificDate, setSpecificDate] = useState('');
  const [customText, setCustomText] = useState(value || '');

  // Convert 24h time string (e.g., "13:30") to clean 12h format ("1:30 PM")
  const format12h = (time24) => {
    if (!time24) return '';
    const parts = time24.split(':');
    if (parts.length < 2) return '';
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return '';
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const mStr = m < 10 ? `0${m}` : `${m}`;
    return `${h}:${mStr} ${period}`;
  };

  const toggleDay = (day) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    setSelectedDays(next);
  };

  useEffect(() => {
    let result = '';

    if (scheduleType === 'RECURRING') {
      const daysStr = selectedDays.length === 7 ? 'Daily' : selectedDays.length > 0 ? selectedDays.join(', ') : 'Days TBD';
      const startStr = format12h(startTime);
      const endStr = format12h(endTime);
      const timeStr = startStr && endStr ? `${startStr} - ${endStr}` : startStr || '';
      result = `${daysStr} • ${timeStr}`.trim();
    } else if (scheduleType === 'SPECIFIC_DATE') {
      const dateFormatted = specificDate ? new Date(specificDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD';
      const startStr = format12h(startTime);
      const endStr = format12h(endTime);
      const timeStr = startStr && endStr ? `${startStr} - ${endStr}` : startStr || '';
      result = `${dateFormatted} • ${timeStr}`.trim();
    } else if (scheduleType === 'CUSTOM') {
      result = customText;
    }

    if (onChange && result !== value) {
      onChange(result);
    }
  }, [scheduleType, selectedDays, startTime, endTime, specificDate, customText]);

  return (
    <div style={{
      background: 'var(--color-surface2, rgba(255,255,255,0.03))',
      border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
      borderRadius: '0.9rem',
      padding: '1.1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.95rem'
    }}>
      {/* Schedule Mode Selector */}
      <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(0,0,0,0.15)', padding: '0.3rem', borderRadius: '0.65rem' }}>
        <button
          type="button"
          onClick={() => setScheduleType('RECURRING')}
          style={{
            flex: 1, padding: '0.4rem 0.5rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '0.5rem', border: 'none',
            background: scheduleType === 'RECURRING' ? 'var(--color-accent-light, #6366f1)' : 'transparent',
            color: scheduleType === 'RECURRING' ? '#ffffff' : 'var(--color-muted, #94a3b8)', cursor: 'pointer'
          }}
        >
          🗓️ Weekly Schedule
        </button>
        <button
          type="button"
          onClick={() => setScheduleType('SPECIFIC_DATE')}
          style={{
            flex: 1, padding: '0.4rem 0.5rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '0.5rem', border: 'none',
            background: scheduleType === 'SPECIFIC_DATE' ? 'var(--color-accent-light, #6366f1)' : 'transparent',
            color: scheduleType === 'SPECIFIC_DATE' ? '#ffffff' : 'var(--color-muted, #94a3b8)', cursor: 'pointer'
          }}
        >
          📅 Specific Date
        </button>
        <button
          type="button"
          onClick={() => setScheduleType('CUSTOM')}
          style={{
            flex: 1, padding: '0.4rem 0.5rem', fontSize: '0.78rem', fontWeight: 700, borderRadius: '0.5rem', border: 'none',
            background: scheduleType === 'CUSTOM' ? 'var(--color-accent-light, #6366f1)' : 'transparent',
            color: scheduleType === 'CUSTOM' ? '#ffffff' : 'var(--color-muted, #94a3b8)', cursor: 'pointer'
          }}
        >
          ✏️ Custom / Flexible
        </button>
      </div>

      {/* MODE 1: RECURRING WEEKLY */}
      {scheduleType === 'RECURRING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
              Select Class Days
            </label>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {DAYS.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    style={{
                      padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '0.5rem',
                      border: isSelected ? '1px solid var(--color-accent-light, #6366f1)' : '1px solid var(--color-border, rgba(255,255,255,0.15))',
                      background: isSelected ? 'var(--color-accent-light, #6366f1)' : 'transparent',
                      color: isSelected ? '#ffffff' : 'var(--color-text, #e2e8f0)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.2rem'
                    }}
                  >
                    {isSelected && <Check size={12} />}
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>
                <Clock size={13} color="var(--color-accent-light, #6366f1)" /> Start Time
              </label>
              <input type="time" className="input-field" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>
                <Clock size={13} color="var(--color-accent-light, #6366f1)" /> End Time
              </label>
              <input type="time" className="input-field" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: SPECIFIC DATE */}
      {scheduleType === 'SPECIFIC_DATE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>
              <Calendar size={14} color="var(--color-accent-light, #6366f1)" /> Class Date *
            </label>
            <input type="date" className="input-field" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} style={{ width: '100%' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>
                <Clock size={13} color="var(--color-accent-light, #6366f1)" /> Start Time
              </label>
              <input type="time" className="input-field" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>
                <Clock size={13} color="var(--color-accent-light, #6366f1)" /> End Time
              </label>
              <input type="time" className="input-field" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: CUSTOM TEXT */}
      {scheduleType === 'CUSTOM' && (
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '0.3rem' }}>
            Enter Custom Schedule Text *
          </label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Mon/Wed/Fri 09:00 AM - 10:30 AM"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
          />
        </div>
      )}

      {/* Clean Schedule Output Display */}
      <div style={{ paddingTop: '0.5rem', borderTop: '1px dashed var(--color-border, rgba(255,255,255,0.1))' }}>
        <div style={{ fontSize: '0.725rem', color: 'var(--color-muted)', fontWeight: 600, marginBottom: '0.2rem' }}>
          Formated Schedule Summary:
        </div>
        <div style={{
          fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-accent-light, #818cf8)',
          fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '0.35rem'
        }}>
          <Sparkles size={14} color="var(--color-accent-light, #818cf8)" />
          {value || 'Please select days & time above'}
        </div>
      </div>
    </div>
  );
}
