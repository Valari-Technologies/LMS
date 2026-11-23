import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getAdminBatch, getBatchStudents, updateBatch, removeBatchStudent, changeBatchStudent, getCourseBatches } from '../../api/batches';
import { getStudentDetail } from '../../api/users';
import { getAdminLiveSessions } from '../../api/live';
import {
  getStoredAttendanceRecords,
  computeStudentAttendance,
  markStudentAttendanceOverride,
  getSessionAttendanceSheet
} from '../../utils/attendanceStorage';
import { toast, confirmDialog } from '../../context/NotificationContext';
import { usePermission } from '../../hooks/usePermission';

export default function AdminBatchDetailsPage() {
  const { isReadOnly } = usePermission();
  const { batchId } = useParams();
  const navigate = useNavigate();

  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [page, setPage] = useState(0);

  // Live Sessions & Attendance State
  const [liveSessions, setLiveSessions] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState(() => getStoredAttendanceRecords());
  const [selectedAttendanceStudent, setSelectedAttendanceStudent] = useState(null);
  const [showBatchAttendanceModal, setShowBatchAttendanceModal] = useState(false);

  // Edit Capacity Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [formCapacity, setFormCapacity] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // View Student Modal
  const [viewStudent, setViewStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Change Batch Modal
  const [batchChangeStudent, setBatchChangeStudent] = useState(null);
  const [otherBatches, setOtherBatches] = useState([]);
  const [selectedTargetBatchId, setSelectedTargetBatchId] = useState('');
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [submittingBatchChange, setSubmittingBatchChange] = useState(false);
  const [batchChangeError, setBatchChangeError] = useState('');

  // Listen for real-time attendance changes (e.g. student clicked join or admin override)
  useEffect(() => {
    function handleAttendanceUpdate() {
      setAttendanceRecords(getStoredAttendanceRecords());
    }
    window.addEventListener('onetutor_attendance_updated', handleAttendanceUpdate);
    return () => {
      window.removeEventListener('onetutor_attendance_updated', handleAttendanceUpdate);
    };
  }, []);

  useEffect(() => {
    loadBatchData();
  }, [batchId, page]);

  async function loadBatchData() {
    setLoading(true);
    try {
      const [batchData, studentPage] = await Promise.all([
        getAdminBatch(batchId),
        getBatchStudents(batchId, { page, size: 20 }),
      ]);
      setBatch(batchData);
      setStudents(studentPage?.content || []);
      setTotalStudents(studentPage?.totalElements || 0);
      setFormCapacity(String(batchData.capacity));
      setFormStatus(batchData.status || 'active');
      setFormStartDate(batchData.startDate || '');
      setFormEndDate(batchData.endDate || '');

      // Load batch live sessions for calculating attendance
      try {
        const sessionRes = await getAdminLiveSessions({ courseId: batchData.courseId, size: 100 });
        const allSes = sessionRes?.content || (Array.isArray(sessionRes) ? sessionRes : []);
        const filteredSes = allSes.filter(s => {
          if (s.batchId != null) return String(s.batchId) === String(batchId);
          if (s.batch?.id != null) return String(s.batch.id) === String(batchId);
          return true;
        });
        setLiveSessions(filteredSes.length > 0 ? filteredSes : allSes);
      } catch (e) {
        console.debug('Failed to load batch live sessions', e);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load batch details');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSubmit(e) {
    e.preventDefault();
    const cap = parseInt(formCapacity, 10);
    if (isNaN(cap) || cap <= 0) {
      setFormError('Capacity must be at least 1');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await updateBatch(batch.id, {
        name: batch.name,
        code: batch.code,
        capacity: cap,
        status: formStatus,
        startDate: formStartDate || null,
        endDate: formEndDate || null,
      });
      toast.success('Batch capacity updated successfully!');
      setShowEditModal(false);
      loadBatchData();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to update capacity');
    } finally {
      setSaving(false);
    }
  }

  async function handleViewStudent(student) {
    setViewStudent(student);
    setDetailLoading(true);
    setStudentDetail(null);
    try {
      const detail = await getStudentDetail(student.studentId);
      setStudentDetail(detail);
    } catch (err) {
      console.error('Failed to load student detail', err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleRemoveStudent(student) {
    if (isReadOnly) return;
    const confirmed = await confirmDialog({
      title: 'Remove Student from Batch?',
      description: `Are you sure you want to remove ${student.studentName} from this batch (${batch.name})? This will immediately free up 1 seat in the batch.`,
      confirmText: 'Remove Student',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await removeBatchStudent(batch.id, student.enrollmentId);
      toast.success(`${student.studentName} was removed from ${batch.name}. 1 seat has been freed up!`);
      if (viewStudent && viewStudent.enrollmentId === student.enrollmentId) {
        setViewStudent(null);
        setStudentDetail(null);
      }
      loadBatchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to remove student');
    }
  }

  async function handleOpenChangeBatch(student) {
    setBatchChangeStudent(student);
    setSelectedTargetBatchId('');
    setBatchChangeError('');
    setLoadingBatches(true);
    try {
      const batches = await getCourseBatches(batch.courseId);
      const filtered = (batches || []).filter(b => b.id !== batch.id);
      setOtherBatches(filtered);
      if (filtered.length > 0) {
        const firstAvailable = filtered.find(b => !b.isFull && b.availableSeats > 0);
        if (firstAvailable) {
          setSelectedTargetBatchId(String(firstAvailable.id));
        } else {
          setSelectedTargetBatchId(String(filtered[0].id));
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load other batches for this course');
    } finally {
      setLoadingBatches(false);
    }
  }

  async function handleSubmitBatchChange(e) {
    e.preventDefault();
    if (isReadOnly) return;
    if (!selectedTargetBatchId) {
      setBatchChangeError('Please select a target batch');
      return;
    }

    setSubmittingBatchChange(true);
    setBatchChangeError('');
    try {
      await changeBatchStudent(batch.id, batchChangeStudent.enrollmentId, parseInt(selectedTargetBatchId, 10));
      const target = otherBatches.find(b => String(b.id) === String(selectedTargetBatchId));
      toast.success(`${batchChangeStudent.studentName} transferred to ${target ? target.name : 'new batch'}! 1 seat freed in ${batch.name}.`);
      setBatchChangeStudent(null);
      if (viewStudent && viewStudent.enrollmentId === batchChangeStudent.enrollmentId) {
        setViewStudent(null);
        setStudentDetail(null);
      }
      loadBatchData();
    } catch (err) {
      console.error(err);
      setBatchChangeError(err.response?.data?.error?.message || err.response?.data?.message || 'Failed to transfer student to new batch');
    } finally {
      setSubmittingBatchChange(false);
    }
  }

  if (loading && !batch) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '60px' }}>
        Loading batch details…
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '60px' }}>
        <h2>Batch not found</h2>
        <Link to="/admin/batches" className="btn btn-secondary">Back to Batches</Link>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((batch.enrolledCount / batch.capacity) * 100));
  const isFull = batch.isFull || batch.enrolledCount >= batch.capacity;

  // Batch overall live attendance calculations
  const nowTime = new Date();
  const heldSessions = liveSessions.filter(s => s.status === 'completed' || (s.scheduledAt && new Date(s.scheduledAt) <= nowTime));
  const totalHeldSessionsCount = heldSessions.length;

  let totalStudentAttendances = 0;
  let totalStudentPossibleHeldAttendances = totalHeldSessionsCount * (students.length || 1);
  students.forEach(st => {
    const stAtt = computeStudentAttendance(st, liveSessions, attendanceRecords);
    totalStudentAttendances += stAtt.attendedCount;
  });
  const overallBatchAttendancePct = totalHeldSessionsCount > 0
    ? Math.round((totalStudentAttendances / Math.max(1, totalStudentPossibleHeldAttendances)) * 100)
    : 100;

  return (
    <div className="page">
      {/* Breadcrumb & Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
        <Link to="/admin/batches" style={{ color: 'inherit', textDecoration: 'none' }}>Batches</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{batch.name}</span>
      </div>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="page-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>{batch.name}</h1>
            <span className={`status-badge ${batch.status}`}>{batch.status}</span>
          </div>
          <p className="page-subtitle" style={{ margin: '6px 0 0' }}>
            Course: <strong>{batch.courseName}</strong> • Code: <code style={{ color: 'var(--primary)', fontWeight: 700 }}>{batch.code}</code>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowBatchAttendanceModal(true)}
            title="View full batch attendance sheet across all sessions"
          >
            <i className="fa-solid fa-clipboard-user" style={{ marginRight: '6px', color: '#10b981' }}></i> Batch Attendance Sheet
          </button>
          {!isReadOnly && (
            <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}>
              <i className="fa-solid fa-pen-to-square" style={{ marginRight: '6px' }}></i> Edit Capacity
            </button>
          )}
          <Link to={`/admin/batches?courseId=${batch.courseId}`} className="btn btn-ghost">
            All Course Batches
          </Link>
        </div>
      </div>

      {/* Capacity & Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="stat-card" style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Max Student Capacity
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px', color: 'var(--text-primary)' }}>
            {batch.capacity}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Configured limit for this batch
          </div>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Active Enrollments
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px', color: '#6366f1' }}>
            {batch.enrolledCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {pct}% of seats occupied
          </div>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Available Seats
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px', color: isFull ? '#ef4444' : '#10b981' }}>
            {batch.availableSeats}
          </div>
          <div style={{ fontSize: '0.8rem', color: isFull ? '#ef4444' : '#10b981', marginTop: '4px', fontWeight: 600 }}>
            {isFull ? 'Batch is Full' : 'Open for Enrollment'}
          </div>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Batch Schedule
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '10px', color: 'var(--text-primary)' }}>
            {batch.startDate ? new Date(batch.startDate).toLocaleDateString() : 'Immediate'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {batch.endDate ? `Ends: ${new Date(batch.endDate).toLocaleDateString()}` : 'No end date'}
          </div>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Live Attendance</span>
            <i className="fa-solid fa-clipboard-user" style={{ color: '#10b981' }}></i>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px', color: '#10b981' }}>
            {totalHeldSessionsCount > 0 ? `${overallBatchAttendancePct}%` : '100%'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {totalHeldSessionsCount > 0
              ? `${totalStudentAttendances} attendances • ${totalHeldSessionsCount} held class${totalHeldSessionsCount > 1 ? 'es' : ''}`
              : 'Auto-marked on live join'}
          </div>
        </div>
      </div>

      {/* Capacity Progress Bar */}
      <div style={{ background: 'var(--bg-surface)', padding: '18px 22px', borderRadius: '12px', border: '1px solid var(--border-default)', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Capacity Utilization</span>
          <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isFull ? '#ef4444' : pct > 80 ? '#f59e0b' : '#10b981' }}>
            {batch.enrolledCount} / {batch.capacity} Students ({pct}%)
          </span>
        </div>
        <div style={{ height: '10px', width: '100%', background: 'var(--border-default)', borderRadius: '5px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: isFull ? '#ef4444' : pct > 80 ? '#f59e0b' : '#10b981',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Students List */}
      <div className="table-card">
        <div className="table-toolbar">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
            Enrolled Students ({totalStudents})
          </h2>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '65px', textAlign: 'center' }}>S.No</th>
                <th>Student Name</th>
                <th>Email</th>
                <th>Enrolled Date</th>
                <th style={{ minWidth: '180px' }}>Attendance</th>
                <th style={{ minWidth: '180px' }}>Course Progress</th>
                <th style={{ textAlign: 'right', minWidth: '170px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty">
                    No students currently enrolled in this batch.
                  </td>
                </tr>
              ) : (
                students.map((s, idx) => (
                  <tr key={s.enrollmentId}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {page * 20 + idx + 1}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}
                        >
                          {s.profileImage ? (
                            <img src={s.profileImage} alt={s.studentName} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            s.studentName ? s.studentName.charAt(0).toUpperCase() : 'S'
                          )}
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.studentName}</div>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>{s.studentEmail}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {s.enrolledAt ? new Date(s.enrolledAt).toLocaleString() : '—'}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const att = computeStudentAttendance(s, liveSessions, attendanceRecords);
                        if (!att.totalHeld) {
                          return (
                            <span
                              onClick={() => setSelectedAttendanceStudent({ student: s, att })}
                              style={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'rgba(148, 163, 184, 0.12)',
                                color: '#64748b',
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                borderRadius: '9999px',
                                padding: '4px 10px',
                                fontSize: '0.78rem',
                                fontWeight: 600
                              }}
                              title="Click to view session attendance breakdown"
                            >
                              <i className="fa-regular fa-clock"></i> No sessions held yet
                            </span>
                          );
                        }

                        const rate = att.percentage ?? 0;
                        const isPerfect = rate >= 100;
                        const isPartial = rate > 0 && rate < 100;

                        return (
                          <div
                            onClick={() => setSelectedAttendanceStudent({ student: s, att })}
                            style={{
                              cursor: 'pointer',
                              display: 'inline-flex',
                              flexDirection: 'column',
                              gap: '4px',
                              padding: '4px 6px',
                              borderRadius: '8px',
                              transition: 'all 0.15s ease'
                            }}
                            title="Click to view student session breakdown & attendance sheet"
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: isPerfect
                                  ? 'rgba(16, 185, 129, 0.12)'
                                  : isPartial
                                  ? 'rgba(99, 102, 241, 0.12)'
                                  : 'rgba(239, 68, 68, 0.1)',
                                color: isPerfect ? '#10b981' : isPartial ? '#6366f1' : '#ef4444',
                                border: `1px solid ${isPerfect ? 'rgba(16, 185, 129, 0.3)' : isPartial ? 'rgba(99, 102, 241, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                borderRadius: '9999px',
                                padding: '3px 10px',
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                width: 'fit-content'
                              }}
                            >
                              <i className={`fa-solid ${isPerfect ? 'fa-circle-check' : isPartial ? 'fa-circle-half-stroke' : 'fa-circle-xmark'}`}></i>
                              <span>{rate}% ({att.attendedCount}/{att.totalHeld} Present)</span>
                            </span>
                            {att.absentCount > 0 && (
                              <span style={{ fontSize: '0.74rem', color: '#ef4444', fontWeight: 600, paddingLeft: '4px' }}>
                                • {att.absentCount} missed / absent
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <div style={{ minWidth: '160px', maxWidth: '220px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: (s.progressPercent || 0) >= 100 ? '#10b981' : 'var(--text-primary)' }}>
                            {Math.round(s.progressPercent || 0)}%
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {s.completedContents || 0} / {s.totalContents || 0} lessons
                          </span>
                        </div>
                        <div style={{ height: '6px', width: '100%', background: 'var(--border-default)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, Math.round(s.progressPercent || 0))}%`,
                              background: (s.progressPercent || 0) >= 100 ? '#10b981' : (s.progressPercent || 0) > 40 ? '#6366f1' : '#3b82f6',
                              borderRadius: '3px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewStudent(s)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px' }}
                          title="View student details and progress"
                        >
                          <i className="fa-solid fa-eye"></i> View
                        </button>
                        {!isReadOnly && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenChangeBatch(s)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px' }}
                              title="Change student's batch"
                            >
                              <i className="fa-solid fa-arrow-right-arrow-left"></i> Change Batch
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => handleRemoveStudent(s)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                fontWeight: 600,
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                              title="Remove student from batch and free 1 seat"
                            >
                              <i className="fa-solid fa-user-minus"></i> Remove
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

        {/* Pagination */}
        {totalStudents > 20 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid var(--border-default)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Showing {students.length} of {totalStudents} students
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
                disabled={(page + 1) * 20 >= totalStudents}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* EDIT CAPACITY MODAL */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
          <div className="modal-dialog" style={{ maxWidth: '500px', pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Batch Capacity & Status</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>✕</button>
            </div>

            <form onSubmit={handleUpdateSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.86rem', fontWeight: 600 }}>
                    {formError}
                  </div>
                )}

                <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Current active enrollments: <strong>{batch.enrolledCount}</strong>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Note: You cannot reduce capacity below the active enrollment count ({batch.enrolledCount}).
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Max Student Capacity *</label>
                  <input
                    type="number"
                    min={batch.enrolledCount || 1}
                    className="form-control"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600 }}>Batch Status</label>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Updating…' : 'Update Capacity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW STUDENT DETAILS & PROGRESS MODAL */}
      {viewStudent && (
        <div className="modal-backdrop" onClick={() => { setViewStudent(null); setStudentDetail(null); }}>
          <div className="modal-dialog" style={{ maxWidth: '580px', pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-user-graduate" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}></i>
                <h2 className="modal-title">Student Details & Progress</h2>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setViewStudent(null); setStudentDetail(null); }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Profile Card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px' }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.3rem',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}
                >
                  {viewStudent.profileImage || studentDetail?.profileImage ? (
                    <img src={viewStudent.profileImage || studentDetail?.profileImage} alt={viewStudent.studentName} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    viewStudent.studentName ? viewStudent.studentName.charAt(0).toUpperCase() : 'S'
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {viewStudent.studentName}
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {viewStudent.studentEmail}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                    <span className="status-badge active" style={{ fontSize: '0.72rem' }}>Enrolled</span>
                    {studentDetail?.emailVerified && (
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontWeight: 700 }}>
                        <i className="fa-solid fa-check-circle" style={{ marginRight: '4px' }}></i> Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Batch Enrollment Details */}
              <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Batch Enrollment Info
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.88rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Course</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{batch.courseName}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Batch</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{batch.name} ({batch.code})</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Enrolled Date</span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {viewStudent.enrolledAt ? new Date(viewStudent.enrolledAt).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Enrollment ID</span>
                    <code style={{ color: 'var(--primary)' }}>#{viewStudent.enrollmentId}</code>
                  </div>
                </div>
              </div>

              {/* Course Progress Tracking */}
              <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Course Progress Tracking
                  </div>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: (viewStudent.progressPercent || 0) >= 100 ? '#10b981' : '#6366f1' }}>
                    {Math.round(viewStudent.progressPercent || 0)}%
                  </span>
                </div>

                <div style={{ height: '10px', width: '100%', background: 'var(--border-default)', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, Math.round(viewStudent.progressPercent || 0))}%`,
                      background: (viewStudent.progressPercent || 0) >= 100 ? '#10b981' : '#6366f1',
                      borderRadius: '5px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <span>Completed: <strong>{viewStudent.completedContents || 0}</strong> lessons</span>
                  <span>Total Course Contents: <strong>{viewStudent.totalContents || 0}</strong></span>
                </div>
              </div>

              {/* Live Session Attendance Tracking */}
              {(() => {
                const att = computeStudentAttendance(viewStudent, liveSessions, attendanceRecords);
                const hasHeld = att.totalHeld > 0;
                const rate = att.percentage ?? (hasHeld ? 0 : 100);
                return (
                  <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-clipboard-user" style={{ color: 'var(--primary)' }}></i>
                        Live Session Attendance
                      </div>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: hasHeld ? (rate >= 80 ? '#10b981' : rate > 40 ? '#6366f1' : '#ef4444') : '#64748b' }}>
                        {hasHeld ? `${rate}%` : 'No held sessions yet'}
                      </span>
                    </div>

                    <div style={{ height: '10px', width: '100%', background: 'var(--border-default)', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, rate)}%`,
                          background: hasHeld ? (rate >= 80 ? '#10b981' : rate > 40 ? '#6366f1' : '#ef4444') : '#94a3b8',
                          borderRadius: '5px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>
                        <i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i>
                        Attended: <strong>{att.attendedCount}</strong>
                      </span>
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>
                        <i className="fa-solid fa-xmark" style={{ marginRight: '4px' }}></i>
                        Absent: <strong>{att.absentCount}</strong>
                      </span>
                      <span>Total Held: <strong>{att.totalHeld}</strong></span>
                    </div>

                    {att.sessions && att.sessions.length > 0 && (
                      <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {att.sessions.map((ses, i) => (
                          <div key={ses.sessionId || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '4px 0' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ses.sessionTitle}</span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                background: ses.attendanceStatus === 'PRESENT' ? 'rgba(16, 185, 129, 0.12)' : (ses.attendanceStatus === 'UPCOMING' ? '#e0f2fe' : '#fee2e2'),
                                color: ses.attendanceStatus === 'PRESENT' ? '#10b981' : (ses.attendanceStatus === 'UPCOMING' ? '#0284c7' : '#ef4444')
                              }}
                            >
                              {ses.attendanceStatus === 'PRESENT' ? 'Present' : (ses.attendanceStatus === 'UPCOMING' ? 'Upcoming' : 'Absent')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Other Enrolled Courses (if any) */}
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Loading profile overview…
                </div>
              ) : studentDetail?.enrolledCourses?.length > 1 ? (
                <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Other Enrolled Courses ({studentDetail.enrolledCourses.length - 1})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {studentDetail.enrolledCourses
                      .filter(c => c.courseId !== batch.courseId)
                      .map(c => (
                        <div key={c.enrollmentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem', padding: '6px 0', borderBottom: '1px dashed var(--border-subtle)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.courseName}</span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>{Math.round(c.progressPercent || 0)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleRemoveStudent(viewStudent)}
                  >
                    <i className="fa-solid fa-user-minus"></i> Remove from Batch
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const s = viewStudent;
                      setViewStudent(null);
                      setStudentDetail(null);
                      handleOpenChangeBatch(s);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="fa-solid fa-arrow-right-arrow-left"></i> Change Batch
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <Link
                  to={`/admin/students?search=${encodeURIComponent(viewStudent.studentEmail)}`}
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  <i className="fa-solid fa-arrow-up-right-from-square" style={{ marginRight: '6px' }}></i> Full Profile
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setViewStudent(null); setStudentDetail(null); }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE STUDENT BATCH MODAL */}
      {batchChangeStudent && (
        <div className="modal-backdrop" onClick={() => setBatchChangeStudent(null)}>
          <div className="modal-dialog" style={{ maxWidth: '520px', pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-arrow-right-arrow-left" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}></i>
                <h2 className="modal-title">Change Student Batch</h2>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setBatchChangeStudent(null)}>✕</button>
            </div>

            <form onSubmit={handleSubmitBatchChange}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {batchChangeError && (
                  <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.86rem', fontWeight: 600 }}>
                    {batchChangeError}
                  </div>
                )}

                {/* Student & Current Batch Summary */}
                <div style={{ padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
                    Student & Current Assignment
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {batchChangeStudent.studentName}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {batchChangeStudent.studentEmail}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    Current Batch: <strong>{batch.name}</strong> (<code style={{ color: 'var(--primary)' }}>{batch.code}</code>) • Course: <strong>{batch.courseName}</strong>
                  </div>
                </div>

                {/* Target Batch Selection */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700, marginBottom: '8px', display: 'block' }}>
                    Select Target Batch *
                  </label>

                  {loadingBatches ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading batches for this course…
                    </div>
                  ) : otherBatches.length === 0 ? (
                    <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', fontSize: '0.88rem', color: '#b45309' }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        No other batches exist for this course yet.
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: '0.82rem' }}>
                        Create another batch for this course before transferring students.
                      </p>
                      <Link to={`/admin/batches?courseId=${batch.courseId}`} className="btn btn-secondary btn-sm" style={{ marginTop: '10px', display: 'inline-block' }}>
                        Create Batch for Course
                      </Link>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                      {otherBatches.map(b => {
                        const isFull = b.isFull || b.availableSeats <= 0;
                        const isSelected = selectedTargetBatchId === String(b.id);
                        return (
                          <label
                            key={b.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 14px',
                              borderRadius: '8px',
                              border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-default)',
                              background: isSelected ? 'rgba(99, 102, 241, 0.05)' : isFull ? 'var(--bg-muted)' : 'var(--bg-surface)',
                              cursor: isFull ? 'not-allowed' : 'pointer',
                              opacity: isFull ? 0.6 : 1,
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                type="radio"
                                name="targetBatch"
                                value={b.id}
                                checked={isSelected}
                                disabled={isFull}
                                onChange={(e) => setSelectedTargetBatchId(e.target.value)}
                              />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                  {b.name} <code style={{ fontSize: '0.8rem', color: 'var(--primary)', marginLeft: '4px' }}>{b.code}</code>
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {b.startDate ? `Starts: ${new Date(b.startDate).toLocaleDateString()}` : 'Immediate'}
                                </div>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              {isFull ? (
                                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                  Full (0 free)
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                  {b.availableSeats} / {b.capacity} seats free
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Explanatory Notice */}
                <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px dashed var(--border-default)', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary)', marginRight: '6px' }}></i>
                  Transferring will free 1 seat in <strong>{batch.name}</strong> and occupy 1 seat in the target batch. The student will be notified automatically.
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setBatchChangeStudent(null)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingBatchChange || !selectedTargetBatchId || otherBatches.length === 0}
                >
                  {submittingBatchChange ? 'Transferring…' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT ATTENDANCE DETAILS MODAL */}
      {selectedAttendanceStudent && (
        <div className="modal-backdrop" onClick={() => setSelectedAttendanceStudent(null)}>
          <div className="modal-dialog" style={{ maxWidth: '640px', pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-clipboard-user" style={{ color: '#10b981', fontSize: '1.25rem' }}></i>
                <div>
                  <h2 className="modal-title" style={{ margin: 0 }}>Student Attendance Breakdown</h2>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedAttendanceStudent.student?.studentName || selectedAttendanceStudent.studentName} • {batch.name}
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedAttendanceStudent(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {(() => {
                const targetStudent = selectedAttendanceStudent.student || selectedAttendanceStudent;
                const att = computeStudentAttendance(targetStudent, liveSessions, attendanceRecords);
                const hasHeld = att.totalHeld > 0;
                const rate = att.percentage ?? (hasHeld ? 0 : 100);

                return (
                  <>
                    {/* Header Pill Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-default)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Held Classes</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{att.totalHeld}</div>
                      </div>
                      <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>Present</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{att.attendedCount}</div>
                      </div>
                      <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.25)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Absent</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>{att.absentCount}</div>
                      </div>
                      <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.25)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase' }}>Attendance</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: hasHeld ? (rate >= 80 ? '#10b981' : rate > 40 ? '#6366f1' : '#ef4444') : '#64748b', marginTop: '4px' }}>
                          {hasHeld ? `${rate}%` : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                      <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary)', marginRight: '6px' }}></i>
                      Students who clicked the live joining button are automatically marked <strong>Present</strong> with join timestamps. Balance students are marked <strong>Absent</strong> for completed or held sessions.
                    </div>

                    {/* Session Breakdown List */}
                    <div>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Live Class Sessions ({att.sessions.length})
                      </h4>

                      {att.sessions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-default)' }}>
                          No live class sessions scheduled for this batch yet.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                          {att.sessions.map((s, idx) => {
                            const isPresent = s.attendanceStatus === 'PRESENT';
                            const isUpcoming = s.attendanceStatus === 'UPCOMING';
                            return (
                              <div
                                key={s.sessionId || idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 14px',
                                  borderRadius: '8px',
                                  background: 'var(--bg-surface)',
                                  border: '1px solid var(--border-default)',
                                  gap: '12px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: isPresent ? 'rgba(16, 185, 129, 0.15)' : (isUpcoming ? 'rgba(2, 132, 199, 0.12)' : 'rgba(239, 68, 68, 0.12)'),
                                      color: isPresent ? '#10b981' : (isUpcoming ? '#0284c7' : '#ef4444'),
                                      fontSize: '0.85rem'
                                    }}
                                  >
                                    <i className={`fa-solid ${isPresent ? 'fa-check' : (isUpcoming ? 'fa-clock' : 'fa-xmark')}`}></i>
                                  </div>

                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                      {s.sessionTitle}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      {s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : '—'}
                                      {s.attendedAt && isPresent && (
                                        <span style={{ color: '#10b981', marginLeft: '6px' }}>
                                          • Joined {new Date(s.attendedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      fontSize: '0.74rem',
                                      fontWeight: 800,
                                      padding: '3px 10px',
                                      borderRadius: '9999px',
                                      background: isPresent ? 'rgba(16, 185, 129, 0.15)' : (isUpcoming ? '#e0f2fe' : 'rgba(239, 68, 68, 0.12)'),
                                      color: isPresent ? '#10b981' : (isUpcoming ? '#0284c7' : '#ef4444')
                                    }}
                                  >
                                    {isPresent ? 'PRESENT' : (isUpcoming ? 'UPCOMING' : 'ABSENT')}
                                  </span>

                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                                      onClick={() => {
                                        const newStatus = isPresent ? 'ABSENT' : 'PRESENT';
                                        markStudentAttendanceOverride(s.sessionId, targetStudent, newStatus, s);
                                        toast.success(`Attendance updated to ${newStatus} for ${targetStudent.studentName}`);
                                        setAttendanceRecords(getStoredAttendanceRecords());
                                      }}
                                      title={isPresent ? "Mark student as Absent" : "Mark student as Present"}
                                    >
                                      {isPresent ? 'Set Absent' : 'Set Present'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedAttendanceStudent(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* BATCH ATTENDANCE SHEET MODAL */}
      {showBatchAttendanceModal && (
        <div className="modal-backdrop" onClick={() => setShowBatchAttendanceModal(false)}>
          <div className="modal-dialog" style={{ maxWidth: '820px', pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-clipboard-user" style={{ color: '#10b981', fontSize: '1.35rem' }}></i>
                <div>
                  <h2 className="modal-title" style={{ margin: 0 }}>Batch Attendance Sheet</h2>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {batch.name} • {batch.courseName} ({totalStudents} Enrolled Students)
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowBatchAttendanceModal(false)}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-default)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Batch Students</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{students.length}</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-default)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Held Live Sessions</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#6366f1', marginTop: '4px' }}>{totalHeldSessionsCount}</div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>Overall Batch Attendance</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{overallBatchAttendancePct}%</div>
                </div>
              </div>

              <div className="table-responsive" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ width: '55px', textAlign: 'center' }}>#</th>
                      <th>Student Name</th>
                      <th>Email</th>
                      <th style={{ textAlign: 'center' }}>Present</th>
                      <th style={{ textAlign: 'center' }}>Absent</th>
                      <th style={{ textAlign: 'center' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="table-empty">No students enrolled in this batch.</td>
                      </tr>
                    ) : (
                      students.map((st, i) => {
                        const att = computeStudentAttendance(st, liveSessions, attendanceRecords);
                        const hasHeld = att.totalHeld > 0;
                        const rate = att.percentage ?? (hasHeld ? 0 : 100);
                        const isPerfect = rate >= 100;
                        const isPartial = rate > 0 && rate < 100;

                        return (
                          <tr key={st.enrollmentId || i}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{i + 1}</td>
                            <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{st.studentName}</td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{st.studentEmail}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: '#10b981' }}>{att.attendedCount}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: att.absentCount > 0 ? '#ef4444' : 'var(--text-muted)' }}>{att.absentCount}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  fontSize: '0.76rem',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  background: isPerfect ? 'rgba(16, 185, 129, 0.12)' : (isPartial ? 'rgba(99, 102, 241, 0.12)' : 'rgba(239, 68, 68, 0.1)'),
                                  color: isPerfect ? '#10b981' : (isPartial ? '#6366f1' : '#ef4444')
                                }}
                              >
                                {hasHeld ? `${rate}%` : 'N/A'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                                onClick={() => {
                                  setSelectedAttendanceStudent({ student: st, att });
                                }}
                              >
                                View Breakdown
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBatchAttendanceModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
