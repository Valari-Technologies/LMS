import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';

function getRoleOnly(roleStr) {
  if (!roleStr) return '';
  return roleStr.split(/[@•]/)[0].trim();
}

const INDIAN_NAME_MAP = {
  'David Chen': 'Rohan Verma',
  'Marcus Vance': 'Rahul Mehta',
  'Elena Rostova': 'Sneha Kulkarni'
};

const INITIAL_TESTIMONIALS = [
  {
    id: 'rev-1',
    name: 'Priya Sharma',
    role: 'Full Stack Engineer',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=80',
    rating: 5,
    date: '3 days ago',
    title: 'The best end-to-end tech learning platform I have ever used!',
    comment: 'OneTutor completely transformed how I learn. The structured curriculum roadmaps, hands-on production projects, and direct mentor guidance helped me transition from a confused beginner to a confident software engineer. Everything on the platform is built for real-world industry standards.',
    likes: 42,
    verified: true
  },
  {
    id: 'rev-2',
    name: 'Rohan Verma',
    role: 'Cloud Solutions Architect',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
    rating: 5,
    date: '1 week ago',
    title: 'Industry-standard curriculum with zero fluff or outdated content.',
    comment: 'What sets OneTutor apart from other platforms is the practical depth of the material. Instructors teach actual enterprise architectural patterns rather than toy examples. The live sessions and community discussions add immense value to your daily learning.',
    likes: 38,
    verified: true
  },
  {
    id: 'rev-3',
    name: 'Ananya Patel',
    role: 'Frontend Developer',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=160&q=80',
    rating: 5,
    date: '2 weeks ago',
    title: 'Engaging live sessions and incredible mentor support!',
    comment: 'Whenever I got stuck on complex programming concepts, the interactive live sessions and mentor doubt-clearing made all the difference. OneTutor makes self-paced study feel truly guided and motivating every single day.',
    likes: 29,
    verified: true
  },
  {
    id: 'rev-4',
    name: 'Rahul Mehta',
    role: 'Career Switcher',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
    rating: 5,
    date: '3 weeks ago',
    title: 'Switched into tech at 32 with zero prior coding background!',
    comment: 'As someone switching careers into tech, I was overwhelmed by random online videos. OneTutor provided a clear, step-by-step pathway from fundamentals to production applications. The platform helped me land my first software developer role in under 8 months.',
    likes: 54,
    verified: true
  },
  {
    id: 'rev-5',
    name: 'Sneha Kulkarni',
    role: 'Software Engineer',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
    rating: 5,
    date: '1 month ago',
    title: 'Exceptional learning experience, video streaming, and progress tracking.',
    comment: 'The overall platform experience on OneTutor is world-class. Clean, distraction-free video playback, precise progress tracking, and interactive quizzes. It sets a very high bar for what a modern edutech platform should be.',
    likes: 31,
    verified: true
  },
  {
    id: 'rev-6',
    name: 'Vikram Malhotra',
    role: 'Full Stack Graduate',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=160&q=80',
    rating: 5,
    date: '1 month ago',
    title: 'Practical, career-focused learning with real industry impact.',
    comment: 'Unlike generic tutorial sites that only teach syntax, OneTutor emphasizes real-world engineering practices, Git workflows, debugging techniques, and deployment pipelines. The skills I gained here were directly applicable on day one at my job.',
    likes: 25,
    verified: true
  }
];

