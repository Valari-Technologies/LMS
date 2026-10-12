import React, { useState, useEffect } from 'react';
import {
  listAdminPromoBanners,
  getPromoBannerById,
  createPromoBanner,
  updatePromoBannerById,
  deletePromoBanner,
  togglePromoBannerStatusById,
  uploadPromoBannerImage,
  getAdminPromoBanner,
  updatePromoBanner,
  togglePromoBannerStatus
} from '../../api/banners';
import { listCategories } from '../../api/categories';
import { listAdminCourses, browseCourses } from '../../api/courses';
import { useNotification } from '../../context/NotificationContext';
import PromoBannerSection, { ICON_MAP } from '../../components/PromoBannerSection';
import { emitSyncEvent, SYNC_EVENTS } from '../../utils/syncEvents';
import { usePermission } from '../../hooks/usePermission';

// 26 Rich Curated Color Theme Presets
const COLOR_PRESETS = [
  { name: 'OneTutor Primary Blue', bg: '#5A70D3', text: '#ffffff', accent: '#E8EBFA' },
  { name: 'OneTutor Dark Blue', bg: '#34479C', text: '#ffffff', accent: '#6B82C4' },
  { name: 'OneTutor Soft Blue', bg: '#F1F3FD', text: '#111827', accent: '#5A70D3' },
  { name: 'OneTutor Dark Slate', bg: '#1c1d29', text: '#ffffff', accent: '#a855f7' },
  { name: 'Midnight Navy', bg: '#0f172a', text: '#ffffff', accent: '#38bdf8' },
  { name: 'Royal Purple', bg: '#2e1065', text: '#ffffff', accent: '#c084fc' },
  { name: 'Deep Indigo', bg: '#1e1b4b', text: '#ffffff', accent: '#818cf8' },
  { name: 'Emerald Forest', bg: '#064e3b', text: '#ffffff', accent: '#34d399' },
  { name: 'Charcoal Minimal', bg: '#18181b', text: '#ffffff', accent: '#f59e0b' },
  { name: 'Clean Light', bg: '#f8fafc', text: '#0f172a', accent: '#7e22ce' },
  { name: 'Obsidian Gold', bg: '#141414', text: '#ffffff', accent: '#fbbf24' },
  { name: 'Crimson Velvet', bg: '#450a0a', text: '#ffffff', accent: '#f87171' },
  { name: 'Cyberpunk Neon', bg: '#09090b', text: '#ffffff', accent: '#ec4899' },
  { name: 'Electric Teal', bg: '#042f2e', text: '#ffffff', accent: '#2dd4bf' },
  { name: 'Sunset Amber', bg: '#431407', text: '#ffffff', accent: '#fb923c' },
  { name: 'Ocean Deep', bg: '#082f49', text: '#ffffff', accent: '#38bdf8' },
  { name: 'Rose Wine', bg: '#4c0519', text: '#ffffff', accent: '#fb7185' },
  { name: 'Nordic Frost', bg: '#1e293b', text: '#ffffff', accent: '#93c5fd' },
  { name: 'Cocoa Espresso', bg: '#291812', text: '#ffffff', accent: '#d97706' },
  { name: 'Matrix Terminal', bg: '#022c22', text: '#ffffff', accent: '#4ade80' },
  { name: 'Titanium Silver', bg: '#27272a', text: '#ffffff', accent: '#e4e4e7' },
  { name: 'Lavender Mist', bg: '#f3e8ff', text: '#3b0764', accent: '#111111' },
  { name: 'Cobalt Blue', bg: '#172554', text: '#ffffff', accent: '#60a5fa' },
  { name: 'Forest Moss', bg: '#14532d', text: '#ffffff', accent: '#86efac' },
  { name: 'Warm Terracotta', bg: '#7c2d12', text: '#ffffff', accent: '#fdba74' },
  { name: 'Coral Sunrise', bg: '#fff1f2', text: '#881337', accent: '#f43f5e' },
  { name: 'Dark Plum', bg: '#3b0764', text: '#ffffff', accent: '#e879f9' },
  { name: 'Twilight Magenta', bg: '#581c87', text: '#ffffff', accent: '#f43f5e' },
  { name: 'Modern Alabaster', bg: '#f1f5f9', text: '#0f172a', accent: '#2563eb' },
];

