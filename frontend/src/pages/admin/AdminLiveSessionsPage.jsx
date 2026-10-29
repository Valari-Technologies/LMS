import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  getAdminLiveSessions,
  createLiveSession,
  updateLiveSession,
  cancelLiveSession,
  completeLiveSession,
  attachRecording,
  updateRecording,
  deleteRecording,
  generateRecordingSubtitles
} from '../../api/live';
import { listMedia, uploadMedia } from '../../api/media';
import { listAdminCourses } from '../../api/courses';
import { getCourseBatches } from '../../api/batches';
import { useNotification } from '../../context/NotificationContext';
import { subscribeSyncEvents, SYNC_EVENTS } from '../../utils/syncEvents';
import { usePermission } from '../../hooks/usePermission';
import { resolveMediaUrl } from '../../utils/mediaUtils';
import RecordingVideoPlayer from '../../components/RecordingVideoPlayer';

const getDirectMediaUrl = (asset) => {
  if (!asset) return '';
  if (asset.storagePath && (asset.storagePath.startsWith('http://') || asset.storagePath.startsWith('https://'))) {
    return asset.storagePath;
  }
  if (asset.url && (asset.url.startsWith('http://') || asset.url.startsWith('https://'))) {
    return asset.url;
  }
  return asset.storagePath || asset.url || asset.fileUrl || asset.filePath || '';
};

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&enablejsapi=1` : null;
}

function toDatetimeLocal(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getEffectiveStatus(session) {
  if (!session) return 'upcoming';
  if (session.status === 'cancelled') return 'cancelled';
  if (session.status === 'completed') return 'completed';

  const now = new Date();
  const scheduledDate = new Date(session.scheduledAt);
  const endDate = session.endTime ? new Date(session.endTime) : null;

  // 1. If scheduled start time has not arrived yet, it is always upcoming
  if (scheduledDate > now) {
    return 'upcoming';
  }

  // 2. If end time was set and has passed, it automatically becomes completed!
  if (endDate && endDate <= now) {
    return 'completed';
  }

  // 3. Start time has arrived or passed, and end time has not passed -> live
  return 'live';
}

/** Returns true if session is on today's calendar date */
function isSessionToday(session) {
  if (!session?.scheduledAt) return false;
  const d = new Date(session.scheduledAt);
  return d.toDateString() === new Date().toDateString();
}

export default function AdminLiveSessionsPage() {
  const { isReadOnly } = usePermission();
  const { toast, confirm } = useNotification();
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  // Track sessions admin manually completed today (so we respect their action even for today's sessions)
  const [manuallyCompletedIds, setManuallyCompletedIds] = useState(new Set());
  // Tick counter: forces re-render every 60s so status badges update based on current time
  const [, setTick] = useState(0);
  const tickRef = useRef(null);
  const recordingFileInputRef = useRef(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(null);
  const [showRecordingModal, setShowRecordingModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [createForm, setCreateForm] = useState({
    courseId: '',
    batchId: '',
    title: '',
    description: '',
    scheduledAt: '',
    endTime: '',
    meetingUrl: '',
  });

  const [editForm, setEditForm] = useState({
    courseId: '',
    batchId: '',
    title: '',
    description: '',
    scheduledAt: '',
    endTime: '',
    meetingUrl: '',
    status: 'upcoming'
  });

  const [createBatches, setCreateBatches] = useState([]);
  const [editBatches, setEditBatches] = useState([]);

  const [recordingForm, setRecordingForm] = useState({
    url: '',
    duration: '',
  });

  // Recording Modal states
  const [recordingTab, setRecordingTab] = useState('upload'); // 'upload' | 'library' | 'url'
  const [mediaList, setMediaList] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [generatingSubtitleId, setGeneratingSubtitleId] = useState(null);
  const [selectedMediaAsset, setSelectedMediaAsset] = useState(null);
  const [previewRecordingModal, setPreviewRecordingModal] = useState(null);
  const [manageRecordingsModal, setManageRecordingsModal] = useState(null); // session object
  const [showEditRecordingModal, setShowEditRecordingModal] = useState(null); // { session, recording }
  const [editRecordingForm, setEditRecordingForm] = useState({ url: '', duration: '', mediaAssetId: null });
  const [editRecordingTab, setEditRecordingTab] = useState('url'); // 'upload' | 'library' | 'url'

  useEffect(() => {
    listAdminCourses({ size: 100 })
      .then((data) => setCourses(data.content || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (createForm.courseId) {
      getCourseBatches(createForm.courseId)
        .then(data => setCreateBatches(data || []))
        .catch(() => setCreateBatches([]));
    } else {
      setCreateBatches([]);
    }
  }, [createForm.courseId]);

  useEffect(() => {
    if (editForm.courseId) {
      getCourseBatches(editForm.courseId)
        .then(data => setEditBatches(data || []))
        .catch(() => setEditBatches([]));
    } else {
      setEditBatches([]);
    }
  }, [editForm.courseId]);

  useEffect(() => {
    loadSessions();
  }, [status, page]);

  async function loadSessions(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const res = await getAdminLiveSessions({ status, page, size: 10 });
      setSessions(res?.content || []);
      setTotalPages(res?.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  // Auto-refresh: instant sync on events, tick every 5s, background polling every 10s
  useEffect(() => {
    // 1. Cross-tab instant sync
    const unsub = subscribeSyncEvents((event) => {
      if (event.type === SYNC_EVENTS.LIVE_SESSIONS_CHANGED) {
        loadSessions(false);
      }
    });

    // 2. Real-time tick every 5s
    tickRef.current = setInterval(() => {
      setTick(t => t + 1);
    }, 5_000);

    // 3. Background polling every 10s
    const dataRefreshInterval = setInterval(() => {
      loadSessions(false);
    }, 10_000);

    // 4. Tab focus
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        loadSessions(false);
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      unsub();
      clearInterval(tickRef.current);
      clearInterval(dataRefreshInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [status, page]);

    async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createLiveSession({
        courseId: Number(createForm.courseId),
        batchId: createForm.batchId ? Number(createForm.batchId) : null,
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        scheduledAt: new Date(createForm.scheduledAt).toISOString(),
        endTime: createForm.endTime ? new Date(createForm.endTime).toISOString() : null,
        meetingUrl: createForm.meetingUrl.trim(),
      });
      setShowCreateModal(false);
      setCreateForm({ courseId: '', batchId: '', title: '', description: '', scheduledAt: '', endTime: '', meetingUrl: '' });
      toast.success('Live session scheduled successfully!');
      loadSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule live session');
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(session) {
    setEditForm({
      courseId: session.courseId || '',
      batchId: session.batchId || '',
      title: session.title || '',
      description: session.description || '',
      scheduledAt: toDatetimeLocal(session.scheduledAt),
      endTime: toDatetimeLocal(session.endTime),
      meetingUrl: session.meetingUrl || '',
      status: getEffectiveStatus(session)
    });
    setShowEditModal(session);
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!showEditModal) return;
    setSubmitting(true);
    try {
      const scheduledDate = new Date(editForm.scheduledAt);
      const now = new Date();
      let finalStatus = editForm.status;
      if (scheduledDate > now && finalStatus === 'live') {
        finalStatus = 'upcoming';
      } else if (scheduledDate <= now && finalStatus === 'upcoming') {
        finalStatus = 'live';
      }

      await updateLiveSession(showEditModal.id, {
        courseId: editForm.courseId ? Number(editForm.courseId) : undefined,
        batchId: editForm.batchId ? Number(editForm.batchId) : null,
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        scheduledAt: scheduledDate.toISOString(),
        endTime: editForm.endTime ? new Date(editForm.endTime).toISOString() : null,
        meetingUrl: editForm.meetingUrl.trim(),
        status: finalStatus
      });
      setShowEditModal(null);
      toast.success('Live session updated successfully!');
      loadSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update live session');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete(id) {
    const confirmed = await confirm({
      title: 'Mark Session as Completed?',
      description: 'This will permanently mark the session as completed. Students will see it as done.',
      confirmText: 'Mark Completed',
      cancelText: 'Cancel',
      variant: 'warning'
    });
    if (!confirmed) return;

    try {
      await completeLiveSession(id);
      // Track this as manually completed so getEffectiveStatus respects it for today's sessions
      setManuallyCompletedIds(prev => new Set([...prev, id]));
      toast.success('Live session marked as completed.');
      loadSessions();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to complete session');
    }
  }

  async function handleCancel(id) {
    const confirmed = await confirm({
      title: 'Cancel Live Session?',
      description: 'Are you sure you want to cancel this live session? Enrolled students will see it marked as cancelled.',
      confirmText: 'Cancel Session',
      cancelText: 'Keep Session',
      variant: 'warning'
    });
    if (!confirmed) return;

    try {
      await cancelLiveSession(id);
      toast.success('Live session cancelled successfully.');
      loadSessions();
    } catch (e) {
      toast.error('Failed to cancel session');
    }
  }

  async function loadMediaLibrary(search = '') {
    setMediaLoading(true);
    try {
      const res = await listMedia({ search, page: 0, size: 50 });
      setMediaList(res?.content || []);
    } catch (e) {
      console.error(e);
    } finally {
      setMediaLoading(false);
    }
  }

  function openRecordingModal(session) {
    setShowRecordingModal(session);
    setRecordingTab('upload');
    setRecordingForm({ url: '', duration: '' });
    setSelectedMediaAsset(null);
    setMediaSearch('');
    loadMediaLibrary('');
  }

  async function handleUploadRecordingVideo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    setUploadProgress(0);
    setUploadFileName(file.name);
    try {
      const uploaded = await uploadMedia(file, (pct) => setUploadProgress(pct));
      const url = getDirectMediaUrl(uploaded);
      setRecordingForm(prev => ({ ...prev, url, mediaAssetId: uploaded.id }));
      setSelectedMediaAsset(uploaded);
      toast.success('Video uploaded to Cloudinary media library!');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload video';
      toast.error(msg);
    } finally {
      setUploadingVideo(false);
      if (recordingFileInputRef.current) recordingFileInputRef.current.value = '';
    }
  }

  function handleSelectRecordingMediaAsset(asset) {
    const url = getDirectMediaUrl(asset);
    setRecordingForm(prev => ({ ...prev, url, mediaAssetId: asset.id }));
    setSelectedMediaAsset(asset);
    setRecordingTab('url'); // switch to URL tab to show/confirm the selected URL
  }

  async function handleAttachRecording(e) {
    e.preventDefault();
    if (!showRecordingModal) return;
    const finalUrl = recordingForm.url.trim();
    if (!finalUrl) {
      toast.error('Please provide a recording URL or upload/select a video.');
      return;
    }
    setSubmitting(true);
    try {
      await attachRecording(showRecordingModal.id, {
        url: finalUrl,
        mediaAssetId: selectedMediaAsset?.id || recordingForm.mediaAssetId || null,
        duration: recordingForm.duration ? Number(recordingForm.duration) : null,
      });
      setShowRecordingModal(null);
      setRecordingForm({ url: '', duration: '', mediaAssetId: null });
      setSelectedMediaAsset(null);
      toast.success('Recording attached successfully! English subtitles are generating automatically.');
      loadSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to attach recording');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateSubtitles(sessionId, recordingId) {
    setGeneratingSubtitleId(recordingId);
    try {
      await generateRecordingSubtitles(sessionId, recordingId);
      toast.success('English subtitle generation queued! Processing now.');
      loadSessions();
      setManageRecordingsModal(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          recordings: (prev.recordings || []).map(r => r.id === recordingId ? { ...r, subtitleStatus: 'PROCESSING', subtitleProgress: 15 } : r)
        };
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to trigger subtitle generation');
    } finally {
      setGeneratingSubtitleId(null);
    }
  }

  function openEditRecordingModal(session, recording) {
    setShowEditRecordingModal({ session, recording });
    setEditRecordingForm({
      url: recording.url || recording.recordingUrl || '',
      duration: recording.duration || '',
      mediaAssetId: recording.mediaAssetId || null,
    });
    setEditRecordingTab(recording.mediaAssetId ? 'library' : 'url');
  }

  async function handleUpdateRecording(e) {
    if (e) e.preventDefault();
    if (!showEditRecordingModal?.session || !showEditRecordingModal?.recording) return;
    const finalUrl = editRecordingForm.url?.trim();
    if (!finalUrl) {
      toast.error('Please enter a recording URL or select a video.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await updateRecording(
        showEditRecordingModal.session.id,
        showEditRecordingModal.recording.id,
        {
          url: finalUrl,
          mediaAssetId: editRecordingForm.mediaAssetId || null,
          duration: editRecordingForm.duration ? Number(editRecordingForm.duration) : null,
        }
      );
      toast.success('Recording updated successfully!');
      setShowEditRecordingModal(null);
      // Update manage modal in-memory if open
      setManageRecordingsModal(prev => {
        if (!prev || prev.id !== showEditRecordingModal.session.id) return prev;
        return {
          ...prev,
          recordings: (prev.recordings || []).map(r => r.id === updated.id ? updated : r)
        };
      });
      loadSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update recording');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteRecording(session, recordingId) {
    const confirmed = await confirm({
      title: 'Delete Recording?',
      description: 'This will permanently remove this recording from the session. Students will no longer be able to watch it.',
      confirmText: 'Delete Recording',
      cancelText: 'Cancel',
      variant: 'delete'
    });
    if (!confirmed) return;
    try {
      await deleteRecording(session.id, recordingId);
      toast.success('Recording deleted.');
      // Refresh the manage modal session data
      loadSessions();
      setManageRecordingsModal(prev => {
        if (!prev || prev.id !== session.id) return null;
        const remaining = (prev.recordings || []).filter(r => r.id !== recordingId);
        if (remaining.length === 0) return null;
        return { ...prev, recordings: remaining };
      });
    } catch (err) {
      toast.error('Failed to delete recording');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Live Sessions & Classes</h1>
          <p className="page-subtitle">
            Schedule interactive live meetings and attach playback recordings.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + Schedule Live Session
        </button>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['ALL', 'UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => { setStatus(st); setPage(0); }}
                className={`btn btn-sm ${status === st ? 'btn-primary' : 'btn-secondary'}`}
              >
                {st === 'ALL' ? 'All Sessions' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Session Details</th>
                <th>Course</th>
                <th>Scheduled Time</th>
                <th>Status</th>
                <th>Meeting</th>
                <th>Recordings</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="table-empty">Loading live classes…</td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="table-empty">No live classes found.</td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const effectiveStatus = getEffectiveStatus(s);
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{s.title}</div>
                        {s.description && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                          {s.courseName || `Course #${s.courseId}`}
                        </span>
                        {s.batchName ? (
                          <div style={{ marginTop: '3px' }}>
                            <span className="badge" style={{ fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '2px 6px', borderRadius: '4px' }}>
                              <i className="fa-solid fa-users-rectangle" style={{ marginRight: '4px' }}></i>
                              {s.batchName}{s.batchCode ? ` • ${s.batchCode}` : ''}
                            </span>
                          </div>
                        ) : (
                          <div style={{ marginTop: '3px' }}>
                            <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(148, 163, 184, 0.12)', color: 'var(--text-muted)', border: '1px solid rgba(148, 163, 184, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                              All Batches
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                          {new Date(s.scheduledAt).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {s.endTime && ` - ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${effectiveStatus}`}>
                          {effectiveStatus}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                          <Link
                            to={`/admin/live-classroom/${s.id}`}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                            title="Launch embedded live classroom"
                          >
                            <i className="fa-solid fa-video"></i> Launch Classroom
                          </Link>
                          {s.meetingUrl && (
                            <a
                              href={s.meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textDecoration: 'underline' }}
                              title={s.meetingUrl}
                            >
                              Direct link ↗
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        {s.recordings && s.recordings.length > 0 ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setManageRecordingsModal(s)}
                              title={`View and manage ${s.recordings.length} recording${s.recordings.length !== 1 ? 's' : ''}`}
                            >
                              <i className="fa-solid fa-film" style={{ marginRight: '5px', color: 'var(--accent-primary)' }}></i>
                              {s.recordings.length} Recording{s.recordings.length !== 1 ? 's' : ''}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => openRecordingModal(s)}
                              title="Add another recording"
                              aria-label="Add recording"
                            >
                              <i className="fa-solid fa-plus"></i>
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openRecordingModal(s)}
                            title="Attach recording to this session"
                          >
                            <i className="fa-solid fa-plus" style={{ marginRight: '5px' }}></i> Add Recording
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditModal(s)}
                            title="Edit session details"
                          >
                            <i className="fa-solid fa-pen-to-square" style={{ marginRight: '4px' }}></i> Edit
                          </button>
                          {/* Complete button — shown for active sessions (not completed/cancelled) */}
                          {effectiveStatus !== 'completed' && effectiveStatus !== 'cancelled' && (
                            <button
                              className="btn btn-sm"
                              style={{ background: '#10b981', color: '#fff', border: 'none' }}
                              onClick={() => handleComplete(s.id)}
                              title="Mark session as completed"
                            >
                              <i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i> Complete
                            </button>
                          )}
                          {effectiveStatus !== 'cancelled' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#ef4444' }}
                              onClick={() => handleCancel(s.id)}
                              title="Cancel live session"
                            >
                              <i className="fa-solid fa-ban" style={{ marginRight: '4px' }}></i> Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Live Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Schedule Live Class
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Associated Course *</label>
                  <select
                    className="form-select"
                    required
                    value={createForm.courseId}
                    onChange={(e) => setCreateForm({ ...createForm, courseId: e.target.value, batchId: '' })}
                  >
                    <option value="">Select a Course…</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Batch (Optional)</label>
                  <select
                    className="form-select"
                    value={createForm.batchId}
                    onChange={(e) => setCreateForm({ ...createForm, batchId: e.target.value })}
                    disabled={!createForm.courseId}
                  >
                    <option value="">All Batches (Course-Wide Session)</option>
                    {createBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code}) — {b.enrolledCount}/{b.capacity} Enrolled
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Limit session access to students in this specific batch, or leave as Course-Wide.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Session Title *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Live Q&A and Architecture Walkthrough"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      className="form-control"
                      value={createForm.scheduledAt}
                      onChange={(e) => setCreateForm({ ...createForm, scheduledAt: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Date & Time (Optional)</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={createForm.endTime}
                      onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Classroom Meeting Link</label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', padding: '2px 8px' }}
                      onClick={() => {
                        const randomRoom = 'OneTutor-Course' + (createForm.courseId || 'Live') + '-' + Math.random().toString(36).substring(2, 9);
                        setCreateForm(prev => ({ ...prev, meetingUrl: `https://meet.jit.si/${randomRoom}` }));
                      }}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '4px' }}></i> Generate Jitsi Room
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Leave blank for auto-generated OneTutor Jitsi classroom, or paste link"
                    value={createForm.meetingUrl}
                    onChange={(e) => setCreateForm({ ...createForm, meetingUrl: e.target.value })}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Recommended: Uses the built-in OneTutor Jitsi Meet classroom so students stay on the platform.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Agenda</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Topics and preparation needed for this session"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Scheduling…' : 'Schedule Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Live Modal */}
      {showEditModal && (
        <div className="modal-backdrop" onClick={() => setShowEditModal(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Edit Live Class
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(null)}>✕</button>
            </div>

            <form onSubmit={handleUpdate}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Associated Course *</label>
                  <select
                    className="form-select"
                    required
                    value={editForm.courseId}
                    onChange={(e) => setEditForm({ ...editForm, courseId: e.target.value, batchId: '' })}
                  >
                    <option value="">Select a Course…</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Batch (Optional)</label>
                  <select
                    className="form-select"
                    value={editForm.batchId}
                    onChange={(e) => setEditForm({ ...editForm, batchId: e.target.value })}
                    disabled={!editForm.courseId}
                  >
                    <option value="">All Batches (Course-Wide Session)</option>
                    {editBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code}) — {b.enrolledCount}/{b.capacity} Enrolled
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Limit session access to students in this specific batch, or leave as Course-Wide.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Session Title *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Live Q&A and Architecture Walkthrough"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Start Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      className="form-control"
                      value={editForm.scheduledAt}
                      onChange={(e) => {
                        const val = e.target.value;
                        const isFuture = val && new Date(val) > new Date();
                        setEditForm(prev => ({
                          ...prev,
                          scheduledAt: val,
                          status: isFuture && prev.status === 'live' ? 'upcoming' : (!isFuture && prev.status === 'upcoming' ? 'live' : prev.status)
                        }));
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Date & Time (Optional)</label>
                    <input
                      type="datetime-local"
                      className="form-control"
                      value={editForm.endTime}
                      onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live Now</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Classroom Meeting Link</label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', padding: '2px 8px' }}
                      onClick={() => {
                        const randomRoom = 'OneTutor-Course' + (editForm.courseId || 'Live') + '-' + Math.random().toString(36).substring(2, 9);
                        setEditForm(prev => ({ ...prev, meetingUrl: `https://meet.jit.si/${randomRoom}` }));
                      }}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '4px' }}></i> Generate Jitsi Room
                    </button>
                  </div>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Leave blank for auto-generated OneTutor Jitsi classroom, or paste link"
                    value={editForm.meetingUrl}
                    onChange={(e) => setEditForm({ ...editForm, meetingUrl: e.target.value })}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Recommended: Uses the built-in OneTutor Jitsi Meet classroom so students stay on the platform.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Description / Agenda</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Topics and preparation needed for this session"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attach Recording Modal — 3-tab: Upload / Media Library / URL */}
      {showRecordingModal && (
        <div className="modal-backdrop" onClick={() => setShowRecordingModal(null)}>
          <div className="modal-dialog" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                  <i className="fa-solid fa-video" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                  Add Session Recording
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  For: <strong>{showRecordingModal.title}</strong>
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowRecordingModal(null)}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              {[{ id: 'upload', label: 'Upload Video', icon: 'fa-upload' }, { id: 'library', label: 'Media Library', icon: 'fa-folder-open' }, { id: 'url', label: 'Paste URL', icon: 'fa-link' }].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`btn btn-sm ${recordingTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, gap: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => {
                    setRecordingTab(tab.id);
                    if (tab.id === 'library') loadMediaLibrary(mediaSearch);
                  }}
                >
                  <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
                </button>
              ))}
            </div>

            {/* Upload Tab */}
            {recordingTab === 'upload' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    border: '2px dashed var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '40px 24px',
                    textAlign: 'center',
                    background: 'var(--bg-card)',
                    cursor: uploadingVideo ? 'default' : 'pointer'
                  }}
                  onClick={() => !uploadingVideo && recordingFileInputRef.current?.click()}
                >
                  <input
                    ref={recordingFileInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={handleUploadRecordingVideo}
                  />
                  {uploadingVideo ? (
                    <div style={{ color: 'var(--text-primary)', padding: '10px 0' }}>
                      <i className="fa-solid fa-cloud-arrow-up fa-bounce" style={{ fontSize: '2.5rem', marginBottom: '14px', display: 'block', color: 'var(--primary)' }}></i>
                      <div style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>
                        Uploading video to Cloudinary… {uploadProgress}%
                      </div>
                      {uploadFileName && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                          {uploadFileName}
                        </div>
                      )}
                      <div style={{ width: '100%', maxWidth: '360px', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', margin: '0 auto 12px auto', overflow: 'hidden' }}>
                        <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', transition: 'width 0.2s ease', borderRadius: '10px' }} />
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#a855f7' }}>
                        <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '6px' }}></i>
                        Subtitles will be generated automatically upon upload
                      </div>
                    </div>
                  ) : selectedMediaAsset && recordingForm.url ? (
                    <div style={{ color: '#10b981' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                        <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
                        <span>Video Ready & Uploaded!</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                        {selectedMediaAsset.filename || selectedMediaAsset.originalName || 'Uploaded file'}
                      </div>

                      {/* Immediate Video Player Preview */}
                      <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#000', maxWidth: '420px', margin: '0 auto 12px' }}>
                        <RecordingVideoPlayer
                          url={recordingForm.url}
                          title={recordingForm.title || 'Recording Upload Preview'}
                          autoPlay={false}
                          style={{ width: '100%', maxHeight: '220px' }}
                        />
                      </div>

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem' }}>
                        <i className="fa-solid fa-closed-captioning"></i>
                        <span>Auto English Subtitles: <strong>Enabled on Save</strong></span>
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => { e.stopPropagation(); setSelectedMediaAsset(null); setRecordingForm(f => ({ ...f, url: '', mediaAssetId: null })); }}
                        >
                          Replace Video
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '2.5rem', marginBottom: '12px', display: 'block', color: 'var(--primary)' }}></i>
                      <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>Click to upload session recording</div>
                      <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>MP4, WebM, MOV · Uploads directly to Cloudinary Media Library</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--accent-primary)', marginTop: '6px' }}>
                        <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '4px' }}></i>
                        Automatic English subtitles will be generated
                      </div>
                    </div>
                  )}
                </div>

                {recordingForm.url && (
                  <div className="form-group">
                    <label className="form-label">Duration (seconds, optional)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g. 3600 for 1 hour"
                      value={recordingForm.duration}
                      onChange={(e) => setRecordingForm({ ...recordingForm, duration: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Library Tab */}
            {recordingTab === 'library' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  className="form-control"
                  placeholder="Search media library…"
                  value={mediaSearch}
                  onChange={(e) => { setMediaSearch(e.target.value); loadMediaLibrary(e.target.value); }}
                />

                {mediaLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Loading media library…
                  </div>
                ) : mediaList.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                    No media assets found. Upload a video first.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                    {mediaList
                      .filter(a => !a.mimeType || a.mimeType.startsWith('video/'))
                      .map((asset) => {
                        const assetUrl = asset.fileUrl || asset.filePath || asset.url || '';
                        const isSelected = recordingForm.url === assetUrl;
                        return (
                          <div
                            key={asset.id}
                            onClick={() => handleSelectRecordingMediaAsset(asset)}
                            style={{
                              padding: '12px',
                              borderRadius: 'var(--radius-md)',
                              border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                              background: isSelected ? 'rgba(var(--primary-rgb, 99,102,241), 0.08)' : 'var(--bg-card)',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: '8px', color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                              <i className={`fa-solid ${isSelected ? 'fa-circle-check' : 'fa-film'}`}></i>
                            </div>
                            <div style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                              {asset.filename || asset.originalName || asset.fileName || 'Video'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2px' }}>
                              {asset.mimeType || 'video'}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {recordingForm.url && selectedMediaAsset && (
                  <div style={{ padding: '10px 14px', background: '#E8EBFA', border: '1px solid #E8E8E8', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-circle-check"></i>
                    <span>Selected: <strong>{selectedMediaAsset.filename || selectedMediaAsset.originalName}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* URL Tab */}
            {recordingTab === 'url' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {selectedMediaAsset && recordingForm.url && (
                  <div style={{ padding: '10px 14px', background: '#E8EBFA', border: '1px solid #E8E8E8', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-circle-check"></i>
                    <span>Using media library file: <strong>{selectedMediaAsset.filename || selectedMediaAsset.originalName}</strong></span>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Recording Video URL *</label>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="https://www.youtube.com/watch?v=... or https://cdn.example.com/recording.mp4"
                    value={recordingForm.url}
                    onChange={(e) => { setRecordingForm({ ...recordingForm, url: e.target.value }); setSelectedMediaAsset(null); }}
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Supports YouTube links, direct video URLs, or media library paths.
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (seconds, optional)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 3600 for 1 hour"
                    value={recordingForm.duration}
                    onChange={(e) => setRecordingForm({ ...recordingForm, duration: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {recordingForm.url ? (
                  <span style={{ color: '#10b981' }}><i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i> Recording URL ready to save</span>
                ) : (
                  <span>Upload, select from library, or paste a URL to continue</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRecordingModal(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submitting || !recordingForm.url || uploadingVideo}
                  onClick={handleAttachRecording}
                >
                  {submitting ? 'Saving…' : 'Save Recording'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Recordings Modal */}
      {manageRecordingsModal && (
        <div className="modal-backdrop" onClick={() => setManageRecordingsModal(null)}>
          <div className="modal-dialog" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                  <i className="fa-solid fa-box-archive" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                  Recorded Session Archives
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  {manageRecordingsModal.title}
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setManageRecordingsModal(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '440px', overflowY: 'auto' }}>
              {(manageRecordingsModal.recordings || []).map((r, idx) => {
                const recUrl = resolveMediaUrl(r.url || r.recordingUrl || '');
                const ytEmbed = getYouTubeEmbedUrl(recUrl);
                return (
                  <div
                    key={r.id || idx}
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      background: 'var(--bg-card)'
                    }}
                  >
                    {/* Video preview */}
                    <div style={{ background: '#000', position: 'relative' }}>
                      {ytEmbed ? (
                        <iframe
                          title={`Recording ${idx + 1}`}
                          src={ytEmbed.replace('autoplay=1', 'autoplay=0')}
                          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{ width: '100%', height: '200px', border: 'none', display: 'block' }}
                        />
                      ) : (
                        <RecordingVideoPlayer
                          url={recUrl}
                          title={`Recording ${idx + 1}`}
                          subtitleUrl={r.subtitleUrl}
                          autoPlay={false}
                          style={{ width: '100%', maxHeight: '260px' }}
                        />
                      )}
                    </div>
                    {/* Info row */}
                    <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          Recording {idx + 1} {manageRecordingsModal.recordings.length > 1 ? `of ${manageRecordingsModal.recordings.length}` : ''}
                        </div>
                        {r.duration && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i>
                            {Math.floor(r.duration / 3600) > 0 ? `${Math.floor(r.duration / 3600)}h ` : ''}{Math.round((r.duration % 3600) / 60)} min
                          </div>
                        )}
                        {/* Subtitles Status Badge & Actions */}
                        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {r.subtitleStatus === 'COMPLETED' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>
                              <i className="fa-solid fa-closed-captioning"></i> Subtitles Ready (EN)
                            </span>
                          ) : r.subtitleStatus === 'PROCESSING' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>
                              <i className="fa-solid fa-spinner fa-spin"></i> Generating Subtitles ({r.subtitleProgress || 0}%)
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600 }}>
                              <i className="fa-solid fa-closed-captioning"></i> Subtitles Pending
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 6px', fontSize: '0.72rem', color: 'var(--accent-primary)' }}
                            disabled={generatingSubtitleId === r.id || r.subtitleStatus === 'PROCESSING'}
                            onClick={() => handleGenerateSubtitles(manageRecordingsModal.id, r.id)}
                            title="Generate or re-generate English subtitles"
                          >
                            <i className="fa-solid fa-wand-magic-sparkles" style={{ marginRight: '3px' }}></i>
                            {generatingSubtitleId === r.id ? 'Queueing…' : r.subtitleUrl ? 'Regenerate' : 'Generate Subtitles'}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setPreviewRecordingModal({ ...r, url: recUrl, sessionTitle: manageRecordingsModal.title, courseName: manageRecordingsModal.courseName })}
                          title="Full Screen Preview"
                        >
                          <i className="fa-solid fa-expand" style={{ marginRight: '4px' }}></i> Preview
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditRecordingModal(manageRecordingsModal, r)}
                          title="Edit recording details"
                        >
                          <i className="fa-solid fa-pen-to-square" style={{ marginRight: '4px' }}></i> Edit
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#ef4444' }}
                          onClick={() => handleDeleteRecording(manageRecordingsModal, r.id)}
                          title="Delete this recording"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setManageRecordingsModal(null); openRecordingModal(manageRecordingsModal); }}
              >
                <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i> Add Another Recording
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setManageRecordingsModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recording Modal (CRUD Update) */}
      {showEditRecordingModal && (
        <div className="modal-backdrop" onClick={() => setShowEditRecordingModal(null)}>
          <div className="modal-dialog" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                  <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--accent-primary)', marginRight: '8px' }}></i>
                  Edit Session Recording
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  For: <strong>{showEditRecordingModal.session.title}</strong>
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEditRecordingModal(null)}>✕</button>
            </div>

            <form onSubmit={handleUpdateRecording}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${editRecordingTab === 'url' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, gap: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setEditRecordingTab('url')}
                  >
                    <i className="fa-solid fa-link"></i> Direct URL / YouTube
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${editRecordingTab === 'library' ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ flex: 1, gap: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => {
                      setEditRecordingTab('library');
                      loadMediaLibrary('');
                    }}
                  >
                    <i className="fa-solid fa-folder-open"></i> Media Library
                  </button>
                </div>

                {editRecordingTab === 'url' ? (
                  <div className="form-group">
                    <label className="form-label">Recording Video URL *</label>
                    <input
                      type="url"
                      required
                      className="form-control"
                      placeholder="https://www.youtube.com/watch?v=... or direct MP4/video link"
                      value={editRecordingForm.url}
                      onChange={(e) => setEditRecordingForm(prev => ({ ...prev, url: e.target.value, mediaAssetId: null }))}
                    />
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Supports YouTube links, external video files, or media storage paths.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                      {mediaList
                        .filter(a => !a.mimeType || a.mimeType.startsWith('video/'))
                        .map((asset) => {
                          const assetUrl = asset.fileUrl || asset.filePath || asset.url || '';
                          const isSelected = editRecordingForm.url === assetUrl;
                          return (
                            <div
                              key={asset.id}
                              onClick={() => setEditRecordingForm(prev => ({ ...prev, url: assetUrl, mediaAssetId: asset.id }))}
                              style={{
                                padding: '10px',
                                borderRadius: 'var(--radius-md)',
                                border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                                background: isSelected ? 'rgba(79, 70, 229, 0.08)' : 'var(--bg-card)',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.15s'
                              }}
                            >
                              <div style={{ fontSize: '1.4rem', color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)', marginBottom: '4px' }}>
                                <i className={`fa-solid ${isSelected ? 'fa-circle-check' : 'fa-film'}`}></i>
                              </div>
                              <div style={{ fontWeight: 600, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {asset.filename || asset.originalName || 'Video file'}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    {editRecordingForm.url && (
                      <div style={{ padding: '8px 12px', background: '#E8EBFA', border: '1px solid #E8E8E8', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#166534' }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i> Selected: {editRecordingForm.url}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Duration (seconds, optional)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 3600 for 1 hour"
                    value={editRecordingForm.duration}
                    onChange={(e) => setEditRecordingForm(prev => ({ ...prev, duration: e.target.value }))}
                  />
                  {editRecordingForm.duration > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Formatted: {Math.floor(editRecordingForm.duration / 3600) > 0 ? `${Math.floor(editRecordingForm.duration / 3600)}h ` : ''}{Math.round((editRecordingForm.duration % 3600) / 60)} min
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditRecordingModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !editRecordingForm.url}>
                  {submitting ? 'Saving…' : 'Update Recording'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full-Screen Recording Preview Player */}
      {previewRecordingModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setPreviewRecordingModal(null)}
        >
          <div
            style={{
              background: '#1c1d1f',
              width: '100%',
              maxWidth: '900px',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #3e4143', color: '#fff' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '1rem' }}>
                  <i className="fa-solid fa-circle-play" style={{ color: '#ef4444', marginRight: '8px' }}></i>
                  {previewRecordingModal.sessionTitle}
                </div>
                {previewRecordingModal.courseName && (
                  <div style={{ fontSize: '0.8rem', color: '#9da3a7', marginTop: '2px' }}>{previewRecordingModal.courseName}</div>
                )}
              </div>
              <button
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.3rem', cursor: 'pointer' }}
                onClick={() => setPreviewRecordingModal(null)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div style={{ background: '#000' }}>
              <RecordingVideoPlayer
                url={previewRecordingModal.url}
                title={previewRecordingModal.sessionTitle}
                courseName={previewRecordingModal.courseName}
                subtitleUrl={previewRecordingModal.subtitleUrl}
                autoPlay={true}
                onClose={() => setPreviewRecordingModal(null)}
              />
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', background: '#1c1d1f' }}>
              <button className="btn btn-secondary" style={{ color: '#fff', borderColor: '#6a6f73' }} onClick={() => setPreviewRecordingModal(null)}>
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
