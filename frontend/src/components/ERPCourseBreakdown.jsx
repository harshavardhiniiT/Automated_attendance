import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Calendar, CheckCircle2, Clock, Award, FileText, Check, X, ShieldCheck, Filter } from 'lucide-react';
import api from '../api/axios';

const ACADEMIC_TERMS = [
  'AY 2026-2027 ODD (SEM III,V,VII,IX)',
  'AY 2026-2027 EVEN (SEM II,IV,VI,VIII)',
  'AY 2025-2026 ODD (SEM I,III,V,VII)',
  'AY 2025-2026 EVEN (SEM II,IV,VI,VIII)',
];

export default function ERPCourseBreakdown({ studentId }) {
  const [selectedTerm, setSelectedTerm] = useState(ACADEMIC_TERMS[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [activeTab, setActiveTab] = useState('ATTENDANCE'); // 'ATTENDANCE' | 'EXCEPTION'

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const url = `/attendance/course-summary?term=${encodeURIComponent(selectedTerm)}${studentId ? `&studentId=${studentId}` : ''}`;
      const res = await api.get(url);
      setData(res.data);
    } catch (err) {
      console.error('Error loading course summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedTerm, studentId]);

  const toggleCourse = (courseId) => {
    setExpandedCourseId(prev => (prev === courseId ? null : courseId));
  };

  const pct = data?.overallPercentage || 0;
  const strokeDashoffset = 283 - (283 * Math.min(pct, 100)) / 100;

  return (
    <div className="glass glow-card" style={{ padding: '1.75rem', marginBottom: '2.25rem' }}>
      {/* Top Header Tabs & Term Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', borderBottom: '2px solid var(--color-border)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <button
            onClick={() => setActiveTab('ATTENDANCE')}
            style={{
              background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: 800,
              color: activeTab === 'ATTENDANCE' ? 'var(--color-danger, #f43f5e)' : 'var(--color-muted)',
              borderBottom: activeTab === 'ATTENDANCE' ? '3px solid var(--color-danger, #f43f5e)' : 'none',
              paddingBottom: '0.4rem', cursor: 'pointer', fontFamily: 'Outfit, sans-serif'
            }}
          >
            Attendance Records
          </button>
          <button
            onClick={() => setActiveTab('EXCEPTION')}
            style={{
              background: 'none', border: 'none', fontSize: '1.1rem', fontWeight: 800,
              color: activeTab === 'EXCEPTION' ? 'var(--color-danger, #f43f5e)' : 'var(--color-muted)',
              borderBottom: activeTab === 'EXCEPTION' ? '3px solid var(--color-danger, #f43f5e)' : 'none',
              paddingBottom: '0.4rem', cursor: 'pointer', fontFamily: 'Outfit, sans-serif'
            }}
          >
            Request Exception / OD
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>Term</span>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="input-field"
            style={{
              border: '1.5px solid rgba(244,63,94,0.4)',
              color: 'var(--color-danger, #f43f5e)',
              fontWeight: 700,
              padding: '0.45rem 1rem',
              borderRadius: '0.65rem',
              maxWidth: 320
            }}
          >
            {ACADEMIC_TERMS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {activeTab === 'ATTENDANCE' ? (
        loading ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--color-muted)' }}>Loading academic course telemetry…</div>
        ) : (
          <>
            {/* Donut Chart & Telemetry Summary Block */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3.5rem',
              marginBottom: '2.5rem', padding: '1.5rem', borderRadius: '1.25rem',
              background: 'var(--color-surface2, rgba(255,255,255,0.02))',
              border: '1px solid var(--color-border)', flexWrap: 'wrap'
            }}>
              {/* Donut Gauge */}
              <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="140" height="140" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(244,63,94,0.25)" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="45" fill="none" stroke="#60a5fa" strokeWidth="10"
                    strokeDasharray="283" strokeDashoffset={strokeDashoffset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'Outfit, sans-serif' }}>
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Total Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.8rem 1.75rem', fontSize: '0.95rem', fontWeight: 700 }}>
                <span style={{ color: 'var(--color-text)' }}>Total Sessions</span>
                <span style={{ color: 'var(--color-text)', fontFamily: 'monospace', fontSize: '1.1rem' }}>{data?.totalSessions || 0}</span>

                <span style={{ color: 'var(--color-text)' }}>Present</span>
                <span style={{ color: '#60a5fa', fontFamily: 'monospace', fontSize: '1.1rem' }}>{data?.present || 0}</span>

                <span style={{ color: 'var(--color-text)' }}>Absent</span>
                <span style={{ color: 'var(--color-danger, #f43f5e)', fontFamily: 'monospace', fontSize: '1.1rem' }}>{data?.absent || 0}</span>
              </div>
            </div>

            {/* Course Breakdown Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {/* Header Row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 40px',
                padding: '0.85rem 1.25rem', borderRadius: '0.75rem', background: '#e5e7eb',
                color: '#374151', fontWeight: 800, fontSize: '0.85rem'
              }}>
                <span>Course Name</span>
                <span style={{ textAlign: 'center' }}>Attended</span>
                <span style={{ textAlign: 'center' }}>Scheduled</span>
                <span style={{ textAlign: 'center' }}>Percentage</span>
                <span></span>
              </div>

              {/* Course Accordion Items */}
              {data?.courses?.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>No registered courses found for this term.</div>
              ) : (
                data?.courses?.map((course) => {
                  const isExpanded = expandedCourseId === course._id;
                  return (
                    <div key={course._id} style={{
                      borderRadius: '0.85rem', border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)', overflow: 'hidden', transition: 'all 0.2s ease'
                    }}>
                      {/* Main Accordion Row */}
                      <div
                        onClick={() => toggleCourse(course._id)}
                        style={{
                          display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 40px',
                          padding: '1.1rem 1.25rem', alignItems: 'center', cursor: 'pointer',
                          background: isExpanded ? 'rgba(99,102,241,0.04)' : 'transparent'
                        }}
                      >
                        <div style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.95rem', fontFamily: 'Outfit, sans-serif' }}>
                          {course.className}
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 500, marginTop: '0.15rem' }}>
                            Code: {course.courseCode} · {course.semester}
                          </div>
                        </div>

                        <span style={{ textAlign: 'center', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'monospace' }}>
                          {course.attended}
                        </span>

                        <span style={{ textAlign: 'center', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'monospace' }}>
                          {course.scheduled}
                        </span>

                        <span style={{
                          textAlign: 'center', fontWeight: 800, fontFamily: 'monospace',
                          color: course.percentage >= 75 ? 'var(--color-success, #10b981)' : 'var(--color-danger, #f43f5e)'
                        }}>
                          {course.percentage.toFixed(2)}
                        </span>

                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          {isExpanded ? <ChevronUp size={18} color="var(--color-muted)" /> : <ChevronDown size={18} color="var(--color-muted)" />}
                        </div>
                      </div>

                      {/* Expanded Sessions Details Panel */}
                      {isExpanded && (
                        <div style={{ padding: '1.25rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface2)' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '1rem' }}>
                            Overall Attendance Breakdown
                          </div>

                          {/* Summary Status Pills */}
                          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                            <div style={{
                              padding: '0.6rem 1.2rem', borderRadius: '0.65rem', border: '1px solid rgba(16,185,129,0.3)',
                              background: 'rgba(16,185,129,0.08)', color: '#10b981', fontWeight: 800, fontSize: '0.85rem',
                              display: 'flex', gap: '1.5rem', justifyContent: 'space-between', flex: 1, minWidth: 160
                            }}>
                              <span>PRESENT (P)</span>
                              <span>{course.present}</span>
                            </div>

                            <div style={{
                              padding: '0.6rem 1.2rem', borderRadius: '0.65rem', border: '1px solid rgba(244,63,94,0.3)',
                              background: 'rgba(244,63,94,0.08)', color: '#f43f5e', fontWeight: 800, fontSize: '0.85rem',
                              display: 'flex', gap: '1.5rem', justifyContent: 'space-between', flex: 1, minWidth: 160
                            }}>
                              <span>ABSENT (A)</span>
                              <span>{course.absent}</span>
                            </div>

                            <div style={{
                              padding: '0.6rem 1.2rem', borderRadius: '0.65rem', border: '1px solid rgba(245,158,11,0.3)',
                              background: 'rgba(245,158,11,0.08)', color: '#f59e0b', fontWeight: 800, fontSize: '0.85rem',
                              display: 'flex', gap: '1.5rem', justifyContent: 'space-between', flex: 1, minWidth: 160
                            }}>
                              <span>ON DUTY (OD)</span>
                              <span>{course.od}</span>
                            </div>
                          </div>

                          {/* Session Table */}
                          <div className="data-table-container">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Date / Time</th>
                                  <th>Status (All)</th>
                                  <th style={{ textAlign: 'right' }}>Marked from (All)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {course.sessions.length === 0 ? (
                                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '1.5rem' }}>No individual sessions logged for this course yet.</td></tr>
                                ) : (
                                  course.sessions.map((s) => (
                                    <tr key={s._id}>
                                      <td style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.85rem' }}>
                                        {s.date} {s.time}
                                      </td>
                                      <td>
                                        <span style={{
                                          fontWeight: 800, fontSize: '0.85rem',
                                          color: s.status === 'PRESENT' ? '#10b981' : s.status === 'ON_DUTY' ? '#f59e0b' : '#f43f5e'
                                        }}>
                                          {s.status === 'PRESENT' ? 'PRESENT (P)' : s.status === 'ON_DUTY' ? 'ON DUTY (OD)' : 'ABSENT (A)'}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: 'right', fontSize: '0.825rem', color: 'var(--color-muted)', fontWeight: 600 }}>
                                        📅 {s.markedFrom}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )
      ) : (
        <div style={{ padding: '2rem 0', color: 'var(--color-muted)', textAlign: 'center' }}>
          Select an OD or Exception category to submit formal college attendance exception requests.
        </div>
      )}
    </div>
  );
}
