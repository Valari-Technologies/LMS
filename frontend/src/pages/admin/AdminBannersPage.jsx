import { useState, useEffect, useRef } from 'react';
import {
  listAdminBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
  uploadBannerImage
} from '../../api/banners';
import { listCategories } from '../../api/categories';
import { listAdminCourses, browseCourses } from '../../api/courses';
import { useNotification } from '../../context/NotificationContext';
import AlertBanner from '../../components/AlertBanner';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import { usePermission } from '../../hooks/usePermission';

export default function AdminBannersPage() {
  const { isReadOnly } = usePermission();
  const { toast, confirm } = useNotification();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Categories & Courses for link selection
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Link Setup States
  // Modes: 'direct' (raw input) | 'category' (choose category) | 'course' (choose category -> course)
  const [linkMode, setLinkMode] = useState('direct');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [courseCategoryId, setCourseCategoryId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form states
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cloudinaryPublicId, setCloudinaryPublicId] = useState('');
  const uploadPromiseRef = useRef(null);
  const pendingFileRef = useRef(null);
  const [ctaText, setCtaText] = useState('');
  const [ctaLink, setCtaLink] = useState('/student/courses');
  const [badgeText, setBadgeText] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [active, setActive] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBanners();
    loadCategoriesAndCourses();
  }, []);

  async function loadCategoriesAndCourses() {
    try {
      setLoadingOptions(true);
      const [catData, courseData] = await Promise.all([
        listCategories({ size: 100 }),
        listAdminCourses({ size: 200 }).catch(() => browseCourses({ size: 200 }))
      ]);
      setCategories(catData?.content || (Array.isArray(catData) ? catData : []));
      setCourses(courseData?.content || (Array.isArray(courseData) ? courseData : []));
    } catch (err) {
      console.error('Failed to load categories or courses for banner links', err);
    } finally {
      setLoadingOptions(false);
    }
  }

  // Keep course category dropdown synced if courses finish loading after openEditModal
  useEffect(() => {
    if (editingBanner && selectedCourseId && !courseCategoryId && courses.length > 0) {
      const matched = courses.find(c => String(c.id) === String(selectedCourseId));
      if (matched) {
        if (matched.categoryId) {
          setCourseCategoryId(String(matched.categoryId));
        } else if (matched.categoryName) {
          const cat = categories.find(cat => cat.name?.toLowerCase() === matched.categoryName?.toLowerCase());
          if (cat) setCourseCategoryId(String(cat.id));
        }
      }
    }
  }, [courses, editingBanner, selectedCourseId, courseCategoryId, categories]);

  async function loadBanners() {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminBanners();
      setBanners(data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingBanner(null);
    setTitle('');
    setSubtitle('');
    setImageUrl('');
    setCloudinaryPublicId('');
    setCtaText('');
    setCtaLink('/student/courses');
    setBadgeText('');
    setDisplayOrder(banners.length);
    setActive(true);
    setLinkMode('direct');
    setSelectedCategoryId('');
    setCourseCategoryId('');
    setSelectedCourseId('');
    setShowModal(true);
    setError(null);
    setSuccessMsg(null);
    uploadPromiseRef.current = null;
    pendingFileRef.current = null;
  }

  function openEditModal(banner) {
    setEditingBanner(banner);
    setTitle(banner.title);
    setSubtitle(banner.subtitle || '');
    setImageUrl(banner.imageUrl);
    setCloudinaryPublicId(banner.cloudinaryPublicId || '');
    setCtaText(banner.ctaText || '');
    const link = banner.ctaLink || '/student/courses';
    setCtaLink(link);
    setBadgeText(banner.badgeText || '');
    setDisplayOrder(banner.displayOrder);
    setActive(banner.active);

    // Auto-detect link mode and pre-populate dropdowns
    const catMatch = link.match(/[?&]categoryId=(\d+)/);
    const courseMatch = link.match(/\/student\/courses\/(\d+)(?:[/?#]|$)/);

    if (catMatch) {
      setLinkMode('category');
      setSelectedCategoryId(catMatch[1]);
      setCourseCategoryId('');
      setSelectedCourseId('');
    } else if (courseMatch) {
      setLinkMode('course');
      const cId = courseMatch[1];
      setSelectedCourseId(cId);
      const matched = courses.find(c => String(c.id) === String(cId));
      if (matched) {
        if (matched.categoryId) {
          setCourseCategoryId(String(matched.categoryId));
        } else if (matched.categoryName) {
          const cat = categories.find(cat => cat.name?.toLowerCase() === matched.categoryName?.toLowerCase());
          setCourseCategoryId(cat ? String(cat.id) : '');
        }
      } else {
        setCourseCategoryId('');
      }
      setSelectedCategoryId('');
    } else {
      setLinkMode('direct');
      setSelectedCategoryId('');
      setCourseCategoryId('');
      setSelectedCourseId('');
    }

    setShowModal(true);
    setError(null);
    setSuccessMsg(null);
    uploadPromiseRef.current = null;
    pendingFileRef.current = null;
  }

  async function handleFileUpload(e) {
    if (isReadOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant optimistic preview (0ms latency)
    const localUrl = URL.createObjectURL(file);
    setImageUrl(localUrl);
    setError(null);
    pendingFileRef.current = file;

    // Background upload to Cloudinary
    const promise = uploadBannerImage(file);
    uploadPromiseRef.current = promise;
    promise
      .then(res => {
        if (res && res.url) {
          setImageUrl(res.url);
          setCloudinaryPublicId(res.public_id || '');
          pendingFileRef.current = null;
          uploadPromiseRef.current = null;
          toast.success('Image uploaded to Cloudinary successfully!');
        }
      })
      .catch(err => {
        console.warn('Cloudinary upload error:', err);
      });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isReadOnly) return;

    const initialImageUrl = imageUrl.trim();
    if (!initialImageUrl) {
      toast.warning('Please provide a banner image or select an image file.');
      return;
    }

    const currentTitle = title.trim();
    if (!currentTitle) {
      toast.warning('Banner title is required.');
      return;
    }

    const capturedEditing = editingBanner;
    const capturedFile = pendingFileRef.current;
    const capturedUploadPromise = uploadPromiseRef.current;
    const tempId = capturedEditing ? capturedEditing.id : 'temp-' + Date.now();

    // 1. INSTANT OPTIMISTIC UI: close modal & update state immediately (0ms delay)
    setShowModal(false);
    toast.success(capturedEditing ? 'Hero banner updated!' : 'Hero banner created!');

    const optimisticBanner = {
      id: tempId,
      title: currentTitle,
      subtitle,
      imageUrl: initialImageUrl,
      cloudinaryPublicId,
      ctaText,
      ctaLink,
      badgeText,
      displayOrder: Number(displayOrder) || 0,
      active,
      createdAt: capturedEditing?.createdAt || new Date().toISOString()
    };

    if (capturedEditing) {
      setBanners(prev => prev.map(b => b.id === capturedEditing.id ? { ...b, ...optimisticBanner } : b));
    } else {
      setBanners(prev => [...prev, optimisticBanner]);
    }

    // 2. BACKGROUND PERSISTENCE: seamless Cloudinary upload & DB save in background
    (async () => {
      try {
        let finalImageUrl = initialImageUrl;
        let finalCloudinaryId = cloudinaryPublicId;

        // If upload is in flight, resolve it in the background
        if (finalImageUrl.startsWith('blob:') || capturedUploadPromise) {
          const res = capturedUploadPromise
            ? await capturedUploadPromise
            : (capturedFile ? await uploadBannerImage(capturedFile) : null);
          if (res?.url) {
            finalImageUrl = res.url;
            finalCloudinaryId = res.public_id || '';
          }
        }

        const payload = {
          title: currentTitle,
          subtitle,
          imageUrl: finalImageUrl,
          cloudinaryPublicId: finalCloudinaryId,
          ctaText,
          ctaLink,
          badgeText,
          displayOrder: Number(displayOrder) || 0,
          active
        };

        let saved;
        if (capturedEditing) {
          saved = await updateBanner(capturedEditing.id, payload);
        } else {
          saved = await createBanner(payload);
        }

        if (saved) {
          setBanners(prev => prev.map(b => b.id === tempId ? saved : b));
        }
      } catch (err) {
        console.error('Failed to persist banner:', err);
        toast.error(err.response?.data?.message || 'Failed to save banner to server.');
        loadBanners();
      }
    })();
  }

  async function handleToggleStatus(banner) {
    if (isReadOnly) return;
    try {
      const nextStatus = !banner.active;
      await toggleBannerStatus(banner.id, nextStatus);
      setBanners(prev =>
        prev.map(b => b.id === banner.id ? { ...b, active: nextStatus } : b)
      );
      const msg = `Banner "${banner.title}" is now ${nextStatus ? 'ACTIVE' : 'DEACTIVATED'}.`;
      setSuccessMsg(msg);
      toast.info(msg);
    } catch (err) {
      const msg = 'Failed to toggle banner status';
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleDelete(id) {
    if (isReadOnly) return;
    try {
      await deleteBanner(id);
      setBanners(prev => prev.filter(b => b.id !== id));
      setDeleteConfirmId(null);
      const msg = 'Hero banner deleted successfully.';
      setSuccessMsg(msg);
      toast.success(msg);
    } catch (err) {
      const msg = 'Failed to delete hero banner';
      setError(msg);
      toast.error(msg);
    }
  }

  // Filter courses for Category-based selection in Modal
  const filteredCategoryCourses = courses.filter(c => {
    if (!courseCategoryId) return false;
    if (String(c.categoryId) === String(courseCategoryId)) return true;
    const selectedCat = categories.find(cat => String(cat.id) === String(courseCategoryId));
    return selectedCat && c.categoryName && c.categoryName.toLowerCase() === selectedCat.name.toLowerCase();
  });

  // Human-readable destination helper for the banner list cards
  const getBannerDestinationLabel = (link) => {
    if (!link) return 'Default (/student/courses)';
    const catMatch = link.match(/[?&]categoryId=(\d+)/);
    if (catMatch) {
      const cat = categories.find(c => String(c.id) === String(catMatch[1]));
      return `Category: ${cat ? cat.name : '#' + catMatch[1]}`;
    }
    const courseMatch = link.match(/\/student\/courses\/(\d+)(?:[/?#]|$)/);
    if (courseMatch) {
      const crs = courses.find(c => String(c.id) === String(courseMatch[1]));
      return `Course: ${crs ? crs.name : '#' + courseMatch[1]}`;
    }
    return link;
  };

  const totalBannersCount = banners.length;
  const activeBannersCount = banners.filter(b => b.active).length;
  const inactiveBannersCount = totalBannersCount - activeBannersCount;
  const cloudinaryBannersCount = banners.filter(b => b.cloudinaryPublicId).length;

  return (
    <div className="page" style={{ paddingBottom: '60px' }}>
      {/* Marketing Sub-navigation Floating Segmented Bar */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#EEF2FF',
        padding: '5px',
        borderRadius: '14px',
        marginBottom: '24px',
        gap: '4px'
      }}>
        <button
          type="button"
          style={{
            padding: '8px 18px',
            fontWeight: 700,
            fontSize: '0.88rem',
            border: 'none',
            borderRadius: '10px',
            background: '#FFFFFF',
            color: '#5A70D3',
            boxShadow: '0 2px 8px rgba(90, 112, 211, 0.15)',
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-image"></i>
          <span>Hero Banners (Top Carousel)</span>
        </button>

        <a
          href="/admin/promo-banner"
          style={{
            padding: '8px 18px',
            fontWeight: 600,
            fontSize: '0.88rem',
            textDecoration: 'none',
            border: 'none',
            borderRadius: '10px',
            background: 'transparent',
            color: '#5F5868',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#18131F'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#5F5868'; }}
        >
          <i className="fa-solid fa-rectangle-ad"></i>
          <span>Promo Banner (Course Section)</span>
        </a>
      </div>

      {/* Modern Studio Hero Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #EEF2FF 0%, #FAF5FF 50%, #FFFFFF 100%)',
          borderRadius: '20px',
          border: '1px solid #E0E7FF',
          padding: '28px 32px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(90, 112, 211, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            fontWeight: 800,
            color: '#5A70D3',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: '6px'
          }}>
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            <span>Student Portal Merchandising</span>
          </div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Hero Banner Management
          </h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.92rem', maxWidth: '640px', lineHeight: 1.5 }}>
            Create, schedule, activate/deactivate, and reorder full-bleed promotional banners stored in Cloudinary for the student home page.
          </p>
        </div>

        {!isReadOnly && (
          <div>
            <button
              type="button"
              onClick={openCreateModal}
              style={{
                background: 'linear-gradient(135deg, #5A70D3 0%, #4055B2 100%)',
                color: '#FFFFFF',
                border: 'none',
                padding: '12px 22px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(90, 112, 211, 0.28)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(90, 112, 211, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(90, 112, 211, 0.28)';
              }}
            >
              <i className="fa-solid fa-plus"></i>
              <span>Add New Banner</span>
            </button>
          </div>
        )}
      </div>

      {/* 4-Stat Performance KPI Summary Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #EAEAEA', borderRadius: '16px', padding: '18px 20px', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748B' }}>Total Hero Banners</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EEF2FF', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              <i className="fa-solid fa-images"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{totalBannersCount}</div>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.76rem', color: '#94A3B8' }}>Created banner campaigns</p>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #EAEAEA', borderRadius: '16px', padding: '18px 20px', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748B' }}>Active on Carousel</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              <i className="fa-solid fa-circle-play"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', lineHeight: 1 }}>{activeBannersCount}</div>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.76rem', color: '#94A3B8' }}>Displaying to students</p>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #EAEAEA', borderRadius: '16px', padding: '18px 20px', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748B' }}>Paused / Inactive</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              <i className="fa-solid fa-circle-pause"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706', lineHeight: 1 }}>{inactiveBannersCount}</div>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.76rem', color: '#94A3B8' }}>Hidden from student home</p>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #EAEAEA', borderRadius: '16px', padding: '18px 20px', boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748B' }}>Cloudinary Synced</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F0F9FF', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              <i className="fa-solid fa-cloud"></i>
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284C7', lineHeight: 1 }}>{cloudinaryBannersCount}</div>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.76rem', color: '#94A3B8' }}>CDN cloud-hosted assets</p>
        </div>
      </div>

      {/* Alerts */}
      <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg(null)} />
      <AlertBanner type="error" message={error} onClose={() => setError(null)} />

      {/* Banner Cards Grid */}
      {loading ? (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #EAEAEA',
          padding: '60px 24px',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
        }}>
          <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#5A70D3', marginBottom: '14px' }}></i>
          <p style={{ margin: 0, color: '#64748B', fontWeight: 600 }}>Loading hero banners...</p>
        </div>
      ) : banners.length === 0 ? (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          border: '1.5px dashed #CBD5E1',
          padding: '60px 24px',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: '#EEF2FF',
            color: '#5A70D3',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            marginBottom: '16px'
          }}>
            <i className="fa-solid fa-images"></i>
          </div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
            No hero banners created yet
          </h3>
          <p style={{ margin: '0 auto 20px auto', color: '#64748B', fontSize: '0.9rem', maxWidth: '420px', lineHeight: 1.5 }}>
            Add your first responsive banner to showcase key courses, campaigns, or new tracks on the student home carousel.
          </p>
          {!isReadOnly && (
            <button
              type="button"
              onClick={openCreateModal}
              style={{
                background: 'linear-gradient(135deg, #5A70D3 0%, #4055B2 100%)',
                color: '#FFFFFF',
                border: 'none',
                padding: '11px 22px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(90, 112, 211, 0.25)'
              }}
            >
              <i className="fa-solid fa-plus"></i>
              <span>Create First Banner</span>
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {banners.map((b) => (
            <div
              key={b.id}
              style={{
                background: '#FFFFFF',
                borderRadius: '18px',
                border: b.active ? '1.5px solid #E2E8F0' : '1.5px dashed #CBD5E1',
                boxShadow: b.active ? '0 4px 20px rgba(15, 23, 42, 0.05)' : 'none',
                padding: '22px 24px',
                display: 'flex',
                gap: '24px',
                alignItems: 'center',
                flexWrap: 'wrap',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                opacity: b.active ? 1 : 0.78,
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (b.active) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px rgba(90, 112, 211, 0.12)';
                  e.currentTarget.style.borderColor = '#5A70D3';
                }
              }}
              onMouseLeave={(e) => {
                if (b.active) {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(15, 23, 42, 0.05)';
                  e.currentTarget.style.borderColor = '#E2E8F0';
                }
              }}
            >
              {/* Responsive Banner Preview with Aspect Ratio & Zoom */}
              <div
                style={{
                  width: '280px',
                  height: '150px',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  background: '#0F172A',
                  flexShrink: 0,
                  position: 'relative',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)'
                }}
              >
                <img
                  src={resolveMediaUrl(b.imageUrl)}
                  alt={b.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.4s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    color: '#FFFFFF',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: '9999px',
                    letterSpacing: '0.3px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                  }}
                >
                  <i className="fa-solid fa-arrow-down-1-9" style={{ marginRight: '4px', opacity: 0.8 }}></i>
                  Order #{b.displayOrder}
                </span>
              </div>

              {/* Meta & Content */}
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      letterSpacing: '0.3px',
                      background: b.active ? '#ECFDF5' : '#FFFBEB',
                      color: b.active ? '#059669' : '#D97706',
                      border: b.active ? '1px solid #A7F3D0' : '1px solid #FDE68A'
                    }}
                  >
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: b.active ? '#10B981' : '#F59E0B'
                    }} />
                    {b.active ? 'ACTIVE' : 'DEACTIVATED'}
                  </span>

                  {b.cloudinaryPublicId && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: '#F0F9FF',
                        color: '#0284C7',
                        border: '1px solid #BAE6FD'
                      }}
                    >
                      <i className="fa-solid fa-cloud"></i>
                      Cloudinary CDN
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px 0', color: '#0F172A', lineHeight: 1.35 }}>
                  {b.title}
                </h3>
                <p style={{ color: '#64748B', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 12px 0', maxWidth: '680px' }}>
                  {b.subtitle || 'No subtitle description provided.'}
                </p>

                {/* Destination Strip */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  color: '#475569',
                  maxWidth: '100%',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ color: '#5A70D3', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-location-arrow"></i>
                    {getBannerDestinationLabel(b.ctaLink)}
                  </span>
                  <span style={{ color: '#CBD5E1' }}>|</span>
                  <code style={{ color: '#64748B', background: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', border: '1px solid #E2E8F0', fontSize: '0.75rem' }}>
                    {b.ctaLink}
                  </code>
                </div>
              </div>

              {/* Action Buttons */}
              {!isReadOnly ? (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                  {/* Deactivate / Activate Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(b)}
                    title={b.active ? 'Deactivate this banner' : 'Activate this banner'}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      border: b.active ? '1px solid #E2E8F0' : 'none',
                      background: b.active ? '#FFFFFF' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: b.active ? '#475569' : '#FFFFFF',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: b.active ? '0 1px 3px rgba(0,0,0,0.04)' : '0 2px 8px rgba(16, 185, 129, 0.25)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <i className={`fa-solid ${b.active ? 'fa-pause' : 'fa-play'}`}></i>
                    {b.active ? 'Deactivate' : 'Activate'}
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => openEditModal(b)}
                    title="Edit banner"
                    style={{
                      padding: '8px 14px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      color: '#5A70D3',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <i className="fa-solid fa-pen-to-square"></i>
                    Edit
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete Hero Banner?',
                        description: `Are you sure you want to delete the banner "${b.title}"?\n\nThis banner will be removed from the student home carousel and permanently deleted from Cloudinary storage.`,
                        confirmText: 'Delete Banner',
                        cancelText: 'Cancel',
                        variant: 'delete'
                      });
                      if (ok) handleDelete(b.id);
                    }}
                    title="Delete banner"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      border: '1px solid #FECACA',
                      background: '#FEF2F2',
                      color: '#DC2626',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              ) : (
                <span className="badge badge-secondary" style={{ fontSize: '0.78rem' }}>Read Only</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Banner Modal */}
      {showModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            overflowY: 'auto',
            padding: '24px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div
            className="modal-dialog"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '680px',
              width: '100%',
              maxHeight: 'calc(100vh - 48px)',
              margin: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              background: '#FFFFFF',
              borderRadius: '20px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
              animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                borderBottom: '1px solid #F1F5F9',
                background: 'linear-gradient(to right, #FFFFFF, #F8FAFC)',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(90, 112, 211, 0.15), rgba(67, 56, 202, 0.15))',
                    color: '#4338CA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.1rem'
                  }}
                >
                  <i className="fa-solid fa-image"></i>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.01em' }}>
                    {editingBanner ? 'Edit Hero Banner' : 'Create New Hero Banner'}
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                    Configure promotional banner visibility, destination, and graphics
                  </p>
                </div>
              </div>

              <button
                type="button"
                style={{
                  width: '32px',
                  height: '32px',
                  background: '#F1F5F9',
                  border: 'none',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  color: '#64748B',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#E2E8F0';
                  e.currentTarget.style.color = '#0F172A';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#F1F5F9';
                  e.currentTarget.style.color = '#64748B';
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Scrollable Form */}
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '24px',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px'
                }}
              >
                {/* Banner Title */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem', color: '#1E293B', marginBottom: '6px' }}>
                    Banner Title <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="e.g. Skills for your present (and your future)"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{
                      borderRadius: '10px',
                      padding: '10px 14px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.92rem'
                    }}
                  />
                </div>

                {/* Subtitle / Description */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem', color: '#1E293B', marginBottom: '6px' }}>
                    Subtitle / Promotional Description
                  </label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Supporting promotional text shown beneath the banner title..."
                    value={subtitle}
                    onChange={e => setSubtitle(e.target.value)}
                    style={{
                      borderRadius: '10px',
                      padding: '10px 14px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Cloudinary Image Section */}
                <div
                  style={{
                    background: '#F8FAFC',
                    padding: '18px',
                    borderRadius: '14px',
                    border: '1px solid #E2E8F0'
                  }}
                >
                  <label
                    className="form-label"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                      color: '#1E293B',
                      marginBottom: '10px'
                    }}
                  >
                    <i className="fa-solid fa-cloud-arrow-up" style={{ color: '#0EA5E9' }}></i>
                    Banner Image (Cloudinary CDN) <span style={{ color: '#EF4444' }}>*</span>
                  </label>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <label
                      style={{
                        cursor: 'pointer',
                        margin: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderRadius: '10px',
                        background: '#EEF2FF',
                        border: '1px solid #C7D2FE',
                        color: '#4338CA',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                      Upload Image File
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                    </label>
                    <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                      or paste direct image URL below
                    </span>
                  </div>

                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="https://res.cloudinary.com/... or https://images.unsplash.com/..."
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    style={{
                      borderRadius: '10px',
                      padding: '10px 14px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.88rem'
                    }}
                  />

                  {imageUrl && (
                    <div
                      style={{
                        marginTop: '12px',
                        height: '140px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid #E2E8F0',
                        background: '#0F172A',
                        position: 'relative'
                      }}
                    >
                      <img
                        src={resolveMediaUrl(imageUrl)}
                        alt="Banner Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          console.warn('Banner preview failed to load:', imageUrl);
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '8px',
                          left: '8px',
                          background: 'rgba(15, 23, 42, 0.75)',
                          backdropFilter: 'blur(6px)',
                          color: '#FFFFFF',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <i className="fa-solid fa-eye"></i>
                        Live Image Preview
                      </div>
                    </div>
                  )}
                </div>

                {/* Destination Link Setup Section */}
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '18px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <label
                      className="form-label"
                      style={{
                        fontWeight: 700,
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.88rem',
                        color: '#1E293B'
                      }}
                    >
                      <i className="fa-solid fa-link" style={{ color: '#5A70D3' }}></i>
                      Banner Destination Link
                    </label>
                    <span style={{ fontSize: '0.76rem', color: '#64748B' }}>
                      Choose how users navigate
                    </span>
                  </div>

                  {/* 3 Link Mode Tabs */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '6px',
                      background: '#E2E8F0',
                      padding: '4px',
                      borderRadius: '10px',
                      marginBottom: '14px'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setLinkMode('direct')}
                      style={{
                        padding: '8px 10px',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: linkMode === 'direct' ? 700 : 500,
                        background: linkMode === 'direct' ? '#FFFFFF' : 'transparent',
                        color: linkMode === 'direct' ? '#4338CA' : '#475569',
                        boxShadow: linkMode === 'direct' ? '0 2px 6px rgba(15, 23, 42, 0.08)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      Direct Link
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLinkMode('category');
                        if (selectedCategoryId) {
                          setCtaLink(`/student/courses?categoryId=${selectedCategoryId}`);
                        }
                      }}
                      style={{
                        padding: '8px 10px',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: linkMode === 'category' ? 700 : 500,
                        background: linkMode === 'category' ? '#FFFFFF' : 'transparent',
                        color: linkMode === 'category' ? '#4338CA' : '#475569',
                        boxShadow: linkMode === 'category' ? '0 2px 6px rgba(15, 23, 42, 0.08)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <i className="fa-solid fa-layer-group"></i>
                      Course Category
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLinkMode('course');
                        if (selectedCourseId) {
                          setCtaLink(`/student/courses/${selectedCourseId}`);
                        } else if (courseCategoryId) {
                          setCtaLink(`/student/courses?categoryId=${courseCategoryId}`);
                        }
                      }}
                      style={{
                        padding: '8px 10px',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: linkMode === 'course' ? 700 : 500,
                        background: linkMode === 'course' ? '#FFFFFF' : 'transparent',
                        color: linkMode === 'course' ? '#4338CA' : '#475569',
                        boxShadow: linkMode === 'course' ? '0 2px 6px rgba(15, 23, 42, 0.08)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <i className="fa-solid fa-graduation-cap"></i>
                      Specific Course
                    </button>
                  </div>

                  {/* Mode 1: Direct Link Input */}
                  {linkMode === 'direct' && (
                    <div style={{ marginBottom: '10px' }}>
                      <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                        Direct URL or Route
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. /student/courses, /student/my-courses, or https://..."
                        value={ctaLink}
                        onChange={e => setCtaLink(e.target.value)}
                        style={{
                          borderRadius: '8px',
                          padding: '9px 12px',
                          border: '1px solid #CBD5E1',
                          fontSize: '0.88rem'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.76rem', color: '#64748B' }}>Quick templates:</span>
                        <button
                          type="button"
                          onClick={() => setCtaLink('/student/courses')}
                          style={{
                            fontSize: '0.75rem',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            cursor: 'pointer',
                            color: '#334155',
                            fontWeight: 500
                          }}
                        >
                          /student/courses
                        </button>
                        <button
                          type="button"
                          onClick={() => setCtaLink('/student/my-courses')}
                          style={{
                            fontSize: '0.75rem',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            background: '#FFFFFF',
                            cursor: 'pointer',
                            color: '#334155',
                            fontWeight: 500
                          }}
                        >
                          /student/my-courses
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mode 2: Choose Course Category */}
                  {linkMode === 'category' && (
                    <div style={{ marginBottom: '10px' }}>
                      <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                        Select Course Category
                      </label>
                      <select
                        className="form-control"
                        value={selectedCategoryId}
                        onChange={e => {
                          const val = e.target.value;
                          setSelectedCategoryId(val);
                          if (val) {
                            setCtaLink(`/student/courses?categoryId=${val}`);
                          } else {
                            setCtaLink('/student/courses');
                          }
                        }}
                        style={{
                          borderRadius: '8px',
                          padding: '9px 12px',
                          border: '1px solid #CBD5E1',
                          fontSize: '0.88rem'
                        }}
                      >
                        <option value="">-- Select a Course Category --</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {selectedCategoryId && (
                        <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: '#4338CA', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-arrow-right"></i>
                          Filters catalog for: <strong>{categories.find(c => String(c.id) === String(selectedCategoryId))?.name}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Mode 3: Select Course Related to Category */}
                  {linkMode === 'course' && (
                    <div style={{ marginBottom: '10px' }}>
                      <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                            1. Select Category
                          </label>
                          <select
                            className="form-control"
                            value={courseCategoryId}
                            onChange={e => {
                              const catId = e.target.value;
                              setCourseCategoryId(catId);
                              setSelectedCourseId('');
                              if (catId) {
                                setCtaLink(`/student/courses?categoryId=${catId}`);
                              } else {
                                setCtaLink('/student/courses');
                              }
                            }}
                            style={{
                              borderRadius: '8px',
                              padding: '9px 12px',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.88rem'
                            }}
                          >
                            <option value="">-- Choose Category First --</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                            2. Select Course
                          </label>
                          <select
                            className="form-control"
                            value={selectedCourseId}
                            disabled={!courseCategoryId}
                            onChange={e => {
                              const cId = e.target.value;
                              setSelectedCourseId(cId);
                              if (cId) {
                                setCtaLink(`/student/courses/${cId}`);
                              } else if (courseCategoryId) {
                                setCtaLink(`/student/courses?categoryId=${courseCategoryId}`);
                              }
                            }}
                            style={{
                              borderRadius: '8px',
                              padding: '9px 12px',
                              border: '1px solid #CBD5E1',
                              fontSize: '0.88rem'
                            }}
                          >
                            {!courseCategoryId ? (
                              <option value="">← Select Category First</option>
                            ) : filteredCategoryCourses.length === 0 ? (
                              <option value="">No courses in this category</option>
                            ) : (
                              <>
                                <option value="">-- Select Course --</option>
                                {filteredCategoryCourses.map(course => (
                                  <option key={course.id} value={course.id}>
                                    {course.name} {course.status && course.status !== 'PUBLISHED' ? `(${course.status})` : ''}
                                  </option>
                                ))}
                              </>
                            )}
                          </select>
                        </div>
                      </div>

                      {selectedCourseId && (
                        <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-circle-check"></i>
                          Directs students to: <strong>{courses.find(c => String(c.id) === String(selectedCourseId))?.name}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Target Destination Preview Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '12px',
                      padding: '8px 12px',
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span style={{ fontWeight: 700, color: '#64748B', flexShrink: 0 }}>Target Destination:</span>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          color: '#4338CA',
                          fontWeight: 600,
                          background: '#EEF2FF',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {ctaLink || '/student/courses'}
                      </span>
                    </div>
                    {linkMode !== 'direct' && (
                      <button
                        type="button"
                        onClick={() => setLinkMode('direct')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748B',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          flexShrink: 0
                        }}
                        title="Switch to direct link input to edit manually"
                      >
                        Edit manually
                      </button>
                    )}
                  </div>
                </div>

                {/* Display Order & Active State row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.86rem', color: '#1E293B', marginBottom: '6px' }}>
                      Display Order (Sort Index)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      min={0}
                      value={displayOrder}
                      onChange={e => setDisplayOrder(e.target.value)}
                      style={{
                        borderRadius: '10px',
                        padding: '9px 12px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 14px',
                      background: '#F8FAFC',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      marginTop: '22px'
                    }}
                  >
                    <input
                      type="checkbox"
                      id="activeToggle"
                      checked={active}
                      onChange={e => setActive(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#4338CA' }}
                    />
                    <label htmlFor="activeToggle" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E293B', cursor: 'pointer', margin: 0 }}>
                      Active (Live on Carousel)
                    </label>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 24px',
                  borderTop: '1px solid #F1F5F9',
                  background: '#F8FAFC',
                  flexShrink: 0
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #5A70D3 0%, #4338CA 100%)',
                    color: '#FFFFFF',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(90, 112, 211, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                  {saving ? 'Saving...' : editingBanner ? 'Update Banner' : 'Create Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
