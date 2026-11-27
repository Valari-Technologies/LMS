import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  deleteNotificationsBatch
} from '../../api/notifications';
import { useNotification } from '../../context/NotificationContext';

export default function StudentNotificationsPage() {
  const { toast, confirm } = useNotification();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

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
      toast.success('All notifications marked as read');
    } catch (e) {
      console.error(e);
    }
  }

  function handleToggleSelect(id, e) {
    if (e) e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleSelectAll() {
    if (notifications.length > 0 && selectedIds.length === notifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map(n => n.id));
    }
  }

  async function handleDelete(id, e) {
    if (e) e.stopPropagation();
    const confirmed = await confirm({
      title: 'Delete Notification?',
      description: 'Are you sure you want to delete this notification?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setSelectedIds(prev => prev.filter(x => x !== id));
      toast.success('Notification deleted');
      if (notifications.length <= 1 && page > 0) {
        setPage(p => p - 1);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete notification');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const confirmed = await confirm({
      title: `Delete ${count} Selected Notification${count > 1 ? 's' : ''}?`,
      description: `Are you sure you want to delete the ${count} selected notification${count > 1 ? 's' : ''}? This action cannot be undone.`,
      confirmText: `Delete (${count})`,
      cancelText: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await deleteNotificationsBatch(selectedIds);
      setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)));
      setSelectedIds([]);
      toast.success(`${count} notification${count > 1 ? 's' : ''} deleted`);
      if (notifications.length <= count && page > 0) {
        setPage(p => p - 1);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete selected notifications');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteAll() {
    if (notifications.length === 0) return;
    const confirmed = await confirm({
      title: 'Delete All Notifications?',
      description: 'Are you sure you want to delete all notifications? All unread and read notifications will be permanently removed.',
      confirmText: 'Delete All',
      cancelText: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await deleteAllNotifications();
      setNotifications([]);
      setSelectedIds([]);
      setTotalPages(1);
      setPage(0);
      toast.success('All notifications deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete all notifications');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="ud-main-container" style={{ maxWidth: '840px' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 className="ud-section-title" style={{ fontSize: '2.2rem', marginBottom: '6px' }}>Notifications</h1>
          <p className="ud-section-subtitle" style={{ margin: 0 }}>Stay informed on course progress, new announcements, and live classes.</p>
        </div>

        {notifications.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {notifications.some(n => !n.read) ? (
              <button
                type="button"
                className="ud-btn-secondary"
                onClick={handleMarkAllRead}
                disabled={actionLoading}
                style={{ fontSize: '0.84rem', padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-check-double"></i>
                <span>Mark all as read</span>
              </button>
            ) : (
              <span style={{ fontSize: '0.84rem', color: 'var(--ud-gray)', display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: '6px' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i> All caught up
              </span>
            )}

            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={actionLoading}
              style={{
                fontSize: '0.84rem',
                padding: '7px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                background: '#ffffff',
                color: '#ef4444',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fef2f2';
                e.currentTarget.style.borderColor = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#fecaca';
              }}
              title="Delete all notifications"
            >
              <i className="fa-regular fa-trash-can"></i>
              <span>Delete All</span>
            </button>
          </div>
        )}
      </div>

      {/* Bulk Selection Action Toolbar */}
      {notifications.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: selectedIds.length > 0 ? '#f5f3ff' : 'var(--ud-light-gray, #f8fafc)',
          border: selectedIds.length > 0 ? '1px solid #c4b5fd' : '1px solid var(--ud-border, #e2e8f0)',
          borderRadius: '8px',
          padding: '10px 16px',
          marginBottom: '16px',
          transition: 'all 0.2s ease',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--ud-dark-gray)' }}>
              <input
                type="checkbox"
                checked={notifications.length > 0 && selectedIds.length === notifications.length}
                onChange={handleSelectAll}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--ud-purple, #6366f1)' }}
              />
              <span>Select All</span>
            </label>

            {selectedIds.length > 0 && (
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#6366f1',
                background: '#ede9fe',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {selectedIds.length} selected
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={actionLoading}
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
              >
                <i className="fa-solid fa-trash-can"></i>
                <span>Delete Selected ({selectedIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                style={{
                  background: 'transparent',
                  border: '1px solid #cbd5e1',
                  color: '#64748b',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                Deselect
              </button>
            </div>
          )}
        </div>
      )}

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
          {notifications.map(n => {
            const isSelected = selectedIds.includes(n.id);
            return (
              <div
                key={n.id}
                onClick={() => !n.read && handleMarkRead(n.id)}
                style={{
                  background: isSelected
                    ? '#faf5ff'
                    : n.read ? 'var(--ud-white)' : 'var(--ud-purple-subtle)',
                  border: isSelected
                    ? '1px solid #a855f7'
                    : '1px solid var(--ud-border)',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  cursor: !n.read ? 'pointer' : 'default',
                  boxShadow: isSelected
                    ? '0 0 0 1px #a855f7, var(--ud-shadow-sm)'
                    : 'var(--ud-shadow-sm)',
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                  transition: 'all 0.15s',
                  position: 'relative'
                }}
              >
                {/* Checkbox for Selection */}
                <div
                  style={{ paddingTop: '8px', display: 'flex', alignItems: 'center' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleToggleSelect(n.id, e)}
                    style={{
                      width: '17px',
                      height: '17px',
                      cursor: 'pointer',
                      accentColor: 'var(--ud-purple, #6366f1)'
                    }}
                    title="Select notification"
                  />
                </div>

                {/* Notification Type Icon */}
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

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px', gap: '8px' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--ud-black)', margin: 0, wordBreak: 'break-word' }}>
                      {n.title}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--ud-gray)' }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </span>

                      {/* Individual Delete Action */}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(n.id, e)}
                        disabled={actionLoading}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ef4444';
                          e.currentTarget.style.background = '#fef2f2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#94a3b8';
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title="Delete notification"
                      >
                        <i className="fa-regular fa-trash-can"></i>
                      </button>
                    </div>
                  </div>

                  <p style={{ color: 'var(--ud-dark-gray)', fontSize: '0.9rem', lineHeight: 1.5, margin: '4px 0 10px 0', wordBreak: 'break-word' }}>
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
                      n.linkUrl.startsWith('http://') || n.linkUrl.startsWith('https://') ? (
                        <a
                          href={n.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
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
                      ) : (
                        <Link
                          to={n.linkUrl}
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
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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