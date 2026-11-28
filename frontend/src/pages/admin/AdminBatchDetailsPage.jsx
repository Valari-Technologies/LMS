import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getAdminBatch, getBatchStudents, updateBatch, removeBatchStudent, changeBatchStudent, getCourseBatches } from '../../api/batches';
import { getStudentDetail } from '../../api/users';
import { getAdminLiveSessions, getSessionAttendance } from '../../api/live';
import { getAdminAssessments } from '../../api/assessments';
import { listSections } from '../../api/sections';
import {
  getStoredAttendanceRecords,
  computeStudentAttendance,
  markStudentAttendanceOverride,
  getSessionAttendanceSheet,
  recordStudentAttendance
} from '../../utils/attendanceStorage';
import { toast, confirmDialog } from '../../context/NotificationContext';
import { usePermission } from '../../hooks/usePermission';
import { PLAN_DEFINITIONS, PLAN_TYPES, getStudentEnrolledPlan } from '../../utils/courseSellingPlans';

function formatLastSeen(timestamp) {
  if (!timestamp) return { primary: 'Offline', secondary: 'No activity recorded', isOnline: false };
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  if (isNaN(diffMs)) return { primary: 'Offline', secondary: 'No activity recorded', isOnline: false };
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const formattedDateTime = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  if (diffSecs >= 0 && diffSecs < 90) {
    return { primary: 'Online Now', secondary: 'Active currently', isOnline: true };
  }
  if (diffMins < 60) {
    return { primary: `${Math.max(1, diffMins)}m ago`, secondary: formattedDateTime, isOnline: false };
  }
  if (diffHours < 24) {
    return { primary: `${diffHours}h ago`, secondary: formattedDateTime, isOnline: false };
  }
  if (diffDays < 7) {
    return { primary: `${diffDays}d ago`, secondary: formattedDateTime, isOnline: false };
  }
  return { primary: formattedDateTime, secondary: null, isOnline: false };
}

function getResolvedLastSeen(student, detail, attSessions) {
  const candidates = [];
  if (detail?.lastActiveAt) candidates.push(new Date(detail.lastActiveAt));
  if (student?.lastActiveAt) candidates.push(new Date(student.lastActiveAt));
  if (student?.lastLogin) candidates.push(new Date(student.lastLogin));

  // Check course summary last accessed
  const courseSummary = (detail?.enrolledCourses || []).find(c => String(c.courseId) === String(student?.courseId));
  if (courseSummary?.lastAccessedAt) candidates.push(new Date(courseSummary.lastAccessedAt));

  // Check attendance records
  (attSessions || []).forEach(ses => {
    if (ses.attendedAt && ses.attendanceStatus === 'PRESENT') {
      candidates.push(new Date(ses.attendedAt));
    }
  });

  // Check assessment attempts
  (detail?.assessments || []).forEach(a => {
    if (a.completedAt) candidates.push(new Date(a.completedAt));
    else if (a.startedAt) candidates.push(new Date(a.startedAt));
  });

  // Check recent activities
  (detail?.recentActivity || []).forEach(act => {
    if (act.timestamp) candidates.push(new Date(act.timestamp));
  });

  // Fallback to enrolledAt
  if (student?.enrolledAt) candidates.push(new Date(student.enrolledAt));

  const validDates = candidates.filter(d => d instanceof Date && !isNaN(d.getTime()));
  if (validDates.length === 0) return null;
  validDates.sort((a, b) => b.getTime() - a.getTime());
  return validDates[0];
}

