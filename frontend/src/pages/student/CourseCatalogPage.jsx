import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { browseCourses } from '../../api/courses';
import { listCategories } from '../../api/categories';
import { myCourses } from '../../api/enrollment';
import { subscribeSyncEvents, SYNC_EVENTS } from '../../utils/syncEvents';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import { getCourseDefaultRating } from '../../utils/courseRatingUtils';

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

export default function CourseCatalogPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialCatId = searchParams.get('categoryId') || '';

  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [search, setSearch] = useState(initialSearch);
  const [categoryId, setCategoryId] = useState(initialCatId);
  const [level, setLevel] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [showDesktopFilters, setShowDesktopFilters] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Sync state with URL params (supports categoryId or category name parameter)
  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    const paramCatId = searchParams.get('categoryId') || '';
    const paramCatName = searchParams.get('category') || '';
    if (paramCatId) {
      setCategoryId(paramCatId);
    } else if (paramCatName && categories.length > 0) {
      const found = categories.find(c => c.name.toLowerCase() === paramCatName.toLowerCase());
      if (found) {
        setCategoryId(String(found.id));
      } else {
        setCategoryId('');
      }
    } else {
      setCategoryId('');
    }
  }, [searchParams, categories]);

  useEffect(() => {
    listCategories({ size: 100 })
      .then(data => setCategories(data?.content || []))
      .catch(() => {});

    if (user) {
      myCourses({ size: 100 })
        .then(data => {
          const ids = new Set((data?.content || []).map(c => String(c.courseId)));
          setEnrolledIds(ids);
        })
        .catch(() => {});
    } else {
      setEnrolledIds(new Set());
    }
  }, [user]);

  const fetchCourses = useCallback((showSpinner = true) => {
    if (showSpinner) setLoading(true);
    browseCourses({
      search: search || undefined,
      categoryId: categoryId || undefined,
      size: 60
    })
      .then(data => setCourses(data?.content || []))
      .catch(() => setCourses([]))
      .finally(() => {
        if (showSpinner) setLoading(false);
      });
  }, [search, categoryId]);

  useEffect(() => {
    fetchCourses(true);

    // Cross-tab instant synchronization when courses change
    const unsub = subscribeSyncEvents((event) => {
      if (event.type === SYNC_EVENTS.COURSES_CHANGED) {
        fetchCourses(false);
      }
    });

    // Polling fallback
    const pollInterval = setInterval(() => fetchCourses(false), 12_000);

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchCourses(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsub();
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchCourses]);

  function handleFilterChange(newCatId) {
    setCategoryId(newCatId);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('category');
    if (newCatId) {
      newParams.set('categoryId', newCatId);
      const catObj = categories.find(c => String(c.id) === String(newCatId));
      if (catObj?.name) {
        newParams.set('category', catObj.name);
      }
    } else {
      newParams.delete('categoryId');
    }
    setSearchParams(newParams);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (search.trim()) {
      newParams.set('search', search.trim());
    } else {
      newParams.delete('search');
    }
    setSearchParams(newParams);
  }

  function handleClearSearch() {
    setSearch('');
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    setSearchParams(newParams);
  }

  function handleClearAll() {
    setSearch('');
    setCategoryId('');
    setLevel('ALL');
    setSearchParams({});
  }

  // Filter in-memory for level and published status (hide non-published cards for unenrolled users)
  let filteredCourses = courses.filter(c => {
    if (level !== 'ALL' && c.level && c.level.toLowerCase() !== level.toLowerCase()) {
      return false;
    }
    const status = (c.status || c.courseStatus || '').toLowerCase();
    if (status && status !== 'published' && !enrolledIds.has(String(c.id))) {
      return false;
    }
    return true;
  });

  const activeCategory = categories.find(c => String(c.id) === String(categoryId));

  // Build active filter chips
  const activeChips = [];
  if (search) {
    activeChips.push({
      key: 'search',
      label: `"${search}"`,
      onRemove: handleClearSearch
    });
  }
  if (categoryId && activeCategory) {
    activeChips.push({
      key: 'category',
      label: activeCategory.name,
      onRemove: () => handleFilterChange('')
    });
  }
  if (level !== 'ALL') {
    activeChips.push({
      key: 'level',
      label: `Level: ${level}`,
      onRemove: () => setLevel('ALL')
    });
  }

  const activeCount = activeChips.length;

  const renderFilterSections = () => (
    <>
      {/* Category Filter */}
      <div className="ot-catalog-sidebar-group">
        <div className="ot-catalog-sidebar-title">
          <i className="fa-solid fa-layer-group" style={{ color: '#5A70D3', fontSize: '0.9rem' }}></i>
          <span>Category</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className={`ot-catalog-radio-label ${!categoryId ? 'active' : ''}`}>
            <input
              type="radio"
              name="catalogCategory"
              checked={!categoryId}
              onChange={() => handleFilterChange('')}
              style={{ display: 'none' }}
            />
            <span className="ot-radio-circle">
              <span className="ot-radio-dot"></span>
            </span>
            <span>All Categories</span>
          </label>
          {(showAllCategories ? categories : categories.slice(0, 5)).map(c => {
            const isCatActive = String(categoryId) === String(c.id);
            return (
              <label key={c.id} className={`ot-catalog-radio-label ${isCatActive ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="catalogCategory"
                  checked={isCatActive}
                  onChange={() => handleFilterChange(String(c.id))}
                  style={{ display: 'none' }}
                />
                <span className="ot-radio-circle">
                  <span className="ot-radio-dot"></span>
                </span>
                <span>{c.name}</span>
              </label>
            );
          })}
          {categories.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAllCategories(!showAllCategories)}
              style={{
                background: 'none',
                border: 'none',
                color: '#5A70D3',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '6px 10px',
                textAlign: 'left',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '4px',
                borderRadius: '8px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(90, 112, 211, 0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{showAllCategories ? 'Show Less' : `+ Show More (${categories.length - 5})`}</span>
              <i className={`fa-solid ${showAllCategories ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ fontSize: '0.72rem' }}></i>
            </button>
          )}
        </div>
      </div>

      {/* Level Filter */}
      <div className="ot-catalog-sidebar-group">
        <div className="ot-catalog-sidebar-title">
          <i className="fa-solid fa-signal" style={{ color: '#5A70D3', fontSize: '0.9rem' }}></i>
          <span>Skill Level</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {['ALL', 'Beginner', 'Intermediate', 'Advanced'].map(lvl => {
            const isLvlActive = level === lvl;
            return (
              <label key={lvl} className={`ot-catalog-radio-label ${isLvlActive ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="catalogLevel"
                  checked={isLvlActive}
                  onChange={() => setLevel(lvl)}
                  style={{ display: 'none' }}
                />
                <span className="ot-radio-circle">
                  <span className="ot-radio-dot"></span>
                </span>
                <span>{lvl === 'ALL' ? 'All Levels' : lvl}</span>
              </label>
            );
          })}
        </div>
      </div>
    </>
  );

  return (
    <div className="ot-catalog-page">
      <div className="ot-catalog-container">
        {/* Header Title */}
        <div className="ot-catalog-header-wrap">
          <div>
            <h1 className="ot-catalog-title">
              {search ? (
                <>Results for &ldquo;<span style={{ color: '#5A70D3' }}>{search}</span>&rdquo;</>
              ) : activeCategory ? (
                <>Explore <span style={{ color: '#5A70D3' }}>{activeCategory.name}</span></>
              ) : (
                <>Explore <span style={{ color: '#5A70D3' }}>Courses</span></>
              )}
            </h1>
            <p className="ot-catalog-subtitle">
              Discover industry-led courses, master real-world tools, and accelerate your career.
            </p>
          </div>

          {/* Mobile Filter Button (visible on small devices) */}
          <div className="ot-catalog-search-wrap" style={{ width: 'auto', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="ot-catalog-mobile-filter-trigger"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open Filters"
            >
              <i className="fa-solid fa-sliders"></i>
              <span>Filters</span>
              {activeCount > 0 && (
                <span className="ot-catalog-filter-badge">{activeCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Toolbar: Filter Toggle, Level Quick Filters, Sort Dropdown */}
        <div className="ot-catalog-toolbar">
          <div className="ot-catalog-toolbar-left">
            <button
              type="button"
              className="ot-catalog-filter-btn"
              onClick={() => {
                if (window.innerWidth < 900) {
                  setMobileDrawerOpen(true);
                } else {
                  setShowDesktopFilters(!showDesktopFilters);
                }
              }}
            >
              <i className="fa-solid fa-sliders" style={{ color: '#5A70D3' }}></i>
              <span>{showDesktopFilters ? 'Hide Filters' : 'Show Filters'}</span>
            </button>

            {/* Quick Level Pills */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {['ALL', 'Beginner', 'Intermediate', 'Advanced'].map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  className={`ot-catalog-level-pill ${level === lvl ? 'active' : ''}`}
                  onClick={() => setLevel(lvl)}
                >
                  {lvl === 'ALL' ? 'All Levels' : lvl}
                </button>
              ))}
            </div>

            {activeCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '6px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <i className="fa-solid fa-trash-can" style={{ fontSize: '0.76rem' }}></i>
                <span>Clear all</span>
              </button>
            )}
          </div>
        </div>

        {/* Split Layout: Filter Sidebar + Courses Grid */}
        <div className="ot-catalog-layout">
          {/* Desktop Filter Sidebar */}
          {showDesktopFilters && (
            <aside className="ot-catalog-sidebar">
              {renderFilterSections()}
            </aside>
          )}

          {/* Results Main Area */}
          <main className="ot-catalog-main">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#5A70D3', marginBottom: '14px' }}></i>
                <div style={{ fontSize: '0.96rem', fontWeight: 600 }}>Loading available courses...</div>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="ot-catalog-empty">
                <div style={{ fontSize: '2.8rem', color: '#cbd5e1', marginBottom: '14px' }}>
                  <i className="fa-solid fa-magnifying-glass"></i>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0b1f3a', margin: '0 0 8px 0' }}>
                  No courses found
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '0 auto 20px auto', maxWidth: '440px', lineHeight: 1.5 }}>
                  We couldn't find any courses matching your filters. Try clearing your search or switching to another category.
                </p>
                <button
                  type="button"
                  className="ot-drawer-apply-btn"
                  onClick={handleClearAll}
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="ot-catalog-grid">
                {filteredCourses.map(course => {
                  const isEnrolled = enrolledIds.has(String(course.id));
                  const thumb = resolveMediaUrl(course.thumbnail || course.thumbnailUrl || course.imageUrl);

                  return (
                    <Link
                      key={course.id}
                      to={`/student/courses/${course.id}`}
                      className="ot-course-card-v2"
                    >
                      {/* Top Banner Graphic / Thumbnail */}
                      <div className="ot-course-banner-wrap">
                        {isEnrolled ? (
                          <span className="ot-course-badge-enrolled">
                            <i className="fa-solid fa-check" style={{ fontSize: '0.65rem' }}></i>
                            <span>Enrolled</span>
                          </span>
                        ) : course.level ? (
                          <span className="ot-course-badge-level">{course.level}</span>
                        ) : null}

                        {course.duration && (
                          <span className="ot-course-duration-pill">
                            <i className="fa-regular fa-clock"></i>
                            <span>{course.duration}</span>
                          </span>
                        )}

                        {thumb ? (
                          <>
                            <img
                              src={thumb}
                              alt=""
                              aria-hidden="true"
                              style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                filter: 'blur(16px) brightness(0.95)',
                                transform: 'scale(1.2)',
                                pointerEvents: 'none',
                                opacity: 0.65,
                              }}
                            />
                            <img
                              src={thumb}
                              alt={course.name}
                              className="ot-course-real-thumb"
                              style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fb = e.currentTarget.parentNode?.querySelector('.ot-course-banner-inner');
                                if (fb) fb.style.display = 'flex';
                              }}
                            />
                          </>
                        ) : null}

                        <div
                          className="ot-course-banner-inner"
                          style={{ display: thumb ? 'none' : 'flex' }}
                        >
                          <i className="fa-solid fa-graduation-cap ot-course-banner-icon"></i>
                          <span className="ot-course-banner-text">{course.categoryName || 'OneTutor'}</span>
                        </div>
                      </div>

                      {/* Course Details */}
                      <div className="ot-course-v2-body">
                        {course.categoryName && (
                          <div className="ot-course-v2-cat">
                            <i className="fa-solid fa-tag" style={{ fontSize: '0.7rem' }}></i>
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
                })}
              </div>
            )}
          </main>
        </div>

        {/* Mobile Filter Drawer Modal */}
        <div
          className={`ud-mobile-filter-backdrop ${mobileDrawerOpen ? 'open' : ''}`}
          onClick={() => setMobileDrawerOpen(false)}
        />
        <div className={`ud-mobile-filter-drawer ${mobileDrawerOpen ? 'open' : ''}`}>
          <div className="ud-drawer-header">
            <div className="ud-drawer-title">
              <i className="fa-solid fa-sliders" style={{ color: '#5A70D3' }}></i>
              <span>Filters</span>
              {activeCount > 0 && (
                <span
                  style={{
                    background: '#5A70D3',
                    color: '#FFFFFF',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '9999px',
                    marginLeft: '4px'
                  }}
                >
                  {activeCount}
                </span>
              )}
            </div>
            <button
              type="button"
              className="ud-drawer-close-btn"
              onClick={() => setMobileDrawerOpen(false)}
              aria-label="Close filters"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="ud-drawer-body">
            {renderFilterSections()}
          </div>

          <div className="ud-drawer-footer">
            {activeCount > 0 && (
              <button
                type="button"
                className="ot-drawer-clear-btn"
                onClick={handleClearAll}
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              className="ot-drawer-apply-btn"
              style={{ flex: 1 }}
              onClick={() => setMobileDrawerOpen(false)}
            >
              Show {filteredCourses.length} {filteredCourses.length === 1 ? 'Course' : 'Courses'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
