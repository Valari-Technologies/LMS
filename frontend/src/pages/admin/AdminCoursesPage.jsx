import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { publishCourse, unpublishCourse, archiveCourse, unarchiveCourse, duplicateCourse, approveCourseEdits, rejectCourseEdits } from '../../api/courses';
import { listCategories } from '../../api/categories';
import { listSections } from '../../api/sections';
import { listContents } from '../../api/contents';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import { useAuth } from '../../auth/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { subscribeSyncEvents, SYNC_EVENTS } from '../../utils/syncEvents';
import AlertBanner from '../../components/AlertBanner';
import { usePermission } from '../../hooks/usePermission';

export default function AdminCoursesPage() {
  const { isReadOnly } = usePermission();
  const { user } = useAuth();
  const { toast, confirm } = useNotification();
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [alert, setAlert] = useState('');

  // Super Admin Verification Modal State
  const [reviewCourse, setReviewCourse] = useState(null);
  const [reviewSections, setReviewSections] = useState([]);
  const [reviewContentsMap, setReviewContentsMap] = useState({});
  const [loadingReviewSections, setLoadingReviewSections] = useState(false);

  async function openReviewModal(courseItem) {
    setReviewCourse(courseItem);
    setLoadingReviewSections(true);
    try {
      const secData = await listSections(courseItem.id);
      const safeSections = secData || [];
      setReviewSections(safeSections);

      const contentsMap = {};
      for (let i = 0; i < safeSections.length; i++) {
        const s = safeSections[i];
        try {
          const cData = await listContents(s.id);
          contentsMap[s.id] = cData || [];
        } catch {
          contentsMap[s.id] = [];
        }
      }
      setReviewContentsMap(contentsMap);
    } catch (e) {
      setReviewSections([]);
      setReviewContentsMap({});
    } finally {
      setLoadingReviewSections(false);
    }
  }

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.get('/courses/admin/all', { params: { size: 100 } });
      setCourses(res.data.data.content || []);
    } catch (err) {
      // ignore
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    listCategories({ size: 100 })
      .then((data) => setCategories(data?.content || []))
      .catch(() => {});

    // 1. Cross-tab sync
    const unsub = subscribeSyncEvents((event) => {
      if (event.type === SYNC_EVENTS.COURSES_CHANGED) {
        load(false);
      }
    });

    // 2. Background polling every 12s
    const pollInterval = setInterval(() => load(false), 12_000);

    // 3. Focus / visibility
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        load(false);
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
  }, [load]);

  const handleAction = async (fn, id, actionName) => {
    if (isReadOnly) return;
    setActionLoading(id);
    setAlert('');
    try {
      await fn(id);
      const msg = `Course successfully ${actionName}!`;
      setAlert(msg);
      toast.success(msg);
      load();
    } catch (err) {
      const msg = err.response?.data?.message || `Failed to ${actionName} course.`;
      setAlert(`Error: ${msg}`);
      toast.error(msg);
    } finally {
      setActionLoading(null);
    }
  };

  // Combine categories from API and any present on course records
  const categoryOptions = [...categories];
  courses.forEach((c) => {
    if (
      c.categoryName &&
      !categoryOptions.some(
        (cat) =>
          String(cat.id) === String(c.categoryId) ||
          cat.name?.toLowerCase() === c.categoryName?.toLowerCase()
      )
    ) {
      categoryOptions.push({ id: c.categoryId || c.categoryName, name: c.categoryName });
    }
  });

  const filteredCourses = courses.filter((c) => {
    const matchesStatus =
      statusFilter === 'ALL' || c.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesCategory =
      categoryFilter === 'ALL' ||
      String(c.categoryId) === String(categoryFilter) ||
      String(c.categoryName || '').toLowerCase() === String(categoryFilter).toLowerCase();
    const matchesSearch =
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.categoryName?.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Course Management</h1>
          <p className="page-subtitle">
            Create, publish, edit, and organize learning curricula.
          </p>
        </div>
        {!isReadOnly && (
          <Link to="/admin/courses/create" className="btn btn-primary">
            + Create New Course
          </Link>
        )}
      </div>

      <AlertBanner
        type={alert.startsWith('Error') ? 'error' : 'success'}
        message={alert}
        onClose={() => setAlert('')}
      />

      <div className="table-card">
        <div className="table-toolbar">
          {/* Status Tabs and Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {st === 'ALL' ? 'All Status' : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Category Filter Dropdown (Default: All Categories) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <i
                  className="fa-solid fa-folder-tree"
                  style={{
                    position: 'absolute',
                    left: '10px',
                    fontSize: '0.82rem',
                    color: 'var(--accent-primary)',
                    pointerEvents: 'none'
                  }}
                ></i>
                <select
                  id="category-filter"
                  className="form-control"
                  style={{
                    width: 'auto',
                    minWidth: '180px',
                    padding: '7px 12px 7px 30px',
                    fontSize: '0.88rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: 'var(--bg-surface)'
                  }}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter courses by category"
                >
                  <option value="ALL">All Categories</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {categoryFilter !== 'ALL' && (
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className="btn btn-ghost btn-sm"
                  title="Clear category filter"
                  style={{ padding: '6px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}
                >
                  <i className="fa-solid fa-xmark" style={{ marginRight: '4px' }}></i> Clear
                </button>
              )}
            </div>
          </div>

          <div className="table-search">
            <input
              type="search"
              className="form-control"
              placeholder="Search by title or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '36%' }}>Course</th>
                <th>Category</th>
                <th>Pricing</th>
                <th>Version</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    Loading courses…
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty">
                    No courses found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredCourses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          width: '48px',
                          height: '36px',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          background: 'linear-gradient(135deg, #1e1e38 0%, #2a2a50 100%)',
                          flexShrink: 0
                        }}>
                          {c.thumbnail ? (
                            <img
                              src={c.thumbnail}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div style={{
                            display: c.thumbnail ? 'none' : 'flex',
                            width: '100%',
                            height: '100%',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem',
                            color: '#fff'
                          }}>
                            <i className="fa-solid fa-book-open"></i>
                          </div>
                        </div>
                        <div>
                          <Link to={`/admin/courses/${c.id}/edit`} style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                            {c.name}
                          </Link>
                          {c.shortDesc && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.shortDesc}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.86rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                        {c.categoryName || 'Uncategorized'}
                      </span>
                    </td>
                    <td>
                      {(c.pricingType === 'subscription' || c.pricingType === 'paid') && Number(c.price) > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{
                            fontSize: '0.84rem',
                            fontWeight: 800,
                            color: '#4f46e5',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <i className="fa-solid fa-gem" style={{ fontSize: '0.7rem' }}></i>
                            {c.currency === 'USD' ? '$' : '₹'}{Number(c.price).toLocaleString()}
                            {c.pricingType === 'subscription' && (
                              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                                /{c.subscriptionPeriod === 'yearly' ? 'yr' : 'mo'}
                              </span>
                            )}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                            {c.pricingType}
                          </span>
                        </div>
                      ) : (
                        <span style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: '#059669',
                          background: '#ecfdf5',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid #a7f3d0'
                        }}>
                          <i className="fa-solid fa-gift" style={{ fontSize: '0.7rem' }}></i>
                          Free
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-muted)'
                      }}>
                        v{c.version || 1}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span className={`status-badge ${c.status}`}>
                          {c.status}
                        </span>
                        {(c.pendingApproval || c.pending_approval) && (
                          <span style={{
                            background: 'rgba(90, 112, 211, 0.15)',
                            color: '#111111',
                            border: '1px solid rgba(90, 112, 211, 0.35)',
                            padding: '2px 7px',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                          }}>
                            <i className="fa-solid fa-clock"></i> Edits Pending Approval
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <Link
                          to={`/admin/courses/${c.id}/preview`}
                          className="btn btn-secondary btn-sm"
                          title="Preview student view"
                          aria-label="Preview student view"
                        >
                          <i className="fa-solid fa-eye"></i>
                        </Link>
                        {!isReadOnly && (
                          <>
                            <Link
                              to={`/admin/courses/${c.id}/edit`}
                              className="btn btn-secondary btn-sm"
                              title="Edit course & curriculum"
                              aria-label="Edit course & curriculum"
                            >
                              <i className="fa-solid fa-pen-to-square"></i>
                            </Link>
                            <Link
                              to={`/admin/reviews?courseId=${c.id}`}
                              className="btn btn-secondary btn-sm"
                              title="View student ratings & comments"
                              aria-label="View student ratings & comments"
                              style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                            >
                              <i className="fa-solid fa-star"></i>
                            </Link>
                            {!(user?.role === 'content_creator' || user?.role === 'creator') && (
                              <Link
                                to={`/admin/batches?courseId=${c.id}`}
                                className="btn btn-secondary btn-sm"
                                title="Manage batches and capacity"
                                aria-label="Manage batches and capacity"
                              >
                                <i className="fa-solid fa-users-rectangle"></i>
                              </Link>
                            )}

                            {/* Publish & Unpublish actions restricted to Super Admin only */}
                            {(() => {
                              const canPublish = user?.role === 'super_admin' || user?.role === 'superadmin' || user?.role === 'admin';
                              const hasPendingEdits = c.pendingApproval || c.pending_approval || c.status === 'draft';

                              if (!canPublish && hasPendingEdits) {
                                return (
                                  <span
                                    style={{
                                      background: 'rgba(234, 179, 8, 0.15)',
                                      color: '#ca8a04',
                                      border: '1px solid rgba(234, 179, 8, 0.3)',
                                      padding: '4px 9px',
                                      borderRadius: '12px',
                                      fontSize: '0.74rem',
                                      fontWeight: 700,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title="Edits require Super Admin approval to update live on student pages"
                                  >
                                    <i className="fa-solid fa-clock"></i> Pending Super Admin Approval
                                  </span>
                                );
                              }

                              if (canPublish && hasPendingEdits) {
                                return (
                                  <button
                                    onClick={() => openReviewModal(c)}
                                    disabled={actionLoading === c.id}
                                    className="btn btn-sm"
                                    style={{ background: '#5A70D3', color: '#fff', fontWeight: 700, borderRadius: '8px', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                    title="Verify submitted changes and approve course live"
                                    aria-label="Verify submitted changes and approve course live"
                                  >
                                    <i className="fa-solid fa-clipboard-check"></i>
                                    <span>Verify & Approve Edits</span>
                                  </button>
                                );
                              }

                              if (canPublish && c.status === 'published') {
                                return (
                                  <button
                                    onClick={async () => {
                                      const ok = await confirm({
                                        title: 'Unpublish Course?',
                                        description: `Are you sure you want to revert "${c.name}" back to draft?\n\nIt will be hidden from the public course catalog until republished.`,
                                        confirmText: 'Unpublish Course',
                                        cancelText: 'Cancel',
                                        variant: 'warning'
                                      });
                                      if (ok) handleAction(unpublishCourse, c.id, 'unpublished');
                                    }}
                                    disabled={actionLoading === c.id}
                                    className="btn btn-secondary btn-sm"
                                    title="Revert course to draft"
                                    aria-label="Revert course to draft"
                                  >
                                    <i className="fa-solid fa-eye-slash"></i>
                                  </button>
                                );
                              }

                              return null;
                            })()}

                            {/* Archive button hidden for Content Creators */}
                            {!(user?.role === 'content_creator' || user?.role === 'creator') && (
                              c.status === 'archived' ? (
                                <button
                                  onClick={() => handleAction(unarchiveCourse, c.id, 'unarchived')}
                                  disabled={actionLoading === c.id}
                                  className="btn btn-secondary btn-sm"
                                  title="Unarchive course (restore to draft)"
                                  aria-label="Unarchive course (restore to draft)"
                                  style={{ color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
                                >
                                  <i className="fa-solid fa-arrow-rotate-left"></i>
                                </button>
                              ) : (
                                <button
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: 'Archive Course?',
                                      description: `Are you sure you want to archive "${c.name}"?\n\nIt will no longer accept new student enrollments, but existing enrolled students will retain their learning access.`,
                                      confirmText: 'Archive Course',
                                      cancelText: 'Cancel',
                                      variant: 'archive'
                                    });
                                    if (ok) handleAction(archiveCourse, c.id, 'archived');
                                  }}
                                  disabled={actionLoading === c.id}
                                  className="btn btn-secondary btn-sm"
                                  title="Archive course"
                                  aria-label="Archive course"
                                >
                                  <i className="fa-solid fa-box-archive"></i>
                                </button>
                              )
                            )}

                            <button
                              onClick={() => handleAction(duplicateCourse, c.id, 'duplicated')}
                              disabled={actionLoading === c.id}
                              className="btn btn-secondary btn-sm"
                              title="Duplicate into a new draft"
                              aria-label="Duplicate into a new draft"
                            >
                              <i className="fa-solid fa-copy"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Super Admin Course Edit Verification & Approval Modal */}
      {reviewCourse && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 1200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          animation: 'udFadeIn 0.2s ease'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '940px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1px solid #E8E8E8',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #E8E8E8',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F7F7F7',
              borderRadius: '20px 20px 0 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#E8EBFA', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  <i className="fa-solid fa-code-compare"></i>
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#18131F', margin: 0 }}>
                    Verify Content Creator Edits
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#5F5868' }}>
                    Compare Old Live Version (Red) vs New Proposed Modifications (Green) before publishing live.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewCourse(null)}
                style={{ border: 'none', background: 'transparent', fontSize: '1.2rem', color: '#8E8797', cursor: 'pointer', padding: '6px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body */}
            {(() => {
              let proposed = null;
              if (reviewCourse.pendingEdits || reviewCourse.pending_edits) {
                try {
                  proposed = JSON.parse(reviewCourse.pendingEdits || reviewCourse.pending_edits);
                } catch (e) {}
              }

              return (
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Approval Notice Banner */}
                  <div style={{ background: 'rgba(90, 112, 211, 0.12)', border: '1px solid rgba(90, 112, 211, 0.3)', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', color: '#18131F', fontSize: '0.86rem' }}>
                    <i className="fa-solid fa-shield-halved" style={{ fontSize: '1.3rem', color: '#5A70D3' }}></i>
                    <span>
                      <strong>Super Admin Verification Required:</strong> {proposed ? 'Review side-by-side proposed changes below.' : 'Review submitted course details below.'} Clicking <strong>Approve & Publish Live</strong> will apply all changes live to student pages.
                    </span>
                  </div>

                  {/* SINGLE CONTAINER PROPOSED MODIFICATIONS VIEW */}
                  <div style={{ background: '#F7F7F7', border: '1.5px solid #E8E8E8', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E8E8E8', paddingBottom: '12px' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#18131F', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-file-pen" style={{ color: '#5A70D3' }}></i> Course Details & Proposed Edits
                      </div>
                      {proposed && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, background: '#16a34a', color: '#ffffff', padding: '3px 10px', borderRadius: '9999px' }}>
                          PROPOSED EDITS
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#8E8797', display: 'block', marginBottom: '4px' }}>Course Title</label>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: (proposed?.name && proposed.name !== reviewCourse.name) ? '#16a34a' : '#18131F' }}>
                        {(proposed?.name || reviewCourse.name)}
                        {(proposed?.name && proposed.name !== reviewCourse.name) && (
                          <span style={{ fontSize: '0.68rem', background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: '4px', marginLeft: '8px', fontWeight: 800 }}>MODIFIED</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#8E8797', display: 'block', marginBottom: '2px' }}>Category</label>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#18131F' }}>{(proposed?.categoryName || reviewCourse.categoryName || 'General')}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#8E8797', display: 'block', marginBottom: '2px' }}>Level & Duration</label>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#5F5868' }}>{(proposed?.level || reviewCourse.level || 'Beginner')} • {(proposed?.duration || reviewCourse.duration || 'Self-Paced')}</div>
                      </div>
                    </div>

                    {((proposed?.shortDesc || reviewCourse.shortDesc)) && (
                      <div>
                        <label style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#8E8797', display: 'block', marginBottom: '4px' }}>Short Description</label>
                        <div style={{ fontSize: '0.88rem', color: (proposed?.shortDesc && proposed.shortDesc !== reviewCourse.shortDesc) ? '#16a34a' : '#5F5868', lineHeight: 1.5, fontWeight: (proposed?.shortDesc && proposed.shortDesc !== reviewCourse.shortDesc) ? 700 : 400 }}>
                          {(proposed?.shortDesc || reviewCourse.shortDesc)}
                        </div>
                      </div>
                    )}

                    {((proposed?.learningOutcomes || reviewCourse.learningOutcomes)) && (
                      <div>
                        <label style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#8E8797', display: 'block', marginBottom: '6px' }}>What You'll Learn</label>
                        <div style={{ fontSize: '0.85rem', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {((proposed?.learningOutcomes || reviewCourse.learningOutcomes) || '').split('\n').map((item, idx) => {
                            const oldOutcomes = (reviewCourse.learningOutcomes || '').split('\n').map(s => s.trim()).filter(Boolean);
                            const hasProposedOutcomes = Boolean(proposed && proposed.learningOutcomes !== undefined && proposed.learningOutcomes !== reviewCourse.learningOutcomes);
                            const isNew = hasProposedOutcomes && (idx >= oldOutcomes.length || !oldOutcomes.includes(item.trim()));
                            return item.trim() ? (
                              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: isNew ? '#16a34a' : '#18131F', fontWeight: isNew ? 700 : 400 }}>
                                <i className="fa-solid fa-check" style={{ color: isNew ? '#16a34a' : '#5A70D3', marginTop: '3px', fontSize: '0.8rem' }}></i>
                                <span>{item.trim()}</span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {((proposed?.prerequisites || reviewCourse.prerequisites)) && (
                      <div>
                        <label style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#8E8797', display: 'block', marginBottom: '6px' }}>Requirements</label>
                        <div style={{ fontSize: '0.85rem', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {((proposed?.prerequisites || reviewCourse.prerequisites) || '').split('\n').map((item, idx) => {
                            const oldPrereqs = (reviewCourse.prerequisites || '').split('\n').map(s => s.trim()).filter(Boolean);
                            const hasProposedPrereqs = Boolean(proposed && proposed.prerequisites !== undefined && proposed.prerequisites !== reviewCourse.prerequisites);
                            const isNew = hasProposedPrereqs && (idx >= oldPrereqs.length || !oldPrereqs.includes(item.trim()));
                            return item.trim() ? (
                              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: isNew ? '#16a34a' : '#18131F', fontWeight: isNew ? 700 : 400 }}>
                                <i className="fa-solid fa-circle-dot" style={{ color: isNew ? '#16a34a' : '#8E8797', marginTop: '4px', fontSize: '0.6rem' }}></i>
                                <span>{item.trim()}</span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {((proposed?.description || reviewCourse.description)) && (() => {
                      const oldDescLines = (reviewCourse.description || '').split('\n');
                      const proposedDescLines = ((proposed?.description || reviewCourse.description) || '').split('\n');

                      return (
                        <div>
                          <label style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: '#8E8797', display: 'block', marginBottom: '4px' }}>Full Description</label>
                          <div style={{ fontSize: '0.86rem', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {proposedDescLines.map((line, idx) => {
                              const hasProposedDesc = Boolean(proposed && proposed.description !== undefined && proposed.description !== reviewCourse.description);
                              const isLineNew = hasProposedDesc && (idx >= oldDescLines.length || oldDescLines[idx]?.trim() !== line.trim());
                              return (
                                <div key={idx} style={{ color: isLineNew ? '#16a34a' : '#5F5868', fontWeight: isLineNew ? 700 : 400 }}>
                                  <span>{line}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Curriculum Sections & Lessons Verification */}
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: '#8E8797', display: 'block', marginBottom: '8px' }}>
                      Curriculum Structure ({reviewSections.length} Sections)
                    </label>

                    {loadingReviewSections ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#8E8797' }}>
                        <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#5A70D3', marginRight: '8px' }}></i>
                        Loading curriculum sections and lessons...
                      </div>
                    ) : reviewSections.length === 0 ? (
                      <div style={{ padding: '16px', background: '#F7F7F7', borderRadius: '10px', border: '1px dashed #E8E8E8', color: '#8E8797', fontSize: '0.88rem', textAlign: 'center' }}>
                        No sections added to this course yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                        {reviewSections.map((sec, idx) => {
                          const lessons = reviewContentsMap[sec.id] || [];

                          // Check if section is newly added proposal (pending approval or draft)
                          const secStatusLower = (sec.status || '').toLowerCase();
                          const isNewSec = Boolean(
                            secStatusLower === 'pending_approval' ||
                            secStatusLower === 'pending' ||
                            secStatusLower === 'draft' ||
                            sec.isNew ||
                            sec.isDraft ||
                            (proposed?.addedSectionIds && proposed.addedSectionIds.includes(sec.id))
                          );

                          return (
                            <div key={sec.id || idx} style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              padding: '12px 16px',
                              background: isNewSec ? '#f0fdf4' : '#ffffff',
                              borderRadius: '10px',
                              border: isNewSec ? '1.5px solid #86efac' : '1px solid #E8E8E8'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: isNewSec ? '#16a34a' : '#18131F', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ color: isNewSec ? '#15803d' : '#5A70D3' }}>Section {idx + 1}:</span>
                                  <span>{sec.title}</span>
                                  {isNewSec && (
                                    <span style={{ fontSize: '0.68rem', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 7px', borderRadius: '4px', fontWeight: 800 }}>NEW SECTION</span>
                                  )}
                                </div>
                                <span style={{ fontSize: '0.76rem', fontWeight: 700, background: isNewSec ? '#dcfce7' : '#E8EBFA', color: isNewSec ? '#15803d' : '#111111', padding: '3px 10px', borderRadius: '9999px', border: isNewSec ? '1px solid #86efac' : '1px solid #E8EBFA' }}>
                                  {lessons.length || sec.contentCount || 0} Lessons
                                </span>
                              </div>
                              {lessons.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px', paddingLeft: '14px', borderLeft: isNewSec ? '2px solid #86efac' : '2px solid #E8E8E8' }}>
                                  {lessons.map((lec, lIdx) => {
                                    const lecStatusLower = (lec.status || '').toLowerCase();
                                    const isNewLec = Boolean(
                                      isNewSec ||
                                      lecStatusLower === 'pending_approval' ||
                                      lecStatusLower === 'pending' ||
                                      lecStatusLower === 'draft' ||
                                      lec.isNew ||
                                      lec.isDraft
                                    );
                                    return (
                                      <div key={lec.id || lIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: isNewLec ? '#16a34a' : '#5F5868', fontWeight: isNewLec ? 700 : 600 }}>
                                        <i className={lec.contentType === 'VIDEO' ? 'fa-solid fa-circle-play' : lec.contentType === 'PDF' ? 'fa-solid fa-file-pdf' : 'fa-solid fa-paperclip'} style={{ color: isNewLec ? '#16a34a' : '#8E8797', fontSize: '0.82rem' }}></i>
                                        <span>Lesson {lIdx + 1}: {lec.title}</span>
                                        {isNewLec && !isNewSec && (
                                          <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>NEW</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #E8E8E8',
              background: '#F7F7F7',
              borderRadius: '0 0 20px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <Link
                to={`/admin/courses/${reviewCourse.id}/preview`}
                style={{ fontSize: '0.86rem', fontWeight: 700, color: '#4B61C4', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-eye"></i>
                <span>Open Full Preview</span>
              </Link>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setReviewCourse(null)}
                  style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', color: '#5F5868', padding: '9px 16px', borderRadius: '10px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    handleAction(rejectCourseEdits, reviewCourse.id, 'rejected proposed edits');
                    setReviewCourse(null);
                  }}
                  disabled={actionLoading === reviewCourse.id}
                  style={{ background: '#ffffff', color: '#ef4444', border: '1px solid #fca5a5', padding: '9px 18px', borderRadius: '10px', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-circle-xmark"></i>
                  <span>Reject Edits</span>
                </button>

                <button
                  onClick={() => {
                    handleAction(approveCourseEdits, reviewCourse.id, 'approved & published live');
                    setReviewCourse(null);
                  }}
                  disabled={actionLoading === reviewCourse.id}
                  style={{ background: '#5A70D3', color: '#FFFFFF', border: 'none', padding: '10px 22px', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(90, 112, 211, 0.3)' }}
                >
                  <i className="fa-solid fa-circle-check"></i>
                  <span>Approve & Publish Live to Students</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