export default function AdminPromoBannerPage() {
  const { isReadOnly } = usePermission();
  const { showToast, toast } = useNotification();

  const notify = ({ type = 'info', title, message }) => {
    if (typeof showToast === 'function') {
      showToast({ type, title, message });
    } else if (toast && typeof toast[type] === 'function') {
      toast[type](message || title);
    }
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [previewMode, setPreviewMode] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'

  // Promo Banners Catalog State
  const [promoBanners, setPromoBanners] = useState([]);
  const [selectedBannerId, setSelectedBannerId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Categories & Courses for link selection
  const [categories, setCategories] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // CTA Link Setup States
  // Modes: 'direct' | 'category' | 'course'
  const [linkMode, setLinkMode] = useState('direct');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [courseCategoryId, setCourseCategoryId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // Secondary Link Setup States
  const [secondaryLinkMode, setSecondaryLinkMode] = useState('direct');
  const [secondarySelectedCategoryId, setSecondarySelectedCategoryId] = useState('');
  const [secondaryCourseCategoryId, setSecondaryCourseCategoryId] = useState('');
  const [secondarySelectedCourseId, setSecondarySelectedCourseId] = useState('');

  // Link Selection Modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [modalTarget, setModalTarget] = useState('cta'); // 'cta' | 'secondary'
  const [modalTab, setModalTab] = useState('categories'); // 'categories' | 'courses'
  const [modalSearch, setModalSearch] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: 'Build your career with a Personal Plan subscription',
    subtitle: 'Subscribers save an average of ₹4,000+ in their first month, stop paying per course. Join 5 lakh+ learners, starting at ₹500/month.',
    bgColor: '#5A70D3',
    textColor: '#ffffff',
    accentColor: '#E8EBFA',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
    secondaryImageUrl: '',
    imageAlignment: 'right', // 'left' or 'right'
    ctaText: 'Subscribe now',
    ctaLink: '/student/courses',
    ctaBgColor: '#ffffff',
    ctaTextColor: '#5A70D3',
    secondaryLinkText: 'Learn more',
    secondaryLinkUrl: '/student/courses',
    secondaryLinkColor: '#ffffff',
    featuresColumns: 2,
    active: true,
  });

  const [features, setFeatures] = useState([
    { icon: 'star', text: 'Get access to 28,000+ top-rated courses' },
    { icon: 'lightbulb', text: 'Learn from 9,000+ expert instructors' },
    { icon: 'tv', text: 'Dev, IT, Business, Design and 50+ more topics' },
    { icon: 'trophy', text: 'Certification prep for AWS, Microsoft, PMI, and more' },
  ]);

  useEffect(() => {
    loadBanner();
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

  // Keep CTA course category dropdown synced if courses finish loading
  useEffect(() => {
    if (selectedCourseId && !courseCategoryId && courses.length > 0) {
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
  }, [courses, selectedCourseId, courseCategoryId, categories]);

  // Keep Secondary course category dropdown synced if courses finish loading
  useEffect(() => {
    if (secondarySelectedCourseId && !secondaryCourseCategoryId && courses.length > 0) {
      const matched = courses.find(c => String(c.id) === String(secondarySelectedCourseId));
      if (matched) {
        if (matched.categoryId) {
          setSecondaryCourseCategoryId(String(matched.categoryId));
        } else if (matched.categoryName) {
          const cat = categories.find(cat => cat.name?.toLowerCase() === matched.categoryName?.toLowerCase());
          if (cat) setSecondaryCourseCategoryId(String(cat.id));
        }
      }
    }
  }, [courses, secondarySelectedCourseId, secondaryCourseCategoryId, categories]);

  function populateFormFromData(data) {
    if (!data) return;
    const link = data.ctaLink || '/student/courses';
    const secLink = data.secondaryLinkUrl || '/student/courses';

    setFormData({
      id: data.id,
      title: data.title || '',
      subtitle: data.subtitle || '',
      bgColor: data.bgColor || '#1c1d29',
      textColor: data.textColor || '#ffffff',
      accentColor: data.accentColor || '#a855f7',
      imageUrl: data.imageUrl || '',
      secondaryImageUrl: '',
      imageAlignment: data.imageAlignment || 'right',
      ctaText: data.ctaText || '',
      ctaLink: link,
      ctaBgColor: data.ctaBgColor || '#ffffff',
      ctaTextColor: data.ctaTextColor || '#1c1d29',
      secondaryLinkText: data.secondaryLinkText || '',
      secondaryLinkUrl: secLink,
      secondaryLinkColor: data.secondaryLinkColor || '#ffffff',
      featuresColumns: data.featuresColumns || 2,
      active: data.active !== false,
    });

    // Auto-detect CTA link mode
    const catMatch = link.match(/[?&]categoryId=(\d+)/);
    const courseMatch = link.match(/\/student\/courses\/(\d+)(?:[/?#]|$)/);
    if (catMatch) {
      setLinkMode('category');
      setSelectedCategoryId(catMatch[1]);
    } else if (courseMatch) {
      setLinkMode('course');
      setSelectedCourseId(courseMatch[1]);
    } else {
      setLinkMode('direct');
    }

    // Auto-detect Secondary link mode
    const secCatMatch = secLink.match(/[?&]categoryId=(\d+)/);
    const secCourseMatch = secLink.match(/\/student\/courses\/(\d+)(?:[/?#]|$)/);
    if (secCatMatch) {
      setSecondaryLinkMode('category');
      setSecondarySelectedCategoryId(secCatMatch[1]);
    } else if (secCourseMatch) {
      setSecondaryLinkMode('course');
      setSecondarySelectedCourseId(secCourseMatch[1]);
    } else {
      setSecondaryLinkMode('direct');
    }

    if (data.featuresJson) {
      try {
        const parsed = JSON.parse(data.featuresJson);
        if (Array.isArray(parsed)) setFeatures(parsed);
      } catch (e) {
        // keep fallback
      }
    }
  }

  async function loadBanner(targetId = null) {
    try {
      setLoading(true);
      const list = await listAdminPromoBanners().catch(() => []);
      setPromoBanners(list || []);

      let data = null;
      if (list && list.length > 0) {
        if (targetId) {
          data = list.find(b => String(b.id) === String(targetId)) || list[0];
        } else {
          data = list.find(b => b.active) || list[0];
        }
      } else {
        data = await getAdminPromoBanner();
      }

      if (data) {
        setSelectedBannerId(data.id);
        populateFormFromData(data);
      }
    } catch (err) {
      notify({
        type: 'error',
        title: 'Load Failed',
        message: 'Could not load promo banner settings',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSelectBanner(id) {
    const target = promoBanners.find(b => b.id === id);
    if (target) {
      setSelectedBannerId(id);
      populateFormFromData(target);
    }
  }

  async function handleCreateNewBanner(customTitle = null) {
    if (isReadOnly) return;
    try {
      setCreating(true);
      const newPayload = {
        title: (customTitle && customTitle.trim()) || `Special Promotion ${promoBanners.length + 1}`,
        subtitle: 'Subscribers save an average of ₹4,000+ in their first month, stop paying per course. Join 5 lakh+ learners.',
        bgColor: '#1e1b4b',
        textColor: '#ffffff',
        accentColor: '#fbbf24',
        imageUrl: 'https://res.cloudinary.com/q9yidryy/image/upload/v1791526803/onetutor/banners/file_skvq2c.png',
        secondaryImageUrl: '',
        imageAlignment: 'right',
        ctaText: 'Explore Now',
        ctaLink: '/student/courses',
        ctaBgColor: '#fbbf24',
        ctaTextColor: '#1e1b4b',
        secondaryLinkText: 'Learn More',
        secondaryLinkUrl: '/student/courses',
        secondaryLinkColor: '#ffffff',
        featuresJson: JSON.stringify([
          { icon: 'star', text: 'Top Industry Mentors' },
          { icon: 'check', text: 'Hands-On Projects' }
        ]),
        featuresColumns: 2,
        active: false
      };

      const created = await createPromoBanner(newPayload);
      emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
      notify({
        type: 'success',
        title: 'Promo Banner Created',
        message: `Created "${created.title}". You can now customize and activate it.`,
      });

      const list = await listAdminPromoBanners().catch(() => []);
      setPromoBanners(list || []);
      setSelectedBannerId(created.id);
      populateFormFromData(created);
      setShowCreateModal(false);
    } catch (err) {
      notify({
        type: 'error',
        title: 'Creation Failed',
        message: err?.response?.data?.message || 'Could not create new promo banner',
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteBanner(id) {
    if (isReadOnly) return;
    if (promoBanners.length <= 1) {
      notify({
        type: 'warning',
        title: 'Cannot Delete',
        message: 'At least one promo banner must remain in the platform.',
      });
      return;
    }
    if (!window.confirm('Are you sure you want to delete this promo banner?')) return;

    try {
      setDeletingId(id);
      await deletePromoBanner(id);
      emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
      notify({
        type: 'success',
        title: 'Deleted Successfully',
        message: 'Promo banner removed.',
      });

      const list = await listAdminPromoBanners().catch(() => []);
      setPromoBanners(list || []);
      const remaining = list.find(b => b.id !== id) || list[0];
      if (remaining) {
        setSelectedBannerId(remaining.id);
        populateFormFromData(remaining);
      }
    } catch (err) {
      notify({
        type: 'error',
        title: 'Delete Failed',
        message: err?.response?.data?.message || 'Could not delete promo banner',
      });
    } finally {
      setDeletingId(null);
    }
  }

  function handleFieldChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  function applyPreset(preset) {
    const isLight = preset.text === '#0f172a' || preset.text === '#3b0764' || preset.text === '#881337';
    setFormData(prev => ({
      ...prev,
      bgColor: preset.bg,
      textColor: preset.text,
      accentColor: preset.accent,
      ctaBgColor: isLight ? preset.accent : '#ffffff',
      ctaTextColor: isLight ? '#ffffff' : (preset.bg.startsWith('#f') ? '#1e293b' : preset.bg),
      secondaryLinkColor: isLight ? preset.accent : (preset.text || '#ffffff'),
    }));
    notify({
      type: 'info',
      title: 'Theme Applied',
      message: `Switched palette to ${preset.name}`,
    });
  }

  function handleAddFeature() {
    if (features.length >= 8) {
      notify({ type: 'warning', title: 'Limit Reached', message: 'Maximum 8 feature points allowed.' });
      return;
    }
    setFeatures([...features, { icon: 'check', text: 'New key feature highlight' }]);
  }

  function handleUpdateFeature(index, field, value) {
    const next = [...features];
    next[index] = { ...next[index], [field]: value };
    setFeatures(next);
  }

  function handleRemoveFeature(index) {
    if (features.length <= 1) {
      notify({ type: 'warning', title: 'Action Disallowed', message: 'At least 1 feature point is recommended.' });
      return;
    }
    setFeatures(features.filter((_, i) => i !== index));
  }

  async function handleFileUpload(e) {
    if (isReadOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMain(true);
    e.target.value = '';

    try {
      const res = await uploadPromoBannerImage(file);
      if (res && res.url) {
        handleFieldChange('imageUrl', res.url);
        notify({
          type: 'success',
          title: 'Stored in Cloudinary',
          message: 'Promo banner image uploaded and hosted on Cloudinary CDN successfully.',
        });
      }
    } catch (err) {
      notify({
        type: 'error',
        title: 'Cloudinary Upload Failed',
        message: err?.response?.data?.message || 'Failed to upload image to Cloudinary CDN',
      });
    } finally {
      setUploadingMain(false);
    }
  }

  async function handleSave(e) {
    if (e) e.preventDefault();
    if (isReadOnly) return;
    if (!formData.title.trim()) {
      notify({ type: 'warning', title: 'Validation', message: 'Headline title cannot be empty.' });
      return;
    }
    if (uploadingMain) {
      notify({ type: 'warning', title: 'Upload in Progress', message: 'Please wait for image to finish uploading to Cloudinary.' });
      return;
    }
    if (formData.imageUrl && formData.imageUrl.startsWith('blob:')) {
      notify({ type: 'warning', title: 'Cloudinary Upload Required', message: 'Please upload image to Cloudinary before saving.' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        secondaryImageUrl: '',
        featuresJson: JSON.stringify(features),
      };

      let updated;
      if (formData.id) {
        updated = await updatePromoBannerById(formData.id, payload);
      } else {
        updated = await updatePromoBanner(payload);
      }

      emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
      notify({
        type: 'success',
        title: 'Saved Successfully',
        message: 'Promo banner configuration has been updated and saved.',
      });

      const list = await listAdminPromoBanners().catch(() => []);
      setPromoBanners(list || []);
      if (updated) {
        setFormData(prev => ({ ...prev, ...updated }));
      }
    } catch (err) {
      notify({
        type: 'error',
        title: 'Save Failed',
        message: err?.response?.data?.message || 'Could not save promo banner settings',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (isReadOnly) return;
    const nextState = !formData.active;
    setFormData(prev => ({ ...prev, active: nextState }));
    setTogglingStatus(true);
    try {
      if (formData.id) {
        await togglePromoBannerStatusById(formData.id, nextState);
      } else {
        await togglePromoBannerStatus(nextState);
      }
      emitSyncEvent(SYNC_EVENTS.BANNERS_CHANGED);
      notify({
        type: 'success',
        title: nextState ? 'Promo Banner Activated' : 'Promo Banner Deactivated',
        message: nextState
          ? 'Promo banner is now LIVE on the student home page.'
          : 'Promo banner is now HIDDEN (inactive) on the student home page.',
      });
      const list = await listAdminPromoBanners().catch(() => []);
      setPromoBanners(list || []);
    } catch (err) {
      setFormData(prev => ({ ...prev, active: !nextState }));
      notify({
        type: 'error',
        title: 'Status Update Failed',
        message: err?.response?.data?.message || 'Could not update promo banner status',
      });
    } finally {
      setTogglingStatus(false);
    }
  }

  // Filter courses for CTA Category dropdown
  const filteredCategoryCourses = courses.filter(c => {
    if (!courseCategoryId) return false;
    if (String(c.categoryId) === String(courseCategoryId)) return true;
    const selectedCat = categories.find(cat => String(cat.id) === String(courseCategoryId));
    return selectedCat && c.categoryName && c.categoryName.toLowerCase() === selectedCat.name.toLowerCase();
  });

  // Filter courses for Secondary Category dropdown
  const secondaryFilteredCategoryCourses = courses.filter(c => {
    if (!secondaryCourseCategoryId) return false;
    if (String(c.categoryId) === String(secondaryCourseCategoryId)) return true;
    const selectedCat = categories.find(cat => String(cat.id) === String(secondaryCourseCategoryId));
    return selectedCat && c.categoryName && c.categoryName.toLowerCase() === selectedCat.name.toLowerCase();
  });

  // Modal filtered lists
  const modalFilteredCategories = categories.filter(c =>
    !modalSearch || c.name?.toLowerCase().includes(modalSearch.toLowerCase())
  );

  const modalFilteredCourses = courses.filter(c =>
    !modalSearch ||
    c.name?.toLowerCase().includes(modalSearch.toLowerCase()) ||
    c.categoryName?.toLowerCase().includes(modalSearch.toLowerCase())
  );

  function handleSelectCategoryFromModal(category) {
    const newLink = `/student/courses?categoryId=${category.id}`;
    if (modalTarget === 'secondary') {
      setSecondaryLinkMode('category');
      setSecondarySelectedCategoryId(String(category.id));
      handleFieldChange('secondaryLinkUrl', newLink);
      toast({
        type: 'success',
        title: 'Category Selected',
        message: `Secondary link set to category "${category.name}"`,
      });
    } else {
      setLinkMode('category');
      setSelectedCategoryId(String(category.id));
      handleFieldChange('ctaLink', newLink);
      toast({
        type: 'success',
        title: 'Category Selected',
        message: `CTA link set to category "${category.name}"`,
      });
    }
    setShowLinkModal(false);
  }

  function handleSelectCourseFromModal(course) {
    const newLink = `/student/courses/${course.id}`;
    if (modalTarget === 'secondary') {
      setSecondaryLinkMode('course');
      setSecondarySelectedCourseId(String(course.id));
      if (course.categoryId) {
        setSecondaryCourseCategoryId(String(course.categoryId));
      } else if (course.categoryName) {
        const cat = categories.find(c => c.name?.toLowerCase() === course.categoryName?.toLowerCase());
        if (cat) setSecondaryCourseCategoryId(String(cat.id));
      }
      handleFieldChange('secondaryLinkUrl', newLink);
      toast({
        type: 'success',
        title: 'Course Selected',
        message: `Secondary link set to course "${course.name}"`,
      });
    } else {
      setLinkMode('course');
      setSelectedCourseId(String(course.id));
      if (course.categoryId) {
        setCourseCategoryId(String(course.categoryId));
      } else if (course.categoryName) {
        const cat = categories.find(c => c.name?.toLowerCase() === course.categoryName?.toLowerCase());
        if (cat) setCourseCategoryId(String(cat.id));
      }
      handleFieldChange('ctaLink', newLink);
      toast({
        type: 'success',
        title: 'Course Selected',
        message: `CTA link set to course "${course.name}"`,
      });
    }
    setShowLinkModal(false);
  }

  // Helper for destination preview text
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

  // Combined object for live real-time preview
  const livePreviewBanner = {
    ...formData,
    featuresJson: JSON.stringify(features),
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--ud-purple)' }}></i>
        <p style={{ marginTop: '12px', color: 'var(--ud-gray)' }}>Loading promo banner settings...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '3px 8px 32px 8px', maxWidth: '100%', margin: '0' }}>
      {/* Marketing Sub-navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--ud-border)', marginBottom: '16px' }}>
        <a
          href="/admin/banners"
          style={{
            padding: '8px 16px',
            fontWeight: 600,
            fontSize: '0.88rem',
            textDecoration: 'none',
            border: 'none',
            borderBottom: '3px solid transparent',
            background: 'transparent',
            color: 'var(--ud-gray)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa-solid fa-image"></i>
          <span>Hero Banners (Top Carousel)</span>
        </a>

        <button
          type="button"
          style={{
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: '0.88rem',
            border: 'none',
            borderBottom: '3px solid var(--ud-purple)',
            background: 'transparent',
            color: 'var(--ud-purple)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa-solid fa-rectangle-ad"></i>
          <span>Promo Banner (Course Section)</span>
        </button>
      </div>

      {/* Promo Banners Campaign Catalog & CRUD Bar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #E2E8F0',
        borderRadius: '16px',
        padding: '16px 20px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
              Marketing Campaigns ({promoBanners.length})
            </span>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>
              Promo Banners Catalog
            </h3>
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              <i className="fa-solid fa-plus"></i>
              <span>New Promo Banner</span>
            </button>
          )}
        </div>

        {/* Cards of all banners */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {promoBanners.map((b) => {
            const isSelected = selectedBannerId === b.id;
            return (
              <div
                key={b.id}
                onClick={() => handleSelectBanner(b.id)}
                style={{
                  border: isSelected ? '2px solid #6366F1' : '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  background: isSelected ? '#F8FAFC' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: b.bgColor || '#1E1B4B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {b.imageUrl ? (
                        <img src={b.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <i className="fa-solid fa-bullhorn" style={{ color: b.textColor || '#ffffff', fontSize: '0.85rem' }}></i>
                      )}
                    </div>
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        color: '#0F172A',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {b.title || 'Untitled Promo'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        ID #{b.id} {isSelected && '• Editing'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      background: b.active ? '#DCFCE7' : '#F1F5F9',
                      color: b.active ? '#15803D' : '#64748B',
                      border: b.active ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                      letterSpacing: '0.02em'
                    }}>
                      {b.active ? 'LIVE' : 'DRAFT'}
                    </span>

                    {!isReadOnly && promoBanners.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBanner(b.id);
                        }}
                        disabled={deletingId === b.id}
                        title="Delete promo banner"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#EF4444',
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          opacity: 0.7,
                          transition: 'opacity 0.15s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                      >
                        <i className={deletingId === b.id ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-trash-can"}></i>
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}>
                  <span>CTA: <strong style={{ color: '#0F172A' }}>{b.ctaText || 'None'}</strong></span>
                  {b.imageUrl && b.imageUrl.includes('cloudinary.com') ? (
                    <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <i className="fa-solid fa-cloud"></i> Cloudinary
                    </span>
                  ) : (
                    <span style={{ color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-link"></i> External
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Page Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--ud-black)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-rectangle-ad" style={{ color: 'var(--ud-purple)' }}></i>
            <span>Course Promo Banner</span>
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--ud-gray)', fontSize: '0.88rem' }}>
            Promotional callout displayed right below the course section on the student home page.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isReadOnly ? (
            <span className="badge badge-secondary" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>Read-Only Mode</span>
          ) : (
            <>
              {/* Active Status Toggle Pill */}
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={togglingStatus}
                title={formData.active ? 'Click to deactivate and hide from student home page' : 'Click to activate and display on student home page'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 16px',
                  borderRadius: '9999px',
                  border: formData.active ? '1px solid #10b981' : '1px solid #d1d5db',
                  background: formData.active ? '#ecfdf5' : '#f3f4f6',
                  color: formData.active ? '#065f46' : '#6b7280',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: togglingStatus ? 'not-allowed' : 'pointer',
                  opacity: togglingStatus ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                {togglingStatus ? (
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '0.8rem', color: formData.active ? '#10b981' : '#6b7280' }}></i>
                ) : (
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: formData.active ? '#10b981' : '#9ca3af',
                    }}
                  />
                )}
                {togglingStatus
                  ? 'Updating Status...'
                  : formData.active
                    ? 'Banner Active (Live)'
                    : 'Banner Hidden (Inactive)'}
              </button>

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="ud-btn-primary"
                style={{
                  padding: '9px 22px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Saving Changes...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk"></i> Save Promo Banner
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ===================================================================
          TOP SECTION: LIVE REAL-TIME PREVIEW
          =================================================================== */}
      <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* Preview Control Bar */}
        <div
          style={{
            background: 'var(--ud-white)',
            border: '1px solid var(--ud-border)',
            borderRadius: '12px',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--ud-shadow-sm)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
            <span style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--ud-black)' }}>
              Live Real-Time Banner Preview
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--ud-gray)', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
              Updates instantly as you edit the settings below
            </span>
          </div>

          {/* Viewport Device Switcher */}
          <div style={{ display: 'flex', background: 'var(--ud-light-gray)', padding: '3px', borderRadius: '8px', border: '1px solid var(--ud-border)' }}>
            <button
              type="button"
              onClick={() => setPreviewMode('desktop')}
              title="Desktop View"
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: previewMode === 'desktop' ? '#fff' : 'transparent',
                color: previewMode === 'desktop' ? 'var(--ud-purple)' : '#6b7280',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: previewMode === 'desktop' ? 'var(--ud-shadow-sm)' : 'none',
              }}
            >
              <i className="fa-solid fa-desktop" style={{ marginRight: '6px' }}></i> Desktop
            </button>

            <button
              type="button"
              onClick={() => setPreviewMode('tablet')}
              title="Tablet View"
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: previewMode === 'tablet' ? '#fff' : 'transparent',
                color: previewMode === 'tablet' ? 'var(--ud-purple)' : '#6b7280',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: previewMode === 'tablet' ? 'var(--ud-shadow-sm)' : 'none',
              }}
            >
              <i className="fa-solid fa-tablet-screen-button" style={{ marginRight: '6px' }}></i> Tablet
            </button>

            <button
              type="button"
              onClick={() => setPreviewMode('mobile')}
              title="Mobile View"
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: previewMode === 'mobile' ? '#fff' : 'transparent',
                color: previewMode === 'mobile' ? 'var(--ud-purple)' : '#6b7280',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: previewMode === 'mobile' ? 'var(--ud-shadow-sm)' : 'none',
              }}
            >
              <i className="fa-solid fa-mobile-screen" style={{ marginRight: '6px' }}></i> Mobile
            </button>
          </div>
        </div>

        {/* Live Preview Container Box */}
        <div
          style={{
            background: '#f1f5f9',
            border: '2px dashed #cbd5e1',
            borderRadius: '16px',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflowX: 'auto',
          }}
        >
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <PromoBannerSection
              banner={livePreviewBanner}
              isPreview={true}
              previewMode={previewMode}
            />
          </div>
        </div>
      </div>

      {/* ===================================================================
          BOTTOM SECTION: FILLING SECTIONS (LEFT & RIGHT COLUMNS)
          =================================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '20px', alignItems: 'start' }}>
        
        {/* ===================================================================
            COLUMN 1 (LEFT): THEME, HEADLINE & BULLET POINTS
            =================================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Card 1: Color Themes & Presets (20+ Options) */}
          <div style={{ background: 'var(--ud-white)', border: '1px solid var(--ud-border)', borderRadius: '12px', padding: '22px', boxShadow: 'var(--ud-shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--ud-black)' }}>
                🎨 Background & Color Theme
              </h3>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ud-purple)', background: '#f3e8ff', padding: '3px 8px', borderRadius: '4px' }}>
                {COLOR_PRESETS.length} Presets Available
              </span>
            </div>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: 'var(--ud-gray)' }}>
              Select a curated theme preset or customize with exact hex codes.
            </p>

            {/* Quick Presets (20+ Color Options) */}
            <div style={{ marginBottom: '18px' }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  maxHeight: '175px',
                  overflowY: 'auto',
                  padding: '10px',
                  border: '1px solid var(--ud-border)',
                  borderRadius: '8px',
                  background: '#f8fafc',
                }}
              >
                {COLOR_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: formData.bgColor === preset.bg ? '2px solid var(--ud-purple)' : '1px solid var(--ud-border)',
                      background: 'var(--ud-white)',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: formData.bgColor === preset.bg ? 800 : 600,
                      boxShadow: formData.bgColor === preset.bg ? '0 0 0 1px var(--ud-purple)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '3px',
                        background: preset.bg,
                        border: '1px solid rgba(0,0,0,0.15)',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: preset.accent,
                        flexShrink: 0,
                      }}
                    />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Pickers Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ud-gray)' }}>
                  Background Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={formData.bgColor.startsWith('#') ? formData.bgColor : '#1c1d29'}
                    onChange={e => handleFieldChange('bgColor', e.target.value)}
                    style={{ width: '38px', height: '38px', padding: '2px', border: '1px solid var(--ud-border)', borderRadius: '6px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={formData.bgColor}
                    onChange={e => handleFieldChange('bgColor', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.84rem', border: '1px solid var(--ud-border)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ud-gray)' }}>
                  Text Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={formData.textColor.startsWith('#') ? formData.textColor : '#ffffff'}
                    onChange={e => handleFieldChange('textColor', e.target.value)}
                    style={{ width: '38px', height: '38px', padding: '2px', border: '1px solid var(--ud-border)', borderRadius: '6px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={formData.textColor}
                    onChange={e => handleFieldChange('textColor', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.84rem', border: '1px solid var(--ud-border)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ud-gray)' }}>
                  Icon Accent Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={formData.accentColor.startsWith('#') ? formData.accentColor : '#a855f7'}
                    onChange={e => handleFieldChange('accentColor', e.target.value)}
                    style={{ width: '38px', height: '38px', padding: '2px', border: '1px solid var(--ud-border)', borderRadius: '6px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={formData.accentColor}
                    onChange={e => handleFieldChange('accentColor', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.84rem', border: '1px solid var(--ud-border)', borderRadius: '6px' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Copywriting & Content */}
          <div style={{ background: 'var(--ud-white)', border: '1px solid var(--ud-border)', borderRadius: '12px', padding: '22px', boxShadow: 'var(--ud-shadow-sm)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--ud-black)' }}>
              ✍️ Headline & Subtitle Text
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: 'var(--ud-gray)' }}>
              Enter the prominent promotional message learners will see.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ud-black)' }}>
                Headline Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => handleFieldChange('title', e.target.value)}
                placeholder="e.g. Build your career with a Personal Plan subscription"
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.92rem', border: '1px solid var(--ud-border)', borderRadius: '6px', fontWeight: 600 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ud-black)' }}>
                Supporting Description / Subtitle
              </label>
              <textarea
                rows={3}
                value={formData.subtitle}
                onChange={e => handleFieldChange('subtitle', e.target.value)}
                placeholder="e.g. Subscribers save an average of ₹4,000+ in their first month..."
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.88rem', border: '1px solid var(--ud-border)', borderRadius: '6px', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Card 3: Feature Bullet Points */}
          <div style={{ background: 'var(--ud-white)', border: '1px solid var(--ud-border)', borderRadius: '12px', padding: '22px', boxShadow: 'var(--ud-shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--ud-black)' }}>
                  ✨ Feature Bullet Points
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'var(--ud-gray)' }}>
                  Highlight perks, statistics, and learning value points.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddFeature}
                style={{
                  background: 'var(--ud-purple)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fa-solid fa-plus"></i> Add Bullet
              </button>
            </div>

            {/* Grid Columns Layout Selector (1, 2, or 3 Columns) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
                border: '1px solid var(--ud-border)',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '14px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-table-columns" style={{ color: 'var(--ud-purple)', fontSize: '0.88rem' }}></i>
                <div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ud-black)' }}>
                    Layout Columns per Row:
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--ud-gray)', marginLeft: '6px' }}>
                    Arrange points into 1, 2, or 3 columns
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  background: '#e2e8f0',
                  padding: '3px',
                  borderRadius: '8px',
                  gap: '4px',
                }}
              >
                {[
                  { cols: 1, label: '1 Column', icon: 'fa-solid fa-bars' },
                  { cols: 2, label: '2 Columns', icon: 'fa-solid fa-table-columns' },
                  { cols: 3, label: '3 Columns', icon: 'fa-solid fa-table-cells' },
                ].map(opt => {
                  const isActive = (Number(formData.featuresColumns) || 2) === opt.cols;
                  return (
                    <button
                      key={opt.cols}
                      type="button"
                      onClick={() => handleFieldChange('featuresColumns', opt.cols)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 12px',
                        fontSize: '0.78rem',
                        fontWeight: isActive ? 700 : 500,
                        borderRadius: '6px',
                        border: 'none',
                        background: isActive ? 'var(--ud-purple)' : 'transparent',
                        color: isActive ? '#ffffff' : '#475569',
                        boxShadow: isActive ? '0 1px 3px rgba(126, 34, 206, 0.3)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <i className={opt.icon} style={{ fontSize: '0.74rem' }}></i>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {features.map((feat, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'var(--ud-light-gray)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--ud-border)',
                  }}
                >
                  {/* Icon Selector */}
                  <div style={{ width: '130px', minWidth: '130px' }}>
                    <select
                      value={feat.icon}
                      onChange={e => handleUpdateFeature(idx, 'icon', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: '1px solid var(--ud-border)',
                        borderRadius: '6px',
                        background: '#fff',
                      }}
                    >
                      <option value="star">⭐ Star</option>
                      <option value="lightbulb">💡 Lightbulb</option>
                      <option value="tv">📺 Screen / TV</option>
                      <option value="trophy">🏆 Trophy</option>
                      <option value="sparkles">✨ Sparkles</option>
                      <option value="check">✓ Checkmark</option>
                      <option value="rocket">🚀 Rocket</option>
                      <option value="shield">🛡️ Shield</option>
                      <option value="users">👥 Community</option>
                      <option value="book">📖 Book</option>
                      <option value="laptop">💻 Code</option>
                      <option value="award">🎖️ Award</option>
                    </select>
                  </div>

                  {/* Text Input */}
                  <input
                    type="text"
                    value={feat.text}
                    onChange={e => handleUpdateFeature(idx, 'text', e.target.value)}
                    placeholder="Feature description text..."
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      fontSize: '0.86rem',
                      border: '1px solid var(--ud-border)',
                      borderRadius: '6px',
                      background: '#fff',
                    }}
                  />

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveFeature(idx)}
                    title="Remove bullet point"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                    }}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===================================================================
            COLUMN 2 (RIGHT): VISUAL MEDIA, CTA & SECONDARY LINK CONFIG
            =================================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Card 4: Image & Layout Alignment */}
          <div style={{ background: 'var(--ud-white)', border: '1px solid var(--ud-border)', borderRadius: '12px', padding: '22px', boxShadow: 'var(--ud-shadow-sm)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--ud-black)' }}>
              🖼️ Visual Media & Layout Alignment
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: 'var(--ud-gray)' }}>
              Control image placement (Left vs Right) and upload promo photography.
            </p>

            {/* Alignment Toggle Switch */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '8px', color: 'var(--ud-black)' }}>
                Image Position Alignment
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleFieldChange('imageAlignment', 'left')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px',
                    borderRadius: '8px',
                    border: formData.imageAlignment === 'left' ? '2px solid var(--ud-purple)' : '1px solid var(--ud-border)',
                    background: formData.imageAlignment === 'left' ? '#f3e8ff' : '#fff',
                    color: formData.imageAlignment === 'left' ? '#7e22ce' : '#4b5563',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  <i className="fa-solid fa-align-left"></i>
                  <span>Image on Left</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFieldChange('imageAlignment', 'right')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px',
                    borderRadius: '8px',
                    border: formData.imageAlignment === 'right' ? '2px solid var(--ud-purple)' : '1px solid var(--ud-border)',
                    background: formData.imageAlignment === 'right' ? '#f3e8ff' : '#fff',
                    color: formData.imageAlignment === 'right' ? '#7e22ce' : '#4b5563',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  <span>Image on Right</span>
                  <i className="fa-solid fa-align-right"></i>
                </button>
              </div>
            </div>

            {/* Portrait Visual Image URL & Upload */}
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ud-black)' }}>
                Portrait Visual Image URL
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={formData.imageUrl}
                  onChange={e => handleFieldChange('imageUrl', e.target.value)}
                  placeholder="https://... image url"
                  style={{ flex: 1, padding: '9px 12px', fontSize: '0.86rem', border: '1px solid var(--ud-border)', borderRadius: '6px' }}
                />
                <label
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid var(--ud-border)',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    color: 'var(--ud-black)',
                  }}
                >
                  <i className={uploadingMain ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-upload'}></i>
                  <span>{uploadingMain ? 'Uploading...' : 'Upload'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              {formData.imageUrl && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img
                    src={formData.imageUrl}
                    alt="Preview thumbnail"
                    style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--ud-border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleFieldChange('imageUrl', '')}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    <i className="fa-solid fa-trash-can" style={{ marginRight: '4px' }}></i> Clear Image
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card 5: Buttons & Links with Category & Course Selector for BOTH CTA & Secondary */}
          <div style={{ background: 'var(--ud-white)', border: '1px solid var(--ud-border)', borderRadius: '12px', padding: '22px', boxShadow: 'var(--ud-shadow-sm)' }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--ud-black)' }}>
              🔗 Call to Action & Links
            </h3>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: 'var(--ud-gray)' }}>
              Configure button labels, colors, and link destinations for primary CTA and secondary link.
            </p>

            {/* Primary CTA Label */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ud-black)' }}>
                CTA Button Text
              </label>
              <input
                type="text"
                value={formData.ctaText}
                onChange={e => handleFieldChange('ctaText', e.target.value)}
                placeholder="e.g. Subscribe now"
                style={{ width: '100%', padding: '9px 12px', fontSize: '0.86rem', border: '1px solid var(--ud-border)', borderRadius: '6px' }}
              />
            </div>

            {/* CTA Destination Link Setup Section */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--ud-border)',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: 'var(--ud-black)' }}>
                  <i className="fa-solid fa-link" style={{ color: 'var(--ud-purple)' }}></i>
                  CTA Destination Link
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setModalTarget('cta');
                    setShowLinkModal(true);
                  }}
                  style={{
                    background: 'var(--ud-purple)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="fa-solid fa-table-cells-large"></i>
                  <span>Browse Categories / Courses Modal</span>
                </button>
              </div>

              {/* 3 Link Mode Tabs / Segmented Buttons */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  background: '#e2e8f0',
                  padding: '4px',
                  borderRadius: '8px',
                  marginBottom: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setLinkMode('direct')}
                  style={{
                    padding: '7px 8px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: linkMode === 'direct' ? 700 : 500,
                    background: linkMode === 'direct' ? '#ffffff' : 'transparent',
                    color: linkMode === 'direct' ? 'var(--ud-purple)' : '#475569',
                    boxShadow: linkMode === 'direct' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <i className="fa-solid fa-arrow-up-right-from-square"></i>
                  <span>Direct Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLinkMode('category');
                    if (selectedCategoryId) {
                      handleFieldChange('ctaLink', `/student/courses?categoryId=${selectedCategoryId}`);
                    }
                  }}
                  style={{
                    padding: '7px 8px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: linkMode === 'category' ? 700 : 500,
                    background: linkMode === 'category' ? '#ffffff' : 'transparent',
                    color: linkMode === 'category' ? 'var(--ud-purple)' : '#475569',
                    boxShadow: linkMode === 'category' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <i className="fa-solid fa-layer-group"></i>
                  <span>Course Category</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLinkMode('course');
                    if (selectedCourseId) {
                      handleFieldChange('ctaLink', `/student/courses/${selectedCourseId}`);
                    } else if (courseCategoryId) {
                      handleFieldChange('ctaLink', `/student/courses?categoryId=${courseCategoryId}`);
                    }
                  }}
                  style={{
                    padding: '7px 8px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: linkMode === 'course' ? 700 : 500,
                    background: linkMode === 'course' ? '#ffffff' : 'transparent',
                    color: linkMode === 'course' ? 'var(--ud-purple)' : '#475569',
                    boxShadow: linkMode === 'course' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <i className="fa-solid fa-graduation-cap"></i>
                  <span>Specific Course</span>
                </button>
              </div>

              {/* Mode 1: Direct Link Input */}
              {linkMode === 'direct' && (
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ud-black)' }}>
                    Direct URL / Internal Route
                  </label>
                  <input
                    type="text"
                    value={formData.ctaLink}
                    onChange={e => handleFieldChange('ctaLink', e.target.value)}
                    placeholder="e.g. /student/courses, /student/my-courses, or https://..."
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.84rem', border: '1px solid var(--ud-border)', borderRadius: '6px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ud-gray)' }}>Quick shortcuts:</span>
                    <button
                      type="button"
                      onClick={() => handleFieldChange('ctaLink', '/student/courses')}
                      style={{
                        fontSize: '0.74rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--ud-border)',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      /student/courses
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFieldChange('ctaLink', '/student/my-courses')}
                      style={{
                        fontSize: '0.74rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--ud-border)',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      /student/my-courses
                    </button>
                  </div>
                </div>
              )}

              {/* Mode 2: Choose Course Category */}
              {linkMode === 'category' && (
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ud-black)' }}>
                    Select Course Category
                  </label>
                  <select
                    value={selectedCategoryId}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedCategoryId(val);
                      if (val) {
                        handleFieldChange('ctaLink', `/student/courses?categoryId=${val}`);
                      } else {
                        handleFieldChange('ctaLink', '/student/courses');
                      }
                    }}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.84rem', border: '1px solid var(--ud-border)', borderRadius: '6px', background: '#fff' }}
                  >
                    <option value="">-- Select a Course Category --</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {selectedCategoryId && (
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: 'var(--ud-purple)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <i className="fa-solid fa-arrow-right"></i>
                      Filters catalog for category: {categories.find(c => String(c.id) === String(selectedCategoryId))?.name}
                    </p>
                  )}
                </div>
              )}

              {/* Mode 3: Specific Course in Category */}
              {linkMode === 'course' && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ud-black)' }}>
                        1. Choose Category
                      </label>
                      <select
                        value={courseCategoryId}
                        onChange={e => {
                          const catId = e.target.value;
                          setCourseCategoryId(catId);
                          setSelectedCourseId('');
                          if (catId) {
                            handleFieldChange('ctaLink', `/student/courses?categoryId=${catId}`);
                          } else {
                            handleFieldChange('ctaLink', '/student/courses');
                          }
                        }}
                        style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', border: '1px solid var(--ud-border)', borderRadius: '6px', background: '#fff' }}
                      >
                        <option value="">-- All / Choose Category --</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ud-black)' }}>
                        2. Select Specific Course
                      </label>
                      <select
                        value={selectedCourseId}
                        disabled={!courseCategoryId}
                        onChange={e => {
                          const cId = e.target.value;
                          setSelectedCourseId(cId);
                          if (cId) {
                            handleFieldChange('ctaLink', `/student/courses/${cId}`);
                          } else if (courseCategoryId) {
                            handleFieldChange('ctaLink', `/student/courses?categoryId=${courseCategoryId}`);
                          }
                        }}
                        style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', border: '1px solid var(--ud-border)', borderRadius: '6px', background: '#fff' }}
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
                                {course.name}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {selectedCourseId && (
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <i className="fa-solid fa-check-circle"></i>
                      Navigates to: {courses.find(c => String(c.id) === String(selectedCourseId))?.name}
                    </p>
                  )}
                </div>
              )}

              {/* Target Link Preview Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '8px',
                  padding: '7px 12px',
                  background: '#fff',
                  border: '1px solid var(--ud-border)',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <span style={{ fontWeight: 700, color: 'var(--ud-gray)', whiteSpace: 'nowrap' }}>Active Link:</span>
                  <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: 'var(--ud-purple)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formData.ctaLink || '/student/courses'}
                  </code>
                </div>
                <span style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                  {getBannerDestinationLabel(formData.ctaLink)}
                </span>
              </div>
            </div>

            {/* Button Colors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ud-gray)' }}>
                  Button Background Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={formData.ctaBgColor.startsWith('#') ? formData.ctaBgColor : '#ffffff'}
                    onChange={e => handleFieldChange('ctaBgColor', e.target.value)}
                    style={{ width: '38px', height: '38px', padding: '2px', border: '1px solid var(--ud-border)', borderRadius: '6px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={formData.ctaBgColor}
                    onChange={e => handleFieldChange('ctaBgColor', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.84rem', border: '1px solid var(--ud-border)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ud-gray)' }}>
                  Button Text Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={formData.ctaTextColor.startsWith('#') ? formData.ctaTextColor : '#1c1d29'}
                    onChange={e => handleFieldChange('ctaTextColor', e.target.value)}
                    style={{ width: '38px', height: '38px', padding: '2px', border: '1px solid var(--ud-border)', borderRadius: '6px', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={formData.ctaTextColor}
                    onChange={e => handleFieldChange('ctaTextColor', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.84rem', border: '1px solid var(--ud-border)', borderRadius: '6px' }}
                  />
                </div>
              </div>
            </div>

            {/* Secondary Link Section with Full Link Selection & Color Picker */}
            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--ud-border)' }}>
              {/* Secondary Link Text & Color Picker Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ud-black)' }}>
                    Secondary Link Text
                  </label>
                  <input
                    type="text"
                    value={formData.secondaryLinkText}
                    onChange={e => handleFieldChange('secondaryLinkText', e.target.value)}
                    placeholder="e.g. Learn more"
                    style={{ width: '100%', padding: '9px 12px', fontSize: '0.86rem', border: '1px solid var(--ud-border)', borderRadius: '6px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--ud-gray)' }}>
                    Secondary Link Text Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={formData.secondaryLinkColor?.startsWith('#') ? formData.secondaryLinkColor : '#ffffff'}
                      onChange={e => handleFieldChange('secondaryLinkColor', e.target.value)}
                      style={{ width: '38px', height: '38px', padding: '2px', border: '1px solid var(--ud-border)', borderRadius: '6px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={formData.secondaryLinkColor || '#ffffff'}
                      onChange={e => handleFieldChange('secondaryLinkColor', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '0.84rem', border: '1px solid var(--ud-border)', borderRadius: '6px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Secondary Destination Link Setup Box */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--ud-border)',
                  borderRadius: '10px',
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', color: 'var(--ud-black)' }}>
                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ color: 'var(--ud-purple)' }}></i>
                    Secondary Destination Link
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setModalTarget('secondary');
                      setShowLinkModal(true);
                    }}
                    style={{
                      background: 'var(--ud-purple)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <i className="fa-solid fa-table-cells-large"></i>
                    <span>Browse Categories / Courses Modal</span>
                  </button>
                </div>

                {/* 3 Link Mode Tabs / Segmented Buttons */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '6px',
                    background: '#e2e8f0',
                    padding: '4px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSecondaryLinkMode('direct')}
                    style={{
                      padding: '7px 8px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: secondaryLinkMode === 'direct' ? 700 : 500,
                      background: secondaryLinkMode === 'direct' ? '#ffffff' : 'transparent',
                      color: secondaryLinkMode === 'direct' ? 'var(--ud-purple)' : '#475569',
                      boxShadow: secondaryLinkMode === 'direct' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    <span>Direct Link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSecondaryLinkMode('category');
                      if (secondarySelectedCategoryId) {
                        handleFieldChange('secondaryLinkUrl', `/student/courses?categoryId=${secondarySelectedCategoryId}`);
                      }
                    }}
                    style={{
                      padding: '7px 8px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: secondaryLinkMode === 'category' ? 700 : 500,
                      background: secondaryLinkMode === 'category' ? '#ffffff' : 'transparent',
                      color: secondaryLinkMode === 'category' ? 'var(--ud-purple)' : '#475569',
                      boxShadow: secondaryLinkMode === 'category' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <i className="fa-solid fa-layer-group"></i>
                    <span>Course Category</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSecondaryLinkMode('course');
                      if (secondarySelectedCourseId) {
                        handleFieldChange('secondaryLinkUrl', `/student/courses/${secondarySelectedCourseId}`);
                      } else if (secondaryCourseCategoryId) {
                        handleFieldChange('secondaryLinkUrl', `/student/courses?categoryId=${secondaryCourseCategoryId}`);
                      }
                    }}
                    style={{
                      padding: '7px 8px',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: secondaryLinkMode === 'course' ? 700 : 500,
                      background: secondaryLinkMode === 'course' ? '#ffffff' : 'transparent',
                      color: secondaryLinkMode === 'course' ? 'var(--ud-purple)' : '#475569',
                      boxShadow: secondaryLinkMode === 'course' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <i className="fa-solid fa-graduation-cap"></i>
                    <span>Specific Course</span>
                  </button>
                </div>

                {/* Mode 1: Direct Link Input */}
                {secondaryLinkMode === 'direct' && (
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ud-black)' }}>
                      Direct URL / Internal Route
                    </label>
                    <input
                      type="text"
                      value={formData.secondaryLinkUrl}
                      onChange={e => handleFieldChange('secondaryLinkUrl', e.target.value)}
                      placeholder="e.g. /student/courses, /student/my-courses, or https://..."
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.84rem', border: '1px solid var(--ud-border)', borderRadius: '6px' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--ud-gray)' }}>Quick shortcuts:</span>
                      <button
                        type="button"
                        onClick={() => handleFieldChange('secondaryLinkUrl', '/student/courses')}
                        style={{
                          fontSize: '0.74rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--ud-border)',
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        /student/courses
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFieldChange('secondaryLinkUrl', '/student/my-courses')}
                        style={{
                          fontSize: '0.74rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--ud-border)',
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        /student/my-courses
                      </button>
                    </div>
                  </div>
                )}

                {/* Mode 2: Choose Course Category */}
                {secondaryLinkMode === 'category' && (
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ud-black)' }}>
                      Select Course Category
                    </label>
                    <select
                      value={secondarySelectedCategoryId}
                      onChange={e => {
                        const val = e.target.value;
                        setSecondarySelectedCategoryId(val);
                        if (val) {
                          handleFieldChange('secondaryLinkUrl', `/student/courses?categoryId=${val}`);
                        } else {
                          handleFieldChange('secondaryLinkUrl', '/student/courses');
                        }
                      }}
                      style={{ width: '100%', padding: '8px 10px', fontSize: '0.84rem', border: '1px solid var(--ud-border)', borderRadius: '6px', background: '#fff' }}
                    >
                      <option value="">-- Select a Course Category --</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    {secondarySelectedCategoryId && (
                      <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: 'var(--ud-purple)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <i className="fa-solid fa-arrow-right"></i>
                        Filters catalog for category: {categories.find(c => String(c.id) === String(secondarySelectedCategoryId))?.name}
                      </p>
                    )}
                  </div>
                )}

                {/* Mode 3: Specific Course in Category */}
                {secondaryLinkMode === 'course' && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ud-black)' }}>
                          1. Choose Category
                        </label>
                        <select
                          value={secondaryCourseCategoryId}
                          onChange={e => {
                            const catId = e.target.value;
                            setSecondaryCourseCategoryId(catId);
                            setSecondarySelectedCourseId('');
                            if (catId) {
                              handleFieldChange('secondaryLinkUrl', `/student/courses?categoryId=${catId}`);
                            } else {
                              handleFieldChange('secondaryLinkUrl', '/student/courses');
                            }
                          }}
                          style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', border: '1px solid var(--ud-border)', borderRadius: '6px', background: '#fff' }}
                        >
                          <option value="">-- All / Choose Category --</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--ud-black)' }}>
                          2. Select Specific Course
                        </label>
                        <select
                          value={secondarySelectedCourseId}
                          disabled={!secondaryCourseCategoryId}
                          onChange={e => {
                            const cId = e.target.value;
                            setSecondarySelectedCourseId(cId);
                            if (cId) {
                              handleFieldChange('secondaryLinkUrl', `/student/courses/${cId}`);
                            } else if (secondaryCourseCategoryId) {
                              handleFieldChange('secondaryLinkUrl', `/student/courses?categoryId=${secondaryCourseCategoryId}`);
                            }
                          }}
                          style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', border: '1px solid var(--ud-border)', borderRadius: '6px', background: '#fff' }}
                        >
                          {!secondaryCourseCategoryId ? (
                            <option value="">← Select Category First</option>
                          ) : secondaryFilteredCategoryCourses.length === 0 ? (
                            <option value="">No courses in this category</option>
                          ) : (
                            <>
                              <option value="">-- Select Course --</option>
                              {secondaryFilteredCategoryCourses.map(course => (
                                <option key={course.id} value={course.id}>
                                  {course.name}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    {secondarySelectedCourseId && (
                      <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <i className="fa-solid fa-check-circle"></i>
                        Navigates to: {courses.find(c => String(c.id) === String(secondarySelectedCourseId))?.name}
                      </p>
                    )}
                  </div>
                )}

                {/* Target Link Preview Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    padding: '7px 12px',
                    background: '#fff',
                    border: '1px solid var(--ud-border)',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{ fontWeight: 700, color: 'var(--ud-gray)', whiteSpace: 'nowrap' }}>Active Link:</span>
                    <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: 'var(--ud-purple)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formData.secondaryLinkUrl || '/student/courses'}
                    </code>
                  </div>
                  <span style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                    {getBannerDestinationLabel(formData.secondaryLinkUrl)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ===================================================================
          LINK SELECTION MODAL (Browse Categories / Courses)
          =================================================================== */}
      {showLinkModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowLinkModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--ud-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--ud-black)' }}>
                  🎯 Select {modalTarget === 'secondary' ? 'Secondary' : 'CTA'} Destination Link
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--ud-gray)' }}>
                  Click a category or course to attach it directly to the {modalTarget === 'secondary' ? 'secondary link' : 'promo banner CTA'}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--ud-gray)',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Search & Tab Toggle */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--ud-border)', background: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => setModalTab('categories')}
                  style={{
                    flex: 1,
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: modalTab === 'categories' ? '2px solid var(--ud-purple)' : '1px solid var(--ud-border)',
                    background: modalTab === 'categories' ? '#f3e8ff' : '#fff',
                    color: modalTab === 'categories' ? 'var(--ud-purple)' : 'var(--ud-gray)',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="fa-solid fa-layer-group"></i>
                  <span>Categories ({categories.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('courses')}
                  style={{
                    flex: 1,
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: modalTab === 'courses' ? '2px solid var(--ud-purple)' : '1px solid var(--ud-border)',
                    background: modalTab === 'courses' ? '#f3e8ff' : '#fff',
                    color: modalTab === 'courses' ? 'var(--ud-purple)' : 'var(--ud-gray)',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="fa-solid fa-graduation-cap"></i>
                  <span>Courses ({courses.length})</span>
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ud-gray)', fontSize: '0.85rem' }}></i>
                <input
                  type="text"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                  placeholder={modalTab === 'categories' ? 'Search categories by name...' : 'Search courses by name or category...'}
                  style={{ width: '100%', padding: '9px 12px 9px 34px', fontSize: '0.86rem', border: '1px solid var(--ud-border)', borderRadius: '6px', background: '#fff' }}
                />
              </div>
            </div>

            {/* Modal Content Items */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, minHeight: '300px' }}>
              {modalTab === 'categories' ? (
                modalFilteredCategories.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ud-gray)' }}>
                    <i className="fa-regular fa-folder-open" style={{ fontSize: '2rem', marginBottom: '8px' }}></i>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>No categories match your search.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    {modalFilteredCategories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategoryFromModal(cat)}
                        style={{
                          textAlign: 'left',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: (modalTarget === 'secondary' ? secondarySelectedCategoryId : selectedCategoryId) === String(cat.id) ? '2px solid var(--ud-purple)' : '1px solid var(--ud-border)',
                          background: (modalTarget === 'secondary' ? secondarySelectedCategoryId : selectedCategoryId) === String(cat.id) ? '#f3e8ff' : '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--ud-purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className="fa-solid fa-folder"></i>
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ud-black)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cat.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--ud-gray)' }}>
                            Attach Category Link
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                modalFilteredCourses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ud-gray)' }}>
                    <i className="fa-solid fa-graduation-cap" style={{ fontSize: '2rem', marginBottom: '8px' }}></i>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>No courses match your search.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {modalFilteredCourses.map(course => (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => handleSelectCourseFromModal(course)}
                        style={{
                          textAlign: 'left',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: (modalTarget === 'secondary' ? secondarySelectedCourseId : selectedCourseId) === String(course.id) ? '2px solid #16a34a' : '1px solid var(--ud-border)',
                          background: (modalTarget === 'secondary' ? secondarySelectedCourseId : selectedCourseId) === String(course.id) ? '#ecfdf5' : '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--ud-black)', marginBottom: '3px' }}>
                            {course.name}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--ud-gray)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {course.categoryName && (
                              <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                📁 {course.categoryName}
                              </span>
                            )}
                            {course.instructorName && (
                              <span>👤 {course.instructorName}</span>
                            )}
                          </div>
                        </div>
                        <i className="fa-solid fa-chevron-right" style={{ color: 'var(--ud-gray)', fontSize: '0.8rem' }}></i>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--ud-border)',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: '1px solid var(--ud-border)',
                  background: '#fff',
                  color: 'var(--ud-black)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Promo Banner Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-rectangle-ad" style={{ color: '#6366F1' }}></i>
                <span>Create New Promo Banner</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.86rem', color: '#64748B' }}>
              Create a new promotional campaign banner for the student home page. Images will be securely hosted on Cloudinary CDN.
            </p>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Campaign Title / Headline
            </label>
            <input
              id="new-promo-title-input"
              type="text"
              placeholder="e.g., Summer Bootcamp 40% Off"
              defaultValue={`Special Promotion ${promoBanners.length + 1}`}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.9rem',
                marginBottom: '18px',
                boxSizing: 'border-box'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value;
                  handleCreateNewBanner(val);
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => {
                  const val = document.getElementById('new-promo-title-input')?.value;
                  handleCreateNewBanner(val);
                }}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#4F46E5',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {creating ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i> Creating...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-plus"></i> Create Campaign
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
