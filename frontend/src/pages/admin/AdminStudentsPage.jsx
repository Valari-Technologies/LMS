import { useState, useEffect } from 'react';
import { getStudents, disableStudent, enableStudent, getStudentDetail, getOnlineCount } from '../../api/users';
import { useNotification } from '../../context/NotificationContext';
import { usePermission } from '../../hooks/usePermission';

function formatLastSeen(timestamp) {
  if (!timestamp) return { primary: 'Never', secondary: null, isOnline: false };
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  const formattedDateTime = date.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  if (diffSecs < 75) {
    return { primary: 'Online', secondary: null, isOnline: true };
  }
  if (diffMins < 60) {
    return { primary: `${diffMins || 1}m ago`, secondary: formattedDateTime, isOnline: false };
  }
  if (diffHours < 24) {
    return { primary: `${diffHours}h ago`, secondary: formattedDateTime, isOnline: false };
  }
  return { primary: formattedDateTime, secondary: null, isOnline: false };
}

/**
 * Returns high-resolution original image URL by stripping thumbnail/resize modifiers
 * (e.g. Google OAuth =s96-c, Cloudinary /c_thumb,w_100/, GitHub ?s=64, etc.)
 */
export function getHighResAvatarUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const cleaned = url.trim();

  // 1. Google OAuth user avatars (lh3.googleusercontent.com)
  // Strips =s96-c or =s120 to =s0 (uncompressed original high-res photo)
  if (cleaned.includes('googleusercontent.com')) {
    if (/=s\d+(-c)?(\?.*)?$/.test(cleaned)) {
      return cleaned.replace(/=s\d+(-c)?(\?.*)?$/, '=s0$2');
    }
    if (/[?&]sz=\d+/.test(cleaned)) {
      return cleaned.replace(/([?&])sz=\d+/, '$1sz=1000');
    }
  }

  // 2. Cloudinary thumbnail transformation URLs
  if (cleaned.includes('cloudinary.com') && cleaned.includes('/upload/')) {
    return cleaned.replace(/\/upload\/(?:[a-zA-Z]_[^/]+\/)+/, '/upload/q_auto,f_auto/');
  }

  // 3. GitHub avatars
  if (cleaned.includes('githubusercontent.com') && /[?&]s=\d+/.test(cleaned)) {
    return cleaned.replace(/([?&])s=\d+/, '$1s=800');
  }

  // 4. Gravatar avatars
  if (cleaned.includes('gravatar.com/avatar') && /[?&]s=\d+/.test(cleaned)) {
    return cleaned.replace(/([?&])s=\d+/, '$1s=800');
  }

  return cleaned;
}

