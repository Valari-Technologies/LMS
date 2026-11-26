import { useState, useEffect, useMemo } from 'react';
import { getAdminAssessmentAttempts } from '../../api/assessments';

export default function AssessmentResultsModal({ assessment, onClose }) {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PASSED' | 'FAILED' | 'IN_PROGRESS' | 'TERMINATED'
  const [sortBy, setSortBy] = useState('DATE_DESC'); // 'DATE_DESC' | 'DATE_ASC' | 'SCORE_DESC' | 'SCORE_ASC' | 'NAME_ASC'

  const fetchAttempts = async () => {
    if (!assessment?.contentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminAssessmentAttempts(assessment.contentId);
      setAttempts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load assessment attempts:', err);
      setError('Could not load student attempts. Please check connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, [assessment?.contentId]);

  // Derived Analytics & Metrics
  const metrics = useMemo(() => {
    if (!attempts.length) {
      return {
        totalAttempts: 0,
        uniqueStudents: 0,
        passedCount: 0,
        failedCount: 0,
        inProgressCount: 0,
        terminatedCount: 0,
        passRate: 0,
        avgPercentage: 0,
        highestScore: 0,
        totalQuestions: assessment?.questionsCount || 0
      };
    }

    const uniqueStudentIds = new Set(attempts.map(a => a.studentId));
    const completedAttempts = attempts.filter(a => a.status === 'COMPLETED' || a.status === 'FAILED');
    const passedAttempts = attempts.filter(a => a.passed);
    const failedAttempts = attempts.filter(a => !a.passed && (a.status === 'COMPLETED' || a.status === 'FAILED'));
    const inProgress = attempts.filter(a => a.status === 'IN_PROGRESS');
    const terminated = attempts.filter(a => a.status === 'TERMINATED');

    const sumPercentage = completedAttempts.reduce((acc, a) => acc + (a.percentage || 0), 0);
    const avgPercentage = completedAttempts.length ? Math.round(sumPercentage / completedAttempts.length) : 0;
    const highestScore = attempts.reduce((max, a) => Math.max(max, a.percentage || 0), 0);
    const passRate = completedAttempts.length ? Math.round((passedAttempts.length / completedAttempts.length) * 100) : 0;
    const maxQuestions = attempts.reduce((max, a) => Math.max(max, a.totalQuestions || 0), 0);

    return {
      totalAttempts: attempts.length,
      uniqueStudents: uniqueStudentIds.size,
      passedCount: passedAttempts.length,
      failedCount: failedAttempts.length,
      inProgressCount: inProgress.length,
      terminatedCount: terminated.length,
      passRate,
      avgPercentage,
      highestScore,
      totalQuestions: maxQuestions || assessment?.questionsCount || 0
    };
  }, [attempts, assessment]);

  // Filtered & Sorted list
  const filteredAttempts = useMemo(() => {
    return attempts
      .filter(a => {
        if (statusFilter === 'PASSED') return a.passed;
        if (statusFilter === 'FAILED') return !a.passed && (a.status === 'COMPLETED' || a.status === 'FAILED');
        if (statusFilter === 'IN_PROGRESS') return a.status === 'IN_PROGRESS';
        if (statusFilter === 'TERMINATED') return a.status === 'TERMINATED';
        return true;
      })
      .filter(a => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (a.studentName && a.studentName.toLowerCase().includes(q)) ||
          (a.studentEmail && a.studentEmail.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'DATE_DESC') {
          return new Date(b.startedAt || 0) - new Date(a.startedAt || 0);
        }
        if (sortBy === 'DATE_ASC') {
          return new Date(a.startedAt || 0) - new Date(b.startedAt || 0);
        }
        if (sortBy === 'SCORE_DESC') {
          return (b.percentage || 0) - (a.percentage || 0);
        }
        if (sortBy === 'SCORE_ASC') {
          return (a.percentage || 0) - (b.percentage || 0);
        }
        if (sortBy === 'NAME_ASC') {
          return (a.studentName || '').localeCompare(b.studentName || '');
        }
        return 0;
      });
  }, [attempts, statusFilter, searchQuery, sortBy]);

  // Format Helper: Duration
  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Format Helper: Timestamp
  const formatTimestamp = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    if (!filteredAttempts.length) return;
    const headers = ['Attempt ID', 'Student Name', 'Student Email', 'Attempt #', 'Status', 'Passed', 'Marks Obtained', 'Total Questions', 'Percentage (%)', 'Started At', 'Submitted At', 'Duration (seconds)', 'Terminated Reason'];
    const rows = filteredAttempts.map(a => [
      a.attemptId,
      `"${(a.studentName || '').replace(/"/g, '""')}"`,
      `"${(a.studentEmail || '').replace(/"/g, '""')}"`,
      a.attemptNumber,
      a.status,
      a.passed ? 'YES' : 'NO',
      a.obtainedMarks,
      a.totalQuestions,
      a.percentage,
      a.startedAt ? new Date(a.startedAt).toISOString() : '',
      a.submittedAt ? new Date(a.submittedAt).toISOString() : '',
      a.durationSeconds || '',
      a.terminatedReason || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeTitle = (assessment?.title || 'assessment').replace(/[^a-z0-9_-]/gi, '_');
    link.setAttribute('download', `${safeTitle}_student_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper avatar initial
  const getInitial = (name) => {
    if (!name) return 'S';
    return name.trim().charAt(0).toUpperCase();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1100px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header Bar */}
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          borderBottom: '1px solid #334155'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{
                background: 'rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                {assessment.courseName || 'Course'}
              </span>
              {assessment.batchName && (
                <span style={{
                  background: 'rgba(168, 85, 247, 0.2)',
                  color: '#c084fc',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  {assessment.batchName}
                </span>
              )}
              <span style={{
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                Pass Target: {assessment.passPercentage || 60}%
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-graduation-cap" style={{ color: '#38bdf8' }}></i>
              {assessment.title || 'Student Assessment Results'}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={fetchAttempts}
              disabled={loading}
              className="btn btn-sm"
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                fontSize: '0.82rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              title="Refresh results"
            >
              <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
              <span className="mobile-hide">Refresh</span>
            </button>

            {attempts.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="btn btn-sm"
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                title="Download CSV report"
              >
                <i className="fa-solid fa-download"></i>
                <span className="mobile-hide">Export CSV</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#94a3b8',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.1rem',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
              title="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Quick Metrics Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px'
          }}>
            {/* Card 1: Unique Students */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0
              }}>
                <i className="fa-solid fa-users"></i>
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Students Attended
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>
                  {metrics.uniqueStudents}
                </div>
              </div>
            </div>

            {/* Card 2: Total Attempts */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#ede9fe',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0
              }}>
                <i className="fa-solid fa-list-check"></i>
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Attempts
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>
                  {metrics.totalAttempts}
                </div>
              </div>
            </div>

            {/* Card 3: Passed Students */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0
              }}>
                <i className="fa-solid fa-circle-check"></i>
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>
                  Passed ({metrics.passRate}%)
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#15803d' }}>
                  {metrics.passedCount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>/ {metrics.totalAttempts}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Avg Score */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                flexShrink: 0
              }}>
                <i className="fa-solid fa-chart-pie"></i>
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Average Score
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>
                  {metrics.avgPercentage}%
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Search Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: '#ffffff',
            padding: '4px 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search student name or email..."
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 600
                }}
              >
                <option value="ALL">All Status ({attempts.length})</option>
                <option value="PASSED">Passed ({metrics.passedCount})</option>
                <option value="FAILED">Failed ({metrics.failedCount})</option>
                {metrics.inProgressCount > 0 && <option value="IN_PROGRESS">In Progress ({metrics.inProgressCount})</option>}
                {metrics.terminatedCount > 0 && <option value="TERMINATED">Terminated ({metrics.terminatedCount})</option>}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Sort by:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 600
                }}
              >
                <option value="DATE_DESC">Latest Attempt First</option>
                <option value="DATE_ASC">Oldest Attempt First</option>
                <option value="SCORE_DESC">Highest Score First</option>
                <option value="SCORE_ASC">Lowest Score First</option>
                <option value="NAME_ASC">Student Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#ffffff',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.02)'
          }}>
            {loading ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#0284c7' }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block' }}></i>
                <span>Loading student attempts...</span>
              </div>
            ) : error ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444' }}>
                <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '2rem', marginBottom: '8px', display: 'block' }}></i>
                <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
                <button
                  type="button"
                  onClick={fetchAttempts}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '12px' }}
                >
                  Retry
                </button>
              </div>
            ) : filteredAttempts.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                <i className="fa-regular fa-clipboard" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '10px', display: 'block' }}></i>
                <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>
                  {attempts.length === 0 ? 'No Student Attempts Yet' : 'No Matching Attempts Found'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  {attempts.length === 0
                    ? 'When students enrolled in this course batch attend this assessment, their scores and marks will be recorded here.'
                    : 'Try clearing your search query or status filter to see all attempts.'}
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <th style={{ padding: '12px 16px' }}>Student</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Attempt</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Marks Obtained</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Score (%)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Time & Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttempts.map((attempt) => {
                      const isPassed = attempt.passed;
                      const isInProgress = attempt.status === 'IN_PROGRESS';
                      const isTerminated = attempt.status === 'TERMINATED';

                      return (
                        <tr
                          key={attempt.attemptId}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {/* Student Info */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {attempt.studentProfileImage ? (
                                <img
                                  src={attempt.studentProfileImage}
                                  alt={attempt.studentName}
                                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '50%',
                                  background: '#e0f2fe',
                                  color: '#0284c7',
                                  fontWeight: 800,
                                  fontSize: '0.9rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {getInitial(attempt.studentName)}
                                </div>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                                  {attempt.studentName || 'Student'}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                  {attempt.studentEmail}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Attempt Number */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: '#475569',
                              fontWeight: 700,
                              fontSize: '0.8rem'
                            }}>
                              #{attempt.attemptNumber}
                            </span>
                          </td>

                          {/* Marks Obtained */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                              <span style={{
                                fontWeight: 900,
                                fontSize: '1.05rem',
                                color: isPassed ? '#16a34a' : (isTerminated ? '#d97706' : '#dc2626')
                              }}>
                                {attempt.obtainedMarks}
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
                                  {' '}/ {attempt.totalQuestions}
                                </span>
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                ({attempt.correctAnswers} correct, {attempt.wrongAnswers} wrong)
                              </span>
                            </div>
                          </td>

                          {/* Percentage Badge */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{
                                width: '60px',
                                height: '6px',
                                background: '#e2e8f0',
                                borderRadius: '3px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${Math.min(100, Math.max(0, attempt.percentage))}%`,
                                  height: '100%',
                                  background: isPassed ? '#16a34a' : '#ef4444'
                                }}></div>
                              </div>
                              <span style={{
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                color: isPassed ? '#15803d' : '#b91c1c'
                              }}>
                                {attempt.percentage}%
                              </span>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {isPassed ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                background: '#dcfce7',
                                color: '#16a34a',
                                fontWeight: 800,
                                fontSize: '0.75rem'
                              }}>
                                <i className="fa-solid fa-check"></i> Passed
                              </span>
                            ) : isInProgress ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                background: '#e0f2fe',
                                color: '#0284c7',
                                fontWeight: 800,
                                fontSize: '0.75rem'
                              }}>
                                <i className="fa-solid fa-clock"></i> In Progress
                              </span>
                            ) : isTerminated ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                background: '#fef3c7',
                                color: '#b45309',
                                fontWeight: 800,
                                fontSize: '0.75rem'
                              }} title={`Terminated due to: ${attempt.terminatedReason || 'Policy Violation'}`}>
                                <i className="fa-solid fa-triangle-exclamation"></i> Terminated
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '9999px',
                                background: '#fee2e2',
                                color: '#dc2626',
                                fontWeight: 800,
                                fontSize: '0.75rem'
                              }}>
                                <i className="fa-solid fa-xmark"></i> Failed
                              </span>
                            )}
                          </td>

                          {/* Time & Duration */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 600 }}>
                              {formatTimestamp(attempt.startedAt)}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                              Duration: <strong style={{ color: '#334155' }}>{formatDuration(attempt.durationSeconds)}</strong>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Showing <strong>{filteredAttempts.length}</strong> of <strong>{attempts.length}</strong> attempts
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontWeight: 700, padding: '7px 18px', borderRadius: '8px', fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
