import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { browseCourses } from '../api/courses';
import CourseCard from './CourseCard';
import { getCourseDefaultRating } from '../utils/courseRatingUtils';

/**
 * RelatedCoursesSection
 * Displays courses in the same category, or falls back to all courses if none exist.
 * On desktop: Renders in the right-side space next to curriculum.
 * On small screens: Renders as a testimonials-style carousel slider at the bottom of the page.
 */
export default function RelatedCoursesSection({ currentCourseId, categoryId, categoryName }) {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [isSameCategory, setIsSameCategory] = useState(true);
  const [loading, setLoading] = useState(true);

  // Slider state for mobile/small screen
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const trackRef = useRef(null);
  const timerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const resumeTimerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);

  // Fetch related courses
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function fetchRelated() {
      try {
        let sameCat = [];
        if (categoryId) {
          const res = await browseCourses({ categoryId, size: 8 });
          sameCat = (res?.content || []).filter(c => String(c.id) !== String(currentCourseId));
        }

        if (sameCat.length > 0) {
          if (isMounted) {
            setCourses(sameCat);
            setIsSameCategory(true);
            setLoading(false);
          }
        } else {
          // Fallback to all courses if no same category courses available
          const allRes = await browseCourses({ size: 8 });
          const fallback = (allRes?.content || []).filter(c => String(c.id) !== String(currentCourseId));
          if (isMounted) {
            setCourses(fallback);
            setIsSameCategory(false);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to load related courses:', err);
        if (isMounted) setLoading(false);
      }
    }

    fetchRelated();

    return () => {
      isMounted = false;
    };
  }, [currentCourseId, categoryId]);

  // Autoplay slider logic for small screen testimonials mode
  const SLIDE_DURATION = 4500;
  const TICK_INTERVAL = 50;
  const numCourses = courses.length;

  // Track scroll sync with current index
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let rafId = null;
    const handleTrackScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!el) return;
        const { scrollLeft, clientWidth } = el;
        if (clientWidth > 0) {
          const idx = Math.max(0, Math.min(numCourses - 1, Math.round(scrollLeft / clientWidth)));
          setCurrentIndex(idx);
        }
      });
    };

    el.addEventListener('scroll', handleTrackScroll, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', handleTrackScroll);
    };
  }, [numCourses]);

  // Autoplay timer
  useEffect(() => {
    if (numCourses <= 1 || isPaused || isMouseDown) return;

    const startTime = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / SLIDE_DURATION) * 100);
      setProgress(pct);
    }, TICK_INTERVAL);

    timerRef.current = setTimeout(() => {
      const nextIdx = (currentIndex + 1) % numCourses;
      if (trackRef.current && trackRef.current.clientWidth > 0) {
        isProgrammaticScrollRef.current = true;
        trackRef.current.scrollTo({
          left: nextIdx * trackRef.current.clientWidth,
          behavior: 'smooth'
        });
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 550);
      }
      setCurrentIndex(nextIdx);
      setProgress(0);
    }, SLIDE_DURATION);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(progressTimerRef.current);
    };
  }, [currentIndex, isPaused, isMouseDown, numCourses]);

  const scrollToSlide = (newIndex) => {
    clearTimeout(timerRef.current);
    clearInterval(progressTimerRef.current);
    clearTimeout(resumeTimerRef.current);

    const safeIndex = (newIndex + numCourses) % numCourses;
    if (trackRef.current && trackRef.current.clientWidth > 0) {
      isProgrammaticScrollRef.current = true;
      trackRef.current.scrollTo({
        left: safeIndex * trackRef.current.clientWidth,
        behavior: 'smooth'
      });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 550);
    }
    setCurrentIndex(safeIndex);
    setProgress(0);
    setIsPaused(true);

    // Resume autoplay after 4.5 seconds of user idle
    resumeTimerRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 4500);
  };

  const handlePrev = () => scrollToSlide(currentIndex - 1);
  const handleNext = () => scrollToSlide(currentIndex + 1);

  // Mouse Drag Handlers for Desktop & Emulators
  const handleMouseDown = (e) => {
    if (!trackRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - trackRef.current.offsetLeft;
    scrollLeftRef.current = trackRef.current.scrollLeft;
    setIsPaused(true);
    setIsMouseDown(true);
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = x - startXRef.current;
    if (Math.abs(walk) > 6) {
      hasMovedRef.current = true;
    }
    trackRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsMouseDown(false);

    if (trackRef.current && trackRef.current.clientWidth > 0) {
      const { scrollLeft, clientWidth } = trackRef.current;
      const nearestIdx = Math.max(0, Math.min(numCourses - 1, Math.round(scrollLeft / clientWidth)));
      isProgrammaticScrollRef.current = true;
      trackRef.current.scrollTo({
        left: nearestIdx * clientWidth,
        behavior: 'smooth'
      });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 550);
      setCurrentIndex(nearestIdx);
    }

    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      setIsPaused(false);
      hasMovedRef.current = false;
    }, 4500);
  };

  const handleMouseLeave = () => {
    if (isDraggingRef.current) {
      handleMouseUp();
    }
    setIsPaused(false);
  };

  // Touch Handlers for Mobile
  const handleTouchStart = () => {
    setIsPaused(true);
    hasMovedRef.current = false;
  };

  const handleTouchMove = () => {
    hasMovedRef.current = true;
  };

  const handleTouchEnd = () => {
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      setIsPaused(false);
      hasMovedRef.current = false;
    }, 4500);
  };

  const handleCardClick = (courseId) => {
    if (hasMovedRef.current) {
      return;
    }
    navigate(`/student/courses/${courseId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="ud-related-widget">
        <div className="ud-related-skeleton-header"></div>
        <div className="ud-related-skeleton-card"></div>
        <div className="ud-related-skeleton-card"></div>
      </div>
    );
  }

  if (courses.length === 0) {
    return null;
  }

  const sectionTitle = isSameCategory ? 'Related Courses' : 'More Courses For You';
  const sectionSubtitle = isSameCategory
    ? `Courses in ${categoryName || 'this category'}`
    : 'Popular recommendations across OneTutor';

  return (
    <div className="ud-related-container">
      {/* ====================================================================
          1. DESKTOP SIDEBAR VIEW (Visible on >= 1025px)
          ==================================================================== */}
      <div className="ud-related-desktop-view">
        <div className="ud-related-widget">
          {/* Header */}
          <div className="ud-related-widget-header">
            <div>
              <h3 className="ud-related-widget-title">
                <i className="fa-solid fa-layer-group" style={{ color: 'var(--ud-purple)', fontSize: '1rem' }}></i>
                <span>{sectionTitle}</span>
              </h3>
              <p className="ud-related-widget-sub">{sectionSubtitle}</p>
            </div>
            <span className="ud-related-badge-tag">
              {isSameCategory ? (categoryName || 'Related') : 'Recommended'}
            </span>
          </div>

          {/* List of Course Cards */}
          <div className="ud-related-list">
            {courses.map((c) => {
              const ratingData = getCourseDefaultRating(c.id);
              const rating = c.rating ? Number(c.rating).toFixed(1) : ratingData.averageRating.toFixed(1);
              const students = (2400 + ((c.id * 149) % 5000)).toLocaleString();

              return (
                <div
                  key={c.id}
                  className="ud-related-card-item"
                  onClick={() => {
                    navigate(`/student/courses/${c.id}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <div className="ud-related-card-thumb">
                    {c.thumbnail ? (
                      <img src={c.thumbnail} alt={c.name} />
                    ) : (
                      <div className="ud-related-thumb-placeholder">
                        <i className="fa-solid fa-graduation-cap"></i>
                      </div>
                    )}
                    <span className="ud-related-thumb-pill">
                      {c.level || 'All Levels'}
                    </span>
                  </div>

                  <div className="ud-related-card-info">
                    <div>
                      <div className="ud-related-cat-pill">
                        {c.categoryName || 'Development'}
                      </div>
                      <h4 className="ud-related-card-title" title={c.name}>
                        {c.name}
                      </h4>
                    </div>

                    <div className="ud-related-card-bottom">
                      <div className="ud-related-rating-row">
                        <span className="ud-related-rating-val">{rating}</span>
                        <i className="fa-solid fa-star" style={{ color: 'var(--ud-star-gold)', fontSize: '0.72rem' }}></i>
                        <span className="ud-related-students-count">({students})</span>
                      </div>
                      <span className="ud-related-card-cta">
                        View <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.72rem' }}></i>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Explore Catalog Link */}
          <div className="ud-related-widget-footer">
            <Link to="/student/courses" className="ud-related-browse-all">
              <span>Browse Full Catalog</span>
              <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. SMALL SCREEN TESTIMONIALS-STYLE SLIDER (Visible on <= 1024px)
          ==================================================================== */}
      <div className="ud-related-mobile-view">
        <div
          className="ud-related-slider-box"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Header with Slider Controls */}
          <div className="ud-related-slider-header">
            <div>
              <div className="ud-related-slider-tag">
                <i className="fa-solid fa-sparkles" style={{ color: 'var(--ud-purple)' }}></i>
                <span>{isSameCategory ? 'Explore More In Category' : 'Recommended For You'}</span>
              </div>
              <h3 className="ud-related-slider-title">{sectionTitle}</h3>
              <p className="ud-related-slider-subtitle">{sectionSubtitle}</p>
            </div>

            {numCourses > 1 && (
              <div className="ud-related-slider-arrows">
                <button
                  type="button"
                  className="ud-related-arrow-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handlePrev();
                  }}
                  onMouseUp={(e) => e.currentTarget.blur()}
                  onTouchEnd={(e) => e.currentTarget.blur()}
                  aria-label="Previous Course"
                  title="Previous course"
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <button
                  type="button"
                  className="ud-related-arrow-btn"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleNext();
                  }}
                  onMouseUp={(e) => e.currentTarget.blur()}
                  onTouchEnd={(e) => e.currentTarget.blur()}
                  aria-label="Next Course"
                  title="Next course"
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>

          {/* Testimonial-Style Slider Viewport */}
          <div className="ud-related-viewport">
            <div
              ref={trackRef}
              className="ud-related-track"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                cursor: isMouseDown ? 'grabbing' : 'grab'
              }}
            >
              {courses.map((c) => (
                <div
                  key={c.id}
                  className="ud-related-slide"
                  style={{
                    padding: '4px 2px',
                    boxSizing: 'border-box'
                  }}
                >
                  <CourseCard
                    course={c}
                    onClick={() => handleCardClick(c.id)}
                  />
                </div>
              ))}
            </div>

            {/* Continuous Progress Bar Indicator */}
            {numCourses > 1 && (
              <div className="ud-related-progress-bar-wrap">
                <div
                  className="ud-related-progress-bar"
                  style={{
                    width: `${progress}%`,
                    transition: (isPaused || isMouseDown) ? 'none' : 'width 50ms linear'
                  }}
                />
              </div>
            )}
          </div>

          {/* Dots Pagination for Mobile Slider */}
          {numCourses > 1 && (
            <div className="ud-related-slider-dots">
              {courses.map((_, idx) => (
                <button
                  key={idx}
                  className={`ud-related-dot ${idx === currentIndex ? 'active' : ''}`}
                  onClick={() => scrollToSlide(idx)}
                  aria-label={`Slide to course ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
