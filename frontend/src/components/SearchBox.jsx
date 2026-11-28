import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { browseCourses } from '../api/courses';
import { listCategories } from '../api/categories';
import {
  recordSearch,
  recordCourseSearch,
  getTopSearchedCourses,
  getTopSearchQueries
} from '../utils/searchAnalytics';

/**
 * Helper component that renders text with exact matched query substring highlighted.
 * Preserves original case and handles special regex characters safely.
 */
function HighlightMatch({ text, query }) {
  if (!text) return null;
  const trimmed = (query || '').trim();
  if (!trimmed) return <span>{text}</span>;

  try {
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <strong key={i} style={{ color: 'var(--ud-purple)', fontWeight: 800 }}>
              {part}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  } catch {
    return <span>{text}</span>;
  }
}

const DEFAULT_POPULAR_TOPICS = [
  'Spring Boot',
  'MERN Stack',
  'React',
  'Microservices',
  'Cloud Native',
  'Java',
  'PostgreSQL',
  'JavaScript',
  'Web Development'
];

export default function SearchBox({
  isMobileModal = false,
  isOpen = false,
  onClose = () => {}
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [analyticsVersion, setAnalyticsVersion] = useState(0);

  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Sync when search analytics updates across tabs or searches
  useEffect(() => {
    const handleAnalyticsUpdate = () => setAnalyticsVersion(v => v + 1);
    window.addEventListener('onetutor-search-analytics-updated', handleAnalyticsUpdate);
    window.addEventListener('storage', handleAnalyticsUpdate);
    return () => {
      window.removeEventListener('onetutor-search-analytics-updated', handleAnalyticsUpdate);
      window.removeEventListener('storage', handleAnalyticsUpdate);
    };
  }, []);

  // Compute top 4 most searched courses dynamically
  const topSearchedCourses = useMemo(() => {
    return getTopSearchedCourses(courses, 4);
  }, [courses, analyticsVersion]);

  // Compute top popular search queries dynamically
  const dynamicPopularTopics = useMemo(() => {
    return getTopSearchQueries(8);
  }, [analyticsVersion]);

  // Preload courses & categories for instant suggestions
  useEffect(() => {
    browseCourses({ size: 100 })
      .then(res => setCourses(res?.content || []))
      .catch(() => {});

    listCategories({ size: 50 })
      .then(res => setCategories(res?.content || []))
      .catch(() => {});
  }, []);

  // Autofocus input when mobile modal opens
  useEffect(() => {
    if (isMobileModal && isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isMobileModal, isOpen]);

  // Click outside to close desktop dropdown
  useEffect(() => {
    if (isMobileModal) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileModal]);

  // Compute live suggestions from query
  const suggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return { categories: [], keywords: [], courses: [] };
    }

    // 1. Categories match
    const matchedCategories = categories
      .filter(cat => cat.name?.toLowerCase().includes(trimmed))
      .slice(0, 3)
      .map(cat => ({
        type: 'category',
        id: cat.id,
        name: cat.name,
        targetUrl: `/student/courses?categoryId=${cat.id}`
      }));

    // 2. Real keyword & topic suggestions
    const keywordSet = new Set();

    // From course titles
    courses.forEach(c => {
      if (c.name?.toLowerCase().includes(trimmed)) {
        keywordSet.add(c.name);
      }
    });

    // From category names
    matchedCategories.forEach(c => {
      keywordSet.add(c.name);
    });

    // From curated popular topics
    DEFAULT_POPULAR_TOPICS.forEach(topic => {
      if (topic.toLowerCase().includes(trimmed)) {
        keywordSet.add(topic);
      }
    });

    const matchedKeywords = Array.from(keywordSet)
      .slice(0, 5)
      .map(kw => ({
        type: 'keyword',
        text: kw,
        targetUrl: `/student/courses?search=${encodeURIComponent(kw)}`
      }));

    // 3. Direct matching courses
    const matchedCourses = courses
      .filter(c =>
        c.name?.toLowerCase().includes(trimmed) ||
        c.categoryName?.toLowerCase().includes(trimmed) ||
        c.level?.toLowerCase().includes(trimmed) ||
        c.shortDesc?.toLowerCase().includes(trimmed)
      )
      .slice(0, 4)
      .map(c => ({
        type: 'course',
        id: c.id,
        name: c.name,
        thumbnail: c.thumbnail,
        categoryName: c.categoryName,
        level: c.level,
        targetUrl: `/student/courses/${c.id}`
      }));

    return {
      categories: matchedCategories,
      keywords: matchedKeywords,
      courses: matchedCourses
    };
  }, [query, courses, categories]);

  // Flat list of all navigable suggestion items
  const flatItems = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const items = [];
    // Add category items
    suggestions.categories.forEach(item => items.push(item));
    // Add keyword items (skip if duplicate text as category)
    const catNames = new Set(suggestions.categories.map(c => c.name.toLowerCase()));
    suggestions.keywords.forEach(item => {
      if (!catNames.has(item.text.toLowerCase())) {
        items.push(item);
      }
    });
    // Add direct courses
    suggestions.courses.forEach(item => items.push(item));
    // Add "See all results"
    items.push({
      type: 'all',
      text: query,
      targetUrl: `/student/courses?search=${encodeURIComponent(trimmed)}`
    });

    return items;
  }, [suggestions, query]);

  function handleItemClick(item) {
    if (item.type === 'course') {
      recordCourseSearch(item.id, item.name);
    } else if (item.type === 'keyword' || item.type === 'all') {
      recordSearch(item.text);
    }
    setShowDropdown(false);
    setActiveIndex(-1);
    setQuery('');
    onClose();
    navigate(item.targetUrl);
  }

  function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = query.trim();
    if (activeIndex >= 0 && flatItems[activeIndex]) {
      handleItemClick(flatItems[activeIndex]);
      return;
    }
    setShowDropdown(false);
    setActiveIndex(-1);
    onClose();
    if (trimmed) {
      const matchedCourseIds = suggestions.courses.map(c => c.id);
      recordSearch(trimmed, matchedCourseIds);
      navigate(`/student/courses?search=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/student/courses');
    }
  }

  function handleKeyDown(e) {
    if (!showDropdown && !isMobileModal) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length === 0) return;
      setActiveIndex(prev => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatItems.length === 0) return;
      setActiveIndex(prev => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && flatItems[activeIndex]) {
        e.preventDefault();
        handleItemClick(flatItems[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
      if (isMobileModal) onClose();
    }
  }

  // =========================================================================
  // MOBILE AMAZON-STYLE SEARCH OVERLAY
  // =========================================================================
  if (isMobileModal) {
    if (!isOpen) return null;

    return (
      <div className="ud-amazon-search-overlay">
        {/* Top Search Bar Header */}
        <div className="ud-amazon-search-header">
          <button
            type="button"
            className="ud-amazon-back-btn"
            onClick={onClose}
            aria-label="Back / Close search"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>

          <form className="ud-amazon-search-input-wrap" onSubmit={handleSubmit}>
            <span className="ud-amazon-input-icon">
              <i className="fa-solid fa-magnifying-glass"></i>
            </span>
            <input
              ref={inputRef}
              type="text"
              className="ud-amazon-input"
              placeholder="Search OneTutor courses, topics..."
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={handleKeyDown}
            />
            {query && (
              <button
                type="button"
                className="ud-amazon-clear-btn"
                onClick={() => {
                  setQuery('');
                  setActiveIndex(-1);
                  inputRef.current?.focus();
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </form>

          <button
            type="button"
            className="ud-amazon-search-submit-btn"
            onClick={handleSubmit}
            aria-label="Search"
            title="Search"
          >
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
        </div>

        {/* Suggestions Body */}
        <div className="ud-amazon-suggestions-container">
          {query.trim() === '' ? (
            /* Popular courses & topics when empty */
            <div className="ud-trending-box" style={{ padding: '12px 14px' }}>
              {topSearchedCourses.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div className="ud-suggestions-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>
                      <i className="fa-solid fa-fire" style={{ color: '#ef4444', marginRight: '6px' }}></i>
                      TOP SEARCHED COURSES
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                      Top 4 Learners' Choice
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {topSearchedCourses.map((c, i) => (
                      <div
                        key={`m-top-c-${c.id}`}
                        className="ud-suggestion-course-row"
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          background: 'rgba(248, 250, 252, 0.8)'
                        }}
                        onClick={() => {
                          recordCourseSearch(c.id, c.name);
                          setQuery('');
                          onClose();
                          navigate(`/student/courses/${c.id}`);
                        }}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          background: i === 0 ? 'rgba(239, 68, 68, 0.12)' : i === 1 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(90, 112, 211, 0.1)',
                          color: i === 0 ? '#ef4444' : i === 1 ? '#d97706' : '#5A70D3',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          flexShrink: 0,
                          marginRight: '8px'
                        }}>
                          {i + 1}
                        </div>
                        <div className="ud-suggestion-course-thumb" style={{ width: '36px', height: '36px', borderRadius: '6px', flexShrink: 0 }}>
                          {c.thumbnail ? (
                            <img src={c.thumbnail} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                          ) : (
                            <i className="fa-solid fa-graduation-cap" style={{ fontSize: '1rem', color: 'var(--ud-purple)' }}></i>
                          )}
                        </div>
                        <div className="ud-suggestion-course-meta" style={{ flex: 1, minWidth: 0, marginLeft: '10px' }}>
                          <div className="ud-suggestion-course-title" style={{ fontWeight: 700, fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </div>
                          <div className="ud-suggestion-course-cat" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {c.categoryName || 'General'}
                            {c.pricingType === 'free' || Number(c.price) === 0 ? (
                              <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: 700 }}>Free</span>
                            ) : (
                              <span style={{ marginLeft: '8px', color: '#5A70D3', fontWeight: 700 }}>From ₹{Number(c.price).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.72rem', color: '#cbd5e1', marginLeft: '6px' }}></i>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="ud-suggestions-section-title" style={{ marginTop: '10px' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ color: '#5A70D3', marginRight: '6px' }}></i>
                POPULAR SEARCHES
              </div>
              <div className="ud-trending-chips">
                {dynamicPopularTopics.map((topic, i) => (
                  <button
                    key={i}
                    type="button"
                    className="ud-trending-chip"
                    onClick={() => {
                      recordSearch(topic);
                      setQuery('');
                      onClose();
                      navigate(`/student/courses?search=${encodeURIComponent(topic)}`);
                    }}
                  >
                    <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '11px', opacity: 0.7, marginRight: '6px' }}></i>
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Live Suggestions when typing */
            <div>
              {/* Category Suggestions */}
              {suggestions.categories.length > 0 && (
                <div>
                  <div className="ud-suggestions-section-title">
                    <i className="fa-solid fa-folder-open" style={{ marginRight: '6px' }}></i>
                    CATEGORIES
                  </div>
                  {suggestions.categories.map((cat) => {
                    const idx = flatItems.findIndex(x => x.type === 'category' && x.id === cat.id);
                    const isSelected = activeIndex === idx;
                    return (
                      <div
                        key={`cat-${cat.id}`}
                        className={`ud-suggestion-row ${isSelected ? 'is-selected' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); handleItemClick(cat); }}
                      >
                        <span className="ud-suggestion-icon">
                          <i className="fa-solid fa-folder-open" style={{ color: 'var(--ud-purple)' }}></i>
                        </span>
                        <span className="ud-suggestion-text">
                          <HighlightMatch text={cat.name} query={query} />
                        </span>
                        <span className="ud-suggestion-badge">Category</span>
                        <span className="ud-suggestion-arrow">
                          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.8rem' }}></i>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Keyword & Course Title Suggestions */}
              {suggestions.keywords.length > 0 && (
                <div>
                  <div className="ud-suggestions-section-title">
                    <i className="fa-solid fa-magnifying-glass" style={{ marginRight: '6px' }}></i>
                    SUGGESTED SEARCHES
                  </div>
                  {suggestions.keywords.map((kw, kIdx) => {
                    const idx = flatItems.findIndex(x => x.type === 'keyword' && x.text === kw.text);
                    const isSelected = activeIndex === idx;
                    return (
                      <div
                        key={`kw-${kIdx}`}
                        className={`ud-suggestion-row ${isSelected ? 'is-selected' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); handleItemClick(kw); }}
                      >
                        <span className="ud-suggestion-icon">
                          <i className="fa-solid fa-magnifying-glass"></i>
                        </span>
                        <span className="ud-suggestion-text">
                          <HighlightMatch text={kw.text} query={query} />
                        </span>
                        <span className="ud-suggestion-arrow">
                          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.8rem' }}></i>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Matching Direct Courses */}
              {suggestions.courses.length > 0 && (
                <div style={{ borderTop: '1px solid var(--ud-border)', paddingTop: '6px' }}>
                  <div className="ud-suggestions-section-title">
                    <i className="fa-solid fa-graduation-cap" style={{ marginRight: '6px' }}></i>
                    MATCHING COURSES ({suggestions.courses.length})
                  </div>
                  {suggestions.courses.map((c) => {
                    const idx = flatItems.findIndex(x => x.type === 'course' && x.id === c.id);
                    const isSelected = activeIndex === idx;
                    return (
                      <div
                        key={`c-${c.id}`}
                        className={`ud-suggestion-course-row ${isSelected ? 'is-selected' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); handleItemClick(c); }}
                      >
                        <div className="ud-suggestion-course-thumb">
                          {c.thumbnail ? (
                            <img src={c.thumbnail} alt={c.name} />
                          ) : (
                            <i className="fa-solid fa-graduation-cap" style={{ fontSize: '1.2rem', color: 'var(--ud-purple)' }}></i>
                          )}
                        </div>
                        <div className="ud-suggestion-course-meta">
                          <div className="ud-suggestion-course-title">
                            <HighlightMatch text={c.name} query={query} />
                          </div>
                          <div className="ud-suggestion-course-cat">
                            {c.categoryName || 'General'} • {c.level || 'All Levels'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state if nothing matches */}
              {flatItems.length <= 1 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ud-gray)', fontSize: '0.9rem' }}>
                  <i className="fa-solid fa-search" style={{ fontSize: '1.8rem', opacity: 0.35, marginBottom: '10px', display: 'block' }}></i>
                  No direct suggestion matching "{query}".
                </div>
              )}

              {/* Bottom "See all results" */}
              <div
                className={`ud-suggestion-all-results ${activeIndex === flatItems.length - 1 ? 'is-selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
              >
                <span>See all results for "<strong>{query}</strong>"</span>
                <i className="fa-solid fa-arrow-right" style={{ marginLeft: '6px' }}></i>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // DESKTOP INLINE SEARCH BAR WITH LIVE SUGGESTIONS POPOVER
  // =========================================================================
  return (
    <div className="ud-search-container" ref={containerRef}>
      <form
        className="ud-search-form"
        onSubmit={handleSubmit}
        onClick={() => setShowDropdown(true)}
      >
        <span className="ud-search-icon">
          <i className="fa-solid fa-magnifying-glass"></i>
        </span>
        <input
          ref={inputRef}
          type="text"
          className="ud-search-input"
          placeholder="Search for courses, instructors, topics..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            className="ud-search-clear"
            onClick={() => {
              setQuery('');
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            title="Clear search"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </form>

      {/* Desktop Suggestions Popover */}
      {showDropdown && (
        <div className="ud-desktop-suggestions-menu">
          {query.trim() === '' ? (
            <div style={{ padding: '14px 16px' }}>
              {/* Top 4 Most Searched Courses dynamically */}
              {topSearchedCourses.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div className="ud-suggestions-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>
                      <i className="fa-solid fa-fire" style={{ color: '#ef4444', marginRight: '6px' }}></i>
                      MOST SEARCHED COURSES
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                      Top 4 Learners' Choice
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {topSearchedCourses.map((c, i) => (
                      <div
                        key={`d-top-c-${c.id}`}
                        className="ud-suggestion-course-row"
                        style={{
                          padding: '7px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          recordCourseSearch(c.id, c.name);
                          setShowDropdown(false);
                          setQuery('');
                          onClose();
                          navigate(`/student/courses/${c.id}`);
                        }}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          background: i === 0 ? 'rgba(239, 68, 68, 0.12)' : i === 1 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(90, 112, 211, 0.1)',
                          color: i === 0 ? '#ef4444' : i === 1 ? '#d97706' : '#5A70D3',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          flexShrink: 0,
                          marginRight: '8px'
                        }}>
                          {i + 1}
                        </div>
                        <div className="ud-suggestion-course-thumb" style={{ width: '36px', height: '36px', borderRadius: '6px', flexShrink: 0 }}>
                          {c.thumbnail ? (
                            <img src={c.thumbnail} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                          ) : (
                            <i className="fa-solid fa-graduation-cap" style={{ fontSize: '1rem', color: 'var(--ud-purple)' }}></i>
                          )}
                        </div>
                        <div className="ud-suggestion-course-meta" style={{ flex: 1, minWidth: 0, marginLeft: '10px' }}>
                          <div className="ud-suggestion-course-title" style={{ fontWeight: 700, fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </div>
                          <div className="ud-suggestion-course-cat" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {c.categoryName || 'General'}
                            {c.pricingType === 'free' || Number(c.price) === 0 ? (
                              <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: 700 }}>Free</span>
                            ) : (
                              <span style={{ marginLeft: '8px', color: '#5A70D3', fontWeight: 700 }}>From ₹{Number(c.price).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.72rem', color: '#cbd5e1', marginLeft: '6px' }}></i>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="ud-suggestions-section-title" style={{ marginTop: '10px' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ color: '#5A70D3', marginRight: '6px' }}></i>
                POPULAR SEARCHES
              </div>
              <div className="ud-trending-chips">
                {dynamicPopularTopics.map((topic, i) => (
                  <button
                    key={i}
                    type="button"
                    className="ud-trending-chip"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      recordSearch(topic);
                      setQuery('');
                      setShowDropdown(false);
                      onClose();
                      navigate(`/student/courses?search=${encodeURIComponent(topic)}`);
                    }}
                  >
                    <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '11px', opacity: 0.7, marginRight: '6px' }}></i>
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {/* Category Suggestions */}
              {suggestions.categories.length > 0 && (
                <div>
                  <div className="ud-suggestions-section-title">
                    <i className="fa-solid fa-folder-open" style={{ marginRight: '6px' }}></i>
                    CATEGORIES
                  </div>
                  {suggestions.categories.map((cat) => {
                    const idx = flatItems.findIndex(x => x.type === 'category' && x.id === cat.id);
                    const isSelected = activeIndex === idx;
                    return (
                      <div
                        key={`cat-d-${cat.id}`}
                        className={`ud-suggestion-row ${isSelected ? 'is-selected' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); handleItemClick(cat); }}
                      >
                        <span className="ud-suggestion-icon">
                          <i className="fa-solid fa-folder-open" style={{ color: 'var(--ud-purple)' }}></i>
                        </span>
                        <span className="ud-suggestion-text">
                          <HighlightMatch text={cat.name} query={query} />
                        </span>
                        <span className="ud-suggestion-badge">Category</span>
                        <span className="ud-suggestion-arrow">
                          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.8rem' }}></i>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Keyword & Course Title Suggestions */}
              {suggestions.keywords.length > 0 && (
                <div>
                  <div className="ud-suggestions-section-title">
                    <i className="fa-solid fa-magnifying-glass" style={{ marginRight: '6px' }}></i>
                    SUGGESTED SEARCHES
                  </div>
                  {suggestions.keywords.map((kw, kIdx) => {
                    const idx = flatItems.findIndex(x => x.type === 'keyword' && x.text === kw.text);
                    const isSelected = activeIndex === idx;
                    return (
                      <div
                        key={`kw-d-${kIdx}`}
                        className={`ud-suggestion-row ${isSelected ? 'is-selected' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); handleItemClick(kw); }}
                      >
                        <span className="ud-suggestion-icon">
                          <i className="fa-solid fa-magnifying-glass"></i>
                        </span>
                        <span className="ud-suggestion-text">
                          <HighlightMatch text={kw.text} query={query} />
                        </span>
                        <span className="ud-suggestion-arrow">
                          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.8rem' }}></i>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Matching Direct Courses */}
              {suggestions.courses.length > 0 && (
                <div style={{ borderTop: '1px solid var(--ud-border)', paddingTop: '6px' }}>
                  <div className="ud-suggestions-section-title">
                    <i className="fa-solid fa-graduation-cap" style={{ marginRight: '6px' }}></i>
                    MATCHING COURSES ({suggestions.courses.length})
                  </div>
                  {suggestions.courses.map((c) => {
                    const idx = flatItems.findIndex(x => x.type === 'course' && x.id === c.id);
                    const isSelected = activeIndex === idx;
                    return (
                      <div
                        key={`c-d-${c.id}`}
                        className={`ud-suggestion-course-row ${isSelected ? 'is-selected' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); handleItemClick(c); }}
                      >
                        <div className="ud-suggestion-course-thumb">
                          {c.thumbnail ? (
                            <img src={c.thumbnail} alt={c.name} />
                          ) : (
                            <i className="fa-solid fa-graduation-cap" style={{ fontSize: '1.2rem', color: 'var(--ud-purple)' }}></i>
                          )}
                        </div>
                        <div className="ud-suggestion-course-meta">
                          <div className="ud-suggestion-course-title">
                            <HighlightMatch text={c.name} query={query} />
                          </div>
                          <div className="ud-suggestion-course-cat">
                            {c.categoryName || 'General'} • {c.level || 'All Levels'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state if nothing matches */}
              {flatItems.length <= 1 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ud-gray)', fontSize: '0.9rem' }}>
                  <i className="fa-solid fa-search" style={{ fontSize: '1.8rem', opacity: 0.35, marginBottom: '10px', display: 'block' }}></i>
                  No direct suggestion matching "{query}".
                </div>
              )}

              {/* Full Results Link */}
              <div
                className={`ud-suggestion-all-results ${activeIndex === flatItems.length - 1 ? 'is-selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
              >
                <span>See all results for "<strong>{query}</strong>"</span>
                <i className="fa-solid fa-arrow-right" style={{ marginLeft: '6px' }}></i>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
