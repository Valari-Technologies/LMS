import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getUnreadNotificationCount, getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications';
import { getUnreadChatCount } from '../api/community';
import { listCategories } from '../api/categories';
import { browseCourses } from '../api/courses';
import { getLiveSessions } from '../api/live';
import SearchBox from './SearchBox';
import CommunityToastNotifier from './CommunityToastNotifier';
import BrandLandingSplash from './BrandLandingSplash';
import oneTutorBrandImg from '../assets/images/oneTutorBrand.png';
import { showSystemNotification } from '../utils/firebase';

export default function StudentLayout() {
  const { user, logout, openAuthModal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [hoveredCategoryId, setHoveredCategoryId] = useState(null);
  const [showCategories, setShowCategories] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [liveClassCount, setLiveClassCount] = useState(0);
  const [hasLiveNow, setHasLiveNow] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);

  useEffect(() => {
    setAvatarImgError(false);
  }, [user?.profileImage]);

  const hasAnyNotification = (unreadCount > 0) || (unreadChatCount > 0) || (liveClassCount > 0);

  const categoriesRef = useRef(null);
  const categoriesTimeoutRef = useRef(null);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const prevUnreadCountRef = useRef(null);

  useEffect(() => {
    listCategories({ size: 30 })
      .then(res => {
        const catList = res?.content || (Array.isArray(res) ? res : []);
        setCategories(catList);
        if (catList.length > 0) {
          setHoveredCategoryId(catList[0].id);
        }
      })
      .catch(() => {});

    browseCourses({ size: 100 })
      .then(res => setCourses(res?.content || (Array.isArray(res) ? res : [])))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    loadUnread();
    const interval = setInterval(loadUnread, 15000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    function handleSync() {
      loadUnread();
    }
    window.addEventListener('community-read', handleSync);
    window.addEventListener('community-new-message', handleSync);
    window.addEventListener('live-sessions-changed', handleSync);
    window.addEventListener('live-session-created', handleSync);
    return () => {
      window.removeEventListener('community-read', handleSync);
      window.removeEventListener('community-new-message', handleSync);
      window.removeEventListener('live-sessions-changed', handleSync);
      window.removeEventListener('live-session-created', handleSync);
    };
  }, []);

  // Automatically open login modal when an unauthenticated visitor scrolls past 50% of the page (only once per session)
  useEffect(() => {
    if (user) return;

    try {
      if (sessionStorage.getItem('onetutor_scroll_login_shown') === 'true') {
        return;
      }
    } catch {
      // ignore storage access issues
    }

    let hasTriggered = false;

    function handleScroll() {
      if (hasTriggered || user) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const scrollHeight = (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight;

      if (scrollHeight > 150 && (scrollTop / scrollHeight) >= 0.5) {
        hasTriggered = true;
        try {
          sessionStorage.setItem('onetutor_scroll_login_shown', 'true');
        } catch {}
        window.removeEventListener('scroll', handleScroll);
        openAuthModal('login');
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [user, openAuthModal]);

  // Close popovers and modal on location change
  useEffect(() => {
    if (categoriesTimeoutRef.current) clearTimeout(categoriesTimeoutRef.current);
    setShowCategories(false);
    setShowNotifications(false);
    setShowUserMenu(false);
    setMobileDrawerOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname, location.search]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(e) {
      if (categoriesRef.current && !categoriesRef.current.contains(e.target)) {
        if (categoriesTimeoutRef.current) clearTimeout(categoriesTimeoutRef.current);
        setShowCategories(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadUnread() {
    if (!user) return;
    try {
      const [notifRes, chatRes, liveRes] = await Promise.allSettled([
        getUnreadNotificationCount(),
        getUnreadChatCount(),
        getLiveSessions(),
      ]);
      if (notifRes.status === 'fulfilled') {
        const newCount = notifRes.value || 0;
        if (prevUnreadCountRef.current !== null && newCount > prevUnreadCountRef.current) {
          getNotifications({ page: 0, size: 1 }).then(res => {
            const latest = res?.content?.[0];
            if (latest && !latest.read) {
              showSystemNotification(latest.title, {
                body: latest.message,
                icon: latest.imageUrl || '/favicon.ico',
                image: latest.imageUrl || undefined,
                linkUrl: latest.linkUrl || '/student/notifications'
              });
            }
          }).catch(() => {});
        }
        prevUnreadCountRef.current = newCount;
        setUnreadCount(newCount);
      }
      if (chatRes.status === 'fulfilled') setUnreadChatCount(chatRes.value || 0);
      if (liveRes.status === 'fulfilled') {
        const sessions = Array.isArray(liveRes.value) ? liveRes.value : (liveRes.value?.content || []);
        const now = new Date();
        const activeUpcoming = sessions.filter(s => {
          const st = (s.status || '').toLowerCase();
          if (st === 'cancelled' || st === 'completed') return false;
          if (s.endTime && new Date(s.endTime) <= now) return false;
          return (s.canJoin !== false && s.enrolled !== false);
        });

        const isCurrentlyLive = activeUpcoming.some(s => {
          const st = (s.status || '').toLowerCase();
          if (st === 'live') return true;
          const sched = new Date(s.scheduledAt);
          return sched <= now;
        });

        setLiveClassCount(activeUpcoming.length);
        setHasLiveNow(isCurrentlyLive);
      }
    } catch (e) {
      // ignore
    }
  }

  async function toggleNotifications() {
    if (!showNotifications) {
      try {
        const res = await getNotifications({ page: 0, size: 5 });
        setRecentNotifications(res?.content || []);
      } catch (e) {
        // ignore
      }
    }
    setShowNotifications(!showNotifications);
    setShowUserMenu(false);
    setShowCategories(false);
  }

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id);
      setRecentNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      // ignore
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setRecentNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      window.dispatchEvent(new Event('notifications-updated'));
    } catch (e) {
      // ignore
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  function handleCategoriesMouseEnter() {
    if (categoriesTimeoutRef.current) {
      clearTimeout(categoriesTimeoutRef.current);
      categoriesTimeoutRef.current = null;
    }
    setShowCategories(true);
  }

  function handleCategoriesMouseLeave() {
    if (categoriesTimeoutRef.current) {
      clearTimeout(categoriesTimeoutRef.current);
    }
    categoriesTimeoutRef.current = setTimeout(() => {
      setShowCategories(false);
    }, 200);
  }

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'ST';
  const isStaff = user?.role
    ? ['admin', 'super_admin', 'superadmin', 'content_creator', 'creator', 'readonly_admin', 'read_only_admin'].includes(user.role.toLowerCase())
    : false;
  const isAdmin = isStaff;
  const roleLabel = (user?.role === 'content_creator' || user?.role === 'creator')
    ? 'CONTENT CREATOR'
    : (user?.role === 'readonly_admin' || user?.role === 'read_only_admin')
    ? 'READ-ONLY ADMIN'
    : (isStaff ? 'ADMIN' : 'STUDENT');
  const isCommunityPage = location.pathname.startsWith('/student/community');
  const isLearningPage = location.pathname.startsWith('/student/learn');

  return (
    <div className="ud-shell">
      {/* Landing Intro Splash & Page Center Watermark */}
      <BrandLandingSplash />
      <img src={oneTutorBrandImg} alt="" className="ot-page-center-watermark" aria-hidden="true" />

      {/* ====================================================================
          TOP NAVBAR:
          Desktop: Menu, Brand, Categories, SearchBox, Links, Bell, Avatar
          Small Screen (Mobile): ONLY Menu, Brand, Search Icon, Profile Avatar
          ==================================================================== */}
      <header className="ud-header">
        <div className="ud-header-left">
          {/* Mobile hamburger menu button */}
          <button
            className="ud-mobile-toggle"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open navigation menu"
            style={{ position: 'relative' }}
          >
            <i className="fa-solid fa-bars"></i>
            {hasAnyNotification && (
              <span
                style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 0 2px var(--ud-white, #ffffff), 0 0 6px rgba(239, 68, 68, 0.6)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </button>

          {/* Brand Logo with Glowing Bulb Effect */}
          <Link to="/" className="ud-brand" title="OneTutor Home">
            <span className="ot-brand-logo-wrap">
              <img src={oneTutorBrandImg} alt="OneTutor" className="ot-brand-logo-img" />
            </span>
          </Link>

          {/* Navigation Links Group (Desktop) */}
          <nav className="ud-nav-inline-group desktop-only">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `ud-nav-link ${isActive || location.pathname === '/student' ? 'active ud-nav-pill' : ''}`
              }
            >
              Home
            </NavLink>

            {user && (
              <NavLink
                to="/student/my-courses"
                className={({ isActive }) =>
                  `ud-nav-link ${location.pathname.startsWith('/student/my-courses') || location.pathname.startsWith('/student/learn') ? 'active ud-nav-pill' : ''}`
                }
              >
                My Learning
              </NavLink>
            )}

            {/* Categories Dropdown (Desktop only) */}
            <div
              className="ud-categories-wrap"
              ref={categoriesRef}
              onMouseEnter={handleCategoriesMouseEnter}
              onMouseLeave={handleCategoriesMouseLeave}
            >
              <button
                className={`ud-categories-btn ${showCategories ? 'active' : ''}`}
                onClick={() => setShowCategories(prev => !prev)}
              >
                <span>Categories</span>
              <i
                className="fa-solid fa-chevron-down"
                style={{
                  fontSize: '0.72rem',
                  transform: showCategories ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s'
                }}
              ></i>
            </button>

            {showCategories && (
              <div
                className="ud-categories-menu"
                onMouseEnter={handleCategoriesMouseEnter}
                onMouseLeave={handleCategoriesMouseLeave}
              >
                {/* Left Column: Categories List */}
                <div className="ud-categories-list-col">
                  <div className="ud-categories-header">
                    Explore Topics
                  </div>
                  <div className="ud-categories-scroll">
                    {categories.length === 0 ? (
                      <div style={{ padding: '12px 18px', fontSize: '0.88rem', color: 'var(--ud-gray)' }}>
                        Loading categories...
                      </div>
                    ) : (
                      categories.slice(0, 7).map(c => {
                        const isHovered = String(hoveredCategoryId || categories[0]?.id) === String(c.id);
                        return (
                          <div
                            key={c.id}
                            className={`ud-category-item ${isHovered ? 'active' : ''}`}
                            onMouseEnter={() => setHoveredCategoryId(c.id)}
                            onClick={() => {
                              if (categoriesTimeoutRef.current) clearTimeout(categoriesTimeoutRef.current);
                              setShowCategories(false);
                              navigate(`/student/courses?categoryId=${c.id}`);
                            }}
                          >
                            <span>{c.name}</span>
                            <i
                              className="fa-solid fa-chevron-right"
                              style={{
                                color: isHovered ? 'var(--ud-purple)' : 'var(--ud-gray)',
                                fontSize: '0.72rem'
                              }}
                            ></i>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="ud-browse-all-wrap">
                    <Link
                      to="/student/courses"
                      className="ud-category-item ud-browse-all-link"
                      onClick={() => {
                        if (categoriesTimeoutRef.current) clearTimeout(categoriesTimeoutRef.current);
                        setShowCategories(false);
                      }}
                    >
                      <span>Browse All Courses</span>
                      <i className="fa-solid fa-arrow-right"></i>
                    </Link>
                  </div>
                </div>

                {/* Right Column: Courses in Hovered Category */}
                <div className="ud-category-courses-col">
                  {(() => {
                    const activeCat = categories.find(c => String(c.id) === String(hoveredCategoryId || categories[0]?.id));
                    if (!activeCat) {
                      return (
                        <div className="ud-subcourses-empty">
                          <p style={{ color: 'var(--ud-gray)', fontSize: '0.86rem' }}>Select a category to view courses</p>
                        </div>
                      );
                    }

                    const activeCatCourses = courses.filter(crs =>
                      String(crs.categoryId) === String(activeCat.id) ||
                      (crs.categoryName && crs.categoryName.trim().toLowerCase() === activeCat.name.trim().toLowerCase())
                    );

                    return (
                      <>
                        <div className="ud-subcourses-header">
                          <span className="ud-subcourses-title" title={activeCat.name}>
                            {activeCat.name}
                          </span>
                          <Link
                            to={`/student/courses?categoryId=${activeCat.id}`}
                            className="ud-subcourses-viewall"
                            onClick={() => {
                              if (categoriesTimeoutRef.current) clearTimeout(categoriesTimeoutRef.current);
                              setShowCategories(false);
                            }}
                          >
                            <span>Explore All</span>
                            <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.72rem' }}></i>
                          </Link>
                        </div>

                        {activeCatCourses.length === 0 ? (
                          <div className="ud-subcourses-empty">
                            <i className="fa-solid fa-book-open" style={{ fontSize: '2rem', color: 'var(--ud-border-strong)', marginBottom: '10px' }}></i>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: 'var(--ud-dark-gray)' }}>
                              No published courses yet
                            </p>
                            <p style={{ margin: '4px 0 14px', fontSize: '0.78rem', color: 'var(--ud-gray)' }}>
                              New courses in this category will be available soon.
                            </p>
                            <Link
                              to={`/student/courses?categoryId=${activeCat.id}`}
                              className="ud-view-all-category-btn"
                              onClick={() => {
                                if (categoriesTimeoutRef.current) clearTimeout(categoriesTimeoutRef.current);
                                setShowCategories(false);
                              }}
                            >
                              Browse Category Catalog
                            </Link>
                          </div>
                        ) : (
                          <>
                            <div className="ud-subcourses-list">
                              {activeCatCourses.slice(0, Math.max(2, Math.min(3, Math.floor((categories.length || 4) * 0.6)))).map(course => (
                                <div
                                  key={course.id}
                                  className="ud-subcourse-card"
                                  onClick={() => {
                                    if (categoriesTimeoutRef.current) clearTimeout(categoriesTimeoutRef.current);
                                    setShowCategories(false);
                                    navigate(`/student/courses/${course.id}`);
                                  }}
                                >
                                  <div className="ud-subcourse-thumb">
                                    {course.thumbnail ? (
                                      <img src={course.thumbnail} alt={course.name} />
                                    ) : (
                                      <span className="ud-subcourse-thumb-fallback">
                                        <i className="fa-solid fa-graduation-cap"></i>
                                      </span>
                                    )}
                                  </div>
                                  <div className="ud-subcourse-info">
                                    <div className="ud-subcourse-title" title={course.name}>
                                      {course.name}
                                    </div>
                                    <div className="ud-subcourse-meta">
                                      {course.level && <span className="ud-pill">{course.level}</span>}
                                      {course.duration && (
                                        <span>
                                          <i className="fa-regular fa-clock" style={{ marginRight: '3px' }}></i>
                                          {course.duration}
                                        </span>
                                      )}
                                      <span className="ud-free">Free</span>
                                    </div>
                                  </div>
                                  <i className="fa-solid fa-chevron-right ud-subcourse-arrow"></i>
                                </div>
                              ))}
                            </div>

                            <div className="ud-subcourses-footer">
                              <Link
                                to={`/student/courses?categoryId=${activeCat.id}`}
                                className="ud-view-all-category-btn"
                                onClick={() => {
                                  if (categoriesTimeoutRef.current) clearTimeout(categoriesTimeoutRef.current);
                                  setShowCategories(false);
                                }}
                              >
                                <span>See all {activeCatCourses.length} {activeCat.name} courses</span>
                                <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.72rem' }}></i>
                              </Link>
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <NavLink
            to="/student/courses"
            className={({ isActive }) => `ud-nav-link ${isActive ? 'active ud-nav-pill' : ''}`}
          >
            Explore
          </NavLink>

          {user && (
            <>
              <NavLink
                to="/student/live-classes"
                className={({ isActive }) => `ud-nav-link ${isActive ? 'active ud-nav-pill' : ''}`}
              >
                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <span>Live Classes</span>
                  {liveClassCount > 0 && (
                    <span className="ud-nav-dot-badge red">
                      {liveClassCount > 99 ? '99+' : liveClassCount}
                    </span>
                  )}
                </span>
              </NavLink>

              <NavLink
                to="/student/community"
                className={({ isActive }) => `ud-nav-link ${isActive ? 'active ud-nav-pill' : ''}`}
              >
                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <span>Community</span>
                  {unreadChatCount > 0 && (
                    <span className="ud-nav-dot-badge green">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                </span>
              </NavLink>
            </>
          )}
        </nav>
      </div>

      {/* Global Search Bar with Live Suggestions (Desktop only) */}
      <div className={`desktop-only ud-header-search-wrap ${!user ? 'ud-header-search-logged-out' : ''}`}>
        <SearchBox isMobileModal={false} />
      </div>

      {/* Right Navigation Actions */}
      <div className="ud-header-right">
        {/* Admin Console Switcher for Staff Users */}
        {isStaff && (
          <Link
            to="/admin"
            className="desktop-only"
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12), rgba(124, 58, 237, 0.15))',
              color: 'var(--accent-primary, #4f46e5)',
              border: '1px solid rgba(79, 70, 229, 0.3)',
              fontSize: '0.82rem',
              fontWeight: 800,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginRight: '6px',
              transition: 'all 0.15s ease'
            }}
            title="Return to Admin Console"
          >
            <i className="fa-solid fa-gear"></i>
            <span>Admin Console</span>
          </Link>
        )}

        {/* Notifications Bell (Desktop only) */}
        {user && (
          <div className="ud-categories-wrap desktop-only" ref={notifRef}>
            <button
              className="ud-icon-btn"
              onClick={toggleNotifications}
              title="Notifications"
              aria-label="Notifications"
              style={{ position: 'relative' }}
            >
              <i className="fa-regular fa-bell" style={{ fontSize: '1.25rem', color: '#1e293b' }}></i>
              {hasAnyNotification && (
                <span className="ud-bell-dot"></span>
              )}
            </button>

            {showNotifications && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 12px)',
                  right: 0,
                  width: '360px',
                  maxWidth: '92vw',
                  background: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  borderRadius: '16px',
                  boxShadow: '0 16px 36px rgba(15, 23, 42, 0.15)',
                  zIndex: 1100,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  animation: 'udFadeIn 0.15s ease'
                }}
              >
                {/* Dropdown Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                  background: 'var(--bg-surface, #f8fafc)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary, #0f172a)' }}>
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(90, 112, 211, 0.15)',
                        color: 'var(--accent-primary, #5A70D3)'
                      }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {recentNotifications.some(n => !n.read) && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-primary, #5A70D3)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(90, 112, 211, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title="Mark all notifications as read"
                    >
                      <i className="fa-solid fa-check-double"></i>
                      <span>Mark all as read</span>
                    </button>
                  )}
                </div>

                {/* Notifications Scroll List */}
                <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                  {recentNotifications.length === 0 ? (
                    <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '0.88rem' }}>
                      <i className="fa-regular fa-bell" style={{ fontSize: '1.8rem', marginBottom: '8px', display: 'block', opacity: 0.6 }}></i>
                      No notifications right now.
                    </div>
                  ) : (
                    recentNotifications.map(n => {
                      const isUnread = !n.read;
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            handleMarkRead(n.id);
                            if (n.linkUrl) {
                              navigate(n.linkUrl);
                              setShowNotifications(false);
                            }
                          }}
                          style={{
                            padding: '14px 18px',
                            borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                            cursor: 'pointer',
                            background: isUnread ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                            transition: 'background 0.15s ease',
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'start'
                          }}
                          onMouseEnter={(e) => {
                            if (!isUnread) e.currentTarget.style.background = 'var(--bg-surface, #f8fafc)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isUnread) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          {/* Course Cover Image or Category Icon */}
                          {n.imageUrl ? (
                            <div style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              border: '1px solid var(--border-default, #e2e8f0)',
                              flexShrink: 0,
                              background: 'var(--bg-surface, #f8fafc)'
                            }}>
                              <img
                                src={n.imageUrl}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            </div>
                          ) : (
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: n.type === 'LIVE_CLASS' ? 'rgba(239, 68, 68, 0.1)' :
                                          n.type === 'COURSE' ? 'rgba(59, 130, 246, 0.1)' :
                                          n.type === 'COMMUNITY' ? 'rgba(245, 158, 11, 0.1)' :
                                          'rgba(124, 58, 237, 0.1)',
                              color: n.type === 'LIVE_CLASS' ? '#ef4444' :
                                     n.type === 'COURSE' ? '#3b82f6' :
                                     n.type === 'COMMUNITY' ? '#f59e0b' :
                                     '#111111',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.95rem',
                              flexShrink: 0
                            }}>
                              <i className={`fa-solid ${
                                n.type === 'LIVE_CLASS' ? 'fa-video' :
                                n.type === 'COURSE' ? 'fa-book-open' :
                                n.type === 'COMMUNITY' ? 'fa-comments' :
                                'fa-bullhorn'
                              }`}></i>
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: isUnread ? 700 : 600,
                              fontSize: '0.88rem',
                              color: 'var(--text-primary, #0f172a)',
                              lineHeight: 1.3,
                              marginBottom: '3px'
                            }}>
                              {n.title}
                            </div>
                            <div style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary, #475569)',
                              lineHeight: 1.4,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {n.message}
                            </div>
                            <div style={{
                              fontSize: '0.72rem',
                              color: 'var(--text-muted, #94a3b8)',
                              marginTop: '5px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                              {isUnread && (
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4f46e5', display: 'inline-block' }}></span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Dropdown Footer: VIEW ALL AT BOTTOM */}
                <Link
                  to="/student/notifications"
                  onClick={() => setShowNotifications(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '13px 18px',
                    background: 'var(--bg-surface, #f8fafc)',
                    borderTop: '1px solid var(--border-subtle, #f1f5f9)',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    color: 'var(--accent-primary, #4f46e5)',
                    textDecoration: 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(79, 70, 229, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-surface, #f8fafc)';
                  }}
                >
                  <span>View All Notifications</span>
                  <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.76rem' }}></i>
                </Link>
              </div>
            )}
          </div>
        )}

          {/* ====================================================================
              MOBILE SEARCH ICON BUTTON (Visible ONLY on small screens)
              Clicking this opens the Amazon-style full search overlay
              ==================================================================== */}
          <button
            className="ud-mobile-search-btn mobile-only"
            onClick={() => setMobileSearchOpen(true)}
            aria-label="Open search bar"
            title="Search courses"
          >
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>

          {/* User Profile Avatar and Menu (Logged In) or Login/Signup Buttons (Logged Out) */}
          {user ? (
            <div className="ud-user-wrap" ref={userMenuRef}>
              <button
                className="ud-avatar-btn"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-label="User account menu"
                title={`${user?.name} - Profile & Account Menu`}
              >
                {user?.profileImage && !avatarImgError ? (
                  <img
                    src={user.profileImage}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarImgError(true)}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  userInitials
                )}
              </button>

              {showUserMenu && (
                <div className="ud-user-dropdown">
                  {/* Header User Card */}
                  <div className="ud-user-header">
                    <div className="ud-user-header-avatar">
                      {user?.profileImage && !avatarImgError ? (
                        <img
                          src={user.profileImage}
                          alt={user.name}
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarImgError(true)}
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        userInitials
                      )}
                    </div>
                    <div>
                      <div className="ud-user-header-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{user?.name}</span>
                        {isStaff && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: '10px',
                            background: 'rgba(79, 70, 229, 0.12)',
                            color: 'var(--accent-primary, #4f46e5)',
                            textTransform: 'uppercase'
                          }}>
                            {roleLabel}
                          </span>
                        )}
                      </div>
                      <div className="ud-user-header-email">{user?.email}</div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="ud-dropdown-section">
                    <Link
                      to="/student/profile"
                      className="ud-dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <span>Account Profile</span>
                      <i className="fa-solid fa-user" style={{ color: 'var(--ud-purple)' }}></i>
                    </Link>
                    <Link
                      to="/student/my-courses"
                      className="ud-dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <span>My learning</span>
                      <i className="fa-solid fa-book-open" style={{ color: 'var(--ud-purple)' }}></i>
                    </Link>
                    <Link
                      to="/student/courses"
                      className="ud-dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <span>Browse Courses</span>
                      <i className="fa-solid fa-compass" style={{ color: 'var(--ud-purple)' }}></i>
                    </Link>
                    <Link
                      to="/student/live-classes"
                      className="ud-dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <span>Live Classes</span>
                      <i className="fa-solid fa-video" style={{ color: '#ef4444' }}></i>
                    </Link>
                    <Link
                      to="/student/notifications"
                      className="ud-dropdown-item"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <span>Notifications</span>
                      {unreadCount > 0 ? (
                        <span className="ud-badge" style={{ position: 'static' }}>{unreadCount}</span>
                      ) : (
                        <i className="fa-solid fa-bell" style={{ color: 'var(--ud-gray)' }}></i>
                      )}
                    </Link>
                  </div>

                  <div className="ud-dropdown-section">
                    {isStaff && (
                      <Link
                        to="/admin"
                        className="ud-dropdown-item"
                        style={{ color: 'var(--accent-primary, #4f46e5)', fontWeight: 700, background: 'rgba(79, 70, 229, 0.08)' }}
                        onClick={() => setShowUserMenu(false)}
                      >
                        <span>Switch to Admin Console</span>
                        <i className="fa-solid fa-gear" style={{ color: 'var(--accent-primary, #4f46e5)' }}></i>
                      </Link>
                    )}


                  </div>

                  <div className="ud-dropdown-section">
                    <button
                      className="ud-dropdown-item"
                      onClick={handleLogout}
                      style={{ color: '#ef4444', fontWeight: 600 }}
                    >
                      <span>Log out</span>
                      <i className="fa-solid fa-arrow-right-from-bracket"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: '6px 14px',
                  fontWeight: 700,
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('register')}
                className="btn btn-primary btn-sm desktop-only"
                style={{
                  padding: '6px 14px',
                  fontWeight: 700,
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ====================================================================
          AMAZON-STYLE MOBILE SEARCH MODAL OVERLAY
          ==================================================================== */}
      <SearchBox
        isMobileModal={true}
        isOpen={mobileSearchOpen}
        onClose={() => setMobileSearchOpen(false)}
      />

      {/* ====================================================================
          MOBILE SLIDE-OVER NAVIGATION DRAWER
          ==================================================================== */}
      {mobileDrawerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 2500,
            display: 'flex'
          }}
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            style={{
              width: '300px',
              maxWidth: '85%',
              background: 'var(--ud-white)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--ud-shadow-lg)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ud-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link to="/" className="ud-brand" title="OneTutor" onClick={() => setMobileDrawerOpen(false)}>
                <span className="ot-brand-logo-wrap">
                  <img src={oneTutorBrandImg} alt="OneTutor" className="ot-brand-logo-img" />
                </span>
              </Link>
              <button
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--ud-dark-gray)' }}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {user ? (
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ud-border)', background: 'var(--ud-light-gray)' }}>
                <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--ud-black)' }}>{user?.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--ud-gray)' }}>{user?.email}</div>
              </div>
            ) : (
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ud-border)', display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, textAlign: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    openAuthModal('login');
                  }}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, textAlign: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    openAuthModal('register');
                  }}
                >
                  Sign up
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
              <div style={{ padding: '8px 20px', fontSize: '0.76rem', fontWeight: 800, color: 'var(--ud-gray)', textTransform: 'uppercase' }}>
                Navigation
              </div>
              <NavLink
                to="/"
                end
                className={({ isActive }) => `ud-dropdown-item ${isActive || location.pathname === '/student' ? 'active' : ''}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <span>Home</span>
                <i className="fa-solid fa-house" style={{ color: 'var(--ud-purple)' }}></i>
              </NavLink>
              <NavLink
                to="/student/courses"
                end
                className={({ isActive }) => `ud-dropdown-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileDrawerOpen(false)}
              >
                <span>Browse Courses</span>
                <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--ud-gray)' }}></i>
              </NavLink>

              {user && (
                <>
                  <NavLink
                    to="/student/my-courses"
                    className={({ isActive }) => `ud-dropdown-item ${location.pathname.startsWith('/student/my-courses') || location.pathname.startsWith('/student/learn') ? 'active' : ''}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <span>My Learning</span>
                    <i className="fa-solid fa-book-open" style={{ color: 'var(--ud-purple)' }}></i>
                  </NavLink>
                  <NavLink
                    to="/student/live-classes"
                    className={({ isActive }) => `ud-dropdown-item ${location.pathname.startsWith('/student/live-classes') ? 'active' : ''}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <span>Live Classes</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {liveClassCount > 0 && (
                        <span style={{
                          background: '#ef4444',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700,
                          minWidth: '20px',
                          height: '20px',
                          borderRadius: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 6px',
                          boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
                        }}>
                          {liveClassCount > 99 ? '99+' : liveClassCount}
                        </span>
                      )}
                      <i className="fa-solid fa-video" style={{ color: '#ef4444' }}></i>
                    </div>
                  </NavLink>
                  <NavLink
                    to="/student/community"
                    className={({ isActive }) => `ud-dropdown-item ${location.pathname.startsWith('/student/community') ? 'active' : ''}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <span>Community</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {unreadChatCount > 0 && (
                        <span style={{
                          background: '#22c55e',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700,
                          minWidth: '20px',
                          height: '20px',
                          borderRadius: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 6px',
                          boxShadow: '0 2px 4px rgba(34, 197, 94, 0.4)',
                        }}>
                          {unreadChatCount > 99 ? '99+' : unreadChatCount}
                        </span>
                      )}
                      <i className="fa-solid fa-comments" style={{ color: 'var(--ud-purple)' }}></i>
                    </div>
                  </NavLink>
                  <NavLink
                    to="/student/notifications"
                    className={({ isActive }) => `ud-dropdown-item ${location.pathname.startsWith('/student/notifications') ? 'active' : ''}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <span>Notifications</span>
                    {unreadCount > 0 ? (
                      <span className="ud-badge" style={{ position: 'static' }}>{unreadCount}</span>
                    ) : (
                      <i className="fa-solid fa-bell" style={{ color: 'var(--ud-gray)' }}></i>
                    )}
                  </NavLink>
                  <NavLink
                    to="/student/profile"
                    className={({ isActive }) => `ud-dropdown-item ${location.pathname.startsWith('/student/profile') ? 'active' : ''}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <span>Profile & Settings</span>
                    <i className="fa-solid fa-user" style={{ color: 'var(--ud-gray)' }}></i>
                  </NavLink>
                </>
              )}

              <div style={{ padding: '16px 20px 8px 20px', fontSize: '0.76rem', fontWeight: 800, color: 'var(--ud-gray)', textTransform: 'uppercase' }}>
                Categories
              </div>
              {categories.slice(0, 7).map(c => (
                <div
                  key={c.id}
                  className="ud-dropdown-item"
                  onClick={() => {
                    navigate(`/student/courses?categoryId=${c.id}`);
                    setMobileDrawerOpen(false);
                  }}
                >
                  <span>{c.name}</span>
                  <i className="fa-solid fa-chevron-right" style={{ color: 'var(--ud-gray)', fontSize: '0.72rem' }}></i>
                </div>
              ))}
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--ud-border)' }}>

              {user && (
                <button
                  className="ud-btn-primary"
                  style={{ width: '100%', background: '#ef4444' }}
                  onClick={handleLogout}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket" style={{ marginRight: '8px' }}></i>
                  Log Out
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MAIN STUDENT PAGE OUTLET
          ==================================================================== */}
      <main style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <Outlet />
      </main>

      {user && <CommunityToastNotifier role="student" />}

      {/* ====================================================================
          ONETUTOR FOOTER (Hidden on community chat and course learning page)
          ==================================================================== */}
      {!isCommunityPage && !isLearningPage && (
        <footer className="ud-footer">
          <div className="ud-footer-inner">
            <div style={{ paddingBottom: '24px', borderBottom: '1px solid #3e4143', marginBottom: '28px' }}>
              <div>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', display: 'block', marginBottom: '4px' }}>
                  Empowering developers worldwide with production-ready skills.
                </span>
                <span style={{ color: '#9da3a7', fontSize: '0.86rem' }}>
                  Master full-stack engineering, cloud architecture, microservices, and modern web application development.
                </span>
              </div>
            </div>

            <div className="ud-footer-links-grid">
              <div className="ud-footer-col">
                <h4>About OneTutor</h4>
                <ul>
                  <li><Link to="/about">About Us</Link></li>
                  <li><Link to="/contact">Contact Us</Link></li>
                </ul>
              </div>
              <div className="ud-footer-col">
                <h4>Discovery</h4>
                <ul>
                  <li><Link to="/student/courses">Course Catalog</Link></li>
                  <li><Link to="/student/live-classes">Live Masterclasses</Link></li>
                </ul>
              </div>
              <div className="ud-footer-col">
                <h4>Support & Resources</h4>
                <ul>
                  <li><Link to="/help-center">Help Center & FAQ</Link></li>
                </ul>
              </div>
              <div className="ud-footer-col">
                <h4>Legal & Safety</h4>
                <ul>
                  <li><Link to="/privacy-policy">Privacy Policy</Link></li>
                  <li><Link to="/terms-of-service">Terms of Service</Link></li>
                </ul>
              </div>
            </div>

            <div className="ud-footer-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', paddingTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Link to="/" className="ud-brand" title="OneTutor Home">
                  <span className="ot-brand-logo-wrap" style={{ background: '#ffffff', padding: '4px 8px', borderRadius: '8px' }}>
                    <img src={oneTutorBrandImg} alt="OneTutor" className="ot-brand-logo-img" style={{ height: '32px' }} />
                  </span>
                </Link>
                <span style={{ color: '#9da3a7', fontSize: '0.84rem' }}>
                  © 2026 OneTutor LMS, Inc. All rights reserved.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '14px', fontSize: '1.15rem', color: '#9da3a7' }}>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ color: '#9da3a7', transition: 'color 0.15s' }} title="GitHub">
                  <i className="fa-brands fa-github"></i>
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" style={{ color: '#9da3a7', transition: 'color 0.15s' }} title="LinkedIn">
                  <i className="fa-brands fa-linkedin"></i>
                </a>
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" style={{ color: '#9da3a7', transition: 'color 0.15s' }} title="Twitter / X">
                  <i className="fa-brands fa-x-twitter"></i>
                </a>
                <a href="https://discord.com" target="_blank" rel="noopener noreferrer" style={{ color: '#9da3a7', transition: 'color 0.15s' }} title="Discord">
                  <i className="fa-brands fa-discord"></i>
                </a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" style={{ color: '#9da3a7', transition: 'color 0.15s' }} title="YouTube">
                  <i className="fa-brands fa-youtube"></i>
                </a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
