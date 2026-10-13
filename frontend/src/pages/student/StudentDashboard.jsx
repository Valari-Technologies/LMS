import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getContinueLearning } from '../../api/progress';
import { myCourses } from '../../api/enrollment';
import { browseCourses } from '../../api/courses';
import { listCategories } from '../../api/categories';
import { getLiveSessions } from '../../api/live';
import { getActiveBanners, getPromoBanner } from '../../api/banners';
import { subscribeSyncEvents, SYNC_EVENTS } from '../../utils/syncEvents';
import CourseCard from '../../components/CourseCard';
import StudentReviewsSection from '../../components/StudentReviewsSection';
import PromoBannerSection from '../../components/PromoBannerSection';
import EnrolledCoursesRowSection from '../../components/EnrolledCoursesRowSection';
import { resolveMediaUrl, resolvePublicAsset } from '../../utils/mediaUtils';
import { getCourseDefaultRating } from '../../utils/courseRatingUtils';

/** Status computation: completed/cancelled are respected; time-passed sessions show live */
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

const CATEGORY_PALETTES = [
  { icon: 'fa-solid fa-code', bg: 'rgba(90, 112, 211, 0.08)', color: '#5A70D3' },
  { icon: 'fa-solid fa-chart-column', bg: '#e0f2fe', color: '#0284c7' },
  { icon: 'fa-solid fa-cloud', bg: '#e0f7fa', color: '#0288d1' },
  { icon: 'fa-solid fa-bullhorn', bg: '#E8EBFA', color: '#16a34a' },
  { icon: 'fa-solid fa-gear', bg: '#ede9fe', color: '#111111' },
  { icon: 'fa-solid fa-palette', bg: '#fef3c7', color: '#d97706' },
  { icon: 'fa-solid fa-database', bg: '#fce7f3', color: '#db2777' },
  { icon: 'fa-solid fa-shield-halved', bg: '#fee2e2', color: '#dc2626' },
  { icon: 'fa-solid fa-mobile-screen', bg: '#e6fffa', color: '#00a884' },
];

function getCategoryStyle(cat, index) {
  const name = (typeof cat === 'string' ? cat : (cat?.name || '')).toLowerCase();
  if (name === 'all') {
    return { icon: 'fa-solid fa-border-all', bg: 'rgba(90, 112, 211, 0.08)', color: '#5A70D3' };
  }
  if (name.includes('devops') || name.includes('cloud') || name.includes('infra')) {
    return { icon: 'fa-solid fa-cloud', bg: '#e0f7fa', color: '#0288d1' };
  }
  if (name.includes('market')) {
    return { icon: 'fa-solid fa-bullhorn', bg: '#E8EBFA', color: '#16a34a' };
  }
  if (name.includes('web') || name.includes('dev') || name.includes('code') || name.includes('program')) {
    return { icon: 'fa-solid fa-code', bg: 'rgba(90, 112, 211, 0.08)', color: '#5A70D3' };
  }
  if (name.includes('data') || name.includes('analytic') || name.includes('bi')) {
    return { icon: 'fa-solid fa-chart-column', bg: '#e0f2fe', color: '#0284c7' };
  }
  if (name.includes('design') || name.includes('ui') || name.includes('ux')) {
    return { icon: 'fa-solid fa-palette', bg: '#fef3c7', color: '#d97706' };
  }
  if (name.includes('sql') || name.includes('db') || name.includes('database')) {
    return { icon: 'fa-solid fa-database', bg: '#ede9fe', color: '#111111' };
  }
  if (name.includes('ai') || name.includes('intelligence') || name.includes('machine')) {
    return { icon: 'fa-solid fa-brain', bg: '#fdf4ff', color: '#c026d3' };
  }
  return CATEGORY_PALETTES[index % CATEGORY_PALETTES.length];
}

