import { useState, useEffect, useRef } from 'react';
import { useNotification } from '../../context/NotificationContext';
import { sendAdminBroadcast, resendAdminBroadcast, getAdminBroadcasts } from '../../api/notifications';
import { uploadMedia } from '../../api/media';
import { showSystemNotification } from '../../utils/firebase';
import { usePermission } from '../../hooks/usePermission';

// Quick fill templates to boost productivity
const TEMPLATES = [
  {
    name: '🔴 Live Class Alert',
    type: 'LIVE_CLASS',
    targetRole: 'STUDENT',
    title: '🎥 Live Masterclass Starting in 15 Minutes!',
    message: 'Join instructor live now for today’s interactive session. Have your questions ready!',
    linkUrl: '/student/live-classes'
  },
  {
    name: '📚 New Course Published',
    type: 'COURSE',
    targetRole: 'ALL',
    title: '🚀 New Course Alert: Enroll Now!',
    message: 'We have just launched a brand new course with hands-on projects and quizzes. Explore the curriculum now!',
    linkUrl: '/student/courses'
  },
  {
    name: '🎉 Special Announcement',
    type: 'ANNOUNCEMENT',
    targetRole: 'ALL',
    title: '⚡ Special Weekend Discount & Platform Updates',
    message: 'Check out the latest features and exclusive discounts on all flagship certification tracks!',
    linkUrl: '/student/courses'
  },
  {
    name: '💬 Community Discussion',
    type: 'COMMUNITY',
    targetRole: 'STUDENT',
    title: '💬 Join the Discussion in Course Community',
    message: 'New questions and study resources were just posted in your course discussion board.',
    linkUrl: '/student/community'
  }
];

const CATEGORIES = [
  { id: 'ANNOUNCEMENT', label: 'Announcement', icon: 'fa-bullhorn', color: '#111111', bg: 'rgba(124, 58, 237, 0.1)', border: 'rgba(124, 58, 237, 0.25)' },
  { id: 'COURSE', label: 'Course Update', icon: 'fa-book-open', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)', border: 'rgba(37, 99, 235, 0.25)' },
  { id: 'LIVE_CLASS', label: 'Live Class', icon: 'fa-video', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)', border: 'rgba(220, 38, 38, 0.25)' },
  { id: 'COMMUNITY', label: 'Community', icon: 'fa-comments', color: '#d97706', bg: 'rgba(217, 119, 6, 0.1)', border: 'rgba(217, 119, 6, 0.25)' },
  { id: 'SYSTEM', label: 'System Notice', icon: 'fa-gear', color: '#059669', bg: 'rgba(5, 150, 105, 0.1)', border: 'rgba(5, 150, 105, 0.25)' },
];

const QUICK_LINKS = [
  { label: 'All Courses', url: '/student/courses' },
  { label: 'Live Classes', url: '/student/live-classes' },
  { label: 'Community', url: '/student/community' },
  { label: 'My Learning', url: '/student/dashboard' },
];

