import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { resolveMediaUrl } from '../utils/mediaUtils';
import { getCourseAccessTimestamp, recordCourseAccess } from '../utils/courseHistory';

// Curated default courses matching OneTutor reference if no courses are enrolled yet
const DEFAULT_TECH_COURSES = [
  {
    courseId: 1,
    courseName: 'MERN Full Stack Development.',
    courseThumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=800&q=80',
    instructorName: 'OneTutor Academy',
    progressPercent: 100,
    batchName: 'A',
  },
  {
    courseId: 2,
    courseName: 'Digital Marketing',
    courseThumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    instructorName: 'OneTutor Academy',
    progressPercent: 100,
    batchName: 'A',
  },
  {
    courseId: 3,
    courseName: 'Cloud Native Spring Boot 3 & Microservices',
    courseThumbnail: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&w=800&q=80',
    instructorName: 'OneTutor Academy',
    progressPercent: 0,
    batchName: 'B',
  },
  {
    courseId: 4,
    courseName: 'Python Full Stack Development & AI',
    courseThumbnail: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=800&q=80',
    instructorName: 'OneTutor Academy',
    progressPercent: 45,
    batchName: 'A',
  },
  {
    courseId: 5,
    courseName: 'Java Enterprise Architecture & Microservices',
    courseThumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80',
    instructorName: 'OneTutor Academy',
    progressPercent: 15,
    batchName: 'B',
  },
];

