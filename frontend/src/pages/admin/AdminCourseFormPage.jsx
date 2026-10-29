import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCourse, createCourse, updateCourse } from '../../api/courses';
import { listCategories } from '../../api/categories';
import { uploadMedia } from '../../api/media';
import { useNotification } from '../../context/NotificationContext';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import AlertBanner from '../../components/AlertBanner';
import AdminSectionManager from './AdminSectionManager';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../auth/AuthContext';

const emptyForm = {
  name: '',
  shortDesc: '',
  description: '',
  thumbnail: '',
  categoryId: '',
  level: 'Beginner',
  duration: '4 weeks',
  language: 'English',
  prerequisites: '',
  learningOutcomes: '',
  sequentialVideoEnabled: true,
  requireVideoCompletion: true,
  sequentialLessonUnlocking: false,
  pauseOnTabInactive: true,
  videoCompletionThreshold: 95,
  progressSaveInterval: 8,
  pricingType: 'free', // 'free' | 'subscription'
  price: 0,
  currency: 'INR',
  subscriptionPeriod: 'lifetime', // 'lifetime' | 'monthly' | 'yearly'
};

const DURATION_PRESETS = ['4 weeks', '8 weeks', '12 Hours', '24 Hours', 'Self-Paced'];
const LEVEL_OPTIONS = [
  { value: 'Beginner', label: 'Beginner', color: '#10b981', bg: '#ecfdf5' },
  { value: 'Intermediate', label: 'Intermediate', color: '#0284c7', bg: '#e0f2fe' },
  { value: 'Advanced', label: 'Advanced', color: '#111111', bg: '#f3e8ff' },
  { value: 'All Levels', label: 'All Levels', color: '#d97706', bg: '#fef3c7' },
];

