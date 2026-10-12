import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveMediaUrl } from '../utils/mediaUtils';
import { getCourseDefaultRating } from '../utils/courseRatingUtils';

const gradients = [
  '#5A70D3',
  '#4B61C4',
  'linear-gradient(135deg, #111111 0%, #FFE680 100%)',
  'linear-gradient(135deg, #5A70D3 0%, #4338ca 100%)',
  'linear-gradient(135deg, #8050D8 0%, #FFE680 100%)',
];

export default function CourseCard({ course, isEnrolled = false, onClick, linkTo, disableLink = false, allowNonPublished = false }) {
  const [imageError, setImageError] = useState(false);
  if (!course) return null;

  const status = (course.status || course.courseStatus || '').toLowerCase();
  // If course has been drafted or archived, hide card for others who are not enrolled
  if (status && status !== 'published' && !isEnrolled && !disableLink && !allowNonPublished) {
    return null;
  }

  const bgGradient = gradients[(course.id || 0) % gradients.length];
  const thumb = resolveMediaUrl(course.thumbnail || course.thumbnailUrl || course.imageUrl);

  const handleClick = (e) => {
    if (onClick) {
      e.preventDefault();
      onClick(course);
    }
  };

  const cardInner = (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
      onClick={handleClick}
    >
      {/* Thumbnail */}
      <div className="ud-course-thumb-wrap" style={{ position: 'relative', overflow: 'hidden', background: '#0a192f' }}>
        {thumb && !imageError ? (
          <img
            src={thumb}
            alt={course.name}
            className="ud-course-thumb"
            onError={() => setImageError(true)}
            style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div className="ud-course-thumb-fallback" style={{ background: bgGradient }}>
            <i className="fa-solid fa-graduation-cap" style={{ fontSize: '2.5rem', color: 'rgba(255, 255, 255, 0.85)' }} />
          </div>
        )}
        {course.level && (
          <span className="ud-badge-level" style={{ zIndex: 2 }}>{course.level}</span>
        )}
      </div>

      {/* Body */}
      <div className="ud-course-body">
        <h3 className="ud-course-title" title={course.name}>
          {course.name}
        </h3>

        {course.categoryName && (
          <div className="ud-course-instructor">
            <i className="fa-solid fa-tag" style={{ fontSize: '0.78rem' }} />
            <span>{course.categoryName}</span>
          </div>
        )}

        {(() => {
          const ratingData = getCourseDefaultRating(course.id);
          const score = course.rating ? Number(course.rating).toFixed(1) : ratingData.averageRating.toFixed(1);
          const count = course.reviewsCount || ratingData.totalReviews;
          return (
            <div className="ud-rating-row">
              <span className="ud-rating-score">{score}</span>
              <span className="ud-rating-stars" style={{ display: 'inline-flex', gap: '2px', color: '#f59e0b', fontSize: '0.75rem' }}>
                <i className="fa-solid fa-star" />
              </span>
              <span className="ud-rating-count">({count})</span>
            </div>
          );
        })()}

        {(course.duration || course.language) && (
          <div className="ud-course-meta">
            {course.duration && (
              <>
                <i className="fa-regular fa-clock" style={{ fontSize: '0.75rem' }} />
                <span>{course.duration}</span>
              </>
            )}
            {course.duration && course.language && <span>•</span>}
            {course.language && (
              <>
                <i className="fa-solid fa-globe" style={{ fontSize: '0.75rem' }} />
                <span>{course.language}</span>
              </>
            )}
          </div>
        )}

        <div className="ud-course-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ud-price-tag" style={{
              color: isEnrolled ? '#10b981' : ((course.pricingType === 'subscription' || course.pricingType === 'paid') && Number(course.price) > 0) ? '#4f46e5' : '#059669',
              fontWeight: 800
            }}>
              {isEnrolled ? (
                'Enrolled'
              ) : ((course.pricingType === 'subscription' || course.pricingType === 'paid') && Number(course.price) > 0) ? (
                <>
                  {course.currency === 'USD' ? '$' : '₹'}{Number(course.price).toLocaleString()}
                  {course.pricingType === 'subscription' && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>
                      /{course.subscriptionPeriod === 'yearly' ? 'yr' : 'mo'}
                    </span>
                  )}
                </>
              ) : (
                'Free'
              )}
            </span>
            {course.isBestseller && (
              <span className="ud-badge-bestseller">Bestseller</span>
            )}
            {!isEnrolled && (course.pricingType === 'subscription') && Number(course.price) > 0 && (
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#eef2ff',
                color: '#4f46e5',
                border: '1px solid #c7d2fe'
              }}>
                Subscription
              </span>
            )}
          </div>

          <span className="ud-course-action-btn">
            {isEnrolled ? (
              <>Resume <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.72rem' }} /></>
            ) : (
              <>View Course <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.72rem' }} /></>
            )}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="ud-course-card">
      {disableLink || onClick ? (
        cardInner
      ) : (
        <Link
          to={linkTo || `/student/courses/${course.id}`}
          style={{ display: 'flex', flexDirection: 'column', height: '100%', textDecoration: 'none', color: 'inherit' }}
        >
          {cardInner}
        </Link>
      )}
    </div>
  );
}
