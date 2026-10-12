import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { getAdminReviews, getAdminReviewStats, deleteAdminReview, togglePublishAdminReview } from '../../api/reviews';
import { listAdminCourses } from '../../api/courses';
import { toast, confirmDialog } from '../../context/NotificationContext';
import { usePermission } from '../../hooks/usePermission';

export default function AdminReviewsPage() {
  const { isReadOnly } = usePermission();
  const [searchParams, setSearchParams] = useSearchParams();

  const [reviews, setReviews] = useState([]);
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({
    totalReviews: 0,
    overallAverageRating: 0.0,
    fiveStarCount: 0,
    uniqueStudentsCount: 0,
    reviewedCoursesCount: 0,
    pendingReviewsCount: 0
  });

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [courseFilter, setCourseFilter] = useState(searchParams.get('courseId') || '');
  const [ratingFilter, setRatingFilter] = useState(searchParams.get('rating') || 'ALL');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedReview, setSelectedReview] = useState(null);

  // Load available courses for the dropdown filter
  useEffect(() => {
    listAdminCourses({ size: 200 })
      .then(res => {
        const list = res?.content || (Array.isArray(res) ? res : []);
        setCourses(list);
      })
      .catch(() => {});
  }, []);

  // Load stats
  useEffect(() => {
    loadStats();
  }, []);

  // Load reviews whenever filters or page changes
  useEffect(() => {
    loadReviews();
  }, [courseFilter, ratingFilter, statusFilter, page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      loadReviews();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  async function loadStats() {
    setStatsLoading(true);
    try {
      const data = await getAdminReviewStats();
      if (data) setStats(data);
    } catch (err) {
      console.error('Failed to load review stats', err);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadReviews() {
    setLoading(true);
    try {
      const cId = courseFilter ? parseInt(courseFilter, 10) : null;
      const rVal = ratingFilter !== 'ALL' ? parseInt(ratingFilter, 10) : null;
      const data = await getAdminReviews({
        courseId: cId,
        rating: rVal,
        status: statusFilter !== 'ALL' ? statusFilter : null,
        search,
        page,
        size: 15
      });
      setReviews(data?.content || []);
      setTotalPages(data?.totalPages || 1);
      setTotalElements(data?.totalElements || 0);
    } catch (err) {
      toast.error('Failed to load course reviews.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePublish(review, publish) {
    if (isReadOnly) return;
    try {
      await togglePublishAdminReview(review.id, publish);
      toast.success(publish ? 'Review published successfully! It is now live on the course page.' : 'Review unpublished and moved to pending approval.');
      if (selectedReview && selectedReview.id === review.id) {
        setSelectedReview(prev => prev ? { ...prev, status: publish ? 'published' : 'pending' } : null);
      }
      loadReviews();
      loadStats();
    } catch (err) {
      toast.error('Failed to update review status.');
    }
  }

  async function handleDeleteReview(review) {
    if (isReadOnly) return;
    const confirmed = await confirmDialog({
      title: `Delete Review by ${review.studentName}?`,
      description: `Are you sure you want to remove this ${review.rating}-star review for "${review.courseName}"? This action cannot be undone.`,
      confirmText: 'Delete Review',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      await deleteAdminReview(review.id);
      toast.success('Review deleted successfully.');
      if (selectedReview && selectedReview.id === review.id) {
        setSelectedReview(null);
      }
      loadReviews();
      loadStats();
    } catch (err) {
      toast.error('Failed to delete review.');
    }
  }

  function handleResetFilters() {
    setSearch('');
    setCourseFilter('');
    setRatingFilter('ALL');
    setStatusFilter('ALL');
    setPage(0);
    setSearchParams({});
  }

  function renderStars(rating) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <i
          key={i}
          className={`fa-solid fa-star ${i <= rating ? 'text-warning' : 'text-muted'}`}
          style={{
            fontSize: '0.9rem',
            color: i <= rating ? '#f59e0b' : 'var(--border-subtle)',
            marginRight: '2px'
          }}
        />
      );
    }
    return stars;
  }

  function formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  }

  function formatDateParts(isoStr) {
    if (!isoStr) return { date: '—', time: '' };
    try {
      const d = new Date(isoStr);
      const date = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const time = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      return { date, time };
    } catch (e) {
      return { date: isoStr, time: '' };
    }
  }

  const getInitials = (name) => {
    if (!name) return 'ST';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="admin-page-container" style={{ padding: '24px 32px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.2))',
              color: '#f59e0b'
            }}>
              <i className="fa-solid fa-star-half-stroke" style={{ fontSize: '1.25rem' }}></i>
            </span>
            Course Ratings & Reviews
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Manage and moderate student feedback, ratings, and testimonials across all catalog courses.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => { loadReviews(); loadStats(); }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'fa-spin' : ''}`}></i>
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Total Reviews */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Total Reviews</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-comments"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '10px', color: 'var(--text-primary)' }}>
            {statsLoading ? '…' : stats.totalReviews}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Across {stats.reviewedCoursesCount} active courses
          </div>
        </div>

        {/* Average Rating */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Overall Average</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-star"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '10px', color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            {statsLoading ? '…' : (stats.overallAverageRating > 0 ? stats.overallAverageRating.toFixed(1) : '5.0')}
            <span style={{ fontSize: '1rem', color: '#f59e0b' }}>★</span>
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)' }}>/ 5.0</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Platform-wide student satisfaction
          </div>
        </div>

        {/* 5-Star Reviews */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>5-Star Ratings</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-award"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '10px', color: 'var(--text-primary)' }}>
            {statsLoading ? '…' : stats.fiveStarCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#22c55e', marginTop: '4px', fontWeight: '600' }}>
            {stats.totalReviews > 0 ? `${Math.round((stats.fiveStarCount / stats.totalReviews) * 100)}% top score` : '100% positive'}
          </div>
        </div>

        {/* Student Reviewers */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Unique Reviewers</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-users"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '10px', color: 'var(--text-primary)' }}>
            {statsLoading ? '…' : stats.uniqueStudentsCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Active student contributors
          </div>
        </div>

        {/* Pending Approval */}
        <div style={{
          background: 'var(--bg-card)',
          border: stats.pendingReviewsCount > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          boxShadow: stats.pendingReviewsCount > 0 ? '0 0 12px rgba(245, 158, 11, 0.1)' : 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Pending Comments</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-hourglass-half"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: '800', marginTop: '10px', color: stats.pendingReviewsCount > 0 ? '#d97706' : 'var(--text-primary)' }}>
            {statsLoading ? '…' : (stats.pendingReviewsCount || 0)}
          </div>
          <div style={{ fontSize: '0.78rem', color: stats.pendingReviewsCount > 0 ? '#d97706' : 'var(--text-secondary)', marginTop: '4px', fontWeight: stats.pendingReviewsCount > 0 ? '600' : '400' }}>
            {stats.pendingReviewsCount > 0 ? 'Requires Super Admin comment publishing' : 'All comments published'}
          </div>
        </div>
      </div>

      {/* Main Content Card: Filters & Reviews Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
        {/* Filters Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '340px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
            <input
              type="text"
              placeholder="Search student ID, name, or comment…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            {/* Course Filter */}
            <select
              value={courseFilter}
              onChange={(e) => { setCourseFilter(e.target.value); setPage(0); }}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                maxWidth: '240px'
              }}
            >
              <option value="">All Courses</option>
              {courses.map((crs) => (
                <option key={crs.id} value={crs.id}>
                  {crs.name}
                </option>
              ))}
            </select>

            {/* Rating Filter */}
            <select
              value={ratingFilter}
              onChange={(e) => { setRatingFilter(e.target.value); setPage(0); }}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem'
              }}
            >
              <option value="ALL">All Ratings</option>
              <option value="5">5 Stars (★★★★★)</option>
              <option value="4">4 Stars (★★★★☆)</option>
              <option value="3">3 Stars (★★★☆☆)</option>
              <option value="2">2 Stars (★★☆☆☆)</option>
              <option value="1">1 Star (★☆☆☆☆)</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem'
              }}
            >
              <option value="ALL">All Comments</option>
              <option value="pending">⏳ Pending Comments</option>
              <option value="published">✓ Published Comments</option>
            </select>

            {(search || courseFilter || ratingFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                onClick={handleResetFilters}
                className="btn btn-secondary btn-sm"
                title="Reset all filters"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <i className="fa-solid fa-xmark"></i>
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Results Counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <span>Showing <strong>{reviews.length}</strong> of <strong>{totalElements}</strong> student reviews</span>
          {courseFilter && (
            <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
              Filtered by: {courses.find(c => String(c.id) === String(courseFilter))?.name || `Course #${courseFilter}`}
            </span>
          )}
        </div>

        {/* Reviews Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', marginBottom: '12px', color: 'var(--accent-primary)' }}></i>
            <p>Loading course reviews…</p>
          </div>
        ) : reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '1.75rem' }}>
              <i className="fa-regular fa-star"></i>
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', color: 'var(--text-primary)' }}>No Reviews Found</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', maxWidth: '400px', marginInline: 'auto' }}>
              {search || courseFilter || ratingFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No student reviews match your active filter criteria. Try adjusting or clearing your filters.'
                : 'No course ratings or comments have been submitted yet.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px 14px' }}>Student ID &amp; Name</th>
                  <th style={{ padding: '12px 14px' }}>Course</th>
                  <th style={{ padding: '12px 14px' }}>Rating</th>
                  <th style={{ padding: '12px 14px', width: '32%' }}>Comment / Feedback</th>
                  <th style={{ padding: '12px 14px' }}>Comment Status</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((rev) => (
                  <tr
                    key={rev.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Student Info: ID, Name, Email, Avatar */}
                    <td style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {rev.studentAvatar ? (
                          <img
                            src={rev.studentAvatar}
                            alt={rev.studentName}
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                          />
                        ) : (
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '0.8rem',
                            flexShrink: 0
                          }}>
                            {getInitials(rev.studentName)}
                          </div>
                        )}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                              {rev.studentName}
                            </span>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: 'var(--accent-primary)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontFamily: 'monospace'
                            }}>
                              ID: #{rev.studentId}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {rev.studentEmail || 'student@onetutor.local'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Course Name */}
                    <td style={{ padding: '14px' }}>
                      <Link
                        to={`/student/courses/${rev.courseId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontWeight: '600',
                          color: 'var(--accent-primary)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {rev.courseName}
                        <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.75rem', opacity: 0.7 }}></i>
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Course #{rev.courseId}
                      </div>
                    </td>

                    {/* Star Rating */}
                    <td style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {renderStars(rev.rating)}
                        </div>
                        <span style={{
                          fontWeight: '800',
                          fontSize: '0.88rem',
                          color: rev.rating >= 4 ? '#22c55e' : (rev.rating === 3 ? '#f59e0b' : '#ef4444')
                        }}>
                          {rev.rating}.0
                        </span>
                      </div>
                    </td>

                    {/* Comment text */}
                    <td style={{ padding: '14px', maxWidth: '320px' }}>
                      {rev.comment ? (
                        <div
                          onClick={() => setSelectedReview(rev)}
                          style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            padding: '8px 12px',
                            color: 'var(--text-primary)',
                            fontSize: '0.84rem',
                            lineHeight: '1.45',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                          }}
                          title={`Click to view full review:\n${rev.comment}`}
                        >
                          <i className="fa-solid fa-quote-left" style={{ opacity: 0.25, marginRight: '6px', fontSize: '0.75rem' }}></i>
                          {rev.comment}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.82rem' }}>
                          No written feedback provided (rating only)
                        </span>
                      )}
                    </td>

                    {/* Status column */}
                    <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                      {!rev.comment ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-muted)'
                        }}>
                          Rating Only
                        </span>
                      ) : rev.status === 'published' ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          background: 'rgba(34, 197, 94, 0.12)',
                          color: '#16a34a',
                          border: '1px solid rgba(34, 197, 94, 0.25)'
                        }}>
                          <i className="fa-solid fa-circle-check"></i> Published
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#b45309',
                          border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          <i className="fa-solid fa-hourglass-half"></i> Pending
                        </span>
                      )}
                    </td>

                    {/* Date: Row 1 Date, Row 2 Time */}
                    <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const { date, time } = formatDateParts(rev.createdAt);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{
                              fontWeight: '600',
                              fontSize: '0.82rem',
                              color: 'var(--text-primary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <i className="fa-regular fa-calendar-days" style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', opacity: 0.85 }}></i>
                              {date}
                            </div>
                            {time && (
                              <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                <i className="fa-regular fa-clock" style={{ fontSize: '0.72rem', opacity: 0.55 }}></i>
                                {time}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Action buttons */}
                    <td style={{ padding: '14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                        {/* View Full Review Details button */}
                        <button
                          type="button"
                          onClick={() => setSelectedReview(rev)}
                          title="View complete review details"
                          className="btn btn-secondary btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 11px',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            color: '#5A70D3',
                            background: 'rgba(90, 112, 211, 0.08)',
                            border: '1px solid rgba(90, 112, 211, 0.25)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer'
                          }}
                        >
                          <i className="fa-solid fa-eye"></i>
                          View
                        </button>

                        {rev.comment && (
                          rev.status === 'published' ? (
                            <button
                              onClick={() => handleTogglePublish(rev, false)}
                              disabled={isReadOnly}
                              title="Unpublish this comment (hide comment text from students)"
                              className="btn btn-secondary btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 12px',
                                fontSize: '0.78rem',
                                fontWeight: '600',
                                color: '#64748b'
                              }}
                            >
                              <i className="fa-solid fa-eye-slash"></i>
                              Unpublish
                            </button>
                          ) : (
                            <button
                              onClick={() => handleTogglePublish(rev, true)}
                              disabled={isReadOnly}
                              title="Publish this comment to the course page"
                              className="btn btn-sm"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                fontSize: '0.8rem',
                                fontWeight: '700',
                                background: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                                cursor: 'pointer'
                              }}
                            >
                              <i className="fa-solid fa-circle-check"></i>
                              Publish
                            </button>
                          )
                        )}

                        <button
                          onClick={() => handleDeleteReview(rev)}
                          disabled={isReadOnly}
                          title="Delete this review"
                          className="btn btn-secondary btn-sm"
                          style={{
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'rgba(239, 68, 68, 0.05)',
                            padding: '6px 10px'
                          }}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Full Review Details Modal */}
        {selectedReview && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setSelectedReview(null)}
          >
            <div
              style={{
                background: 'var(--bg-surface, #ffffff)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '560px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                  background: 'var(--bg-secondary, #f8fafc)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'rgba(90, 112, 211, 0.12)',
                      color: '#5A70D3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem'
                    }}
                  >
                    <i className="fa-solid fa-comment-dots"></i>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                      Student Review Details
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
                      Submitted on {formatDate(selectedReview.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    color: 'var(--text-muted, #94a3b8)',
                    padding: '4px'
                  }}
                  title="Close modal"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Student Info Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    background: 'var(--bg-secondary, #f8fafc)',
                    borderRadius: '12px',
                    marginBottom: '16px'
                  }}
                >
                  {selectedReview.studentAvatar ? (
                    <img
                      src={selectedReview.studentAvatar}
                      alt={selectedReview.studentName}
                      style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #5A70D3, #4338ca)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.95rem'
                      }}
                    >
                      {getInitials(selectedReview.studentName)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary, #0f172a)', fontSize: '0.95rem' }}>
                        {selectedReview.studentName}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: 'rgba(99, 102, 241, 0.12)',
                          color: '#5A70D3',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontFamily: 'monospace'
                        }}
                      >
                        ID: #{selectedReview.studentId}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', marginTop: '2px' }}>
                      {selectedReview.studentEmail || 'student@onetutor.local'}
                    </div>
                  </div>
                </div>

                {/* Course & Rating Details Row */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    marginBottom: '16px'
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'var(--bg-primary, #ffffff)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '10px'
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted, #64748b)', fontWeight: 700, letterSpacing: '0.5px' }}>
                      Course
                    </div>
                    <div style={{ fontWeight: 700, color: '#5A70D3', fontSize: '0.9rem', marginTop: '4px' }}>
                      {selectedReview.courseName}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'var(--bg-primary, #ffffff)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '10px'
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted, #64748b)', fontWeight: 700, letterSpacing: '0.5px' }}>
                      Rating &amp; Status
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {renderStars(selectedReview.rating)}
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f59e0b' }}>
                        {selectedReview.rating}.0
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '1px 8px',
                          borderRadius: '12px',
                          background: selectedReview.status === 'published' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.15)',
                          color: selectedReview.status === 'published' ? '#16a34a' : '#b45309'
                        }}
                      >
                        {selectedReview.status === 'published' ? 'Published' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Full Written Comment Box */}
                <div>
                  <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', color: 'var(--text-muted, #64748b)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>
                    Full Review Comment
                  </div>
                  {selectedReview.comment ? (
                    <div
                      style={{
                        background: 'var(--bg-secondary, #f8fafc)',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        borderRadius: '12px',
                        padding: '16px 18px',
                        color: 'var(--text-primary, #1e293b)',
                        fontSize: '0.92rem',
                        lineHeight: '1.7',
                        position: 'relative'
                      }}
                    >
                      <i className="fa-solid fa-quote-left" style={{ opacity: 0.25, fontSize: '1.2rem', marginBottom: '8px', display: 'block', color: '#5A70D3' }}></i>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                        "{selectedReview.comment}"
                      </p>
                    </div>
                  ) : (
                    <div style={{ padding: '16px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '12px', color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', fontSize: '0.88rem', textAlign: 'center' }}>
                      No written feedback provided (rating score only).
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                  background: 'var(--bg-secondary, #f8fafc)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontWeight: 600, padding: '7px 16px' }}
                >
                  Close
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedReview.comment && (
                    selectedReview.status === 'published' ? (
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(selectedReview, false)}
                        disabled={isReadOnly}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                      >
                        <i className="fa-solid fa-eye-slash"></i>
                        Unpublish Comment
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(selectedReview, true)}
                        disabled={isReadOnly}
                        className="btn btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#16a34a',
                          color: '#ffffff',
                          fontWeight: 700,
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          padding: '7px 16px'
                        }}
                      >
                        <i className="fa-solid fa-circle-check"></i>
                        Publish Comment
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteReview(selectedReview)}
                    disabled={isReadOnly}
                    className="btn btn-sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#ef4444',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      padding: '7px 14px',
                      fontWeight: 700
                    }}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
