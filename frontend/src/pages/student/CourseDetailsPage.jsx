import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getCourse } from '../../api/courses';
import { enroll, myCourses } from '../../api/enrollment';
import { listSections } from '../../api/sections';
import { listContents } from '../../api/contents';
import { getCourseBatches } from '../../api/batches';
import RelatedCoursesSection from '../../components/RelatedCoursesSection';
import CoursePaymentModal from '../../components/CoursePaymentModal';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import { validateAndApplyCoupon, AVAILABLE_COUPONS } from '../../utils/couponUtils';
import { validateCoupon, getAvailableCoupons } from '../../api/coupons';
import {
  getCourseReviews,
  getCourseRatingSummary,
  getMyCourseReview,
  submitCourseReview,
  deleteMyCourseReview
} from '../../api/reviews';
import { getCourseDefaultRating } from '../../utils/courseRatingUtils';
import { toast, confirmDialog } from '../../context/NotificationContext';

export default function CourseDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [contentsBySection, setContentsBySection] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [enrolledBatch, setEnrolledBatch] = useState(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [error, setError] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);

  // Reviews & Ratings state
  const [reviews, setReviews] = useState([]);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [helpfulVotes, setHelpfulVotes] = useState({});

  const toggleHelpful = (reviewId) => {
    setHelpfulVotes((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId]
    }));
  };

  // Carousel Slider state (matching home page StudentReviewsSection)
  const [sliderIndex, setSliderIndex] = useState(0);
  const [sliderProgress, setSliderProgress] = useState(0);
  const [isSliderHovered, setIsSliderHovered] = useState(false);
  const [sliderTouchStart, setSliderTouchStart] = useState(null);
  const [sliderCardsPerView, setSliderCardsPerView] = useState(() => {
    if (typeof window === 'undefined') return 2;
    return window.innerWidth <= 680 ? 1 : 2;
  });

  const sliderCooldownTimeoutRef = useRef(null);

  useEffect(() => {
    function handleSliderResize() {
      setSliderCardsPerView(window.innerWidth <= 680 ? 1 : 2);
    }
    window.addEventListener('resize', handleSliderResize);
    return () => window.removeEventListener('resize', handleSliderResize);
  }, []);

  useEffect(() => {
    getAvailableCoupons()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableCoupons(data);
        }
      })
      .catch(() => {});
  }, []);

  const loadReviewsData = async () => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const [revData, sumData] = await Promise.all([
        getCourseReviews(id, { page: 0, size: 25 }),
        getCourseRatingSummary(id)
      ]);
      setReviews(revData?.content || []);
      setRatingSummary(sumData);

      if (user) {
        const mine = await getMyCourseReview(id).catch(() => null);
        if (mine) {
          setMyReview(mine);
          setReviewRating(mine.rating || 5);
          setReviewComment(mine.comment || '');
        } else {
          setMyReview(null);
        }
      }
    } catch (e) {
      console.error('Failed to load course reviews', e);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    loadReviewsData();
  }, [id, user]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/student/courses/${id}`)}`);
      return;
    }
    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      toast.error('Please choose a star rating from 1 to 5.');
      return;
    }
    setSubmittingReview(true);
    try {
      await submitCourseReview(id, {
        rating: reviewRating,
        comment: reviewComment.trim() || null
      });
      toast.success(
        myReview
          ? 'Your rating & review have been updated!'
          : 'Thank you! Your rating and review have been submitted and will appear once published.'
      );
      setIsEditingReview(false);
      loadReviewsData();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit review.';
      toast.error(msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    const ok = await confirmDialog({
      title: 'Delete Your Review?',
      description: 'Are you sure you want to remove your rating and comment for this course?',
      confirmText: 'Delete Review',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      await deleteMyCourseReview(id);
      toast.success('Your review was removed.');
      setMyReview(null);
      setReviewRating(5);
      setReviewComment('');
      setIsEditingReview(false);
      loadReviewsData();
    } catch (err) {
      toast.error('Failed to delete review.');
    }
  };

  // Default baseline rating per course when dynamic reviews are few (< 5)
  // When dynamic ratings increase (>= 5), automatically switch to 100% dynamic rating
  const effectiveRatingSummary = useMemo(() => {
    return getCourseDefaultRating(id, ratingSummary);
  }, [id, ratingSummary]);

  // Only published comments with text can show in the student reviews carousel
  const filteredCourseReviews = useMemo(() => {
    return (reviews || []).filter(
      (rev) => rev.comment && rev.comment.trim() !== '' && rev.status === 'published'
    );
  }, [reviews]);

  const maxSliderIndex = Math.max(0, filteredCourseReviews.length - sliderCardsPerView);

  useEffect(() => {
    setSliderIndex(0);
    setSliderProgress(0);
  }, [filteredCourseReviews.length]);

  useEffect(() => {
    if (maxSliderIndex <= 0 || isSliderHovered) {
      return;
    }

    const interval = setInterval(() => {
      setSliderProgress((prev) => {
        const next = prev + (50 / 4500) * 100;
        if (next >= 100) {
          setSliderIndex((curr) => (curr >= maxSliderIndex ? 0 : curr + 1));
          return 0;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [maxSliderIndex, isSliderHovered]);

  const handleSliderManualChange = (newIndex) => {
    const clamped = Math.max(0, Math.min(newIndex, maxSliderIndex));
    setSliderIndex(clamped);
    setSliderProgress(0);
    setIsSliderHovered(true);

    if (sliderCooldownTimeoutRef.current) {
      clearTimeout(sliderCooldownTimeoutRef.current);
    }
    sliderCooldownTimeoutRef.current = setTimeout(() => {
      setIsSliderHovered(false);
    }, 4000);
  };

  const handleSliderPrev = () => {
    const target = sliderIndex <= 0 ? maxSliderIndex : sliderIndex - 1;
    handleSliderManualChange(target);
  };

  const handleSliderNext = () => {
    const target = sliderIndex >= maxSliderIndex ? 0 : sliderIndex + 1;
    handleSliderManualChange(target);
  };

  const handleSliderTouchStart = (e) => {
    setSliderTouchStart(e.targetTouches[0].clientX);
    setIsSliderHovered(true);
  };

  const handleSliderTouchEnd = (e) => {
    setIsSliderHovered(false);
    if (!sliderTouchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = sliderTouchStart - touchEnd;
    if (diff > 50) {
      handleSliderNext();
    } else if (diff < -50) {
      handleSliderPrev();
    }
    setSliderTouchStart(null);
  };

  const handleApplyCoupon = async (codeToUse) => {
    setCouponError('');
    const code = (codeToUse || couponCode).trim().toUpperCase();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    setCouponLoading(true);
    try {
      const res = await validateCoupon(code, course?.price || 0, course?.id);
      if (!res.valid) {
        setCouponError(res.message || 'Invalid or expired coupon.');
        return;
      }
      setAppliedCoupon({
        valid: true,
        code: res.code,
        discount: Number(res.discount),
        finalPrice: Number(res.finalPrice),
        label: res.discountType === 'PERCENTAGE' ? `${res.discountValue}% OFF` : `₹${res.discountValue} OFF`,
        description: res.description
      });
      setCouponCode(res.code);
    } catch (err) {
      const fallback = validateAndApplyCoupon(code, course?.price, course?.currency);
      if (fallback.valid) {
        setAppliedCoupon(fallback);
        setCouponCode(fallback.code);
      } else {
        const errorMsg = err.response?.data?.message || err.response?.data?.error?.message || fallback.error || 'Invalid or expired coupon.';
        setCouponError(errorMsg);
      }
    } finally {
      setCouponLoading(false);
    }
  };

  const displayedCouponsList = useMemo(() => {
    if (availableCoupons && availableCoupons.length > 0) {
      const filtered = availableCoupons.filter(c => {
        if (c.scope === 'COURSE' && c.courseId && course?.id && c.courseId !== course.id) return false;
        if (c.scope === 'CATEGORY' && c.categoryId && course?.categoryId && c.categoryId !== course.categoryId) return false;
        return true;
      });
      return (filtered.length > 0 ? filtered : availableCoupons).slice(0, 4);
    }
    return AVAILABLE_COUPONS.slice(0, 3);
  }, [availableCoupons, course]);

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  useEffect(() => {
    getCourse(id)
      .then(setCourse)
      .catch(() => setError('Course not found or unavailable.'));

    getCourseBatches(id)
      .then((data) => {
        const batchList = data || [];
        setBatches(batchList);
        const firstAvailable = batchList.find(b => isBatchEnrollable(b));
        if (firstAvailable) {
          setSelectedBatchId(firstAvailable.id);
        } else if (batchList.length > 0) {
          setSelectedBatchId(batchList[0].id);
        }
      })
      .catch(() => setBatches([]));

    listSections(id)
      .then(async (secData) => {
        setSections(secData || []);
        if (secData?.length > 0) {
          setExpandedSections({ [secData[0].id]: true });
        }
        const map = {};
        for (const s of (secData || [])) {
          const contents = await listContents(s.id).catch(() => []);
          map[s.id] = contents || [];
        }
        setContentsBySection(map);
      })
      .catch(() => {});

    if (user) {
      myCourses({ size: 100 })
        .then((res) => {
          const myEnr = (res?.content || []).find((c) => String(c.courseId) === String(id));
          if (myEnr) {
            setIsEnrolled(true);
            if (myEnr.batchName) {
              setEnrolledBatch({ name: myEnr.batchName, code: myEnr.batchCode });
            }
          }
        })
        .catch(() => {});
    }
  }, [id, user]);

  const isBatchEnrollable = (batch) => {
    if (!batch) return false;
    const status = (batch.status || '').toLowerCase();
    if (status === 'completed' || status === 'cancelled' || status === 'full') {
      return false;
    }
    if (batch.isFull) return false;
    if (typeof batch.capacity === 'number' && batch.capacity > 0 && batch.enrolledCount >= batch.capacity) {
      return false;
    }
    if (typeof batch.availableSeats === 'number' && batch.availableSeats <= 0) {
      return false;
    }
    return true;
  };

  const hasBatches = batches.length > 0;
  // Course is only considered full if batches are used and all of them are full/closed
  const isBatchFull = hasBatches ? !batches.some(b => isBatchEnrollable(b)) : false;
  const isPublished = !course?.status || course.status.toLowerCase() === 'published';
  const isPaidCourse = (course?.pricingType === 'subscription' || course?.pricingType === 'paid') && Number(course?.price) > 0;
  const currencySymbol = course?.currency === 'USD' ? '$' : '₹';

  const handleEnroll = async () => {
    if (!isPublished) return;
    if (isBatchFull) return;

    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/student/courses/${id}`)}`);
      return;
    }

    if (isPaidCourse) {
      setShowPaymentModal(true);
      return;
    }

    // Automatically select the first enrollable batch if the course has batches
    let batchIdToUse = null;
    if (batches.length > 0) {
      const openBatch = batches.find(b => isBatchEnrollable(b)) || batches[0];
      batchIdToUse = openBatch?.id;
    }

    setEnrolling(true);
    setError('');
    try {
      const enrRes = await enroll(id, { batchId: batchIdToUse ? Number(batchIdToUse) : null });
      setIsEnrolled(true);
      const chosen = batches.find(b => b.id === (enrRes?.batchId || batchIdToUse));
      if (enrRes?.batchName || chosen) {
        setEnrolledBatch({
          id: enrRes?.batchId || batchIdToUse,
          name: enrRes?.batchName || chosen?.name,
          code: enrRes?.batchCode || chosen?.code
        });
      }
      navigate(`/student/learn/${id}`);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.data?.error?.code === 'UNAUTHORIZED') {
        navigate(`/login?redirect=${encodeURIComponent(`/student/courses/${id}`)}`);
      } else if (err.response?.data?.code === 'ALREADY_ENROLLED') {
        setIsEnrolled(true);
        navigate(`/student/learn/${id}`);
      } else {
        setError(err.response?.data?.message || 'Could not enroll in course.');
      }
    } finally {
      setEnrolling(false);
    }
  };

  const toggleSection = (secId) => {
    setExpandedSections(prev => ({ ...prev, [secId]: !prev[secId] }));
  };

  const toggleAllSections = () => {
    const allExpanded = sections.every(s => expandedSections[s.id]);
    const nextState = {};
    sections.forEach(s => {
      nextState[s.id] = !allExpanded;
    });
    setExpandedSections(nextState);
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: course?.name ? `${course.name} | OneTutor` : 'OneTutor Course',
          text: course?.shortDesc
            ? `Check out "${course.name}" on OneTutor: ${course.shortDesc}`
            : `Check out "${course?.name || 'this course'}" on OneTutor!`,
          url: window.location.href,
        });
        return;
      } catch (err) {}
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {}
  };

  const totalLectures = useMemo(() => {
    return Object.values(contentsBySection).reduce((acc, curr) => acc + (curr?.length || 0), 0);
  }, [contentsBySection]);

  const outcomesList = useMemo(() => {
    return course?.learningOutcomes
      ? course.learningOutcomes.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
  }, [course?.learningOutcomes]);

  const prereqsList = useMemo(() => {
    return course?.prerequisites
      ? course.prerequisites.split('\n').map(s => s.trim()).filter(Boolean)
      : [];
  }, [course?.prerequisites]);

  if (error && !course) {
    return (
      <div className="ot-cd-error-wrap">
        <div className="ot-cd-error-icon">
          <i className="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h2>{error}</h2>
        <p>The requested course curriculum may have been moved or unlisted by the instructor.</p>
        <Link to="/student/courses" className="ot-cd-btn-primary" style={{ maxWidth: '260px' }}>
          <i className="fa-solid fa-arrow-left"></i>
          <span>Return to Catalog</span>
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="ot-cd-loading-wrap">
        <div className="ot-cd-spinner"></div>
        <p>Loading course details and curriculum content...</p>
      </div>
    );
  }

  return (
    <div className="ot-cd-page">
      <style>{`
        .ot-cd-page {
          font-family: Inter, system-ui, -apple-system, sans-serif;
          color: #0f172a;
          background: #f8fafc;
          min-height: 100vh;
        }

        .ot-cd-loading-wrap, .ot-cd-error-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 120px 20px;
          text-align: center;
        }
        .ot-cd-error-icon {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: #fef2f2;
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.2rem;
          margin-bottom: 20px;
        }
        .ot-cd-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #cbd5e1;
          border-top-color: #5A70D3;
          border-radius: 50%;
          animation: otSpin 0.8s linear infinite;
          margin-bottom: 18px;
        }
        @keyframes otSpin { to { transform: rotate(360deg); } }

        /* MODERN HERO HEADER */
        .ot-cd-hero {
          background: radial-gradient(circle at 80% 20%, rgba(0, 168, 132, 0.18) 0%, transparent 45%),
                      linear-gradient(135deg, #07111a 0%, #0b1c2d 50%, #11263c 100%);
          color: #ffffff;
          padding: 48px 0 60px 0;
          position: relative;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ot-cd-hero-container {
          max-width: 1360px;
          margin: 0 auto;
          padding: 0 24px;
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 48px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .ot-cd-hero-container {
            grid-template-columns: 1fr;
          }
        }

        .ot-cd-breadcrumbs {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.86rem;
          color: #94a3b8;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .ot-cd-breadcrumbs a {
          color: #38bdf8;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.15s;
        }
        .ot-cd-breadcrumbs a:hover { color: #7dd3fc; }

        .ot-cd-hero-title {
          font-size: 2.5rem;
          font-weight: 850;
          line-height: 1.22;
          letter-spacing: -0.025em;
          margin: 0 0 16px 0;
          color: #ffffff;
        }
        @media (max-width: 768px) {
          .ot-cd-hero-title { font-size: 1.85rem; }
        }

        .ot-cd-hero-subtitle {
          font-size: 1.1rem;
          line-height: 1.65;
          color: #94a3b8;
          margin: 0 0 26px 0;
          max-width: 820px;
        }

        .ot-cd-meta-row {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          font-size: 0.88rem;
        }
        .ot-cd-badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 14px;
          border-radius: 9999px;
          font-size: 0.82rem;
          font-weight: 700;
          backdrop-filter: blur(8px);
        }
        .ot-cd-rating-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          padding: 6px 14px;
          border-radius: 9999px;
          font-weight: 800;
          font-size: 0.88rem;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .ot-cd-instructor-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 4px 12px 4px 6px;
          border-radius: 30px;
          color: #ffffff;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .ot-cd-avatar-mini {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #5A70D3;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 800;
        }

        /* FLOATING STICKY ACTION CARD */
        .ot-cd-sticky-wrap {
          position: sticky;
          top: 24px;
          z-index: 30;
        }
        .ot-cd-card {
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 20px 50px rgba(11, 31, 58, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
          overflow: hidden;
        }
        .ot-cd-card-media {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: #0f172a;
          overflow: hidden;
        }
        .ot-cd-card-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .ot-cd-card-media:hover img {
          transform: scale(1.03);
        }
        .ot-cd-play-btn {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #5A70D3;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.3rem;
          box-shadow: 0 10px 25px rgba(90, 112, 211, 0.45);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 3px solid rgba(255, 255, 255, 0.9);
        }
        .ot-cd-play-btn:hover {
          transform: translate(-50%, -50%) scale(1.1);
          background: #007559;
          box-shadow: 0 14px 30px rgba(90, 112, 211, 0.6);
        }

        .ot-cd-card-body {
          padding: 24px;
          color: #0f172a;
        }

        .ot-cd-price-tag {
          font-size: 1.75rem;
          font-weight: 850;
          color: #5A70D3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .ot-cd-btn-primary {
          width: 100%;
          padding: 14px 24px;
          border-radius: 12px;
          border: none;
          background: #5A70D3;
          color: #ffffff;
          font-size: 1.02rem;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 6px 18px rgba(90, 112, 211, 0.3);
          transition: all 0.18s ease;
          text-decoration: none;
        }
        .ot-cd-btn-primary:hover {
          background: #007559;
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(90, 112, 211, 0.4);
        }
        .ot-cd-btn-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
          transform: none;
        }

        .ot-cd-enrolled-batch-card {
          background: #f0fdf4;
          border: 1.5px solid #86efac;
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 18px;
        }
        .ot-cd-enrolled-batch-header {
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #166534;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ot-cd-enrolled-batch-body {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .ot-cd-enrolled-batch-name {
          font-size: 0.95rem;
          font-weight: 800;
          color: #14532d;
        }
        .ot-cd-enrolled-batch-badge {
          background: #dcfce7;
          color: #15803d;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          border: 1px solid #bbf7d0;
        }

        .ot-cd-features-list {
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ot-cd-feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.88rem;
          color: #475569;
          font-weight: 600;
        }
        .ot-cd-feature-item i {
          color: #5A70D3;
          font-size: 0.95rem;
          width: 20px;
          text-align: center;
        }

        .ot-cd-share-btn {
          width: 100%;
          margin-top: 16px;
          padding: 11px;
          border: 1.5px dashed #cbd5e1;
          border-radius: 10px;
          background: transparent;
          color: #5A70D3;
          font-weight: 700;
          font-size: 0.88rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s ease;
        }
        .ot-cd-share-btn:hover {
          background: rgba(90, 112, 211, 0.08);
          border-color: #5A70D3;
        }

        /* MAIN CONTENT AREA & RESPONSIVE LAYOUT */
        .ot-cd-main-wrap {
          max-width: 1360px;
          margin: 0 auto;
          padding: 36px 24px 80px 24px;
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 48px;
        }

        .ot-cd-content-col {
          display: flex;
          flex-direction: column;
          gap: 32px;
          min-width: 0;
        }

        .ot-cd-sidebar-col {
          min-width: 0;
        }

        .ot-cd-related-mobile-wrap {
          display: none;
        }
        .ot-cd-related-desktop-wrap {
          display: block;
        }

        @media (max-width: 1140px) {
          .ot-cd-main-wrap {
            grid-template-columns: 1fr 380px;
            gap: 32px;
            padding: 28px 20px 70px 20px;
          }
        }

        @media (max-width: 992px) {
          .ot-cd-hero {
            padding: 32px 0 40px 0;
          }
          .ot-cd-hero-container {
            grid-template-columns: 1fr;
            padding: 0 16px;
            gap: 24px;
          }
          .ot-cd-hero-title {
            font-size: 2rem;
          }
          .ot-cd-main-wrap {
            display: flex;
            flex-direction: column;
            gap: 32px;
            padding: 24px 16px 60px 16px;
          }
          .ot-cd-sidebar-col {
            order: -1;
            width: 100%;
          }
          .ot-cd-related-desktop-wrap {
            display: none !important;
          }
          .ot-cd-related-mobile-wrap {
            display: block !important;
            margin-top: 12px;
          }
          .ot-cd-sticky-wrap {
            position: relative;
            top: 0;
            max-width: 520px;
            margin: 0 auto;
            width: 100%;
          }
        }

        @media (max-width: 640px) {
          .ot-cd-hero {
            padding: 20px 0 28px 0;
          }
          .ot-cd-hero-container {
            padding: 0 12px;
          }
          .ot-cd-hero-title {
            font-size: 1.55rem;
            line-height: 1.25;
            margin-bottom: 12px;
          }
          .ot-cd-hero-subtitle {
            font-size: 0.94rem;
            line-height: 1.5;
            margin-bottom: 18px;
          }
          .ot-cd-meta-row {
            gap: 8px;
          }
          .ot-cd-badge-pill,
          .ot-cd-rating-badge,
          .ot-cd-instructor-pill {
            font-size: 0.78rem;
            padding: 4px 10px;
          }
          .ot-cd-main-wrap {
            padding: 16px 12px 50px 12px;
            gap: 20px;
          }
          .ot-cd-content-col {
            gap: 20px;
          }
          .ot-cd-card-box {
            padding: 18px 14px;
            border-radius: 14px;
          }
          .ot-cd-card-header-title {
            font-size: 1.15rem;
            margin-bottom: 14px;
          }
          .ot-cd-outcomes-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .ot-cd-outcome-item {
            font-size: 0.88rem;
          }
          .ot-cd-accordion-btn {
            padding: 13px 14px;
          }
          .ot-cd-sec-num {
            width: 24px;
            height: 24px;
            font-size: 0.75rem;
          }
          .ot-cd-lecture-row {
            padding: 12px 14px;
            font-size: 0.86rem;
            flex-wrap: wrap;
            gap: 8px;
          }
          .ot-cd-card-body {
            padding: 18px 14px;
          }
          .ot-cd-price-tag {
            font-size: 1.45rem;
          }
          .ot-cd-btn-primary {
            padding: 12px 18px;
            font-size: 0.95rem;
          }
        }

        /* SECTION CARDS */
        .ot-cd-card-box {
          background: #ffffff;
          border-radius: 18px;
          padding: 30px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 20px rgba(11, 31, 58, 0.03);
        }
        .ot-cd-card-header-title {
          font-size: 1.3rem;
          font-weight: 850;
          color: #0f172a;
          margin: 0 0 20px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* OUTCOMES GRID */
        .ot-cd-outcomes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 14px 24px;
        }
        .ot-cd-outcome-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 0.94rem;
          color: #334155;
          line-height: 1.5;
        }
        .ot-cd-outcome-check {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(90, 112, 211, 0.08);
          color: #5A70D3;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          flex-shrink: 0;
          margin-top: 2px;
          border: 1px solid #a7f3d0;
        }

        /* ACCORDION CURRICULUM */
        .ot-cd-accordion-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ot-cd-accordion-item {
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.18s;
        }
        .ot-cd-accordion-item.is-active {
          border-color: #5A70D3;
        }
        .ot-cd-accordion-btn {
          width: 100%;
          padding: 16px 20px;
          background: #f8fafc;
          border: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background 0.15s;
        }
        .ot-cd-accordion-btn:hover {
          background: #f1f5f9;
        }
        .ot-cd-sec-num {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #e2e8f0;
          color: #475569;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.82rem;
          font-weight: 800;
        }
        .ot-cd-accordion-item.is-active .ot-cd-sec-num {
          background: #5A70D3;
          color: #ffffff;
        }
        .ot-cd-lecture-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-top: 1px solid #f1f5f9;
          background: #ffffff;
          font-size: 0.92rem;
          color: #334155;
        }
        .ot-cd-lecture-row:hover { background: #f8fafc; }

        .ot-cd-bullet-list {
          padding-left: 20px;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          color: #334155;
          font-size: 0.96rem;
          line-height: 1.6;
        }

        /* =========================================================
           STUDENT RATINGS & REVIEWS SECTION (COMPACT & MODERN STYLING)
           ========================================================= */
        .ot-cd-reviews-card-box {
          background: #ffffff;
          border-radius: 16px;
          padding: 22px 24px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.04);
          position: relative;
          overflow: hidden;
          margin-bottom: 24px;
        }
        .ot-cd-reviews-card-box::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #5A70D3 0%, #6366F1 50%, #818CF8 100%);
        }

        .ot-cd-reviews-header-wrap {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 18px;
        }
        .ot-cd-reviews-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ot-cd-reviews-icon-badge {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #5A70D3 0%, #3B4EAF 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          box-shadow: 0 2px 8px rgba(90, 112, 211, 0.25);
        }
        .ot-cd-reviews-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .ot-cd-reviews-subtitle {
          margin: 2px 0 0;
          color: #64748b;
          font-size: 0.8rem;
          font-weight: 500;
        }
        .ot-cd-reviews-meta-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          color: #059669;
          background: #ECFDF5;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid #A7F3D0;
        }

        /* Compact Summary & Star Distribution Grid */
        .ot-cd-reviews-summary-card {
          display: grid;
          grid-template-columns: 190px 1fr;
          gap: 20px;
          padding: 16px 20px;
          background: #F8FAFC;
          border-radius: 14px;
          border: 1px solid #E2E8F0;
          margin-bottom: 20px;
          align-items: center;
          position: relative;
        }
        .ot-cd-reviews-score-box {
          text-align: center;
          padding: 12px 14px;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.02);
        }
        .ot-cd-reviews-score-num-wrap {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 3px;
        }
        .ot-cd-reviews-score-num {
          font-size: 2.3rem;
          font-weight: 900;
          color: #0f172a;
          line-height: 1;
          letter-spacing: -0.03em;
        }
        .ot-cd-reviews-score-scale {
          font-size: 0.95rem;
          font-weight: 700;
          color: #94a3b8;
        }
        .ot-cd-reviews-score-stars {
          display: flex;
          justify-content: center;
          gap: 4px;
          margin: 6px 0 4px;
          color: #f59e0b;
          font-size: 0.95rem;
        }
        .ot-cd-reviews-score-label {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          font-weight: 800;
          color: #5A70D3;
          background: #EEF2FF;
          padding: 2px 7px;
          border-radius: 10px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .ot-cd-reviews-score-sub {
          font-size: 0.74rem;
          color: #64748b;
          margin-top: 4px;
          font-weight: 500;
        }

        .ot-cd-reviews-dist-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ot-cd-dist-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.8rem;
          padding: 1px 4px;
          border-radius: 6px;
          transition: background 0.15s ease;
        }
        .ot-cd-dist-row:hover {
          background: rgba(255, 255, 255, 0.7);
        }
        .ot-cd-dist-star-label {
          display: flex;
          align-items: center;
          gap: 4px;
          width: 40px;
          color: #334155;
          font-weight: 700;
          font-size: 0.8rem;
          flex-shrink: 0;
        }
        .ot-cd-dist-bar-track {
          flex: 1;
          height: 7px;
          background: #E2E8F0;
          border-radius: 999px;
          overflow: hidden;
        }
        .ot-cd-dist-bar-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
          transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .ot-cd-dist-pct {
          width: 58px;
          text-align: right;
          color: #475569;
          font-weight: 700;
          font-size: 0.78rem;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 3px;
        }
        .ot-cd-dist-count {
          color: #94a3b8;
          font-weight: 500;
          font-size: 0.72rem;
        }

        /* My Review Featured Card Box */
        .ot-cd-my-review-featured-box {
          background: linear-gradient(180deg, #FAFBFD 0%, #ffffff 100%);
          border: 1.5px solid rgba(90, 112, 211, 0.2);
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 20px;
          box-shadow: 0 2px 10px rgba(90, 112, 211, 0.04);
          transition: all 0.2s ease;
        }
        .ot-cd-my-review-featured-box:hover {
          border-color: #5A70D3;
          box-shadow: 0 4px 16px rgba(90, 112, 211, 0.08);
        }
        .ot-cd-badge-author {
          background: #EEF2FF;
          color: #4F46E5;
          font-weight: 750;
          font-size: 0.74rem;
          padding: 2px 8px;
          border-radius: 14px;
          border: 1px solid rgba(79, 70, 229, 0.2);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .ot-cd-verified-pill {
          background: #ECFDF5;
          color: #059669;
          font-weight: 700;
          font-size: 0.72rem;
          padding: 2px 7px;
          border-radius: 14px;
          border: 1px solid #A7F3D0;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .ot-cd-btn-edit {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 9px;
          font-size: 0.76rem;
          font-weight: 600;
          color: #5A70D3;
          background: #F1F3FD;
          border: 1px solid rgba(90, 112, 211, 0.25);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ot-cd-btn-edit:hover {
          background: #5A70D3;
          color: #ffffff;
        }
        .ot-cd-btn-delete {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 9px;
          font-size: 0.76rem;
          font-weight: 600;
          color: #ef4444;
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ot-cd-btn-delete:hover {
          background: #ef4444;
          color: #ffffff;
        }

        /* Review Submission Card Form */
        .ot-cd-review-form-card {
          background: #ffffff;
          border: 1.5px solid rgba(90, 112, 211, 0.2);
          border-radius: 14px;
          padding: 18px 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 12px rgba(90, 112, 211, 0.05);
        }
        .ot-cd-form-title {
          font-size: 1rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ot-cd-star-picker-container {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .ot-cd-star-btn {
          background: transparent;
          border: none;
          padding: 2px;
          font-size: 1.45rem;
          cursor: pointer;
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.15s;
        }
        .ot-cd-star-btn:hover {
          transform: scale(1.2);
        }
        .ot-cd-rating-desc-pill {
          font-size: 0.78rem;
          font-weight: 700;
          color: #5A70D3;
          background: #F1F3FD;
          padding: 3px 10px;
          border-radius: 14px;
          border: 1px solid rgba(90, 112, 211, 0.2);
        }
        .ot-cd-review-textarea {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1.5px solid #E2E8F0;
          font-size: 0.86rem;
          line-height: 1.5;
          color: #0f172a;
          background: #F8FAFC;
          resize: vertical;
          font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .ot-cd-review-textarea:focus {
          outline: none;
          background: #ffffff;
          border-color: #5A70D3;
          box-shadow: 0 0 0 2px rgba(90, 112, 211, 0.15);
        }
        .ot-cd-review-submit-btn {
          background: linear-gradient(135deg, #5A70D3 0%, #4055B2 100%) !important;
          color: #ffffff !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px 20px !important;
          font-weight: 700 !important;
          font-size: 0.86rem !important;
          box-shadow: 0 2px 8px rgba(90, 112, 211, 0.25) !important;
          cursor: pointer;
          transition: transform 0.18s, box-shadow 0.18s !important;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ot-cd-review-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(90, 112, 211, 0.35) !important;
        }

        /* Carousel Slider & Cards */
        .ot-cd-slider-viewport {
          position: relative;
          width: 100%;
          overflow: hidden;
          padding: 4px 2px 10px 2px;
        }
        .ot-cd-slider-track {
          display: flex;
          gap: 14px;
          transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
          will-change: transform;
        }
        .ot-cd-slide-card {
          flex: 0 0 calc((100% - 14px) / 2);
          min-width: 0;
          box-sizing: border-box;
        }
        @media (max-width: 680px) {
          .ot-cd-slide-card {
            flex: 0 0 100% !important;
          }
        }

        /* Compact Modern Review Card inside Course Reviews */
        .ot-cd-reviews-card-box .ud-review-card {
          background: #ffffff;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          padding: 16px 16px;
          box-shadow: 0 2px 10px -2px rgba(15, 23, 42, 0.04);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.22s ease;
          position: relative;
          height: 100%;
          min-height: 155px;
        }
        .ot-cd-reviews-card-box .ud-review-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -2px rgba(90, 112, 211, 0.1);
          border-color: #cbd5e1;
        }

        .ot-cd-card-score-pill {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: #FFFBEB;
          color: #B45309;
          border: 1px solid #FDE68A;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 0.74rem;
          font-weight: 800;
          margin-left: 5px;
        }
        .ot-cd-quote-bubble {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: #F1F5F9;
          color: #5A70D3;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.76rem;
          opacity: 0.85;
          flex-shrink: 0;
        }
        .ot-cd-reviews-card-box .ud-review-comment {
          font-size: 0.86rem;
          line-height: 1.55;
          color: #1e293b;
          margin: 3px 0 10px;
          font-style: normal;
          min-height: 38px;
        }
        .ot-cd-reviews-card-box .ud-review-author-box {
          display: flex;
          align-items: center;
          gap: 9px;
          border-top: 1px solid #F1F5F9;
          padding-top: 10px;
          margin-top: 8px;
        }
        .ot-cd-reviews-card-box .ud-review-avatar-container {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 1px 5px rgba(90, 112, 211, 0.18);
        }
        .ot-cd-reviews-card-box .ud-review-author-name {
          font-weight: 750;
          color: #0f172a;
          font-size: 0.84rem;
        }
        .ot-cd-helpful-pill-btn {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          color: #64748b;
          cursor: pointer;
          font-size: 0.72rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          border-radius: 14px;
          transition: all 0.15s ease;
        }
        .ot-cd-helpful-pill-btn:hover {
          background: #EEF2FF;
          color: #5A70D3;
          border-color: rgba(90, 112, 211, 0.3);
        }
        .ot-cd-helpful-pill-btn.active {
          background: #EEF2FF;
          color: #5A70D3;
          border-color: #5A70D3;
        }

        .ot-cd-arrow-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 1.5px solid #E2E8F0;
          background: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.18s ease;
          color: #475569;
          font-size: 0.76rem;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
        }
        .ot-cd-arrow-btn:hover {
          background: #5A70D3;
          border-color: #5A70D3;
          color: #ffffff;
          transform: scale(1.05);
          box-shadow: 0 3px 8px rgba(90, 112, 211, 0.25);
        }

        .ot-cd-dots-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 14px;
        }
        .ot-cd-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #cbd5e1;
          border: none;
          padding: 0;
          cursor: pointer;
          transition: all 0.22s ease;
        }
        .ot-cd-dot.active {
          width: 18px;
          background: linear-gradient(90deg, #5A70D3 0%, #6366F1 100%);
        }

        .ot-cd-progress-track {
          width: 100%;
          height: 2.5px;
          background: #E2E8F0;
          border-radius: 9999px;
          overflow: hidden;
          margin-top: 10px;
        }
        .ot-cd-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #5A70D3 0%, #6366F1 100%);
          border-radius: 9999px;
          transition: width 0.05s linear;
        }

        /* Mobile Adjustments for Reviews */
        @media (max-width: 640px) {
          .ot-cd-reviews-card-box {
            padding: 16px 14px !important;
            border-radius: 14px !important;
          }
          .ot-cd-reviews-header-wrap {
            margin-bottom: 14px;
          }
          .ot-cd-reviews-summary-card {
            grid-template-columns: 1fr;
            gap: 12px;
            padding: 14px 12px;
            border-radius: 12px;
            margin-bottom: 16px;
          }
          .ot-cd-reviews-score-box {
            padding: 10px 8px;
          }
          .ot-cd-reviews-score-num {
            font-size: 2rem;
          }
          .ot-cd-reviews-score-stars {
            font-size: 0.9rem;
            margin: 4px 0 2px;
          }
          .ot-cd-reviews-dist-list {
            gap: 6px;
          }
          .ot-cd-dist-row {
            font-size: 0.76rem;
            gap: 6px;
            padding: 1px 0;
          }
          .ot-cd-dist-star-label {
            width: 34px;
          }
          .ot-cd-dist-bar-track {
            height: 6px;
          }
          .ot-cd-dist-pct {
            width: 50px;
            font-size: 0.72rem;
          }
          .ot-cd-my-review-featured-box {
            padding: 14px 12px;
            border-radius: 12px;
            margin-bottom: 16px;
          }
          .ot-cd-review-form-card {
            padding: 14px 12px;
            border-radius: 12px;
            margin-bottom: 16px;
          }
          .ot-cd-star-picker-container {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
          }
          .ot-cd-star-btn {
            font-size: 1.35rem !important;
            padding: 1px !important;
          }
          .ot-cd-review-submit-btn {
            width: 100% !important;
            justify-content: center;
          }
        }
      `}</style>

      {/* HERO BANNER */}
      <section className="ot-cd-hero">
        <div className="ot-cd-hero-container">
          <div>
            {/* Course Title */}
            <h1 className="ot-cd-hero-title">{course.name}</h1>

            {/* Subtitle Tagline */}
            {course.shortDesc && (
              <p className="ot-cd-hero-subtitle">{course.shortDesc}</p>
            )}

            {/* Badges & Meta Row (Retaining Category, Level, Duration & Language) */}
            <div className="ot-cd-meta-row">
              {/* Category Pill */}
              {course.categoryName && (
                <div className="ot-cd-badge-pill" style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff' }}>
                  <i className="fa-solid fa-folder-open"></i>
                  <span>{course.categoryName}</span>
                </div>
              )}

              {/* Rating Pill */}
              <div className="ot-cd-badge-pill" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fef08a', border: '1px solid rgba(245, 158, 11, 0.4)', fontWeight: 800 }}>
                <i className="fa-solid fa-star" style={{ color: '#f59e0b' }}></i>
                <span>{effectiveRatingSummary.averageRating.toFixed(1)}</span>
                <span style={{ opacity: 0.85, fontWeight: 500, fontSize: '0.8rem' }}>
                  ({effectiveRatingSummary.totalReviews}{effectiveRatingSummary.isDynamic ? ' reviews' : '+ reviews'})
                </span>
              </div>

              {/* Level Pill */}
              {course.level && (
                <div className="ot-cd-badge-pill" style={{ background: 'rgba(0, 168, 132, 0.2)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)' }}>
                  <i className="fa-solid fa-signal"></i>
                  <span>{course.level}</span>
                </div>
              )}

              {/* Duration Pill */}
              {course.duration && (
                <div className="ot-cd-badge-pill" style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#e2e8f0' }}>
                  <i className="fa-regular fa-clock"></i>
                  <span>{course.duration}</span>
                </div>
              )}

              {/* Language */}
              {course.language && (
                <div className="ot-cd-badge-pill" style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#e2e8f0' }}>
                  <i className="fa-solid fa-globe"></i>
                  <span>{course.language}</span>
                </div>
              )}

              {/* Pricing Pill */}
              {isPaidCourse ? (
                <div className="ot-cd-badge-pill" style={{ background: 'rgba(99, 102, 241, 0.25)', color: '#c7d2fe', border: '1px solid rgba(165, 180, 252, 0.4)', fontWeight: 800 }}>
                  <i className="fa-solid fa-gem" style={{ color: '#818cf8' }}></i>
                  <span>
                    {currencySymbol}{Number(course.price).toLocaleString()}
                    {course.pricingType === 'subscription' && ` / ${course.subscriptionPeriod || 'month'}`}
                  </span>
                </div>
              ) : (
                <div className="ot-cd-badge-pill" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#a7f3d0', border: '1px solid rgba(110, 231, 183, 0.4)', fontWeight: 800 }}>
                  <i className="fa-solid fa-gift" style={{ color: '#34d399' }}></i>
                  <span>Free Enrollment</span>
                </div>
              )}
            </div>
          </div>

          <div></div>
        </div>
      </section>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="ot-cd-main-wrap">
        {/* LEFT COLUMN: Course Details & Curriculum */}
        <div className="ot-cd-content-col">
          {/* What You'll Learn Box */}
          {outcomesList.length > 0 && (
            <section className="ot-cd-card-box" style={{ background: 'linear-gradient(180deg, rgba(90, 112, 211, 0.08) 0%, #ffffff 100%)' }}>
              <h2 className="ot-cd-card-header-title">
                <i className="fa-solid fa-circle-check" style={{ color: '#5A70D3' }}></i>
                <span>What you'll learn in this course</span>
              </h2>
              <div className="ot-cd-outcomes-grid">
                {outcomesList.map((item, idx) => (
                  <div key={idx} className="ot-cd-outcome-item">
                    <span className="ot-cd-outcome-check">
                      <i className="fa-solid fa-check"></i>
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* CURRICULUM SECTION */}
          <section className="ot-cd-card-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 className="ot-cd-card-header-title" style={{ margin: 0 }}>
                  <i className="fa-solid fa-layer-group" style={{ color: '#5A70D3' }}></i>
                  <span>Course Curriculum</span>
                </h2>
                <span style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 600 }}>
                  {sections.length} modules • {totalLectures} lessons {course.duration ? `• ${course.duration} total duration` : ''}
                </span>
              </div>
              {sections.length > 0 && (
                <button type="button" onClick={toggleAllSections} style={{ background: 'rgba(90, 112, 211, 0.08)', border: 'none', color: '#5A70D3', fontWeight: 700, fontSize: '0.88rem', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer' }}>
                  {sections.every(s => expandedSections[s.id]) ? 'Collapse All' : 'Expand All'}
                </button>
              )}
            </div>

            {sections.length === 0 ? (
              <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '12px', color: '#64748b', textAlign: 'center' }}>
                Curriculum syllabus is currently being finalized by the instructor.
              </div>
            ) : (
              <div className="ot-cd-accordion-group">
                {sections.map((sec, idx) => {
                  const isExpanded = expandedSections[sec.id];
                  const lectures = contentsBySection[sec.id] || [];

                  return (
                    <div key={sec.id} className={`ot-cd-accordion-item ${isExpanded ? 'is-active' : ''}`}>
                      <button
                        type="button"
                        className="ot-cd-accordion-btn"
                        onClick={() => toggleSection(sec.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, fontSize: '0.98rem', color: '#0f172a' }}>
                          <span className="ot-cd-sec-num">{idx + 1}</span>
                          <span>{sec.title}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
                            {lectures.length} {lectures.length === 1 ? 'lesson' : 'lessons'}
                          </span>
                          <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`} style={{ fontSize: '0.8rem', color: '#64748b' }}></i>
                        </div>
                      </button>

                      {isExpanded && (
                        <div>
                          {sec.description && (
                            <div style={{ padding: '12px 20px', background: '#f8fafc', color: '#64748b', fontSize: '0.88rem', fontStyle: 'italic', borderTop: '1px solid #f1f5f9' }}>
                              {sec.description}
                            </div>
                          )}

                          {lectures.length === 0 ? (
                            <div style={{ padding: '14px 20px', fontSize: '0.88rem', color: '#94a3b8' }}>
                              Section overview & lesson contents coming soon.
                            </div>
                          ) : (
                            lectures.map((lec) => (
                              <div key={lec.id} className="ot-cd-lecture-row">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f1f5f9', color: '#5A70D3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                                    {lec.contentType === 'VIDEO' ? (
                                      <i className="fa-solid fa-play"></i>
                                    ) : lec.contentType === 'PDF' ? (
                                      <i className="fa-solid fa-file-pdf" style={{ color: '#ef4444' }}></i>
                                    ) : (
                                      <i className="fa-solid fa-file-lines"></i>
                                    )}
                                  </span>
                                  <span style={{ fontWeight: 600 }}>{lec.title}</span>
                                </div>
                                <span style={{ fontSize: '0.78rem', background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                                  {lec.contentType || 'VIDEO'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* COURSE DESCRIPTION */}
          {course.description && (
            <section className="ot-cd-card-box">
              <h2 className="ot-cd-card-header-title">
                <i className="fa-solid fa-align-left" style={{ color: '#5A70D3' }}></i>
                <span>Course Description</span>
              </h2>
              <div style={{ color: '#334155', lineHeight: 1.8, fontSize: '0.96rem', whiteSpace: 'pre-line' }}>
                {course.description}
              </div>
            </section>
          )}

          {/* PREREQUISITES / REQUIREMENTS */}
          {prereqsList.length > 0 && (
            <section className="ot-cd-card-box">
              <h2 className="ot-cd-card-header-title">
                <i className="fa-solid fa-list-check" style={{ color: '#5A70D3' }}></i>
                <span>Requirements & Prerequisites</span>
              </h2>
              <ul className="ot-cd-bullet-list">
                {prereqsList.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </section>
          )}

          {/* INSTRUCTOR SECTION */}
          <section className="ot-cd-card-box">
            <h2 className="ot-cd-card-header-title">
              <i className="fa-solid fa-user-tie" style={{ color: '#5A70D3' }}></i>
              <span>About the Instructor</span>
            </h2>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#5A70D3', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', fontWeight: 800 }}>
                <i className="fa-solid fa-user-graduate" />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  OneTutor Academy Instructors
                </h3>
                <p style={{ margin: 0, color: '#5A70D3', fontWeight: 700, fontSize: '0.88rem' }}>
                  Industry Experts & Senior Staff Mentors
                </p>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '6px', lineHeight: 1.6 }}>
                  Our course tracks are created by certified software architects and lead engineers with real-world industry expertise.
                </p>
              </div>
            </div>
          </section>

          {/* Related Courses Section for Small Screens (Rendered Before Reviews on Mobile) */}
          <div className="ot-cd-related-mobile-wrap">
            <RelatedCoursesSection
              currentCourseId={course.id}
              categoryId={course.categoryId}
              categoryName={course.categoryName}
            />
          </div>

          {/* STUDENT RATINGS & REVIEWS SECTION */}
          <section className="ot-cd-reviews-card-box">
            <div className="ot-cd-reviews-header-wrap">
              <div className="ot-cd-reviews-title-group">
                <div className="ot-cd-reviews-icon-badge">
                  <i className="fa-solid fa-star"></i>
                </div>
                <div>
                  <h2 className="ot-cd-reviews-title">Student Ratings &amp; Reviews</h2>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.84rem' }}>
                    Verified student ratings and authentic course feedback
                  </p>
                </div>
              </div>
              <div className="ot-cd-reviews-meta-pill">
                <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }}></i>
                <span>
                  {effectiveRatingSummary.isDynamic
                    ? `${effectiveRatingSummary.totalReviews} Verified ${effectiveRatingSummary.totalReviews === 1 ? 'Review' : 'Reviews'}`
                    : `${effectiveRatingSummary.totalReviews}+ Verified Ratings`}
                </span>
              </div>
            </div>

            {/* Overall Summary & Star Distribution Grid */}
            <div className="ot-cd-reviews-summary-card">
              {/* Left Score Box */}
              <div className="ot-cd-reviews-score-box">
                <div className="ot-cd-reviews-score-num-wrap">
                  <span className="ot-cd-reviews-score-num">
                    {effectiveRatingSummary.averageRating.toFixed(1)}
                  </span>
                  <span className="ot-cd-reviews-score-scale">/ 5</span>
                </div>
                <div className="ot-cd-reviews-score-stars">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <i
                      key={s}
                      className="fa-solid fa-star"
                      style={{
                        color: s <= Math.round(effectiveRatingSummary.averageRating) ? '#f59e0b' : '#cbd5e1'
                      }}
                    />
                  ))}
                </div>
                <div className="ot-cd-reviews-score-label">
                  <i className="fa-solid fa-award" style={{ marginRight: '5px' }}></i>
                  Course Rating
                </div>
                <div className="ot-cd-reviews-score-sub">
                  {effectiveRatingSummary.isDynamic
                    ? `Based on ${effectiveRatingSummary.totalReviews} student ${effectiveRatingSummary.totalReviews === 1 ? 'rating' : 'ratings'}`
                    : `Based on ${effectiveRatingSummary.totalReviews}+ student ratings`}
                </div>
              </div>

              {/* Right Distribution Breakdown */}
              <div className="ot-cd-reviews-dist-list">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = effectiveRatingSummary.distribution?.[stars] || 0;
                  const total = effectiveRatingSummary.totalReviews || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={stars} className="ot-cd-dist-row">
                      <div className="ot-cd-dist-star-label">
                        <span>{stars}</span>
                        <i className="fa-solid fa-star" style={{ color: '#f59e0b', fontSize: '0.8rem' }}></i>
                      </div>
                      <div className="ot-cd-dist-bar-track">
                        <div
                          className="ot-cd-dist-bar-fill"
                          style={{
                            width: `${pct}%`,
                            background: stars >= 4 ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)' : (stars === 3 ? '#f59e0b' : '#ef4444')
                          }}
                        />
                      </div>
                      <div className="ot-cd-dist-pct">
                        <span>{pct}%</span>
                        <span className="ot-cd-dist-count">({count})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leave / Edit Review Card */}
            <div>
              {!user ? (
                <div className="ot-cd-my-review-featured-box" style={{ textAlign: 'center', padding: '18px 14px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#E8EBFA',
                    color: '#5A70D3',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.15rem',
                    marginBottom: '8px'
                  }}>
                    <i className="fa-regular fa-star"></i>
                  </div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                    Have you taken this course?
                  </h3>
                  <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.84rem', maxWidth: '380px', marginInline: 'auto' }}>
                    Log in and enroll in this course to share your rating and review with fellow learners.
                  </p>
                  <Link
                    to={`/login?redirect=${encodeURIComponent(`/student/courses/${id}`)}`}
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #5A70D3 0%, #4055B2 100%)',
                      border: 'none',
                      padding: '7px 18px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      boxShadow: '0 2px 8px rgba(90, 112, 211, 0.25)'
                    }}
                  >
                    <i className="fa-solid fa-arrow-right-to-bracket" style={{ marginRight: '6px' }}></i>
                    Log In to Review
                  </Link>
                </div>
              ) : !isEnrolled ? (
                <div className="ot-cd-my-review-featured-box" style={{ textAlign: 'center', padding: '18px 14px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.15rem',
                    marginBottom: '8px'
                  }}>
                    <i className="fa-solid fa-graduation-cap"></i>
                  </div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                    Enrolled Students Only
                  </h3>
                  <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.84rem', maxWidth: '380px', marginInline: 'auto' }}>
                    Only enrolled learners who have taken this course can leave a rating and review.
                  </p>
                  <button
                    type="button"
                    onClick={handleEnroll}
                    className="btn btn-primary"
                    disabled={enrolling || (!isEnrolled && isBatchFull)}
                    style={{
                      background: 'linear-gradient(135deg, #5A70D3 0%, #4055B2 100%)',
                      border: 'none',
                      padding: '7px 18px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      boxShadow: '0 2px 8px rgba(90, 112, 211, 0.25)',
                      cursor: isBatchFull ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <i className="fa-solid fa-circle-plus" style={{ marginRight: '6px' }}></i>
                    {enrolling ? 'Enrolling...' : isPaidCourse ? 'Enroll / Buy Course to Review' : 'Enroll in Course to Review'}
                  </button>
                </div>
              ) : myReview && !isEditingReview ? (
                <div className="ot-cd-my-review-featured-box">
                  <div className="ud-review-card" style={{ border: 'none', padding: 0, boxShadow: 'none' }}>
                    {/* Top Bar: Stars + Author Badges + Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div className="ud-review-stars">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <i
                              key={s}
                              className={`fa-solid fa-star`}
                              style={{ color: s <= myReview.rating ? '#f59e0b' : '#cbd5e1', fontSize: '0.95rem' }}
                            />
                          ))}
                          <span style={{ marginLeft: '6px', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                            {myReview.rating}.0
                          </span>
                        </div>
                        <span className="ot-cd-badge-author">
                          <i className="fa-solid fa-user-check"></i>
                          Your Review
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setIsEditingReview(true)}
                          className="ot-cd-btn-edit"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteReview}
                          className="ot-cd-btn-delete"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                          Delete
                        </button>
                        <div className="ud-review-quote-mark" style={{ marginLeft: '6px' }}>
                          <i className="fa-solid fa-quote-right" style={{ color: '#5A70D3', opacity: 0.35, fontSize: '1.3rem' }}></i>
                        </div>
                      </div>
                    </div>

                    {/* Comment Body */}
                    {myReview.comment ? (
                      <p className="ud-review-comment" style={{ fontSize: '0.96rem', lineHeight: '1.7', color: '#1e293b', margin: '4px 0 14px', fontStyle: 'italic' }}>
                        "{myReview.comment}"
                      </p>
                    ) : (
                      <p style={{ margin: '4px 0 14px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.88rem' }}>
                        Rating only (no written comment provided)
                      </p>
                    )}



                    {/* Author Meta Footer */}
                    <div className="ud-review-author-box" style={{ borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                      <div className="ud-review-avatar-container">
                        <div className="ud-review-avatar-fallback" style={{ background: 'linear-gradient(135deg, #5A70D3 0%, #34479C 100%)' }}>
                          {user?.name ? user.name.slice(0, 2).toUpperCase() : 'ME'}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="ud-review-author-name">{user?.name || 'You'}</span>
                          <span className="ud-review-verified">
                            <i className="fa-solid fa-circle-check"></i> Verified
                          </span>
                        </div>
                        <div className="ud-review-author-role">Active Learner • OneTutor</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitReview} className="ot-cd-review-form-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                    <h3 className="ot-cd-form-title">
                      <i className="fa-solid fa-pen-nib" style={{ color: '#5A70D3' }}></i>
                      {myReview ? 'Edit Your Review' : 'Rate & Review This Course'}
                    </h3>
                    {isEditingReview && (
                      <button
                        type="button"
                        onClick={() => setIsEditingReview(false)}
                        style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Star Rating Picker */}
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                      Your Rating <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="ot-cd-star-picker-container">
                      <div
                        style={{ display: 'inline-flex', gap: '6px', cursor: 'pointer' }}
                        onMouseLeave={() => setReviewHoverRating(0)}
                      >
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active = (reviewHoverRating || reviewRating) >= star;
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              onMouseEnter={() => setReviewHoverRating(star)}
                              className="ot-cd-star-btn"
                              style={{
                                color: active ? '#f59e0b' : '#cbd5e1'
                              }}
                              title={`${star} star${star > 1 ? 's' : ''}`}
                            >
                              <i className="fa-solid fa-star"></i>
                            </button>
                          );
                        })}
                      </div>

                      <span className="ot-cd-rating-desc-pill">
                        {(() => {
                          const r = reviewHoverRating || reviewRating;
                          if (r === 5) return '⭐⭐⭐⭐⭐ 5.0 — Outstanding! Exceeded expectations';
                          if (r === 4) return '⭐⭐⭐⭐ 4.0 — Very Good! Highly recommended';
                          if (r === 3) return '⭐⭐⭐ 3.0 — Good / Average';
                          if (r === 2) return '⭐⭐ 2.0 — Fair / Needs improvement';
                          if (r === 1) return '⭐ 1.0 — Poor';
                          return '';
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Comment Text Area */}
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      Your Feedback / Comment (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share what you liked most about the curriculum, projects, and instructors…"
                      className="ot-cd-review-textarea"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="ot-cd-review-submit-btn"
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                    {submittingReview ? 'Submitting…' : (myReview ? 'Save Updated Review' : 'Submit Rating & Review')}
                  </button>
                </form>
              )}
            </div>

            {/* List of Reviews Header with Carousel Arrow Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 12px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Student Reviews
              </h3>

              {/* Prev / Next Carousel Arrow Buttons (as in home page) */}
              {maxSliderIndex > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="ot-cd-arrow-btn"
                    onClick={handleSliderPrev}
                    aria-label="Previous review"
                    title="Previous review"
                  >
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <button
                    type="button"
                    className="ot-cd-arrow-btn"
                    onClick={handleSliderNext}
                    aria-label="Next review"
                    title="Next review"
                  >
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              )}
            </div>

            {reviewsLoading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.3rem', marginBottom: '8px', color: '#5A70D3' }}></i>
                <p style={{ margin: 0, fontSize: '0.84rem' }}>Loading student reviews…</p>
              </div>
            ) : reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px dashed #E2E8F0', color: '#64748b' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#E8EBFA', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '1.15rem' }}>
                  <i className="fa-regular fa-comments"></i>
                </div>
                <h4 style={{ margin: '0 0 4px', color: '#0f172a', fontSize: '0.95rem', fontWeight: 700 }}>No reviews yet</h4>
                <p style={{ margin: 0, fontSize: '0.82rem' }}>Be the first student to review and rate this course!</p>
              </div>
            ) : (
              /* CONTINUOUS CAROUSEL SLIDER VIEWPORT & TRACK (SAME AS HOME PAGE) */
              <div>
                <div
                  className="ot-cd-slider-viewport"
                  onMouseEnter={() => setIsSliderHovered(true)}
                  onMouseLeave={() => setIsSliderHovered(false)}
                  onTouchStart={handleSliderTouchStart}
                  onTouchEnd={handleSliderTouchEnd}
                >
                  <div
                    className="ot-cd-slider-track"
                    style={{
                      transform: filteredCourseReviews.length <= 1 ? 'none' : `translateX(calc(-${sliderIndex} * ((100% + 14px) / ${sliderCardsPerView})))`
                    }}
                  >
                    {filteredCourseReviews.map((rev) => {
                      const initials = rev.studentName ? rev.studentName.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'ST';
                      const dateStr = rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                      const isMine = user && (user.id === rev.studentId);

                      return (
                        <div
                          key={rev.id}
                          className="ot-cd-slide-card"
                          style={{
                            flex: filteredCourseReviews.length === 1 ? '0 0 100%' : (sliderCardsPerView === 1 ? '0 0 100%' : '0 0 calc((100% - 14px) / 2)'),
                            maxWidth: filteredCourseReviews.length === 1 ? '550px' : 'none'
                          }}
                        >
                          <div className="ud-review-card" style={{ height: '100%', minHeight: '155px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              {/* Card Top: Stars, Score Pill & Quote Bubble */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                  <div className="ud-review-stars">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <i
                                        key={s}
                                        className={`fa-solid fa-star`}
                                        style={{ color: s <= rev.rating ? '#f59e0b' : '#cbd5e1', fontSize: '0.82rem' }}
                                      />
                                    ))}
                                  </div>
                                  <span className="ot-cd-card-score-pill">
                                    {rev.rating}.0 ★
                                  </span>
                                </div>
                                <div className="ot-cd-quote-bubble">
                                  <i className="fa-solid fa-quote-right"></i>
                                </div>
                              </div>

                              {/* Comment Body */}
                              <p className="ud-review-comment" style={{ fontSize: '0.86rem', lineHeight: '1.55', color: '#334155', minHeight: '36px' }}>
                                "{rev.comment}"
                              </p>
                            </div>

                            {/* Author Footer (Home Page Style) */}
                            <div className="ud-review-author-box" style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', marginTop: '10px' }}>
                              <div className="ud-review-avatar-container">
                                {rev.studentAvatar ? (
                                  <img
                                    src={rev.studentAvatar}
                                    alt={rev.studentName}
                                    className="ud-review-avatar-img"
                                  />
                                ) : (
                                  <div className="ud-review-avatar-fallback" style={{ background: 'linear-gradient(135deg, #5A70D3 0%, #34479C 100%)' }}>
                                    {initials}
                                  </div>
                                )}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span className="ud-review-author-name">{rev.studentName}</span>
                                  {isMine && (
                                    <span style={{
                                      fontSize: '0.7rem',
                                      background: '#E8EBFA',
                                      color: '#5A70D3',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      fontWeight: 700
                                    }}>
                                      You
                                    </span>
                                  )}
                                  <span className="ud-review-verified">
                                    <i className="fa-solid fa-circle-check"></i> Verified
                                  </span>
                                </div>
                                <div style={{ marginTop: '3px' }}>
                                  <span className="ud-review-author-role">{dateStr}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Smooth Auto-play Progress Bar Indicator */}
                  {maxSliderIndex > 0 && (
                    <div className="ot-cd-progress-track" title="Time until next review slide">
                      <div
                        className="ot-cd-progress-bar"
                        style={{ width: `${sliderProgress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Interactive Pagination Indicator Dots */}
                {(maxSliderIndex + 1) > 1 && (
                  <div className="ot-cd-dots-row">
                    {[...Array(maxSliderIndex + 1)].map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`ot-cd-dot ${i === sliderIndex ? 'active' : ''}`}
                        onClick={() => handleSliderManualChange(i)}
                        aria-label={`Jump to review slide ${i + 1}`}
                        title={`Jump to slide ${i + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Floating Action Card */}
        <div className="ot-cd-sidebar-col">
          <div className="ot-cd-sticky-wrap">
            <div className="ot-cd-card">
              {/* Media Preview Box */}
              <div className="ot-cd-card-media">
                {course.thumbnail ? (
                  <img src={resolveMediaUrl(course.thumbnail)} alt={course.name} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A70D3', background: '#0f172a' }}>
                    <i className="fa-solid fa-graduation-cap" style={{ fontSize: '3.5rem' }}></i>
                  </div>
                )}
                <div
                  className="ot-cd-play-btn"
                  onClick={() => {
                    if (isEnrolled) {
                      navigate(`/student/learn/${course.id}`);
                    } else if (!isBatchFull) {
                      if (isPaidCourse) {
                        if (!user) {
                          navigate(`/login?redirect=${encodeURIComponent(`/student/courses/${id}`)}`);
                        } else {
                          setShowPaymentModal(true);
                        }
                      } else {
                        handleEnroll();
                      }
                    }
                  }}
                  title={isEnrolled ? 'Resume Learning' : isPaidCourse ? 'Buy / Subscribe' : 'Enroll Now'}
                  style={!isEnrolled && isBatchFull ? { opacity: 0.6, cursor: 'not-allowed', background: '#94a3b8' } : {}}
                >
                  <i className="fa-solid fa-play"></i>
                </div>
              </div>

              {/* Card Body & Actions */}
              <div className="ot-cd-card-body">
                <div className="ot-cd-price-tag" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  {isEnrolled ? (
                    <>
                      <span>Enrolled</span>
                      <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-shield-check"></i>
                        Active Student
                      </span>
                    </>
                  ) : isPaidCourse ? (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                            {currencySymbol}{appliedCoupon ? appliedCoupon.finalPrice.toLocaleString() : Number(course.price).toLocaleString()}
                          </span>
                          {appliedCoupon && (
                            <span style={{ fontSize: '1.1rem', color: '#94a3b8', textDecoration: 'line-through', fontWeight: 600 }}>
                              {currencySymbol}{Number(course.price).toLocaleString()}
                            </span>
                          )}
                          {course.pricingType === 'subscription' && (
                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                              /{course.subscriptionPeriod === 'yearly' ? 'year' : 'month'}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.74rem', color: '#4f46e5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {course.pricingType === 'subscription' ? 'Subscription Access' : 'One-time Payment'}
                        </span>
                      </div>
                      {appliedCoupon ? (
                        <span style={{ fontSize: '0.78rem', color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #a7f3d0' }}>
                          <i className="fa-solid fa-tag"></i> {appliedCoupon.label} Applied
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #a7f3d0' }}>
                          <i className="fa-solid fa-tag"></i> Best Value
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span>Free Access</span>
                      <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-shield-check"></i>
                        Full Course Access
                      </span>
                    </>
                  )}
                </div>

                {/* Enrolled Batch Info - ONLY shown after student is enrolled */}
                {isEnrolled && (enrolledBatch || batches[0]) && (
                  <div className="ot-cd-enrolled-batch-card">
                    <div className="ot-cd-enrolled-batch-header">
                      <i className="fa-solid fa-user-group"></i>
                      <span>Your Cohort Batch</span>
                    </div>
                    <div className="ot-cd-enrolled-batch-body">
                      <span className="ot-cd-enrolled-batch-name">
                        {enrolledBatch?.name || batches[0]?.name || `Batch #${enrolledBatch?.id || batches[0]?.id}`}
                      </span>
                      {(enrolledBatch?.code || batches[0]?.code) && (
                        <span className="ot-cd-enrolled-batch-badge">
                          {enrolledBatch?.code || batches[0]?.code}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Coupon Box for Paid Courses */}
                {isPaidCourse && !isEnrolled && isPublished && (
                  <div style={{ marginBottom: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-ticket" style={{ color: '#6366f1' }}></i>
                        <span>Apply Coupon</span>
                      </span>
                      {!appliedCoupon ? (
                        <button
                          type="button"
                          onClick={() => setShowCouponInput(!showCouponInput)}
                          style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        >
                          {showCouponInput ? 'Hide' : 'Enter Code'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {appliedCoupon ? (
                      <div style={{ marginTop: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '6px 10px', fontSize: '0.78rem', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>🎉 <strong>{appliedCoupon.code}</strong> applied ({appliedCoupon.label} - Saved {currencySymbol}{appliedCoupon.discount})</span>
                        <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
                      </div>
                    ) : showCouponInput && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            placeholder="e.g. ONETUTOR20"
                            value={couponCode}
                            onChange={(e) => {
                              setCouponCode(e.target.value.toUpperCase());
                              setCouponError('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleApplyCoupon();
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: '6px',
                              border: couponError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              outline: 'none',
                              background: '#ffffff'
                            }}
                          />
                          <button
                            type="button"
                            disabled={couponLoading}
                            onClick={() => handleApplyCoupon()}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#4f46e5',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              cursor: couponLoading ? 'wait' : 'pointer',
                              opacity: couponLoading ? 0.8 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            {couponLoading && <i className="fa-solid fa-spinner fa-spin"></i>}
                            <span>Apply</span>
                          </button>
                        </div>
                        {couponError && (
                          <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>
                            {couponError}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {displayedCouponsList.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setCouponCode(c.code);
                                handleApplyCoupon(c.code);
                              }}
                              style={{
                                background: 'rgba(79, 70, 229, 0.08)',
                                border: '1px dashed rgba(79, 70, 229, 0.4)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: '#4f46e5',
                                cursor: 'pointer'
                              }}
                            >
                              {c.code} ({c.discountType === 'PERCENTAGE' ? `${c.discountValue}% OFF` : (c.label || `₹${c.discountValue || 500} OFF`)})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {error && !isBatchFull && isPublished && (
                  <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '14px', fontWeight: 600 }}>
                    {error}
                  </div>
                )}

                {/* Action Buttons */}
                {isEnrolled ? (
                  <button
                    type="button"
                    className="ot-cd-btn-primary"
                    onClick={() => navigate(`/student/learn/${course.id}`)}
                  >
                    <i className="fa-solid fa-circle-play"></i>
                    <span>Continue Learning</span>
                  </button>
                ) : !isPublished ? (
                  <button
                    type="button"
                    className="ot-cd-btn-primary"
                    disabled={true}
                    style={{ background: '#94a3b8', cursor: 'not-allowed', boxShadow: 'none' }}
                  >
                    <i className="fa-solid fa-ban"></i>
                    <span>Enrollments Closed</span>
                  </button>
                ) : isPaidCourse ? (
                  <button
                    type="button"
                    className="ot-cd-btn-primary"
                    onClick={() => {
                      if (!user) {
                        navigate(`/login?redirect=${encodeURIComponent(`/student/courses/${id}`)}`);
                        return;
                      }
                      setShowPaymentModal(true);
                    }}
                    disabled={isBatchFull}
                    style={isBatchFull ? { background: '#94a3b8', cursor: 'not-allowed', boxShadow: 'none' } : {
                      background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                      boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)'
                    }}
                    title={isBatchFull ? 'Enrollment unavailable' : 'Subscribe & Enroll'}
                  >
                    <i className="fa-solid fa-lock-open"></i>
                    <span>
                      {course.pricingType === 'subscription' ? 'Subscribe Now' : 'Buy Now'} • {currencySymbol}{appliedCoupon ? appliedCoupon.finalPrice.toLocaleString() : Number(course.price).toLocaleString()}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ot-cd-btn-primary"
                    onClick={handleEnroll}
                    disabled={enrolling || isBatchFull}
                    style={isBatchFull ? { background: '#94a3b8', cursor: 'not-allowed', boxShadow: 'none' } : {}}
                    title={isBatchFull ? 'Enrollment unavailable' : 'Enroll in course'}
                  >
                    {enrolling ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        <span>Processing Enrollment…</span>
                      </>
                    ) : (
                      <>
                        <i className={isBatchFull ? "fa-solid fa-ban" : "fa-solid fa-bolt"}></i>
                        <span>Enroll Now (Free)</span>
                      </>
                    )}
                  </button>
                )}

                {/* Features List */}
                <div className="ot-cd-features-list">
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                    This course includes:
                  </div>
                  {course.duration && (
                    <div className="ot-cd-feature-item">
                      <i className="fa-regular fa-clock"></i>
                      <span>{course.duration} on-demand learning</span>
                    </div>
                  )}
                  <div className="ot-cd-feature-item">
                    <i className="fa-solid fa-layer-group"></i>
                    <span>{sections.length} structured curriculum modules</span>
                  </div>
                  {totalLectures > 0 && (
                    <div className="ot-cd-feature-item">
                      <i className="fa-solid fa-circle-play"></i>
                      <span>{totalLectures} video lectures & assets</span>
                    </div>
                  )}
                  <div className="ot-cd-feature-item">
                    <i className="fa-solid fa-mobile-screen-button"></i>
                    <span>Access on Mobile, Tablet & Desktop</span>
                  </div>
                  <div className="ot-cd-feature-item">
                    <i className="fa-solid fa-shield-halved"></i>
                    <span>Anti-cheat progress protection system</span>
                  </div>
                  <div className="ot-cd-feature-item">
                    <i className="fa-solid fa-award"></i>
                    <span>Certificate of Completion</span>
                  </div>
                </div>

                {/* Share Button */}
                <button type="button" className="ot-cd-share-btn" onClick={handleShare}>
                  <i className="fa-solid fa-share-nodes"></i>
                  <span>{copiedShare ? 'Link Copied to Clipboard! ✓' : 'Share this course'}</span>
                </button>
              </div>
            </div>

            {/* Related Courses Section for Desktop */}
            <div className="ot-cd-related-desktop-wrap" style={{ marginTop: '36px' }}>
              <RelatedCoursesSection
                currentCourseId={course.id}
                categoryId={course.categoryId}
                categoryName={course.categoryName}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payment & Checkout Modal */}
      <CoursePaymentModal
        course={course}
        batchId={selectedBatchId}
        isOpen={showPaymentModal}
        initialCoupon={appliedCoupon}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={() => {
          setIsEnrolled(true);
          setShowPaymentModal(false);
          navigate(`/student/learn/${course.id}`);
        }}
      />
    </div>
  );
}

