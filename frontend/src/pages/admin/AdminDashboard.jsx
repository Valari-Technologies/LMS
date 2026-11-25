import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getDashboardStats } from '../../api/admin';

import ContentCreatorDashboard from './ContentCreatorDashboard';

function AnimatedNumber({ value, duration = 1000, suffix = '', prefix = '' }) {
  const [displayValue, setDisplayValue] = useState(0);
  const target = typeof value === 'number'
    ? value
    : (typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) || 0 : 0);

  useEffect(() => {
    if (!target || target === 0) {
      setDisplayValue(0);
      return;
    }

    let startTimestamp = null;
    let animationFrameId;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth ease-out cubic curve
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(easeOut * target);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(target);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [target, duration]);

  return <>{prefix}{displayValue.toLocaleString()}{suffix}</>;
}

function AnimatedDonutChart({ data, total, centerValue, centerLabel }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const radius = 52;
  const strokeWidth = 18;
  const hoverStrokeWidth = 22;
  const center = 75;
  const circumference = 2 * Math.PI * radius; // ~326.726

  let cumulative = 0;
  const slices = (data || []).map((item, idx) => {
    const val = Number(item.value) || 0;
    const fraction = total > 0 ? val / total : 0;
    const length = fraction * circumference;
    const offset = cumulative;
    cumulative += length;
    return {
      ...item,
      fraction,
      percentage: total > 0 ? Math.round(fraction * 100) : 0,
      length,
      offset,
      idx
    };
  });

  const activeItem = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: '150px', height: '150px', flexShrink: 0, margin: '0 auto' }}>
        <svg
          viewBox="0 0 150 150"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'visible',
            transform: 'rotate(-90deg)',
            animation: 'donutSpinIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          {/* Background subtle ring track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="var(--border-subtle, #e2e8f0)"
            strokeWidth={strokeWidth}
          />
          {total === 0 ? (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke="#cbd5e1"
              strokeWidth={strokeWidth}
              strokeDasharray="4 4"
            />
          ) : (
            slices.map((slice, i) => {
              if (slice.length <= 0) return null;
              const isHovered = hoveredIdx === i;
              return (
                <circle
                  key={slice.label || i}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={isHovered ? hoverStrokeWidth : strokeWidth}
                  strokeDasharray={`${slice.length} ${circumference}`}
                  strokeDashoffset={-slice.offset}
                  strokeLinecap={slices.filter(s => s.length > 0).length === 1 ? 'round' : 'butt'}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={{
                    transition: 'stroke-width 0.25s ease, opacity 0.2s ease, filter 0.25s ease',
                    opacity: hoveredIdx !== null && !isHovered ? 0.5 : 1,
                    filter: isHovered ? `drop-shadow(0 0 6px ${slice.color}88)` : 'none',
                    cursor: 'pointer'
                  }}
                />
              );
            })
          )}
        </svg>

        {/* Center label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: '10px'
          }}
        >
          <span
            style={{
              fontSize: '1.45rem',
              fontWeight: '800',
              lineHeight: 1.1,
              color: activeItem ? activeItem.color : 'var(--text-primary)',
              transition: 'color 0.2s ease, transform 0.2s ease',
              transform: activeItem ? 'scale(1.08)' : 'scale(1)'
            }}
          >
            {activeItem ? (
              `${activeItem.percentage}%`
            ) : typeof centerValue === 'number' ? (
              <AnimatedNumber value={centerValue} />
            ) : typeof centerValue === 'string' && centerValue.endsWith('%') ? (
              <AnimatedNumber value={parseInt(centerValue, 10) || 0} suffix="%" />
            ) : (
              centerValue
            )}
          </span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginTop: '3px',
              maxWidth: '90px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {activeItem ? activeItem.label : centerLabel}
          </span>
        </div>
      </div>

      {/* Legend & Breakdown */}
      <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {slices.map((slice, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={slice.label || i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md, 8px)',
                background: isHovered ? 'var(--bg-surface, rgba(90, 112, 211, 0.08))' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: isHovered ? 'translateX(4px)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: slice.color,
                    flexShrink: 0,
                    boxShadow: isHovered ? `0 0 8px ${slice.color}` : 'none',
                    transition: 'box-shadow 0.2s ease'
                  }}
                />
                <span
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: isHovered ? '700' : '500',
                    color: 'var(--text-primary)'
                  }}
                >
                  {slice.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: '800', color: slice.color }}>
                  <AnimatedNumber value={slice.value} />
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', minWidth: '36px', textAlign: 'right' }}>
                  (<AnimatedNumber value={slice.percentage} suffix="%" />)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const isCreator = user?.role === 'content_creator' || user?.role === 'creator';
  if (isCreator) {
    return <ContentCreatorDashboard />;
  }

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeChartTab, setActiveChartTab] = useState('doubts');

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const portals = [
    { to: '/admin/doubts', icon: <i className="fa-solid fa-circle-question" style={{ color: '#6d28d9' }}></i>, title: 'Doubt Clearance Desk', desc: 'Review, answer, and manage all student doubts asked across courses.' },
    { to: '/admin/courses', icon: <i className="fa-solid fa-book-open"></i>, title: 'Courses Manager', desc: 'Create, edit, duplicate, version, publish, and preview curricula.' },
    { to: '/admin/categories', icon: <i className="fa-solid fa-tags"></i>, title: 'Categories', desc: 'Manage curriculum taxonomy and domain categories.' },
    { to: '/admin/students', icon: <i className="fa-solid fa-user-graduate"></i>, title: 'Students', desc: 'Review student records, enrollments, and manage account statuses.' },
    { to: '/admin/admins', icon: <i className="fa-solid fa-shield-halved"></i>, title: 'Administrators', desc: 'Manage organization admin roles and team credentials.' },
    { to: '/admin/media', icon: <i className="fa-solid fa-cloud-arrow-up"></i>, title: 'Cloudinary Media Manager', desc: 'Upload, store, replace, and stream lecture videos, PDFs, and assets on Cloudinary.' },
    { to: '/admin/live-sessions', icon: <i className="fa-solid fa-video"></i>, title: 'Live Sessions & Recordings', desc: 'Schedule interactive classes and manage lesson replay recordings.' },
    { to: '/admin/enrollments', icon: <i className="fa-solid fa-clipboard-check"></i>, title: 'All Enrollments', desc: 'Comprehensive ledger of student registrations across courses.' },
    { to: '/admin/progress', icon: <i className="fa-solid fa-chart-pie"></i>, title: 'Progress Monitoring', desc: 'Track student watch percentages, completion rules, and access.' },
  ];

  // Calculated KPI Rates
  const totalDoubts = stats?.totalDoubtsAsked || 0;
  const repliedDoubts = stats?.totalDoubtsReplied || 0;
  const pendingDoubts = stats?.pendingDoubts || 0;
  const resolutionRate = totalDoubts > 0 ? Math.round((repliedDoubts / totalDoubts) * 100) : 100;

  const totalStudents = stats?.totalStudents || 0;
  const activeStudents = stats?.activeStudents || 0;
  const activeStudentRate = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 100;

  return (
    <div className="page">
      <style>{`
        @keyframes dashboardFadeUp {
          0% {
            opacity: 0;
            transform: translateY(18px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes donutSpinIn {
          0% {
            transform: rotate(-180deg) scale(0.85);
            opacity: 0;
          }
          100% {
            transform: rotate(-90deg) scale(1);
            opacity: 1;
          }
        }

        .admin-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 28px;
        }
        @media (max-width: 1200px) {
          .admin-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .admin-kpi-grid {
            grid-template-columns: 1fr;
          }
        }

        .animated-kpi-card {
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          padding: 22px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: var(--shadow-sm);
          text-decoration: none;
          color: inherit;
          animation: dashboardFadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.28s ease, border-color 0.28s ease;
          position: relative;
          overflow: hidden;
        }

        .animated-kpi-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: transparent;
          transition: background 0.25s ease;
        }

        .animated-kpi-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 14px 28px -6px rgba(90, 112, 211, 0.16), 0 4px 10px -2px rgba(0, 0, 0, 0.04);
          border-color: rgba(90, 112, 211, 0.4);
        }

        .animated-kpi-card:hover::before {
          background: linear-gradient(90deg, #5a70d3, #8b5cf6);
        }

        .animated-kpi-card:hover .kpi-icon {
          transform: scale(1.12) rotate(4deg);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .analytics-card {
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          padding: 24px;
          box-shadow: var(--shadow-sm);
          animation: dashboardFadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: box-shadow 0.25s ease, border-color 0.25s ease;
        }

        .analytics-card:hover {
          box-shadow: 0 10px 24px -4px rgba(0, 0, 0, 0.06);
          border-color: var(--border-strong, #cbd5e1);
        }

        .chart-tab-btn {
          padding: 6px 14px;
          font-size: 0.8rem;
          font-weight: 700;
          border-radius: var(--radius-full, 9999px);
          border: 1px solid var(--border-default);
          background: var(--bg-surface);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .chart-tab-btn.active {
          background: var(--accent-primary, #5a70d3);
          color: #ffffff;
          border-color: var(--accent-primary, #5a70d3);
          box-shadow: 0 2px 8px rgba(90, 112, 211, 0.3);
        }
      `}</style>

      <div className="page-header" style={{ animation: 'dashboardFadeUp 0.4s ease both' }}>
        <div className="page-title-wrap">
          <h1 className="page-title">Admin Command Center</h1>
          <p className="page-subtitle">
            Welcome back, <strong>{user?.name}</strong>. Real-time overview of the One Tutor platform.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/admin/courses/create" className="btn btn-primary">
            + New Course
          </Link>
          <Link to="/admin/live-sessions" className="btn btn-secondary">
            + Schedule Live
          </Link>
          <Link to="/admin/media" className="btn btn-secondary">
            <i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: '6px' }}></i> Cloudinary Media
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          Aggregating platform metrics…
        </div>
      ) : (
        <>
          {/* KPI Statistics (Balanced 8-Card Grid) */}
          <div className="admin-kpi-grid">
            {/* 1. TOTAL STUDENTS */}
            <Link to="/admin/students" className="animated-kpi-card" style={{ animationDelay: '40ms' }}>
              <div className="kpi-icon"><i className="fa-solid fa-user-graduate"></i></div>
              <div className="kpi-info">
                <span className="kpi-val"><AnimatedNumber value={stats?.totalStudents || 0} /></span>
                <span className="kpi-label">Total Students</span>
                <span className="kpi-sub">{stats?.activeStudents || 0} active, {stats?.disabledStudents || 0} disabled</span>
              </div>
            </Link>

            {/* 2. TOTAL COURSES */}
            <Link to="/admin/courses" className="animated-kpi-card" style={{ animationDelay: '80ms' }}>
              <div className="kpi-icon"><i className="fa-solid fa-book-open"></i></div>
              <div className="kpi-info">
                <span className="kpi-val"><AnimatedNumber value={stats?.totalCourses || 0} /></span>
                <span className="kpi-label">Total Courses</span>
                <span className="kpi-sub">{stats?.publishedCourses || 0} published, {stats?.draftCourses || 0} draft, {stats?.archivedCourses || 0} archived</span>
              </div>
            </Link>

            {/* 3. TOTAL ENROLLMENTS */}
            <Link to="/admin/enrollments" className="animated-kpi-card" style={{ animationDelay: '120ms' }}>
              <div className="kpi-icon"><i className="fa-solid fa-clipboard-list"></i></div>
              <div className="kpi-info">
                <span className="kpi-val"><AnimatedNumber value={stats?.totalEnrollments || 0} /></span>
                <span className="kpi-label">Total Enrollments</span>
                <span className="kpi-sub">{stats?.activeEnrollments || 0} active registrations</span>
              </div>
            </Link>

            {/* 4. UPCOMING & LIVE CLASSES */}
            <Link to="/admin/live-sessions" className="animated-kpi-card" style={{ animationDelay: '160ms' }}>
              <div className="kpi-icon"><i className="fa-solid fa-video"></i></div>
              <div className="kpi-info">
                <span className="kpi-val"><AnimatedNumber value={stats?.upcomingLiveSessions || 0} /></span>
                <span className="kpi-label">Upcoming & Live Classes</span>
                <span className="kpi-sub">Active & scheduled live sessions</span>
              </div>
            </Link>

            {/* 5. DOUBTS ASKED */}
            <Link to="/admin/doubts" className="animated-kpi-card" style={{ animationDelay: '200ms' }}>
              <div className="kpi-icon" style={{ background: 'rgba(109, 40, 217, 0.1)', color: '#6d28d9' }}>
                <i className="fa-solid fa-circle-question"></i>
              </div>
              <div className="kpi-info">
                <span className="kpi-val" style={{ color: '#6d28d9' }}><AnimatedNumber value={stats?.totalDoubtsAsked || 0} /></span>
                <span className="kpi-label">Doubts Asked</span>
                <span className="kpi-sub" style={{ color: pendingDoubts > 0 ? '#b45309' : '#15803d', fontWeight: 700 }}>
                  {pendingDoubts > 0 ? `⚠️ ${pendingDoubts} waiting for reply` : '✓ All doubts cleared'}
                </span>
              </div>
            </Link>

            {/* 6. DOUBTS REPLIED */}
            <Link to="/admin/doubts" className="animated-kpi-card" style={{ animationDelay: '240ms' }}>
              <div className="kpi-icon" style={{ background: 'rgba(21, 128, 61, 0.1)', color: '#15803d' }}>
                <i className="fa-solid fa-comments"></i>
              </div>
              <div className="kpi-info">
                <span className="kpi-val" style={{ color: '#15803d' }}><AnimatedNumber value={stats?.totalDoubtsReplied || 0} /></span>
                <span className="kpi-label">Doubts Replied</span>
                <span className="kpi-sub">Tutor responses provided</span>
              </div>
            </Link>

            {/* 7. TODAY NEW USERS */}
            <Link to="/admin/students" className="animated-kpi-card" style={{ animationDelay: '280ms' }}>
              <div className="kpi-icon" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
                <i className="fa-solid fa-user-plus"></i>
              </div>
              <div className="kpi-info">
                <span className="kpi-val" style={{ color: '#0284c7' }}><AnimatedNumber value={stats?.todayNewLogins ?? 0} /></span>
                <span className="kpi-label">Today New Users</span>
                <span className="kpi-sub" style={{ color: '#0284c7', fontWeight: 600 }}>
                  {(stats?.todayNewLogins || 0) > 0 ? `${stats.todayNewLogins} new account${stats.todayNewLogins > 1 ? 's' : ''} created today` : 'No new accounts created today'}
                </span>
              </div>
            </Link>

            {/* 8. TODAY ENROLLMENTS */}
            <Link to="/admin/enrollments" className="animated-kpi-card" style={{ animationDelay: '320ms' }}>
              <div className="kpi-icon" style={{ background: 'rgba(13, 148, 136, 0.1)', color: '#0d9488' }}>
                <i className="fa-solid fa-graduation-cap"></i>
              </div>
              <div className="kpi-info">
                <span className="kpi-val" style={{ color: '#0d9488' }}><AnimatedNumber value={stats?.todayEnrollments ?? 0} /></span>
                <span className="kpi-label">Today Enrollments</span>
                <span className="kpi-sub" style={{ color: '#0d9488', fontWeight: 600 }}>
                  {(stats?.todayEnrollments || 0) > 0 ? `${stats.todayEnrollments} enrollment${stats.todayEnrollments > 1 ? 's' : ''} today` : 'No enrollments today'}
                </span>
              </div>
            </Link>
          </div>

          {/* Real-time Pie & Donut Charts Section */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-chart-pie" style={{ color: 'var(--accent-primary, #5a70d3)' }}></i> Platform Distribution Analytics
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Real-time interactive distribution breakdown
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              {/* Chart 1: Course Catalog Breakdown */}
              <div className="analytics-card" style={{ animationDelay: '360ms' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                      Course Portfolio Breakdown
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                      Published, draft & archived course states
                    </p>
                  </div>
                  <Link to="/admin/courses" style={{ fontSize: '0.8rem', fontWeight: '700', textDecoration: 'none', color: 'var(--accent-primary)' }}>
                    Manage Courses →
                  </Link>
                </div>

                <AnimatedDonutChart
                  total={stats?.totalCourses || 0}
                  centerValue={stats?.totalCourses || 0}
                  centerLabel="Courses"
                  data={[
                    { label: 'Published', value: stats?.publishedCourses || 0, color: '#10b981' },
                    { label: 'Draft', value: stats?.draftCourses || 0, color: '#f59e0b' },
                    { label: 'Archived', value: stats?.archivedCourses || 0, color: '#64748b' }
                  ]}
                />
              </div>

              {/* Chart 2: Doubt Clearance & Platform Health */}
              <div className="analytics-card" style={{ animationDelay: '420ms' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                      Support & Engagement Health
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                      Resolution velocity & user participation
                    </p>
                  </div>

                  {/* Interactive Tab Switcher */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`chart-tab-btn ${activeChartTab === 'doubts' ? 'active' : ''}`}
                      onClick={() => setActiveChartTab('doubts')}
                    >
                      Doubts
                    </button>
                    <button
                      type="button"
                      className={`chart-tab-btn ${activeChartTab === 'students' ? 'active' : ''}`}
                      onClick={() => setActiveChartTab('students')}
                    >
                      Students
                    </button>
                    <button
                      type="button"
                      className={`chart-tab-btn ${activeChartTab === 'enrollments' ? 'active' : ''}`}
                      onClick={() => setActiveChartTab('enrollments')}
                    >
                      Enrollments
                    </button>
                  </div>
                </div>

                {activeChartTab === 'doubts' && (
                  <AnimatedDonutChart
                    total={stats?.totalDoubtsAsked || 0}
                    centerValue={`${resolutionRate}%`}
                    centerLabel="Resolved"
                    data={[
                      { label: 'Replied / Answered', value: stats?.totalDoubtsReplied || 0, color: '#5a70d3' },
                      { label: 'Waiting for Reply', value: stats?.pendingDoubts || 0, color: '#f43f5e' }
                    ]}
                  />
                )}

                {activeChartTab === 'students' && (
                  <AnimatedDonutChart
                    total={stats?.totalStudents || 0}
                    centerValue={`${stats?.activeStudents || 0}`}
                    centerLabel="Active"
                    data={[
                      { label: 'Active Students', value: stats?.activeStudents || 0, color: '#06b6d4' },
                      { label: 'Disabled Accounts', value: stats?.disabledStudents || 0, color: '#ef4444' }
                    ]}
                  />
                )}

                {activeChartTab === 'enrollments' && (
                  <AnimatedDonutChart
                    total={stats?.totalEnrollments || 0}
                    centerValue={`${stats?.activeEnrollments || 0}`}
                    centerLabel="Active"
                    data={[
                      { label: 'Active Registrations', value: stats?.activeEnrollments || 0, color: '#8b5cf6' },
                      { label: 'Other / Inactive', value: Math.max(0, (stats?.totalEnrollments || 0) - (stats?.activeEnrollments || 0)), color: '#94a3b8' }
                    ]}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Main Dashboard Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
            {/* Left: Management Portals */}
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Management Portals
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {portals.map((p, idx) => (
                  <Link
                    key={p.to}
                    to={p.to}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      textDecoration: 'none',
                      padding: '18px',
                      animation: `dashboardFadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both`,
                      animationDelay: `${460 + (idx * 30)}ms`,
                      transition: 'all var(--transition-normal)'
                    }}
                  >
                    <div style={{
                      fontSize: '1.6rem',
                      width: '44px',
                      height: '44px',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--accent-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {p.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                        {p.desc}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Right: Recent Audit Log */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  Recent System Activity
                </h2>
                <Link to="/admin/audit-logs" style={{ fontSize: '0.82rem', fontWeight: '700' }}>
                  All Logs →
                </Link>
              </div>

              <div
                className="card"
                style={{
                  padding: '16px',
                  maxHeight: '424px',
                  display: 'flex',
                  flexDirection: 'column',
                  animation: 'dashboardFadeUp 0.5s ease both',
                  animationDelay: '500ms'
                }}
              >
                {(!stats?.recentAuditLogs || stats.recentAuditLogs.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    No recent audit events.
                  </div>
                ) : (
                  <div
                    className="recent-activity-scroll"
                    style={{
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      paddingRight: '6px'
                    }}
                  >
                    {stats.recentAuditLogs.map((log) => (
                      <div
                        key={log.id}
                        style={{
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--accent-subtle)',
                            color: 'var(--accent-primary)'
                          }}>
                            {log.action}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                          {log.details || `${log.action} on ${log.entityType}`}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          By {log.userName || 'System'} • {log.entityType} #{log.entityId}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
