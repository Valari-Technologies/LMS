import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getCourse } from '../../api/courses';
import { myCourses } from '../../api/enrollment';
import { getCourseProgress } from '../../api/progress';
import { getLiveSessions, getCourseAttendance, rateRecording } from '../../api/live';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import { toast } from '../../context/NotificationContext';
import { subscribeSyncEvents, SYNC_EVENTS } from '../../utils/syncEvents';
import { useAuth } from '../../auth/AuthContext';
import RecordingVideoPlayer from '../../components/RecordingVideoPlayer';
import oneTutorBrandImg from '../../assets/images/oneTutorBrand.png';

function getLiveEffectiveStatus(session) {
  if (!session) return 'upcoming';
  if (session.status === 'cancelled') return 'cancelled';
  if (session.status === 'completed') return 'completed';
  const now = new Date();
  const scheduledDate = new Date(session.scheduledAt);
  const endDate = session.endTime ? new Date(session.endTime) : null;
  if (scheduledDate > now) return 'upcoming';
  if (endDate && endDate <= now) return 'completed';
  return 'live';
}

function renderStars(rating, max = 5) {
  const rounded = Math.round((rating || 0) * 10) / 10;
  const fullStars = Math.floor(rounded);
  const hasHalf = rounded - fullStars >= 0.4;
  const stars = [];

  for (let i = 1; i <= max; i++) {
    if (i <= fullStars) {
      stars.push(<i key={i} className="fa-solid fa-star" style={{ color: '#eab308' }} />);
    } else if (i === fullStars + 1 && hasHalf) {
      stars.push(<i key={i} className="fa-solid fa-star-half-stroke" style={{ color: '#eab308' }} />);
    } else {
      stars.push(<i key={i} className="fa-regular fa-star" style={{ color: '#cbd5e1' }} />);
    }
  }
  return stars;
}