export default function AdminBatchDetailsPage() {
  const { isReadOnly } = usePermission();
  const { batchId } = useParams();
  const navigate = useNavigate();

  const [batch, setBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [page, setPage] = useState(0);

  // Purchase Plan Filter & Search State
  const [filterPlan, setFilterPlan] = useState('ALL'); // 'ALL' | 'FULL_ACCESS' | 'LIVE_ONLY' | 'RECORDED_ONLY' | 'FREE'
  const [searchQuery, setSearchQuery] = useState('');

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
  const [studentModalTab, setStudentModalTab] = useState('overview'); // 'overview' | 'curriculum' | 'attendance' | 'assessments'
  const [courseAssessmentsList, setCourseAssessmentsList] = useState([]);
  const [courseSectionsList, setCourseSectionsList] = useState([]);

  // Change Batch Modal
  const [batchChangeStudent, setBatchChangeStudent] = useState(null);
  const [otherBatches, setOtherBatches] = useState([]);
  const [selectedTargetBatchId, setSelectedTargetBatchId] = useState('');
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [submittingBatchChange, setSubmittingBatchChange] = useState(false);
  const [batchChangeError, setBatchChangeError] = useState('');

  // Enhance students with their resolved purchased selling plan
  const studentsWithPlan = useMemo(() => {
    return (students || []).map(s => {
      const plan = getStudentEnrolledPlan(batch?.courseId, s.studentId || s.studentEmail, s);
      const isFree = s.pricingType === 'free' || s.amountPaid === 0;
      const planType = s.planType || plan?.id || (isFree ? 'FREE' : 'FULL_ACCESS');
      return {
        ...s,
        resolvedPlan: plan,
        planType,
        isFree
      };
    });
  }, [students, batch?.courseId]);

  // Compute breakdown counts across the batch
  const planCounts = useMemo(() => {
    const counts = {
      ALL: (studentsWithPlan || []).length,
      [PLAN_TYPES.FULL_ACCESS]: 0,
      [PLAN_TYPES.LIVE_ONLY]: 0,
      [PLAN_TYPES.RECORDED_ONLY]: 0,
      FREE: 0
    };
    (studentsWithPlan || []).forEach(s => {
      if (s.planType && counts[s.planType] !== undefined) {
        counts[s.planType] += 1;
      } else {
        counts[PLAN_TYPES.FULL_ACCESS] += 1;
      }
      if (s.isFree) {
        counts.FREE += 1;
      }
    });
    return counts;
  }, [studentsWithPlan]);

  // Filter students by selected purchase plan and search query
  const filteredStudents = useMemo(() => {
    return (studentsWithPlan || []).filter(s => {
      if (filterPlan !== 'ALL') {
        if (filterPlan === 'FREE') {
          if (!s.isFree) return false;
        } else if (s.planType !== filterPlan) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (s.studentName || '').toLowerCase().includes(q);
        const emailMatch = (s.studentEmail || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch) return false;
      }
      return true;
    });
  }, [studentsWithPlan, filterPlan, searchQuery]);

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
    setAttendanceRecords(getStoredAttendanceRecords());
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
        const targetSessions = filteredSes.length > 0 ? filteredSes : allSes;
        setLiveSessions(targetSessions);

        // Synchronize backend attendance for these sessions
        Promise.all(targetSessions.map(s => getSessionAttendance(s.id).catch(() => null))).then(sheets => {
          let updated = false;
          sheets.forEach((sheet, idx) => {
            if (sheet?.students && Array.isArray(sheet.students)) {
              sheet.students.forEach(st => {
                if ((st.attendanceStatus || st.status) === 'PRESENT') {
                  updated = true;
                  recordStudentAttendance(targetSessions[idx].id, {
                    id: st.studentId,
                    studentId: st.studentId,
                    email: st.studentEmail,
                    studentEmail: st.studentEmail,
                    name: st.studentName,
                    studentName: st.studentName
                  }, {
                    courseId: batchData.courseId,
                    batchId: batchData.id,
                    sessionTitle: targetSessions[idx].title,
                    attendedAt: st.attendedAt || st.joinTime
                  });
                }
              });
            }
          });
          if (updated) {
            setAttendanceRecords(getStoredAttendanceRecords());
          }
        }).catch(() => {});
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
    setStudentModalTab('overview');
    try {
      const [detail, assessments, sections] = await Promise.all([
        getStudentDetail(student.studentId).catch(err => {
          console.debug('Failed to load student detail', err);
          return null;
        }),
        batch?.courseId ? getAdminAssessments(batch.courseId).catch(() => []) : Promise.resolve([]),
        batch?.courseId ? listSections(batch.courseId).catch(() => []) : Promise.resolve([])
      ]);
      setStudentDetail(detail);
      setCourseAssessmentsList(Array.isArray(assessments) ? assessments : []);
      setCourseSectionsList(Array.isArray(sections) ? sections : []);
    } catch (err) {
      console.error('Failed to load student detail info', err);
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

  // Batch overall live attendance calculations (computed among students with live access)
  const nowTime = new Date();
  const heldSessions = liveSessions.filter(s => s.status === 'completed' || (s.scheduledAt && new Date(s.scheduledAt) <= nowTime));
  const totalHeldSessionsCount = heldSessions.length;

  const liveEligibleStudents = studentsWithPlan.filter(s => s.planType !== PLAN_TYPES.RECORDED_ONLY);
  let totalStudentAttendances = 0;
  let totalStudentPossibleHeldAttendances = totalHeldSessionsCount * (liveEligibleStudents.length || 1);
  liveEligibleStudents.forEach(st => {
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
            <i className="fa-solid fa-clipboard-user" style={{ color: totalHeldSessionsCount > 0 ? (overallBatchAttendancePct >= 80 ? '#10b981' : overallBatchAttendancePct > 40 ? '#6366f1' : '#ef4444') : '#64748b' }}></i>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px', color: totalHeldSessionsCount > 0 ? (overallBatchAttendancePct >= 80 ? '#10b981' : overallBatchAttendancePct > 40 ? '#6366f1' : '#ef4444') : '#64748b' }}>
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
        {/* Table Toolbar Header with Title & Student Search */}
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', paddingBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-users" style={{ color: '#5A70D3' }}></i>
              <span>Enrolled Students</span>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                background: 'rgba(90, 112, 211, 0.1)',
                color: '#5A70D3',
                padding: '2px 8px',
                borderRadius: '9999px'
              }}>
                {filteredStudents.length} {filteredStudents.length !== students.length ? `of ${totalStudents}` : `total`}
              </span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Divide and manage students based on their purchased selling plan and attendance eligibility.
            </p>
          </div>

          {/* Quick Search Input */}
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              fontSize: '0.85rem'
            }}></i>
            <input
              type="text"
              className="form-control"
              placeholder="Search student by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: '34px',
                paddingRight: searchQuery ? '32px' : '12px',
                height: '38px',
                fontSize: '0.85rem',
                borderRadius: '10px'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '0.85rem'
                }}
                title="Clear search"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>

        {/* Purchase Plan Division Filter Tabs / Pills */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 18px',
          background: 'var(--bg-surface-secondary, #f8fafc)',
          borderTop: '1px solid var(--border-default)',
          borderBottom: '1px solid var(--border-default)',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <i className="fa-solid fa-filter" style={{ color: '#5A70D3' }}></i> Filter by Plan:
          </span>

          {/* 1. All Purchases */}
          <button
            type="button"
            onClick={() => setFilterPlan('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: filterPlan === 'ALL' ? '1.5px solid #5A70D3' : '1px solid var(--border-default)',
              background: filterPlan === 'ALL' ? '#5A70D3' : 'var(--bg-surface, #ffffff)',
              color: filterPlan === 'ALL' ? '#ffffff' : 'var(--text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              boxShadow: filterPlan === 'ALL' ? '0 2px 8px rgba(90, 112, 211, 0.3)' : 'none'
            }}
          >
            <i className="fa-solid fa-layer-group"></i>
            <span>All Purchases</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: filterPlan === 'ALL' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.06)',
              color: filterPlan === 'ALL' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700
            }}>
              {planCounts.ALL}
            </span>
          </button>

          {/* 2. Live + Recordings (FULL_ACCESS) */}
          <button
            type="button"
            onClick={() => setFilterPlan(PLAN_TYPES.FULL_ACCESS)}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: filterPlan === PLAN_TYPES.FULL_ACCESS ? '1.5px solid #5A70D3' : '1px solid var(--border-default)',
              background: filterPlan === PLAN_TYPES.FULL_ACCESS ? 'rgba(90, 112, 211, 0.12)' : 'var(--bg-surface, #ffffff)',
              color: filterPlan === PLAN_TYPES.FULL_ACCESS ? '#5A70D3' : 'var(--text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              boxShadow: filterPlan === PLAN_TYPES.FULL_ACCESS ? '0 2px 8px rgba(90, 112, 211, 0.2)' : 'none'
            }}
          >
            <i className="fa-solid fa-crown" style={{ color: '#5A70D3' }}></i>
            <span>Live + Recordings</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: filterPlan === PLAN_TYPES.FULL_ACCESS ? '#5A70D3' : 'rgba(0, 0, 0, 0.06)',
              color: filterPlan === PLAN_TYPES.FULL_ACCESS ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700
            }}>
              {planCounts[PLAN_TYPES.FULL_ACCESS]}
            </span>
          </button>

          {/* 3. Live Sessions Only (LIVE_ONLY) */}
          <button
            type="button"
            onClick={() => setFilterPlan(PLAN_TYPES.LIVE_ONLY)}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: filterPlan === PLAN_TYPES.LIVE_ONLY ? '1.5px solid #0284c7' : '1px solid var(--border-default)',
              background: filterPlan === PLAN_TYPES.LIVE_ONLY ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-surface, #ffffff)',
              color: filterPlan === PLAN_TYPES.LIVE_ONLY ? '#0284c7' : 'var(--text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              boxShadow: filterPlan === PLAN_TYPES.LIVE_ONLY ? '0 2px 8px rgba(2, 132, 199, 0.2)' : 'none'
            }}
          >
            <i className="fa-solid fa-tower-broadcast" style={{ color: '#0284c7' }}></i>
            <span>Live Sessions Only</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: filterPlan === PLAN_TYPES.LIVE_ONLY ? '#0284c7' : 'rgba(0, 0, 0, 0.06)',
              color: filterPlan === PLAN_TYPES.LIVE_ONLY ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700
            }}>
              {planCounts[PLAN_TYPES.LIVE_ONLY]}
            </span>
          </button>

          {/* 4. Recordings Only (RECORDED_ONLY) */}
          <button
            type="button"
            onClick={() => setFilterPlan(PLAN_TYPES.RECORDED_ONLY)}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: filterPlan === PLAN_TYPES.RECORDED_ONLY ? '1.5px solid #059669' : '1px solid var(--border-default)',
              background: filterPlan === PLAN_TYPES.RECORDED_ONLY ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-surface, #ffffff)',
              color: filterPlan === PLAN_TYPES.RECORDED_ONLY ? '#059669' : 'var(--text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              boxShadow: filterPlan === PLAN_TYPES.RECORDED_ONLY ? '0 2px 8px rgba(5, 150, 105, 0.2)' : 'none'
            }}
          >
            <i className="fa-solid fa-film" style={{ color: '#059669' }}></i>
            <span>Recordings Only</span>
            <span style={{
              fontSize: '0.72rem',
              padding: '1px 6px',
              borderRadius: '9999px',
              background: filterPlan === PLAN_TYPES.RECORDED_ONLY ? '#059669' : 'rgba(0, 0, 0, 0.06)',
              color: filterPlan === PLAN_TYPES.RECORDED_ONLY ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700
            }}>
              {planCounts[PLAN_TYPES.RECORDED_ONLY]}
            </span>
          </button>

          {/* 5. Free Access (if applicable) */}
          {planCounts.FREE > 0 && (
            <button
              type="button"
              onClick={() => setFilterPlan('FREE')}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                border: filterPlan === 'FREE' ? '1.5px solid #64748b' : '1px solid var(--border-default)',
                background: filterPlan === 'FREE' ? 'rgba(100, 116, 139, 0.12)' : 'var(--bg-surface, #ffffff)',
                color: filterPlan === 'FREE' ? '#475569' : 'var(--text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <i className="fa-solid fa-gift" style={{ color: '#64748b' }}></i>
              <span>Free Access</span>
              <span style={{
                fontSize: '0.72rem',
                padding: '1px 6px',
                borderRadius: '9999px',
                background: filterPlan === 'FREE' ? '#64748b' : 'rgba(0, 0, 0, 0.06)',
                color: filterPlan === 'FREE' ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 700
              }}>
                {planCounts.FREE}
              </span>
            </button>
          )}

          {/* Reset filter button if filtered */}
          {(filterPlan !== 'ALL' || searchQuery) && (
            <button
              type="button"
              onClick={() => { setFilterPlan('ALL'); setSearchQuery(''); }}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: '#ef4444',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <i className="fa-solid fa-rotate-left"></i> Reset Filter
            </button>
          )}
        </div>

        <div className="table-responsive">
          <style>{`
            .student-batch-table-row:hover td {
              background-color: var(--bg-surface-hover, rgba(99, 102, 241, 0.05)) !important;
            }
          `}</style>
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center' }}>S.No</th>
                <th>Student Name</th>
                <th>Email</th>
                <th>Enrolled Date</th>
                <th style={{ minWidth: '170px' }}>Purchased Plan</th>
                <th style={{ minWidth: '180px' }}>Attendance</th>
                <th style={{ minWidth: '160px' }}>Course Progress</th>
                <th style={{ textAlign: 'right', minWidth: '170px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="table-empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-filter-circle-xmark" style={{ fontSize: '2rem', color: '#cbd5e1' }}></i>
                      <span>
                        {students.length === 0
                          ? 'No students currently enrolled in this batch.'
                          : 'No students found matching the selected plan filter or search query.'}
                      </span>
                      {(filterPlan !== 'ALL' || searchQuery) && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setFilterPlan('ALL'); setSearchQuery(''); }}
                          style={{ marginTop: '4px' }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr
                    key={s.enrollmentId}
                    onClick={() => handleViewStudent(s)}
                    style={{ cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                    className="student-batch-table-row"
                    title="Click to view student details, curriculum progress, attendance & assessment marks"
                  >
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
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          background: s.resolvedPlan?.bgColor || 'rgba(90, 112, 211, 0.1)',
                          color: s.resolvedPlan?.color || '#5A70D3',
                          border: `1px solid ${s.resolvedPlan?.borderColor || 'rgba(90, 112, 211, 0.2)'}`,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <i className={s.resolvedPlan?.icon || 'fa-solid fa-layer-group'} style={{ fontSize: '0.72rem' }}></i>
                        <span>{s.resolvedPlan?.shortName || s.resolvedPlan?.name || 'Full Access'}</span>
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const att = computeStudentAttendance(s, liveSessions, attendanceRecords);
                        if (!att.totalHeld) {
                          return (
                            <span
                              onClick={(e) => { e.stopPropagation(); setSelectedAttendanceStudent({ student: s, att }); }}
                              style={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: '#f1f5f9',
                                color: '#64748b',
                                border: '1px solid #cbd5e1',
                                borderRadius: '9999px',
                                padding: '4px 10px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                whiteSpace: 'nowrap'
                              }}
                              title="Click to view session attendance breakdown"
                            >
                              <i className="fa-regular fa-clock"></i> No classes held
                            </span>
                          );
                        }

                        const rate = att.percentage ?? 0;
                        const isAllPresent = att.absentCount === 0 && att.attendedCount > 0;
                        const isAllAbsent = att.attendedCount === 0;

                        return (
                          <div
                            onClick={(e) => { e.stopPropagation(); setSelectedAttendanceStudent({ student: s, att }); }}
                            style={{
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                            title="Click to view student session breakdown & attendance sheet"
                          >
                            {isAllAbsent ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  borderRadius: '9999px',
                                  padding: '4px 12px',
                                  fontSize: '0.8rem',
                                  fontWeight: 800,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <i className="fa-solid fa-circle-xmark"></i>
                                <span>Absent ({att.absentCount}/{att.totalHeld})</span>
                              </span>
                            ) : isAllPresent ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                  borderRadius: '9999px',
                                  padding: '4px 12px',
                                  fontSize: '0.8rem',
                                  fontWeight: 800,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <i className="fa-solid fa-circle-check"></i>
                                <span>Present ({att.attendedCount}/{att.totalHeld})</span>
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: 'rgba(99, 102, 241, 0.12)',
                                  color: '#6366f1',
                                  border: '1px solid rgba(99, 102, 241, 0.25)',
                                  borderRadius: '9999px',
                                  padding: '4px 12px',
                                  fontSize: '0.8rem',
                                  fontWeight: 800,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <i className="fa-solid fa-circle-half-stroke"></i>
                                <span>{rate}% ({att.attendedCount} Present • {att.absentCount} Absent)</span>
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      {(s.totalContents || 0) === 0 ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'var(--bg-surface, #f1f5f9)',
                              border: '1px solid var(--border-default, #cbd5e1)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: 'var(--text-muted, #64748b)',
                            }}
                            title="This class has no video lessons (recordings only)"
                          >
                            <i className="fa-solid fa-video-slash" style={{ fontSize: '0.72rem', color: '#94a3b8' }}></i>
                            <span>No videos</span>
                          </span>
                        </div>
                      ) : (
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
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
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
              Showing {filteredStudents.length} of {totalStudents} students
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
      {viewStudent && (() => {
        const sPlan = getStudentEnrolledPlan(batch.courseId, viewStudent.studentId || viewStudent.studentEmail, viewStudent);
        const att = computeStudentAttendance(viewStudent, liveSessions, attendanceRecords);
        const courseSummary = (studentDetail?.enrolledCourses || []).find(c => String(c.courseId) === String(batch.courseId)) || studentDetail?.enrolledCourses?.[0];
        const lastSeenDate = getResolvedLastSeen(viewStudent, studentDetail, att?.sessions);
        const { primary: lastSeenPrimary, secondary: lastSeenSecondary, isOnline } = formatLastSeen(lastSeenDate);

        // Student assessment attempts for this course / general
        const allStudentAssessments = studentDetail?.assessments || [];
        const courseAttempts = allStudentAssessments.filter(a => {
          if (!a.courseName) return true;
          if (batch.courseName && a.courseName.toLowerCase().includes(batch.courseName.toLowerCase())) return true;
          if (a.courseName === 'Course Assessment' || a.courseName === 'Module Assessment') return true;
          return (studentDetail?.enrolledCourses || []).length <= 1;
        });
        const activeAssessmentsList = courseAttempts.length > 0 ? courseAttempts : allStudentAssessments;
        const totalAttemptsCount = activeAssessmentsList.length;
        const passedAttemptsCount = activeAssessmentsList.filter(a => a.passed).length;
        const avgScore = totalAttemptsCount > 0
          ? Math.round(activeAssessmentsList.reduce((acc, a) => acc + (a.percentage || 0), 0) / totalAttemptsCount)
          : null;

        // Video and lesson progress
        const overallVideoPct = Math.round(courseSummary?.progressPercent ?? viewStudent.progressPercent ?? 0);
        const completedLessonsCount = courseSummary?.completedContents ?? viewStudent.completedContents ?? 0;
        const totalLessonsCount = courseSummary?.totalContents ?? viewStudent.totalContents ?? 0;

        // Section breakdown
        const displaySections = (courseSummary?.sections && courseSummary.sections.length > 0)
          ? courseSummary.sections
          : courseSectionsList.map(sec => ({
              sectionId: sec.id,
              sectionTitle: sec.title,
              totalContents: sec.contents?.length || 0,
              completedContents: 0,
              progressPercent: 0,
              contents: sec.contents || []
            }));

        return (
          <div className="modal-backdrop" onClick={() => { setViewStudent(null); setStudentDetail(null); }}>
            <div
              className="modal-dialog"
              style={{
                maxWidth: '780px',
                width: '94vw',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: 'auto',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                className="modal-header"
                style={{
                  padding: '16px 22px',
                  borderBottom: '1px solid var(--border-default)',
                  background: 'var(--bg-card, #ffffff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(99, 102, 241, 0.12)',
                      color: 'var(--primary, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.15rem'
                    }}
                  >
                    <i className="fa-solid fa-user-graduate"></i>
                  </div>
                  <div>
                    <h2 className="modal-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      Student Course & Curriculum Profile
                    </h2>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {batch.name} ({batch.code}) • {batch.courseName}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setViewStudent(null); setStudentDetail(null); }}
                  style={{ borderRadius: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div
                className="modal-body"
                style={{
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  overflowY: 'auto'
                }}
              >
                {/* 1. Profile & Last Seen Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                    padding: '16px 18px',
                    background: 'var(--bg-surface, #f8fafc)',
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.4rem',
                        overflow: 'hidden',
                        flexShrink: 0,
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
                      }}
                    >
                      {viewStudent.profileImage || studentDetail?.profileImage ? (
                        <img
                          src={viewStudent.profileImage || studentDetail?.profileImage}
                          alt={viewStudent.studentName}
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        viewStudent.studentName ? viewStudent.studentName.charAt(0).toUpperCase() : 'S'
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{viewStudent.studentName}</span>
                        {studentDetail?.emailVerified && (
                          <span title="Email Verified" style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <i className="fa-solid fa-circle-check" style={{ color: '#10b981', fontSize: '0.9rem' }}></i>
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-all' }}>
                        {viewStudent.studentEmail}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <i className="fa-regular fa-calendar" style={{ marginRight: '4px' }}></i>
                          Enrolled: {viewStudent.enrolledAt ? new Date(viewStudent.enrolledAt).toLocaleDateString() : '—'}
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            background: sPlan?.bgColor || 'rgba(90, 112, 211, 0.1)',
                            color: sPlan?.color || '#5A70D3',
                            border: `1px solid ${sPlan?.borderColor || 'rgba(90, 112, 211, 0.2)'}`
                          }}
                        >
                          <i className={sPlan?.icon || 'fa-solid fa-layer-group'} style={{ fontSize: '0.68rem' }}></i>
                          {sPlan?.shortName || sPlan?.name || 'Full Access'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Last Seen / Active Status Badge */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: isOnline ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card, #ffffff)',
                      border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-default, #e2e8f0)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '3px',
                      minWidth: '150px',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: isOnline ? '#10b981' : '#94a3b8',
                          display: 'inline-block',
                          boxShadow: isOnline ? '0 0 0 2px rgba(16, 185, 129, 0.25)' : 'none'
                        }}
                      />
                      <span>Last Seen</span>
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: isOnline ? '#059669' : 'var(--text-primary)' }}>
                      {lastSeenPrimary}
                    </div>
                    {lastSeenSecondary && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {lastSeenSecondary}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Four Key Stats Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '12px'
                  }}
                >
                  {/* Video Progress */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(79, 70, 229, 0.02) 100%)',
                      border: '1px solid rgba(99, 102, 241, 0.18)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Video Progress</span>
                      <span style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                        <i className="fa-solid fa-play"></i>
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: overallVideoPct >= 100 ? '#10b981' : '#6366f1' }}>
                        {overallVideoPct}%
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {completedLessonsCount} / {totalLessonsCount} Lessons Done
                      </div>
                    </div>
                  </div>

                  {/* Live Attendance */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(5, 150, 105, 0.02) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.18)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Live Attendance</span>
                      <span style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                        <i className="fa-solid fa-video"></i>
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: att.totalHeld ? (att.percentage >= 75 ? '#10b981' : att.percentage >= 50 ? '#6366f1' : '#ef4444') : '#64748b' }}>
                        {att.totalHeld ? `${att.percentage}%` : 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {att.attendedCount} Present • {att.absentCount} Absent
                      </div>
                    </div>
                  </div>

                  {/* Assessment Marks */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(217, 119, 6, 0.02) 100%)',
                      border: '1px solid rgba(245, 158, 11, 0.18)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assessments</span>
                      <span style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                        <i className="fa-solid fa-award"></i>
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#d97706' }}>
                        {avgScore !== null ? `${avgScore}%` : (totalAttemptsCount > 0 ? `${passedAttemptsCount}/${totalAttemptsCount} Passed` : '—')}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {totalAttemptsCount > 0 ? `${passedAttemptsCount} of ${totalAttemptsCount} Passed` : 'No Tests Attempted'}
                      </div>
                    </div>
                  </div>

                  {/* Purchased Plan */}
                  <div
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(124, 58, 237, 0.02) 100%)',
                      border: '1px solid rgba(139, 92, 246, 0.18)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Plan Access</span>
                      <span style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                        <i className="fa-solid fa-layer-group"></i>
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sPlan?.shortName || sPlan?.name || 'Full Access'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {sPlan?.allowsLive && sPlan?.allowsRecordings ? 'Live + Videos' : sPlan?.allowsLive ? 'Live Only' : 'Recordings Only'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Navigation Tabs */}
                <div
                  style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--border-default)',
                    gap: '4px',
                    paddingBottom: '0',
                    overflowX: 'auto'
                  }}
                >
                  {[
                    { id: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
                    {
                      id: 'curriculum',
                      label: 'Curriculum & Video Progress',
                      icon: 'fa-book-open',
                      count: `${completedLessonsCount}/${totalLessonsCount}`
                    },
                    {
                      id: 'attendance',
                      label: 'Class Attendance',
                      icon: 'fa-clipboard-user',
                      count: att.totalHeld ? `${att.attendedCount}/${att.totalHeld}` : null
                    },
                    {
                      id: 'assessments',
                      label: 'Assessment Marks',
                      icon: 'fa-award',
                      count: totalAttemptsCount || (courseAssessmentsList.length > 0 ? courseAssessmentsList.length : null)
                    }
                  ].map((t) => {
                    const isActive = studentModalTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setStudentModalTab(t.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '10px 16px',
                          borderRadius: '8px 8px 0 0',
                          border: 'none',
                          borderBottom: isActive ? '3px solid var(--primary, #6366f1)' : '3px solid transparent',
                          background: isActive ? 'var(--bg-surface, #f8fafc)' : 'transparent',
                          color: isActive ? 'var(--primary, #6366f1)' : 'var(--text-secondary)',
                          fontWeight: isActive ? 800 : 600,
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <i className={`fa-solid ${t.icon}`}></i>
                        <span>{t.label}</span>
                        {t.count !== null && t.count !== undefined && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '1px 7px',
                              borderRadius: '9999px',
                              background: isActive ? 'var(--primary, #6366f1)' : 'var(--border-default, #e2e8f0)',
                              color: isActive ? '#ffffff' : 'var(--text-muted)',
                              fontWeight: 700
                            }}
                          >
                            {t.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 4. TAB CONTENTS */}
                {detailLoading ? (
                  <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--primary)' }}></i>
                    <div style={{ fontSize: '0.88rem' }}>Loading student curriculum activity…</div>
                  </div>
                ) : (
                  <>
                    {/* TAB 1: OVERVIEW */}
                    {studentModalTab === 'overview' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Batch Info Details */}
                        <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            Batch & Enrollment Specifications
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.88rem' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.76rem' }}>Course Name</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{batch.courseName}</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.76rem' }}>Batch Assigned</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{batch.name} ({batch.code})</strong>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.76rem' }}>Enrolled Timestamp</span>
                              <span style={{ color: 'var(--text-primary)' }}>
                                {viewStudent.enrolledAt ? new Date(viewStudent.enrolledAt).toLocaleString() : '—'}
                              </span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.76rem' }}>Student Status</span>
                              <span className="status-badge active" style={{ fontSize: '0.72rem' }}>Active Enrollment</span>
                            </div>
                          </div>
                        </div>

                        {/* Plan Details & Permissions */}
                        <div
                          style={{
                            padding: '16px',
                            background: sPlan?.bgColor || 'rgba(90, 112, 211, 0.05)',
                            border: `1.5px solid ${sPlan?.borderColor || 'rgba(90, 112, 211, 0.2)'}`,
                            borderRadius: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: sPlan?.color || '#5A70D3', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <i className={sPlan?.icon || 'fa-solid fa-layer-group'}></i>
                              <span>Purchased Plan Privileges</span>
                            </div>
                            <span
                              style={{
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                padding: '3px 9px',
                                borderRadius: '9999px',
                                background: sPlan?.color || '#5A70D3',
                                color: '#ffffff'
                              }}
                            >
                              {sPlan?.shortName || sPlan?.name}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '4px' }}>
                            {sPlan?.name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '10px' }}>
                            {sPlan?.description}
                          </div>
                          <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', fontWeight: 700, flexWrap: 'wrap' }}>
                            <span style={{ color: sPlan?.allowsLive ? '#0284c7' : '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className={sPlan?.allowsLive ? "fa-solid fa-check" : "fa-solid fa-xmark"} style={{ color: sPlan?.allowsLive ? '#10b981' : '#94a3b8' }}></i>
                              Live Interactive Classes & Realtime Attendance
                            </span>
                            <span style={{ color: sPlan?.allowsRecordings ? '#059669' : '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className={sPlan?.allowsRecordings ? "fa-solid fa-check" : "fa-solid fa-xmark"} style={{ color: sPlan?.allowsRecordings ? '#10b981' : '#94a3b8' }}></i>
                              Curriculum Video Lessons & Playback Recordings
                            </span>
                          </div>
                        </div>

                        {/* Recent Activity Timeline Feed */}
                        {studentDetail?.recentActivity && studentDetail.recentActivity.length > 0 && (
                          <div style={{ padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--primary)' }}></i>
                              <span>Recent Student Milestones & Activity</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {studentDetail.recentActivity.slice(0, 4).map((act, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-card, #ffffff)',
                                    border: '1px solid var(--border-subtle, #f1f5f9)'
                                  }}
                                >
                                  <span
                                    style={{
                                      width: '30px',
                                      height: '30px',
                                      borderRadius: '50%',
                                      background: act.type === 'LESSON_COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : act.type === 'ASSESSMENT' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.12)',
                                      color: act.type === 'LESSON_COMPLETED' ? '#059669' : act.type === 'ASSESSMENT' ? '#d97706' : '#6366f1',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.75rem',
                                      flexShrink: 0
                                    }}
                                  >
                                    <i className={`fa-solid ${act.icon || 'fa-bolt'}`}></i>
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {act.title}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      {act.description}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {act.timestamp ? new Date(act.timestamp).toLocaleDateString() : ''}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 2: CURRICULUM & VIDEO PROGRESS */}
                    {studentModalTab === 'curriculum' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Overall Progress Bar Card */}
                        <div style={{ padding: '18px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                              Overall Course Progress
                            </div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: overallVideoPct >= 100 ? '#10b981' : '#6366f1' }}>
                              {overallVideoPct}% Completed
                            </span>
                          </div>
                          <div style={{ height: '10px', width: '100%', background: 'var(--border-default)', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.min(100, overallVideoPct)}%`,
                                background: overallVideoPct >= 100 ? '#10b981' : '#6366f1',
                                borderRadius: '5px',
                                transition: 'width 0.4s ease'
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span>Completed: <strong>{completedLessonsCount}</strong> of <strong>{totalLessonsCount}</strong> lessons</span>
                            {courseSummary?.lastAccessedAt && (
                              <span>Last lesson access: <strong>{new Date(courseSummary.lastAccessedAt).toLocaleDateString()}</strong></span>
                            )}
                          </div>
                        </div>

                        {/* Curriculum Modules & Sections */}
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            Curriculum Sections & Video Breakdown ({displaySections.length})
                          </div>

                          {displaySections.length === 0 ? (
                            <div
                              style={{
                                textAlign: 'center',
                                padding: '36px 20px',
                                background: 'var(--bg-surface)',
                                borderRadius: '12px',
                                border: '1px dashed var(--border-default)',
                                color: 'var(--text-muted)'
                              }}
                            >
                              <i className="fa-solid fa-video-slash" style={{ fontSize: '1.8rem', marginBottom: '8px', color: '#94a3b8' }}></i>
                              <div style={{ fontWeight: 700 }}>No Video Lessons Configured</div>
                              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                                This course is delivered exclusively via interactive live sessions.
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {displaySections.map((sec, sIdx) => {
                                const secPct = Math.round(sec.progressPercent || 0);
                                return (
                                  <div
                                    key={sec.sectionId || sIdx}
                                    style={{
                                      padding: '14px 16px',
                                      borderRadius: '10px',
                                      background: 'var(--bg-card, #ffffff)',
                                      border: '1px solid var(--border-default, #e2e8f0)',
                                      boxShadow: 'var(--shadow-sm)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                        {sec.sectionTitle || `Section ${sIdx + 1}`}
                                      </div>
                                      <span
                                        style={{
                                          fontSize: '0.78rem',
                                          fontWeight: 800,
                                          color: secPct >= 100 ? '#10b981' : '#6366f1'
                                        }}
                                      >
                                        {secPct}%
                                      </span>
                                    </div>
                                    <div style={{ height: '6px', width: '100%', background: 'var(--border-default)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                                      <div
                                        style={{
                                          height: '100%',
                                          width: `${Math.min(100, secPct)}%`,
                                          background: secPct >= 100 ? '#10b981' : '#6366f1',
                                          borderRadius: '3px'
                                        }}
                                      />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                      <span>{sec.completedContents || 0} / {sec.totalContents || 0} lessons completed</span>
                                      {secPct >= 100 && (
                                        <span style={{ color: '#10b981', fontWeight: 700 }}>
                                          <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i> Completed
                                        </span>
                                      )}
                                    </div>

                                    {/* Sub-lessons list if available */}
                                    {sec.contents && sec.contents.length > 0 && (
                                      <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        {sec.contents.map((item, iIdx) => (
                                          <div
                                            key={item.id || iIdx}
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              fontSize: '0.78rem',
                                              padding: '3px 0'
                                            }}
                                          >
                                            <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                              <i className={item.type === 'video' ? 'fa-solid fa-circle-play' : item.type === 'quiz' ? 'fa-solid fa-award' : 'fa-solid fa-file-lines'} style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}></i>
                                              {item.title}
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                              {item.duration ? `${Math.round(item.duration / 60)}m` : 'Lesson'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 3: LIVE CLASS ATTENDANCE */}
                    {studentModalTab === 'attendance' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Attendance Summary Banner */}
                        <div
                          style={{
                            padding: '16px 18px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa-solid fa-clipboard-user" style={{ color: 'var(--primary)' }}></i>
                              Live Interactive Attendance
                            </div>
                            <span
                              style={{
                                fontSize: '1.1rem',
                                fontWeight: 800,
                                color: att.totalHeld ? (att.percentage >= 75 ? '#10b981' : att.percentage >= 50 ? '#6366f1' : '#ef4444') : '#64748b'
                              }}
                            >
                              {att.totalHeld ? `${att.percentage}% Overall Attendance` : 'No live sessions held yet'}
                            </span>
                          </div>

                          <div style={{ height: '8px', width: '100%', background: 'var(--border-default)', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.min(100, att.percentage || 0)}%`,
                                background: att.percentage >= 75 ? '#10b981' : att.percentage >= 50 ? '#6366f1' : '#ef4444',
                                borderRadius: '4px'
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap', gap: '8px' }}>
                            <span style={{ color: '#10b981', fontWeight: 700 }}>
                              <i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i>
                              Present: <strong>{att.attendedCount}</strong>
                            </span>
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>
                              <i className="fa-solid fa-xmark" style={{ marginRight: '4px' }}></i>
                              Absent: <strong>{att.absentCount}</strong>
                            </span>
                            <span>Total Held Sessions: <strong>{att.totalHeld}</strong></span>
                          </div>
                        </div>

                        {/* Session Attendance Log */}
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            Scheduled Live Meeting Attendance Log ({att.sessions?.length || 0})
                          </div>

                          {(!att.sessions || att.sessions.length === 0) ? (
                            <div
                              style={{
                                textAlign: 'center',
                                padding: '36px 20px',
                                background: 'var(--bg-surface)',
                                borderRadius: '12px',
                                border: '1px dashed var(--border-default)',
                                color: 'var(--text-muted)'
                              }}
                            >
                              <i className="fa-solid fa-calendar-xmark" style={{ fontSize: '1.8rem', marginBottom: '8px', color: '#94a3b8' }}></i>
                              <div style={{ fontWeight: 700 }}>No Sessions Scheduled</div>
                              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                                There are no live sessions scheduled for this batch yet.
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {att.sessions.map((ses, i) => {
                                const isPresent = ses.attendanceStatus === 'PRESENT';
                                const isUpcoming = ses.attendanceStatus === 'UPCOMING';
                                return (
                                  <div
                                    key={ses.sessionId || i}
                                    style={{
                                      padding: '12px 16px',
                                      borderRadius: '10px',
                                      background: 'var(--bg-card, #ffffff)',
                                      border: `1px solid ${isPresent ? 'rgba(16, 185, 129, 0.25)' : isUpcoming ? 'rgba(56, 189, 248, 0.25)' : 'rgba(239, 68, 68, 0.2)'}`,
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: '12px',
                                      boxShadow: 'var(--shadow-sm)'
                                    }}
                                  >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                        {ses.sessionTitle}
                                      </div>
                                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <span>
                                          <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i>
                                          {ses.scheduledAt ? new Date(ses.scheduledAt).toLocaleString() : 'Scheduled'}
                                        </span>
                                        {ses.attendedAt && (
                                          <span style={{ color: '#059669', fontWeight: 600 }}>
                                            <i className="fa-solid fa-right-to-bracket" style={{ marginRight: '4px' }}></i>
                                            Joined: {new Date(ses.attendedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span
                                        style={{
                                          fontSize: '0.74rem',
                                          fontWeight: 800,
                                          padding: '3px 10px',
                                          borderRadius: '9999px',
                                          background: isPresent ? 'rgba(16, 185, 129, 0.12)' : isUpcoming ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                          color: isPresent ? '#10b981' : isUpcoming ? '#0284c7' : '#ef4444'
                                        }}
                                      >
                                        <i className={`fa-solid ${isPresent ? 'fa-check' : isUpcoming ? 'fa-hourglass-start' : 'fa-xmark'}`} style={{ marginRight: '4px' }}></i>
                                        {isPresent ? 'Present' : isUpcoming ? 'Upcoming' : 'Absent'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 4: ASSESSMENT MARKS & ACTIVITY */}
                    {studentModalTab === 'assessments' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Assessment Marks Banner */}
                        <div
                          style={{
                            padding: '16px 18px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa-solid fa-award" style={{ color: '#d97706' }}></i>
                              Course Assessment & Quiz Scores
                            </div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#d97706' }}>
                              {avgScore !== null ? `Average Score: ${avgScore}%` : 'Tests & Quizzes'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            <span>Attempted: <strong>{totalAttemptsCount}</strong></span>
                            <span style={{ color: '#10b981', fontWeight: 700 }}>Passed: <strong>{passedAttemptsCount}</strong></span>
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>Needs Review: <strong>{Math.max(0, totalAttemptsCount - passedAttemptsCount)}</strong></span>
                          </div>
                        </div>

                        {/* List of Assessments */}
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            Curriculum Test Performance & Marks
                          </div>

                          {activeAssessmentsList.length === 0 && courseAssessmentsList.length === 0 ? (
                            <div
                              style={{
                                textAlign: 'center',
                                padding: '36px 20px',
                                background: 'var(--bg-surface)',
                                borderRadius: '12px',
                                border: '1px dashed var(--border-default)',
                                color: 'var(--text-muted)'
                              }}
                            >
                              <i className="fa-solid fa-file-circle-question" style={{ fontSize: '1.8rem', marginBottom: '8px', color: '#94a3b8' }}></i>
                              <div style={{ fontWeight: 700 }}>No Assessments Attempted</div>
                              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                                This student has not submitted any module quizzes or exams for this course yet.
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {/* 1. Show all student attempts */}
                              {activeAssessmentsList.map((a) => (
                                <div
                                  key={a.attemptId}
                                  style={{
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    background: 'var(--bg-card, #ffffff)',
                                    border: `1px solid ${a.passed ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                                    boxShadow: 'var(--shadow-sm)'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                      {a.title || 'Course Assessment'}
                                    </div>
                                    <span
                                      style={{
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        padding: '3px 10px',
                                        borderRadius: '9999px',
                                        background: a.passed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                        color: a.passed ? '#10b981' : '#ef4444'
                                      }}
                                    >
                                      {a.passed ? 'PASSED' : 'FAILED'}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.82rem', marginTop: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                      <span style={{ fontWeight: 800, color: a.passed ? '#059669' : '#dc2626', fontSize: '0.94rem' }}>
                                        Marks: {a.score != null ? a.score : Math.round((a.percentage || 0) * (a.totalMarks || 10) / 100)} / {a.totalMarks || 10}
                                      </span>
                                      <span style={{ color: 'var(--text-muted)' }}>
                                        ({Math.round(a.percentage || 0)}%)
                                      </span>
                                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '4px' }}>
                                        Pass requirement: {a.passingPercentage || 60}%
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                      <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i>
                                      {a.completedAt ? new Date(a.completedAt).toLocaleString() : (a.startedAt ? new Date(a.startedAt).toLocaleString() : '')}
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* 2. Show unattempted course assessments if any */}
                              {courseAssessmentsList
                                .filter(ca => !activeAssessmentsList.some(att => att.assessmentId === ca.id || (att.title && ca.title && att.title.toLowerCase() === ca.title.toLowerCase())))
                                .map((ca) => (
                                  <div
                                    key={`unatt-${ca.id}`}
                                    style={{
                                      padding: '12px 16px',
                                      borderRadius: '10px',
                                      background: 'var(--bg-surface, #f8fafc)',
                                      border: '1px dashed var(--border-default, #cbd5e1)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                                        {ca.title || 'Course Module Assessment'}
                                      </div>
                                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {ca.totalQuestions || 10} Questions • Pass requirement: {ca.passPercentage || 60}%
                                      </div>
                                    </div>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '9999px',
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        color: '#d97706'
                                      }}
                                    >
                                      Not Attempted
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div
                className="modal-footer"
                style={{
                  padding: '14px 22px',
                  borderTop: '1px solid var(--border-default)',
                  background: 'var(--bg-card, #ffffff)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
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

                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                  <Link
                    to={`/admin/students?search=${encodeURIComponent(viewStudent.studentEmail)}`}
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i> Full Profile
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
        );
      })()}

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
                      <th style={{ minWidth: '130px' }}>Purchased Plan</th>
                      <th style={{ textAlign: 'center' }}>Present</th>
                      <th style={{ textAlign: 'center' }}>Absent</th>
                      <th style={{ textAlign: 'center' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsWithPlan.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="table-empty">No students enrolled in this batch.</td>
                      </tr>
                    ) : (
                      studentsWithPlan.map((st, i) => {
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
                            <td>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: '9999px',
                                  background: st.resolvedPlan?.bgColor || 'rgba(90, 112, 211, 0.1)',
                                  color: st.resolvedPlan?.color || '#5A70D3',
                                  border: `1px solid ${st.resolvedPlan?.borderColor || 'rgba(90, 112, 211, 0.2)'}`,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {st.resolvedPlan?.shortName || st.resolvedPlan?.name || 'Full Access'}
                              </span>
                            </td>
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
                            <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
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
