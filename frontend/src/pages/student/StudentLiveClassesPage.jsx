import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getLiveSessions } from '../../api/live';
import { subscribeSyncEvents, SYNC_EVENTS } from '../../utils/syncEvents';
import {
  isLiveNotificationMuted,
  toggleLiveNotificationMute,
  isSessionNotificationMuted,
  toggleMuteSession,
} from '../../components/CommunityToastNotifier';
import { toast } from '../../context/NotificationContext';
import { cleanDescription, parseSessionRecordingMetadata } from '../../utils/recordingResources';

function getEffectiveStatus(session) {
  if (!session) return 'upcoming';
  if (session.status === 'cancelled') return 'cancelled';
  if (session.status === 'completed') return 'completed';

  const now = new Date();
  const scheduledDate = new Date(session.scheduledAt);
  const endDate = session.endTime ? new Date(session.endTime) : null;

  // 1. If scheduled time has not arrived yet, it is always upcoming
  if (scheduledDate > now) {
    return 'upcoming';
  }

  // 2. If end time was set and has passed, it automatically becomes completed!
  if (endDate && endDate <= now) {
    return 'completed';
  }

  // 3. If scheduled time has arrived or passed, it is live until completed/cancelled
  return 'live';
}

export default function StudentLiveClassesPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveMuted, setLiveMuted] = useState(() => isLiveNotificationMuted());
  const [mutedSessions, setMutedSessions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('onetutor_muted_live_sessions') || '[]');
    } catch {
      return [];
    }
  });

  // Tick: forces re-render every 5s so status badges update based on current time
  const [, setTick] = useState(0);
  const tickRef = useRef(null);

  // Sync mute state across components and tabs
  useEffect(() => {
    function handleLiveMuteSync(e) {
      if (typeof e?.detail?.muted === 'boolean') {
        setLiveMuted(e.detail.muted);
      } else {
        setLiveMuted(isLiveNotificationMuted());
      }
    }
    function handleSessionMuteSync() {
      try {
        setMutedSessions(JSON.parse(localStorage.getItem('onetutor_muted_live_sessions') || '[]'));
      } catch {
        setMutedSessions([]);
      }
    }

    window.addEventListener('live-notifications-mute-toggle', handleLiveMuteSync);
    window.addEventListener('live-session-mute-toggle', handleSessionMuteSync);
    return () => {
      window.removeEventListener('live-notifications-mute-toggle', handleLiveMuteSync);
      window.removeEventListener('live-session-mute-toggle', handleSessionMuteSync);
    };
  }, []);

  const handleToggleGlobalLiveMute = () => {
    const nextMuted = toggleLiveNotificationMute();
    setLiveMuted(nextMuted);
    if (nextMuted) {
      toast.info('Live class notifications muted', { duration: 2500 });
    } else {
      toast.success('Live class notifications unmuted', { duration: 2500 });
    }
  };

  const handleToggleSessionMute = (sessionId, e) => {
    if (e) e.stopPropagation();
    const isNowMuted = toggleMuteSession(sessionId);
    setMutedSessions(prev => {
      const id = Number(sessionId);
      return isNowMuted ? [...prev.filter(x => x !== id), id] : prev.filter(x => x !== id);
    });
    if (isNowMuted) {
      toast.info('Alerts muted for this live class', { duration: 2000 });
    } else {
      toast.success('Alerts unmuted for this live class', { duration: 2000 });
    }
  };

  async function loadSessions(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const data = await getLiveSessions();
      if (Array.isArray(data)) {
        data.forEach(s => parseSessionRecordingMetadata(s));
      }
      setSessions(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions(true);

    // 1. Instant cross-tab sync when admin modifies live sessions
    const unsub = subscribeSyncEvents((event) => {
      if (event.type === SYNC_EVENTS.LIVE_SESSIONS_CHANGED) {
        loadSessions(false);
      }
    });

    // 2. Real-time time tick every 5s so statuses flip to LIVE automatically without refresh
    tickRef.current = setInterval(() => setTick(t => t + 1), 5_000);

    // 3. Background polling every 8s for multi-device/multi-browser updates
    const dataInterval = setInterval(() => loadSessions(false), 8_000);

    // 4. Auto-update when tab gains focus or becomes visible
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        loadSessions(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsub();
      clearInterval(tickRef.current);
      clearInterval(dataInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const upcomingSessions = sessions.filter(s => {
    const eff = getEffectiveStatus(s);
    return eff === 'upcoming' || eff === 'live';
  });

  return (
    <div className="ot-live-page">
      <div className="ot-live-container">
        {/* Header Title & Notification Button */}
        <div className="ot-live-header-wrap">
          <div>
            <h1 className="ot-live-title">
              Live <span style={{ color: '#5A70D3' }}>Classes</span>
            </h1>
            <p className="ot-live-subtitle">
              Participate in interactive live classroom sessions with industry tutors.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#5A70D3', marginBottom: '14px' }}></i>
            <div style={{ fontSize: '0.96rem', fontWeight: 600 }}>Loading live sessions schedule...</div>
          </div>
        ) : (
          /* Live & Upcoming Section */
          <section style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0b1f3a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444' }}>
                  <i className="fa-solid fa-tower-broadcast" style={{ fontSize: '1rem' }}></i>
                </span>
                <span>Live &amp; Upcoming</span>
              </h2>
            </div>

            {upcomingSessions.length === 0 ? (
              <div style={{ padding: '48px 24px', background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '18px', textAlign: 'center', color: '#64748b' }}>
                <i className="fa-solid fa-calendar-xmark" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px' }}></i>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0b1f3a' }}>No live classes scheduled right now</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Check back soon for new announcements!</p>
              </div>
            ) : (
              <div className="ot-live-grid">
                {upcomingSessions.map(s => {
                  const eff = getEffectiveStatus(s);
                  const cleanDesc = cleanDescription(s.description);
                  return (
                    <div
                      key={s.id}
                      className={`ot-live-card ${eff === 'live' ? 'is-live' : ''}`}
                    >
                      <div>
                        {/* Top Status and Course Meta Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {eff === 'live' ? (
                              <span className="ot-live-pill-live">
                                <i className="fa-solid fa-bolt"></i> LIVE NOW
                              </span>
                            ) : (
                              <span className="ot-live-pill-upcoming">
                                <i className="fa-regular fa-clock"></i> UPCOMING
                              </span>
                            )}
                            {s.enrolled ? (
                              <span style={{ fontSize: '0.74rem', color: '#5A70D3', background: 'rgba(90, 112, 211, 0.08)', padding: '3px 8px', borderRadius: '9999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-circle-check"></i> Enrolled
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.74rem', color: '#b45309', background: '#fef3c7', padding: '3px 8px', borderRadius: '9999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-lock"></i> Requires Enrollment
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 700 }}>
                              {s.courseName}
                            </span>
                            {s.batchName ? (
                              <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0284c7', padding: '3px 8px', borderRadius: '9999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <i className="fa-solid fa-users"></i>
                                {s.batchName}{s.batchCode ? ` • ${s.batchCode}` : ''}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <h3 style={{ fontSize: '1.22rem', fontWeight: 800, color: '#0b1f3a', marginBottom: '8px', lineHeight: 1.3 }}>
                          {s.title}
                        </h3>

                        {cleanDesc && (
                          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, marginBottom: '16px' }}>
                            {cleanDesc}
                          </p>
                        )}

                        <div style={{ fontSize: '0.85rem', color: '#334155', background: '#f8fafc', border: '1px solid #edf2f7', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-regular fa-calendar" style={{ color: '#5A70D3' }}></i>
                            <span><strong>Scheduled:</strong> {new Date(s.scheduledAt).toLocaleString()}</span>
                          </div>
                          {s.endTime && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                              <i className="fa-regular fa-clock" style={{ color: '#5A70D3' }}></i>
                              <span><strong>Ends:</strong> {new Date(s.endTime).toLocaleTimeString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        {s.enrolled ? (
                          <Link
                            to={`/student/live-classroom/${s.id}`}
                            className={`ot-live-btn-primary ${eff === 'live' ? 'live-pulse' : ''}`}
                          >
                            <i className={`fa-solid ${eff === 'live' ? 'fa-bolt' : 'fa-video'}`}></i>
                            <span>{eff === 'live' ? 'Join Live Classroom Now' : 'Enter Live Classroom'}</span>
                          </Link>
                        ) : (
                          <Link
                            to={`/student/courses/${s.courseId}`}
                            className="ot-live-btn-secondary"
                            title="Enroll in this course to join the live session"
                          >
                            <i className="fa-solid fa-lock" style={{ color: '#ef4444' }}></i>
                            <span>{s.batchName ? `Enroll in ${s.batchName} to Access` : 'Enroll to Access Live Class'}</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
