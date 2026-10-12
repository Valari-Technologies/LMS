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

          <div className="table-search">
            <input
              type="search"
              className="form-control"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
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
                          <div className="avatar-circle" style={{ width: '36px', height: '36px', fontSize: '0.85rem' }}>
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
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 3000,
            display: 'flex',
            justifyContent: 'flex-end'
          }}
          onClick={() => setSelectedStudent(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              height: '100%',
              background: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-xl)',
              overflowY: 'auto',
              padding: '28px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>Student Profile</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedStudent(null)}>✕</button>
            </div>

            {detailLoading ? (
              <div>Loading profile details…</div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <div className="avatar-circle" style={{ width: '56px', height: '56px', fontSize: '1.3rem' }}>
                    {selectedStudent.profileImage ? (
                      <img src={selectedStudent.profileImage} alt={selectedStudent.name} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      selectedStudent.name ? selectedStudent.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'S'
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>{selectedStudent.name}</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{selectedStudent.email}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <span className={`status-badge ${selectedStudent.status}`}>{selectedStudent.status}</span>
                      <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-subtle)', color: 'var(--accent-primary)', fontWeight: '700' }}>
                        {selectedStudent.emailVerified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-clock" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}></i>
                      <span>
                        Last Visit: {selectedStudent.lastActiveAt ? new Date(selectedStudent.lastActiveAt).toLocaleString() : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '14px', color: 'var(--text-primary)' }}>
                    Enrolled Courses ({selectedStudent.enrolledCourses?.length || 0})
                  </h3>

                  {(!selectedStudent.enrolledCourses || selectedStudent.enrolledCourses.length === 0) ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>
                      No active enrollments found for this student.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {selectedStudent.enrolledCourses.map((c) => (
                        <div
                          key={c.enrollmentId}
                          style={{
                            padding: '14px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-card)'
                          }}
                        >
                          <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                            {c.courseName}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {c.categoryName || 'General'} • Enrolled {new Date(c.enrolledAt).toLocaleDateString()}
                          </div>
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              <span>Progress</span>
                              <span>{Math.round(c.progressPercent || 0)}%</span>
                            </div>
                            <div className="progress-bar-wrap">
                              <div className="progress-bar-fill" style={{ width: `${c.progressPercent || 0}%` }} />
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-regular fa-clock" style={{ fontSize: '0.7rem' }}></i>
                              <span>Course Last Seen: {c.lastAccessedAt ? new Date(c.lastAccessedAt).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Never'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
