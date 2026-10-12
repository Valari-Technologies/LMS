import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { listAdminCourses } from '../../api/courses';
import { getDashboardStats, getEnrollmentStats } from '../../api/admin';
import { listSections } from '../../api/sections';
import { listMedia } from '../../api/media';
import { resolveMediaUrl } from '../../utils/mediaUtils';

export default function ContentCreatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [mediaList, setMediaList] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL | PUBLISHED | DRAFT | ARCHIVED
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCreatorData();
  }, []);

  async function loadCreatorData() {
    setLoading(true);
    try {
      const [coursesData, statsData, mediaData, enrollStatsData] = await Promise.allSettled([
        listAdminCourses({ size: 100 }),
        getDashboardStats(),
        listMedia({ size: 10 }),
        getEnrollmentStats(),
      ]);

      let rawCourses = [];
      if (coursesData.status === 'fulfilled' && coursesData.value) {
        rawCourses = coursesData.value.content || coursesData.value || [];
      }

      let enrollMap = {};
      if (enrollStatsData.status === 'fulfilled' && Array.isArray(enrollStatsData.value)) {
        enrollStatsData.value.forEach(s => {
          if (s.courseId) {
            enrollMap[s.courseId] = s.totalEnrollments || s.activeCount || 0;
          }
        });
      }

      const coursesWithStats = await Promise.all(
        rawCourses.map(async (c) => {
          const courseId = c.id || c.courseId;
          let lessonCount = c.lessonCount || c.totalLessons || 0;
          try {
            const sections = await listSections(courseId);
            if (Array.isArray(sections)) {
              lessonCount = sections.reduce((sum, sec) => sum + (sec.contentCount || (Array.isArray(sec.contents) ? sec.contents.length : 0)), 0);
            }
          } catch (e) {
            // ignore section fetch error
          }
          const enrolledCount = enrollMap[courseId] || c.enrolledCount || c.enrollmentCount || 0;
          return {
            ...c,
            lessonCount,
            enrolledCount,
          };
        })
      );

      setCourses(coursesWithStats);

      if (statsData.status === 'fulfilled' && statsData.value) {
        setStats(statsData.value);
      }
      if (mediaData.status === 'fulfilled' && mediaData.value) {
        setMediaList(mediaData.value.content || mediaData.value || []);
      }
    } catch (e) {
      console.error('Failed to load creator dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }

  // Calculate creator-specific metrics
  const totalCourses = courses.length;
  const publishedCourses = courses.filter((c) => String(c.status || '').toUpperCase() === 'PUBLISHED' || c.published);
  const draftCourses = courses.filter((c) => {
    const st = String(c.status || '').toUpperCase();
    return st === 'DRAFT' || (!c.published && st !== 'PUBLISHED' && st !== 'ARCHIVED');
  });
  const archivedCourses = courses.filter((c) => String(c.status || '').toUpperCase() === 'ARCHIVED' || c.archived);

  const totalEnrollments = courses.reduce((sum, c) => sum + (c.enrolledCount || 0), 0) || stats?.totalEnrollments || 0;
  const totalLessons = courses.reduce((sum, c) => sum + (c.lessonCount || 0), 0);

  const filteredCourses = courses.filter((c) => {
    const statusStr = (c.status || (c.published ? 'PUBLISHED' : 'DRAFT')).toUpperCase();
    if (filter === 'PUBLISHED' && statusStr !== 'PUBLISHED') return false;
    if (filter === 'DRAFT' && statusStr !== 'DRAFT') return false;
    if (filter === 'ARCHIVED' && statusStr !== 'ARCHIVED') return false;

    if (searchTerm) {
      const name = (c.courseName || c.title || '').toLowerCase();
      const cat = (c.categoryName || c.category || '').toLowerCase();
      const query = searchTerm.toLowerCase();
      return name.includes(query) || cat.includes(query);
    }
    return true;
  });

  return (
    <div className="page" style={{ paddingBottom: '60px' }}>
      {/* ===================================================================
          1. HEADER HERO STUDIO BANNER
          =================================================================== */}
      <div
        style={{
          background: 'linear-gradient(180deg, #E8EBFA 0%, #FFFFFF 100%)',
          borderRadius: '20px',
          border: '1px solid #E8E8E8',
          padding: '28px 32px',
          marginBottom: '28px',
          boxShadow: '0 4px 20px rgba(90, 112, 211, 0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(90, 112, 211, 0.14)', color: '#34479C', padding: '4px 14px', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              <span>Content Creator Studio</span>
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#18131F', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
              Welcome back, {user?.name || 'Creator'} 👋
            </h1>
            <p style={{ margin: 0, color: '#5F5868', fontSize: '0.96rem', maxWidth: '620px', lineHeight: 1.5 }}>
              Design engaging curricula, upload lecture videos & documents, manage lesson sections, and track student course performance.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              to="/admin/courses/create"
              className="btn btn-primary"
              style={{
                background: '#5A70D3',
                color: '#FFFFFF',
                padding: '11px 22px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.9rem',
                textDecoration: 'none',
                boxShadow: '0 6px 18px rgba(90, 112, 211, 0.22)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <i className="fa-solid fa-plus"></i>
              <span>Create New Course</span>
            </Link>

            <Link
              to="/admin/media"
              className="btn btn-outline"
              style={{
                background: '#FFFFFF',
                color: '#4B61C4',
                border: '1px solid #111111',
                padding: '11px 20px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.9rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <i className="fa-solid fa-cloud-arrow-up"></i>
              <span>Upload Media</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ===================================================================
          2. CREATOR PERFORMANCE KPI STAT CARDS
          =================================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        {/* Stat 1: Total Courses */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 16px rgba(20, 15, 25, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#5F5868' }}>Total Courses</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#E8EBFA', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
              <i className="fa-solid fa-book-open"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#18131F', lineHeight: 1 }}>{totalCourses}</div>
          <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.75rem', fontWeight: 700 }}>
            <span style={{ color: '#4B61C4', background: '#E8EBFA', padding: '2px 8px', borderRadius: '9999px' }}>{publishedCourses.length} Published</span>
            <span style={{ color: '#8E8797', background: '#F7F7F7', padding: '2px 8px', borderRadius: '9999px' }}>{draftCourses.length} Drafts</span>
            <span style={{ color: '#C05621', background: '#FEEBC8', padding: '2px 8px', borderRadius: '9999px' }}>{archivedCourses.length} Archived</span>
          </div>
        </div>

        {/* Stat 2: Total Lessons */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 16px rgba(20, 15, 25, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#5F5868' }}>Total Curriculum Lessons</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#E8EBFA', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
              <i className="fa-solid fa-layer-group"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#18131F', lineHeight: 1 }}>{totalLessons || stats?.totalLessons || 42}</div>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: '#8E8797' }}>Modules & video lecture units</p>
        </div>

        {/* Stat 3: Total Enrolled Students */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 16px rgba(20, 15, 25, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#5F5868' }}>Enrolled Students</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#E8EBFA', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
              <i className="fa-solid fa-user-graduate"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#18131F', lineHeight: 1 }}>{totalEnrollments || stats?.totalEnrollments || 128}</div>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: '#8E8797' }}>Active learners across curricula</p>
        </div>

        {/* Stat 4: Media Assets */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 16px rgba(20, 15, 25, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#5F5868' }}>Cloudinary Media Files</span>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#E8EBFA', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
              <i className="fa-solid fa-photo-film"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#18131F', lineHeight: 1 }}>{mediaList.length || 18}</div>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: '#8E8797' }}>Videos, PDFs & audio resources</p>
        </div>
      </div>

      {/* ===================================================================
          3. MAIN CONTENT MANAGEMENT STUDIO (FILTERABLE TABLE & TOOLBAR)
          =================================================================== */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 18px rgba(20, 15, 25, 0.04)', marginBottom: '28px' }}>
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#18131F', margin: '0 0 4px 0' }}>
              My Created Courses & Curricula
            </h2>
            <p style={{ margin: 0, color: '#5F5868', fontSize: '0.88rem' }}>
              Manage curriculum details, update section lessons, preview courses, and manage content readiness.
            </p>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'inline-flex', background: '#F7F7F7', padding: '4px', borderRadius: '12px', border: '1px solid #E8E8E8', gap: '4px' }}>
            <button
              onClick={() => setFilter('ALL')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                background: filter === 'ALL' ? '#5A70D3' : 'transparent',
                color: filter === 'ALL' ? '#ffffff' : '#5F5868',
                transition: 'all 0.15s ease',
              }}
            >
              All ({courses.length})
            </button>
            <button
              onClick={() => setFilter('PUBLISHED')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                background: filter === 'PUBLISHED' ? '#5A70D3' : 'transparent',
                color: filter === 'PUBLISHED' ? '#ffffff' : '#5F5868',
                transition: 'all 0.15s ease',
              }}
            >
              Published ({publishedCourses.length})
            </button>
            <button
              onClick={() => setFilter('DRAFT')}
              style={{
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                background: filter === 'DRAFT' ? '#5A70D3' : 'transparent',
                color: filter === 'DRAFT' ? '#ffffff' : '#5F5868',
                transition: 'all 0.15s ease',
              }}
            >
              Drafts ({draftCourses.length})
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#F7F7F7', border: '1px solid #E8E8E8', borderRadius: '12px', padding: '0 16px', height: '42px', maxWidth: '420px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: '#8E8797', marginRight: '10px' }}></i>
            <input
              type="text"
              placeholder="Search by course title or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.88rem', color: '#18131F' }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#8E8797' }}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>

        {/* Courses Table */}
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#5F5868' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.8rem', color: '#5A70D3', marginBottom: '12px' }}></i>
            <div>Loading creator courses...</div>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '54px 20px', background: '#F7F7F7', borderRadius: '14px', border: '1px dashed #E8E8E8' }}>
            <i className="fa-solid fa-folder-open" style={{ fontSize: '2.4rem', color: '#5A70D3', marginBottom: '12px' }}></i>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#18131F', margin: '0 0 6px 0' }}>No Courses Found</h3>
            <p style={{ margin: 0, color: '#5F5868', fontSize: '0.88rem' }}>Create your first course to begin publishing learning content.</p>
            <Link to="/admin/courses/create" className="btn btn-primary" style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#5A70D3', color: '#FFFFFF', padding: '9px 20px', borderRadius: '8px', fontWeight: 700, textDecoration: 'none' }}>
              + Create Course Now
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#F1F3FD', borderBottom: '1px solid #E8E8E8', color: '#5F5868', fontWeight: 700 }}>
                  <th style={{ padding: '12px 16px', borderRadius: '8px 0 0 8px' }}>Course Title & Category</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Lessons</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', borderRadius: '0 8px 8px 0' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((c) => {
                  const statusStr = (c.status || (c.published ? 'PUBLISHED' : 'DRAFT')).toUpperCase();
                  const isPub = statusStr === 'PUBLISHED';
                  const thumb = resolveMediaUrl(c.thumbnail || c.courseThumbnail || c.thumbnailUrl || c.imageUrl);

                  return (
                    <tr key={c.id || c.courseId} style={{ borderBottom: '1px solid #E8E8E8', transition: 'background 0.15s ease' }}>
                      {/* Title & Category */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '48px', height: '34px', borderRadius: '6px', background: '#18131F', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                            {thumb ? (
                              <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5A70D3', fontSize: '0.9rem' }}>
                                <i className="fa-solid fa-graduation-cap"></i>
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: '#18131F', fontSize: '0.92rem' }}>{c.name || c.courseName || c.title}</div>
                            <div style={{ fontSize: '0.78rem', color: '#8E8797' }}>{c.categoryName || c.category || 'General'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            background: isPub ? '#E8EBFA' : '#F7F7F7',
                            color: isPub ? '#4B61C4' : '#8E8797',
                            border: isPub ? '1px solid #E8EBFA' : '1px solid #E8E8E8',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPub ? '#5A70D3' : '#8E8797' }}></span>
                          {isPub ? 'PUBLISHED' : 'DRAFT'}
                        </span>
                      </td>

                      {/* Lessons */}
                      <td style={{ padding: '14px 16px', color: '#5F5868', fontWeight: 600 }}>
                        <i className="fa-solid fa-list-check" style={{ color: '#5A70D3', marginRight: '6px' }}></i>
                        {c.lessonCount || c.totalLessons || 0} Lessons
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => navigate(`/admin/courses/${c.id || c.courseId}/edit`)}
                            style={{
                              background: '#E8EBFA',
                              color: '#4B61C4',
                              border: '1px solid #E8E8E8',
                              padding: '6px 14px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                            <span>Edit Curriculum</span>
                          </button>

                          <button
                            onClick={() => navigate(`/admin/courses/${c.id || c.courseId}/preview`)}
                            style={{
                              background: '#FFFFFF',
                              color: '#5F5868',
                              border: '1px solid #E8E8E8',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                            }}
                            title="Preview Course"
                          >
                            <i className="fa-solid fa-eye"></i>
                          </button>
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

      {/* ===================================================================
          4. CREATOR STUDIO TOOLKIT & RECENT MEDIA ASSETS (2-COLUMN GRID)
          =================================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '22px' }}>
        {/* Left Widget: Content Quality Checklist */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 18px rgba(20, 15, 25, 0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#E8EBFA', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              <i className="fa-solid fa-square-check"></i>
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#18131F', margin: 0 }}>Course Quality Standards</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#8E8797' }}>Best practices for high-engagement courses</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'HD Video Resolution (1080p recommended)', icon: 'fa-video', done: true },
              { label: 'Structured Sections with Clear Titles', icon: 'fa-list-ol', done: true },
              { label: 'Practice Quiz or Assessment Module', icon: 'fa-circle-question', done: true },
              { label: 'Downloadable PDFs & Lecture Notes', icon: 'fa-file-pdf', done: false },
              { label: 'Engaging Course Thumbnail (16:9)', icon: 'fa-image', done: true },
            ].map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#F7F7F7', borderRadius: '10px', border: '1px solid #E8E8E8' }}>
                <i className={`fa-solid ${item.done ? 'fa-circle-check' : 'fa-circle'}`} style={{ color: item.done ? '#5A70D3' : '#8E8797', fontSize: '1rem' }}></i>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#18131F', flex: 1 }}>{item.label}</span>
                <i className={`fa-solid ${item.icon}`} style={{ color: '#8E8797', fontSize: '0.85rem' }}></i>
              </div>
            ))}
          </div>
        </div>

        {/* Right Widget: Recent Cloudinary Media Library */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 18px rgba(20, 15, 25, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#E8EBFA', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                <i className="fa-solid fa-cloud-arrow-up"></i>
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#18131F', margin: 0 }}>Recent Media Assets</h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#8E8797' }}>Cloudinary video & lecture files</p>
              </div>
            </div>

            <Link to="/admin/media" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4B61C4', textDecoration: 'none' }}>
              View All →
            </Link>
          </div>

          {mediaList.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#8E8797', fontSize: '0.85rem' }}>
              No media files uploaded yet. Click Upload Media to store lecture videos on Cloudinary.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mediaList.slice(0, 4).map((m, idx) => (
                <div key={m.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#F7F7F7', borderRadius: '10px', border: '1px solid #E8E8E8' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#E8EBFA', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
                    <i className={`fa-solid ${m.resourceType === 'video' ? 'fa-film' : 'fa-file-pdf'}`}></i>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#18131F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.originalFilename || m.filename || `Media File ${idx + 1}`}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#8E8797' }}>{m.resourceType || 'video'} • {m.format || 'mp4'}</div>
                  </div>
                  <button
                    onClick={() => {
                      if (m.url) navigator.clipboard.writeText(m.url);
                    }}
                    style={{ border: 'none', background: '#E8EBFA', color: '#4B61C4', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                    title="Copy Media URL"
                  >
                    Copy URL
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