export default function AdminCourseFormPage() {
  const { isReadOnly } = usePermission();
  const { user } = useAuth();
  const isContentCreator = user?.role === 'content_creator' || user?.role === 'creator';
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { toast } = useNotification();

  const [activeStep, setActiveStep] = useState('info'); // 'info' | 'media' | 'outcomes' | 'curriculum'
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedCourseId, setSavedCourseId] = useState(isEdit ? Number(id) : null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  async function handleCoverImageFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (JPEG, PNG, WEBP, etc.)');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image size exceeds 15MB limit. Please choose a smaller image.');
      return;
    }

    // Instant local preview (0ms delay)
    const localUrl = URL.createObjectURL(file);
    setForm(prev => ({ ...prev, thumbnail: localUrl }));
    if (fileInputRef.current) fileInputRef.current.value = '';

    uploadMedia(file)
      .then(asset => {
        const url = (asset?.storagePath && (asset.storagePath.startsWith('http://') || asset.storagePath.startsWith('https://')))
          ? asset.storagePath
          : (asset?.url && (asset.url.startsWith('http://') || asset.url.startsWith('https://'))
            ? asset.url
            : resolveMediaUrl(asset?.url || asset?.storagePath));
        setForm(prev => ({ ...prev, thumbnail: url }));
        toast.success('Cover image uploaded successfully to Cloudinary!');
      })
      .catch(err => {
        console.error(err);
        toast.error('Failed to sync cover image to Cloudinary.');
      });
  }

  function handleCoverImageChange(e) {
    const file = e.target.files?.[0];
    if (file) handleCoverImageFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleCoverImageFile(file);
  }

  useEffect(() => {
    listCategories({ size: 100 })
      .then((data) => setCategories(data?.content || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) {
      getCourse(id).then((c) => {
        let proposed = null;
        if ((c.pendingApproval || c.pending_approval) && (c.pendingEdits || c.pending_edits)) {
          try {
            proposed = JSON.parse(c.pendingEdits || c.pending_edits);
          } catch (e) {
            console.error('Failed to parse pendingEdits JSON:', e);
          }
        }
        const data = proposed || c;
        setForm({
          name: data.name || c.name || '',
          shortDesc: data.shortDesc || c.shortDesc || '',
          description: data.description || c.description || '',
          thumbnail: data.thumbnail || c.thumbnail || '',
          categoryId: data.categoryId || c.categoryId || '',
          level: data.level || c.level || 'Beginner',
          duration: data.duration || c.duration || '',
          language: data.language || c.language || 'English',
          prerequisites: data.prerequisites || c.prerequisites || '',
          learningOutcomes: data.learningOutcomes || c.learningOutcomes || '',
          sequentialVideoEnabled: data.sequentialVideoEnabled !== undefined ? data.sequentialVideoEnabled : c.sequentialVideoEnabled !== false,
          requireVideoCompletion: data.requireVideoCompletion !== undefined ? data.requireVideoCompletion : c.requireVideoCompletion !== false,
          sequentialLessonUnlocking: data.sequentialLessonUnlocking !== undefined ? data.sequentialLessonUnlocking : c.sequentialLessonUnlocking === true,
          pauseOnTabInactive: data.pauseOnTabInactive !== undefined ? data.pauseOnTabInactive : c.pauseOnTabInactive !== false,
          videoCompletionThreshold: data.videoCompletionThreshold || c.videoCompletionThreshold || 95,
          progressSaveInterval: data.progressSaveInterval || c.progressSaveInterval || 8,
          pricingType: data.pricingType || c.pricingType || 'free',
          price: data.price !== undefined ? data.price : (c.price !== undefined ? c.price : 0),
          currency: data.currency || c.currency || 'INR',
          subscriptionPeriod: data.subscriptionPeriod || c.subscriptionPeriod || 'lifetime',
        });
      }).catch((err) => {
        const msg = 'Failed to load course details.';
        setError(msg);
        toast.error(msg);
      });
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isReadOnly) return;
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      const msg = 'Course title is required.';
      setError(msg);
      toast.error(msg);
      setActiveStep('info');
      return;
    }

    if (!form.categoryId) {
      const msg = 'Please select a course category.';
      setError(msg);
      toast.error(msg);
      setActiveStep('info');
      return;
    }

    setLoading(true);
    const payload = {
      ...form,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
    };

    try {
      if (isEdit) {
        await updateCourse(id, payload);
        const msg = isContentCreator
          ? 'Course details saved! Changes are pending approval from Super Admin before updating live on student pages.'
          : 'Course details saved successfully!';
        setSuccess(msg);
        toast.success(msg);
      } else {
        const created = await createCourse(payload);
        setSavedCourseId(created.id);
        const msg = isContentCreator
          ? 'Course created! It is saved as draft and will require Super Admin approval before going live to students.'
          : 'Course created successfully! You can now build sections & lessons.';
        toast.success(msg);
        navigate(`/admin/courses/${created.id}/edit`, { replace: true });
        setActiveStep('curriculum');
      }
    } catch (err) {
      const details = err.response?.data?.details;
      const msg = details ? Object.values(details)[0] : err.response?.data?.message || 'Could not save course.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedCategoryObj = categories.find(c => String(c.id) === String(form.categoryId));

  return (
    <div className="page" style={{ paddingBottom: '60px' }}>
      {/* Top Header & Breadcrumbs */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', color: 'var(--text-secondary, #64748b)', marginBottom: '6px' }}>
            <Link to="/admin/courses" style={{ color: 'var(--accent-primary, #5A70D3)', textDecoration: 'none', fontWeight: 600 }}>
              Courses
            </Link>
            <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.7rem' }}></i>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {isEdit ? (form.name ? `Edit: ${form.name}` : `Edit Course #${id}`) : 'Create New Course'}
            </span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span>{isEdit ? (form.name ? `Editing: ${form.name}` : 'Edit Course Details') : 'Create New Course'}</span>
            {isEdit && (
              <span style={{ fontSize: '0.78rem', background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '9999px', fontWeight: 800 }}>
                ID #{id}
              </span>
            )}
          </h1>
          <p className="page-subtitle">
            {isEdit
              ? `Managing settings, media, requirements, and curriculum for "${form.name || `Course #${id}`}".`
              : 'Fill in the course overview, metadata, and outcomes to launch a new course.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/admin/courses" className="btn btn-secondary" style={{ fontSize: '0.88rem' }}>
            <i className="fa-solid fa-arrow-left" style={{ marginRight: '6px' }}></i> Back to List
          </Link>
          {savedCourseId && (
            <Link
              to={`/admin/courses/${savedCourseId}/preview`}
              className="btn btn-outline"
              style={{ fontSize: '0.88rem' }}
            >
              <i className="fa-solid fa-eye" style={{ marginRight: '6px' }}></i> Preview Course
            </Link>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            style={{ fontSize: '0.88rem', padding: '9px 20px', fontWeight: 700 }}
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i> Saving…
              </>
            ) : (
              <>
                <i className="fa-solid fa-check" style={{ marginRight: '6px' }}></i>
                {isEdit ? 'Save Changes' : 'Create & Proceed'}
              </>
            )}
          </button>
        </div>
      </div>

      <AlertBanner type="error" message={error} onClose={() => setError('')} />

      {/* Stepper Navigation Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          background: 'var(--bg-card, #ffffff)',
          padding: '8px',
          borderRadius: '12px',
          border: '1px solid var(--border-default, #e2e8f0)',
          marginBottom: '28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          overflowX: 'auto'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveStep('info')}
          style={{
            flex: 1,
            minWidth: '160px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeStep === 'info' ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : 'transparent',
            color: activeStep === 'info' ? 'var(--accent-primary, #5A70D3)' : 'var(--text-secondary, #64748b)',
            fontWeight: activeStep === 'info' ? 700 : 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: activeStep === 'info' ? 'var(--accent-primary, #5A70D3)' : '#cbd5e1',
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.78rem',
            fontWeight: 800
          }}>1</span>
          <span>Basic Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStep('media')}
          style={{
            flex: 1,
            minWidth: '160px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeStep === 'media' ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : 'transparent',
            color: activeStep === 'media' ? 'var(--accent-primary, #5A70D3)' : 'var(--text-secondary, #64748b)',
            fontWeight: activeStep === 'media' ? 700 : 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: activeStep === 'media' ? 'var(--accent-primary, #5A70D3)' : '#cbd5e1',
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.78rem',
            fontWeight: 800
          }}>2</span>
          <span>Media & Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStep('outcomes')}
          style={{
            flex: 1,
            minWidth: '160px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeStep === 'outcomes' ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : 'transparent',
            color: activeStep === 'outcomes' ? 'var(--accent-primary, #5A70D3)' : 'var(--text-secondary, #64748b)',
            fontWeight: activeStep === 'outcomes' ? 700 : 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <span style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: activeStep === 'outcomes' ? 'var(--accent-primary, #5A70D3)' : '#cbd5e1',
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.78rem',
            fontWeight: 800
          }}>3</span>
          <span>Outcomes & Audience</span>
        </button>

        {savedCourseId && (
          <button
            type="button"
            onClick={() => setActiveStep('curriculum')}
            style={{
              flex: 1,
              minWidth: '170px',
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeStep === 'curriculum' ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : 'transparent',
              color: activeStep === 'curriculum' ? 'var(--accent-primary, #5A70D3)' : 'var(--text-secondary, #64748b)',
              fontWeight: activeStep === 'curriculum' ? 700 : 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: activeStep === 'curriculum' ? 'var(--accent-primary, #5A70D3)' : '#cbd5e1',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.78rem',
              fontWeight: 800
            }}>4</span>
            <span>Curriculum Builder</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Basic Course Info */}
        {activeStep === 'info' && (
          <div className="form-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <i className="fa-solid fa-clipboard-list" style={{ fontSize: '1.4rem', color: 'var(--accent-primary, #5A70D3)' }}></i>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Basic Course Information
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Provide the core title, subtitle, domain category, and primary curriculum summary.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Course Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  className="form-control"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Master Full-Stack Web Development with Spring Boot & React"
                  required
                  style={{ fontSize: '1rem', padding: '12px 14px' }}
                />
                <span className="form-hint">Make it catchy, clear, and descriptive (max 100 characters).</span>
              </div>

              <div className="form-group full-width">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Short Subtitle / Tagline
                </label>
                <input
                  className="form-control"
                  name="shortDesc"
                  value={form.shortDesc}
                  onChange={handleChange}
                  placeholder="e.g. Build production-grade full stack web applications step-by-step from scratch."
                />
                <span className="form-hint">Displayed on course cards across the student catalog.</span>
              </div>

              <div className="form-group full-width">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Category / Domain <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-select"
                  name="categoryId"
                  value={form.categoryId}
                  onChange={handleChange}
                  required
                  style={{ fontSize: '0.95rem', padding: '11px 14px' }}
                >
                  <option value="">Select a Category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Full Course Overview & Description
                </label>
                <textarea
                  className="form-textarea"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={6}
                  placeholder="Detailed breakdown of topics covered, module roadmap, real-world projects, and career benefits..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-default, #e2e8f0)' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveStep('media')}
                style={{ fontSize: '0.88rem', padding: '9px 22px', fontWeight: 700 }}
              >
                Next: Media & Details →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Media, Level & Metadata */}
        {activeStep === 'media' && (
          <div className="form-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <i className="fa-solid fa-palette" style={{ fontSize: '1.4rem', color: 'var(--accent-primary, #5A70D3)' }}></i>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Media Assets & Metadata
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Upload a 16:9 cover image and define skill level, duration, and instruction language.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              {/* Left Column: Uploader */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                    Course Cover Image
                  </label>
                  {form.thumbnail && (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, thumbnail: '' }))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}
                    >
                      <i className="fa-solid fa-trash-can" style={{ marginRight: '4px' }}></i> Remove Image
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
                  onChange={handleCoverImageChange}
                  style={{ display: 'none' }}
                />

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? 'var(--accent-primary, #5A70D3)' : 'var(--border-default, #cbd5e1)'}`,
                    borderRadius: '12px',
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: dragOver ? 'rgba(90, 112, 211, 0.08)' : 'var(--bg-surface, #f8fafc)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginBottom: '14px'
                  }}
                >
                  <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '2.2rem', color: 'var(--accent-primary, #5A70D3)', marginBottom: '8px' }}></i>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {uploadingImage ? 'Uploading Image to Server…' : 'Click to Upload or Drag & Drop Cover Image'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Supports PNG, JPG, WEBP (16:9 ratio, max 15MB)
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontSize: '0.84rem' }}>Or Image Web URL</label>
                  <input
                    className="form-control"
                    name="thumbnail"
                    value={form.thumbnail}
                    onChange={handleChange}
                    placeholder="https://example.com/course-cover.jpg"
                  />
                </div>

                {/* Level Selection with Pills */}
                <div className="form-group" style={{ marginBottom: '18px' }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>Difficulty Skill Level</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {LEVEL_OPTIONS.map(opt => {
                      const isSelected = form.level === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, level: opt.value }))}
                          style={{
                            padding: '9px 12px',
                            borderRadius: '8px',
                            border: `1.5px solid ${isSelected ? opt.color : 'var(--border-default, #cbd5e1)'}`,
                            background: isSelected ? opt.bg : 'var(--bg-card, #ffffff)',
                            color: isSelected ? opt.color : 'var(--text-secondary, #475569)',
                            fontWeight: isSelected ? 700 : 600,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <i className="fa-solid fa-signal" style={{ fontSize: '0.75rem' }}></i>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration & Language */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Duration</label>
                    <input
                      className="form-control"
                      name="duration"
                      value={form.duration}
                      onChange={handleChange}
                      placeholder="e.g. 4 weeks"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Language</label>
                    <input
                      className="form-control"
                      name="language"
                      value={form.language}
                      onChange={handleChange}
                      placeholder="e.g. English"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {DURATION_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, duration: preset }))}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-default, #cbd5e1)',
                        background: 'var(--bg-surface, #f1f5f9)',
                        color: 'var(--text-secondary, #475569)',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                {/* Course Pricing & Subscription Setting */}
                <div style={{ marginTop: '22px', paddingTop: '20px', borderTop: '1px solid var(--border-default, #e2e8f0)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <i className="fa-solid fa-credit-card" style={{ color: 'var(--accent-primary, #5A70D3)', fontSize: '1.1rem' }}></i>
                    <label className="form-label" style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0 }}>
                      Course Access &amp; Pricing Model *
                    </label>
                  </div>
                  <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Choose whether this course is free for all registered students or requires a paid subscription / tuition fee.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    {/* Free Option */}
                    <div
                      onClick={() => setForm(prev => ({ ...prev, pricingType: 'free', price: 0 }))}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: `2px solid ${form.pricingType === 'free' ? '#10b981' : 'var(--border-default, #cbd5e1)'}`,
                        background: form.pricingType === 'free' ? '#ecfdf5' : 'var(--bg-card, #ffffff)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="fa-solid fa-gift" style={{ color: '#10b981', fontSize: '1.1rem' }}></i>
                          <span style={{ fontWeight: 800, fontSize: '0.92rem', color: form.pricingType === 'free' ? '#065f46' : 'var(--text-primary)' }}>
                            100% Free
                          </span>
                        </div>
                        <input
                          type="radio"
                          name="pricingType"
                          checked={form.pricingType === 'free'}
                          onChange={() => setForm(prev => ({ ...prev, pricingType: 'free', price: 0 }))}
                          style={{ cursor: 'pointer' }}
                        />
                      </div>
                      <div style={{ fontSize: '0.78rem', color: form.pricingType === 'free' ? '#047857' : 'var(--text-secondary)', lineHeight: 1.4 }}>
                        Free for all students. 1-click instant enrollment without payment.
                      </div>
                    </div>

                    {/* Paid / Subscription Option */}
                    <div
                      onClick={() => setForm(prev => ({ ...prev, pricingType: 'subscription', price: prev.price > 0 ? prev.price : 499 }))}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: `2px solid ${form.pricingType === 'subscription' || form.pricingType === 'paid' ? 'var(--accent-primary, #5A70D3)' : 'var(--border-default, #cbd5e1)'}`,
                        background: form.pricingType === 'subscription' || form.pricingType === 'paid' ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : 'var(--bg-card, #ffffff)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="fa-solid fa-crown" style={{ color: 'var(--accent-primary, #5A70D3)', fontSize: '1.1rem' }}></i>
                          <span style={{ fontWeight: 800, fontSize: '0.92rem', color: form.pricingType === 'subscription' || form.pricingType === 'paid' ? 'var(--accent-primary, #5A70D3)' : 'var(--text-primary)' }}>
                            Subscription / Paid
                          </span>
                        </div>
                        <input
                          type="radio"
                          name="pricingType"
                          checked={form.pricingType === 'subscription' || form.pricingType === 'paid'}
                          onChange={() => setForm(prev => ({ ...prev, pricingType: 'subscription', price: prev.price > 0 ? prev.price : 499 }))}
                          style={{ cursor: 'pointer' }}
                        />
                      </div>
                      <div style={{ fontSize: '0.78rem', color: form.pricingType === 'subscription' || form.pricingType === 'paid' ? '#3730a3' : 'var(--text-secondary)', lineHeight: 1.4 }}>
                        Students must complete checkout via Card, UPI, Net Banking or Wallet.
                      </div>
                    </div>
                  </div>

                  {/* Expandable pricing configuration if paid/subscription */}
                  {(form.pricingType === 'subscription' || form.pricingType === 'paid') && (
                    <div style={{ background: 'var(--bg-surface, #f8fafc)', border: '1px solid var(--border-default, #e2e8f0)', borderRadius: '10px', padding: '16px', marginBottom: '14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.5fr', gap: '12px' }}>
                        {/* Amount */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                            Course Amount / Fee *
                          </label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              {form.currency === 'USD' ? '$' : form.currency === 'EUR' ? '€' : form.currency === 'GBP' ? '£' : '₹'}
                            </span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              name="price"
                              value={form.price}
                              onChange={(e) => setForm(prev => ({ ...prev, price: Math.max(0, Number(e.target.value)) }))}
                              className="form-control"
                              style={{ paddingLeft: '28px', fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}
                              placeholder="499"
                              required
                            />
                          </div>
                        </div>

                        {/* Currency */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                            Currency
                          </label>
                          <select
                            name="currency"
                            value={form.currency}
                            onChange={handleChange}
                            className="form-control"
                            style={{ fontWeight: 600 }}
                          >
                            <option value="INR">INR (₹)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                          </select>
                        </div>

                        {/* Subscription / Access Type */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                            Billing / Access Period
                          </label>
                          <select
                            name="subscriptionPeriod"
                            value={form.subscriptionPeriod}
                            onChange={handleChange}
                            className="form-control"
                            style={{ fontWeight: 600 }}
                          >
                            <option value="lifetime">One-Time (Lifetime Access)</option>
                            <option value="monthly">Monthly Subscription</option>
                            <option value="quarterly">Quarterly (3 Months)</option>
                            <option value="yearly">Annual Subscription</option>
                          </select>
                        </div>
                      </div>

                      {/* Quick price presets */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Presets:</span>
                        {[299, 499, 999, 1499, 1999, 2999].map(presetVal => (
                          <button
                            key={presetVal}
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, price: presetVal }))}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: form.price === presetVal ? '1px solid var(--accent-primary, #5A70D3)' : '1px solid var(--border-default, #cbd5e1)',
                              background: form.price === presetVal ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : 'var(--bg-card, #ffffff)',
                              color: form.price === presetVal ? 'var(--accent-primary, #5A70D3)' : 'var(--text-secondary, #475569)',
                              fontSize: '0.74rem',
                              cursor: 'pointer',
                              fontWeight: 700
                            }}
                          >
                            {form.currency === 'USD' ? '$' : form.currency === 'EUR' ? '€' : form.currency === 'GBP' ? '£' : '₹'}{presetVal}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Course Catalog Card Preview */}
              <div>
                <label className="form-label" style={{ fontWeight: 700, marginBottom: '8px', display: 'block' }}>
                  Student Catalog Card Live Preview
                </label>

                <div
                  style={{
                    background: 'var(--bg-card, #ffffff)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-default, #cbd5e1)',
                    overflow: 'hidden',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                    maxWidth: '360px',
                    margin: '0 auto'
                  }}
                >
                  <div style={{ width: '100%', height: '180px', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
                    {form.thumbnail ? (
                      <img src={resolveMediaUrl(form.thumbnail)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A70D3', background: 'rgba(90, 112, 211, 0.08)' }}>
                        <i className="fa-solid fa-graduation-cap" style={{ fontSize: '3rem' }}></i>
                      </div>
                    )}
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.75)', color: '#ffffff', fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', backdropFilter: 'blur(4px)' }}>
                      {selectedCategoryObj?.name || 'Category'}
                    </span>
                  </div>

                  <div style={{ padding: '16px' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent-primary, #5A70D3)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {form.level}
                    </div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {form.name || 'Your Course Title Will Appear Here'}
                    </h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {form.shortDesc || 'Short course tagline summary displayed on course catalog cards...'}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-subtle, #f1f5f9)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span><i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i>{form.duration || '4 weeks'}</span>
                      {form.pricingType === 'subscription' || form.pricingType === 'paid' ? (
                        <span style={{ fontWeight: 800, color: 'var(--accent-primary, #5A70D3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-solid fa-lock" style={{ fontSize: '0.7rem' }}></i>
                          <span>
                            {form.currency === 'USD' ? '$' : form.currency === 'EUR' ? '€' : form.currency === 'GBP' ? '£' : '₹'}{form.price || 0}
                            {form.subscriptionPeriod === 'monthly' ? ' /mo' : form.subscriptionPeriod === 'yearly' ? ' /yr' : ''}
                          </span>
                        </span>
                      ) : (
                        <span style={{ fontWeight: 800, color: '#059669' }}>Free</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', paddingTop: '16px', borderTop: '1px solid var(--border-default, #e2e8f0)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveStep('info')}
                style={{ fontSize: '0.88rem' }}
              >
                ← Back: Basic Overview
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveStep('outcomes')}
                style={{ fontSize: '0.88rem', padding: '9px 22px', fontWeight: 700 }}
              >
                Next: Outcomes & Audience →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Prerequisites & Learning Outcomes */}
        {activeStep === 'outcomes' && (
          <div className="form-card" style={{ padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <i className="fa-solid fa-bullseye" style={{ fontSize: '1.4rem', color: 'var(--accent-primary, #5A70D3)' }}></i>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Prerequisites & Learning Outcomes
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  Highlight target learner requirements and key skills students will gain.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group full-width">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Prerequisites & Required Prior Knowledge
                </label>
                <textarea
                  className="form-textarea"
                  name="prerequisites"
                  value={form.prerequisites}
                  onChange={handleChange}
                  rows={4}
                  placeholder="e.g. Basic understanding of HTML, CSS, and elementary JavaScript variables."
                />
                <span className="form-hint">Let students know what skills or tools they should have before starting.</span>
              </div>

              <div className="form-group full-width">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  What Students Will Learn (Key Outcomes)
                </label>
                <textarea
                  className="form-textarea"
                  name="learningOutcomes"
                  value={form.learningOutcomes}
                  onChange={handleChange}
                  rows={5}
                  placeholder="e.g. • Master REST API architecture&#10;• Build complete React user interfaces&#10;• Deploy applications to cloud servers"
                />
                <span className="form-hint">Use bullet points or key statements to highlight tangible learner achievements.</span>
              </div>
            </div>

            {/* Video Learning & Anti-Cheat Protection Settings */}
            <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1.5px solid var(--border-default, #e2e8f0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <i className="fa-solid fa-shield-halved" style={{ fontSize: '1.25rem', color: '#5A70D3' }}></i>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Video Learning & Anti-Cheat Protection Rules
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Configure strict sequential video playback, anti-cheat progress enforcement, tab inactive auto-pause, and completion thresholds.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'var(--bg-surface, #f8fafc)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="sequentialVideoEnabled"
                      checked={form.sequentialVideoEnabled}
                      onChange={handleChange}
                      style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#5A70D3' }}
                    />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>
                        Strict Sequential Video Watching
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Prevents students from seeking forward into unwatched portions of a video. Backward seeking is always permitted.
                      </span>
                    </div>
                  </label>
                </div>

                <div style={{ background: 'var(--bg-surface, #f8fafc)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="sequentialLessonUnlocking"
                      checked={form.sequentialLessonUnlocking}
                      onChange={handleChange}
                      style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#5A70D3' }}
                    />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>
                        Sequential Lesson Unlocking
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Locks future lessons until the student completes/passes the preceding lesson in the course curriculum.
                      </span>
                    </div>
                  </label>
                </div>

                <div style={{ background: 'var(--bg-surface, #f8fafc)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="pauseOnTabInactive"
                      checked={form.pauseOnTabInactive}
                      onChange={handleChange}
                      style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#5A70D3' }}
                    />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>
                        Auto-Pause Video on Inactive Tab
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Automatically pauses video playback whenever the browser tab or window loses focus or becomes hidden.
                      </span>
                    </div>
                  </label>
                </div>

                <div style={{ background: 'var(--bg-surface, #f8fafc)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="requireVideoCompletion"
                      checked={form.requireVideoCompletion}
                      onChange={handleChange}
                      style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#5A70D3' }}
                    />
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>
                        Require Completion Threshold
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Marks video as complete only when genuine watched percentage reaches configured threshold.
                      </span>
                    </div>
                  </label>
                </div>

                <div style={{ background: 'var(--bg-surface, #f8fafc)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    Completion Threshold (% of video)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    name="videoCompletionThreshold"
                    value={form.videoCompletionThreshold}
                    onChange={handleChange}
                    min="50"
                    max="100"
                    style={{ fontSize: '0.9rem', padding: '8px 12px' }}
                  />
                  <span className="form-hint" style={{ fontSize: '0.75rem' }}>Default: 95% watched duration.</span>
                </div>

                <div style={{ background: 'var(--bg-surface, #f8fafc)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    Heartbeat Save Interval (Seconds)
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    name="progressSaveInterval"
                    value={form.progressSaveInterval}
                    onChange={handleChange}
                    min="3"
                    max="60"
                    style={{ fontSize: '0.9rem', padding: '8px 12px' }}
                  />
                  <span className="form-hint" style={{ fontSize: '0.75rem' }}>Frequency of anti-cheat heartbeat sync to server.</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', paddingTop: '16px', borderTop: '1px solid var(--border-default, #e2e8f0)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveStep('media')}
                style={{ fontSize: '0.88rem' }}
              >
                ← Back: Media & Details
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ fontSize: '0.88rem', padding: '9px 24px', fontWeight: 700 }}
              >
                {loading ? 'Saving…' : isEdit ? 'Save All Course Changes' : 'Create Course & Build Curriculum'}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Step 4: Curriculum Builder (Rendered outside outer form to prevent nested form submissions) */}
      {activeStep === 'curriculum' && savedCourseId && (
        <div className="form-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <i className="fa-solid fa-layer-group" style={{ fontSize: '1.4rem', color: 'var(--accent-primary, #5A70D3)' }}></i>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Curriculum Builder
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                Create sections, organize lectures, attach video resources, and upload downloadable study files.
              </p>
            </div>
          </div>

          <AdminSectionManager courseId={savedCourseId} isReadOnly={isReadOnly} />
        </div>
      )}
    </div>
  );
}