export default function EnrolledCoursesRowSection({ courses = [], fallbackCourses = [], continueLearning = null }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrollTrackRef = useRef(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    const handleHistoryUpdate = () => {
      setHistoryTick((t) => t + 1);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('course-history-updated', handleHistoryUpdate);
    window.addEventListener('storage', handleHistoryUpdate);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('course-history-updated', handleHistoryUpdate);
      window.removeEventListener('storage', handleHistoryUpdate);
    };
  }, []);

  // Hide section completely if user is not logged in
  if (!user) return null;

  // Normalize enrolled courses for authenticated student
  let rawList = [];
  if (Array.isArray(courses) && courses.length > 0) {
    rawList = courses.map((c, i) => ({
      ...c,
      courseId: c.courseId || c.id,
      courseName: c.courseName || c.name || c.title,
      courseThumbnail: c.courseThumbnail || c.thumbnailUrl || c.thumbnail || c.imageUrl,
      instructorName: c.instructorName || 'OneTutor Academy',
      progressPercent: Math.min(100, Math.max(0, Math.round(Number(c.progressPercent ?? c.progress ?? 0)))),
      batchName: c.batchName || (i % 2 === 0 ? 'A' : 'B'),
    }));
  } else {
    // Hide section if student has no enrolled courses
    return null;
  }

  // Arrange cards as per the history of use of the course (most recently used/active first)
  const getCourseHistoryScore = (course) => {
    const cId = course.courseId || course.id;
    // 1. If currently in continueLearning, this is the student's top active course
    if (continueLearning && String(continueLearning.courseId) === String(cId)) {
      return Number.MAX_SAFE_INTEGER;
    }
    // 2. Client access history (stored when student opens/learns course)
    const localTime = getCourseAccessTimestamp(cId);
    if (localTime > 0) {
      return localTime;
    }
    // 3. Backend lastAccessedAt timestamp
    if (course.lastAccessedAt) {
      const t = new Date(course.lastAccessedAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    // 4. In-progress courses (0 < pct < 100) rank higher than unstarted courses
    const pct = Number(course.progressPercent) || 0;
    if (pct > 0 && pct < 100) {
      return 1_000_000_000_000 + pct; // baseline timestamp + progress
    }
    // 5. Finished courses (pct >= 100)
    if (pct >= 100) {
      return 500_000_000_000;
    }
    // 6. Not started (0%)
    return 0;
  };

  rawList.sort((a, b) => getCourseHistoryScore(b) - getCourseHistoryScore(a));

  // Scroll check & updates for moving track
  const updateScrollState = useCallback(() => {
    if (scrollTrackRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollTrackRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollTrackRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollState, { passive: true });
      window.addEventListener('resize', updateScrollState);
      return () => {
        el.removeEventListener('scroll', updateScrollState);
        window.removeEventListener('resize', updateScrollState);
      };
    }
  }, [updateScrollState, rawList.length]);

  const handleScroll = (dir) => {
    if (scrollTrackRef.current) {
      const track = scrollTrackRef.current;
      const containerWidth = track.clientWidth;
      const isMob = typeof window !== 'undefined' && window.innerWidth <= 768;

      if (isMob) {
        // Find current card index based on current scrollLeft and step by exactly one full card
        const step = containerWidth + 16;
        const currentIndex = Math.round(track.scrollLeft / step);
        const targetIndex = Math.max(0, Math.min(rawList.length - 1, currentIndex + dir));
        track.scrollTo({ left: targetIndex * step, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: dir * 374, behavior: 'smooth' });
      }
    }
  };

  const handleCardAction = (course, isDone) => {
    const id = course.courseId || course.id;
    recordCourseAccess(id);
    navigate(`/student/learn/${id}`);
  };

  // Helper to prevent repeating "Batch Batch A"
  const formatBatchText = (batch) => {
    if (!batch) return 'Batch A';
    const str = String(batch).trim();
    return str.toLowerCase().startsWith('batch') ? str : `Batch ${str}`;
  };

  return (
    <section
      className="ud-enrolled-row-section"
      style={{
        width: '100%',
        maxWidth: '1760px',
        margin: '40px auto 48px auto',
        padding: '0 24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Scoped CSS for full-size card-by-card snap on mobile */}
      <style>{`
        .ot-moving-courses-track {
          display: flex;
          gap: 24px;
          overflow-x: auto;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: 6px 4px 14px 4px;
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        .ot-moving-courses-track::-webkit-scrollbar {
          display: none;
        }
        .ot-moving-courses-track .course-card {
          flex: 0 0 350px;
          width: 350px;
          min-width: 350px;
          max-width: 350px;
          box-sizing: border-box;
          scroll-snap-align: start;
        }
        .ot-track-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          transition: all 0.2s ease;
        }
        .ot-track-arrow-prev {
          left: -18px;
          background: #ffffff;
          border: 1px solid #cceee2;
          color: #0b1f3a;
          box-shadow: 0 6px 20px rgba(11, 31, 58, 0.18);
        }
        .ot-track-arrow-prev:hover {
          background: #5A70D3;
          color: #ffffff;
          border-color: #5A70D3;
          transform: translateY(-50%) scale(1.08);
        }
        .ot-track-arrow-next {
          right: -18px;
          background: #5A70D3;
          border: 1px solid #5A70D3;
          color: #ffffff;
          box-shadow: 0 6px 20px rgba(0, 147, 102, 0.3);
        }
        .ot-track-arrow-next:hover {
          background: #965FEF;
          transform: translateY(-50%) scale(1.08);
        }

        @media (max-width: 768px) {
          .ud-enrolled-row-section {
            padding: 0 12px !important;
            margin: 20px auto 32px auto !important;
          }
          .learning-roadmap {
            padding: 20px 14px !important;
            border-radius: 20px !important;
          }
          .ot-moving-courses-track {
            gap: 16px !important;
            scroll-snap-type: x mandatory !important;
            -webkit-overflow-scrolling: touch !important;
            padding: 4px 0 12px 0 !important;
          }
          .ot-moving-courses-track .course-card {
            flex: 0 0 100% !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            scroll-snap-align: start !important;
            scroll-snap-stop: always !important;
            box-sizing: border-box !important;
          }
          .ot-track-arrow {
            display: none !important;
          }
        }
      `}</style>

      {/* ===================================================================
          MAIN ROADMAP CARD WRAPPER (Unified for mobile & desktop)
          =================================================================== */}
      <div
        className="learning-roadmap"
        style={{
          background: 'radial-gradient(circle at 85% 15%, rgba(90, 112, 211, 0.08), transparent 45%), linear-gradient(145deg, #ffffff 0%, #F7F8FC 100%)',
          border: '1px solid #E4E7EC',
          borderRadius: '24px',
          padding: '32px 28px',
          boxShadow: 'var(--shadow-md, 0 8px 24px rgba(16, 24, 40, 0.06))',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle Decorative Ambient Glow */}
        <div
          style={{
            position: 'absolute',
            top: '-70px',
            right: '-70px',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(90, 112, 211, 0.10) 0%, rgba(90, 112, 211, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* SECTION HEADER ROW */}
        <div
          className="learning-roadmap-header"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '26px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div>
            {/* Pill Tag */}
            <div
              className="section-label"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: '#E8EBFA',
                color: '#5A70D3',
                padding: '5px 14px',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: '10px',
                border: '1px solid rgba(90, 112, 211, 0.2)',
              }}
            >
              <i className="fa-solid fa-graduation-cap" style={{ fontSize: '0.85rem' }}></i>
              <span>YOUR LEARNING ROADMAP</span>
            </div>

            {/* Title with Tech Skills highlight and count badge */}
            <h2
              style={{
                margin: 0,
                fontSize: 'clamp(1.4rem, 2.2vw, 2.15rem)',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                lineHeight: 1.25,
              }}
            >
              <span>Keep Building Your</span>
              <span style={{ color: '#5A70D3' }}>Tech Skills</span>
              <span
                className="roadmap-count"
                style={{
                  background: '#5A70D3',
                  color: '#FFFFFF',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  boxShadow: '0 2px 6px rgba(90, 112, 211, 0.3)',
                }}
              >
                {rawList.length}
              </span>
            </h2>

            {/* Supporting Subtitle */}
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: '0.9rem',
                color: '#667085',
                maxWidth: '720px',
                lineHeight: 1.5,
              }}
            >
              Master in-demand skills — resume your active courses, build hands-on projects, and track your certification milestones.
            </p>
          </div>

          {/* HEADER ACTION (ONLY View all in My Courses) */}
          <Link
            to="/student/my-courses"
            className="view-all-link"
            style={{
              background: '#5A70D3',
              color: '#FFFFFF',
              textDecoration: 'none',
              padding: '10px 22px',
              borderRadius: '9999px',
              fontWeight: 700,
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(90, 112, 211, 0.28)',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          >
            <span>View all in My Courses</span>
            <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.82rem' }}></i>
          </Link>
        </div>

        {/* ===================================================================
            HORIZONTAL MOVING CAROUSEL TRACK WRAPPER
            =================================================================== */}
        <div style={{ position: 'relative', width: '100%' }}>
          {/* Floating Left Arrow on Track */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => handleScroll(-1)}
              aria-label="Scroll left"
              className="ot-track-arrow ot-track-arrow-prev"
            >
              <i className="fa-solid fa-chevron-left" style={{ fontSize: '0.9rem' }}></i>
            </button>
          )}

          {/* Floating Right Arrow on Track */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => handleScroll(1)}
              aria-label="Scroll right"
              className="ot-track-arrow ot-track-arrow-next"
            >
              <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.9rem' }}></i>
            </button>
          )}

          {/* Horizontally Scrolling Moving Card Track */}
          <div ref={scrollTrackRef} className="ot-moving-courses-track">
            {rawList.map((course, idx) => {
              const pct = Math.round(course.progressPercent ?? 0);
              const isDone = pct >= 100;
              const batchText = formatBatchText(course.batchName || (idx % 2 === 0 ? 'A' : 'B'));
              const thumbUrl = resolveMediaUrl(course.courseThumbnail || course.thumbnailUrl || course.imageUrl);

              return (
                <div
                  key={course.enrollmentId || course.courseId || idx}
                  className="course-card"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e6f0ec',
                    borderRadius: '18px',
                    boxShadow: '0 4px 16px rgba(11, 31, 58, 0.05)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={() => handleCardAction(course, isDone)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 26px rgba(11, 31, 58, 0.09)';
                    e.currentTarget.style.borderColor = 'rgba(90, 112, 211, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(11, 31, 58, 0.05)';
                    e.currentTarget.style.borderColor = '#e6f0ec';
                  }}
                >
                  {/* THUMBNAIL CONTAINER - FIXED 16:9 FULL WIDTH */}
                  <div
                    className="course-thumb-wrap"
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '16 / 9',
                      background: '#071713',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {thumbUrl ? (
                      <>
                        <img
                          src={thumbUrl}
                          alt={course.courseName}
                          style={{
                            position: 'relative',
                            zIndex: 1,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              const fb = parent.querySelector('.course-thumb-fallback');
                              if (fb) fb.style.display = 'flex';
                            }
                          }}
                        />
                        {/* Fallback displayed on error */}
                        <div
                          className="course-thumb-fallback"
                          style={{
                            display: 'none',
                            position: 'absolute',
                            inset: 0,
                            zIndex: 1,
                            width: '100%',
                            height: '100%',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#5A70D3',
                            color: '#FFFFFF',
                            fontSize: '2.5rem',
                          }}
                        >
                          <i className="fa-solid fa-graduation-cap"></i>
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#5A70D3',
                          color: '#FFFFFF',
                          fontSize: '2.5rem',
                        }}
                      >
                        <i className="fa-solid fa-graduation-cap"></i>
                      </div>
                    )}

                    {/* Subtle top Scrim so badges remain readable without dimming the diagram */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '45px',
                        background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 100%)',
                        pointerEvents: 'none',
                        zIndex: 2,
                      }}
                    />

                    {/* TOP LEFT BADGE */}
                    <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 2 }}>
                      {isDone ? (
                        <span
                          style={{
                            background: '#059669',
                            color: '#ffffff',
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                          }}
                        >
                          <i className="fa-solid fa-check" style={{ fontSize: '0.74rem' }}></i>
                          <span>Completed</span>
                        </span>
                      ) : pct === 0 ? (
                        <span
                          style={{
                            background: '#5A70D3',
                            color: '#FFFFFF',
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                          }}
                        >
                          <span>Start Now</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            background: '#5A70D3',
                            color: '#FFFFFF',
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                          }}
                        >
                          <span>In Progress</span>
                        </span>
                      )}
                    </div>

                    {/* TOP RIGHT BADGE: Clean Batch Tag */}
                    <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2 }}>
                      <span
                        style={{
                          background: 'rgba(15, 23, 42, 0.78)',
                          backdropFilter: 'blur(6px)',
                          color: '#ffffff',
                          borderRadius: '9999px',
                          padding: '4px 12px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                        }}
                      >
                        <i className="fa-solid fa-users" style={{ fontSize: '0.7rem' }}></i>
                        <span>{batchText}</span>
                      </span>
                    </div>
                  </div>

                  {/* CARD BODY CONTENT */}
                  <div
                    style={{
                      padding: '20px 20px 18px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      justifyContent: 'space-between',
                      gap: '14px',
                    }}
                  >
                    <div>
                      {/* Fixed 2-Line Course Title */}
                      <h3
                        className="course-title"
                        title={course.courseName}
                        style={{
                          margin: '0 0 6px 0',
                          fontSize: '1.02rem',
                          fontWeight: 800,
                          lineHeight: 1.35,
                          color: '#0b1f3a',
                          height: '42px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {course.courseName}
                      </h3>

                      {/* Academy / Author Tag */}
                      <div
                        style={{
                          fontSize: '0.82rem',
                          color: '#64748b',
                          fontWeight: 500,
                        }}
                      >
                        <span>{course.instructorName || 'OneTutor Academy'}</span>
                      </div>
                    </div>

                    {/* PROGRESS BAR & PERCENTAGE STATUS */}
                    <div>
                      <div
                        className="progress-bar-wrap"
                        style={{
                          width: '100%',
                          height: '7px',
                          background: '#e8f1ee',
                          borderRadius: '999px',
                          overflow: 'hidden',
                          marginBottom: '8px',
                        }}
                      >
                        <div
                          className="progress-bar-fill"
                          style={{
                            height: '100%',
                            width: `${isDone ? 100 : Math.max(pct, 4)}%`,
                            background: '#5A70D3',
                            borderRadius: '999px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                        }}
                      >
                        <span style={{ color: '#64748b', fontWeight: 600 }}>
                          {pct}% complete
                        </span>

                        {isDone ? (
                          <span
                            className="course-completed"
                            style={{
                              color: '#059669',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <i className="fa-solid fa-circle-check" style={{ fontSize: '0.82rem' }}></i>
                            <span>Finished</span>
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                            {pct === 0 ? 'Not Started' : 'In Progress'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ACTION BUTTON ROW */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {isDone ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCardAction(course, true);
                          }}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: '1px solid rgba(90, 112, 211, 0.28)',
                            background: 'rgba(90, 112, 211, 0.09)',
                            color: '#5A70D3',
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(90, 112, 211, 0.16)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(90, 112, 211, 0.09)';
                          }}
                        >
                          <i className="fa-solid fa-book-open" style={{ fontSize: '0.82rem' }}></i>
                          <span>Review Course</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCardAction(course, false);
                          }}
                          className="btn-primary"
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: 'none',
                            background: '#5A70D3',
                            color: '#FFFFFF',
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 8px rgba(0, 147, 102, 0.22)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <i className="fa-solid fa-play" style={{ fontSize: '0.78rem' }}></i>
                          <span>Start Learning</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/student/courses/${course.courseId || course.id}`);
                        }}
                        title="Course details"
                        style={{
                          width: '42px',
                          height: '40px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          background: '#f8fafc',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <i className="fa-solid fa-ellipsis" style={{ fontSize: '0.9rem' }}></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </section>
  );
}
