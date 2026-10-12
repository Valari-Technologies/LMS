import { useState, useEffect, useMemo } from 'react';
import { getAdminProgress, getCategories } from '../../api/admin';

// Progress range options
const PROGRESS_RANGES = [
  { label: 'All Progress',          min: 0,   max: 100 },
  { label: 'Not Started (0%)',       min: 0,   max: 0   },
  { label: 'In Progress (1–50%)',    min: 1,   max: 50  },
  { label: 'In Progress (51–99%)',   min: 51,  max: 99  },
  { label: 'Completed (100%)',       min: 100, max: 100 },
];

function formatCourseLastSeen(timestamp) {
  if (!timestamp) return { primary: 'Never', isOnline: false };
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);

  const formattedDateTime = date.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // 25s threshold for active course player heartbeats
  if (diffSecs < 25) {
    return { primary: 'Online', isOnline: true };
  }
  return { primary: formattedDateTime, isOnline: false };
}

export default function AdminProgressPage() {
  const [progressList, setProgressList] = useState([]);
  const [categories, setCategories]     = useState([]);
  const [loading, setLoading]           = useState(true);

  // server-side filters
  const [search, setSearch]       = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // client-side progress range filter
  const [progressRange, setProgressRange] = useState(0); // index into PROGRESS_RANGES

  // Load categories once
  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  // Reload when server-side filters change with live polling
  useEffect(() => {
    loadProgress(true);
    const interval = setInterval(() => {
      loadProgress(false);
    }, 8_000);
    return () => clearInterval(interval);
  }, [search, categoryId, page]);

  async function loadProgress(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const res = await getAdminProgress({ search, categoryId: categoryId || null, page, size: 15 });
      setProgressList(res?.content || []);
      setTotalPages(res?.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  // Client-side progress range filter
  const range = PROGRESS_RANGES[progressRange];
  const filtered = useMemo(() => {
    return progressList.filter((p) => {
      const pct = Math.round(p.progressPercent || 0);
      return pct >= range.min && pct <= range.max;
    });
  }, [progressList, progressRange]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Student Learning Progress</h1>
          <p className="page-subtitle">
            Real-time analytics on curriculum completion percentages and student engagement.
          </p>
        </div>
      </div>

      <div className="table-card">
        {/* ── Single-row toolbar ──────────────────────────────────────── */}
        <div className="table-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
          {/* Left: record count */}
          <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
            Progress Records ({filtered.length})
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Category dropdown — server-side */}
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

          {/* Progress % range — client-side */}
          <select
            className="form-control"
            style={{ minWidth: '190px', maxWidth: '220px', fontSize: '0.875rem' }}
            value={progressRange}
            onChange={(e) => setProgressRange(Number(e.target.value))}
          >
            {PROGRESS_RANGES.map((r, i) => (
              <option key={i} value={i}>{r.label}</option>
            ))}
          </select>

          {/* Search box */}
          <div className="table-search" style={{ minWidth: '200px' }}>
            <input
              type="search"
              className="form-control"
              placeholder="Search student or course…"
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
                <th>Course</th>
                <th style={{ width: '25%' }}>Progress &amp; Status</th>
                <th>Completion Metric</th>
                <th>Enrolled Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="table-empty">Loading student progress…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="table-empty">No student progress records found.</td>
                </tr>
              ) : (
                filtered.map((p, idx) => {
                  const initials = p.studentName
                    ? p.studentName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                    : 'S';
                  const percent = Math.round(p.progressPercent || 0);

                  return (
                    <tr key={`${p.studentId}-${p.courseId}-${idx}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="avatar-circle" style={{ width: '34px', height: '34px', fontSize: '0.82rem' }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{p.studentName}</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{p.studentEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{p.courseName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Course #{p.courseId}</div>
                      </td>
                      <td>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <span>{percent === 100 ? 'Completed' : percent === 0 ? 'Not Started' : 'In Progress'}</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="progress-bar-wrap">
                            <div
                              className="progress-bar-fill"
                              style={{
                                width: `${percent}%`,
                                background: percent === 100
                                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                  : undefined,
                              }}
                            />
                          </div>
                          {(() => {
                            const { primary, isOnline } = formatCourseLastSeen(p.lastAccessedAt);
                            return (
                              <div
                                style={{
                                  fontSize: '0.76rem',
                                  marginTop: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontWeight: isOnline ? '700' : '500',
                                  color: isOnline ? '#10b981' : 'var(--text-muted)'
                                }}
                              >
                                <span
                                  style={{
                                    width: '7px',
                                    height: '7px',
                                    borderRadius: '50%',
                                    background: isOnline ? '#10b981' : (p.lastAccessedAt ? '#94a3b8' : '#cbd5e1'),
                                    boxShadow: isOnline ? '0 0 6px rgba(16, 185, 129, 0.7)' : 'none'
                                  }}
                                />
                                <span>Last Seen: {primary}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {p.completedContents || 0} / {p.totalContents || 0} items
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                          {new Date(p.enrolledAt).toLocaleDateString()}
                        </span>
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
                onClick={() => setPage((pr) => Math.max(0, pr - 1))}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((pr) => pr + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
