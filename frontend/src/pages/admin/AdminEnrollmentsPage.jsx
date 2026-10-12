import { useState, useEffect, useMemo } from 'react';
import {
  getAdminEnrollments,
  getEnrollmentStats,
  getCategories,
  assignEnrollmentBatch,
  removeStudentEnrollment,
  rejoinStudentEnrollment
} from '../../api/admin';
import { getCourseBatches } from '../../api/batches';

export default function AdminEnrollmentsPage() {
  const [enrollments, setEnrollments] = useState([]);
  const [stats, setStats] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // shared filter state
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'REMOVED' | 'STATS'
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal / action state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [batchError, setBatchError] = useState('');

  const [confirmRemoveModal, setConfirmRemoveModal] = useState(null);
  const [submittingRemove, setSubmittingRemove] = useState(false);

  const [confirmRejoinModal, setConfirmRejoinModal] = useState(null);
  const [rejoinBatchId, setRejoinBatchId] = useState('');
  const [submittingRejoin, setSubmittingRejoin] = useState(false);

  const [toastMsg, setToastMsg] = useState('');

  function showToast(msg) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  }

  // Load categories once
  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  // Reload data when filters change
  useEffect(() => {
    if (activeTab === 'STATS') {
      loadStats();
    } else {
      loadEnrollments();
    }
  }, [search, categoryId, activeTab, page]);

  async function loadEnrollments() {
    setLoading(true);
    try {
      const status = activeTab === 'ALL' ? '' : activeTab;
      const res = await getAdminEnrollments({
        search,
        status,
        categoryId: categoryId || null,
        page,
        size: 15,
      });
      setEnrollments(res?.content || []);
      setTotalPages(res?.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    setLoading(true);
    try {
      const data = await getEnrollmentStats();
      setStats(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Client-side filter for stats tab (category + search)
  const filteredStats = useMemo(() => {
    const selectedCat = categories.find((c) => String(c.id) === String(categoryId));
    return stats.filter((s) => {
      const matchCat = !categoryId || s.categoryName === selectedCat?.name;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        s.courseName.toLowerCase().includes(q) ||
        s.categoryName.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [stats, categoryId, search, categories]);

  const tabs = [
    { key: 'ALL',     label: 'All Registrations' },
    { key: 'ACTIVE',  label: 'Active' },
    { key: 'REMOVED', label: 'Removed' },
    { key: 'STATS',   label: 'Total Enrollments' },
  ];

  function handleTabChange(key) {
    setActiveTab(key);
    setPage(0);
  }

  async function handleOpenBatchModal(e) {
    setSelectedEnrollment(e);
    setSelectedBatchId(e.batchId ? String(e.batchId) : '');
    setBatchModalOpen(true);
    setLoadingBatches(true);
    setBatchError('');
    try {
      const list = await getCourseBatches(e.courseId);
      setAvailableBatches(list || []);
    } catch (err) {
      console.error('Failed to load course batches', err);
      setBatchError('Failed to load batches for this course');
    } finally {
      setLoadingBatches(false);
    }
  }

  async function handleSaveBatch() {
    if (!selectedEnrollment) return;
    setSubmittingBatch(true);
    setBatchError('');
    try {
      const bId = selectedBatchId ? Number(selectedBatchId) : null;
      await assignEnrollmentBatch(selectedEnrollment.id, bId);
      setBatchModalOpen(false);
      showToast('Batch allocated successfully!');
      loadEnrollments();
    } catch (err) {
      console.error(err);
      setBatchError(err?.response?.data?.message || 'Failed to update batch assignment');
    } finally {
      setSubmittingBatch(false);
    }
  }

  function handleOpenRemoveModal(e) {
    setConfirmRemoveModal(e);
  }

  async function handleConfirmRemove() {
    if (!confirmRemoveModal) return;
    setSubmittingRemove(true);
    try {
      await removeStudentEnrollment(confirmRemoveModal.id);
      setConfirmRemoveModal(null);
      showToast('Student removed from course');
      loadEnrollments();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to remove student from course');
    } finally {
      setSubmittingRemove(false);
    }
  }

  async function handleOpenRejoinModal(e) {
    setConfirmRejoinModal(e);
    setRejoinBatchId(e.batchId ? String(e.batchId) : '');
    setLoadingBatches(true);
    try {
      const list = await getCourseBatches(e.courseId);
      setAvailableBatches(list || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBatches(false);
    }
  }

  async function handleConfirmRejoin() {
    if (!confirmRejoinModal) return;
    setSubmittingRejoin(true);
    try {
      const bId = rejoinBatchId ? Number(rejoinBatchId) : null;
      await rejoinStudentEnrollment(confirmRejoinModal.id, bId);
      setConfirmRejoinModal(null);
      showToast('Student re-enrolled / reallocated successfully');
      loadEnrollments();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Failed to rejoin student');
    } finally {
      setSubmittingRejoin(false);
    }
  }

  return (
    <div className="page">
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: '#10b981',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.9rem',
          fontWeight: 600
        }}>
          <i className="fa-solid fa-circle-check"></i>
          {toastMsg}
        </div>
      )}

      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Platform Enrollments</h1>
          <p className="page-subtitle">
            Complete registration history across all organization courses.
          </p>
        </div>
      </div>

      <div className="table-card">
        {/* ── Single-row toolbar ──────────────────────────────────────── */}
        <div className="table-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
          {/* Tab pills — left side */}
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`btn btn-sm ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ whiteSpace: 'nowrap' }}
            >
              {t.label}
            </button>
          ))}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Category dropdown — always visible */}
          <select
            className="form-control"
            style={{ minWidth: '160px', maxWidth: '200px', fontSize: '0.875rem' }}
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(0); }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Search box — always visible */}
          <div className="table-search" style={{ minWidth: '200px' }}>
            <input
              type="search"
              className="form-control"
              placeholder={activeTab === 'STATS' ? 'Search course or category…' : 'Search student or course…'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
        </div>

        {/* ── Total Enrollments (Stats) table ─────────────────────────── */}
        {activeTab === 'STATS' ? (
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Course</th>
                  <th>Total Enrollments</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="3" className="table-empty">Loading enrollment stats…</td>
                  </tr>
                ) : filteredStats.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="table-empty">No enrollment data found.</td>
                  </tr>
                ) : (
                  filteredStats.map((s) => (
                    <tr key={s.courseId}>
                      <td>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          {s.categoryName}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{s.courseName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Course ID: #{s.courseId}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                          {s.totalEnrollments.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── All / Active / Removed list table ───────────────────────── */
          <>
            <div className="table-responsive">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Enrolled Course</th>
                    <th>Batch</th>
                    <th>Plan / Fee</th>
                    <th>Enrolled At</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="table-empty">Loading enrollment records…</td>
                    </tr>
                  ) : enrollments.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="table-empty">No enrollment records found.</td>
                    </tr>
                  ) : (
                    enrollments.map((e) => {
                      const initials = e.studentName
                        ? e.studentName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                        : 'S';
                      const isRemoved = e.status === 'removed';
                      const batchDisplayName = e.batchName || e.batch_name || (typeof e.batch === 'object' ? e.batch?.name : null);
                      return (
                        <tr key={e.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div className="avatar-circle" style={{ width: '34px', height: '34px', fontSize: '0.82rem' }}>
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{e.studentName}</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{e.studentEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{e.courseName}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Course ID: #{e.courseId}</div>
                          </td>
                          <td>
                            {batchDisplayName ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  background: '#f3f4f6',
                                  color: '#374151',
                                  border: '1px solid #e5e7eb'
                                }}>
                                  <i className="fa-solid fa-users-rectangle" style={{ fontSize: '0.75rem', color: '#6b7280' }}></i>
                                  {batchDisplayName}
                                </span>
                                {!isRemoved && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ padding: '2px 6px', color: '#6b7280' }}
                                    title="Change Batch"
                                    onClick={() => handleOpenBatchModal(e)}
                                  >
                                    <i className="fa-solid fa-pen-to-square" style={{ fontSize: '0.78rem' }}></i>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={isRemoved}
                                style={{
                                  fontSize: '0.78rem',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  background: isRemoved ? '#f3f4f6' : '#eff6ff',
                                  color: isRemoved ? '#9ca3af' : '#2563eb',
                                  border: isRemoved ? '1px solid #e5e7eb' : '1px solid #bfdbfe',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  cursor: isRemoved ? 'not-allowed' : 'pointer'
                                }}
                                onClick={() => !isRemoved && handleOpenBatchModal(e)}
                              >
                                <i className="fa-solid fa-plus"></i> Add to Batch
                              </button>
                            )}
                          </td>
                          <td>
                            {e.pricingType === 'subscription' || (e.amountPaid && Number(e.amountPaid) > 0) ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: '#eef2ff',
                                color: '#4f46e5',
                                border: '1px solid #c7d2fe'
                              }}>
                                <i className="fa-solid fa-gem" style={{ fontSize: '0.72rem' }}></i>
                                Paid • ₹{Number(e.amountPaid || 0).toLocaleString()}
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: '#ecfdf5',
                                color: '#059669',
                                border: '1px solid #a7f3d0'
                              }}>
                                <i className="fa-solid fa-gift" style={{ fontSize: '0.72rem' }}></i>
                                Free
                              </span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                              {new Date(e.enrolledAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${e.status}`}>
                              {e.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isRemoved ? (
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  fontSize: '0.78rem',
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  background: '#f0fdf4',
                                  color: '#16a34a',
                                  border: '1px solid #bbf7d0',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => handleOpenRejoinModal(e)}
                              >
                                <i className="fa-solid fa-rotate-left"></i> Rejoin
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  fontSize: '0.78rem',
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => handleOpenRemoveModal(e)}
                              >
                                <i className="fa-solid fa-user-minus"></i> Remove
                              </button>
                            )}
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
                background: 'var(--bg-card)',
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
          </>
        )}
      </div>

      {/* ── Add / Edit Batch Modal ────────────────────────────────────── */}
      {batchModalOpen && selectedEnrollment && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
          }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {selectedEnrollment.batchName ? 'Change Student Batch' : 'Add Student to Batch'}
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Assign <strong>{selectedEnrollment.studentName}</strong> to a batch for course <em>{selectedEnrollment.courseName}</em>.
            </p>

            {batchError && (
              <div style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '0.85rem',
                marginBottom: '14px'
              }}>
                {batchError}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Select Batch
              </label>
              {loadingBatches ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '10px 0' }}>Loading course batches…</div>
              ) : availableBatches.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: '#dc2626', padding: '10px 0' }}>
                  No active batches found for this course. You can create batches under the Batches menu.
                </div>
              ) : (
                <select
                  className="form-control"
                  style={{ width: '100%', fontSize: '0.9rem', padding: '8px 12px' }}
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                >
                  <option value="">-- No Batch (Unassigned) --</option>
                  {availableBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code || 'NO-CODE'}) - {b.enrolledCount || 0}/{b.capacity} seats ({b.status})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submittingBatch}
                onClick={() => setBatchModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submittingBatch || loadingBatches}
                onClick={handleSaveBatch}
              >
                {submittingBatch ? 'Saving…' : 'Save Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Remove Modal ──────────────────────────────────────── */}
      {confirmRemoveModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0
              }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Remove Student from Course?
                </h3>
              </div>
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to remove <strong>{confirmRemoveModal.studentName}</strong> from <strong>{confirmRemoveModal.courseName}</strong>?
              <br /><br />
              The student's status will be updated to <code>REMOVED</code> and they can be viewed under the <strong>Removed</strong> filter tab.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submittingRemove}
                onClick={() => setConfirmRemoveModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ background: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
                disabled={submittingRemove}
                onClick={handleConfirmRemove}
              >
                {submittingRemove ? 'Removing…' : 'Remove Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Rejoin / Reallocate Modal ──────────────────────────── */}
      {confirmRejoinModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#f0fdf4',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0
              }}>
                <i className="fa-solid fa-rotate-left"></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Rejoin / Reallocate Student
                </h3>
              </div>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Re-enroll <strong>{confirmRejoinModal.studentName}</strong> back into <strong>{confirmRejoinModal.courseName}</strong>.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
                Reallocate Batch (Optional)
              </label>
              {loadingBatches ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading batches…</div>
              ) : availableBatches.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No batches available for this course.</div>
              ) : (
                <select
                  className="form-control"
                  style={{ width: '100%', fontSize: '0.9rem', padding: '8px 12px' }}
                  value={rejoinBatchId}
                  onChange={(e) => setRejoinBatchId(e.target.value)}
                >
                  <option value="">-- Keep Current / No Batch --</option>
                  {availableBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code || 'NO-CODE'}) - {b.enrolledCount || 0}/{b.capacity} seats
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submittingRejoin}
                onClick={() => setConfirmRejoinModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                disabled={submittingRejoin}
                onClick={handleConfirmRejoin}
              >
                {submittingRejoin ? 'Rejoining…' : 'Confirm Rejoin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