export default function AdminNotificationCenterPage() {
  const { isReadOnly } = usePermission();
  const { toast, confirm } = useNotification();

  // Form states
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('ANNOUNCEMENT');
  const [targetRole, setTargetRole] = useState('ALL');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageMode, setImageMode] = useState('upload'); // 'upload' | 'url'
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);

  // History & Table State
  const [broadcasts, setBroadcasts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [historyCategory, setHistoryCategory] = useState('ALL');

  // Preview Mode: 'mobile' | 'desktop' | 'inapp'
  const [previewTab, setPreviewTab] = useState('mobile');

  const [resendingId, setResendingId] = useState(null);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadBroadcastHistory(page);
  }, [page]);

  async function loadBroadcastHistory(targetPage = 0) {
    setLoadingHistory(true);
    try {
      const res = await getAdminBroadcasts({ page: targetPage, size: 10 });
      setBroadcasts(res?.content || []);
      setTotalPages(res?.totalPages || 1);
      setTotalElements(res?.totalElements || 0);
    } catch (e) {
      toast.error('Failed to load broadcast history');
    } finally {
      setLoadingHistory(false);
    }
  }

  // Calculate quick stats from loaded broadcasts
  const totalRecipients = broadcasts.reduce((sum, b) => sum + (b.recipientCount || 0), 0);
  const totalFcmSuccess = broadcasts.reduce((sum, b) => sum + (b.fcmSuccessCount || 0), 0);

  function applyTemplate(tpl) {
    setTitle(tpl.title);
    setMessage(tpl.message);
    setType(tpl.type);
    setTargetRole(tpl.targetRole);
    setLinkUrl(tpl.linkUrl);
    toast.info(`Loaded "${tpl.name}" template`);
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG, JPG, WebP)');
      return;
    }

    setUploadingImage(true);
    try {
      const uploaded = await uploadMedia(file);
      const url = uploaded.fileUrl || uploaded.filePath || uploaded.url || '';
      setImageUrl(url);
      toast.success('Notification banner image uploaded!');
    } catch (err) {
      toast.error('Failed to upload image: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingImage(false);
    }
  }

  function handleClearImage() {
    setImageUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleResetForm() {
    setTitle('');
    setMessage('');
    setType('ANNOUNCEMENT');
    setTargetRole('ALL');
    setImageUrl('');
    setLinkUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSendBroadcast(e) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter a notification title');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a notification message body');
      return;
    }

    const audienceLabel =
      targetRole === 'ALL'
        ? 'ALL platform users'
        : targetRole === 'STUDENT'
        ? 'all enrolled students'
        : 'all administrators';

    const confirmed = await confirm({
      title: '🚀 Dispatch Broadcast Notification?',
      description: `This notification will be immediately sent to ${audienceLabel} via both in-app inbox and device push notification (FCM). Are you sure?`,
      confirmText: 'Dispatch Broadcast',
      cancelText: 'Cancel',
      variant: 'primary'
    });

    if (!confirmed) return;

    setSending(true);
    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        type: type,
        targetRole: targetRole,
        imageUrl: imageUrl.trim() || null,
        linkUrl: linkUrl.trim() || null
      };

      const res = await sendAdminBroadcast(payload);

      toast.success(
        `Broadcast sent! Delivered to ${res.recipientCount} in-app user(s) & ${res.fcmSuccessCount} push devices.`
      );

      handleResetForm();
      loadBroadcastHistory(0);
      setPage(0);
    } catch (err) {
      toast.error('Broadcast delivery failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSending(false);
    }
  }

  async function handleResend(b) {
    const audienceLabel =
      b.targetRole === 'ALL'
        ? 'ALL platform users'
        : b.targetRole === 'STUDENT'
        ? 'all enrolled students'
        : 'all administrators';

    const confirmed = await confirm({
      title: '🔁 Resend Broadcast Notification?',
      description: `Are you sure you want to resend "${b.title}" to ${audienceLabel}? This will immediately dispatch both in-app notification and device push alerts.`,
      confirmText: 'Resend Now',
      cancelText: 'Cancel',
      variant: 'primary'
    });

    if (!confirmed) return;

    setResendingId(b.id);
    try {
      const res = await resendAdminBroadcast(b.id);
      toast.success(
        `Broadcast resent! Delivered to ${res.recipientCount} in-app user(s) & ${res.fcmSuccessCount} push devices.`
      );
      loadBroadcastHistory(0);
      setPage(0);
    } catch (err) {
      toast.error('Resend delivery failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setResendingId(null);
    }
  }

  function handleLoadIntoComposer(b) {
    setTitle(b.title || '');
    setMessage(b.message || '');
    setType(b.type || 'ANNOUNCEMENT');
    setTargetRole(b.targetRole || 'ALL');
    setImageUrl(b.imageUrl || '');
    setLinkUrl(b.linkUrl || '');
    if (b.imageUrl) {
      setImageMode('url');
    }
    toast.info(`Loaded "${b.title}" into composer for editing`);
    if (composerRef.current) {
      composerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const currentCategory = CATEGORIES.find(c => c.id === type) || CATEGORIES[0];

  // Filter history client-side for immediate responsiveness
  const filteredBroadcasts = broadcasts.filter(b => {
    const matchesCategory = historyCategory === 'ALL' || b.type === historyCategory;
    const matchesSearch = !historySearch ||
      b.title?.toLowerCase().includes(historySearch.toLowerCase()) ||
      b.message?.toLowerCase().includes(historySearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="page" style={{ paddingBottom: '80px' }}>
      
      {/* 1. Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="page-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Notification Center</h1>
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12), rgba(124, 58, 237, 0.15))',
              color: 'var(--accent-primary, #4f46e5)',
              border: '1px solid rgba(79, 70, 229, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <i className="fa-solid fa-tower-broadcast"></i>
              FCM Push & In-App Engine
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: '6px 0 0 0' }}>
            Compose, target, and broadcast instant push notifications, course alerts, and live announcements to users.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (Notification.permission !== 'granted') {
                Notification.requestPermission().then(perm => {
                  if (perm === 'granted') {
                    showSystemNotification('OneTutor System Notification 🚀', {
                      body: 'Windows and browser system push alerts are working perfectly!',
                      linkUrl: '/admin/notifications'
                    });
                    toast.success('System notification triggered!');
                  } else {
                    toast.error('Notification permission is blocked. Please allow notifications in site settings.');
                  }
                });
              } else {
                showSystemNotification('OneTutor System Notification 🚀', {
                  body: 'Windows and browser system push alerts are working perfectly!',
                  linkUrl: '/admin/notifications'
                });
                toast.success('System notification triggered! Check bottom-right of your screen.');
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="fa-solid fa-bell"></i>
            Test Windows Notification
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => loadBroadcastHistory(page)}
            disabled={loadingHistory}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <i className={`fa-solid fa-rotate ${loadingHistory ? 'fa-spin' : ''}`}></i>
            Refresh Logs
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Bar (KPI Cards) */}
      <div className="kpi-grid" style={{ marginBottom: '28px' }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5' }}>
            <i className="fa-solid fa-paper-plane"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-val">{totalElements}</span>
            <span className="kpi-label">Total Broadcasts</span>
            <span className="kpi-sub">All-time campaigns dispatched</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
            <i className="fa-solid fa-bell"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-val">{totalRecipients}</span>
            <span className="kpi-label">In-App Alerts</span>
            <span className="kpi-sub">Delivered directly to user inboxes</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' }}>
            <i className="fa-solid fa-mobile-screen"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-val">{totalFcmSuccess}</span>
            <span className="kpi-label">FCM Push Sent</span>
            <span className="kpi-sub">Delivered to registered browsers & phones</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
            <i className="fa-solid fa-users"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-val">100%</span>
            <span className="kpi-label">Target Reach</span>
            <span className="kpi-sub">Broadcast to Students & Staff</span>
          </div>
        </div>
      </div>

      {/* 3. Quick-Start Templates Bar */}
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-default, #e2e8f0)',
        borderRadius: '14px',
        padding: '14px 18px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap',
        boxShadow: 'var(--shadow-xs)'
      }}>
        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="fa-solid fa-bolt" style={{ color: '#f59e0b' }}></i>
          Quick Templates:
        </span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          {TEMPLATES.map((tpl, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applyTemplate(tpl)}
              style={{
                background: 'var(--bg-surface, #f8fafc)',
                border: '1px solid var(--border-default, #e2e8f0)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-secondary, #334155)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary, #4f46e5)';
                e.currentTarget.style.color = 'var(--accent-primary, #4f46e5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default, #e2e8f0)';
                e.currentTarget.style.color = 'var(--text-secondary, #334155)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {tpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Two Column Layout: Composer (Left) & Realtime Multi-Device Preview (Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: '24px',
        alignItems: 'start',
        marginBottom: '36px'
      }}>

        {/* LEFT COLUMN: Composer Form */}
        <div className="card" ref={composerRef} style={{
          padding: '28px',
          borderRadius: '16px',
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-default, #e2e8f0)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {/* Card Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-subtle, #f1f5f9)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #111111 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
              }}>
                <i className="fa-solid fa-paper-plane"></i>
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Compose Broadcast
                </h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Create and send notifications to thousands of users simultaneously
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetForm}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.8rem' }}
            >
              Clear Form
            </button>
          </div>

          <form onSubmit={handleSendBroadcast}>

            {/* Title Input */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: '0.92rem' }}>
                  Notification Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: title.length > 180 ? '#ef4444' : 'var(--text-muted)'
                }}>
                  {title.length} / 200
                </span>
              </div>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 🎉 Special Live Masterclass Tonight at 7:00 PM!"
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-default, #cbd5e1)',
                  background: 'var(--bg-input, #ffffff)',
                  color: 'var(--text-primary, #0f172a)',
                  fontSize: '0.95rem',
                  fontWeight: 500
                }}
              />
            </div>

            {/* Description Textarea */}
            <div className="form-group" style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: '0.92rem' }}>
                  Message Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {message.length} characters
                </span>
              </div>
              <textarea
                className="input-field"
                rows={4}
                placeholder="Write the full broadcast message that users will read in their notification drawer or push alert..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-default, #cbd5e1)',
                  background: 'var(--bg-input, #ffffff)',
                  color: 'var(--text-primary, #0f172a)',
                  fontSize: '0.94rem',
                  lineHeight: '1.5',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Category Selector (Visual Pills) */}
            <div className="form-group" style={{ marginBottom: '22px' }}>
              <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'block', fontSize: '0.92rem' }}>
                Notification Category
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                {CATEGORIES.map((cat) => {
                  const isSelected = type === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setType(cat.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: isSelected ? `2px solid ${cat.color}` : '1px solid var(--border-default, #e2e8f0)',
                        background: isSelected ? cat.bg : 'var(--bg-surface, #f8fafc)',
                        color: isSelected ? cat.color : 'var(--text-secondary, #475569)',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <i className={`fa-solid ${cat.icon}`}></i>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Audience Selector */}
            <div className="form-group" style={{ marginBottom: '22px' }}>
              <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'block', fontSize: '0.92rem' }}>
                Target Recipients
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {[
                  { role: 'ALL', label: 'All Users', icon: 'fa-users', desc: 'Every registered account' },
                  { role: 'STUDENT', label: 'Students Only', icon: 'fa-user-graduate', desc: 'Enrolled learners only' },
                  { role: 'ADMIN', label: 'Admins Only', icon: 'fa-shield-halved', desc: 'Platform staff only' }
                ].map((aud) => {
                  const isSelected = targetRole === aud.role;
                  return (
                    <div
                      key={aud.role}
                      onClick={() => setTargetRole(aud.role)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid var(--accent-primary, #4f46e5)' : '1px solid var(--border-default, #e2e8f0)',
                        background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-surface, #f8fafc)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <i className={`fa-solid ${aud.icon}`} style={{ color: isSelected ? 'var(--accent-primary, #4f46e5)' : 'var(--text-muted)' }}></i>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: isSelected ? 'var(--accent-primary, #4f46e5)' : 'var(--text-primary)' }}>
                          {aud.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {aud.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Banner Image (Upload or URL) */}
            <div style={{
              marginBottom: '22px',
              padding: '18px',
              borderRadius: '12px',
              border: '1px solid var(--border-default, #e2e8f0)',
              background: 'var(--bg-surface, #f8fafc)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-image" style={{ color: 'var(--accent-primary, #4f46e5)' }}></i>
                  Notification Banner Image (Optional)
                </span>

                <div style={{ display: 'inline-flex', background: 'var(--border-default, #e2e8f0)', padding: '2px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setImageMode('upload')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: imageMode === 'upload' ? 'var(--bg-card, #ffffff)' : 'transparent',
                      color: imageMode === 'upload' ? 'var(--accent-primary, #4f46e5)' : 'var(--text-secondary)',
                      boxShadow: imageMode === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('url')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: imageMode === 'url' ? 'var(--bg-card, #ffffff)' : 'transparent',
                      color: imageMode === 'url' ? 'var(--accent-primary, #4f46e5)' : 'var(--text-secondary)',
                      boxShadow: imageMode === 'url' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    Image URL
                  </button>
                </div>
              </div>

              {imageMode === 'upload' ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                      id="notif-image-file-input"
                    />
                    <label
                      htmlFor="notif-image-file-input"
                      className="btn btn-secondary"
                      style={{
                        cursor: uploadingImage ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '9px 18px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.88rem'
                      }}
                    >
                      {uploadingImage ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin"></i> Uploading Image...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-cloud-arrow-up"></i> Select Image File
                        </>
                      )}
                    </label>

                    {imageUrl && (
                      <button
                        type="button"
                        onClick={handleClearImage}
                        className="btn btn-sm"
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: '8px'
                        }}
                      >
                        <i className="fa-solid fa-trash-can" style={{ marginRight: '6px' }}></i> Remove
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
                    Recommended: 16:9 or 2:1 ratio (PNG, JPG, WebP) under 5MB.
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="https://example.com/banner-photo.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-default, #cbd5e1)',
                      background: 'var(--bg-input, #ffffff)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem'
                    }}
                  />
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="btn btn-secondary btn-sm"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {/* Uploaded Thumbnail Preview inside Composer */}
              {imageUrl && (
                <div style={{
                  marginTop: '12px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  maxHeight: '180px',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  position: 'relative',
                  background: '#000000'
                }}>
                  <img
                    src={imageUrl}
                    alt="Banner preview"
                    style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.65)',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backdropFilter: 'blur(4px)'
                  }}>
                    Attached Banner
                  </div>
                </div>
              )}
            </div>

            {/* Click Action Link & Quick Chips */}
            <div className="form-group" style={{ marginBottom: '26px' }}>
              <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', display: 'block', fontSize: '0.92rem' }}>
                Action Link Destination (Optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. /student/courses or /student/live-classes"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-default, #cbd5e1)',
                  background: 'var(--bg-input, #ffffff)',
                  color: 'var(--text-primary, #0f172a)',
                  fontSize: '0.92rem',
                  marginBottom: '8px'
                }}
              />
              {/* Quick Link Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Quick insert:</span>
                {QUICK_LINKS.map((ql, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLinkUrl(ql.url)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-default, #cbd5e1)',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '0.74rem',
                      color: 'var(--accent-primary, #4f46e5)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {ql.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit / Dispatch Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle, #f1f5f9)'
            }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
                Dispatches to Web Push & In-App
              </span>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetForm}
                  disabled={sending}
                  style={{ borderRadius: '10px', padding: '10px 20px', fontWeight: 600 }}
                >
                  Reset
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sending || uploadingImage || !title.trim() || !message.trim()}
                  style={{
                    borderRadius: '10px',
                    padding: '12px 28px',
                    fontWeight: 700,
                    fontSize: '0.96rem',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {sending ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i> Broadcasting...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i> Send Broadcast Now
                    </>
                  )}
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* RIGHT COLUMN: Multi-Device Interactive Live Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="card" style={{
            padding: '24px',
            borderRadius: '16px',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-default, #e2e8f0)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            
            {/* Preview Header with Device Tabs */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
              paddingBottom: '14px',
              borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-eye" style={{ color: 'var(--accent-primary, #4f46e5)' }}></i>
                  Interactive Preview
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Live simulation of recipient display
                </span>
              </div>

              {/* Segmented Device Switcher */}
              <div style={{ display: 'inline-flex', background: 'var(--border-subtle, #f1f5f9)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-default, #e2e8f0)' }}>
                <button
                  type="button"
                  onClick={() => setPreviewTab('mobile')}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: previewTab === 'mobile' ? 'var(--bg-card, #ffffff)' : 'transparent',
                    color: previewTab === 'mobile' ? 'var(--accent-primary, #4f46e5)' : 'var(--text-secondary)',
                    boxShadow: previewTab === 'mobile' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="fa-solid fa-mobile-screen"></i> Mobile
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('desktop')}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: previewTab === 'desktop' ? 'var(--bg-card, #ffffff)' : 'transparent',
                    color: previewTab === 'desktop' ? 'var(--accent-primary, #4f46e5)' : 'var(--text-secondary)',
                    boxShadow: previewTab === 'desktop' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="fa-solid fa-laptop"></i> Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('inapp')}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: previewTab === 'inapp' ? 'var(--bg-card, #ffffff)' : 'transparent',
                    color: previewTab === 'inapp' ? 'var(--accent-primary, #4f46e5)' : 'var(--text-secondary)',
                    boxShadow: previewTab === 'inapp' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="fa-solid fa-bell"></i> In-App
                </button>
              </div>
            </div>

            {/* TAB 1: MOBILE PUSH CARD MOCKUP */}
            {previewTab === 'mobile' && (
              <div style={{
                background: 'linear-gradient(145deg, #1e1e24 0%, #0d0d11 100%)',
                borderRadius: '24px',
                padding: '24px 16px',
                color: '#ffffff',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                border: '4px solid #2d2d38',
                position: 'relative'
              }}>
                {/* Simulated Phone Notch / Time */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 16px 8px', fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span style={{ fontWeight: 700 }}>9:41</span>
                  <div style={{ width: '60px', height: '4px', background: '#334155', borderRadius: '4px' }}></div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <i className="fa-solid fa-signal" style={{ fontSize: '0.68rem' }}></i>
                    <i className="fa-solid fa-wifi" style={{ fontSize: '0.68rem' }}></i>
                    <i className="fa-solid fa-battery-full" style={{ fontSize: '0.72rem' }}></i>
                  </div>
                </div>

                {/* The Mobile Push Bubble */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(16px)',
                  borderRadius: '16px',
                  padding: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                }}>
                  {/* Top Bar of Mobile Notification */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #4f46e5, #111111)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 800
                      }}>
                        1T
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>OneTutor</span>
                      <span style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>• now</span>
                    </div>

                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: currentCategory.bg,
                      color: currentCategory.color,
                      border: `1px solid ${currentCategory.border}`
                    }}>
                      {currentCategory.label}
                    </span>
                  </div>

                  {/* Title & Body */}
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff', marginBottom: '4px', lineHeight: 1.3 }}>
                    {title.trim() || 'Notification Title Preview'}
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: '1.45', marginBottom: imageUrl ? '10px' : '4px', whiteSpace: 'pre-wrap' }}>
                    {message.trim() || 'Broadcast body message preview will appear here in full clarity for students.'}
                  </div>

                  {/* Image Attachment in Mobile Card */}
                  {imageUrl && (
                    <div style={{ borderRadius: '10px', overflow: 'hidden', marginTop: '8px', marginBottom: '6px', maxHeight: '140px', background: '#000000' }}>
                      <img
                        src={imageUrl}
                        alt="Preview banner"
                        style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Mobile Action Link */}
                  {linkUrl && (
                    <div style={{
                      marginTop: '8px',
                      paddingTop: '6px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: '0.74rem', color: '#93c5fd', fontWeight: 600 }}>
                        Tap to open: {linkUrl}
                      </span>
                      <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.68rem', color: '#93c5fd' }}></i>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.72rem', color: '#64748b' }}>
                  Target Audience: <strong>{targetRole}</strong>
                </div>
              </div>
            )}

            {/* TAB 2: DESKTOP BROWSER BANNER MOCKUP */}
            {previewTab === 'desktop' && (
              <div style={{
                background: '#0f172a',
                borderRadius: '14px',
                padding: '16px 18px',
                color: '#ffffff',
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                position: 'relative'
              }}>
                {/* Browser Notification Chrome */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, #4f46e5, #111111)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: 800
                    }}>
                      1T
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>OneTutor LMS</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>• chrome push</span>
                  </div>

                  <span style={{ fontSize: '0.7rem', color: '#cbd5e1', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                    Audience: {targetRole}
                  </span>
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.94rem', color: '#ffffff', marginBottom: '6px', lineHeight: 1.3 }}>
                  {title.trim() || 'Notification Title Preview'}
                </div>

                <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: '1.45', marginBottom: imageUrl ? '10px' : '4px', whiteSpace: 'pre-wrap' }}>
                  {message.trim() || 'Your broadcast message description will be displayed here in full detail for the user.'}
                </div>

                {imageUrl && (
                  <div style={{ borderRadius: '8px', overflow: 'hidden', marginTop: '8px', marginBottom: '8px', maxHeight: '160px', background: '#000000' }}>
                    <img
                      src={imageUrl}
                      alt="Preview banner"
                      style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.78rem', color: '#818cf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.72rem' }}></i>
                    {linkUrl ? linkUrl : 'Click to open in browser'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    FCM Push
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: IN-APP INBOX ITEM MOCKUP */}
            {previewTab === 'inapp' && (
              <div style={{
                background: 'var(--bg-surface, #f8fafc)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid var(--border-default, #e2e8f0)'
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'start' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: currentCategory.bg,
                    color: currentCategory.color,
                    border: `1px solid ${currentCategory.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    flexShrink: 0
                  }}>
                    <i className={`fa-solid ${currentCategory.icon}`}></i>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {title.trim() || 'Notification Title'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Just now
                      </span>
                    </div>

                    <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: imageUrl ? '8px' : '4px' }}>
                      {message.trim() || 'Message preview as it will appear in the student notification inbox menu.'}
                    </div>

                    {imageUrl && (
                      <div style={{ width: '100%', height: '110px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', border: '1px solid var(--border-default)' }}>
                        <img src={imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}

                    {linkUrl && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--accent-primary, #4f46e5)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        View Details <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.7rem' }}></i>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Guidelines / Tips Card */}
          <div className="card" style={{
            padding: '20px 24px',
            borderRadius: '16px',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-default, #e2e8f0)',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-lightbulb" style={{ color: '#eab308' }}></i>
              Broadcasting Best Practices
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: '1.65' }}>
              <li><strong>Target Responsibly:</strong> Select <em>Students Only</em> when announcing coursework, batch start dates, or live sessions.</li>
              <li><strong>Visual Appeal:</strong> Broadcasts with thumbnail images have up to 3x higher click-through engagement.</li>
              <li><strong>Deep-Linking:</strong> Provide links like <code>/student/live-classes</code> so students reach the destination in one click.</li>
              <li><strong>In-App Retention:</strong> Broadcasts automatically record into every user's in-app Notification center.</li>
            </ul>
          </div>

        </div>

      </div>

      {/* 5. BOTTOM SECTION: Broadcast History & Delivery Log */}
      <div className="card" style={{
        padding: '28px',
        borderRadius: '16px',
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-default, #e2e8f0)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        
        {/* Table Header & Search/Filter Controls */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Broadcast History & Delivery Log
            </h2>
            <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              Total broadcasts dispatched: {totalElements}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-magnifying-glass" style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                fontSize: '0.85rem'
              }}></i>
              <input
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{
                  padding: '8px 12px 8px 34px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  background: 'var(--bg-input, #ffffff)',
                  color: 'var(--text-primary)',
                  fontSize: '0.86rem',
                  minWidth: '180px'
                }}
              />
            </div>

            {/* Category Filter */}
            <select
              value={historyCategory}
              onChange={(e) => setHistoryCategory(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default, #e2e8f0)',
                background: 'var(--bg-input, #ffffff)',
                color: 'var(--text-primary)',
                fontSize: '0.86rem'
              }}
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', marginBottom: '12px', color: 'var(--accent-primary)' }}></i>
            <div style={{ fontWeight: 600 }}>Loading broadcast records...</div>
          </div>
        ) : filteredBroadcasts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '52px 20px',
            background: 'var(--bg-surface, #f8fafc)',
            borderRadius: '12px',
            border: '1px dashed var(--border-default, #e2e8f0)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(79, 70, 229, 0.1)',
              color: 'var(--accent-primary, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto',
              fontSize: '1.5rem'
            }}>
              <i className="fa-solid fa-bullhorn"></i>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              No broadcast campaigns found
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0 0 16px 0' }}>
              {historySearch || historyCategory !== 'ALL'
                ? 'Try adjusting your search or category filter.'
                : 'Compose and dispatch your first rich notification above!'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{
                  borderBottom: '1px solid var(--border-default, #e2e8f0)',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  <th style={{ padding: '12px 14px' }}>Notification Details</th>
                  <th style={{ padding: '12px 14px' }}>Category</th>
                  <th style={{ padding: '12px 14px' }}>Audience</th>
                  <th style={{ padding: '12px 14px' }}>Banner</th>
                  <th style={{ padding: '12px 14px' }}>In-App Delivered</th>
                  <th style={{ padding: '12px 14px' }}>FCM Push Status</th>
                  <th style={{ padding: '12px 14px' }}>Dispatched By</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBroadcasts.map((b) => {
                  const bCategory = CATEGORIES.find(c => c.id === b.type) || CATEGORIES[0];
                  return (
                    <tr key={b.id} style={{
                      borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                      fontSize: '0.88rem',
                      transition: 'background 0.15s ease'
                    }}>
                      <td style={{ padding: '14px', maxWidth: '320px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {b.title}
                        </div>
                        <div style={{
                          fontSize: '0.82rem',
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {b.message}
                        </div>
                        {b.linkUrl && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--accent-primary, #4f46e5)', marginTop: '4px', fontWeight: 600 }}>
                            <i className="fa-solid fa-link" style={{ marginRight: '4px' }}></i>
                            {b.linkUrl}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '14px' }}>
                        <span style={{
                          fontSize: '0.76rem',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          background: bCategory.bg,
                          color: bCategory.color,
                          border: `1px solid ${bCategory.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <i className={`fa-solid ${bCategory.icon}`}></i>
                          {bCategory.label}
                        </span>
                      </td>

                      <td style={{ padding: '14px' }}>
                        <span style={{
                          fontSize: '0.78rem',
                          background: 'var(--bg-surface, #f1f5f9)',
                          color: 'var(--text-primary)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 600,
                          border: '1px solid var(--border-default, #e2e8f0)'
                        }}>
                          {b.targetRole === 'ALL' ? '👥 All Users' : b.targetRole === 'STUDENT' ? '🎓 Students' : '🛡️ Admins'}
                        </span>
                      </td>

                      <td style={{ padding: '14px' }}>
                        {b.imageUrl ? (
                          <a href={b.imageUrl} target="_blank" rel="noreferrer" title="Click to view full image">
                            <img
                              src={b.imageUrl}
                              alt="Banner"
                              style={{ width: '56px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-default)' }}
                            />
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No image</span>
                        )}
                      </td>

                      <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {b.recipientCount} users
                      </td>

                      <td style={{ padding: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#059669',
                            border: '1px solid rgba(16, 185, 129, 0.25)'
                          }}>
                            ✓ {b.fcmSuccessCount} delivered
                          </span>
                          {b.fcmFailureCount > 0 && (
                            <span style={{
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              color: '#dc2626',
                              background: 'rgba(239, 68, 68, 0.1)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              {b.fcmFailureCount} failed
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '14px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {b.sentByName || 'System Admin'}
                      </td>

                      <td style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {new Date(b.createdAt).toLocaleString()}
                      </td>

                      <td style={{ padding: '14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            title="Load into composer to edit or tweak before sending"
                            onClick={() => handleLoadIntoComposer(b)}
                            style={{
                              padding: '5px 10px',
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            title="Resend this broadcast to target audience immediately"
                            onClick={() => handleResend(b)}
                            disabled={resendingId === b.id}
                            style={{
                              padding: '5px 12px',
                              fontSize: '0.78rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'linear-gradient(135deg, #4f46e5 0%, #111111 100%)',
                              border: 'none',
                              color: '#ffffff',
                              boxShadow: '0 2px 4px rgba(79, 70, 229, 0.25)'
                            }}
                          >
                            <i className={`fa-solid ${resendingId === b.id ? 'fa-rotate fa-spin' : 'fa-repeat'}`}></i>
                            <span>{resendingId === b.id ? 'Resending...' : 'Resend'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '20px',
                marginTop: '12px',
                borderTop: '1px solid var(--border-subtle, #f1f5f9)'
              }}>
                <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Showing page {page + 1} of {totalPages}
                </span>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={page === 0}
                    onClick={() => setPage(prev => Math.max(0, prev - 1))}
                  >
                    <i className="fa-solid fa-chevron-left" style={{ marginRight: '4px' }}></i> Previous
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(prev => prev + 1)}
                  >
                    Next <i className="fa-solid fa-chevron-right" style={{ marginLeft: '4px' }}></i>
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
