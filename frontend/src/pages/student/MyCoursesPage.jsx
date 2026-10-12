import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { myCourses } from '../../api/enrollment';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import { getCourseAccessTimestamp } from '../../utils/courseHistory';

export default function MyCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL | IN_PROGRESS | COMPLETED
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeMenuCourseId, setActiveMenuCourseId] = useState(null);
  const [accessError, setAccessError] = useState('');
  const searchContainerRef = useRef(null);
  const menuContainerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    myCourses({ size: 100 })
      .then((data) => setCourses(data?.content || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  // Show access error banner if redirected from LearningPage due to removed enrollment
  useEffect(() => {
    const msg = location.state?.accessError;
    if (msg) {
      setAccessError(msg);
      // Clear it from history state so a page refresh doesn't re-show it
      window.history.replaceState({}, '');
      const t = setTimeout(() => setAccessError(''), 8000);
      return () => clearTimeout(t);
    }
  }, [location.state]);

  // Click outside to close suggestions and card menus
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target)) {
        setActiveMenuCourseId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sort courses by last accessed history, then progress
  const sortedCourses = [...courses].sort((a, b) => {
    const timeA = getCourseAccessTimestamp(a.courseId || a.id) || 0;
    const timeB = getCourseAccessTimestamp(b.courseId || b.id) || 0;
    if (timeA !== timeB) return timeB - timeA;
    return (b.progressPercent || 0) - (a.progressPercent || 0);
  });

  const inProgressList = sortedCourses.filter(c => (c.progressPercent || 0) > 0 && (c.progressPercent || 0) < 100);
  const completedList = sortedCourses.filter(c => (c.progressPercent || 0) >= 100);

  const matchingCourses = sortedCourses.filter(c =>
    searchTerm && c.courseName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCourses = sortedCourses.filter(c => {
    const pct = c.progressPercent || 0;
    if (filter === 'IN_PROGRESS' && (pct === 0 || pct >= 100)) return false;
    if (filter === 'COMPLETED' && pct < 100) return false;
    if (searchTerm && !c.courseName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `
          radial-gradient(circle at 86% 12%, rgba(90, 112, 211, 0.08) 0%, rgba(16, 185, 129, 0.02) 35%, transparent 50%),
          radial-gradient(circle at 4% 42%, rgba(90, 112, 211, 0.06) 0%, rgba(52, 211, 153, 0.02) 30%, transparent 45%),
          radial-gradient(circle at 94% 60%, rgba(90, 112, 211, 0.05) 0%, transparent 40%),
          #F7F7F7
        `,
        padding: '32px 0 60px 0',
      }}
    >
      <div className="ot-learning-container" ref={menuContainerRef}>
        {/* Access removed banner — shown when redirected from a blocked course */}
        {accessError && (
          <div style={{
            background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
            border: '1px solid #f87171',
            borderRadius: '12px',
            padding: '14px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#991b1b',
            fontWeight: 600,
            fontSize: '0.95rem',
          }}>
            <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '1.2rem', flexShrink: 0 }} />
            {accessError}
          </div>
        )}
        {/* ===================================================================
            HEADER: TITLE ON LEFT, "LEARN PRACTICE GROW" ARTWORK ON RIGHT
            =================================================================== */}
        <div className="ot-learning-header-wrap" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* Left Title & Subtitle */}
          <div className="ot-learning-title-content" style={{ position: 'relative', zIndex: 1 }}>
            <h1
              className="ot-learning-title"
              style={{
                fontSize: 'clamp(1.85rem, 3.8vw, 2.75rem)',
                fontWeight: 800,
                color: '#0b1f3a',
                margin: '0 0 8px 0',
                letterSpacing: '-0.6px',
                lineHeight: 1.15,
              }}
            >
              My Learning <span style={{ color: '#5A70D3' }}>Space</span>
            </h1>
            <p
              className="ot-learning-subtitle"
              style={{
                color: '#64748b',
                fontSize: 'clamp(0.85rem, 1.6vw, 1.02rem)',
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              Track your progress, resume lessons, and achieve your learning milestones.
            </p>
          </div>

          {/* Logo artwork positioned AS BACKGROUND in the title and content */}
          <div
            className="ot-learning-artwork-bg"
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 0,
              opacity: 0.18,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
            aria-hidden="true"
          >
            <svg width="150" height="90" viewBox="0 0 150 90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text
                x="75"
                y="23"
                textAnchor="middle"
                fill="#5A70D3"
                fontFamily="'Segoe UI', 'Caveat', cursive, sans-serif"
                fontSize="22"
                fontWeight="800"
                fontStyle="italic"
                transform="rotate(-7 75 23)"
              >
                Learn
              </text>
              <text
                x="80"
                y="45"
                textAnchor="middle"
                fill="#5A70D3"
                fontFamily="'Segoe UI', 'Caveat', cursive, sans-serif"
                fontSize="21"
                fontWeight="800"
                fontStyle="italic"
                transform="rotate(-5 80 45)"
              >
                Practice
              </text>
              <text
                x="86"
                y="67"
                textAnchor="middle"
                fill="#5A70D3"
                fontFamily="'Segoe UI', 'Caveat', cursive, sans-serif"
                fontSize="24"
                fontWeight="900"
                fontStyle="italic"
                transform="rotate(-3 86 67)"
              >
                Grow
              </text>
              <path
                d="M 36 74 Q 78 82 135 67"
                stroke="#5A70D3"
                strokeWidth="3.6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 50 81 Q 92 88 126 76"
                stroke="#5A70D3"
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* ===================================================================
            CONTROLS BAR: SEARCH & FILTERS (ADAPTIVE TO MOBILE AND DESKTOP)
            =================================================================== */}
        <div className="ot-learning-controls-wrap">
          {/* Row 1 on mobile, Left Col on Desktop: Search Box */}
          <div className="ot-learning-search-col" ref={searchContainerRef} style={{ flex: '0 0 auto', height: 'auto', margin: 0, padding: 0 }}>
            <div className="ot-learning-search-pill">
              <i
                className="fa-solid fa-magnifying-glass"
                style={{ color: '#94a3b8', fontSize: '0.95rem', marginRight: '12px' }}
              ></i>
              <input
                type="text"
                placeholder="Search my courses..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={e => {
                  if (e.key === 'Escape') setShowSuggestions(false);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  fontSize: '0.94rem',
                  color: '#0b1f3a',
                  fontWeight: 500,
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setShowSuggestions(false);
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '4px',
                  }}
                  title="Clear search"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && searchTerm.trim() && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  width: '100%',
                  background: '#ffffff',
                  borderRadius: '16px',
                  boxShadow: '0 12px 32px rgba(11, 31, 58, 0.12)',
                  border: '1px solid #e2e8f0',
                  zIndex: 50,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: '#64748b',
                    letterSpacing: '0.5px',
                    background: '#f8fafc',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  ENROLLED COURSES ({matchingCourses.length})
                </div>
                {matchingCourses.length === 0 ? (
                  <div style={{ padding: '16px', color: '#64748b', fontSize: '0.88rem' }}>
                    No enrolled courses match "{searchTerm}"
                  </div>
                ) : (
                  matchingCourses.slice(0, 5).map(c => (
                    <div
                      key={c.id || c.courseId}
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f8fafc',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchTerm(c.courseName);
                        setShowSuggestions(false);
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#E8EBFA')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: '#E8EBFA',
                          color: '#5A70D3',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.9rem',
                          flexShrink: 0,
                        }}
                      >
                        <i className="fa-solid fa-graduation-cap"></i>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            color: '#0b1f3a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {c.courseName}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {c.progressPercent ? `${c.progressPercent}% completed` : 'Not started'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Row 2 on mobile / Right on desktop: Filters + Explore */}
          <div className="ot-learning-actions-col" style={{ flex: '0 0 auto', margin: 0, padding: 0 }}>
            <div className="ot-learning-filters-row">
              {/* Filter Pills Group */}
              <div className="ot-learning-filter-group">
                {/* 1. All */}
                <button
                  onClick={() => setFilter('ALL')}
                  className={`ot-learning-filter-pill-btn ${filter === 'ALL' ? 'active' : ''}`}
                >
                  <span>All</span>
                  <span className="ot-learning-filter-badge">
                    {sortedCourses.length}
                  </span>
                </button>

                {/* 2. In Progress */}
                <button
                  onClick={() => setFilter('IN_PROGRESS')}
                  className={`ot-learning-filter-pill-btn ${filter === 'IN_PROGRESS' ? 'active' : ''}`}
                >
                  <span>In Progress</span>
                  <span className="ot-learning-filter-badge">
                    {inProgressList.length}
                  </span>
                </button>

                {/* 3. Completed */}
                <button
                  onClick={() => setFilter('COMPLETED')}
                  className={`ot-learning-filter-pill-btn ${filter === 'COMPLETED' ? 'active' : ''}`}
                >
                  <span>Completed</span>
                  <span className="ot-learning-filter-badge">
                    {completedList.length}
                  </span>
                </button>
              </div>

              {/* Explore Button on Desktop (Hidden on Mobile) */}
              <Link
                to="/student/courses"
                className="ot-learning-explore-desktop-btn"
              >
                <i className="fa-solid fa-plus" style={{ fontSize: '0.85rem' }}></i>
                <span>Explore More Courses</span>
              </Link>

              {/* Explore Button on Mobile (Only + Icon) */}
              <Link
                to="/student/courses"
                className="ot-learning-explore-mobile-btn"
                title="Explore More Courses"
                aria-label="Explore More Courses"
              >
                <i className="fa-solid fa-plus"></i>
              </Link>
            </div>
          </div>
        </div>

        {/* ===================================================================
            COURSE CARDS (DESKTOP: 4-COLUMN GRID | MOBILE: COMPACT ROW CARDS)
            =================================================================== */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#5A70D3', marginBottom: '14px' }}></i>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>Loading your enrolled courses...</div>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '70px 24px',
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px dashed #cbd5e1',
              boxShadow: '0 4px 16px rgba(11, 31, 58, 0.03)',
            }}
          >
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: '#E8EBFA',
                color: '#5A70D3',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                marginBottom: '16px',
              }}
            >
              <i className="fa-solid fa-book-open"></i>
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0b1f3a', margin: '0 0 8px 0' }}>
              {filter === 'ALL'
                ? "You haven't enrolled in any courses yet."
                : `No courses found in ${filter.toLowerCase().replace('_', ' ')} status.`}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.94rem', margin: '0 0 24px 0', maxWidth: '440px', display: 'inline-block' }}>
              Discover industry-ready courses in modern development, microservices, and DevOps.
            </p>
            <div>
              <Link
                to="/student/courses"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#5A70D3',
                  color: '#FFFFFF',
                  padding: '11px 26px',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(90, 112, 211, 0.22)',
                }}
              >
                <span>Explore Course Catalog</span>
                <i className="fa-solid fa-arrow-right"></i>
              </Link>
            </div>
          </div>
        ) : (
          <div className="ot-learning-cards-container">
            {filteredCourses.map((c) => {
              const pct = Math.round(c.progressPercent || 0);
              const isCompleted = pct >= 100;
              const isNotStarted = pct === 0;
              const isInProgress = pct > 0 && pct < 100;

              // Batch label fallback matching the UI
              const batchLabel = c.batchName || c.batchCode || (c.enrollmentId ? `Batch ${String.fromCharCode(65 + ((c.courseId || 1) % 2))}` : 'Batch A');

              return (
                <div
                  key={c.enrollmentId || c.courseId}
                  className="ot-learning-card"
                >
                  {/* Thumbnail / Media Container */}
                  <div className="ot-card-thumb-wrap">
                    {c.courseThumbnail ? (
                      <>
                        <img
                          src={resolveMediaUrl(c.courseThumbnail)}
                          alt={c.courseName}
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
                            const fb = e.currentTarget.parentElement?.querySelector('.course-thumb-fallback');
                            if (fb) fb.style.display = 'flex';
                          }}
                        />
                        <div
                          className="course-thumb-fallback"
                          style={{
                            display: 'none',
                            position: 'absolute',
                            inset: 0,
                            zIndex: 1,
                            background: 'linear-gradient(135deg, #18131F 0%, #5A70D3 100%)',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <i className="fa-solid fa-graduation-cap" style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.85)' }}></i>
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(135deg, #18131F 0%, #5A70D3 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <i className="fa-solid fa-graduation-cap" style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.85)' }}></i>
                      </div>
                    )}

                    {/* =======================================================
                        DESKTOP OVERLAY BADGES
                        ======================================================= */}
                    {isCompleted && (
                      <div className="ot-badge-desktop">
                        {/* Top-Left: Completed */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            zIndex: 2,
                            background: '#5A70D3',
                            color: '#FFFFFF',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                          }}
                        >
                          <i className="fa-solid fa-check"></i>
                          <span>Completed</span>
                        </div>
                        {/* Top-Right: Batch */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            zIndex: 2,
                            background: 'rgba(11, 31, 58, 0.68)',
                            backdropFilter: 'blur(8px)',
                            color: '#ffffff',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <i className="fa-solid fa-users" style={{ fontSize: '0.7rem' }}></i>
                          <span>{batchLabel}</span>
                        </div>
                      </div>
                    )}

                    {isNotStarted && (
                      <div className="ot-badge-desktop">
                        {/* Top-Left: Batch */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            zIndex: 2,
                            background: 'rgba(11, 31, 58, 0.68)',
                            backdropFilter: 'blur(8px)',
                            color: '#ffffff',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <i className="fa-solid fa-users" style={{ fontSize: '0.7rem' }}></i>
                          <span>{batchLabel}</span>
                        </div>
                        {/* Top-Right: Start Now */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            zIndex: 2,
                            background: '#5A70D3',
                            color: '#FFFFFF',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                          }}
                        >
                          <i className="fa-solid fa-play" style={{ fontSize: '0.66rem' }}></i>
                          <span>Start Now</span>
                        </div>
                      </div>
                    )}

                    {isInProgress && (
                      <div className="ot-badge-desktop">
                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            zIndex: 2,
                            background: 'rgba(11, 31, 58, 0.68)',
                            backdropFilter: 'blur(8px)',
                            color: '#ffffff',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <i className="fa-solid fa-users" style={{ fontSize: '0.7rem' }}></i>
                          <span>{batchLabel}</span>
                        </div>
                      </div>
                    )}

                    {/* =======================================================
                        MOBILE OVERLAY BADGES (EXACT POSITIONING FROM SCREENSHOT)
                        ======================================================= */}
                    {isCompleted ? (
                      <div className="ot-badge-mobile">
                        {/* Top-Left: Completed */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '6px',
                            left: '6px',
                            zIndex: 2,
                            background: '#5A70D3',
                            color: '#FFFFFF',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            borderRadius: '9999px',
                            padding: '2px 7px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                          }}
                        >
                          <i className="fa-solid fa-check" style={{ fontSize: '0.6rem' }}></i>
                          <span>Completed</span>
                        </div>
                        {/* Bottom-Left: Batch A */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '6px',
                            left: '6px',
                            zIndex: 2,
                            background: 'rgba(11, 31, 58, 0.72)',
                            backdropFilter: 'blur(4px)',
                            color: '#ffffff',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            borderRadius: '9999px',
                            padding: '2px 7px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <i className="fa-solid fa-users" style={{ fontSize: '0.6rem' }}></i>
                          <span>{batchLabel}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="ot-badge-mobile">
                        {/* Top-Left: Batch Badge */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '6px',
                            left: '6px',
                            zIndex: 2,
                            background: 'rgba(11, 31, 58, 0.72)',
                            backdropFilter: 'blur(4px)',
                            color: '#ffffff',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            borderRadius: '9999px',
                            padding: '2px 7px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <i className="fa-solid fa-users" style={{ fontSize: '0.6rem' }}></i>
                          <span>{batchLabel}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Body / Details Container */}
                  <div className="ot-card-body-wrap">
                    {/* Top Row: Title + Mobile More Button */}
                    <div>
                      <div className="ot-card-title-row">
                        <h3 className="ot-card-title" title={c.courseName}>
                          {c.courseName}
                        </h3>

                        {/* More Button on Mobile (Beside Title) */}
                        <button
                          className="ot-card-more-btn-mobile"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuCourseId(activeMenuCourseId === c.courseId ? null : c.courseId);
                          }}
                          title="Options"
                        >
                          <i className="fa-solid fa-ellipsis" style={{ fontSize: '0.85rem' }}></i>
                        </button>
                      </div>

                      {/* Academy Subtitle */}
                      <div className="ot-card-academy">
                        OneTutor Academy
                      </div>
                    </div>

                    {/* Progress Track & Percentage */}
                    <div>
                      <div
                        style={{
                          height: '5px',
                          borderRadius: '9999px',
                          background: '#e2e8f0',
                          overflow: 'hidden',
                          marginBottom: '6px',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: '#5A70D3',
                            borderRadius: '9999px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.78rem',
                        }}
                      >
                        <span style={{ color: '#0b1f3a', fontWeight: 600 }}>
                          {pct}% complete
                        </span>

                        {isCompleted ? (
                          <span
                            style={{
                              color: '#5A70D3',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className="fa-solid fa-circle-check"></i>
                            <span>Completed</span>
                          </span>
                        ) : isNotStarted ? (
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                            Not Started
                          </span>
                        ) : (
                          <span style={{ color: '#5A70D3', fontWeight: 700 }}>
                            In Progress
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="ot-card-actions-row">
                      {/* Primary Button */}
                      <button
                        onClick={() => navigate(`/student/learn/${c.courseId}`)}
                        className="ot-card-primary-btn"
                        style={{
                          flex: 1,
                          height: '42px',
                          borderRadius: '10px',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '7px',
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                          background: isCompleted ? '#E8EBFA' : '#5A70D3',
                          color: isCompleted ? '#5A70D3' : '#ffffff',
                          border: isCompleted ? '1px solid rgba(90, 112, 211, 0.28)' : 'none',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isCompleted ? '#dce3f8' : '#4B61C4';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isCompleted ? '#E8EBFA' : '#5A70D3';
                        }}
                      >
                        {isCompleted ? (
                          <>
                            <i className="fa-solid fa-book-open"></i>
                            <span>Review Course</span>
                          </>
                        ) : isNotStarted ? (
                          <>
                            <i className="fa-solid fa-play" style={{ fontSize: '0.74rem' }}></i>
                            <span>Start Learning</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-play" style={{ fontSize: '0.74rem' }}></i>
                            <span>Resume Learning</span>
                          </>
                        )}
                      </button>

                      {/* More Options Button on Desktop */}
                      <button
                        className="ot-card-more-btn-desktop"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuCourseId(activeMenuCourseId === c.courseId ? null : c.courseId);
                        }}
                        title="Course options"
                      >
                        <i className="fa-solid fa-ellipsis" style={{ fontSize: '1.1rem', color: '#0b1f3a' }}></i>
                      </button>

                      {/* Dropdown Menu for Three Dots (Both Mobile and Desktop) */}
                      {activeMenuCourseId === c.courseId && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 8px)',
                            right: 0,
                            background: '#ffffff',
                            borderRadius: '12px',
                            boxShadow: '0 8px 24px rgba(11, 31, 58, 0.15)',
                            border: '1px solid #e2e8f0',
                            zIndex: 40,
                            minWidth: '180px',
                            padding: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                        >
                          <button
                            onClick={() => navigate(`/student/community/${c.courseId}`)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              textAlign: 'left',
                              fontSize: '0.86rem',
                              fontWeight: 600,
                              color: '#0b1f3a',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#E8EBFA')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <i className="fa-solid fa-comments" style={{ color: '#5A70D3' }}></i>
                            <span>Community Chat</span>
                          </button>

                          <button
                            onClick={() => navigate(`/student/courses/${c.courseId}`)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              textAlign: 'left',
                              fontSize: '0.86rem',
                              fontWeight: 600,
                              color: '#0b1f3a',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#E8EBFA')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <i className="fa-solid fa-circle-info" style={{ color: '#5A70D3' }}></i>
                            <span>Course Details</span>
                          </button>

                          {isCompleted && (
                            <button
                              onClick={() => navigate(`/student/learn/${c.courseId}`)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                textAlign: 'left',
                                fontSize: '0.86rem',
                                fontWeight: 600,
                                color: '#0b1f3a',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#E8EBFA')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <i className="fa-solid fa-award" style={{ color: '#ea580c' }}></i>
                              <span>Certificate</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}


      </div>
    </div>
  );
}
