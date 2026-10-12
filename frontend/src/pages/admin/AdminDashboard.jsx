import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getDashboardStats } from '../../api/admin';

import ContentCreatorDashboard from './ContentCreatorDashboard';

export default function AdminDashboard() {
  const { user } = useAuth();

  const isCreator = user?.role === 'content_creator' || user?.role === 'creator';
  if (isCreator) {
    return <ContentCreatorDashboard />;
  }

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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
    { to: '/admin/courses', icon: <i className="fa-solid fa-book-open"></i>, title: 'Courses Manager', desc: 'Create, edit, duplicate, version, publish, and preview curricula.' },
    { to: '/admin/categories', icon: <i className="fa-solid fa-tags"></i>, title: 'Categories', desc: 'Manage curriculum taxonomy and domain categories.' },
    { to: '/admin/students', icon: <i className="fa-solid fa-user-graduate"></i>, title: 'Students', desc: 'Review student records, enrollments, and manage account statuses.' },
    { to: '/admin/admins', icon: <i className="fa-solid fa-shield-halved"></i>, title: 'Administrators', desc: 'Manage organization admin roles and team credentials.' },
    { to: '/admin/media', icon: <i className="fa-solid fa-cloud-arrow-up"></i>, title: 'Cloudinary Media Manager', desc: 'Upload, store, replace, and stream lecture videos, PDFs, and assets on Cloudinary.' },
    { to: '/admin/live-sessions', icon: <i className="fa-solid fa-video"></i>, title: 'Live Sessions & Recordings', desc: 'Schedule interactive classes and manage lesson replay recordings.' },
    { to: '/admin/enrollments', icon: <i className="fa-solid fa-clipboard-check"></i>, title: 'All Enrollments', desc: 'Comprehensive ledger of student registrations across courses.' },
    { to: '/admin/progress', icon: <i className="fa-solid fa-chart-pie"></i>, title: 'Progress Monitoring', desc: 'Track student watch percentages, completion rules, and access.' },
  ];

  return (
    <div className="page">
      <div className="page-header">
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
          {/* KPI Statistics */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon"><i className="fa-solid fa-user-graduate"></i></div>
              <div className="kpi-info">
                <span className="kpi-val">{stats?.totalStudents || 0}</span>
                <span className="kpi-label">Total Students</span>
                <span className="kpi-sub">{stats?.activeStudents || 0} active, {stats?.disabledStudents || 0} disabled</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon"><i className="fa-solid fa-book-open"></i></div>
              <div className="kpi-info">
                <span className="kpi-val">{stats?.totalCourses || 0}</span>
                <span className="kpi-label">Total Courses</span>
                <span className="kpi-sub">{stats?.publishedCourses || 0} published, {stats?.draftCourses || 0} draft, {stats?.archivedCourses || 0} archived</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon"><i className="fa-solid fa-clipboard-list"></i></div>
              <div className="kpi-info">
                <span className="kpi-val">{stats?.totalEnrollments || 0}</span>
                <span className="kpi-label">Total Enrollments</span>
                <span className="kpi-sub">{stats?.activeEnrollments || 0} active registrations</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon"><i className="fa-solid fa-video"></i></div>
              <div className="kpi-info">
                <span className="kpi-val">{stats?.upcomingLiveSessions || 0}</span>
                <span className="kpi-label">Upcoming & Live Classes</span>
                <span className="kpi-sub">Active & scheduled live sessions</span>
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
                {portals.map((p) => (
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
                  flexDirection: 'column'
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
