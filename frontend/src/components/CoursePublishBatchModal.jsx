import { useState, useEffect } from 'react';
import { createBatch } from '../api/batches';

/**
 * CoursePublishBatchModal
 *
 * Shown when an admin attempts to publish a course that does not have any active batches.
 * Matches the modal visual pattern from OneTutor confirmation modals:
 * - Step 1 ('notice'): Warns that the course has no batches with 3 actions:
 *   [Cancel] [Publish Without Batch] [Create Batch]
 * - Step 2 ('create'): Form to create a batch pre-configured for this course, with:
 *   [Back] [Create Batch & Publish Course]
 */
export default function CoursePublishBatchModal({
  isOpen,
  course,
  onClose,
  onPublishWithoutBatch,
  onBatchCreatedAndPublished,
  isReadOnly = false,
  toast
}) {
  const [view, setView] = useState('notice'); // 'notice' | 'create'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Batch Form State
  const [batchName, setBatchName] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [batchCapacity, setBatchCapacity] = useState('30');
  const [batchStatus, setBatchStatus] = useState('active');
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchEndDate, setBatchEndDate] = useState('');

  // Reset/prefill when modal opens or course changes
  useEffect(() => {
    if (isOpen && course) {
      setView('notice');
      setError('');
      setSaving(false);
      setBatchName(`${course.name || 'Course'} - Batch 1`);
      setBatchCode(`BATCH-${course.id}-${Math.floor(100 + Math.random() * 900)}`);
      setBatchCapacity('30');
      setBatchStatus('active');
      setBatchStartDate(new Date().toISOString().split('T')[0]);
      setBatchEndDate('');
    }
  }, [isOpen, course]);

  if (!isOpen || !course) return null;

  const handleCreateAndPublish = async (e) => {
    e?.preventDefault();
    if (isReadOnly || saving) return;

    if (!batchName.trim()) {
      setError('Batch name is required.');
      return;
    }

    if (!batchCode.trim()) {
      setError('Batch code is required.');
      return;
    }

    const cap = parseInt(batchCapacity, 10);
    if (isNaN(cap) || cap <= 0) {
      setError('Batch capacity must be at least 1.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // 1. Create the batch
      await createBatch({
        courseId: Number(course.id),
        name: batchName.trim(),
        code: batchCode.trim().toUpperCase(),
        capacity: cap,
        status: batchStatus,
        startDate: batchStartDate || null,
        endDate: batchEndDate || null
      });

      // 2. Trigger course publish callback
      if (onBatchCreatedAndPublished) {
        await onBatchCreatedAndPublished(course, batchName.trim());
      }
    } catch (err) {
      console.error('Failed to create batch & publish course:', err);
      const msg = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to create batch.';
      setError(msg);
      toast?.error?.(msg);
      setSaving(false);
    }
  };

  return (
    <div
      className="ot-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose?.();
        }
      }}
      role="presentation"
      style={{ zIndex: 1300 }}
    >
      {view === 'notice' ? (
        /* STEP 1: NOTICE MODAL (Matches user screenshot) */
        <div
          className="ot-modal-container"
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-batch-modal-title"
          style={{ maxWidth: '480px', width: '100%', padding: '32px 28px 24px' }}
        >
          {/* Top Circular Icon Badge */}
          <div
            className="ot-modal-icon-badge"
            style={{
              backgroundColor: 'rgba(90, 112, 211, 0.12)',
              color: '#5A70D3',
              borderColor: 'rgba(90, 112, 211, 0.25)',
              width: '60px',
              height: '60px',
              marginBottom: '20px'
            }}
          >
            <i className="fa-solid fa-users-rectangle" style={{ fontSize: '1.55rem' }}></i>
          </div>

          {/* Modal Title */}
          <h2
            id="no-batch-modal-title"
            className="ot-modal-title"
            style={{ fontSize: '1.28rem', fontWeight: 800, color: '#111827', marginBottom: '12px' }}
          >
            No Batch Found
          </h2>

          {/* Modal Description */}
          <div
            className="ot-modal-description"
            style={{ fontSize: '0.94rem', color: '#667085', lineHeight: 1.55, marginBottom: '26px' }}
          >
            Are you sure you want to publish &ldquo;{course.name}&rdquo; without any batches?
            <br /><br />
            It will not have any active batches for student enrollments. You can create a batch now or proceed with publishing.
          </div>

          {/* Action Buttons */}
          <div
            className="ot-modal-actions"
            style={{ display: 'flex', gap: '10px', width: '100%', flexWrap: 'wrap' }}
          >
            <button
              type="button"
              className="ot-modal-btn ot-modal-btn-cancel"
              onClick={onClose}
              disabled={saving}
              style={{ flex: '1 1 90px', height: '42px', fontSize: '0.9rem' }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="ot-modal-btn"
              onClick={onPublishWithoutBatch}
              disabled={saving}
              style={{
                flex: '1 1 140px',
                height: '42px',
                fontSize: '0.88rem',
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                color: '#475569',
                fontWeight: 600
              }}
            >
              Publish Without Batch
            </button>

            <button
              type="button"
              className="ot-modal-btn ot-btn-archive"
              onClick={() => setView('create')}
              disabled={saving}
              style={{
                flex: '1 1 125px',
                height: '42px',
                fontSize: '0.9rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #18131F 0%, #4338ca 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(67, 56, 202, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-plus" style={{ fontSize: '0.8rem' }}></i>
              <span>Create Batch</span>
            </button>
          </div>
        </div>
      ) : (
        /* STEP 2: CREATE BATCH & PUBLISH FORM */
        <div
          className="ot-modal-container"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-batch-modal-title"
          style={{ maxWidth: '540px', width: '100%', padding: '28px 28px 24px', textAlign: 'left', alignItems: 'stretch' }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--border-default)', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(90, 112, 211, 0.12)',
                  color: '#5A70D3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.15rem'
                }}
              >
                <i className="fa-solid fa-layer-group"></i>
              </div>
              <div>
                <h3 id="create-batch-modal-title" style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Create Batch &amp; Publish
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Set up initial batch capacity before publishing course live.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleCreateAndPublish} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#b91c1c',
                  fontSize: '0.86rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}

            {/* Course Information (Readonly badge) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '2px' }}>
                Course Target
              </label>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{course.name}</span>
                <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                  WILL PUBLISH LIVE
                </span>
              </div>
            </div>

            {/* Batch Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                Batch Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Full Stack - Morning Batch 1"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                disabled={saving}
                required
                style={{ width: '100%', borderRadius: '8px', padding: '8px 12px', fontSize: '0.88rem' }}
              />
            </div>

            {/* Batch Code */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                Batch Code <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. BATCH-1-001"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value.toUpperCase())}
                disabled={saving}
                required
                style={{ width: '100%', borderRadius: '8px', padding: '8px 12px', fontSize: '0.88rem', letterSpacing: '0.04em' }}
              />
            </div>

            {/* Capacity & Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Capacity (Seats) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  className="form-control"
                  placeholder="30"
                  value={batchCapacity}
                  onChange={(e) => setBatchCapacity(e.target.value)}
                  disabled={saving}
                  required
                  style={{ width: '100%', borderRadius: '8px', padding: '8px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Initial Status
                </label>
                <select
                  className="form-control"
                  value={batchStatus}
                  onChange={(e) => setBatchStatus(e.target.value)}
                  disabled={saving}
                  style={{ width: '100%', borderRadius: '8px', padding: '8px 12px', fontSize: '0.88rem' }}
                >
                  <option value="active">Active (Open for enrollment)</option>
                  <option value="upcoming">Upcoming</option>
                </select>
              </div>
            </div>

            {/* Start Date & End Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={batchStartDate}
                  onChange={(e) => setBatchStartDate(e.target.value)}
                  disabled={saving}
                  style={{ width: '100%', borderRadius: '8px', padding: '8px 12px', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                  End Date <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={batchEndDate}
                  onChange={(e) => setBatchEndDate(e.target.value)}
                  disabled={saving}
                  style={{ width: '100%', borderRadius: '8px', padding: '8px 12px', fontSize: '0.88rem' }}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-default)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setView('notice')}
                disabled={saving}
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.88rem' }}
              >
                Back
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || isReadOnly}
                style={{
                  background: 'linear-gradient(135deg, #5A70D3 0%, #4355B9 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  padding: '9px 20px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(90, 112, 211, 0.35)'
                }}
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Creating &amp; Publishing...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-rocket"></i>
                    <span>Create Batch &amp; Publish Course</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