export default function StudentCourseDashboardPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Default active tab is now 'dashboard' (internal home page setup removed)
  const activeTab = searchParams.get('tab') || 'dashboard';
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [progress, setProgress] = useState(null);
  const [liveSessions, setLiveSessions] = useState([]);
  const [attendance, setAttendance] = useState(null);

  // Video playback state for recordings (full video classes style)
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [videoPlayerTab, setVideoPlayerTab] = useState('overview'); // 'overview' | 'rating'

  // Rating modal state for recording classes
  const [ratingModalRecording, setRatingModalRecording] = useState(null);
  const [modalRating, setModalRating] = useState(5);
  const [modalComment, setModalComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  // Auto-refresh tick for live statuses
  const [, setTick] = useState(0);

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [courseRes, myCoursesRes, progressRes, liveRes, attRes] = await Promise.allSettled([
        getCourse(courseId),
        myCourses(),
        getCourseProgress(courseId),
        getLiveSessions(),
        getCourseAttendance(courseId)
      ]);

      if (courseRes.status === 'fulfilled') {
        setCourse(courseRes.value);
      }

      if (myCoursesRes.status === 'fulfilled' && Array.isArray(myCoursesRes.value)) {
        const matching = myCoursesRes.value.find(c => String(c.courseId) === String(courseId));
        setEnrollment(matching || null);
      }

      if (progressRes.status === 'fulfilled') {
        setProgress(progressRes.value);
      }

      if (liveRes.status === 'fulfilled') {
        setLiveSessions(liveRes.value || []);
      }

      if (attRes.status === 'fulfilled') {
        setAttendance(attRes.value);
      }
    } catch (err) {
      console.error('Failed to load course dashboard data:', err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);

    const unsub = subscribeSyncEvents((event) => {
      if (
        event.type === SYNC_EVENTS.LIVE_SESSIONS_CHANGED ||
        event.type === SYNC_EVENTS.ENROLLMENTS_CHANGED ||
        event.type === SYNC_EVENTS.PROGRESS_CHANGED
      ) {
        loadData(false);
      }
    });

    const interval = setInterval(() => setTick(t => t + 1), 5000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [courseId]);

  // Filter live sessions specifically for THIS course only
  const courseSessions = liveSessions.filter(s => String(s.courseId) === String(courseId));

  const upcomingSessions = courseSessions.filter(s => {
    const eff = getLiveEffectiveStatus(s);
    return eff === 'upcoming' || eff === 'live';
  });

  const liveActiveSessions = courseSessions.filter(s => getLiveEffectiveStatus(s) === 'live');
  const recordingSessions = courseSessions.filter(s => s.recordings && s.recordings.length > 0);

  // Flatten all recordings for this course into an ordered playlist
  const allRecordings = [];
  recordingSessions.forEach(s => {
    (s.recordings || []).forEach((r, rIdx) => {
      allRecordings.push({
        ...r,
        sessionId: s.id,
        sessionTitle: s.title,
        scheduledAt: s.scheduledAt,
        sessionDescription: s.description,
        batchName: s.batchName,
        recordingNumber: rIdx + 1,
        totalInSession: s.recordings.length,
        url: r.url || r.recordingUrl
      });
    });
  });

  const currentRecordingIndex = allRecordings.findIndex(r => String(r.id) === String(selectedRecording?.id));
  const hasPrevRecording = currentRecordingIndex > 0;
  const hasNextRecording = currentRecordingIndex >= 0 && currentRecordingIndex < allRecordings.length - 1;

  const playPrevRecording = () => {
    if (hasPrevRecording) {
      const prev = allRecordings[currentRecordingIndex - 1];
      setSelectedRecording({
        ...prev,
        url: prev.url,
        sessionTitle: prev.sessionTitle,
        courseName: course?.name || course?.title,
        description: prev.sessionDescription,
        subtitleUrl: prev.subtitleUrl || null
      });
    }
  };

  const playNextRecording = () => {
    if (hasNextRecording) {
      const next = allRecordings[currentRecordingIndex + 1];
      setSelectedRecording({
        ...next,
        url: next.url,
        sessionTitle: next.sessionTitle,
        courseName: course?.name || course?.title,
        description: next.sessionDescription,
        subtitleUrl: next.subtitleUrl || null
      });
    }
  };

  // Core metrics scoped strictly to this course:
  const upcomingLiveCount = upcomingSessions.length;
  const daysPresent = attendance?.attendedSessions ?? 0;
  const daysAbsent = attendance?.missedSessions ?? 0;
  const totalLiveClassSessions = attendance?.sessions?.length || courseSessions.length || 0;
  const totalHeldSessions = attendance?.totalSessions ?? 0;
  const attendancePercentage = attendance?.attendancePercentage ?? 100;

  // Calculate syllabus stats
  const totalLessons = (course?.sections || []).reduce((acc, sec) => acc + (sec.contents?.length || 0), 0);
  const completedLessons = (progress?.completedContentIds || []).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : (enrollment?.percentCompleted || 0);

  // Find next up lesson to resume
  let nextLesson = null;
  let nextSectionTitle = '';
  if (course?.sections) {
    for (const sec of course.sections) {
      for (const c of (sec.contents || [])) {
        if (!progress?.completedContentIds?.includes(c.id)) {
          nextLesson = c;
          nextSectionTitle = sec.title;
          break;
        }
      }
      if (nextLesson) break;
    }
    if (!nextLesson && course.sections[0]?.contents?.[0]) {
      nextLesson = course.sections[0].contents[0];
      nextSectionTitle = course.sections[0].title;
    }
  }

  // Open rating modal
  const handleOpenRatingModal = (recording, sessionTitle) => {
    setRatingModalRecording({ ...recording, sessionTitle });
    setModalRating(recording.userRating || 5);
    setModalComment(recording.userComment || '');
    setHoverRating(0);
  };

  // Submit rating
  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!ratingModalRecording) return;
    setSubmittingRating(true);
    try {
      await rateRecording(ratingModalRecording.id, {
        rating: modalRating,
        comment: modalComment.trim() || null
      });
      toast.success('Your rating for this recording class has been saved!');
      setRatingModalRecording(null);
      await loadData(false);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit rating';
      toast.error(msg);
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', background: '#0f172a', color: '#94a3b8' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2.4rem', color: '#5A70D3' }}></i>
        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#f8fafc', letterSpacing: '0.5px' }}>CONNECTING COURSE TERMINAL...</div>
      </div>
    );
  }

  const thumbUrl = resolveMediaUrl(course?.thumbnail || enrollment?.courseThumbnail || '');
  const batchLabel = enrollment?.batchName
    ? `${enrollment.batchName}${enrollment.batchCode ? ` • ${enrollment.batchCode}` : ''}`
    : 'Regular Batch';

  const isSessionLiveNow = liveActiveSessions.length > 0;

  // =========================================================================
  // VIEW MODE 1: DEDICATED FULL-WINDOW VIDEO CLASSES STYLE RECORDING PLAYER
  // When a student clicks to watch any recording replay, it opens the full
  // cinema video classroom layout matching the video classes style!
  // =========================================================================
  if (selectedRecording) {
    const curAvgRating = selectedRecording.averageRating ? Number(selectedRecording.averageRating) : 5.0;
    const curTotalRatings = selectedRecording.totalRatings || 0;
    const curUserRating = selectedRecording.userRating;

    return (
      <div style={{ minHeight: '100vh', background: '#0b1329', color: '#ffffff', display: 'flex', flexDirection: 'column' }}>
        {/* Top Video Classroom Header Bar */}
        <header style={{
          height: '64px',
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexShrink: 0,
          zIndex: 100
        }}>
          {/* Left: Back to Dashboard CTA + Brand + Course & Session Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setSelectedRecording(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.color = '#e2e8f0'; }}
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span>Exit to Dashboard</span>
            </button>

            <Link to="/" title="Home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <img src={oneTutorBrandImg} alt="OneTutor" style={{ height: '28px', objectFit: 'contain' }} />
            </Link>

            <div style={{ width: '1px', height: '22px', background: '#334155' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ fontSize: '0.84rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {course?.name || course?.title}
              </span>
              <span style={{ color: '#475569' }}>/</span>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>
                {selectedRecording.sessionTitle}
              </span>
              <span style={{ fontSize: '0.7rem', background: '#E8EBFA', color: '#5A70D3', padding: '2px 8px', borderRadius: '9999px', fontWeight: 800 }}>
                Recording Class
              </span>
            </div>
          </div>

          {/* Right: Rate Recording CTA + Subtitles Badge + Close Player */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {selectedRecording.subtitleUrl && (
              <span style={{ fontSize: '0.74rem', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '3px 9px', borderRadius: '9999px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <i className="fa-solid fa-closed-captioning"></i>
                <span>Subtitles Ready</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => handleOpenRatingModal(selectedRecording, selectedRecording.sessionTitle)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                background: 'rgba(234, 179, 8, 0.15)',
                color: '#facc15',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-star"></i>
              <span>{curUserRating ? `Rated ${curUserRating}★` : 'Rate Class'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedRecording(null)}
              title="Close Video Classroom"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        {/* Video Classroom Main Workspace (Split Stage & Playlist) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* Cinema Stage (Video Player + Controls + Session Details) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#0b1329' }}>
            
            {/* Main Video Screen */}
            <div style={{ background: '#000000', width: '100%', position: 'relative' }}>
              <div style={{ maxWidth: '1200px', margin: '0 auto', aspectRatio: '16/9', maxHeight: '72vh', background: '#000000' }}>
                <RecordingVideoPlayer
                  url={selectedRecording.url}
                  title={selectedRecording.sessionTitle}
                  courseName={selectedRecording.courseName}
                  subtitleUrl={selectedRecording.subtitleUrl}
                  autoPlay={true}
                  onClose={() => setSelectedRecording(null)}
                />
              </div>
            </div>

            {/* Below Video: Navigation Bar & Metadata Strip */}
            <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '20px 24px', boxSizing: 'border-box' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '16px',
                borderBottom: '1px solid #1e293b',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '14px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.74rem', background: 'rgba(90, 112, 211, 0.2)', color: '#93c5fd', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                      Session Recording #{currentRecordingIndex + 1}
                    </span>
                    {selectedRecording.scheduledAt && (
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        <i className="fa-regular fa-calendar" style={{ marginRight: '5px' }}></i>
                        {new Date(selectedRecording.scheduledAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                    {selectedRecording.sessionTitle}
                  </h1>
                </div>

                {/* Playlist Prev / Next Navigation Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={playPrevRecording}
                    disabled={!hasPrevRecording}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: hasPrevRecording ? '#1e293b' : 'rgba(30, 41, 59, 0.5)',
                      color: hasPrevRecording ? '#ffffff' : '#475569',
                      border: '1px solid #334155',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: hasPrevRecording ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-backward-step"></i>
                    <span>Prev Replay</span>
                  </button>

                  <button
                    type="button"
                    onClick={playNextRecording}
                    disabled={!hasNextRecording}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: hasNextRecording ? '#5A70D3' : 'rgba(90, 112, 211, 0.3)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: hasNextRecording ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>Next Replay</span>
                    <i className="fa-solid fa-forward-step"></i>
                  </button>
                </div>
              </div>

              {/* Sub-Tabs: Overview vs Rating & Feedback */}
              <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #1e293b', marginBottom: '18px' }}>
                <button
                  type="button"
                  onClick={() => setVideoPlayerTab('overview')}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: videoPlayerTab === 'overview' ? '2px solid #5A70D3' : '2px solid transparent',
                    color: videoPlayerTab === 'overview' ? '#ffffff' : '#94a3b8',
                    fontWeight: 800,
                    fontSize: '0.94rem',
                    padding: '8px 4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-circle-info"></i>
                  <span>Session Overview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVideoPlayerTab('rating')}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: videoPlayerTab === 'rating' ? '2px solid #eab308' : '2px solid transparent',
                    color: videoPlayerTab === 'rating' ? '#facc15' : '#94a3b8',
                    fontWeight: 800,
                    fontSize: '0.94rem',
                    padding: '8px 4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-star"></i>
                  <span>Rating &amp; Reviews ({curAvgRating.toFixed(1)}★)</span>
                </button>
              </div>

              {/* Tab 1: Overview */}
              {videoPlayerTab === 'overview' && (
                <div style={{ background: '#111827', borderRadius: '12px', padding: '20px', border: '1px solid #1f2937' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f9fafb', margin: '0 0 10px 0' }}>
                    About this Live Class Session
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                    {selectedRecording.description || selectedRecording.sessionDescription || 'Full live class replay covering hands-on demonstrations, architecture patterns, and student Q&A.'}
                  </p>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#9ca3af' }}>
                    <span><i className="fa-solid fa-users" style={{ color: '#5A70D3', marginRight: '6px' }}></i> Batch: {selectedRecording.batchName || batchLabel}</span>
                    <span><i className="fa-regular fa-clock" style={{ color: '#5A70D3', marginRight: '6px' }}></i> {selectedRecording.duration ? `${Math.round(selectedRecording.duration / 60)} minutes` : 'Full Length'}</span>
                    <span><i className="fa-solid fa-video" style={{ color: '#5A70D3', marginRight: '6px' }}></i> HD 1080p Stream</span>
                  </div>
                </div>
              )}

              {/* Tab 2: Rating & Reviews */}
              {videoPlayerTab === 'rating' && (
                <div style={{ background: '#111827', borderRadius: '12px', padding: '20px', border: '1px solid #1f2937' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#facc15', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{curAvgRating.toFixed(1)}</span>
                        <div style={{ display: 'flex', gap: '3px', fontSize: '1.1rem' }}>
                          {renderStars(curAvgRating)}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: '4px' }}>
                        Based on {curTotalRatings} {curTotalRatings === 1 ? 'student rating' : 'student ratings'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenRatingModal(selectedRecording, selectedRecording.sessionTitle)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        background: '#facc15',
                        color: '#0f172a',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className="fa-solid fa-star"></i>
                      <span>{curUserRating ? 'Edit Your Rating' : 'Rate this Recording Class'}</span>
                    </button>
                  </div>

                  {curUserRating && (
                    <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '10px', padding: '12px 16px', color: '#fef08a', fontSize: '0.86rem' }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: '6px', color: '#facc15' }}></i>
                      Your recorded rating for this class is <strong>{curUserRating}★</strong>.
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Right Sidebar: Recording Classes Playlist (Video Classes Style) */}
          <aside style={{
            width: '340px',
            background: '#0f172a',
            borderLeft: '1px solid #1e293b',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #1e293b' }}>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-list-ol" style={{ color: '#5A70D3' }}></i>
                <span>Course Recordings</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                {allRecordings.length} {allRecordings.length === 1 ? 'recorded replay' : 'recorded replays'} in this course
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {allRecordings.map((rec, idx) => {
                const isCurrent = String(rec.id) === String(selectedRecording?.id);
                const recRating = rec.averageRating ? Number(rec.averageRating) : 5.0;

                return (
                  <div
                    key={rec.id || idx}
                    onClick={() => {
                      setSelectedRecording({
                        ...rec,
                        url: rec.url,
                        sessionTitle: rec.sessionTitle,
                        courseName: course?.name || course?.title,
                        description: rec.sessionDescription,
                        subtitleUrl: rec.subtitleUrl || null
                      });
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      background: isCurrent ? 'rgba(90, 112, 211, 0.2)' : '#1e293b',
                      border: isCurrent ? '1px solid #5A70D3' : '1px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      if (!isCurrent) e.currentTarget.style.background = '#27354f';
                    }}
                    onMouseLeave={e => {
                      if (!isCurrent) e.currentTarget.style.background = '#1e293b';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isCurrent ? '#93c5fd' : '#94a3b8', textTransform: 'uppercase' }}>
                        Replay #{idx + 1}
                      </span>
                      {isCurrent && (
                        <span style={{ fontSize: '0.68rem', background: '#5A70D3', color: '#ffffff', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          NOW PLAYING
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: isCurrent ? '#ffffff' : '#e2e8f0', marginBottom: '6px', lineHeight: 1.3 }}>
                      {rec.sessionTitle}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: '#94a3b8' }}>
                      <span>
                        <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i>
                        {rec.duration ? `${Math.round(rec.duration / 60)}m` : 'Replay'}
                      </span>
                      <span style={{ color: '#facc15', fontWeight: 700 }}>
                        ★ {recRating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE 2: MAIN COURSE DASHBOARD SPACE (POS Style Single Navbar)
  // Arrow mark removed; Home button links to index page; Home tab setup removed.
  // =========================================================================
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      
      {/* ===================================================================
          1. SINGLE DEDICATED POS-STYLE COURSE NAVBAR (Sticky Top)
          - Left arrow mark REMOVED.
          - Home button redirects to index page ('/').
          - Internal home page setup REMOVED.
          =================================================================== */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: '#ffffff',
        borderBottom: '1px solid #cbd5e1',
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
        padding: '0 20px',
        height: '66px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px'
      }}>
        {/* Left: Brand Logo + Home (Moves to index page) + Divider + Course Name & Batch Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }} title="OneTutor Home">
            <img src={oneTutorBrandImg} alt="OneTutor" style={{ height: '32px', objectFit: 'contain' }} />
          </Link>

          {/* Click Home button moves to index page */}
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '9px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '0.86rem',
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              flexShrink: 0
            }}
            title="Go to Index / Home Page"
            onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#334155'; }}
          >
            <i className="fa-solid fa-house" style={{ fontSize: '0.82rem', color: '#5A70D3' }}></i>
            <span>Home</span>
          </Link>

          <div style={{ width: '1px', height: '24px', background: '#cbd5e1', flexShrink: 0 }} />

          {/* Course Name & Batch Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span
              style={{
                fontWeight: 800,
                fontSize: '0.96rem',
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '280px'
              }}
              title={course?.name || course?.title}
            >
              {course?.name || course?.title || 'Course Dashboard'}
            </span>
            <span style={{
              background: 'rgba(90, 112, 211, 0.12)',
              color: '#5A70D3',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '9999px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              {batchLabel}
            </span>
          </div>
        </div>

        {/* Center: POS Segmented Navigation Tabs:
            [ Dashboard ] [ Attendance ] [ Live Classes ] [ Recordings ]
            (Internal course home setup removed) */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          background: '#f8fafc',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid #cbd5e1',
          overflowX: 'auto',
          flexShrink: 0
        }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-chart-pie' },
            { id: 'attendance', label: 'Attendance', icon: 'fa-solid fa-calendar-check', badge: attendance ? `${attendancePercentage}%` : null },
            { id: 'live', label: 'Live Classes', icon: 'fa-solid fa-tower-broadcast', badge: isSessionLiveNow ? 'LIVE' : (upcomingLiveCount > 0 ? upcomingLiveCount : null), badgeColor: isSessionLiveNow ? '#ef4444' : null },
            { id: 'recordings', label: 'Recordings', icon: 'fa-solid fa-video', badge: recordingSessions.length > 0 ? recordingSessions.length : null }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: isActive ? '#0f172a' : 'transparent',
                  color: isActive ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '9px',
                  padding: '7px 16px',
                  fontSize: '0.86rem',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 2px 6px rgba(15, 23, 42, 0.25)' : 'none',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#e2e8f0';
                    e.currentTarget.style.color = '#0f172a';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                <i className={tab.icon} style={{ fontSize: '0.82rem', color: isActive ? '#93c5fd' : '#94a3b8' }}></i>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    background: isActive
                      ? (tab.badgeColor ? '#ef4444' : 'rgba(255, 255, 255, 0.2)')
                      : (tab.badgeColor ? '#fee2e2' : '#e2e8f0'),
                    color: isActive
                      ? '#ffffff'
                      : (tab.badgeColor ? '#ef4444' : '#0f172a')
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Community Chat + Resume CTA + User Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <Link
            to={`/student/community/${courseId}`}
            title="Course Community Chat"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '9px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; }}
          >
            <i className="fa-solid fa-comments" style={{ color: '#5A70D3' }}></i>
            <span style={{ display: 'inline' }}>Community</span>
          </Link>

          <button
            type="button"
            onClick={() => navigate(`/student/learn/${courseId}${nextLesson ? `?contentId=${nextLesson.id}` : ''}`)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 16px',
              borderRadius: '9px',
              background: '#5A70D3',
              color: '#ffffff',
              fontSize: '0.84rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(90, 112, 211, 0.3)',
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            <i className="fa-solid fa-play" style={{ fontSize: '0.74rem' }}></i>
            <span>Resume</span>
          </button>

          {/* User profile avatar */}
          {user && (
            <div
              title={`${user.name || user.email} (${user.role})`}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#0f172a',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #e2e8f0',
                cursor: 'pointer',
                flexShrink: 0
              }}
              onClick={() => navigate('/student/profile')}
            >
              {user.avatar ? (
                <img src={resolveMediaUrl(user.avatar)} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                (user.name || user.email || 'S').charAt(0).toUpperCase()
              )}
            </div>
          )}
        </div>
      </header>

      {/* ===================================================================
          2. MAIN POS WORKSPACE CONTENT
          =================================================================== */}
      <main style={{ flex: 1, maxWidth: '1360px', width: '100%', margin: '0 auto', padding: '24px 20px 60px 20px', boxSizing: 'border-box' }}>
        
        {/* ===================================================================
            TAB 1: DASHBOARD (Comprehensive Learning & Attendance Telemetry)
            Shows: Upcoming live class count, Days Present, Days Absent, Total Live Sessions,
            Course Progress, Attendance Standing, Attendance Breakdown Bar, Curriculum & Attendance Log.
            Scoped strictly to this separate course only!
            =================================================================== */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            
            {/* Dashboard Sub-Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa-solid fa-chart-pie" style={{ color: '#5A70D3' }}></i>
                  <span>Course Learning Dashboard</span>
                </h2>
                <div style={{ fontSize: '0.86rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span>Live session telemetry, attendance records, and syllabus progression</span>
                  <span style={{ fontSize: '0.74rem', background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700 }}>
                    <i className="fa-solid fa-shield-halved" style={{ marginRight: '4px' }}></i>
                    {course?.name || course?.title} Only
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('attendance')}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-calendar-check" style={{ color: '#10b981' }}></i>
                  <span>Detailed Attendance</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('live')}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-tower-broadcast" style={{ color: '#ef4444' }}></i>
                  <span>Live Calendar</span>
                </button>
              </div>
            </div>

            {/* 6 High-Utility POS KPI Telemetry Cards:
                1. Upcoming Live Classes Count
                2. Days Present
                3. Days Absent
                4. Total Live Class Sessions Count
                5. Course Progress %
                6. Attendance Standing % */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              
              {/* Metric 1: Upcoming Live Classes Count */}
              <div
                onClick={() => setActiveTab('live')}
                style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '18px 20px',
                  border: isSessionLiveNow ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  boxShadow: isSessionLiveNow ? '0 4px 18px rgba(239, 68, 68, 0.15)' : '0 2px 8px rgba(15, 23, 42, 0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Upcoming Live
                  </span>
                  <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: isSessionLiveNow ? '#fee2e2' : 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-tower-broadcast" style={{ fontSize: '0.84rem' }}></i>
                  </span>
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: isSessionLiveNow ? '#ef4444' : '#0f172a', lineHeight: 1.1, marginBottom: '4px' }}>
                  {isSessionLiveNow ? 'LIVE' : upcomingLiveCount}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{isSessionLiveNow ? 'Class in session' : 'Classes scheduled'}</span>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>Join →</span>
                </div>
              </div>

              {/* Metric 2: Days Present */}
              <div
                onClick={() => setActiveTab('attendance')}
                style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '18px 20px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#10b981'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Days Present
                  </span>
                  <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-user-check" style={{ fontSize: '0.84rem' }}></i>
                  </span>
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#10b981', lineHeight: 1.1, marginBottom: '4px' }}>
                  {daysPresent}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Verified attendance</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>Present</span>
                </div>
              </div>

              {/* Metric 3: Days Absent */}
              <div
                onClick={() => setActiveTab('attendance')}
                style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '18px 20px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Days Absent
                  </span>
                  <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-user-xmark" style={{ fontSize: '0.84rem' }}></i>
                  </span>
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: daysAbsent > 0 ? '#ef4444' : '#64748b', lineHeight: 1.1, marginBottom: '4px' }}>
                  {daysAbsent}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{daysAbsent === 0 ? 'No absences' : 'Missed sessions'}</span>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>{daysAbsent > 0 ? 'Absent' : 'Clean'}</span>
                </div>
              </div>

              {/* Metric 4: Total Live Class Sessions Count */}
              <div
                onClick={() => setActiveTab('live')}
                style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '18px 20px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#5A70D3'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Live Sessions
                  </span>
                  <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(90, 112, 211, 0.1)', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-layer-group" style={{ fontSize: '0.84rem' }}></i>
                  </span>
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1, marginBottom: '4px' }}>
                  {totalLiveClassSessions}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{totalHeldSessions} held • {upcomingLiveCount} upcoming</span>
                  <span style={{ color: '#5A70D3', fontWeight: 700 }}>Total</span>
                </div>
              </div>

              {/* Metric 5: Course Progress % */}
              <div
                onClick={() => {
                  const elem = document.getElementById('syllabus-section');
                  if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '18px 20px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#5A70D3'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Syllabus Progress
                  </span>
                  <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(90, 112, 211, 0.1)', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-chart-pie" style={{ fontSize: '0.84rem' }}></i>
                  </span>
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1, marginBottom: '4px' }}>
                  {progressPercent}%
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{completedLessons}/{totalLessons} lessons done</span>
                  <span style={{ color: '#5A70D3', fontWeight: 700 }}>Syllabus →</span>
                </div>
              </div>

              {/* Metric 6: Attendance Standing % */}
              <div
                onClick={() => setActiveTab('attendance')}
                style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '18px 20px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#10b981'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Attendance Rate
                  </span>
                  <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-award" style={{ fontSize: '0.84rem' }}></i>
                  </span>
                </div>
                <div style={{ fontSize: '1.9rem', fontWeight: 900, color: attendancePercentage >= 75 ? '#10b981' : '#ef4444', lineHeight: 1.1, marginBottom: '4px' }}>
                  {attendancePercentage}%
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{attendancePercentage >= 75 ? '🟢 Eligible' : '⚠️ Warning'}</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>Min 75%</span>
                </div>
              </div>
            </div>

            {/* Attendance Telemetry Ratio Bar (Visualizing Present, Absent, Upcoming for this course) */}
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '20px 24px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-chart-simple" style={{ color: '#5A70D3' }}></i>
                  <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a' }}>Live Session Attendance Ratio</span>
                  <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                    Separate Course Telemetry
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', fontWeight: 700 }}>
                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                    Present: {daysPresent}
                  </span>
                  <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                    Absent: {daysAbsent}
                  </span>
                  <span style={{ color: '#5A70D3', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#5A70D3', display: 'inline-block' }}></span>
                    Upcoming: {upcomingLiveCount}
                  </span>
                </div>
              </div>

              {/* Multi-segment ratio bar */}
              <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', display: 'flex' }}>
                {totalLiveClassSessions > 0 ? (
                  <>
                    <div style={{ width: `${(daysPresent / totalLiveClassSessions) * 100}%`, background: '#10b981', transition: 'width 0.3s ease' }} title={`Present: ${daysPresent}`} />
                    <div style={{ width: `${(daysAbsent / totalLiveClassSessions) * 100}%`, background: '#ef4444', transition: 'width 0.3s ease' }} title={`Absent: ${daysAbsent}`} />
                    <div style={{ width: `${(upcomingLiveCount / totalLiveClassSessions) * 100}%`, background: '#5A70D3', transition: 'width 0.3s ease' }} title={`Upcoming: ${upcomingLiveCount}`} />
                  </>
                ) : (
                  <div style={{ width: '100%', background: '#e2e8f0' }} />
                )}
              </div>
            </div>

            {/* Split Workstation Layout:
                Left Column: Curriculum Syllabus Tree
                Right Column: Resume Learning Hero Box & Course Attendance Log */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '22px' }}>
              
              {/* Left Column: Full Curriculum Syllabus Tree */}
              <div id="syllabus-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-list-check" style={{ color: '#5A70D3' }}></i>
                      <span>Curriculum Syllabus</span>
                    </h3>
                    <span style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 700, background: '#f8fafc', padding: '4px 12px', borderRadius: '9999px', border: '1px solid #e2e8f0' }}>
                      {completedLessons} / {totalLessons} lessons completed
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {(course?.sections || []).map((sec, sIdx) => {
                      const secCompleted = (sec.contents || []).filter(c => progress?.completedContentIds?.includes(c.id)).length;
                      const secTotal = sec.contents?.length || 0;
                      return (
                        <div key={sec.id || sIdx} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a' }}>
                              {sIdx + 1}. {sec.title}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#5A70D3', fontWeight: 800, background: 'rgba(90, 112, 211, 0.1)', padding: '2px 8px', borderRadius: '9999px' }}>
                              {secCompleted}/{secTotal} done
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {sec.contents?.map((c, cIdx) => {
                              const isDone = progress?.completedContentIds?.includes(c.id);
                              return (
                                <div
                                  key={c.id || cIdx}
                                  onClick={() => navigate(`/student/learn/${courseId}?contentId=${c.id}`)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s ease',
                                    background: isDone ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#eef2ff'}
                                  onMouseLeave={e => e.currentTarget.style.background = isDone ? 'rgba(16, 185, 129, 0.05)' : 'transparent'}
                                >
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isDone ? '#059669' : '#334155', fontWeight: isDone ? 700 : 500, fontSize: '0.88rem' }}>
                                    <i className={`fa-solid ${isDone ? 'fa-circle-check' : 'fa-circle-play'}`} style={{ fontSize: '0.86rem', color: isDone ? '#10b981' : '#5A70D3' }}></i>
                                    <span>{c.title}</span>
                                  </span>
                                  <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'capitalize' }}>
                                    {c.contentType || 'video'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Resume Learning Hero Box & Course Attendance Log */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {nextLesson && (
                  <div style={{
                    background: '#0f172a',
                    borderRadius: '16px',
                    padding: '24px',
                    color: '#ffffff',
                    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
                    border: '1px solid #1e293b'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      <i className="fa-solid fa-play"></i>
                      <span>Resume Learning</span>
                    </div>

                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: '#ffffff' }}>
                      {nextLesson.title}
                    </h3>

                    <p style={{ fontSize: '0.86rem', color: '#cbd5e1', margin: '0 0 18px 0', lineHeight: 1.45 }}>
                      {nextLesson.description || 'Watch the next curriculum video lesson to keep making progress.'}
                    </p>

                    <button
                      type="button"
                      onClick={() => navigate(`/student/learn/${courseId}?contentId=${nextLesson.id}`)}
                      style={{
                        background: '#5A70D3',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '11px 22px',
                        fontWeight: 800,
                        fontSize: '0.92rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(90, 112, 211, 0.4)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <i className="fa-solid fa-play"></i>
                      <span>Play Video Lesson</span>
                    </button>
                  </div>
                )}

                {/* Course Live Session Attendance Log (Strictly for THIS COURSE) */}
                <div style={{ background: '#ffffff', borderRadius: '16px', padding: '22px', border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-calendar-check" style={{ color: '#10b981' }}></i>
                        <span>Live Class Attendance Records</span>
                      </h3>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Attendance telemetry for this separate course only
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('attendance')}
                      style={{ background: 'none', border: 'none', color: '#5A70D3', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Full Details →
                    </button>
                  </div>

                  {(!attendance?.sessions || attendance.sessions.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '28px 12px', color: '#64748b', fontSize: '0.86rem' }}>
                      <i className="fa-regular fa-calendar" style={{ fontSize: '2rem', color: '#cbd5e1', marginBottom: '8px', display: 'block' }}></i>
                      No live class sessions held yet for this course.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {attendance.sessions.slice(0, 5).map((s, idx) => {
                        const isPresent = s.attendanceStatus === 'PRESENT';
                        const isUpcoming = s.attendanceStatus === 'UPCOMING';
                        return (
                          <div key={s.sessionId || idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: '#f8fafc',
                            border: '1px solid #edf2f7',
                            gap: '10px',
                            flexWrap: 'wrap'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: isPresent ? 'rgba(16, 185, 129, 0.12)' : (isUpcoming ? '#e0f2fe' : '#fee2e2'),
                                color: isPresent ? '#10b981' : (isUpcoming ? '#0284c7' : '#ef4444'),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.8rem',
                                flexShrink: 0
                              }}>
                                <i className={`fa-solid ${isPresent ? 'fa-check' : (isUpcoming ? 'fa-clock' : 'fa-xmark')}`}></i>
                              </span>
                              <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>{s.sessionTitle}</div>
                                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                  {s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : '—'}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '9999px',
                                background: isPresent ? 'rgba(16, 185, 129, 0.12)' : (isUpcoming ? '#e0f2fe' : '#fee2e2'),
                                color: isPresent ? '#10b981' : (isUpcoming ? '#0284c7' : '#ef4444')
                              }}>
                                {isPresent ? 'Present' : (isUpcoming ? 'Upcoming' : 'Absent')}
                              </span>
                              {isUpcoming ? (
                                <Link
                                  to={`/student/live-classroom/${s.sessionId}`}
                                  style={{ fontSize: '0.78rem', color: '#5A70D3', fontWeight: 700, textDecoration: 'none' }}
                                >
                                  Join →
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Watch in video classes style
                                    const matchingRec = allRecordings.find(r => r.sessionId === s.sessionId) || {
                                      id: s.sessionId,
                                      sessionTitle: s.sessionTitle,
                                      courseName: course?.name || course?.title,
                                      description: s.description,
                                      url: s.meetingUrl || '',
                                      subtitleUrl: null
                                    };
                                    setSelectedRecording(matchingRec);
                                  }}
                                  style={{ background: 'none', border: 'none', fontSize: '0.78rem', color: '#5A70D3', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Replay →
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recorded Replays Teaser */}
                <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px 22px', border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '0.94rem', color: '#0f172a' }}>
                      <i className="fa-solid fa-video" style={{ color: '#5A70D3' }}></i>
                      <span>Course Video Replays</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('recordings')}
                      style={{ background: 'none', border: 'none', color: '#5A70D3', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Watch &amp; Rate ({recordingSessions.length}) →
                    </button>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                    Stream full replays of live classes for this course in the video classes classroom player.
                  </p>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ===================================================================
            TAB 2: ATTENDANCE (Comprehensive History & Verification)
            =================================================================== */}
        {activeTab === 'attendance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* Top Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#ffffff', borderRadius: '14px', padding: '20px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Overall Attendance</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: attendancePercentage >= 75 ? '#10b981' : '#ef4444' }}>
                  {attendancePercentage}%
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  {attendancePercentage >= 75 ? '🟢 Meets eligibility criteria' : '⚠️ Below 75% target'}
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '14px', padding: '20px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Classes Held</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#0f172a' }}>
                  {totalHeldSessions}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Total scheduled live sessions held
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '14px', padding: '20px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Days Present</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#10b981' }}>
                  {daysPresent}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '4px' }}>
                  Verified presence recorded
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '14px', padding: '20px', border: '1px solid #cbd5e1', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)' }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Days Absent</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: daysAbsent > 0 ? '#ef4444' : '#64748b' }}>
                  {daysAbsent}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Replays available in Recordings
                </div>
              </div>
            </div>

            {/* Attendance History Table */}
            <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #cbd5e1', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
                    Live Session Attendance Records
                  </h3>
                  <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
                    Attendance is automatically recorded whenever you enter a live session classroom for this course.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 700 }}>
                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="fa-solid fa-circle-check"></i> Present
                  </span>
                  <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
                    <i className="fa-solid fa-circle-xmark"></i> Absent / Missed
                  </span>
                </div>
              </div>

              {(!attendance?.sessions || attendance.sessions.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
                  <i className="fa-regular fa-calendar-check" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px', display: 'block' }}></i>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#0f172a', fontWeight: 800 }}>No live class records yet</h4>
                  <p style={{ margin: 0, fontSize: '0.88rem' }}>Live class sessions for this batch will appear here once held.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '12px 14px' }}>Session Topic</th>
                        <th style={{ padding: '12px 14px' }}>Date &amp; Time</th>
                        <th style={{ padding: '12px 14px' }}>Status</th>
                        <th style={{ padding: '12px 14px' }}>Attended At</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.sessions.map((s, idx) => {
                        const isPresent = s.attendanceStatus === 'PRESENT';
                        const isUpcoming = s.attendanceStatus === 'UPCOMING';
                        return (
                          <tr key={s.sessionId || idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}>
                            <td style={{ padding: '14px', fontWeight: 700, color: '#0f172a' }}>
                              {s.sessionTitle}
                            </td>
                            <td style={{ padding: '14px', color: '#64748b' }}>
                              {s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : '—'}
                            </td>
                            <td style={{ padding: '14px' }}>
                              {isPresent ? (
                                <span style={{
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  color: '#10b981',
                                  padding: '4px 10px',
                                  borderRadius: '9999px',
                                  fontWeight: 800,
                                  fontSize: '0.76rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <i className="fa-solid fa-circle-check"></i> Present
                                </span>
                              ) : isUpcoming ? (
                                <span style={{
                                  background: '#e0f2fe',
                                  color: '#0284c7',
                                  padding: '4px 10px',
                                  borderRadius: '9999px',
                                  fontWeight: 700,
                                  fontSize: '0.76rem'
                                }}>
                                  Scheduled
                                </span>
                              ) : (
                                <span style={{
                                  background: '#fee2e2',
                                  color: '#ef4444',
                                  padding: '4px 10px',
                                  borderRadius: '9999px',
                                  fontWeight: 800,
                                  fontSize: '0.76rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <i className="fa-solid fa-circle-xmark"></i> Absent / Missed
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '14px', color: '#64748b' }}>
                              {s.attendedAt ? new Date(s.attendedAt).toLocaleTimeString() : '—'}
                            </td>
                            <td style={{ padding: '14px', textAlign: 'right' }}>
                              {isUpcoming ? (
                                <Link
                                  to={`/student/live-classroom/${s.sessionId}`}
                                  style={{ color: '#5A70D3', fontWeight: 700, textDecoration: 'none' }}
                                >
                                  Join Class
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Open in video classes style
                                    const matchingRec = allRecordings.find(r => r.sessionId === s.sessionId) || {
                                      id: s.sessionId,
                                      sessionTitle: s.sessionTitle,
                                      courseName: course?.name || course?.title,
                                      description: s.description,
                                      url: s.meetingUrl || '',
                                      subtitleUrl: null
                                    };
                                    setSelectedRecording(matchingRec);
                                  }}
                                  style={{ background: 'none', border: 'none', color: '#5A70D3', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Watch Recording →
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: LIVE CLASSES
            =================================================================== */}
        {activeTab === 'live' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-tower-broadcast" style={{ color: '#ef4444' }}></i>
                  <span>Live &amp; Upcoming Classes</span>
                </h2>
                <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                  Interactive live lectures scheduled for your batch. Enter classroom to participate with the tutor.
                </p>
              </div>
            </div>

            {upcomingSessions.length === 0 ? (
              <div style={{ background: '#ffffff', borderRadius: '16px', padding: '48px 24px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                <i className="fa-solid fa-calendar-xmark" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px', display: 'block' }}></i>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>No live classes currently scheduled</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Check back soon! Tutors post live classroom sessions before each scheduled module.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {upcomingSessions.map(s => {
                  const eff = getLiveEffectiveStatus(s);
                  const isLive = eff === 'live';
                  return (
                    <div
                      key={s.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        padding: '24px',
                        border: isLive ? '2px solid #ef4444' : '1px solid #cbd5e1',
                        boxShadow: isLive ? '0 8px 30px rgba(239, 68, 68, 0.15)' : '0 4px 16px rgba(15, 23, 42, 0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          {isLive ? (
                            <span style={{ background: '#fee2e2', color: '#ef4444', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa-solid fa-bolt"></i> LIVE NOW
                            </span>
                          ) : (
                            <span style={{ background: '#E8EBFA', color: '#5A70D3', padding: '4px 12px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa-regular fa-clock"></i> Upcoming Class
                            </span>
                          )}

                          {s.batchName && (
                            <span style={{ fontSize: '0.76rem', color: '#0284c7', background: '#e0f2fe', padding: '3px 8px', borderRadius: '9999px', fontWeight: 700 }}>
                              {s.batchName}
                            </span>
                          )}
                        </div>

                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px', lineHeight: 1.3 }}>
                          {s.title}
                        </h3>

                        {s.description && (
                          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.45, marginBottom: '16px' }}>
                            {s.description}
                          </p>
                        )}

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', marginBottom: '20px', fontSize: '0.84rem', color: '#334155' }}>
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

                      <Link
                        to={`/student/live-classroom/${s.id}`}
                        style={{
                          width: '100%',
                          height: '44px',
                          borderRadius: '10px',
                          background: isLive ? '#ef4444' : '#5A70D3',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.92rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          textDecoration: 'none',
                          boxShadow: isLive ? '0 4px 14px rgba(239, 68, 68, 0.4)' : '0 4px 14px rgba(90, 112, 211, 0.25)',
                          transition: 'all 0.18s ease'
                        }}
                      >
                        <i className={`fa-solid ${isLive ? 'fa-bolt' : 'fa-video'}`}></i>
                        <span>{isLive ? 'Join Live Classroom Now' : 'Enter Live Classroom'}</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 4: RECORDINGS (WITH 5-STAR RECORDING CLASS RATING FEATURE)
            =================================================================== */}
        {activeTab === 'recordings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-video" style={{ color: '#5A70D3' }}></i>
                  <span>Recorded Session Classes</span>
                </h2>
                <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                  Stream full HD replays with WebVTT English subtitles in the video classes player, and share your feedback by rating each recording class.
                </p>
              </div>
            </div>

            {recordingSessions.length === 0 ? (
              <div style={{ background: '#ffffff', borderRadius: '16px', padding: '48px 24px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                <i className="fa-solid fa-film" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px', display: 'block' }}></i>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>No session recordings available yet</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Recordings are processed and uploaded here after live classes conclude.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '22px' }}>
                {recordingSessions.map(s => {
                  return (
                    <div
                      key={s.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        padding: '24px',
                        border: '1px solid #cbd5e1',
                        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        {/* Session Date & Batch Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                            <i className="fa-regular fa-calendar" style={{ marginRight: '5px', color: '#5A70D3' }}></i>
                            {new Date(s.scheduledAt).toLocaleDateString()}
                          </span>

                          {s.batchName && (
                            <span style={{ fontSize: '0.74rem', background: '#E8EBFA', color: '#5A70D3', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700 }}>
                              {s.batchName}
                            </span>
                          )}
                        </div>

                        <h3 style={{ fontSize: '1.22rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px', lineHeight: 1.3 }}>
                          {s.title}
                        </h3>

                        {s.description && (
                          <p style={{ fontSize: '0.86rem', color: '#64748b', lineHeight: 1.45, marginBottom: '16px' }}>
                            {s.description}
                          </p>
                        )}
                      </div>

                      {/* Recordings List & Individual Rating for each Recording */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
                        {(s.recordings || []).map((r, rIdx) => {
                          const recUrl = r.url || r.recordingUrl;
                          const avgRating = r.averageRating ? Number(r.averageRating) : 5.0;
                          const totalRatings = r.totalRatings || 0;
                          const userRating = r.userRating;

                          return (
                            <div
                              key={r.id || rIdx}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '14px',
                                padding: '14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                              }}
                            >
                              {/* Recording Title / Meta Row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <i className="fa-solid fa-circle-play" style={{ color: '#5A70D3' }}></i>
                                  <span>Recording {s.recordings.length > 1 ? `#${rIdx + 1}` : 'Class'}</span>
                                  {r.duration ? <span style={{ color: '#64748b', fontWeight: 500, fontSize: '0.8rem' }}>({Math.round(r.duration / 60)} mins)</span> : null}
                                </span>

                                {r.subtitleUrl && (
                                  <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#16a34a', padding: '2px 7px', borderRadius: '9999px', fontWeight: 700 }}>
                                    <i className="fa-solid fa-closed-captioning" style={{ marginRight: '3px' }}></i> Subtitles Ready
                                  </span>
                                )}
                              </div>

                              {/* RATINGS ROW: Star Rating Display + Rate Class Button */}
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                padding: '8px 12px',
                                flexWrap: 'wrap',
                                gap: '8px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ display: 'flex', gap: '3px', fontSize: '0.88rem' }}>
                                    {renderStars(avgRating)}
                                  </div>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                                    {avgRating.toFixed(1)}
                                  </span>
                                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                    ({totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'})
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleOpenRatingModal(r, s.title)}
                                  style={{
                                    background: userRating ? '#E8EBFA' : 'rgba(234, 179, 8, 0.12)',
                                    color: userRating ? '#5A70D3' : '#b45309',
                                    border: userRating ? '1px solid rgba(90, 112, 211, 0.25)' : '1px solid rgba(234, 179, 8, 0.3)',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <i className="fa-solid fa-star" style={{ color: '#eab308' }}></i>
                                  <span>{userRating ? `Your Rating: ${userRating}★ (Edit)` : 'Rate Recording'}</span>
                                </button>
                              </div>

                              {/* Watch Recording Button (Launches Video Classes Style Player) */}
                              <button
                                type="button"
                                onClick={() => setSelectedRecording({
                                  ...r,
                                  id: r.id,
                                  url: recUrl,
                                  sessionTitle: s.title,
                                  courseName: course?.name || course?.title,
                                  description: s.description,
                                  subtitleUrl: r.subtitleUrl || null,
                                  scheduledAt: s.scheduledAt,
                                  batchName: s.batchName
                                })}
                                style={{
                                  height: '42px',
                                  borderRadius: '8px',
                                  background: '#5A70D3',
                                  color: '#ffffff',
                                  fontWeight: 800,
                                  fontSize: '0.88rem',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px',
                                  boxShadow: '0 2px 8px rgba(90, 112, 211, 0.25)',
                                  transition: 'all 0.18s ease'
                                }}
                              >
                                <i className="fa-solid fa-play" style={{ fontSize: '0.8rem' }}></i>
                                <span>Watch Class Replay</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ===================================================================
          3. RECORDING RATING MODAL DIALOG
          =================================================================== */}
      {ratingModalRecording && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setRatingModalRecording(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '480px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.25)',
              border: '1px solid #cbd5e1'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  <i className="fa-solid fa-star"></i>
                </span>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Rate Recording Class
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {ratingModalRecording.sessionTitle}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRatingModalRecording(null)}
                style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSubmitRating}>
              {/* Interactive Star Selector */}
              <div style={{ textAlign: 'center', margin: '20px 0 16px 0' }}>
                <div style={{ fontSize: '0.86rem', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>
                  How would you rate this recorded class session?
                </div>
                <div style={{ display: 'inline-flex', gap: '8px', fontSize: '2rem' }}>
                  {[1, 2, 3, 4, 5].map(star => {
                    const isFilled = star <= (hoverRating || modalRating);
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setModalRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', outline: 'none', transition: 'transform 0.12s ease' }}
                      >
                        <i className={`fa-${isFilled ? 'solid' : 'regular'} fa-star`} style={{ color: isFilled ? '#eab308' : '#cbd5e1' }} />
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontWeight: 800, color: '#ca8a04', marginTop: '6px', fontSize: '0.92rem' }}>
                  {modalRating === 5 ? '⭐⭐⭐⭐⭐ Exceptional (5 / 5)' :
                   modalRating === 4 ? '⭐⭐⭐⭐ Very Good (4 / 5)' :
                   modalRating === 3 ? '⭐⭐⭐ Good (3 / 5)' :
                   modalRating === 2 ? '⭐⭐ Fair (2 / 5)' : '⭐ Needs Improvement (1 / 5)'}
                </div>
              </div>

              {/* Review / Comment textarea */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Feedback / Notes for the Instructor (Optional):
                </label>
                <textarea
                  value={modalComment}
                  onChange={e => setModalComment(e.target.value)}
                  placeholder="Share what you found helpful in this session, or topics you would like revisited..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setRatingModalRecording(null)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submittingRating}
                  style={{
                    padding: '9px 24px',
                    borderRadius: '8px',
                    background: '#5A70D3',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    color: '#ffffff',
                    cursor: submittingRating ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(90, 112, 211, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {submittingRating ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-check"></i>
                      <span>Submit Rating</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