const getCategoryPalette = getCategoryStyle;

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [banners, setBanners] = useState([]);
  const [promoBanner, setPromoBanner] = useState(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [isBannerHovered, setIsBannerHovered] = useState(false);

  const [continueLearning, setContinueLearning] = useState(null);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [catalogCourses, setCatalogCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [rawLiveSessions, setRawLiveSessions] = useState([]);
  const [upcomingLive, setUpcomingLive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const categoryScrollRef = useRef(null);
  const popularScrollRef = useRef(null);

  const scrollCategories = (dir = 1) => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' });
    }
  };

  const scrollPopularCourses = (dir = 1) => {
    if (popularScrollRef.current) {
      popularScrollRef.current.scrollBy({ left: dir * 320, behavior: 'smooth' });
    }
  };

  // Limit course cards: 2 rows on large (8 cards) and medium (6 cards), 4 rows on small (4 cards)
  const [maxVisibleCards, setMaxVisibleCards] = useState(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth;
      if (w >= 1024) return 8;
      if (w >= 768) return 6;
      return 4;
    }
    return 8;
  });

  useEffect(() => {
    function updateMaxCards() {
      const w = window.innerWidth;
      if (w >= 1680) {
        setMaxVisibleCards(10); // 5 columns x 2 rows
      } else if (w >= 1240) {
        setMaxVisibleCards(8); // 4 columns x 2 rows
      } else if (w >= 880) {
        setMaxVisibleCards(6); // 3 columns x 2 rows
      } else {
        setMaxVisibleCards(4); // 1-2 columns
      }
    }
    updateMaxCards();
    window.addEventListener('resize', updateMaxCards);
    return () => window.removeEventListener('resize', updateMaxCards);
  }, []);

  // Helper to re-filter live sessions based on latest current time
  const applyLiveFilter = useCallback((sessions) => {
    return (sessions || []).filter(s => {
      const eff = getLiveEffectiveStatus(s);
      return (eff === 'upcoming' || eff === 'live') && (s.canJoin !== false && s.enrolled !== false);
    });
  }, []);

  const refreshLiveSessions = useCallback(async () => {
    if (!user) {
      setRawLiveSessions([]);
      setUpcomingLive([]);
      return;
    }
    try {
      const live = await getLiveSessions();
      const list = live || [];
      setRawLiveSessions(list);
      setUpcomingLive(applyLiveFilter(list));
    } catch (e) {
      // silently ignore in background
    }
  }, [user, applyLiveFilter]);

  const courseOrderRef = useRef([]);

  const preserveCourseOrder = useCallback((fetchedCourses) => {
    const list = fetchedCourses || [];
    if (!courseOrderRef.current || courseOrderRef.current.length === 0) {
      courseOrderRef.current = list.map(c => String(c.id));
      return list;
    }
    const fetchedMap = new Map(list.map(c => [String(c.id), c]));
    const result = [];
    
    // Maintain exact card positions established on page load
    for (const id of courseOrderRef.current) {
      if (fetchedMap.has(id)) {
        result.push(fetchedMap.get(id));
        fetchedMap.delete(id);
      }
    }
    // Append any newly created courses at the end
    for (const course of list) {
      if (fetchedMap.has(String(course.id))) {
        result.push(course);
      }
    }
    courseOrderRef.current = result.map(c => String(c.id));
    return result;
  }, []);

  const refreshCatalogCourses = useCallback(async () => {
    try {
      const bc = await browseCourses({ size: 24 });
      const arr = bc?.content || [];
      setCatalogCourses(preserveCourseOrder(arr));
    } catch (e) {
      // silently ignore in background
    }
  }, [preserveCourseOrder]);

  const refreshBanners = useCallback(async () => {
    try {
      const [bannerList, promo] = await Promise.all([
        getActiveBanners().catch(() => []),
        getPromoBanner().catch(() => null),
      ]);
      setBanners(bannerList || []);
      setPromoBanner(promo || null);
    } catch (e) {
      // silently ignore in background
    }
  }, []);

  useEffect(() => {
    const studentPromises = user ? [
      getContinueLearning().catch(() => null),
      myCourses({ size: 50 }).catch(() => ({ content: [] })),
      getLiveSessions().catch(() => []),
    ] : [
      Promise.resolve(null),
      Promise.resolve({ content: [] }),
      Promise.resolve([]),
    ];

    Promise.all([
      getActiveBanners().catch(() => []),
      getPromoBanner().catch(() => null),
      browseCourses({ size: 24 }).catch(() => ({ content: [] })),
      listCategories({ size: 100 }).catch(() => ({ content: [] })),
      ...studentPromises,
    ]).then(([bannerList, promo, bc, cat, cl, mc, live]) => {
      setBanners(bannerList || []);
      setPromoBanner(promo);
      const arr = [...(bc?.content || [])];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      courseOrderRef.current = arr.map(c => String(c.id));
      setCatalogCourses(arr);
      setCategories(cat?.content || []);
      setContinueLearning(cl);
      setEnrolledCourses(mc?.content || []);
      const liveList = live || [];
      setRawLiveSessions(liveList);
      setUpcomingLive(applyLiveFilter(liveList));
      setLoading(false);
    });

    // 1. Cross-tab instant synchronization
    const unsub = subscribeSyncEvents((event) => {
      if (event.type === SYNC_EVENTS.LIVE_SESSIONS_CHANGED && user) {
        refreshLiveSessions();
      }
      if (event.type === SYNC_EVENTS.COURSES_CHANGED) {
        refreshCatalogCourses();
      }
      if (event.type === SYNC_EVENTS.BANNERS_CHANGED) {
        refreshBanners();
      }
    });

    // 2. Fast tick every 5s so scheduled times transition from upcoming to live automatically
    const tickInterval = setInterval(() => {
      if (user) {
        setRawLiveSessions(prev => {
          setUpcomingLive(applyLiveFilter(prev));
          return prev;
        });
      }
    }, 5_000);

    // 3. Periodic polling (8s for live sessions if logged in, 15s for catalog courses)
    const livePoll = user ? setInterval(refreshLiveSessions, 8_000) : null;
    const coursePoll = setInterval(refreshCatalogCourses, 15_000);

    // 4. Tab focus / visibility update
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        if (user) refreshLiveSessions();
        refreshCatalogCourses();
        refreshBanners();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsub();
      clearInterval(tickInterval);
      if (livePoll) clearInterval(livePoll);
      clearInterval(coursePoll);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user, applyLiveFilter, refreshLiveSessions, refreshCatalogCourses]);

  const defaultHeroFallback = resolvePublicAsset('hero-banner.png');

  const displayBanners = banners && banners.length > 0
    ? banners
    : [{ id: 'default-hero', imageUrl: defaultHeroFallback, ctaLink: '/student/courses' }];

  // Auto-advance banner carousel every 6.5 seconds when not hovered
  useEffect(() => {
    if (displayBanners.length <= 1 || isBannerHovered) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex(prev => (prev + 1) % displayBanners.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [displayBanners.length, isBannerHovered]);

  const prevSlide = () => {
    setCurrentBannerIndex(prev => (prev === 0 ? displayBanners.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrentBannerIndex(prev => (prev + 1) % displayBanners.length);
  };

  const handleBannerClick = (link) => {
    const target = link || '/student/courses';
    if (target.startsWith('http://') || target.startsWith('https://')) {
      window.open(target, '_blank');
    } else {
      navigate(target);
    }
  };

  const enrolledCourseIds = new Set(enrolledCourses.map(c => String(c.courseId)));

  const categoryPills = [
    { id: 'all', name: 'ALL', description: 'All courses across all domains' },
    ...(categories || [])
  ];

  const filteredCourses = (selectedCategory === 'ALL'
    ? catalogCourses
    : catalogCourses.filter(c => c.categoryName === selectedCategory)
  ).filter(c => {
    const status = (c.status || c.courseStatus || '').toLowerCase();
    if (status && status !== 'published' && !enrolledCourseIds.has(String(c.id))) {
      return false;
    }
    return true;
  });

  const continueCourse = (user && continueLearning)
    ? (enrolledCourses.find(c => String(c.courseId) === String(continueLearning.courseId)) ||
       catalogCourses.find(c => String(c.id) === String(continueLearning.courseId)) ||
       continueLearning)
    : null;

  const activeContinueCourse = user
    ? (continueCourse || (enrolledCourses && enrolledCourses.length > 0 ? enrolledCourses[0] : null))
    : null;


  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '40px' }}>
      {/* ====================================================================
          1. DYNAMIC TOP HERO BANNER (100% FULL-WIDTH EDGE-TO-EDGE FROM TABLE)
          ==================================================================== */}
      <section className="ot-hero-dynamic-section">
        <div
          className="ot-banner-carousel-wrap"
          onMouseEnter={() => setIsBannerHovered(true)}
          onMouseLeave={() => setIsBannerHovered(false)}
        >
          {displayBanners.map((banner, idx) => {
            const isActive = idx === currentBannerIndex;
            return (
              <div
                key={banner.id || idx}
                className={`ot-banner-slide ${isActive ? 'active' : ''}`}
                onClick={() => handleBannerClick(banner.ctaLink)}
                style={{ cursor: banner.ctaLink ? 'pointer' : 'default' }}
              >
                <img
                  src={resolveMediaUrl(banner.imageUrl) || defaultHeroFallback}
                  alt="OneTutor Hero Banner"
                  className="ot-banner-hero-img"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    if (e.currentTarget.src !== defaultHeroFallback && !e.currentTarget.src.endsWith('hero-banner.png')) {
                      e.currentTarget.src = defaultHeroFallback;
                    } else {
                      e.currentTarget.style.display = 'none';
                    }
                  }}
                />
              </div>
            );
          })}

          {displayBanners.length > 1 && (
            <>
              <button
                type="button"
                className="ot-banner-arrow ot-banner-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  prevSlide();
                }}
                aria-label="Previous banner"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <button
                type="button"
                className="ot-banner-arrow ot-banner-next"
                onClick={(e) => {
                  e.stopPropagation();
                  nextSlide();
                }}
                aria-label="Next banner"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>

              <div className="ot-banner-dots">
                {displayBanners.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    type="button"
                    className={`ot-banner-dot ${dotIdx === currentBannerIndex ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentBannerIndex(dotIdx);
                    }}
                    aria-label={`Go to banner ${dotIdx + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ====================================================================
          3. CONTINUE LEARNING SECTION
          ==================================================================== */}
      {user && activeContinueCourse && (
        <section className="ot-continue-learning-section">
          <div className="ot-continue-card">
            <div className="ot-continue-header-row">
              <h3 className="ot-continue-title">Continue Learning</h3>
              <p className="ot-continue-subtitle">Pick up where you left off and keep going!</p>
            </div>

            <div className="ot-continue-body-row">
              <div className="ot-continue-course-info">
                <div className="ot-continue-thumb-box">
                  {activeContinueCourse?.courseThumbnail || activeContinueCourse?.thumbnail ? (
                    <img
                      src={resolveMediaUrl(activeContinueCourse.courseThumbnail || activeContinueCourse.thumbnail)}
                      alt={activeContinueCourse.courseName || activeContinueCourse.name || activeContinueCourse.title || 'Course'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <>
                      <div className="ot-continue-thumb-icons">
                        <i className="fa-brands fa-react" style={{ color: '#38bdf8' }}></i>
                        <i className="fa-brands fa-node-js" style={{ color: '#22c55e' }}></i>
                      </div>
                      <span className="ot-continue-thumb-title">MERN STACK</span>
                    </>
                  )}
                </div>

                <div className="ot-continue-details">
                  <span className="ot-badge-in-progress">In Progress</span>
                  <h4 className="ot-continue-course-title">
                    {activeContinueCourse?.courseName || activeContinueCourse?.name || activeContinueCourse?.title || 'Course'}
                  </h4>
                  <div className="ot-continue-lesson-info">
                    <span>Section: <strong>{continueLearning?.sectionTitle || activeContinueCourse?.sectionTitle || 'Course Curriculum'}</strong></span>
                    <span>•</span>
                    <span>Lesson: <strong>{continueLearning?.lessonTitle || activeContinueCourse?.lessonTitle || 'Current Lesson'}</strong></span>
                  </div>

                  <div className="ot-continue-progress-wrap">
                    <div className="ot-continue-progress-track">
                      <div
                        className="ot-continue-progress-fill"
                        style={{ width: `${continueLearning?.courseProgressPercent ?? (activeContinueCourse?.progressPercent ?? 0)}%` }}
                      ></div>
                    </div>
                    <span className="ot-continue-progress-percent">
                      {continueLearning?.courseProgressPercent ?? (activeContinueCourse?.progressPercent ?? 0)}% complete
                    </span>
                  </div>
                </div>
              </div>

              <div className="ot-continue-doodle">
                <i className="fa-regular fa-lightbulb ot-doodle-icon"></i>
                <div className="ot-doodle-text">
                  Small<br />Progress<br />Leads to<br />Big Results
                </div>
              </div>

              <div className="ot-continue-actions">
                <Link
                  to={`/student/learn/${activeContinueCourse?.courseId || activeContinueCourse?.id}`}
                  className="ot-continue-resume-btn"
                >
                  <span>Resume Lesson</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </Link>
                <Link to="/student/my-courses" className="ot-continue-mylearning-link">
                  <span>Go to My Learning</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ====================================================================
          4. POPULAR COURSES SECTION (DYNAMIC DATABASE COURSES ONLY)
          ==================================================================== */}
      <section className="ot-popular-courses-section">
        <div className="ot-popular-header">
          <div>
            <h2 className="ot-popular-title">Popular Courses</h2>
            <p className="ot-popular-subtitle">
              Learn from industry experts and build skills for a better tomorrow.
            </p>
          </div>
          <Link to="/student/courses" className="ot-popular-viewall">
            <span>View All Courses</span>
            <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>

        <div className="ot-popular-grid-wrap">
          <div className="ot-popular-cards-grid" ref={popularScrollRef}>
            {filteredCourses.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', padding: '48px 24px', textAlign: 'center', background: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
                <i className="fa-solid fa-graduation-cap" style={{ fontSize: '2.5rem', color: '#5A70D3', marginBottom: '12px' }}></i>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Explore All Courses</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Browse our full course catalog to discover expert-led tracks.</p>
                <Link to="/student/courses" style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#5A70D3', color: '#FFFFFF', padding: '10px 22px', borderRadius: '9999px', fontWeight: 700, textDecoration: 'none' }}>
                  Browse Catalog
                </Link>
              </div>
            ) : (
              filteredCourses.slice(0, maxVisibleCards).map((course) => {
                const isEnrolled = enrolledCourseIds.has(String(course.id));

                return (
                  <Link
                    key={course.id}
                    to={`/student/courses/${course.id}`}
                    className="ot-course-card-v2"
                  >
                    {/* Top Banner Graphic / Thumbnail */}
                    <div className="ot-course-banner-wrap">
                      {course.level && (
                        <span className="ot-course-badge-level">{course.level}</span>
                      )}

                      {course.duration && (
                        <span className="ot-course-duration-pill">
                          <i className="fa-regular fa-clock"></i>
                          <span>{course.duration}</span>
                        </span>
                      )}

                      {course.thumbnail ? (
                        <img
                          src={course.thumbnail}
                          alt={course.name}
                          className="ot-course-real-thumb"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fb = e.currentTarget.parentNode.querySelector('.ot-course-banner-inner');
                            if (fb) fb.style.display = 'flex';
                          }}
                        />
                      ) : null}

                      <div
                        className="ot-course-banner-inner"
                        style={{ display: course.thumbnail ? 'none' : 'flex' }}
                      >
                        <i className="fa-solid fa-graduation-cap ot-course-banner-icon"></i>
                        <span className="ot-course-banner-text">{course.categoryName || 'OneTutor'}</span>
                      </div>
                    </div>

                    {/* Course Details stored in DB */}
                    <div className="ot-course-v2-body">
                      {course.categoryName && (
                        <div className="ot-course-v2-cat">
                          <span>{course.categoryName}</span>
                        </div>
                      )}

                      <h3 className="ot-course-v2-title" title={course.name}>
                        {course.name}
                      </h3>

                      {course.shortDesc && (
                        <p className="ot-course-v2-desc" title={course.shortDesc}>
                          {course.shortDesc}
                        </p>
                      )}

                      {/* Rating row with auto rating & counts */}
                      {(() => {
                        const ratingData = getCourseDefaultRating(course.id);
                        const score = course.rating ? Number(course.rating).toFixed(1) : ratingData.averageRating.toFixed(1);
                        const count = course.reviewsCount || ratingData.totalReviews;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#b45309' }}>
                              {score}
                            </span>
                            <span style={{ color: '#f59e0b', fontSize: '0.74rem' }}>
                              <i className="fa-solid fa-star"></i>
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>
                              ({count})
                            </span>
                          </div>
                        );
                      })()}

                      <div className="ot-course-v2-footer">
                        <span className="ot-course-v2-tag">
                          {isEnrolled ? 'Enrolled' : 'Free'}
                        </span>
                        {course.language && (
                          <span className="ot-course-v2-lang">
                            <i className="fa-solid fa-globe" style={{ fontSize: '0.74rem' }}></i>
                            <span>{course.language}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {filteredCourses.length > maxVisibleCards && (
            <button
              type="button"
              className="ot-carousel-nav-arrow desktop-only"
              onClick={() => scrollPopularCourses(1)}
              aria-label="Next courses"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          )}
        </div>
      </section>

      {/* ====================================================================
          VIDEO TRAILER MODAL
          ==================================================================== */}
      {showVideoModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowVideoModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              width: '760px',
              maxWidth: '100%',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#5A70D3' }}></div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  Explore OneTutor Real-World Learning
                </h3>
              </div>
              <button
                onClick={() => setShowVideoModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, background: '#0f172a' }}>
              <iframe
                src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"
                title="OneTutor Overview Video"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        </div>
      )}
 
      {/* ====================================================================
          PROMOTIONAL BANNER (Controlled by Admin)
          ==================================================================== */}
      {promoBanner && promoBanner.active !== false && promoBanner.active !== 'false' && (
        <PromoBannerSection banner={promoBanner} />
      )}

      {/* ====================================================================
          DYNAMIC LEARNING ROADMAP / TECH SKILLS SECTION (Only for Logged-In Students with Enrolled Courses)
          ==================================================================== */}
      {user && enrolledCourses.length > 0 && (
        <EnrolledCoursesRowSection
          courses={enrolledCourses}
          continueLearning={continueLearning}
        />
      )}

      {/* ====================================================================
          UPCOMING LIVE WEBINARS & SESSIONS STRIP
          ==================================================================== */}
      {upcomingLive.length > 0 && (
        <section style={{ background: 'var(--ud-light-gray)', borderTop: '1px solid var(--ud-border)', borderBottom: '1px solid var(--ud-border)', padding: '40px 0' }}>
          <div style={{ maxWidth: '1760px', margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 className="ud-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-tower-broadcast" style={{ color: '#ef4444' }}></i>
                  <span>Live Classes & Workshops</span>
                </h2>
                <p className="ud-section-subtitle" style={{ margin: '4px 0 0 0' }}>Join live interactive sessions with lead instructors</p>
              </div>
              <Link to="/student/live-classes" style={{ color: 'var(--ud-purple)', fontWeight: 700, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span>View all live sessions</span>
                <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.8rem' }}></i>
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {upcomingLive.map(s => {
                const eff = getLiveEffectiveStatus(s);
                return (
                <div
                  key={s.id}
                  style={{
                    background: 'var(--ud-white)',
                    border: eff === 'live' ? '2px solid #ef4444' : '1px solid var(--ud-border)',
                    borderRadius: '8px',
                    padding: '24px',
                    boxShadow: 'var(--ud-shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span
                        style={{
                          background: eff === 'live' ? '#ef4444' : 'var(--ud-purple)',
                          color: '#fff',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {eff === 'live' ? (
                          <>
                            <i className="fa-solid fa-bolt"></i> LIVE NOW
                          </>
                        ) : (
                          'UPCOMING'
                        )}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--ud-gray)', fontWeight: 600 }}>
                          {s.courseName}
                        </div>
                        {s.batchName ? (
                          <span style={{ fontSize: '0.72rem', color: 'var(--ud-purple)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <i className="fa-solid fa-users-rectangle"></i> {s.batchName}{s.batchCode ? ` • ${s.batchCode}` : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--ud-gray)' }}>
                            All Batches
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--ud-black)', marginBottom: '8px' }}>
                      {s.title}
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--ud-gray)', marginBottom: '16px' }}>
                      {new Date(s.scheduledAt).toLocaleString()}
                    </p>
                  </div>

                  {s.meetingUrl ? (
                    <a
                      href={s.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ud-btn-primary"
                      style={{ width: '100%', background: eff === 'live' ? '#ef4444' : 'var(--ud-purple)', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      {eff === 'live' ? (
                        <>
                          <i className="fa-solid fa-bolt"></i> Join Live Now
                        </>
                      ) : (
                        <>
                          Join Meeting <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.78rem' }}></i>
                        </>
                      )}
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.84rem', color: 'var(--ud-gray)' }}>Link will appear before class starts</span>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ====================================================================
          STUDENT REVIEWS & TESTIMONIALS SECTION
          ==================================================================== */}
      <StudentReviewsSection courses={catalogCourses} />

      {/* ====================================================================
          ONETUTOR VALUE PROPOSITIONS STRIP
          ==================================================================== */}
      <section className="ud-value-strip">
        <div className="ud-value-inner">
          <div className="ud-value-col">
            <div className="ud-value-icon">
              <i className="fa-solid fa-clock"></i>
            </div>
            <div>
              <div className="ud-value-title">Learn at your own pace</div>
              <div className="ud-value-desc">Enjoy lifetime access to courses on OneTutor’s website.</div>
            </div>
          </div>

          <div className="ud-value-col">
            <div className="ud-value-icon">
              <i className="fa-solid fa-chalkboard-user"></i>
            </div>
            <div>
              <div className="ud-value-title">Learn from industry experts</div>
              <div className="ud-value-desc">Select from top instructors with proven production engineering experience.</div>
            </div>
          </div>

          <div className="ud-value-col">
            <div className="ud-value-icon">
              <i className="fa-solid fa-award"></i>
            </div>
            <div>
              <div className="ud-value-title">Course progress & certification</div>
              <div className="ud-value-desc">Track every lecture and complete exercises to achieve certifications.</div>
            </div>
          </div>

          <div className="ud-value-col">
            <div className="ud-value-icon">
              <i className="fa-solid fa-video"></i>
            </div>
            <div>
              <div className="ud-value-title">Live interactive sessions</div>
              <div className="ud-value-desc">Connect directly with tutors during real-time live video webinars.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
