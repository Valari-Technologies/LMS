import { useState, useEffect, useMemo, Fragment } from 'react';
import { getAdminAssessmentAttempts } from '../../api/assessments';

export default function AssessmentResultsModal({ assessment, onClose }) {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [error, setError] = useState(null);

  // View Mode: 'STUDENTS' (Unique Students) | 'ATTEMPTS' (All Attempt Records)
  const [viewMode, setViewMode] = useState('STUDENTS');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PASSED' | 'FAILED' | 'IN_PROGRESS' | 'TERMINATED'
  const [sortBy, setSortBy] = useState('DATE_DESC'); // 'DATE_DESC' | 'DATE_ASC' | 'SCORE_DESC' | 'SCORE_ASC' | 'NAME_ASC'

  // Batch Filter: Default to assessment's batch if specified
  const initialBatchFilter = (assessment?.batchName && assessment.batchName !== 'All Batches')
    ? assessment.batchName
    : 'ALL';
  const [batchFilter, setBatchFilter] = useState(initialBatchFilter);

  // Expanded student IDs for accordion details
  const [expandedStudents, setExpandedStudents] = useState(new Set());

  const toggleStudentExpand = (studentId) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

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

  // List of unique batches present in the loaded attempts + assessment's batch
  const availableBatches = useMemo(() => {
    const set = new Set();
    if (assessment?.batchName && assessment.batchName !== 'All Batches') {
      set.add(assessment.batchName);
    }
    attempts.forEach(a => {
      if (a.batchName) set.add(a.batchName);
    });
    return Array.from(set);
  }, [attempts, assessment]);

  // Base batch-filtered attempts
  const batchFilteredAttempts = useMemo(() => {
    if (batchFilter === 'ALL') return attempts;
    return attempts.filter(a => {
      const studentBatch = a.batchName || '';
      return studentBatch.toLowerCase() === batchFilter.toLowerCase() ||
             (studentBatch === '' && assessment?.batchName?.toLowerCase() === batchFilter.toLowerCase());
    });
  }, [attempts, batchFilter, assessment]);

  // Aggregate Unique Students from batchFilteredAttempts
  const uniqueStudentsList = useMemo(() => {
    const studentMap = new Map();

    batchFilteredAttempts.forEach(attempt => {
      const sId = attempt.studentId || attempt.studentEmail || attempt.attemptId;
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          studentId: sId,
          studentName: attempt.studentName || 'Student',
          studentEmail: attempt.studentEmail || '',
          studentProfileImage: attempt.studentProfileImage,
          batchName: attempt.batchName || assessment?.batchName || 'Default Batch',
          totalAttempts: 0,
          attempts: [],
          bestScore: 0,
          bestMarks: 0,
          hasPassed: false,
          latestAttempt: null
        });
      }

      const entry = studentMap.get(sId);
      entry.totalAttempts += 1;
      entry.attempts.push(attempt);

      if (attempt.percentage > entry.bestScore) {
        entry.bestScore = attempt.percentage;
        entry.bestMarks = attempt.obtainedMarks;
      }
      if (attempt.passed) {
        entry.hasPassed = true;
      }
    });

    // Sort individual attempts by startedAt desc and set latestAttempt
    studentMap.forEach(entry => {
      entry.attempts.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
      entry.latestAttempt = entry.attempts[0] || null;
    });

    return Array.from(studentMap.values());
  }, [batchFilteredAttempts, assessment]);

  // Metrics computed over batchFilteredAttempts
  const metrics = useMemo(() => {
    const totalAttempts = batchFilteredAttempts.length;
    const uniqueStudents = uniqueStudentsList.length;
    const passedStudentsCount = uniqueStudentsList.filter(s => s.hasPassed).length;
    const passRate = uniqueStudents > 0 ? Math.round((passedStudentsCount / uniqueStudents) * 100) : 0;

    const completedAttempts = batchFilteredAttempts.filter(a => a.status === 'COMPLETED' || a.status === 'FAILED');
    const sumPercentage = completedAttempts.reduce((acc, a) => acc + (a.percentage || 0), 0);
    const avgPercentage = completedAttempts.length ? Math.round(sumPercentage / completedAttempts.length) : 0;
    const highestScore = uniqueStudentsList.reduce((max, s) => Math.max(max, s.bestScore || 0), 0);

    return {
      totalAttempts,
      uniqueStudents,
      passedStudentsCount,
      passRate,
      avgPercentage,
      highestScore
    };
  }, [batchFilteredAttempts, uniqueStudentsList]);

  // Filtered Unique Students List (for 'STUDENTS' view)
  const filteredStudents = useMemo(() => {
    return uniqueStudentsList
      .filter(s => {
        if (statusFilter === 'PASSED') return s.hasPassed;
        if (statusFilter === 'FAILED') return !s.hasPassed && s.latestAttempt?.status !== 'IN_PROGRESS';
        if (statusFilter === 'IN_PROGRESS') return s.latestAttempt?.status === 'IN_PROGRESS';
        if (statusFilter === 'TERMINATED') return s.latestAttempt?.status === 'TERMINATED';
        return true;
      })
      .filter(s => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (s.studentName && s.studentName.toLowerCase().includes(q)) ||
          (s.studentEmail && s.studentEmail.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'DATE_DESC') {
          return new Date(b.latestAttempt?.startedAt || 0) - new Date(a.latestAttempt?.startedAt || 0);
        }
        if (sortBy === 'DATE_ASC') {
          return new Date(a.latestAttempt?.startedAt || 0) - new Date(b.latestAttempt?.startedAt || 0);
        }
        if (sortBy === 'SCORE_DESC') {
          return (b.bestScore || 0) - (a.bestScore || 0);
        }
        if (sortBy === 'SCORE_ASC') {
          return (a.bestScore || 0) - (b.bestScore || 0);
        }
        if (sortBy === 'NAME_ASC') {
          return (a.studentName || '').localeCompare(b.studentName || '');
        }
        return 0;
      });
  }, [uniqueStudentsList, statusFilter, searchQuery, sortBy]);

  // Filtered All Attempts List (for 'ATTEMPTS' view)
  const filteredAttempts = useMemo(() => {
    return batchFilteredAttempts
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
  }, [batchFilteredAttempts, statusFilter, searchQuery, sortBy]);

  // Format Helpers
  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

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

  const getInitial = (name) => {
    if (!name) return 'S';
    return name.trim().charAt(0).toUpperCase();
  };

  // CSV Export
  const handleExportCsv = () => {
    if (!batchFilteredAttempts.length) return;
    const headers = [
      'Student Name',
      'Student Email',
      'Batch',
      'Attempt #',
      'Status',
      'Passed',
      'Marks Obtained',
      'Total Questions',
      'Percentage (%)',
      'Started At',
      'Submitted At',
      'Duration (seconds)',
      'Terminated Reason'
    ];
    const rows = batchFilteredAttempts.map(a => [
      `"${(a.studentName || '').replace(/"/g, '""')}"`,
      `"${(a.studentEmail || '').replace(/"/g, '""')}"`,
      `"${(a.batchName || assessment?.batchName || '').replace(/"/g, '""')}"`,
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
    link.setAttribute('download', `${safeTitle}_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      <style>{`
        /* Smooth, visible scrollbar */
        .results-modal-scrollable::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .results-modal-scrollable::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .results-modal-scrollable::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .results-modal-scrollable::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1150px',
        height: '92vh',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden'
      }}>
        {/* Header Bar */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexShrink: 0,
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
                  background: 'rgba(168, 85, 247, 0.25)',
                  color: '#d8b4fe',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(168, 85, 247, 0.4)'
                }}>
                  <i className="fa-solid fa-users-rectangle" style={{ marginRight: '4px' }}></i>
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

            {batchFilteredAttempts.length > 0 && (
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

        {/* Content Body: MUST have minHeight: 0 and overflowY: 'auto' so flexbox scrolls cleanly */}
        <div
          className="results-modal-scrollable"
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {/* Quick Metrics Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            {/* Card 1: Unique Students */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
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
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Students Attended
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
                  {metrics.uniqueStudents}
                </div>
              </div>
            </div>

            {/* Card 2: Total Attempts */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
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
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Total Attempts
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
                  {metrics.totalAttempts}
                </div>
              </div>
            </div>

            {/* Card 3: Passed Students */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
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
                <div style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>
                  Passed Students
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#15803d' }}>
                  {metrics.passedStudentsCount} <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#166534' }}>({metrics.passRate}%)</span>
                </div>
              </div>
            </div>

            {/* Card 4: Avg Score */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
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
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Average Score
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
                  {metrics.avgPercentage}%
                </div>
              </div>
            </div>
          </div>

          {/* Controls Bar: View Toggle, Batch Filter, Search & Status */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            background: '#ffffff',
            padding: '2px 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
              {/* View Toggle: Group by Student vs All Attempts */}
              <div style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                borderRadius: '8px',
                padding: '3px',
                border: '1px solid #e2e8f0'
              }}>
                <button
                  type="button"
                  onClick={() => setViewMode('STUDENTS')}
                  style={{
                    border: 'none',
                    background: viewMode === 'STUDENTS' ? '#ffffff' : 'transparent',
                    color: viewMode === 'STUDENTS' ? '#0f172a' : '#64748b',
                    fontWeight: viewMode === 'STUDENTS' ? 800 : 600,
                    fontSize: '0.8rem',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: viewMode === 'STUDENTS' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="fa-solid fa-user-check"></i>
                  By Student ({metrics.uniqueStudents})
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('ATTEMPTS')}
                  style={{
                    border: 'none',
                    background: viewMode === 'ATTEMPTS' ? '#ffffff' : 'transparent',
                    color: viewMode === 'ATTEMPTS' ? '#0f172a' : '#64748b',
                    fontWeight: viewMode === 'ATTEMPTS' ? 800 : 600,
                    fontSize: '0.8rem',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: viewMode === 'ATTEMPTS' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <i className="fa-solid fa-list-ol"></i>
                  All Attempts ({metrics.totalAttempts})
                </button>
              </div>

              {/* Batch Filter Dropdown */}
              <select
                value={batchFilter}
                onChange={e => setBatchFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 700
                }}
                title="Filter by enrolled batch"
              >
                <option value="ALL">All Batches</option>
                {availableBatches.map(b => (
                  <option key={b} value={b}>Only {b} Students</option>
                ))}
              </select>

              {/* Search Query */}
              <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '320px' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search student name or email..."
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
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
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 600
                }}
              >
                <option value="ALL">All Status</option>
                <option value="PASSED">Passed</option>
                <option value="FAILED">Failed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Sort:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  background: '#ffffff',
                  color: '#334155',
                  fontWeight: 600
                }}
              >
                <option value="DATE_DESC">Latest Attempt</option>
                <option value="DATE_ASC">Oldest Attempt</option>
                <option value="SCORE_DESC">Highest Score</option>
                <option value="SCORE_ASC">Lowest Score</option>
                <option value="NAME_ASC">Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Main Table Container: Scrollable with sticky header */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            background: '#ffffff',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.02)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div
              className="results-modal-scrollable"
              style={{
                overflowX: 'auto',
                overflowY: 'auto',
                maxHeight: '440px'
              }}
            >
              {loading ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#0284c7' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginBottom: '10px', display: 'block' }}></i>
                  <span>Loading assessment results...</span>
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
              ) : (viewMode === 'STUDENTS' ? filteredStudents.length === 0 : filteredAttempts.length === 0) ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                  <i className="fa-regular fa-clipboard" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '10px', display: 'block' }}></i>
                  <h4 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>
                    {attempts.length === 0
                      ? 'No Student Attempts Yet'
                      : `No Students Found for ${batchFilter !== 'ALL' ? batchFilter : 'selected filters'}`}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    {attempts.length === 0
                      ? 'When students enrolled in this course batch attend this assessment, their scores and marks will be recorded here.'
                      : 'Try changing the batch filter or search term to see other student results.'}
                  </p>
                </div>
              ) : viewMode === 'STUDENTS' ? (
                /* ========================================================
                   VIEW 1: UNIQUE STUDENTS VIEW (1 Row Per Student)
                   ======================================================== */
                <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{
                      background: '#f8fafc',
                      borderBottom: '2px solid #e2e8f0',
                      color: '#475569',
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10
                    }}>
                      <th style={{ padding: '12px 16px', background: '#f8fafc', minWidth: '220px', width: '22%', verticalAlign: 'middle' }}>Student</th>
                      <th style={{ padding: '12px 16px', background: '#f8fafc', textAlign: 'center', minWidth: '120px', width: '12%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Batch</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', background: '#f8fafc', minWidth: '110px', width: '11%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Attempts</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', background: '#f8fafc', minWidth: '120px', width: '12%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Latest Marks</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', background: '#f8fafc', minWidth: '100px', width: '10%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Best Score</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', background: '#f8fafc', minWidth: '130px', width: '13%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Overall Status</th>
                      <th style={{ padding: '12px 16px', background: '#f8fafc', minWidth: '160px', width: '15%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Last Attended</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', background: '#f8fafc', minWidth: '110px', width: '11%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((item) => {
                      const isExpanded = expandedStudents.has(item.studentId);
                      const latest = item.latestAttempt || {};
                      const isPassed = item.hasPassed;
                      const isInProgress = latest.status === 'IN_PROGRESS';
                      const isTerminated = latest.status === 'TERMINATED';

                      return (
                        <Fragment key={item.studentId}>
                          <tr
                            style={{
                              borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                              background: isExpanded ? '#f8fafc' : 'transparent',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#fafafa'; }}
                            onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                          >
                            {/* Student Info */}
                            <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {item.studentProfileImage ? (
                                  <img
                                    src={item.studentProfileImage}
                                    alt={item.studentName}
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
                                    {getInitial(item.studentName)}
                                  </div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                                    {item.studentName}
                                  </div>
                                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                    {item.studentEmail}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Batch Pill */}
                            <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: '#ede9fe',
                                color: '#6d28d9',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                whiteSpace: 'nowrap'
                              }}>
                                <i className="fa-solid fa-users-rectangle"></i>
                                {item.batchName}
                              </span>
                            </td>

                            {/* Attempts Count Badge */}
                            <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                background: '#f1f5f9',
                                color: '#334155',
                                fontWeight: 800,
                                fontSize: '0.8rem',
                                whiteSpace: 'nowrap'
                              }}>
                                {item.totalAttempts} {item.totalAttempts === 1 ? 'attempt' : 'attempts'}
                              </span>
                            </td>

                            {/* Latest Marks */}
                            <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  fontWeight: 900,
                                  fontSize: '0.98rem',
                                  color: isPassed ? '#16a34a' : (isTerminated ? '#d97706' : '#dc2626')
                                }}>
                                  {latest.obtainedMarks ?? 0}
                                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>
                                    {' '}/ {latest.totalQuestions || 0}
                                  </span>
                                </span>
                                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                  ({latest.percentage ?? 0}%)
                                </span>
                              </div>
                            </td>

                            {/* Best Score */}
                            <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <span style={{
                                fontWeight: 800,
                                fontSize: '0.92rem',
                                color: item.bestScore >= (assessment.passPercentage || 60) ? '#16a34a' : '#d97706',
                                whiteSpace: 'nowrap'
                              }}>
                                {item.bestScore}%
                              </span>
                            </td>

                            {/* Status */}
                            <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
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
                                  fontSize: '0.74rem',
                                  whiteSpace: 'nowrap'
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
                                  fontSize: '0.74rem',
                                  whiteSpace: 'nowrap'
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
                                  fontSize: '0.74rem',
                                  whiteSpace: 'nowrap'
                                }} title={`Terminated: ${latest.terminatedReason || 'Policy Violation'}`}>
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
                                  fontSize: '0.74rem',
                                  whiteSpace: 'nowrap'
                                }}>
                                  <i className="fa-solid fa-xmark"></i> Failed
                                </span>
                              )}
                            </td>

                            {/* Last Attended */}
                            <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {formatTimestamp(latest.startedAt)}
                              </div>
                            </td>

                            {/* Expand History Action */}
                            <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => toggleStudentExpand(item.studentId)}
                                className="btn btn-sm"
                                style={{
                                  background: isExpanded ? '#0284c7' : '#ffffff',
                                  color: isExpanded ? '#ffffff' : '#0284c7',
                                  border: '1px solid #bae6fd',
                                  fontWeight: 700,
                                  fontSize: '0.76rem',
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  whiteSpace: 'nowrap'
                                }}
                                title="View individual attempt breakdown"
                              >
                                <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                                <span>{isExpanded ? 'Hide' : `${item.totalAttempts} ${item.totalAttempts === 1 ? 'Attempt' : 'Attempts'}`}</span>
                              </button>
                            </td>
                          </tr>

                          {/* Accordion: Nested Attempt Rows */}
                          {isExpanded && (
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <td colSpan="8" style={{ padding: '12px 20px 16px 40px' }}>
                                <div style={{
                                  background: '#ffffff',
                                  borderRadius: '10px',
                                  border: '1px solid #e2e8f0',
                                  overflow: 'hidden'
                                }}>
                                  <div style={{
                                    padding: '8px 14px',
                                    background: '#f1f5f9',
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                    color: '#475569',
                                    borderBottom: '1px solid #e2e8f0'
                                  }}>
                                    Attempt History for {item.studentName}
                                  </div>
                                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                                        <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>Attempt #</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Marks</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Score</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>Status</th>
                                        <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>Started At</th>
                                        <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>Duration</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.attempts.map((att) => (
                                        <tr key={att.attemptId} style={{ borderBottom: '1px solid #f8fafc' }}>
                                          <td style={{ padding: '8px 12px', fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                            #{att.attemptNumber}
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                            {att.obtainedMarks} / {att.totalQuestions}
                                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 'normal', marginLeft: '4px' }}>
                                              ({att.correctAnswers} correct)
                                            </span>
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: att.passed ? '#16a34a' : '#ef4444', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                            {att.percentage}%
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                            <span style={{
                                              padding: '2px 8px',
                                              borderRadius: '4px',
                                              fontSize: '0.72rem',
                                              fontWeight: 700,
                                              whiteSpace: 'nowrap',
                                              background: att.passed ? '#dcfce7' : (att.status === 'TERMINATED' ? '#fef3c7' : '#fee2e2'),
                                              color: att.passed ? '#15803d' : (att.status === 'TERMINATED' ? '#b45309' : '#dc2626')
                                            }}>
                                              {att.status} {att.terminatedReason ? `(${att.terminatedReason})` : ''}
                                            </span>
                                          </td>
                                          <td style={{ padding: '8px 12px', color: '#475569', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                            {formatTimestamp(att.startedAt)}
                                          </td>
                                          <td style={{ padding: '8px 12px', color: '#475569', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                            {formatDuration(att.durationSeconds)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                /* ========================================================
                   VIEW 2: ALL ATTEMPTS LOG (Every Attempt Record)
                   ======================================================== */
                <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{
                      background: '#f8fafc',
                      borderBottom: '2px solid #e2e8f0',
                      color: '#475569',
                      fontSize: '0.78rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10
                    }}>
                      <th style={{ padding: '12px 16px', background: '#f8fafc', minWidth: '220px', width: '24%', verticalAlign: 'middle' }}>Student</th>
                      <th style={{ padding: '12px 16px', background: '#f8fafc', textAlign: 'center', minWidth: '120px', width: '12%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Batch</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', background: '#f8fafc', minWidth: '90px', width: '9%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Attempt</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', background: '#f8fafc', minWidth: '130px', width: '14%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Marks Obtained</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', background: '#f8fafc', minWidth: '110px', width: '11%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Score (%)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', background: '#f8fafc', minWidth: '130px', width: '13%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Status</th>
                      <th style={{ padding: '12px 16px', background: '#f8fafc', minWidth: '170px', width: '17%', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Time & Duration</th>
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
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
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
                                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                  {attempt.studentEmail}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Batch Pill */}
                          <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: '#ede9fe',
                              color: '#6d28d9',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              whiteSpace: 'nowrap'
                            }}>
                              <i className="fa-solid fa-users-rectangle"></i>
                              {attempt.batchName || assessment?.batchName || 'Default Batch'}
                            </span>
                          </td>

                          {/* Attempt Number */}
                          <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: '#475569',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              whiteSpace: 'nowrap'
                            }}>
                              #{attempt.attemptNumber}
                            </span>
                          </td>

                          {/* Marks Obtained */}
                          <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap' }}>
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
                          <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
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
                          <td style={{ padding: '12px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
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
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap'
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
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap'
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
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap'
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
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap'
                              }}>
                                <i className="fa-solid fa-xmark"></i> Failed
                              </span>
                            )}
                          </td>

                          {/* Time & Duration */}
                          <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {formatTimestamp(attempt.startedAt)}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                              Duration: <strong style={{ color: '#334155' }}>{formatDuration(attempt.durationSeconds)}</strong>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            {viewMode === 'STUDENTS' ? (
              <>Showing <strong>{filteredStudents.length}</strong> unique students ({metrics.totalAttempts} total attempts recorded)</>
            ) : (
              <>Showing <strong>{filteredAttempts.length}</strong> of <strong>{metrics.totalAttempts}</strong> attempts</>
            )}
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
