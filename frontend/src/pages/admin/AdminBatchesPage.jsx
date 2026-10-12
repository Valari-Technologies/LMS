import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAdminBatches, createBatch, updateBatch, updateBatchStatus } from '../../api/batches';
import { listAdminCourses } from '../../api/courses';
import { toast, confirmDialog } from '../../context/NotificationContext';
import { usePermission } from '../../hooks/usePermission';

export default function AdminBatchesPage() {
  const { isReadOnly } = usePermission();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = searchParams.get('courseId') || '';

  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editModalBatch, setEditModalBatch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form states
  const [formCourseId, setFormCourseId] = useState('');
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCapacity, setFormCapacity] = useState('30');
  const [formStatus, setFormStatus] = useState('active');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');

  useEffect(() => {
    listAdminCourses({ size: 100 })
      .then(res => setCourses(res?.content || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBatches();
  }, [selectedCourseId, statusFilter, page]);

  async function loadBatches() {
    setLoading(true);
    try {
      const data = await getAdminBatches({
        courseId: selectedCourseId || undefined,
        status: statusFilter,
        search: search || undefined,
        page,
        size: 15,
      });
      setBatches(data?.content || []);
      setTotalElements(data?.totalElements || 0);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(0);
    loadBatches();
  }

  function handleCourseChange(cId) {
    setSelectedCourseId(cId);
    setPage(0);
    if (cId) {
      setSearchParams({ courseId: cId });
    } else {
      setSearchParams({});
    }
  }

  function openCreateModal() {
    setFormError('');
    setFormCourseId(selectedCourseId || (courses[0]?.id ? String(courses[0].id) : ''));
    setFormName('');
    setFormCode('BATCH-' + Math.floor(100 + Math.random() * 900));
    setFormCapacity('30');
    setFormStatus('active');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate('');
    setShowCreateModal(true);
  }

  function openEditModal(b) {
    setFormError('');
    setEditModalBatch(b);
    setFormName(b.name);
    setFormCode(b.code);
    setFormCapacity(String(b.capacity));
    setFormStatus(b.status || 'active');
    setFormStartDate(b.startDate || '');
    setFormEndDate(b.endDate || '');
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    if (isReadOnly) return;
    if (!formCourseId) {
      setFormError('Please select a course');
      return;
    }
    if (!formName.trim()) {
      setFormError('Batch name is required');
      return;
    }
    const cap = parseInt(formCapacity, 10);
    if (isNaN(cap) || cap <= 0) {
      setFormError('Capacity must be at least 1');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await createBatch({
        courseId: Number(formCourseId),
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        capacity: cap,
        status: formStatus,
        startDate: formStartDate || null,
        endDate: formEndDate || null,
      });
      toast.success('Batch created successfully!');
      setShowCreateModal(false);
      loadBatches();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to create batch');
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    if (isReadOnly) return;
    const cap = parseInt(formCapacity, 10);
    if (isNaN(cap) || cap <= 0) {
      setFormError('Capacity must be at least 1');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await updateBatch(editModalBatch.id, {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        capacity: cap,
        status: formStatus,
        startDate: formStartDate || null,
        endDate: formEndDate || null,
      });
      toast.success('Batch updated successfully!');
      setEditModalBatch(null);
      loadBatches();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update batch');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(b, newStatus) {
    if (isReadOnly) return;
    const confirmed = await confirmDialog({
      title: `Change Batch Status to ${newStatus}?`,
      description: `Are you sure you want to mark "${b.name}" as ${newStatus}?`,
      confirmText: 'Update Status',
      variant: 'primary',
    });
    if (!confirmed) return;

    try {
      await updateBatchStatus(b.id, newStatus);
      toast.success(`Batch status updated to ${newStatus}`);
      loadBatches();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Batch Management</h1>
          <p className="page-subtitle">
            Configure student batches, control capacity limits, and monitor enrollment seat counts.
          </p>
        </div>
        {!isReadOnly && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            <i className="fa-solid fa-plus" style={{ marginRight: '8px' }}></i> Create Batch
          </button>
        )}
      </div>

      <div className="table-card">
        {/* Toolbar */}
        <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: '12px' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['ALL', 'ACTIVE', 'UPCOMING', 'FULL', 'COMPLETED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => { setStatusFilter(st); setPage(0); }}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              >
                {st === 'ALL' ? 'All Batches' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Course selector & Search */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-control"
              style={{ width: '220px', padding: '6px 12px', fontSize: '0.85rem' }}
              value={selectedCourseId}
              onChange={(e) => handleCourseChange(e.target.value)}
            >
              <option value="">All Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px' }}>
              <input
                type="search"
                className="form-control"
                style={{ width: '180px', padding: '6px 12px', fontSize: '0.85rem' }}
                placeholder="Search batch…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary btn-sm" title="Search">
                <i className="fa-solid fa-magnifying-glass"></i>
              </button>
            </form>
          </div>
        </div>

        {/* Batches Table */}
        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Course</th>
                <th>Capacity</th>
                <th>Seats Available</th>
                <th>Dates</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="table-empty">Loading batches…</td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty">
                    No batches found. Click "Create Batch" to set up your first student batch.
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const pct = Math.min(100, Math.round((b.enrolledCount / b.capacity) * 100));
                  const isFull = b.isFull || b.enrolledCount >= b.capacity;

                  return (
                    <tr key={b.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          <Link to={`/admin/batches/${b.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            {b.name}
                          </Link>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {b.code}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {b.courseName}
                        </span>
                      </td>
                      <td>
                        <div style={{ width: '120px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700 }}>{b.enrolledCount} / {b.capacity}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                          </div>
                          <div style={{ height: '6px', width: '100%', background: 'var(--border-default)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                background: isFull ? '#ef4444' : pct > 80 ? '#f59e0b' : '#10b981',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        {isFull ? (
                          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <i className="fa-solid fa-lock"></i> Full (0 seats)
                          </span>
                        ) : (
                          <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <i className="fa-solid fa-check"></i> {b.availableSeats} available
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {b.startDate ? new Date(b.startDate).toLocaleDateString() : 'Immediate'}
                          {b.endDate ? ` → ${new Date(b.endDate).toLocaleDateString()}` : ''}
                        </div>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          style={{
                            width: 'auto',
                            display: 'inline-block',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            padding: '4px 28px 4px 10px',
                            borderRadius: '6px',
                            color: b.status === 'active' ? '#166534' : b.status === 'full' ? '#991b1b' : b.status === 'completed' ? '#1e40af' : '#475569',
                            backgroundColor: b.status === 'active' ? '#dcfce7' : b.status === 'full' ? '#fee2e2' : b.status === 'completed' ? '#dbeafe' : '#f1f5f9',
                            borderColor: b.status === 'active' ? '#86efac' : b.status === 'full' ? '#fca5a5' : b.status === 'completed' ? '#93c5fd' : '#cbd5e1',
                            cursor: isReadOnly ? 'not-allowed' : 'pointer'
                          }}
                          value={b.status || 'active'}
                          disabled={isReadOnly}
                          onChange={(e) => handleStatusChange(b, e.target.value)}
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="active">Active</option>
                          <option value="full">Full</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Link
                            to={`/admin/batches/${b.id}`}
                            className="btn btn-secondary btn-sm"
                            title="View enrolled students"
                          >
                            <i className="fa-solid fa-users" style={{ marginRight: '4px' }}></i> Students
                          </Link>
                          {!isReadOnly && (
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => openEditModal(b)}
                              title="Edit batch and capacity"
                            >
                              <i className="fa-solid fa-pen-to-square" style={{ marginRight: '4px' }}></i> Edit
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
        {totalElements > 15 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid var(--border-default)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Showing {batches.length} of {totalElements} batches
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={(page + 1) * 15 >= totalElements}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE BATCH MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog" style={{ maxWidth: '540px', pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Batch</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.86rem', fontWeight: 600 }}>
                    {formError}
                  </div>
                )}

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Course *</label>
                  <select
                    className="form-control"
                    value={formCourseId}
                    onChange={(e) => setFormCourseId(e.target.value)}
                    required
                  >
                    <option value="">Select Course</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Batch Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Batch A (Spring)"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Batch Code *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. BATCH-A"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Max Student Capacity *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={formCapacity}
                      onChange={(e) => setFormCapacity(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Initial Status</label>
                    <select
                      className="form-control"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="active">Active</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BATCH MODAL */}
      {editModalBatch && (
        <div className="modal-backdrop" onClick={() => setEditModalBatch(null)}>
          <div className="modal-dialog" style={{ maxWidth: '540px', pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Batch & Capacity</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditModalBatch(null)}>✕</button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.86rem', fontWeight: 600 }}>
                    {formError}
                  </div>
                )}

                <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Course:</div>
                  <div style={{ fontWeight: 700 }}>{editModalBatch.courseName}</div>
                  <div style={{ fontSize: '0.82rem', marginTop: '4px', color: 'var(--text-secondary)' }}>
                    Active enrolled students: <strong>{editModalBatch.enrolledCount}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Batch Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Batch Code *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Capacity * <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(min {editModalBatch.enrolledCount})</span>
                    </label>
                    <input
                      type="number"
                      min={editModalBatch.enrolledCount || 1}
                      className="form-control"
                      value={formCapacity}
                      onChange={(e) => setFormCapacity(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Status</label>
                    <select
                      className="form-control"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600 }}>End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalBatch(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
