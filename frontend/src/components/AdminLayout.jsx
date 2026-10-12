import { useState, useEffect, useRef } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getUnreadNotificationCount, getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications';
import { getUnreadChatCount } from '../api/community';
import { getAdminLiveSessions, getUpcomingLiveSessionCount } from '../api/live';
import { getAdminContactStats } from '../api/contact';
import CommunityToastNotifier from './CommunityToastNotifier';
import oneTutorBrandImg from '../assets/images/oneTutorBrand.png';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [liveClassCount, setLiveClassCount] = useState(0);
  const [pendingContactCount, setPendingContactCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [avatarImgError, setAvatarImgError] = useState(false);
  const notifDropdownRef = useRef(null);

  useEffect(() => {
    setAvatarImgError(false);
  }, [user?.profileImage]);

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
    window.addEventListener('notifications-updated', handleSync);
    return () => {
      window.removeEventListener('community-read', handleSync);
      window.removeEventListener('community-new-message', handleSync);
      window.removeEventListener('live-sessions-changed', handleSync);
      window.removeEventListener('live-session-created', handleSync);
      window.removeEventListener('notifications-updated', handleSync);
    };
  }, []);

  // Click outside to close notification dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
    setShowNotifications(false);
  }, [location.pathname]);

  async function loadUnread() {
    if (!localStorage.getItem('accessToken')) return;
    if (isContentCreator) return;
    try {
      const [notifRes, chatRes, liveCountRes, contactStatsRes] = await Promise.allSettled([
        getUnreadNotificationCount(),
        getUnreadChatCount(),
        getUpcomingLiveSessionCount().catch(() => getAdminLiveSessions({ size: 100 })),
        getAdminContactStats().catch(() => null),
      ]);
      if (notifRes.status === 'fulfilled') setUnreadCount(notifRes.value || 0);
      if (chatRes.status === 'fulfilled') setUnreadChatCount(chatRes.value || 0);
      if (contactStatsRes.status === 'fulfilled' && contactStatsRes.value) {
        setPendingContactCount(contactStatsRes.value.pending || 0);
      }
      if (liveCountRes.status === 'fulfilled') {
        if (typeof liveCountRes.value === 'number') {
          setLiveClassCount(liveCountRes.value);
        } else {
          const sessions = Array.isArray(liveCountRes.value) ? liveCountRes.value : (liveCountRes.value?.content || []);
          const now = new Date();
          const activeUpcoming = sessions.filter(s => {
            const st = (s.status || '').toLowerCase();
            if (st === 'cancelled' || st === 'completed') return false;
            if (s.endTime && new Date(s.endTime) <= now) return false;
            return true;
          });
          setLiveClassCount(activeUpcoming.length);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  async function openNotifications() {
    if (!showNotifications) {
      try {
        const res = await getNotifications({ page: 0, size: 5 });
        setRecentNotifications(res?.content || []);
      } catch (e) {
        // ignore
      }
    }
    setShowNotifications(!showNotifications);
  }

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id);
      setRecentNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new Event('notifications-updated'));
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
    navigate('/login');
  }

  const userInitials = user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AD';

  const userRole = user?.role?.toLowerCase();
  const isContentCreator = userRole === 'content_creator' || userRole === 'creator';
  const isReadOnlyAdmin = userRole === 'readonly_admin' || userRole === 'read_only_admin';

  let parsedPermissions = null;
  if (user?.permissions) {
    try {
      parsedPermissions = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    } catch (e) {
      // ignore
    }
  }

  const hasCustomPermissions = parsedPermissions && Object.keys(parsedPermissions).length > 0;

  const allNavGroups = [
    {
      title: 'OVERVIEW',
      items: [
        { to: '/admin', label: 'Dashboard', icon: <i className="fa-solid fa-chart-line"></i>, end: true },
        { to: '/admin/creator-dashboard', label: 'Creator Studio', icon: <i className="fa-solid fa-wand-magic-sparkles"></i> },
      ]
    },
    {
      title: 'ACADEMICS & CONTENT',
      items: [
        { to: '/admin/courses', label: 'Courses', icon: <i className="fa-solid fa-book-open"></i> },
        { to: '/admin/reviews', label: 'Course Reviews', icon: <i className="fa-solid fa-star"></i> },
        { to: '/admin/batches', label: 'Batches', icon: <i className="fa-solid fa-users-rectangle"></i> },
        { to: '/admin/categories', label: 'Categories', icon: <i className="fa-solid fa-tags"></i> },
        { to: '/admin/coupons', label: 'Coupons & Discounts', icon: <i className="fa-solid fa-ticket"></i> },
        { to: '/admin/banners', label: 'Hero Banners', icon: <i className="fa-solid fa-image"></i> },
        { to: '/admin/promo-banner', label: 'Promo Banner', icon: <i className="fa-solid fa-rectangle-ad"></i> },
        { to: '/admin/media', label: 'Cloudinary Media', icon: <i className="fa-solid fa-cloud-arrow-up"></i> },
        { to: '/admin/live-sessions', label: 'Live Sessions', icon: <i className="fa-solid fa-video"></i>, badge: liveClassCount > 0 ? (liveClassCount > 99 ? '99+' : liveClassCount) : null },
      ]
    },
    {
      title: 'COMMUNICATIONS',
      items: [
        { to: '/admin/contact-messages', label: 'Support Inquiries', icon: <i className="fa-solid fa-headset"></i>, badge: pendingContactCount > 0 ? (pendingContactCount > 99 ? '99+' : pendingContactCount) : null },
        { to: '/admin/notifications', label: 'Notification Center', icon: <i className="fa-solid fa-bullhorn"></i> },
        { to: '/admin/community', label: 'Community', icon: <i className="fa-solid fa-comments"></i>, badge: unreadChatCount > 0 ? (unreadChatCount > 99 ? '99+' : unreadChatCount) : null },
      ]
    },
    {
      title: 'USERS & RECORDS',
      items: [
        { to: '/admin/students', label: 'Students', icon: <i className="fa-solid fa-user-graduate"></i> },
        { to: '/admin/admins', label: 'Administrators', icon: <i className="fa-solid fa-shield-halved"></i> },
        { to: '/admin/enrollments', label: 'Enrollments', icon: <i className="fa-solid fa-clipboard-check"></i> },
        { to: '/admin/progress', label: 'Progress Tracking', icon: <i className="fa-solid fa-chart-pie"></i> },
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { to: '/admin/audit-logs', label: 'Audit Logs', icon: <i className="fa-solid fa-clock-rotate-left"></i> },
      ]
    }
  ];

  const navGroups = hasCustomPermissions
    ? allNavGroups.map(group => ({
        ...group,
        items: group.items.filter(item => parsedPermissions[item.to] !== undefined)
      })).filter(group => group.items.length > 0)
    : isContentCreator
    ? [
        {
          title: 'OVERVIEW',
          items: [
            { to: '/admin', label: 'Dashboard', icon: <i className="fa-solid fa-chart-line"></i>, end: true },
          ]
        },
        {
          title: 'CONTENT MANAGEMENT',
          items: [
            { to: '/admin/courses', label: 'Courses', icon: <i className="fa-solid fa-book-open"></i> },
            { to: '/admin/categories', label: 'Categories', icon: <i className="fa-solid fa-tags"></i> },
            { to: '/admin/media', label: 'Cloudinary Media', icon: <i className="fa-solid fa-cloud-arrow-up"></i> },
          ]
        }
      ]
    : allNavGroups;

  const currentPath = location.pathname;

  // Determine if the current page should be rendered as read-only based on role OR granular permissions
  let isCurrentPageReadOnly = isReadOnlyAdmin;
  if (!isCurrentPageReadOnly && hasCustomPermissions) {
    const keys = Object.keys(parsedPermissions);
    const sortedKeys = keys.sort((a, b) => b.length - a.length);
    const matchedKey = sortedKeys.find(k => k !== '/admin' && currentPath.startsWith(k)) || (parsedPermissions[currentPath] ? currentPath : null);
    const permVal = matchedKey ? parsedPermissions[matchedKey] : parsedPermissions[currentPath];
    if (permVal === 'READ_ONLY' || (typeof permVal === 'object' && permVal?.mode === 'READ_ONLY')) {
      isCurrentPageReadOnly = true;
    }
  }

  // Route protection for users with custom permissions
  useEffect(() => {
    if (!hasCustomPermissions) return;

    const allowedPaths = Object.keys(parsedPermissions);
    const isAllowed = allowedPaths.some(p => p === currentPath || (p !== '/admin' && currentPath.startsWith(p)));

    if (!isAllowed) {
      const firstAvailable = navGroups[0]?.items[0]?.to || '/admin/courses';
      if (firstAvailable && firstAvailable !== currentPath) {
        navigate(firstAvailable, { replace: true });
      }
    }
  }, [hasCustomPermissions, currentPath, navGroups, navigate, parsedPermissions]);

  // Build a multi-step breadcrumb from the current pathname
  function buildBreadcrumbs() {
    const path = location.pathname; // e.g. /admin/courses/2/preview
    const crumbs = [];

    // Root is always Console -> /admin
    crumbs.push({ label: 'Console', to: '/admin' });

    // All known top-level admin sections
    const sections = navGroups.flatMap(g => g.items);

    // Find which top-level section we are under
    const section = sections.find(item =>
      item.end ? path === item.to : path.startsWith(item.to)
    );

    if (!section || path === '/admin') {
      // On Dashboard – single crumb
      return crumbs;
    }

    // Add the section crumb (e.g. Courses -> /admin/courses)
    crumbs.push({ label: section.label, to: section.to });

    // Detect well-known sub-pages
    if (/\/admin\/courses\/\d+\/preview/.test(path)) {
      crumbs.push({ label: 'Admin Preview Mode', to: null });
    } else if (/\/admin\/courses\/\d+\/sections/.test(path)) {
      crumbs.push({ label: 'Section Manager', to: null });
    } else if (/\/admin\/courses\/\d+\/edit/.test(path)) {
      crumbs.push({ label: 'Edit Course', to: null });
    } else if (/\/admin\/courses\/new/.test(path)) {
      crumbs.push({ label: 'New Course', to: null });
    } else if (/\/admin\/courses\/\d+/.test(path)) {
      crumbs.push({ label: 'Course Detail', to: null });
    }

    return crumbs;
  }

  const breadcrumbs = buildBreadcrumbs();

  return (
    <div className={`admin-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Centered Page Background Watermark */}
      <img src={oneTutorBrandImg} alt="" className="ot-page-center-watermark" aria-hidden="true" />

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="admin-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Modern Admin Sidebar */}
      <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Sidebar Header */}
        <div className="admin-sidebar-header">
          <Link to="/admin" className="admin-sidebar-brand" title="One Tutor Super Admin">
            <span className="ot-brand-logo-wrap">
              <img src={oneTutorBrandImg} alt="OneTutor" className="ot-brand-logo-img" style={{ height: '32px' }} />
            </span>
            {!collapsed && (
              <span
                className="brand-role-pill"
                style={{
                  marginLeft: '6px',
                  background: isReadOnlyAdmin
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : isContentCreator
                    ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                    : 'var(--accent-gradient)'
                }}
              >
                {isReadOnlyAdmin ? 'READ-ONLY ADMIN' : isContentCreator ? 'CONTENT CREATOR' : 'SUPER ADMIN'}
              </span>
            )}
          </Link>
          <button
            className="sidebar-toggle-btn desktop-only"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar collapse"
          >
            {collapsed ? <i className="fa-solid fa-chevron-right"></i> : <i className="fa-solid fa-chevron-left"></i>}
          </button>
          <button
            className="sidebar-close-btn mobile-only"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <div className="admin-sidebar-body">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="admin-nav-section">
              {!collapsed && <div className="admin-section-label">{group.title}</div>}
              <div className="admin-nav-list">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `admin-nav-link ${isActive ? 'active' : ''}`
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="admin-nav-icon">{item.icon}</span>
                    {!collapsed && <span className="admin-nav-text">{item.label}</span>}
                    {item.badge && !collapsed && (
                      <span
                        style={{
                          marginLeft: 'auto',
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
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="admin-sidebar-footer">
          {/* Quick Profile Info */}
          <div className="admin-profile-card">
            <div className="avatar-circle">
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
            {!collapsed && (
              <div className="admin-profile-meta">
                <div className="admin-name" title={user?.name}>{user?.name}</div>
                <div className="admin-email" title={user?.email}>{user?.email}</div>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="admin-footer-actions">
            <button
              className="admin-footer-btn logout-btn"
              onClick={handleLogout}
              title="Sign out of Console"
              style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start' }}
            >
              <span><i className="fa-solid fa-arrow-right-from-bracket"></i></span>
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Admin Area */}
      <div className="admin-main-wrap">
        {/* Top Header Bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              className="admin-mobile-menu-trigger"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation sidebar"
              style={{ position: 'relative' }}
            >
              <i className="fa-solid fa-bars"></i>
              {(unreadCount > 0 || unreadChatCount > 0 || liveClassCount > 0) && (
                <span
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    boxShadow: '0 0 0 2px var(--bg-surface, #ffffff), 0 0 6px rgba(239, 68, 68, 0.6)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </button>
            <div className="admin-breadcrumbs">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {idx > 0 && <span className="admin-crumb-sep">/</span>}
                    {isLast || !crumb.to ? (
                      <span className={isLast ? 'admin-crumb-active' : 'admin-crumb-root'}>{crumb.label}</span>
                    ) : (
                      <Link to={crumb.to} className="admin-crumb-root" style={{ textDecoration: 'none' }}>{crumb.label}</Link>
                    )}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="admin-topbar-right">
            {/* Student Preview Quick Switch (Hidden for Content Creators) */}
            {!isContentCreator && !location.pathname.includes('creator') && (
              <Link
                to="/student"
                className="btn btn-secondary btn-sm"
                title="View student interface"
              >
                <i className="fa-solid fa-graduation-cap"></i>
                <span className="desktop-only" style={{ marginLeft: '6px' }}>Student View</span>
              </Link>
            )}

            {isReadOnlyAdmin && (
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#d97706',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-eye"></i>
                <span>Read-Only Mode</span>
              </span>
            )}


            {/* Notifications Dropdown */}
            <div style={{ position: 'relative' }} ref={notifDropdownRef}>
              <button
                className="notification-bell-btn"
                onClick={openNotifications}
                title="System Notifications"
                aria-label="System Notifications"
              >
                <i className="fa-solid fa-bell"></i>
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </button>

              {showNotifications && (
                <div className="card admin-notifications-dropdown">
                  <div className="admin-notifications-header">
                    <div className="notif-title-wrap">
                      <strong className="notif-title-text">Super Admin Alerts</strong>
                      {unreadCount > 0 && (
                        <span className="unread-pill-badge">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    <div className="notif-actions-wrap">
                      {recentNotifications.some(n => !n.read) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={handleMarkAllRead}
                          title="Mark all notifications as read"
                          style={{
                            padding: '4px 9px',
                            fontSize: '0.74rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: 'var(--accent-primary, #4f46e5)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <i className="fa-solid fa-check-double"></i>
                          <span>Mark all read</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowNotifications(false)}
                        title="Close notifications"
                        aria-label="Close notifications"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted, #94a3b8)',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          fontSize: '0.95rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.15s ease'
                        }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </div>
                  <div className="admin-notifications-list">
                    {recentNotifications.length === 0 ? (
                      <div className="admin-notifications-empty">
                        No pending alerts
                      </div>
                    ) : (
                      recentNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`admin-notification-item ${!n.read ? 'unread' : ''}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div className="notification-title" style={{ flex: 1, fontWeight: 700 }}>{n.title}</div>
                            {!n.read && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkRead(n.id);
                                }}
                                title="Mark this alert as read"
                                style={{
                                  background: 'var(--bg-surface, #f8fafc)',
                                  border: '1px solid var(--border-default, #cbd5e1)',
                                  color: 'var(--accent-primary, #4f46e5)',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                <i className="fa-solid fa-check"></i>
                                <span>Mark read</span>
                              </button>
                            )}
                          </div>
                          <div className="notification-message">{n.message}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                            <div className="notification-time">
                              {new Date(n.createdAt).toLocaleDateString()}
                            </div>
                            {n.linkUrl && (
                              <Link
                                to={n.linkUrl}
                                onClick={() => {
                                  if (!n.read) handleMarkRead(n.id);
                                  setShowNotifications(false);
                                }}
                                style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--accent-primary, #4f46e5)',
                                  fontWeight: 600,
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <span>View</span>
                                <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.65rem' }}></i>
                              </Link>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <Link
                    to="/admin/notifications"
                    onClick={() => setShowNotifications(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '10px 0 0 0',
                      marginTop: '10px',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--accent-primary, #4f46e5)',
                      textDecoration: 'none'
                    }}
                  >
                    Notification Center <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.74rem' }}></i>
                  </Link>
                </div>
              )}
            </div>

            {/* Profile Avatar Chip */}
            <div className="admin-topbar-user" title={`Logged in as ${user?.name}`}>
              <div className="avatar-circle small">
                {user?.profileImage && !avatarImgError ? (
                  <img
                    src={user.profileImage}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarImgError(true)}
                  />
                ) : (
                  userInitials
                )}
              </div>
              <span className="desktop-only admin-topbar-name">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Page Content Outlet */}
        <main className="admin-content-area">
          <Outlet context={{ isReadOnlyPage: isCurrentPageReadOnly }} />
        </main>
        {!isContentCreator && <CommunityToastNotifier role="admin" />}
      </div>
    </div>
  );
}
