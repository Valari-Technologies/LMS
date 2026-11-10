import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getCourse } from '../../api/courses';
import { myCourses } from '../../api/enrollment';
import { getCourseProgress } from '../../api/progress';
import { getLiveSessions, getCourseAttendance, rateRecording, checkInAttendance } from '../../api/live';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import { toast } from '../../context/NotificationContext';
import { subscribeSyncEvents, SYNC_EVENTS } from '../../utils/syncEvents';
import RecordingVideoPlayer from '../../components/RecordingVideoPlayer';

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

  // Video playback modal for recordings
  const [selectedRecording, setSelectedRecording] = useState(null);

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

  // Filter sessions specifically for this course and batch
  const courseSessions = liveSessions.filter(s => String(s.courseId) === String(courseId));

  const upcomingSessions = courseSessions.filter(s => {
    const eff = getLiveEffectiveStatus(s);
    return eff === 'upcoming' || eff === 'live';
  });

  const recordingSessions = courseSessions.filter(s => s.recordings && s.recordings.length > 0);

  // Calculate syllabus stats
  const totalLessons = (course?.sections || []).reduce((acc, sec) => acc + (sec.contents?.length || 0), 0);
  const completedLessons = (progress?.completedContentIds || []).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : (enrollment?.percentCompleted || 0);

  // Find next up lesson to resume
  let nextLesson = null;
  if (course?.sections) {
    for (const sec of course.sections) {
      for (const c of (sec.contents || [])) {
        if (!progress?.completedContentIds?.includes(c.id)) {
          nextLesson = c;
          break;
        }
      }
      if (nextLesson) break;
    }
    if (!nextLesson && course.sections[0]?.contents?.[0]) {
      nextLesson = course.sections[0].contents[0];
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
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: '#64748b' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2.4rem', color: '#5A70D3' }}></i>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0b1f3a' }}>Loading Course Space...</div>
      </div>
    );
  }

  const thumbUrl = resolveMediaUrl(course?.thumbnail || enrollment?.courseThumbnail || '');
  const batchLabel = enrollment?.batchName
    ? `${enrollment.batchName}${enrollment.batchCode ? ` • ${enrollment.batchCode}` : ''}`
    : 'Regular Batch';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '60px' }}>
      {/* ===================================================================
          1. TOP NAVIGATION & BREADCRUMB
          =================================================================== */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
            <Link to="/student/my-courses" style={{ color: '#5A70D3', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-arrow-left" style={{ fontSize: '0.82rem' }}></i>
              <span>My Learning</span>
            </Link>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ color: '#64748b', fontWeight: 600 }}>{course?.name || course?.title || 'Course Dashboard'}</span>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ color: '#0b1f3a', fontWeight: 700, textTransform: 'capitalize' }}>{activeTab}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link
              to={`/student/community/${courseId}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                background: 'rgba(90, 112, 211, 0.08)',
                color: '#5A70D3',
                fontSize: '0.84rem',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <i className="fa-solid fa-comments"></i>
              <span>Community Chat</span>
            </Link>

            <button
              onClick={() => navigate(`/student/learn/${courseId}`)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '8px',
                background: '#5A70D3',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(90, 112, 211, 0.25)',
                transition: 'all 0.18s ease'
              }}
            >
              <i className="fa-solid fa-play" style={{ fontSize: '0.72rem' }}></i>
              <span>Resume Learning</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 0 20px' }}>
        {/* ===================================================================
            2. COURSE HERO / HEADER SUMMARY CARD
            =================================================================== */}
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(11, 31, 58, 0.04)',
          border: '1px solid #e2e8f0',
          marginBottom: '24px',
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {thumbUrl && (
            <div style={{
              width: '160px',
              height: '100px',
              borderRadius: '14px',
              overflow: 'hidden',
              flexShrink: 0,
              background: '#0b1f3a',
              boxShadow: '0 4px 12px rgba(11, 31, 58, 0.12)'
            }}>
              <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{
                background: '#E8EBFA',
                color: '#5A70D3',
                fontSize: '0.74rem',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <i className="fa-solid fa-users" style={{ fontSize: '0.66rem' }}></i>
                {batchLabel}
              </span>

              {course?.category?.name && (
                <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.74rem', fontWeight: 700, padding: '3px 9px', borderRadius: '9999px' }}>
                  {course.category.name}
                </span>
              )}

              <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <i className="fa-solid fa-circle-check"></i> Enrolled
              </span>
            </div>

            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0b1f3a', margin: '0 0 6px 0', lineHeight: 1.25 }}>
              {course?.name || course?.title}
            </h1>

            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 14px 0', lineHeight: 1.4, maxWidth: '780px' }}>
              {course?.subtitle || course?.description?.substring(0, 140) || 'Master practical skills with instructor-led sessions, curriculum videos, and hands-on projects.'}
            </p>

            {/* Overall Progress Bar */}
            <div style={{ maxWidth: '420px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#0b1f3a', marginBottom: '5px' }}>
                <span>Course Progress</span>
                <span style={{ color: '#5A70D3' }}>{progressPercent}% completed</span>
              </div>
              <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #5A70D3, #788ced)', borderRadius: '9999px', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================
            3. MAIN NAVIGATION TABS (DASHBOARD, ATTENDANCE, LIVE CLASSES, RECORDINGS)
            =================================================================== */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '2px'
        }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-chart-pie' },
            { id: 'attendance', label: 'Attendance', icon: 'fa-solid fa-calendar-check', badge: attendance ? `${attendance.attendancePercentage}%` : null },
            { id: 'live', label: 'Live Classes', icon: 'fa-solid fa-tower-broadcast', badge: upcomingSessions.length > 0 ? upcomingSessions.length : null, badgeColor: '#ef4444' },
            { id: 'recordings', label: 'Recordings', icon: 'fa-solid fa-video', badge: recordingSessions.length > 0 ? recordingSessions.length : null }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '3px solid #5A70D3' : '3px solid transparent',
                  padding: '12px 18px',
                  color: isActive ? '#5A70D3' : '#64748b',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: '0.96rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  marginBottom: '-2px'
                }}
              >
                <i className={tab.icon} style={{ fontSize: '0.9rem', color: isActive ? '#5A70D3' : '#94a3b8' }}></i>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '9999px',
                    background: tab.badgeColor ? '#fee2e2' : 'rgba(90, 112, 211, 0.12)',
                    color: tab.badgeColor ? '#ef4444' : '#5A70D3'
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ===================================================================
            4. TAB CONTENT 1: DASHBOARD (OVERVIEW)
            =================================================================== */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Left Column: Continue Learning Card & Curriculum Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Continue / Next Lesson Card */}
              {nextLesson && (
                <div style={{
                  background: 'linear-gradient(135deg, #0b1f3a 0%, #1e3a8a 100%)',
                  borderRadius: '18px',
                  padding: '24px',
                  color: '#ffffff',
                  boxShadow: '0 8px 24px rgba(11, 31, 58, 0.15)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    <i className="fa-solid fa-play"></i>
                    <span>Next Video Lesson</span>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: '#ffffff' }}>
                    {nextLesson.title}
                  </h3>

                  <p style={{ fontSize: '0.88rem', color: '#cbd5e1', margin: '0 0 18px 0', lineHeight: 1.4 }}>
                    {nextLesson.description || 'Pick up right where you left off. Complete lessons to unlock milestones and certificates.'}
                  </p>

                  <button
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
                      transition: 'all 0.18s ease'
                    }}
                  >
                    <i className="fa-solid fa-play"></i>
                    <span>Play Video Lesson</span>
                  </button>
                </div>
              )}

              {/* Course Curriculum Summary */}
              <div style={{ background: '#ffffff', borderRadius: '18px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(11, 31, 58, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0b1f3a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-list-check" style={{ color: '#5A70D3' }}></i>
                    <span>Curriculum Syllabus</span>
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                    {completedLessons} / {totalLessons} lessons completed
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(course?.sections || []).map((sec, sIdx) => {
                    const secCompleted = (sec.contents || []).filter(c => progress?.completedContentIds?.includes(c.id)).length;
                    const secTotal = sec.contents?.length || 0;
                    return (
                      <div key={sec.id || sIdx} style={{ background: '#f8fafc', border: '1px solid #edf2f7', borderRadius: '12px', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0b1f3a' }}>
                            {sIdx + 1}. {sec.title}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#5A70D3', fontWeight: 700, background: 'rgba(90, 112, 211, 0.08)', padding: '2px 8px', borderRadius: '9999px' }}>
                            {secCompleted}/{secTotal} done
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
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
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#eef2ff'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: isDone ? '#10b981' : '#334155', fontWeight: isDone ? 600 : 500 }}>
                                  <i className={`fa-solid ${isDone ? 'fa-circle-check' : 'fa-circle-play'}`} style={{ fontSize: '0.82rem' }}></i>
                                  <span>{c.title}</span>
                                </span>
                                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{c.contentType}</span>
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

            {/* Right Column: Attendance Stat Cards & Quick Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Quick Attendance Snapshot */}
              <div style={{ background: '#ffffff', borderRadius: '18px', padding: '22px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(11, 31, 58, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0b1f3a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-user-check" style={{ color: '#10b981' }}></i>
                    <span>Live Class Attendance</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    style={{ background: 'none', border: 'none', color: '#5A70D3', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    View Details →
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #edf2f7' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    flexShrink: 0
                  }}>
                    {attendance?.attendancePercentage ?? 100}%
                  </div>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0b1f3a', marginBottom: '2px' }}>
                      {attendance?.attendedSessions ?? 0} of {attendance?.totalSessions ?? 0} Sessions Attended
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {(attendance?.attendancePercentage ?? 100) >= 75
                        ? '🟢 Excellent standing! Keep attending live classes.'
                        : '⚠️ Attendance is below 75%. Try attending upcoming classes.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Next Live Session Teaser */}
              <div style={{ background: '#ffffff', borderRadius: '18px', padding: '22px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(11, 31, 58, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0b1f3a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-tower-broadcast" style={{ color: '#ef4444' }}></i>
                    <span>Live Class Schedule</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('live')}
                    style={{ background: 'none', border: 'none', color: '#5A70D3', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    View Schedule →
                  </button>
                </div>

                {upcomingSessions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b', fontSize: '0.88rem' }}>
                    <i className="fa-regular fa-calendar-xmark" style={{ fontSize: '1.8rem', color: '#cbd5e1', marginBottom: '8px', display: 'block' }}></i>
                    No upcoming live classes right now for this batch.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {upcomingSessions.slice(0, 2).map(s => {
                      const eff = getLiveEffectiveStatus(s);
                      return (
                        <div key={s.id} style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '12px', border: '1px solid #edf2f7' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0b1f3a' }}>{s.title}</span>
                            {eff === 'live' ? (
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', background: '#fee2e2', padding: '2px 8px', borderRadius: '9999px' }}>
                                🔴 LIVE NOW
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#5A70D3', background: '#E8EBFA', padding: '2px 8px', borderRadius: '9999px' }}>
                                Upcoming
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '8px' }}>
                            <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i>
                            {new Date(s.scheduledAt).toLocaleString()}
                          </div>
                          <Link
                            to={`/student/live-classroom/${s.id}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              background: eff === 'live' ? '#ef4444' : '#5A70D3',
                              color: '#ffffff',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              textDecoration: 'none'
                            }}
                          >
                            <i className="fa-solid fa-video"></i>
                            <span>{eff === 'live' ? 'Join Now' : 'Enter Classroom'}</span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recorded Archive Quick Access */}
              <div style={{ background: '#ffffff', borderRadius: '18px', padding: '22px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(11, 31, 58, 0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0b1f3a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-video" style={{ color: '#5A70D3' }}></i>
                    <span>Recorded Replays</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('recordings')}
                    style={{ background: 'none', border: 'none', color: '#5A70D3', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    View All ({recordingSessions.length}) →
                  </button>
                </div>
                <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
                  Missed any live class? Stream all recorded lectures on demand and rate each recording class.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            5. TAB CONTENT 2: ATTENDANCE
            =================================================================== */}
        {activeTab === 'attendance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Top Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(11, 31, 58, 0.02)' }}>
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Overall Attendance</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>
                  {attendance?.attendancePercentage ?? 100}%
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  {(attendance?.attendancePercentage ?? 100) >= 75 ? '🟢 Meets eligibility criteria' : '⚠️ Below 75% target'}
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(11, 31, 58, 0.02)' }}>
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Classes Held</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0b1f3a' }}>
                  {attendance?.totalSessions ?? 0}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Total scheduled live sessions
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(11, 31, 58, 0.02)' }}>
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Classes Attended</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#5A70D3' }}>
                  {attendance?.attendedSessions ?? 0}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '4px' }}>
                  Verified presence recorded
                </div>
              </div>

              <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(11, 31, 58, 0.02)' }}>
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Classes Missed</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444' }}>
                  {attendance?.missedSessions ?? 0}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Replays available in Recordings
                </div>
              </div>
            </div>

            {/* Attendance History Table */}
            <div style={{ background: '#ffffff', borderRadius: '18px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(11, 31, 58, 0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0b1f3a', margin: '0 0 4px 0' }}>
                    Live Session Attendance Records
                  </h3>
                  <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
                    Attendance is automatically recorded whenever you enter a live session classroom.
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
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#0b1f3a', fontWeight: 800 }}>No live class records yet</h4>
                  <p style={{ margin: 0, fontSize: '0.88rem' }}>Live class sessions for this batch will appear here once held.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.82rem', textTransform: 'uppercase' }}>
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
                            <td style={{ padding: '14px', fontWeight: 700, color: '#0b1f3a' }}>
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
                                  onClick={() => setActiveTab('recordings')}
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
            6. TAB CONTENT 3: LIVE CLASSES
            =================================================================== */}
        {activeTab === 'live' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0b1f3a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-tower-broadcast" style={{ color: '#ef4444' }}></i>
                  <span>Live &amp; Upcoming Classes</span>
                </h2>
                <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                  Interactive live lectures scheduled for your batch. Enter classroom to participate with the tutor.
                </p>
              </div>
            </div>

            {upcomingSessions.length === 0 ? (
              <div style={{ background: '#ffffff', borderRadius: '18px', padding: '48px 24px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                <i className="fa-solid fa-calendar-xmark" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px', display: 'block' }}></i>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 800, color: '#0b1f3a' }}>No live classes currently scheduled</h3>
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
                        borderRadius: '18px',
                        padding: '24px',
                        border: isLive ? '2px solid #ef4444' : '1px solid #e2e8f0',
                        boxShadow: isLive ? '0 8px 30px rgba(239, 68, 68, 0.15)' : '0 4px 16px rgba(11, 31, 58, 0.03)',
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

                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0b1f3a', marginBottom: '8px', lineHeight: 1.3 }}>
                          {s.title}
                        </h3>

                        {s.description && (
                          <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.45, marginBottom: '16px' }}>
                            {s.description}
                          </p>
                        )}

                        <div style={{ background: '#f8fafc', border: '1px solid #edf2f7', borderRadius: '12px', padding: '12px 14px', marginBottom: '20px', fontSize: '0.84rem', color: '#334155' }}>
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
            7. TAB CONTENT 4: RECORDINGS (WITH CLASS RATING FEATURE!)
            =================================================================== */}
        {activeTab === 'recordings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0b1f3a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-video" style={{ color: '#5A70D3' }}></i>
                  <span>Recorded Session Classes</span>
                </h2>
                <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                  Stream full HD replays with WebVTT English subtitles, and share your feedback by rating each recording class.
                </p>
              </div>
            </div>

            {recordingSessions.length === 0 ? (
              <div style={{ background: '#ffffff', borderRadius: '18px', padding: '48px 24px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                <i className="fa-solid fa-film" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px', display: 'block' }}></i>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 800, color: '#0b1f3a' }}>No session recordings available yet</h3>
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
                        borderRadius: '18px',
                        padding: '24px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 16px rgba(11, 31, 58, 0.03)',
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

                        <h3 style={{ fontSize: '1.22rem', fontWeight: 800, color: '#0b1f3a', marginBottom: '8px', lineHeight: 1.3 }}>
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
                                border: '1px solid #edf2f7',
                                borderRadius: '14px',
                                padding: '14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                              }}
                            >
                              {/* Recording Title / Meta Row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0b1f3a' }}>
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

                              {/* Watch Recording Button */}
                              <button
                                type="button"
                                onClick={() => setSelectedRecording({
                                  ...r,
                                  url: recUrl,
                                  sessionTitle: s.title,
                                  courseName: course?.name || course?.title,
                                  description: s.description,
                                  subtitleUrl: r.subtitleUrl || null
                                })}
                                style={{
                                  height: '40px',
                                  borderRadius: '8px',
                                  background: '#5A70D3',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '0.88rem',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '7px',
                                  transition: 'all 0.18s ease'
                                }}
                              >
                                <i className="fa-solid fa-play" style={{ fontSize: '0.76rem' }}></i>
                                <span>Watch Recording Replay</span>
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
      </div>

      {/* ===================================================================
          8. RECORDING RATING MODAL DIALOG
          =================================================================== */}
      {ratingModalRecording && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 31, 58, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 1600,
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
              boxShadow: '0 25px 60px rgba(11, 31, 58, 0.25)',
              border: '1px solid #e2e8f0'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  <i className="fa-solid fa-star"></i>
                </span>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0b1f3a', margin: 0 }}>
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

      {/* ===================================================================
          9. VIDEO PLAYBACK MODAL FOR RECORDING
          =================================================================== */}
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
                    <span style={{ fontSize: '0.78rem', color: '#5A70D3', fontWeight: 700, background: 'rgba(90, 112, 211, 0.08)', padding: '2px 8px', borderRadius: '9999px' }}>
                      {selectedRecording.courseName}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Recorded Class Replay</span>
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
                onClick={() => setSelectedRecording(null)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

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

            <div style={{ padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', borderTop: '1px solid #eef4f0' }}>
              <button
                type="button"
                onClick={() => {
                  const rec = selectedRecording;
                  setSelectedRecording(null);
                  handleOpenRatingModal(rec, rec.sessionTitle);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'rgba(234, 179, 8, 0.12)',
                  color: '#ca8a04',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-star"></i>
                <span>Rate this Recording Class</span>
              </button>

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
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedRecording(null)}
              >
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
