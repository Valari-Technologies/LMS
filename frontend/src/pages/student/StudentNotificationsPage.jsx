import { useState, useEffect } from 'react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../api/notifications';

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadNotifications();
  }, [page]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await getNotifications({ page, size: 15 });
      setNotifications(res?.content || []);
      setTotalPages(res?.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id) {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="ud-main-container" style={{ maxWidth: '840px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="ud-section-title" style={{ fontSize: '2.2rem' }}>Notifications</h1>
          <p className="ud-section-subtitle">Stay informed on course progress, new announcements, and live classes.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {notifications.some(n => !n.read) ? (
            <button
              className="ud-btn-secondary"
              onClick={handleMarkAllRead}
              style={{ fontSize: '0.86rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa-solid fa-check-double"></i>
              <span>Mark all as read</span>
            </button>
          ) : (
            <span style={{ fontSize: '0.84rem', color: 'var(--ud-gray)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i> All caught up
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ud-gray)' }}>
          Loading notifications feed...
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed var(--ud-border)', borderRadius: '8px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px', color: 'var(--ud-purple)' }}>
            <i className="fa-regular fa-bell"></i>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '6px' }}>
            You're all caught up!
          </h3>
          <p style={{ color: 'var(--ud-gray)', fontSize: '0.92rem' }}>
            No new notifications at this time.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.read && handleMarkRead(n.id)}
              style={{
                background: n.read ? 'var(--ud-white)' : 'var(--ud-purple-subtle)',
                border: '1px solid var(--ud-border)',
                borderRadius: '8px',
                padding: '18px 24px',
                cursor: !n.read ? 'pointer' : 'default',
                boxShadow: 'var(--ud-shadow-sm)',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
                transition: 'all 0.15s'
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: n.read ? 'var(--ud-light-gray)' : 'var(--ud-purple-light)',
                  color: 'var(--ud-purple)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  flexShrink: 0
                }}
              >
                {n.type === 'ENROLLMENT' ? (
                  <i className="fa-solid fa-graduation-cap"></i>
                ) : n.type === 'LIVE_CLASS' ? (
                  <i className="fa-solid fa-video"></i>
                ) : n.type === 'COMMUNITY' ? (
                  <i className="fa-solid fa-comments"></i>
                ) : n.type === 'COURSE' ? (
                  <i className="fa-solid fa-book-open"></i>
                ) : (
                  <i className="fa-solid fa-bullhorn"></i>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ud-black)', margin: 0 }}>
                    {n.title}
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--ud-gray)' }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>

                <p style={{ color: 'var(--ud-dark-gray)', fontSize: '0.9rem', lineHeight: 1.5, margin: '4px 0 10px 0' }}>
                  {n.message}
                </p>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'var(--ud-light-gray)', color: 'var(--ud-gray)', padding: '2px 8px', borderRadius: '4px' }}>
                    {n.type}
                  </span>
                  {!n.read && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>
                      NEW
                    </span>
                  )}
                  {!n.read && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(n.id);
                      }}
                      className="ud-btn-secondary"
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.76rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                      title="Mark as read"
                    >
                      <i className="fa-solid fa-check"></i>
                      <span>Mark as read</span>
                    </button>
                  )}
                  {n.linkUrl && (
                    <a
                      href={n.linkUrl}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!n.read) handleMarkRead(n.id);
                      }}
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: 'var(--ud-purple)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>View details</span>
                      <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.75rem' }}></i>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '36px' }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="ud-btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <i className="fa-solid fa-arrow-left"></i>
            <span>Previous</span>
          </button>
          <span style={{ fontSize: '0.9rem', color: 'var(--ud-gray)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="ud-btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Next</span>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      )}
    </div>
  );
}
