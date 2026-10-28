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
import { resolveMediaUrl, VIDEO_QUALITY_OPTIONS, getQualityVideoUrl } from '../../utils/mediaUtils';
import RecordingVideoPlayer from '../../components/RecordingVideoPlayer';

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&enablejsapi=1` : null;
}

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
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [liveMuted, setLiveMuted] = useState(() => isLiveNotificationMuted());
  const [mutedSessions, setMutedSessions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('onetutor_muted_live_sessions') || '[]');
    } catch {
      return [];
    }
  });

  // Video quality adjustment & data saver mode
  const [videoQuality, setVideoQuality] = useState(() => {
    return localStorage.getItem('onetutor_video_quality') || 'high';
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
  // Any session with recordings belongs in Recorded Session Archives
  const pastSessions = sessions.filter(s => {
    return s.recordings && s.recordings.length > 0;
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
              Participate in interactive live sessions with industry tutors and stream recorded archives on demand.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#5A70D3', marginBottom: '14px' }}></i>
            <div style={{ fontSize: '0.96rem', fontWeight: 600 }}>Loading live sessions schedule...</div>
          </div>
        ) : (
          <>
            {/* Live & Upcoming Section */}
            <section style={{ marginBottom: '52px' }}>
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
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>Check back soon for new announcements or browse recorded archives below!</p>
                </div>
              ) : (
                <div className="ot-live-grid">
                  {upcomingSessions.map(s => {
                    const eff = getEffectiveStatus(s);
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

                          {s.description && (
                            <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, marginBottom: '16px' }}>
                              {s.description}
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

            {/* Recorded Session Archives Section */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(90, 112, 211, 0.08)', color: '#5A70D3' }}>
                  <i className="fa-solid fa-video" style={{ fontSize: '1rem' }}></i>
                </span>
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0b1f3a', margin: 0 }}>
                  Recorded Session Archives
                </h2>
              </div>

              {pastSessions.length === 0 ? (
                <div style={{ padding: '48px 24px', background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '18px', textAlign: 'center', color: '#64748b' }}>
                  <i className="fa-solid fa-film" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px' }}></i>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0b1f3a' }}>No session recordings available yet</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>Recorded live sessions will automatically appear here after completion.</p>
                </div>
              ) : (
                <div className="ot-live-grid">
                  {pastSessions.map(s => (
                    <div
                      key={s.id}
                      className="ot-live-card"
                    >
                      <div>
                        {s.courseName && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ fontSize: '0.8rem', color: '#5A70D3', background: 'rgba(90, 112, 211, 0.08)', padding: '3px 10px', borderRadius: '9999px', fontWeight: 700 }}>
                              {s.courseName}
                            </span>
                          </div>
                        )}

                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0b1f3a', marginBottom: '8px', lineHeight: 1.3 }}>
                          {s.title}
                        </h3>

                        {s.description && (
                          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5, marginBottom: '14px' }}>
                            {s.description}
                          </p>
                        )}

                        <div style={{ fontSize: '0.84rem', color: '#334155', background: '#f8fafc', border: '1px solid #edf2f7', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-regular fa-calendar" style={{ color: '#5A70D3' }}></i>
                            <span><strong>Held on:</strong> {new Date(s.scheduledAt).toLocaleString()}</span>
                          </div>
                          {s.endTime && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                              <i className="fa-regular fa-clock" style={{ color: '#5A70D3' }}></i>
                              <span><strong>Ended:</strong> {new Date(s.endTime).toLocaleTimeString()}</span>
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: '0.82rem', color: '#5A70D3', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          <i className="fa-solid fa-circle-check"></i>
                          <span>Missed this live session? Stream the full recorded replay below:</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(s.recordings || []).map((r, idx) => {
                          const recUrl = r.url || r.recordingUrl;
                          return (
                            <button
                              key={r.id || idx}
                              type="button"
                              className="ot-live-btn-primary"
                              onClick={() => setSelectedRecording({ ...r, url: recUrl, sessionTitle: s.title, courseName: s.courseName, description: s.description })}
                            >
                              <i className="fa-solid fa-play"></i>
                              <span>Watch Recording {s.recordings.length > 1 ? `#${idx + 1}` : ''} {r.duration ? `(${Math.round(r.duration / 60)} mins)` : ''}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Video Playback Modal Player */}
        {selectedRecording && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11, 31, 58, 0.75)',
              backdropFilter: 'blur(8px)',
              zIndex: 1500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setSelectedRecording(null)}
          >
            <div
              style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: '960px',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 25px 60px rgba(11, 31, 58, 0.25)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 22px', borderBottom: '1px solid #eef4f0', background: '#ffffff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(90, 112, 211, 0.08)', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem' }}>
                    <i className="fa-solid fa-play"></i>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.18rem', fontWeight: 800, margin: '0 0 2px 0', color: '#0b1f3a' }}>
                      {selectedRecording.sessionTitle}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedRecording.courseName && (
                        <span style={{ fontSize: '0.78rem', color: '#5A70D3', fontWeight: 700, background: 'rgba(90, 112, 211, 0.08)', padding: '2px 8px', borderRadius: '9999px' }}>
                          {selectedRecording.courseName}
                        </span>
                      )}
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Recorded Playback</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#f1f5f9',
                    border: 'none',
                    color: '#475569',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                  onClick={() => setSelectedRecording(null)}
                  aria-label="Close"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Course-Style Video Player for Recording Class */}
              <div style={{ background: '#000000', position: 'relative', width: '100%', overflow: 'hidden' }}>
                <RecordingVideoPlayer
                  url={selectedRecording.url}
                  title={selectedRecording.sessionTitle}
                  courseName={selectedRecording.courseName}
                  subtitleUrl={selectedRecording.subtitleUrl}
                  autoPlay={true}
                  onClose={() => setSelectedRecording(null)}
                />
              </div>

              {/* Description / Notes */}
              {selectedRecording.description && (
                <div style={{ padding: '14px 24px', color: '#334155', fontSize: '0.9rem', background: '#f8fafc', borderTop: '1px solid #eef4f0', lineHeight: 1.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0b1f3a', marginBottom: '4px', fontSize: '0.84rem' }}>
                    <i className="fa-regular fa-file-lines" style={{ color: '#5A70D3' }}></i>
                    <span>Session Notes:</span>
                  </div>
                  {selectedRecording.description}
                </div>
              )}

              {/* Modal Footer */}
              <div style={{ padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: '#ffffff', borderTop: '1px solid #eef4f0' }}>
                <button
                  type="button"
                  style={{
                    padding: '9px 24px',
                    borderRadius: '9999px',
                    background: '#5A70D3',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(90, 112, 211, 0.25)',
                    transition: 'all 0.18s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#007055'}
                  onMouseLeave={e => e.currentTarget.style.background = '#5A70D3'}
                  onClick={() => setSelectedRecording(null)}
                >
                  Close Player
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
