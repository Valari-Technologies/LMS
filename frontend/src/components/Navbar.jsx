import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getUnreadNotificationCount, getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/notifications';
import { getUnreadChatCount } from '../api/community';
import oneTutorBrandImg from '../assets/images/oneTutorBrand.png';

export default function Navbar() {
  const { user, logout, openAuthModal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    function handleCommunitySync() {
      loadUnread();
    }
    window.addEventListener('community-read', handleCommunitySync);
    window.addEventListener('community-new-message', handleCommunitySync);
    window.addEventListener('notifications-updated', handleCommunitySync);
    return () => {
      window.removeEventListener('community-read', handleCommunitySync);
      window.removeEventListener('community-new-message', handleCommunitySync);
      window.removeEventListener('notifications-updated', handleCommunitySync);
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

  async function loadUnread() {
    try {
      const [notifRes, chatRes] = await Promise.allSettled([
        getUnreadNotificationCount(),
        getUnreadChatCount(),
      ]);
      if (notifRes.status === 'fulfilled') setUnreadCount(notifRes.value || 0);
      if (chatRes.status === 'fulfilled') setUnreadChatCount(chatRes.value || 0);
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
    navigate('/');
  }

  if (!user) {
    return (
      <header className="navbar">
        <div className="navbar-container">
          <div className="navbar-left">
            <Link to="/" className="navbar-brand">
              <span className="ot-brand-logo-wrap">
                <img src={oneTutorBrandImg} alt="OneTutor" className="ot-brand-logo-img" />
              </span>
            </Link>
            <nav className="navbar-links">
              <Link to="/student/courses">Explore Courses</Link>
              <Link to="/about">About Us</Link>
            </nav>
          </div>
          <div className="navbar-right">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 700, borderRadius: '20px', cursor: 'pointer' }}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className="btn btn-primary btn-sm desktop-only"
              style={{ fontWeight: 700, borderRadius: '20px', cursor: 'pointer' }}
            >
              Sign up
            </button>
          </div>
        </div>
      </header>
    );
  }

  const isStaff = ['admin', 'super_admin', 'superadmin', 'content_creator', 'creator', 'readonly_admin', 'read_only_admin'].includes(user?.role?.toLowerCase());
  const roleTag = (user?.role === 'content_creator' || user?.role === 'creator')
    ? 'CONTENT CREATOR'
    : (user?.role === 'readonly_admin' || user?.role === 'read_only_admin')
    ? 'READ-ONLY ADMIN'
    : (isStaff ? 'ADMIN' : 'STUDENT');
  const userInitials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

  const studentNavLinks = [
    { to: '/student', label: 'Home' },
    { to: '/student/my-courses', label: 'My Learning' },
    { to: '/student/courses', label: 'Course Catalog' },
    { to: '/student/live-classes', label: 'Live Classes' },
    { to: '/student/community', label: 'Community' },
  ];

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-left">
          <Link to={isStaff ? '/admin' : '/student'} className="navbar-brand">
            <span className="ot-brand-logo-wrap">
              <img src={oneTutorBrandImg} alt="OneTutor" className="ot-brand-logo-img" />
            </span>
            <span className="role-tag">{roleTag}</span>
          </Link>

          <nav className="navbar-links">
            {studentNavLinks.map((link) => {
              const isActive = link.to === '/student'
                ? location.pathname === link.to
                : location.pathname.startsWith(link.to);
              const isCommunity = link.to === '/student/community';
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={isActive ? 'active' : ''}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    marginRight: (isCommunity && unreadChatCount > 0) ? '12px' : '0',
                  }}
                >
                  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    {link.label}
                    {isCommunity && unreadChatCount > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: '-7px',
                        right: '-14px',
                        background: '#22c55e',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 800,
                        minWidth: '17px',
                        height: '17px',
                        lineHeight: '17px',
                        borderRadius: '9px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                        boxShadow: '0 2px 4px rgba(34, 197, 94, 0.45)',
                        border: '1.5px solid var(--ud-white, #ffffff)',
                        zIndex: 2,
                        pointerEvents: 'none',
                      }}>
                        {unreadChatCount > 99 ? '99+' : unreadChatCount}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin"
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: '12px', fontSize: '0.82rem', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-gear"></i>
                <span>Admin Console</span>
              </Link>
            )}
          </nav>
        </div>

        <div className="navbar-right">

          {/* Notifications Dropdown */}
          <div style={{ position: 'relative' }} ref={notifDropdownRef}>
            <button
              className="notification-bell-btn"
              onClick={openNotifications}
              title="Notifications"
              aria-label="Notifications"
            >
              <i className="fa-solid fa-bell"></i>
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>

            {showNotifications && (
              <div className="card admin-notifications-dropdown" style={{ top: '50px' }}>
                <div className="admin-notifications-header">
                  <div className="notif-title-wrap">
                    <strong className="notif-title-text">Notifications</strong>
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
                        onClick={handleMarkAllRead}
                        className="btn btn-sm btn-secondary"
                        style={{
                          padding: '4px 9px',
                          fontSize: '0.74rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--accent-primary)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap'
                        }}
                        title="Mark all notifications as read"
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
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No new notifications
                    </div>
                  ) : (
                    recentNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={`admin-notification-item ${!n.read ? 'unread' : ''}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)', flex: 1 }}>{n.title}</div>
                          {!n.read && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkRead(n.id);
                              }}
                              style={{
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-default)',
                                color: 'var(--accent-primary)',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                flexShrink: 0
                              }}
                              title="Mark as read"
                            >
                              <i className="fa-solid fa-check"></i>
                              <span>Mark read</span>
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{n.message}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
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
                                color: 'var(--accent-primary)',
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
                  to="/student/notifications"
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
                    fontWeight: '700',
                    color: 'var(--accent-primary)',
                    textDecoration: 'none'
                  }}
                >
                  View All Notifications <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.74rem' }}></i>
                </Link>
              </div>
            )}
          </div>

          {/* User Profile */}
          <Link to="/student/profile" className="user-profile-btn" title="View Profile">
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
            <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </span>
          </Link>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="btn btn-secondary btn-sm"
            title="Sign out"
          >
            Logout
          </button>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open mobile menu"
          >
            <i className="fa-solid fa-bars"></i>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`mobile-drawer-overlay ${mobileMenuOpen ? 'open' : ''}`} onClick={() => setMobileMenuOpen(false)}>
        <div className={`mobile-drawer ${mobileMenuOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="mobile-drawer-header">
            <div className="navbar-brand">
              <div className="brand-icon-wrap">
                <i className="fa-solid fa-graduation-cap"></i>
              </div>
              <span>One Tutor</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="mobile-drawer-links">
            {studentNavLinks.map((link) => {
              const isActive = link.to === '/student'
                ? location.pathname === link.to
                : location.pathname.startsWith(link.to);
              const isCommunity = link.to === '/student/community';
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={isActive ? 'active' : ''}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>{link.label}</span>
                  {isCommunity && unreadChatCount > 0 && (
                    <span className="ud-badge" style={{ position: 'static', padding: '1px 6px', fontSize: '10px', height: '18px', minWidth: '18px' }}>
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin"
                className="btn btn-primary btn-sm"
                style={{ marginTop: '8px', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                <i className="fa-solid fa-gear"></i>
                <span>Admin Console</span>
              </Link>
            )}
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-default)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link
              to="/student/profile"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setMobileMenuOpen(false)}
            >
              <i className="fa-solid fa-user"></i>
              <span>{user.name}</span>
            </Link>
            <button onClick={handleLogout} className="btn btn-danger btn-sm">
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