export default function AdminStudentsPage() {
  const { isReadOnly } = usePermission();
  const { toast, confirm } = useNotification();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [onlineCount, setOnlineCount] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [profileTab, setProfileTab] = useState('overview'); // 'overview' | 'courses' | 'tests' | 'attendance' | 'activity'
  const [expandedCourseId, setExpandedCourseId] = useState(null);
  const [testFilter, setTestFilter] = useState('ALL'); // 'ALL' | 'PASSED' | 'FAILED'
  const [previewImage, setPreviewImage] = useState(null); // { url, title, email, studentId }
  const [isFullScreenView, setIsFullScreenView] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (isFullScreenView) {
          setIsFullScreenView(false);
          setZoomLevel(1);
        } else if (previewImage) {
          setPreviewImage(null);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage, isFullScreenView]);

  useEffect(() => {
    loadStudents(true);
    const interval = setInterval(() => {
      loadStudents(false);
    }, 8_000);
    return () => clearInterval(interval);
  }, [search, status, page]);

  async function loadStudents(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const [res, onlineRes] = await Promise.all([
        getStudents({ search, status, page, size: 10 }),
        getOnlineCount()
      ]);
      setStudents(res?.content || []);
      setTotalPages(res?.totalPages || 1);
      if (typeof onlineRes === 'number') {
        setOnlineCount(onlineRes);
      } else if (typeof onlineRes?.count === 'number') {
        setOnlineCount(onlineRes.count);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  async function handleToggleStatus(student) {
    if (isReadOnly) return;
    const isDisabling = student.status === 'active';
    const actionText = isDisabling ? 'Disable' : 'Enable';
    const confirmed = await confirm({
      title: `${actionText} Student Account?`,
      description: isDisabling
        ? `Are you sure you want to disable ${student.name}'s account? They will not be able to log in or access their courses until re-enabled.`
        : `Are you sure you want to enable ${student.name}'s account? They will regain access to their dashboard and enrolled courses.`,
      confirmText: `${actionText} Account`,
      cancelText: 'Cancel',
      variant: isDisabling ? 'warning' : 'info'
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      if (student.status === 'active') {
        await disableStudent(student.id);
      } else {
        await enableStudent(student.id);
      }
      toast.success(`Student ${student.name} successfully ${actionText.toLowerCase()}d.`);
      loadStudents();
      if (selectedStudent && selectedStudent.id === student.id) {
        openStudentDetail(student.id);
      }
    } catch (e) {
      toast.error('Failed to update student status');
    } finally {
      setActionLoading(false);
    }
  }

  async function openStudentDetail(id) {
    setDetailLoading(true);
    setProfileTab('overview');
    setExpandedCourseId(null);
    setTestFilter('ALL');
    try {
      const detail = await getStudentDetail(id);
      setSelectedStudent(detail);
    } catch (e) {
      toast.error('Could not load student details');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Student Management</h1>
          <p className="page-subtitle">
            Search, inspect learning progress, and manage student accounts.
          </p>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['ALL', 'ONLINE', 'ACTIVE', 'DISABLED'].map((st) => {
              let label = st === 'ALL' ? 'All Students' : st.charAt(0) + st.slice(1).toLowerCase();
              if (st === 'ONLINE') {
                label = `Online (${onlineCount})`;
              }
              return (
                <button
                  key={st}
                  onClick={() => { setStatus(st); setPage(0); }}
                  className={`btn btn-sm ${status === st ? 'btn-primary' : 'btn-secondary'}`}
                  style={st === 'ONLINE' ? { display: 'inline-flex', alignItems: 'center', gap: '6px' } : {}}
                >
                  {st === 'ONLINE' && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: status === st ? '#ffffff' : '#10b981',
                        boxShadow: '0 0 6px rgba(16, 185, 129, 0.8)'
                      }}
                    />
                  )}
                  {label}
                </button>
              );
            })}
          </div>

          <div className="table-search" style={{ width: '460px', maxWidth: '100%', position: 'relative' }}>
            <i
              className="fa-solid fa-magnifying-glass"
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '0.9rem',
                pointerEvents: 'none'
              }}
            />
            <input
              type="search"
              className="form-control"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{
                width: '100%',
                paddingLeft: '38px',
                paddingRight: search ? '36px' : '14px',
                height: '42px',
                fontSize: '0.92rem'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setPage(0); }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem'
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Joined Date</th>
                <th>Last Seen</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="table-empty">Loading students…</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-empty">No students found matching your criteria.</td>
                </tr>
              ) : (
                students.map((s) => {
                  const initials = s.name
                    ? s.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                    : 'S';
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            className="avatar-circle"
                            title={s.profileImage ? "Click to view full photo" : undefined}
                            onClick={() => {
                              if (s.profileImage) {
                                setIsFullScreenView(false);
                                setPreviewImage({
                                  url: s.profileImage,
                                  title: s.name,
                                  email: s.email,
                                  studentId: s.id
                                });
                              }
                            }}
                            style={{
                              width: '36px',
                              height: '36px',
                              fontSize: '0.85rem',
                              cursor: s.profileImage ? 'pointer' : 'default',
                              position: 'relative'
                            }}
                          >
                            {s.profileImage ? (
                              <img src={s.profileImage} alt={s.name} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              initials
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{s.name}</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${s.status}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                          {new Date(s.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const { primary, secondary, isOnline } = formatLastSeen(s.lastActiveAt);
                          return (
                            <div>
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.86rem',
                                  fontWeight: isOnline ? '700' : '600',
                                  color: isOnline ? '#10b981' : 'var(--text-primary)'
                                }}
                              >
                                <span
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: isOnline ? '#10b981' : (s.lastActiveAt ? '#94a3b8' : '#cbd5e1'),
                                    boxShadow: isOnline ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none'
                                  }}
                                />
                                {primary}
                              </div>
                              {secondary && (
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {secondary}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openStudentDetail(s.id)}
                          >
                            Details
                          </button>
                          {!isReadOnly && (
                            <button
                              className={`btn btn-sm ${s.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                              disabled={actionLoading}
                              onClick={() => handleToggleStatus(s)}
                            >
                              {s.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)'
          }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Page {page + 1} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Student Details Slide-Over Drawer */}
      {selectedStudent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 3000,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setSelectedStudent(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 'min(880px, 94vw)',
              height: '100%',
              background: 'var(--bg-surface, #ffffff)',
              borderLeft: '1px solid var(--border-default, #e2e8f0)',
              boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.28)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. STICKY TOP HEADER */}
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'var(--bg-surface, #ffffff)',
              borderBottom: '1px solid var(--border-default, #e2e8f0)',
              padding: '20px 28px 16px 28px',
              backdropFilter: 'blur(8px)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(79, 70, 229, 0.1)',
                    color: 'var(--accent-primary, #4f46e5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem'
                  }}>
                    <i className="fa-solid fa-user-graduate"></i>
                  </span>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      Student Learning & Performance Profile
                    </h2>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Comprehensive learning analytics, test results & engagement metrics
                    </span>
                  </div>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedStudent(null)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem'
                  }}
                  title="Close Profile"
                >
                  ✕
                </button>
              </div>

              {/* Student Identity Card */}
              {selectedStudent && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'var(--bg-card, #f8fafc)',
                  border: '1px solid var(--border-subtle, #f1f5f9)',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      className="avatar-circle"
                      title={selectedStudent.profileImage ? "Click to view full size photo" : undefined}
                      onClick={() => {
                        if (selectedStudent.profileImage) {
                          setIsFullScreenView(false);
                          setPreviewImage({
                            url: selectedStudent.profileImage,
                            title: selectedStudent.name,
                            email: selectedStudent.email,
                            studentId: selectedStudent.id
                          });
                        }
                      }}
                      style={{
                        width: '54px',
                        height: '54px',
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                        color: '#ffffff',
                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                        flexShrink: 0,
                        cursor: selectedStudent.profileImage ? 'pointer' : 'default',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                      }}
                    >
                      {selectedStudent.profileImage ? (
                        <>
                          <img
                            src={selectedStudent.profileImage}
                            alt={selectedStudent.name}
                            referrerPolicy="no-referrer"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              borderRadius: '50%',
                              background: 'rgba(15, 23, 42, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: 0,
                              transition: 'opacity 0.15s ease',
                              color: '#ffffff',
                              fontSize: '0.88rem'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
                          >
                            <i className="fa-solid fa-magnifying-glass-plus"></i>
                          </div>
                        </>
                      ) : (
                        selectedStudent.name ? selectedStudent.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'S'
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {selectedStudent.name}
                      </div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                        {selectedStudent.email}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span className={`status-badge ${selectedStudent.status}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                          {selectedStudent.status}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full, 9999px)',
                          background: selectedStudent.emailVerified ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: selectedStudent.emailVerified ? '#059669' : '#dc2626',
                          fontWeight: 700,
                          border: `1px solid ${selectedStudent.emailVerified ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                        }}>
                          {selectedStudent.emailVerified ? '✓ Verified' : 'Unverified'}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          • Enrolled in {selectedStudent.enrolledCourses?.length || 0} courses
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  {!isReadOnly && (
                    <button
                      className={`btn btn-sm ${selectedStudent.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                      disabled={actionLoading}
                      onClick={() => handleToggleStatus(selectedStudent)}
                      style={{ padding: '6px 14px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <i className={`fa-solid ${selectedStudent.status === 'active' ? 'fa-user-slash' : 'fa-user-check'}`}></i>
                      <span>{selectedStudent.status === 'active' ? 'Disable Account' : 'Enable Account'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Navigation Tabs Bar */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '16px',
                borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                paddingBottom: '2px',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}>
                {[
                  { id: 'overview', label: 'Overview', icon: 'fa-chart-pie', count: null },
                  { id: 'courses', label: 'Courses', icon: 'fa-book-open', count: selectedStudent?.enrolledCourses?.length || 0 },
                  { id: 'tests', label: 'Tests & Quizzes', icon: 'fa-clipboard-check', count: selectedStudent?.assessments?.length || 0 },
                  { id: 'attendance', label: 'Live Attendance', icon: 'fa-video', count: selectedStudent?.attendanceRecords?.length || 0 },
                  { id: 'activity', label: 'Timeline', icon: 'fa-clock-rotate-left', count: selectedStudent?.recentActivity?.length || 0 }
                ].map((t) => {
                  const isActive = profileTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setProfileTab(t.id)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px 8px 0 0',
                        fontSize: '0.84rem',
                        fontWeight: isActive ? 700 : 600,
                        border: 'none',
                        borderBottom: isActive ? '3px solid var(--accent-primary, #4f46e5)' : '3px solid transparent',
                        background: isActive ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                        color: isActive ? 'var(--accent-primary, #4f46e5)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <i className={`fa-solid ${t.icon}`} style={{ fontSize: '0.8rem' }}></i>
                      <span>{t.label}</span>
                      {t.count !== null && (
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          background: isActive ? 'var(--accent-primary, #4f46e5)' : 'var(--border-default, #e2e8f0)',
                          color: isActive ? '#ffffff' : 'var(--text-muted)',
                          fontWeight: 700
                        }}>
                          {t.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. SCROLLABLE BODY */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 28px 48px 28px',
              scrollBehavior: 'smooth'
            }}>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: 'var(--accent-primary)', marginBottom: '12px' }}></i>
                  <div style={{ fontWeight: 600 }}>Loading student learning analytics…</div>
                </div>
              ) : selectedStudent && (
                <div>
                  {/* KPI METRICS OVERVIEW (4-CARD GRID) */}
                  {(() => {
                    const analytics = selectedStudent.analytics || {
                      totalCoursesEnrolled: selectedStudent.enrolledCourses?.length || 0,
                      completedCourses: (selectedStudent.enrolledCourses || []).filter(c => (c.progressPercent || 0) >= 100).length,
                      inProgressCourses: (selectedStudent.enrolledCourses || []).filter(c => (c.progressPercent || 0) > 0 && (c.progressPercent || 0) < 100).length,
                      totalLessonsCompleted: (selectedStudent.enrolledCourses || []).reduce((acc, c) => acc + (c.completedContents || 0), 0),
                      totalLearningMinutes: 0,
                      overallProgressPercent: selectedStudent.enrolledCourses?.length
                        ? Math.round((selectedStudent.enrolledCourses.reduce((acc, c) => acc + (c.progressPercent || 0), 0) / selectedStudent.enrolledCourses.length) * 10) / 10
                        : 0,
                      totalQuizzesTaken: selectedStudent.assessments?.length || 0,
                      quizzesPassed: (selectedStudent.assessments || []).filter(a => a.passed).length,
                      averageQuizScore: 0,
                      liveSessionsAttended: (selectedStudent.attendanceRecords || []).filter(a => a.status === 'PRESENT').length,
                      totalLiveSessions: selectedStudent.attendanceRecords?.length || 0
                    };

                    const learnHours = Math.floor(analytics.totalLearningMinutes / 60);
                    const learnMins = analytics.totalLearningMinutes % 60;
                    const learnTimeDisplay = learnHours > 0 ? `${learnHours}h ${learnMins}m` : `${learnMins || analytics.totalLessonsCompleted * 15}m`;

                    const attendanceRate = analytics.totalLiveSessions > 0
                      ? Math.round((analytics.liveSessionsAttended / analytics.totalLiveSessions) * 100)
                      : (analytics.liveSessionsAttended > 0 ? 100 : 0);

                    return (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
                        gap: '14px',
                        marginBottom: '28px'
                      }}>
                        {/* 1. Watch Time */}
                        <div style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(99, 102, 241, 0.02) 100%)',
                          border: '1px solid rgba(79, 70, 229, 0.15)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Learning Time
                            </span>
                            <span style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(79, 70, 229, 0.12)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                              <i className="fa-solid fa-clock"></i>
                            </span>
                          </div>
                          <div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                              {learnTimeDisplay}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {analytics.totalLessonsCompleted} lessons completed
                            </div>
                          </div>
                        </div>

                        {/* 2. Course Progress */}
                        <div style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(5, 150, 105, 0.02) 100%)',
                          border: '1px solid rgba(16, 185, 129, 0.15)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Avg Progress
                            </span>
                            <span style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                              <i className="fa-solid fa-graduation-cap"></i>
                            </span>
                          </div>
                          <div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                              {Math.round(analytics.overallProgressPercent)}%
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {analytics.completedCourses} Done • {analytics.inProgressCourses} In-Progress
                            </div>
                          </div>
                        </div>

                        {/* 3. Tests & Assessments */}
                        <div style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(217, 119, 6, 0.02) 100%)',
                          border: '1px solid rgba(245, 158, 11, 0.15)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Test Score
                            </span>
                            <span style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                              <i className="fa-solid fa-award"></i>
                            </span>
                          </div>
                          <div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                              {analytics.totalQuizzesTaken > 0 ? `${Math.round(analytics.averageQuizScore)}%` : '—'}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {analytics.quizzesPassed} / {analytics.totalQuizzesTaken} Tests Passed
                            </div>
                          </div>
                        </div>

                        {/* 4. Live Attendance */}
                        <div style={{
                          padding: '14px 16px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(124, 58, 237, 0.02) 100%)',
                          border: '1px solid rgba(139, 92, 246, 0.15)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Live Attendance
                            </span>
                            <span style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                              <i className="fa-solid fa-video"></i>
                            </span>
                          </div>
                          <div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                              {attendanceRate}%
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {analytics.liveSessionsAttended} / {analytics.totalLiveSessions || analytics.liveSessionsAttended} Attended
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* TAB 1: OVERVIEW */}
                  {profileTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                      {/* Course Completion Breakdown */}
                      <div style={{
                        padding: '20px',
                        borderRadius: '14px',
                        background: 'var(--bg-card, #ffffff)',
                        border: '1px solid var(--border-default, #e2e8f0)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                          <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                            Enrolled Courses & Progress Snapshot
                          </h3>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setProfileTab('courses')}
                            style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                          >
                            View All Courses →
                          </button>
                        </div>

                        {(!selectedStudent.enrolledCourses || selectedStudent.enrolledCourses.length === 0) ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem', textAlign: 'center', padding: '24px 0' }}>
                            No courses enrolled yet.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {selectedStudent.enrolledCourses.map((c) => {
                              const pct = Math.round(c.progressPercent || 0);
                              return (
                                <div key={c.enrollmentId} style={{
                                  padding: '12px 14px',
                                  borderRadius: '10px',
                                  background: 'var(--bg-surface, #f8fafc)',
                                  border: '1px solid var(--border-subtle, #f1f5f9)'
                                }}>
                                  {(c.totalContents || 0) === 0 ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                        {c.courseName}
                                      </div>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        background: 'var(--bg-surface, #f1f5f9)',
                                        border: '1px solid var(--border-default, #cbd5e1)',
                                        color: 'var(--text-muted, #64748b)'
                                      }}>
                                        <i className="fa-solid fa-video-slash" style={{ fontSize: '0.7rem' }}></i>
                                        No videos
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                          {c.courseName}
                                        </div>
                                        <span style={{
                                          fontSize: '0.78rem',
                                          fontWeight: 800,
                                          color: pct >= 100 ? '#059669' : 'var(--accent-primary, #4f46e5)'
                                        }}>
                                          {pct}%
                                        </span>
                                      </div>
                                      <div className="progress-bar-wrap" style={{ height: '7px', marginBottom: '6px' }}>
                                        <div
                                          className="progress-bar-fill"
                                          style={{
                                            width: `${pct}%`,
                                            background: pct >= 100 ? 'linear-gradient(90deg, #10b981, #059669)' : undefined
                                          }}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                        <span>{c.completedContents || 0} / {c.totalContents || 0} lessons completed</span>
                                        <span>Last seen: {c.lastAccessedAt ? new Date(c.lastAccessedAt).toLocaleDateString() : 'Never'}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Performance Insights Summary */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '16px'
                      }}>
                        {/* Test Quick Summary */}
                        <div style={{
                          padding: '18px',
                          borderRadius: '14px',
                          background: 'var(--bg-card, #ffffff)',
                          border: '1px solid var(--border-default, #e2e8f0)',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                              <i className="fa-solid fa-award" style={{ color: '#d97706', marginRight: '6px' }}></i>
                              Assessment Performance
                            </h4>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setProfileTab('tests')}
                              style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                            >
                              Details
                            </button>
                          </div>
                          {(!selectedStudent.assessments || selectedStudent.assessments.length === 0) ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem', padding: '16px 0', textAlign: 'center' }}>
                              No tests attempted yet.
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Passing Rate</span>
                                <span style={{ fontWeight: 800, color: '#059669', fontSize: '0.88rem' }}>
                                  {Math.round((selectedStudent.assessments.filter(a => a.passed).length / selectedStudent.assessments.length) * 100)}%
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {selectedStudent.assessments.slice(0, 2).map((a) => (
                                  <div key={a.attemptId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-surface, #f8fafc)' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                                      {a.title}
                                    </span>
                                    <span style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: a.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                      color: a.passed ? '#059669' : '#dc2626'
                                    }}>
                                      {Math.round(a.percentage)}% {a.passed ? 'PASS' : 'FAIL'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Live Session Quick Summary */}
                        <div style={{
                          padding: '18px',
                          borderRadius: '14px',
                          background: 'var(--bg-card, #ffffff)',
                          border: '1px solid var(--border-default, #e2e8f0)',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                              <i className="fa-solid fa-video" style={{ color: '#7c3aed', marginRight: '6px' }}></i>
                              Live Class Attendance
                            </h4>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setProfileTab('attendance')}
                              style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                            >
                              History
                            </button>
                          </div>
                          {(!selectedStudent.attendanceRecords || selectedStudent.attendanceRecords.length === 0) ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem', padding: '16px 0', textAlign: 'center' }}>
                              No live sessions scheduled or joined.
                            </div>
                          ) : (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Classes Attended</span>
                                <span style={{ fontWeight: 800, color: '#7c3aed', fontSize: '0.88rem' }}>
                                  {selectedStudent.attendanceRecords.filter(a => a.status === 'PRESENT').length} / {selectedStudent.attendanceRecords.length}
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {selectedStudent.attendanceRecords.slice(0, 2).map((att) => (
                                  <div key={att.attendanceId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-surface, #f8fafc)' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                                      {att.sessionTitle}
                                    </span>
                                    <span style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: att.status === 'PRESENT' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                      color: att.status === 'PRESENT' ? '#059669' : '#64748b'
                                    }}>
                                      {att.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Recent Activity Mini-Feed */}
                      {selectedStudent.recentActivity && selectedStudent.recentActivity.length > 0 && (
                        <div style={{
                          padding: '20px',
                          borderRadius: '14px',
                          background: 'var(--bg-card, #ffffff)',
                          border: '1px solid var(--border-default, #e2e8f0)',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <h3 style={{ fontSize: '0.96rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                              Recent Learning Milestones
                            </h3>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setProfileTab('activity')}
                              style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                            >
                              Full Log →
                            </button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {selectedStudent.recentActivity.slice(0, 4).map((act, idx) => (
                              <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                background: 'var(--bg-surface, #f8fafc)',
                                border: '1px solid var(--border-subtle, #f1f5f9)'
                              }}>
                                <span style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: act.type === 'LESSON_COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : act.type === 'ASSESSMENT' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(79, 70, 229, 0.12)',
                                  color: act.type === 'LESSON_COMPLETED' ? '#059669' : act.type === 'ASSESSMENT' ? '#d97706' : '#4f46e5',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.8rem',
                                  flexShrink: 0
                                }}>
                                  <i className={`fa-solid ${act.icon || 'fa-bolt'}`}></i>
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {act.title}
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                    {act.description}
                                  </div>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                  {act.timestamp ? new Date(act.timestamp).toLocaleDateString() : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ENROLLED COURSES & CURRICULUM */}
                  {profileTab === 'courses' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          Enrolled Courses ({selectedStudent.enrolledCourses?.length || 0})
                        </span>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          Click a course to expand section-level curriculum progress
                        </span>
                      </div>

                      {(!selectedStudent.enrolledCourses || selectedStudent.enrolledCourses.length === 0) ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '48px 20px',
                          background: 'var(--bg-card, #ffffff)',
                          borderRadius: '14px',
                          border: '1px dashed var(--border-default, #e2e8f0)',
                          color: 'var(--text-muted)'
                        }}>
                          <i className="fa-solid fa-book-open" style={{ fontSize: '2rem', marginBottom: '10px', color: 'var(--border-default)' }}></i>
                          <div style={{ fontWeight: 700 }}>No course enrollments found</div>
                          <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>This student is not enrolled in any courses yet.</div>
                        </div>
                      ) : (
                        selectedStudent.enrolledCourses.map((c) => {
                          const isExpanded = expandedCourseId === c.courseId;
                          const pct = Math.round(c.progressPercent || 0);
                          return (
                            <div
                              key={c.enrollmentId}
                              style={{
                                borderRadius: '14px',
                                border: '1px solid var(--border-default, #e2e8f0)',
                                background: 'var(--bg-card, #ffffff)',
                                boxShadow: 'var(--shadow-sm)',
                                overflow: 'hidden',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div
                                style={{
                                  padding: '18px 20px',
                                  cursor: 'pointer',
                                  background: isExpanded ? 'var(--bg-surface, #f8fafc)' : 'transparent',
                                  borderBottom: isExpanded ? '1px solid var(--border-subtle, #f1f5f9)' : 'none'
                                }}
                                onClick={() => setExpandedCourseId(isExpanded ? null : c.courseId)}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                      {c.courseName}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                      <span style={{
                                        fontSize: '0.72rem',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        background: 'rgba(79, 70, 229, 0.08)',
                                        color: '#4f46e5',
                                        fontWeight: 700
                                      }}>
                                        {c.categoryName || 'Course'}
                                      </span>
                                      <span>• Enrolled {new Date(c.enrolledAt).toLocaleDateString()}</span>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{
                                      fontSize: '0.88rem',
                                      fontWeight: 800,
                                      color: pct >= 100 ? '#059669' : 'var(--accent-primary, #4f46e5)',
                                      background: pct >= 100 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(79, 70, 229, 0.08)',
                                      padding: '3px 9px',
                                      borderRadius: '6px'
                                    }}>
                                      {pct}%
                                    </span>
                                    <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}></i>
                                  </div>
                                </div>

                                {(c.totalContents || 0) === 0 ? (
                                  <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-surface, #f1f5f9)', border: '1px solid var(--border-default, #cbd5e1)', padding: '3px 8px', borderRadius: '6px' }}>
                                    <i className="fa-solid fa-video-slash" style={{ fontSize: '0.72rem' }}></i>
                                    <span>No videos (Recordings only)</span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="progress-bar-wrap" style={{ height: '8px', marginTop: '10px', marginBottom: '6px' }}>
                                      <div
                                        className="progress-bar-fill"
                                        style={{
                                          width: `${pct}%`,
                                          background: pct >= 100 ? 'linear-gradient(90deg, #10b981, #059669)' : undefined
                                        }}
                                      />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                      <span>
                                        <i className="fa-solid fa-circle-check" style={{ color: '#059669', marginRight: '4px' }}></i>
                                        {c.completedContents || 0} of {c.totalContents || 0} lessons completed
                                      </span>
                                      <span>
                                        <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i>
                                        Last Active: {c.lastAccessedAt ? new Date(c.lastAccessedAt).toLocaleDateString() : 'Never'}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Expanded Section Details */}
                              {isExpanded && (
                                <div style={{ padding: '16px 20px', background: 'var(--bg-surface, #f8fafc)' }}>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                    Curriculum Sections Breakdown
                                  </div>
                                  {(!c.sections || c.sections.length === 0) ? (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      No detailed section telemetry available for this course.
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {c.sections.map((sec) => (
                                        <div key={sec.sectionId} style={{
                                          padding: '10px 14px',
                                          borderRadius: '8px',
                                          background: 'var(--bg-card, #ffffff)',
                                          border: '1px solid var(--border-subtle, #f1f5f9)',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center'
                                        }}>
                                          <div style={{ flex: 1, marginRight: '16px' }}>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                              {sec.sectionTitle}
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                              {sec.completedContents} / {sec.totalContents} lessons done
                                            </div>
                                          </div>
                                          <div style={{ width: '110px', textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: sec.progressPercent >= 100 ? '#059669' : 'var(--text-primary)' }}>
                                              {Math.round(sec.progressPercent)}%
                                            </div>
                                            <div className="progress-bar-wrap" style={{ height: '5px', marginTop: '4px' }}>
                                              <div
                                                className="progress-bar-fill"
                                                style={{
                                                  width: `${sec.progressPercent}%`,
                                                  background: sec.progressPercent >= 100 ? '#10b981' : undefined
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* TAB 3: TESTS & ASSESSMENTS */}
                  {profileTab === 'tests' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Assessment & Quiz Attempts ({selectedStudent.assessments?.length || 0})
                        </div>

                        {/* Filter Tabs */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {['ALL', 'PASSED', 'FAILED'].map((flt) => (
                            <button
                              key={flt}
                              className={`btn btn-xs ${testFilter === flt ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => setTestFilter(flt)}
                              style={{ padding: '3px 10px', fontSize: '0.74rem' }}
                            >
                              {flt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(!selectedStudent.assessments || selectedStudent.assessments.length === 0) ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '52px 20px',
                          background: 'var(--bg-card, #ffffff)',
                          borderRadius: '14px',
                          border: '1px dashed var(--border-default, #e2e8f0)',
                          color: 'var(--text-muted)'
                        }}>
                          <i className="fa-solid fa-clipboard-check" style={{ fontSize: '2.2rem', marginBottom: '12px', color: 'var(--border-default)' }}></i>
                          <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)' }}>No Assessments Attempted</div>
                          <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                            This student has not taken any module quizzes or exams yet.
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {selectedStudent.assessments
                            .filter((a) => {
                              if (testFilter === 'PASSED') return a.passed;
                              if (testFilter === 'FAILED') return !a.passed;
                              return true;
                            })
                            .map((a) => {
                              const pct = Math.round(a.percentage || 0);
                              return (
                                <div
                                  key={a.attemptId}
                                  style={{
                                    padding: '16px 18px',
                                    borderRadius: '12px',
                                    background: 'var(--bg-card, #ffffff)',
                                    border: `1px solid ${a.passed ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.2)'}`,
                                    boxShadow: 'var(--shadow-sm)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '16px'
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                      <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: a.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        color: a.passed ? '#059669' : '#dc2626',
                                        border: `1px solid ${a.passed ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                                      }}>
                                        {a.passed ? '✓ PASSED' : '✕ FAILED'}
                                      </span>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                        {a.courseName}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {a.title}
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      <span>Score: {a.score} / {a.totalMarks} marks</span>
                                      <span>• Requires {Math.round(a.passingPercentage)}% to pass</span>
                                      {a.completedAt && (
                                        <span>• Completed: {new Date(a.completedAt).toLocaleString()}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{
                                      fontSize: '1.4rem',
                                      fontWeight: 800,
                                      color: a.passed ? '#059669' : '#dc2626',
                                      lineHeight: 1.1
                                    }}>
                                      {pct}%
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      {a.status}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: LIVE CLASS ATTENDANCE */}
                  {profileTab === 'attendance' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Live Meeting Attendance Log ({selectedStudent.attendanceRecords?.length || 0})
                        </span>
                      </div>

                      {(!selectedStudent.attendanceRecords || selectedStudent.attendanceRecords.length === 0) ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '52px 20px',
                          background: 'var(--bg-card, #ffffff)',
                          borderRadius: '14px',
                          border: '1px dashed var(--border-default, #e2e8f0)',
                          color: 'var(--text-muted)'
                        }}>
                          <i className="fa-solid fa-video" style={{ fontSize: '2.2rem', marginBottom: '12px', color: 'var(--border-default)' }}></i>
                          <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)' }}>No Live Attendance Records</div>
                          <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                            The student has not attended scheduled live meeting sessions yet.
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {selectedStudent.attendanceRecords.map((att) => {
                            const isPresent = att.status === 'PRESENT';
                            return (
                              <div
                                key={att.attendanceId}
                                style={{
                                  padding: '14px 16px',
                                  borderRadius: '12px',
                                  background: 'var(--bg-card, #ffffff)',
                                  border: '1px solid var(--border-default, #e2e8f0)',
                                  boxShadow: 'var(--shadow-sm)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '14px'
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                    {att.sessionTitle}
                                  </div>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {att.courseName} • Scheduled: {att.scheduledAt ? new Date(att.scheduledAt).toLocaleString() : 'N/A'}
                                  </div>
                                  {att.joinedAt && (
                                    <div style={{ fontSize: '0.74rem', color: 'var(--accent-primary, #4f46e5)', marginTop: '3px' }}>
                                      <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i>
                                      Joined at {new Date(att.joinedAt).toLocaleTimeString()}
                                    </div>
                                  )}
                                </div>

                                <span style={{
                                  fontSize: '0.74rem',
                                  fontWeight: 800,
                                  padding: '3px 10px',
                                  borderRadius: '6px',
                                  background: isPresent ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                                  color: isPresent ? '#059669' : '#64748b',
                                  border: `1px solid ${isPresent ? 'rgba(16, 185, 129, 0.25)' : 'rgba(100, 116, 139, 0.25)'}`
                                }}>
                                  {isPresent ? '✓ PRESENT' : 'ABSENT'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: ACTIVITY TIMELINE */}
                  {profileTab === 'activity' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Learning Activity & Audit Trail
                      </div>

                      {(!selectedStudent.recentActivity || selectedStudent.recentActivity.length === 0) ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '52px 20px',
                          background: 'var(--bg-card, #ffffff)',
                          borderRadius: '14px',
                          border: '1px dashed var(--border-default, #e2e8f0)',
                          color: 'var(--text-muted)'
                        }}>
                          <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '2.2rem', marginBottom: '12px', color: 'var(--border-default)' }}></i>
                          <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-primary)' }}>No Activity Recorded</div>
                          <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                            Activity will appear here as the student watches videos, completes lessons, or attends live classes.
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          position: 'relative',
                          paddingLeft: '8px'
                        }}>
                          {selectedStudent.recentActivity.map((act, idx) => (
                            <div key={idx} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '14px',
                              padding: '12px 16px',
                              borderRadius: '12px',
                              background: 'var(--bg-card, #ffffff)',
                              border: '1px solid var(--border-default, #e2e8f0)',
                              boxShadow: 'var(--shadow-sm)'
                            }}>
                              <span style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: act.type === 'LESSON_COMPLETED' ? 'rgba(16, 185, 129, 0.12)' : act.type === 'ASSESSMENT' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(79, 70, 229, 0.12)',
                                color: act.type === 'LESSON_COMPLETED' ? '#059669' : act.type === 'ASSESSMENT' ? '#d97706' : '#4f46e5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.85rem',
                                flexShrink: 0
                              }}>
                                <i className={`fa-solid ${act.icon || 'fa-bolt'}`}></i>
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {act.title}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  {act.description}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                  <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i>
                                  {act.timestamp ? new Date(act.timestamp).toLocaleString() : ''}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp-Style Profile Picture Viewer & Quick Card */}
      {previewImage && (() => {
        const hdImageUrl = getHighResAvatarUrl(previewImage.url);
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: isFullScreenView ? '#000000' : 'rgba(11, 20, 26, 0.78)',
              backdropFilter: isFullScreenView ? 'none' : 'blur(8px)',
              WebkitBackdropFilter: isFullScreenView ? 'none' : 'blur(8px)',
              zIndex: 4000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: isFullScreenView ? 0 : '16px',
              animation: 'fadeIn 0.18s ease-out'
            }}
            onClick={() => {
              if (isFullScreenView) {
                setIsFullScreenView(false);
                setZoomLevel(1);
              } else {
                setPreviewImage(null);
              }
            }}
          >
            {!isFullScreenView ? (
              /* WhatsApp Signature Square Popup Card */
              <div
                style={{
                  position: 'relative',
                  width: 'min(380px, 92vw)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background: '#111b21',
                  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Square Image Box (1:1 Aspect Ratio) */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '1 / 1',
                    background: '#0b141a',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setIsFullScreenView(true);
                    setZoomLevel(1);
                  }}
                  title="Click to view full photo"
                >
                  <img
                    src={hdImageUrl}
                    alt={previewImage.title}
                    onError={(e) => {
                      if (e.currentTarget.src !== previewImage.url) {
                        e.currentTarget.src = previewImage.url;
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      imageRendering: '-webkit-optimize-contrast'
                    }}
                  />

                  {/* Top Gradient Overlay with Contact Name */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      padding: '14px 16px 36px 16px',
                      background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      pointerEvents: 'none'
                    }}
                  >
                    <div style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)' }}>
                      <div style={{
                        color: '#ffffff',
                        fontWeight: 600,
                        fontSize: '1.18rem',
                        letterSpacing: '0.2px'
                      }}>
                        {previewImage.title}
                      </div>
                      {previewImage.email && (
                        <div style={{
                          color: 'rgba(255, 255, 255, 0.85)',
                          fontSize: '0.78rem',
                          marginTop: '2px'
                        }}>
                          {previewImage.email}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(null);
                      }}
                      style={{
                        pointerEvents: 'auto',
                        background: 'rgba(0, 0, 0, 0.45)',
                        border: 'none',
                        color: '#ffffff',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        backdropFilter: 'blur(4px)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.75)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.45)'}
                      title="Close (Esc)"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Subtle Click Cue Overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      background: 'rgba(0, 0, 0, 0.55)',
                      color: '#ffffff',
                      borderRadius: '20px',
                      padding: '4px 9px',
                      fontSize: '0.72rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backdropFilter: 'blur(4px)',
                      pointerEvents: 'none'
                    }}
                  >
                    <i className="fa-solid fa-expand"></i>
                    <span>Full View</span>
                  </div>
                </div>

                {/* WhatsApp Signature Bottom Action Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    padding: '8px 12px',
                    background: '#ffffff',
                    borderTop: '1px solid rgba(0, 0, 0, 0.06)'
                  }}
                >
                  {/* Message / Email Action */}
                  <a
                    href={previewImage.email ? `mailto:${previewImage.email}` : '#'}
                    title={`Send Email to ${previewImage.title}`}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#00a884',
                      fontSize: '1.2rem',
                      textDecoration: 'none',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 168, 132, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <i className="fa-solid fa-comment-dots"></i>
                  </a>

                  {/* View Student Profile Action */}
                  <button
                    type="button"
                    title="View Student Learning Profile"
                    onClick={() => {
                      if (previewImage.studentId) {
                        openStudentDetail(previewImage.studentId);
                      }
                      setPreviewImage(null);
                    }}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      border: 'none',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#00a884',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 168, 132, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <i className="fa-solid fa-circle-info"></i>
                  </button>

                  {/* Open Original Image */}
                  <a
                    href={hdImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open Original HD Image in New Tab"
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#00a884',
                      fontSize: '1.15rem',
                      textDecoration: 'none',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 168, 132, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                  </a>

                  {/* Fullscreen Expand Action */}
                  <button
                    type="button"
                    title="View Full Screen"
                    onClick={() => {
                      setIsFullScreenView(true);
                      setZoomLevel(1);
                    }}
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      border: 'none',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#00a884',
                      fontSize: '1.15rem',
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 168, 132, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <i className="fa-solid fa-expand"></i>
                  </button>
                </div>
              </div>
            ) : (
              /* WhatsApp Full-Screen Photo Viewer */
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: '#000000',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 4100
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* WhatsApp App Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    background: 'rgba(11, 20, 26, 0.95)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFullScreenView(false);
                        setZoomLevel(1);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title="Back (Esc)"
                    >
                      <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: '#1f2c34',
                        flexShrink: 0
                      }}
                    >
                      <img src={hdImageUrl} alt="" onError={(e) => { if (e.currentTarget.src !== previewImage.url) e.currentTarget.src = previewImage.url; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#ffffff' }}>
                        {previewImage.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#8696a0' }}>
                        {previewImage.email || 'Student Profile Photo'}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Zoom Controls in App Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Zoom In */}
                    <button
                      type="button"
                      onClick={() => setZoomLevel(z => Math.min(+(z + 0.4).toFixed(1), 3))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#aebac1',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                        padding: '8px 10px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.15s, background 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#aebac1';
                        e.currentTarget.style.background = 'transparent';
                      }}
                      title="Zoom In"
                    >
                      <i className="fa-solid fa-magnifying-glass-plus"></i>
                    </button>

                    {/* Zoom Out */}
                    <button
                      type="button"
                      onClick={() => setZoomLevel(z => Math.max(+(z - 0.4).toFixed(1), 1))}
                      disabled={zoomLevel <= 1}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: zoomLevel <= 1 ? '#4b5563' : '#aebac1',
                        fontSize: '1.1rem',
                        cursor: zoomLevel <= 1 ? 'not-allowed' : 'pointer',
                        padding: '8px 10px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.15s, background 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        if (zoomLevel > 1) {
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (zoomLevel > 1) {
                          e.currentTarget.style.color = '#aebac1';
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                      title="Zoom Out"
                    >
                      <i className="fa-solid fa-magnifying-glass-minus"></i>
                    </button>

                    {zoomLevel > 1 && (
                      <button
                        type="button"
                        onClick={() => setZoomLevel(1)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '4px 8px',
                          borderRadius: '12px',
                          cursor: 'pointer'
                        }}
                        title="Reset zoom (1:1)"
                      >
                        Reset
                      </button>
                    )}

                    <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

                    {/* Open Original */}
                    <a
                      href={hdImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: '#aebac1',
                        fontSize: '1.1rem',
                        padding: '8px 10px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        transition: 'color 0.15s, background 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#aebac1';
                        e.currentTarget.style.background = 'transparent';
                      }}
                      title="Open Original HD Image"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>

                    {/* Close */}
                    <button
                      type="button"
                      onClick={() => setPreviewImage(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#aebac1',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        padding: '8px 10px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.15s, background 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#aebac1';
                        e.currentTarget.style.background = 'transparent';
                      }}
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Big Immersive Image Canvas */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    overflow: 'auto',
                    background: '#000000',
                    position: 'relative'
                  }}
                  onClick={() => {
                    if (zoomLevel > 1) {
                      setZoomLevel(1);
                    } else {
                      setIsFullScreenView(false);
                    }
                  }}
                >
                  <div
                    style={{
                      width: 'min(760px, 92vw)',
                      height: 'min(760px, 80vh)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: `scale(${zoomLevel})`,
                      transition: 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)',
                      cursor: zoomLevel > 1 ? 'zoom-out' : 'zoom-in',
                      position: 'relative'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomLevel(z => z > 1 ? 1 : 1.6);
                    }}
                    title={zoomLevel > 1 ? "Click to zoom out" : "Click to zoom in"}
                  >
                    <img
                      src={hdImageUrl}
                      alt={previewImage.title}
                      onError={(e) => {
                        if (e.currentTarget.src !== previewImage.url) {
                          e.currentTarget.src = previewImage.url;
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 15px 45px rgba(0, 0, 0, 0.9))',
                        userSelect: 'none',
                        display: 'block'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