export default function StudentReviewsSection({ courses = [] }) {
  const { user } = useAuth();

  // Stored Reviews
  const [reviews, setReviews] = useState(() => {
    try {
      const saved = localStorage.getItem('onetutor_platform_reviews_v3') || localStorage.getItem('onetutor_platform_reviews_v2') || localStorage.getItem('onetutor_platform_reviews_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(r => ({
            ...r,
            name: INDIAN_NAME_MAP[r.name] || r.name,
            role: getRoleOnly(r.role)
          }));
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_TESTIMONIALS;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedReviews, setLikedReviews] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Autoplay & Manual Resumption State
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(0);

  // Touch Swipe State
  const [touchStart, setTouchStart] = useState(null);

  // Responsive Cards Per View
  const [cardsPerView, setCardsPerView] = useState(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth <= 680) return 1;
    if (window.innerWidth <= 1024) return 2;
    return 3;
  });

  // Modal Form State
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [authorRole, setAuthorRole] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const cooldownTimeoutRef = useRef(null);

  const AUTOPLAY_INTERVAL = 4500; // 4.5 seconds per slide
  const TICK_INTERVAL = 50; // Progress bar tick

  // Responsive resize handler
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth <= 680) {
        setCardsPerView(1);
      } else if (window.innerWidth <= 1024) {
        setCardsPerView(2);
      } else {
        setCardsPerView(3);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save reviews to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('onetutor_platform_reviews_v3', JSON.stringify(reviews));
    } catch {
      // ignore storage issues
    }
  }, [reviews]);

  const filteredReviews = reviews;

  // Max index calculation: ensures the last visible card group aligns cleanly
  const maxIndex = Math.max(0, filteredReviews.length - cardsPerView);

  // Autoplay timer with progress bar and automatic transition
  useEffect(() => {
    if (maxIndex <= 0 || isHovered) {
      return;
    }

    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + (TICK_INTERVAL / AUTOPLAY_INTERVAL) * 100;
        if (next >= 100) {
          setCurrentIndex(curr => (curr >= maxIndex ? 0 : curr + 1));
          return 0;
        }
        return next;
      });
    }, TICK_INTERVAL);

    return () => clearInterval(interval);
  }, [maxIndex, isHovered]);

  /**
   * Called when user manually navigates (Next, Prev, Dot, or Tab).
   * Immediately moves to that slide, pauses temporarily for reading,
   * and then automatically resumes continuous sliding!
   */
  const handleManualChange = (newIndex) => {
    const clamped = Math.max(0, Math.min(newIndex, maxIndex));
    setCurrentIndex(clamped);
    setProgress(0);

    // Pause briefly (4 seconds) so the user can read their selection,
    // then continue automatic movement seamlessly
    setIsHovered(true);

    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current);
    }

    cooldownTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 4000);
  };

  const handlePrev = () => {
    const target = currentIndex <= 0 ? maxIndex : currentIndex - 1;
    handleManualChange(target);
  };

  const handleNext = () => {
    const target = currentIndex >= maxIndex ? 0 : currentIndex + 1;
    handleManualChange(target);
  };

  // Mobile Touch Swipe Handlers
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
    setIsHovered(true);
  };

  const handleTouchEnd = (e) => {
    setIsHovered(false);
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (diff > 50) {
      handleNext();
    } else if (diff < -50) {
      handlePrev();
    }
    setTouchStart(null);
  };

  const handleToggleLike = (reviewId) => {
    setReviews(prev =>
      prev.map(r => {
        if (r.id === reviewId) {
          const isLiked = likedReviews.has(reviewId);
          return { ...r, likes: isLiked ? r.likes - 1 : r.likes + 1 };
        }
        return r;
      })
    );

    setLikedReviews(prev => {
      const updated = new Set(prev);
      if (updated.has(reviewId)) {
        updated.delete(reviewId);
      } else {
        updated.add(reviewId);
      }
      return updated;
    });
  };

  const handleOpenModal = () => {
    setSelectedCourseId(courses.length > 0 ? String(courses[0].id) : '1');
    setSubmitSuccess(false);
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!reviewTitle.trim() || !reviewComment.trim()) return;

    const matchedCourse = courses.find(c => String(c.id) === String(selectedCourseId)) || {
      id: 1,
      name: 'MERN Full Stack Development'
    };

    const newRev = {
      id: `user-rev-${Date.now()}`,
      name: user?.name || user?.fullName || 'Verified Learner',
      role: authorRole.trim() || 'OneTutor Student',
      avatar: null,
      rating: Number(rating) || 5,
      date: 'Just now',
      tag: matchedCourse.categoryName?.toLowerCase().includes('cloud') ? 'CLOUD' : 'WEB',
      courseId: matchedCourse.id,
      courseTitle: matchedCourse.name,
      title: reviewTitle.trim(),
      comment: reviewComment.trim(),
      likes: 1,
      verified: true
    };

    setReviews(prev => [newRev, ...prev]);
    setSubmitSuccess(true);
    setTimeout(() => {
      setIsModalOpen(false);
      setReviewTitle('');
      setReviewComment('');
      setAuthorRole('');
      setSubmitSuccess(false);
      setCurrentIndex(0);
      setProgress(0);
    }, 1200);
  };

  // Dynamic CSS translation for smooth continuous slide track
  const trackTransform = `translateX(calc(-${currentIndex} * ((100% + 20px) / ${cardsPerView})))`;

  const totalDots = maxIndex + 1;

  return (
    <section className="ud-reviews-section">
      <div className="ud-main-container">
        {/* Top Header Row */}
        <div className="ud-reviews-top-row">
          <div>
            <div className="ud-reviews-badge">
              <i className="fa-solid fa-star" style={{ color: '#f59e0b', marginRight: '6px' }}></i>
              STUDENT & LEARNER REVIEWS
            </div>
            <h2 className="ud-section-title" style={{ marginTop: '8px', marginBottom: '8px' }}>
              What Our Students Say About OneTutor
            </h2>
            <p className="ud-section-subtitle" style={{ margin: 0 }}>
              Real reviews, career breakthroughs, and learning outcomes from over 15,000+ developers, engineers, and students.
            </p>
          </div>
        </div>

        {/* Real-time Satisfaction Metrics Ribbon */}
        <div className="ud-reviews-stats-strip">
          <div className="ud-reviews-stat-card">
            <div className="ud-reviews-stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <i className="fa-solid fa-star"></i>
            </div>
            <div className="ud-reviews-stat-num">
              <span>4.8</span>
              <span style={{ fontSize: '1.1rem', color: '#f59e0b', marginLeft: '2px' }}>★</span>
            </div>
            <div className="ud-reviews-stat-lbl">Average Learner Rating</div>
            <div className="ud-reviews-stat-sub">From 3,400+ verified ratings</div>
          </div>

          <div className="ud-reviews-stat-card">
            <div className="ud-reviews-stat-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <i className="fa-solid fa-chart-line"></i>
            </div>
            <div className="ud-reviews-stat-num">96%</div>
            <div className="ud-reviews-stat-lbl">Career Confidence</div>
            <div className="ud-reviews-stat-sub">Reported improved skills & interview readiness</div>
          </div>

          <div className="ud-reviews-stat-card">
            <div className="ud-reviews-stat-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
              <i className="fa-solid fa-users"></i>
            </div>
            <div className="ud-reviews-stat-num">15,000+</div>
            <div className="ud-reviews-stat-lbl">Active Students</div>
            <div className="ud-reviews-stat-sub">Building production applications globally</div>
          </div>

          <div className="ud-reviews-stat-card">
            <div className="ud-reviews-stat-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <i className="fa-solid fa-briefcase"></i>
            </div>
            <div className="ud-reviews-stat-num">89%</div>
            <div className="ud-reviews-stat-lbl">Career Advancement</div>
            <div className="ud-reviews-stat-sub">Earned a promotion or landed a new job</div>
          </div>
        </div>

        {/* ====================================================================
            CONTINUOUS AUTOPLAY SLIDER VIEWPORT & TRACK
            Smoothly slides automatically, can be navigated manually,
            and resumes auto-sliding seamlessly.
            ==================================================================== */}
        <div
          className="ud-testimonials-slider-viewport"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="ud-testimonials-slider-track"
            style={{ transform: trackTransform }}
          >
            {filteredReviews.map((r) => {
              return (
                <div key={r.id} className="ud-testimonial-slide-card">
                  <div className="ud-review-card" style={{ height: '100%' }}>
                    {/* Card Top: Stars & Quote Icon */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div className="ud-review-stars">
                        {[...Array(5)].map((_, i) => (
                          <i
                            key={i}
                            className={`fa-star ${i < r.rating ? 'fa-solid' : 'fa-regular'}`}
                            style={{ color: i < r.rating ? '#f59e0b' : '#d1d5db', fontSize: '0.92rem' }}
                          ></i>
                        ))}
                        <span style={{ marginLeft: '6px', fontSize: '0.85rem', fontWeight: 800, color: 'var(--ud-black)' }}>
                          5.0
                        </span>
                      </div>
                      <div className="ud-review-quote-mark">
                        <i className="fa-solid fa-quote-right"></i>
                      </div>
                    </div>

                    {/* Headline & Body */}
                    <h4 className="ud-review-title">{r.title}</h4>
                    <p className="ud-review-comment">"{r.comment}"</p>

                    {/* Author Meta Footer */}
                    <div className="ud-review-author-box">
                      <div className="ud-review-avatar-container">
                        {r.avatar ? (
                          <img
                            src={r.avatar}
                            alt={r.name}
                            className="ud-review-avatar-img"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextSibling) {
                                e.currentTarget.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className="ud-review-avatar-fallback"
                          style={{ display: r.avatar ? 'none' : 'flex' }}
                        >
                          {r.name.slice(0, 2).toUpperCase()}
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="ud-review-author-name">{r.name}</span>
                          {r.verified && (
                            <span className="ud-review-verified" title="Verified Enrolled Student">
                              <i className="fa-solid fa-circle-check"></i> Verified
                            </span>
                          )}
                        </div>
                        <div className="ud-review-author-role">{getRoleOnly(r.role)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Smooth Auto-play Progress Bar Indicator */}
          {maxIndex > 0 && (
            <div className="ud-autoplay-progress-track" title="Time until next testimonial">
              <div
                className="ud-autoplay-progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Interactive Pagination Indicator Dots */}
        {totalDots > 1 && (
          <div className="ud-reviews-dots-row">
            {[...Array(totalDots)].map((_, i) => (
              <button
                key={i}
                type="button"
                className={`ud-reviews-dot ${i === currentIndex ? 'active' : ''}`}
                onClick={() => handleManualChange(i)}
                aria-label={`Jump to testimonial position ${i + 1}`}
                title={`Jump to slide ${i + 1} (auto resumes afterwards)`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ====================================================================
          "SHARE YOUR STORY" MODAL FORM
          ==================================================================== */}
      {isModalOpen && (
        <div className="ud-review-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="ud-review-modal-card" onClick={e => e.stopPropagation()}>
            <div className="ud-review-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--ud-black)' }}>
                  Share Your OneTutor Experience
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--ud-gray)' }}>
                  Inspire future engineers by sharing your learning and career milestones.
                </p>
              </div>
              <button
                type="button"
                className="ud-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close review modal"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {submitSuccess ? (
              <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', color: '#10b981', marginBottom: '14px' }}>
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '8px' }}>
                  Thank you for your testimonial!
                </h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--ud-gray)', margin: 0 }}>
                  Your story has been added to our verified community showcase.
                </p>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="ud-review-form">
                {/* Star Rating Picker */}
                <div className="ud-form-group">
                  <label className="ud-form-label">Overall Experience Rating</label>
                  <div className="ud-star-picker">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isHighlighted = (hoverRating || rating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          className="ud-star-picker-btn"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                          title={`${star} Star${star > 1 ? 's' : ''}`}
                        >
                          <i
                            className={`fa-star ${isHighlighted ? 'fa-solid' : 'fa-regular'}`}
                            style={{ color: isHighlighted ? '#f59e0b' : '#d1d5db' }}
                          ></i>
                        </button>
                      );
                    })}
                    <span style={{ marginLeft: '12px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--ud-black)' }}>
                      {rating} of 5 Stars
                    </span>
                  </div>
                </div>

                {/* Course Selector */}
                <div className="ud-form-group">
                  <label className="ud-form-label">Which course did you take?</label>
                  <select
                    className="ud-form-input"
                    value={selectedCourseId}
                    onChange={e => setSelectedCourseId(e.target.value)}
                    required
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.categoryName || 'General'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role / Current Title */}
                <div className="ud-form-group">
                  <label className="ud-form-label">Your Current Role</label>
                  <input
                    type="text"
                    className="ud-form-input"
                    placeholder="e.g. Frontend Developer, Full Stack Developer, CS Student"
                    value={authorRole}
                    onChange={e => setAuthorRole(e.target.value)}
                  />
                </div>

                {/* Headline / Title */}
                <div className="ud-form-group">
                  <label className="ud-form-label">Testimonial Headline</label>
                  <input
                    type="text"
                    className="ud-form-input"
                    placeholder="e.g. Landed my first tech job after completing this course!"
                    value={reviewTitle}
                    onChange={e => setReviewTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Comment */}
                <div className="ud-form-group">
                  <label className="ud-form-label">Detailed Feedback & Story</label>
                  <textarea
                    rows={4}
                    className="ud-form-input"
                    placeholder="Describe how the lectures, curriculum, or hands-on projects helped you..."
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    required
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                  <button
                    type="button"
                    className="ud-btn-secondary"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="ud-btn-primary"
                    disabled={!reviewTitle.trim() || !reviewComment.trim()}
                  >
                    Publish Testimonial
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
