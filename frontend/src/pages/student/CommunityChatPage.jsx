import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  getCommunityMessages,
  pollCommunityMessages,
  sendCommunityMessage,
  editCommunityMessage,
  deleteCommunityMessage,
  markCommunityRead,
  uploadCommunityMedia,
  getMyCommunityStatus,
} from '../../api/community';
import { getCourse } from '../../api/courses';

const BACKEND = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:8080';
const POLL_INTERVAL_MS = 4000;
const MAX_FILE_MB = 50;

function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BACKEND}${url}`;
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function isSameDay(iso1, iso2) {
  if (!iso1 || !iso2) return false;
  return new Date(iso1).toDateString() === new Date(iso2).toDateString();
}

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function getFileIcon(type, mime) {
  if (type === 'pdf' || mime?.includes('pdf')) return 'fa-file-pdf';
  if (type === 'video' || mime?.startsWith('video/')) return 'fa-file-video';
  if (type === 'image' || mime?.startsWith('image/')) return 'fa-file-image';
  return 'fa-file';
}

// ─── Message Bubble ─────────────────────────────────────────────────────────
function MessageBubble({ msg, currentUser, onDelete, onEdit }) {
  const isOwn   = msg.senderId === currentUser?.id;
  const isAdmin = msg.senderRole === 'admin' || msg.senderRole === 'super_admin' || msg.senderRole === 'superadmin';
  const isDeleted = msg.deleted;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef  = useRef(null);
  const canDelete = !isDeleted && (isOwn || currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.role === 'superadmin');
  const isEditable = !isDeleted && isOwn && (Date.now() - new Date(msg.createdAt).getTime()) <= 10 * 60 * 1000;

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <div className={`cc-bubble-row ${isOwn ? 'cc-own' : 'cc-other'}`}>
      {/* Avatar — only for others */}
      {!isOwn && (
        <div className={`cc-avatar ${isAdmin ? 'cc-avatar-admin' : ''}`}>
          {msg.senderAvatar
            ? <img src={resolveMediaUrl(msg.senderAvatar)} alt="" />
            : getInitials(msg.senderName)}
        </div>
      )}

      <div className="cc-bubble-wrap">
        {!isOwn && (
          <div className={`cc-sender-name ${isAdmin ? 'cc-admin-name' : ''}`}>
            {msg.senderName}{isAdmin && ' ⭐'}
          </div>
        )}

        <div
          className={`cc-bubble ${isOwn ? 'cc-bubble-own' : 'cc-bubble-other'} ${msg.messageType !== 'text' && !isDeleted ? 'cc-bubble-media' : ''}`}
          onContextMenu={(canDelete || isEditable) ? (e) => { e.preventDefault(); setMenuOpen(true); } : undefined}
          onLongPress={(canDelete || isEditable) ? () => setMenuOpen(true) : undefined}
        >
          {isDeleted ? (
            <p className="cc-bubble-text" style={{ fontStyle: 'italic', opacity: 0.8, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-ban" /> {msg.content || 'This message was deleted'}
            </p>
          ) : (
            <>
              {msg.content && (
                <p className="cc-bubble-text">{msg.content}</p>
              )}

              {msg.messageType === 'image' && msg.mediaUrl && (
                <a href={resolveMediaUrl(msg.mediaUrl)} target="_blank" rel="noreferrer">
                  <img src={resolveMediaUrl(msg.mediaUrl)} alt={msg.mediaName || 'Image'} className="cc-img-attach" />
                </a>
              )}

              {msg.messageType === 'video' && msg.mediaUrl && (
                <video src={resolveMediaUrl(msg.mediaUrl)} controls className="cc-video-attach" />
              )}

              {(msg.messageType === 'pdf' || msg.messageType === 'file') && msg.mediaUrl && (
                <a href={resolveMediaUrl(msg.mediaUrl)} target="_blank" rel="noreferrer"
                   className={`cc-file-attach ${isOwn ? 'cc-file-own' : 'cc-file-other'}`}>
                  <i className={`fa-solid ${getFileIcon(msg.messageType, msg.mediaMimeType)} cc-file-icon`} />
                  <div className="cc-file-meta">
                    <div className="cc-file-name">{msg.mediaName || 'File'}</div>
                    {msg.mediaSize > 0 && (
                      <div className="cc-file-size">{(msg.mediaSize / 1024 / 1024).toFixed(1)} MB</div>
                    )}
                  </div>
                  <i className="fa-solid fa-arrow-down-to-line cc-file-dl" />
                </a>
              )}
            </>
          )}
        </div>

        <div className={`cc-time ${isOwn ? 'cc-time-own' : ''}`}>
          {formatTime(msg.createdAt)}
          {msg.edited && !isDeleted && <span style={{ marginLeft: '4px', fontStyle: 'italic', opacity: 0.85 }}>· Edited</span>}
        </div>

        {(canDelete || isEditable) && menuOpen && (
          <div ref={menuRef} className={`cc-context-menu ${isOwn ? 'cc-menu-own' : ''}`}>
            {isEditable && (
              <button
                onClick={() => { setMenuOpen(false); onEdit(msg); }}
                className="cc-menu-btn"
                style={{ color: 'var(--text-primary)' }}
              >
                <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--accent-primary)' }} /> Edit
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => { setMenuOpen(false); onDelete(msg.id); }}
                className="cc-menu-btn"
              >
                <i className="fa-solid fa-trash-can" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upload Preview ──────────────────────────────────────────────────────────
function UploadPreview({ file, onRemove }) {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const url = URL.createObjectURL(file);

  return (
    <div className="cc-upload-preview">
      {isImage && <img src={url} alt="" className="cc-preview-thumb" />}
      {isVideo && <video src={url} className="cc-preview-thumb" />}
      {!isImage && !isVideo && (
        <div className="cc-preview-icon">
          <i className="fa-solid fa-file-pdf" />
        </div>
      )}
      <div className="cc-preview-meta">
        <div className="cc-preview-name">{file.name}</div>
        <div className="cc-preview-size">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
      </div>
      <button onClick={onRemove} className="cc-preview-remove">
        <i className="fa-solid fa-xmark" />
      </button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CommunityChatPage() {
  const { courseId } = useParams();
  const { user }     = useAuth();
  const navigate     = useNavigate();

  const [course,       setCourse]       = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [errorStatus,  setErrorStatus]  = useState(null);
  const [text,         setText]         = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingMsg,   setEditingMsg]   = useState(null);
  const [uploading,    setUploading]    = useState(false);
  const [isUserDisabled, setIsUserDisabled] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deletingMsg,    setDeletingMsg]    = useState(false);

  const messagesEndRef   = useRef(null);
  const messagesContainerRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const fileInputRef     = useRef(null);
  const textareaRef      = useRef(null);
  const pollTimerRef     = useRef(null);
  const lastMsgIdRef     = useRef(0);
  const pollErrorRef     = useRef(0);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    isInitialLoadRef.current = true;
    async function init() {
      const [courseResult, msgResult, statusResult] = await Promise.allSettled([
        getCourse(courseId),
        getCommunityMessages(courseId, { page: 0, size: 50 }),
        getMyCommunityStatus(courseId),
      ]);
      if (!mounted) return;

      if (courseResult.status === 'fulfilled') setCourse(courseResult.value);
      if (statusResult.status === 'fulfilled') setIsUserDisabled(!!statusResult.value);

      if (msgResult.status === 'fulfilled') {
        const msgs = msgResult.value?.content || [];
        setMessages(msgs);
        if (msgs.length > 0) lastMsgIdRef.current = msgs[msgs.length - 1].id;
        markCommunityRead(courseId).catch(() => {});
        window.dispatchEvent(new CustomEvent('community-read', { detail: { courseId } }));
      } else {
        const status = msgResult.reason?.response?.status;
        const msg    = msgResult.reason?.response?.data?.error?.message || 'Could not load community chat.';
        setErrorStatus(status || 0);
        setError(msg);
      }
      setLoading(false);
    }
    init();
    return () => { mounted = false; };
  }, [courseId]);

  // ── Polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || error) return;
    pollErrorRef.current = 0;

    async function poll() {
      try {
        const newMsgs = await pollCommunityMessages(courseId, lastMsgIdRef.current);
        pollErrorRef.current = 0;
        if (newMsgs?.length > 0) {
          setMessages(prev => {
            const ids   = new Set(prev.map(m => m.id));
            const fresh = newMsgs.filter(m => !ids.has(m.id));
            if (!fresh.length) return prev;
            lastMsgIdRef.current = fresh[fresh.length - 1].id;
            return [...prev, ...fresh];
          });
        }
      } catch {
        if (++pollErrorRef.current >= 5) clearInterval(pollTimerRef.current);
      }
    }

    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimerRef.current);
  }, [courseId, loading, error]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  const scrollToBottom = (instant = false) => {
    const el = messagesContainerRef.current;
    if (el) {
      if (instant) {
        el.scrollTop = el.scrollHeight;
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
    }
  };

  useLayoutEffect(() => {
    if (!loading && messages.length > 0 && isInitialLoadRef.current) {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      if (isInitialLoadRef.current) {
        scrollToBottom(true);
        const rafId = requestAnimationFrame(() => scrollToBottom(true));
        const t1 = setTimeout(() => scrollToBottom(true), 50);
        const t2 = setTimeout(() => scrollToBottom(true), 150);
        isInitialLoadRef.current = false;
        return () => {
          cancelAnimationFrame(rafId);
          clearTimeout(t1);
          clearTimeout(t2);
        };
      } else {
        const el = messagesContainerRef.current;
        const isNearBottom = !el || (el.scrollHeight - el.scrollTop - el.clientHeight < 160);
        if (isNearBottom) {
          scrollToBottom(false);
        }
      }
    }
  }, [messages, loading]);

  function startEdit(msg) {
    setEditingMsg(msg);
    setText(msg.content || '');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }

  function cancelEdit() {
    setEditingMsg(null);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend(e) {
    e?.preventDefault();
    const hasText = text.trim().length > 0;
    const hasFile = !editingMsg && !!selectedFile;
    if (!hasText && !hasFile) return;
    if (sending || uploading) return;

    // Handle Edit
    if (editingMsg) {
      setSending(true);
      try {
        const updated = await editCommunityMessage(courseId, editingMsg.id, text.trim());
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        cancelEdit();
      } catch (err) {
        alert(err?.response?.data?.error?.message || 'Failed to edit message');
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      let mediaAssetId = null;
      let messageType  = 'text';

      if (hasFile) {
        setUploading(true);
        const asset = await uploadCommunityMedia(selectedFile, setUploadPct);
        mediaAssetId = asset.id;
        messageType  = asset.fileType || 'file';
        setUploading(false);
        setUploadPct(0);
        setSelectedFile(null);
      }

      const newMsg = await sendCommunityMessage(courseId, {
        content: hasText ? text.trim() : null,
        messageType,
        mediaAssetId,
      });

      setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
      lastMsgIdRef.current = Math.max(lastMsgIdRef.current, newMsg.id);
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      window.dispatchEvent(new CustomEvent('community-new-message', { detail: { courseId } }));
    } catch (err) {
      alert(err?.response?.data?.error?.message || 'Failed to send message');
    } finally {
      setSending(false);
      setUploading(false);
    }
  }

  function handleDelete(messageId) {
    setDeleteTargetId(messageId);
  }

  async function confirmDelete() {
    if (!deleteTargetId || deletingMsg) return;
    setDeletingMsg(true);
    try {
      await deleteCommunityMessage(courseId, deleteTargetId);
      setMessages(prev => prev.map(m => m.id === deleteTargetId ? { ...m, deleted: true, content: 'This message was deleted', mediaUrl: null, mediaName: null, mediaMimeType: null, messageType: 'text' } : m));
    } catch {
      alert('Could not delete message');
    } finally {
      setDeletingMsg(false);
      setDeleteTargetId(null);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      alert(`File must be smaller than ${MAX_FILE_MB} MB`);
      return;
    }
    setSelectedFile(file);
    e.target.value = '';
  }

  function handleKeyDown(e) {
    // Desktop only: Enter sends, Shift+Enter newline
    // On mobile (touch) we never intercept Enter
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 640) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoResize(e) {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="cc-center-state">
        <i className="fa-solid fa-spinner fa-spin cc-spinner" />
      </div>
    );
  }

  if (error) {
    const isForbidden = errorStatus === 403;
    const icon  = isForbidden ? 'fa-lock' : 'fa-plug-circle-exclamation';
    const title = isForbidden ? 'Access Denied' : 'Service Unavailable';
    const hint  = isForbidden
      ? error
      : 'The community service is not reachable right now. Please try again.';
    return (
      <div className="cc-center-state">
        <div className={`cc-error-icon ${isForbidden ? 'cc-error-icon-danger' : 'cc-error-icon-warn'}`}>
          <i className={`fa-solid ${icon}`} />
        </div>
        <h2 className="cc-error-title">{title}</h2>
        <p className="cc-error-hint">{hint}</p>
        <div className="cc-error-btns">
          {!isForbidden && (
            <button onClick={() => window.location.reload()} className="cc-btn-primary">
              <i className="fa-solid fa-rotate-right" /> Retry
            </button>
          )}
          <button onClick={() => navigate(-1)} className="cc-btn-ghost">Go Back</button>
        </div>
      </div>
    );
  }

  const groupedMessages = messages.reduce((acc, msg, idx) => {
    const prev = messages[idx - 1];
    if (!prev || !isSameDay(prev.createdAt, msg.createdAt)) {
      acc.push({ type: 'separator', date: msg.createdAt });
    }
    acc.push({ type: 'message', msg });
    return acc;
  }, []);

  const canSend = !sending && !uploading && (text.trim().length > 0 || !!selectedFile);

  return (
    <>
      <style>{`
        /* ── Outer shell — fills available page area ── */
        .cc-shell {
          display: flex;
          flex-direction: column;
          /* 100dvh minus the student layout header (≈64px on mobile, 72px on desktop) */
          height: calc(100dvh - 64px);
          max-height: calc(100dvh - 64px);
          overflow: hidden;
          background: var(--bg-page);
          position: relative;
        }
        @media (min-width: 768px) {
          .cc-shell { height: calc(100dvh - 72px); max-height: calc(100dvh - 72px); }
        }

        /* ── Header ── */
        .cc-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-default);
          box-shadow: var(--shadow-sm);
          flex-shrink: 0;
          min-height: 58px;
        }
        @media (min-width: 640px) {
          .cc-header { padding: 14px 20px; gap: 14px; }
        }
        .cc-header-back {
          background: none; border: none; cursor: pointer;
          color: var(--text-secondary); font-size: 17px;
          padding: 6px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background var(--transition-fast);
          -webkit-tap-highlight-color: transparent;
        }
        .cc-header-back:hover { background: var(--accent-subtle); color: var(--accent-primary); }
        .cc-header-thumb {
          width: 38px; height: 38px; border-radius: 10px;
          object-fit: cover; flex-shrink: 0;
        }
        .cc-header-thumb-fallback {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          background: var(--accent-gradient);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 17px;
        }
        @media (min-width: 640px) {
          .cc-header-thumb, .cc-header-thumb-fallback { width: 42px; height: 42px; }
        }
        .cc-header-info { flex: 1; min-width: 0; }
        .cc-header-title {
          margin: 0; font-size: 14px; font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        @media (min-width: 640px) { .cc-header-title { font-size: 16px; } }
        .cc-header-sub {
          margin: 0; font-size: 11px; color: var(--text-muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cc-live-badge {
          display: flex; align-items: center; gap: 5px; flex-shrink: 0;
          margin-left: auto;
        }
        .cc-live-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #22c55e; box-shadow: 0 0 7px rgba(34,197,94,0.7);
          animation: cc-pulse 2s infinite;
        }
        .cc-live-label { font-size: 11px; color: var(--text-muted); }
        @keyframes cc-pulse {
          0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
        }

        /* ── Messages area ── */
        .cc-messages {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          -webkit-overflow-scrolling: touch;
        }
        @media (min-width: 640px) { .cc-messages { padding: 20px 16px; } }

        /* ── Empty state ── */
        .cc-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; gap: 14px; padding: 32px 16px;
        }
        .cc-empty-icon {
          width: 70px; height: 70px; border-radius: 50%;
          background: var(--accent-subtle);
          display: flex; align-items: center; justify-content: center;
          font-size: 30px; color: var(--accent-primary);
        }
        .cc-empty h3 { margin: 0; color: var(--text-primary); font-size: 17px; }
        .cc-empty p  { margin: 0; color: var(--text-secondary); font-size: 13px; max-width: 260px; line-height: 1.5; }

        /* ── Date separator ── */
        .cc-separator {
          display: flex; align-items: center; gap: 10px;
          margin: 14px 0 6px;
        }
        .cc-sep-line { flex: 1; height: 1px; background: var(--border-default); }
        .cc-sep-label {
          font-size: 11px; font-weight: 600; color: var(--text-muted);
          background: var(--bg-elevated); padding: 2px 10px;
          border-radius: 20px; border: 1px solid var(--border-default);
          white-space: nowrap;
        }

        /* ── Bubble row ── */
        .cc-bubble-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          margin-bottom: 3px;
        }
        .cc-own   { flex-direction: row-reverse; }
        .cc-other { flex-direction: row; }

        /* ── Avatar ── */
        .cc-avatar {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #5A70D3 0%, #4355B9 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff; overflow: hidden;
          align-self: flex-end;
        }
        .cc-avatar-admin { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .cc-avatar img { width: 100%; height: 100%; object-fit: cover; }
        @media (min-width: 640px) { .cc-avatar { width: 34px; height: 34px; } }

        /* ── Bubble wrapper ── */
        .cc-bubble-wrap { max-width: 80%; position: relative; }
        @media (min-width: 640px) { .cc-bubble-wrap { max-width: 68%; } }
        @media (min-width: 1024px) { .cc-bubble-wrap { max-width: 60%; } }

        .cc-sender-name {
          font-size: 11px; font-weight: 600; color: var(--text-secondary);
          margin-bottom: 3px; padding-left: 2px;
        }
        .cc-admin-name { color: #f59e0b; }

        /* ── Bubble box ── */
        .cc-bubble {
          padding: 9px 13px;
          border-radius: 18px 18px 18px 4px;
          box-shadow: var(--shadow-sm);
          word-break: break-word;
          position: relative;
        }
        .cc-bubble-own {
          background: linear-gradient(135deg, #5A70D3 0%, #4355B9 100%);
          color: #fff;
          border-radius: 18px 18px 4px 18px;
          box-shadow: 0 2px 8px rgba(90, 112, 211, 0.22);
          border: none;
        }
        .cc-bubble-other {
          background: var(--bg-elevated);
          color: var(--text-primary);
          border: 1px solid var(--border-default);
        }
        .cc-bubble-media { padding: 7px; }
        .cc-bubble-text  { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }

        /* ── Media attachments ── */
        .cc-img-attach {
          display: block; border-radius: 10px;
          max-width: 100%; width: auto;
          max-height: 200px; object-fit: cover;
        }
        @media (min-width: 640px) { .cc-img-attach { max-width: 260px; } }

        .cc-video-attach {
          display: block; border-radius: 10px;
          max-width: 100%; width: 100%;
        }
        @media (min-width: 640px) { .cc-video-attach { max-width: 280px; } }

        .cc-file-attach {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none; padding: 6px 4px; border-radius: 8px;
        }
        .cc-file-own   { color: #fff; }
        .cc-file-other { color: var(--text-primary); }
        .cc-file-icon  { font-size: 24px; opacity: 0.85; flex-shrink: 0; }
        .cc-file-meta  { flex: 1; min-width: 0; }
        .cc-file-name  { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
        .cc-file-size  { font-size: 11px; opacity: 0.7; }
        .cc-file-dl    { font-size: 12px; flex-shrink: 0; }

        /* ── Timestamp ── */
        .cc-time {
          font-size: 10px; color: var(--text-muted);
          margin-top: 3px; padding-left: 2px;
          text-align: left;
        }
        .cc-time-own { text-align: right; padding-left: 0; padding-right: 2px; }

        /* ── Context menu ── */
        .cc-context-menu {
          position: absolute; top: 100%; left: 0; z-index: 60;
          background: var(--bg-elevated); border: 1px solid var(--border-default);
          border-radius: 10px; box-shadow: var(--shadow-lg);
          padding: 4px; min-width: 120px;
        }
        .cc-menu-own { left: auto; right: 0; }
        .cc-menu-btn {
          width: 100%; display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; background: none; border: none; cursor: pointer;
          color: #ef4444; font-size: 13px; border-radius: 6px; font-family: inherit;
          transition: background var(--transition-fast);
        }
        .cc-menu-btn:hover { background: var(--danger-bg); }

        /* ── Upload preview strip ── */
        .cc-upload-preview {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; margin: 0 12px 6px;
          background: var(--bg-elevated); border: 1px solid var(--border-default);
          border-radius: 10px;
        }
        .cc-preview-thumb {
          width: 44px; height: 44px; border-radius: 8px; object-fit: cover; flex-shrink: 0;
        }
        .cc-preview-icon {
          width: 44px; height: 44px; border-radius: 8px; flex-shrink: 0;
          background: var(--accent-subtle); color: var(--accent-primary);
          display: flex; align-items: center; justify-content: center; font-size: 22px;
        }
        .cc-preview-meta { flex: 1; min-width: 0; }
        .cc-preview-name { font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cc-preview-size { font-size: 11px; color: var(--text-muted); }
        .cc-preview-remove {
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); font-size: 16px; padding: 4px;
          -webkit-tap-highlight-color: transparent;
        }

        /* ── Upload progress ── */
        .cc-progress-wrap {
          padding: 0 12px 6px;
        }
        .cc-progress-box {
          background: var(--bg-elevated); border: 1px solid var(--border-default);
          border-radius: 8px; padding: 8px 12px;
        }
        .cc-progress-row {
          display: flex; justify-content: space-between;
          font-size: 12px; color: var(--text-secondary); margin-bottom: 5px;
        }
        .cc-progress-track {
          height: 4px; border-radius: 4px; background: var(--border-default); overflow: hidden;
        }
        .cc-progress-fill {
          height: 100%; border-radius: 4px;
          background: var(--accent-gradient); transition: width 0.2s ease;
        }

        /* ── Input bar ── */
        .cc-inputbar {
          padding: 10px 12px;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-default);
          flex-shrink: 0;
          /* Extra bottom padding on mobile for safe area (iPhone notch etc.) */
          padding-bottom: max(10px, env(safe-area-inset-bottom, 10px));
        }
        .cc-input-row {
          display: flex; gap: 8px; align-items: flex-end;
        }
        .cc-attach-btn {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          border: 1px solid var(--border-default); background: var(--bg-elevated);
          color: var(--text-secondary); font-size: 15px;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: all var(--transition-fast);
          -webkit-tap-highlight-color: transparent;
        }
        .cc-attach-btn:hover, .cc-attach-btn:focus { color: var(--accent-primary); border-color: var(--accent-primary); }
        .cc-textarea {
          flex: 1; padding: 9px 13px; font-size: 14px; resize: none;
          line-height: 1.5; background: var(--bg-input); color: var(--text-primary);
          border: 1px solid var(--border-default); border-radius: 22px; outline: none;
          font-family: inherit; max-height: 120px; overflow-y: auto;
          transition: border-color var(--transition-fast);
        }
        .cc-textarea:focus { border-color: var(--border-focus); }
        .cc-send-btn {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          border: none; color: #fff; font-size: 15px;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: all var(--transition-fast);
          -webkit-tap-highlight-color: transparent;
        }
        .cc-send-active  { background: var(--accent-gradient); }
        .cc-send-inactive { background: var(--border-default); cursor: not-allowed; }
        .cc-input-hint {
          margin: 5px 0 0 50px; font-size: 10px; color: var(--text-muted);
        }
        /* Hide hint on mobile (no keyboard shortcuts) */
        @media (max-width: 639px) { .cc-input-hint { display: none; } }

        /* ── Center states (loading / error) ── */
        .cc-center-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 16px; text-align: center;
          padding: 32px 24px; min-height: 50vh;
        }
        .cc-spinner { font-size: 28px; color: var(--accent-primary); }
        .cc-error-icon {
          width: 64px; height: 64px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; font-size: 26px;
        }
        .cc-error-icon-danger { background: var(--danger-bg); color: #ef4444; }
        .cc-error-icon-warn   { background: var(--warning-bg); color: #d97706; }
        .cc-error-title { color: var(--text-primary); margin: 0; font-size: 20px; }
        .cc-error-hint  { color: var(--text-secondary); margin: 0; font-size: 14px; max-width: 300px; line-height: 1.5; }
        .cc-error-btns  { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .cc-btn-primary {
          padding: 10px 20px; background: var(--accent-gradient); color: #fff;
          border: none; border-radius: 10px; cursor: pointer; font-weight: 600;
          font-size: 14px; display: flex; align-items: center; gap: 6px;
        }
        .cc-btn-ghost {
          padding: 10px 20px; background: var(--bg-elevated); color: var(--text-primary);
          border: 1px solid var(--border-default); border-radius: 10px;
          cursor: pointer; font-weight: 600; font-size: 14px;
        }
      `}</style>

      <div className="cc-shell">
        {/* ── Header ── */}
        <div className="cc-header">
          <button className="cc-header-back" onClick={() => navigate(-1)} aria-label="Go back">
            <i className="fa-solid fa-arrow-left" />
          </button>

          {course?.thumbnail
            ? <img src={resolveMediaUrl(course.thumbnail)} alt="" className="cc-header-thumb" />
            : <div className="cc-header-thumb-fallback"><i className="fa-solid fa-comments" /></div>
          }

          <div className="cc-header-info">
            <h2 className="cc-header-title">{course?.name || 'Community'}</h2>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="cc-messages" ref={messagesContainerRef}>
          {messages.length === 0 && (
            <div className="cc-empty">
              <div className="cc-empty-icon"><i className="fa-solid fa-comments" /></div>
              <h3>No messages yet</h3>
              <p>Be the first to start a conversation! Ask questions, share insights, or greet your fellow students.</p>
            </div>
          )}

          {groupedMessages.map((item, idx) => {
            if (item.type === 'separator') {
              return (
                <div key={`sep-${idx}`} className="cc-separator">
                  <div className="cc-sep-line" />
                  <span className="cc-sep-label">{formatDate(item.date)}</span>
                  <div className="cc-sep-line" />
                </div>
              );
            }
            return (
              <MessageBubble
                key={item.msg.id}
                msg={item.msg}
                currentUser={user}
                onDelete={handleDelete}
                onEdit={startEdit}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Editing banner ── */}
        {editingMsg && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px', background: 'var(--accent-subtle)',
            borderTop: '2px solid var(--accent-primary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <i className="fa-solid fa-pen" style={{ color: 'var(--accent-primary)', fontSize: '12px' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)' }}>Editing message:</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                "{editingMsg.content}"
              </span>
            </div>
            <button
              onClick={cancelEdit}
              type="button"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <i className="fa-solid fa-xmark" />
              <span>Cancel</span>
            </button>
          </div>
        )}

        {/* ── File preview ── */}
        {selectedFile && (
          <UploadPreview file={selectedFile} onRemove={() => setSelectedFile(null)} />
        )}

        {/* ── Upload progress ── */}
        {uploading && (
          <div className="cc-progress-wrap">
            <div className="cc-progress-box">
              <div className="cc-progress-row">
                <span>Uploading…</span><span>{uploadPct}%</span>
              </div>
              <div className="cc-progress-track">
                <div className="cc-progress-fill" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ── Input bar / Disabled Notice ── */}
        {isUserDisabled ? (
          <div style={{
            padding: '16px 20px',
            background: 'rgba(239, 68, 68, 0.08)',
            borderTop: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#ef4444',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            textAlign: 'center',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          }}>
            <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '18px', flexShrink: 0 }} />
            <span>Your participation in this community chat has been disabled by an administrator. You can view past messages, but cannot send new messages.</span>
          </div>
        ) : (
          <div className="cc-inputbar">
            <div className="cc-input-row">
              {!editingMsg && (
                <>
                  <button
                    type="button"
                    className="cc-attach-btn"
                    title="Attach image, PDF, or video"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="fa-solid fa-paperclip" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                </>
              )}

              <textarea
                ref={textareaRef}
                className="cc-textarea"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={autoResize}
                placeholder={editingMsg ? 'Edit message…' : 'Type a message…'}
                rows={1}
              />

              <button
                type="button"
                className={`cc-send-btn ${canSend ? 'cc-send-active' : 'cc-send-inactive'}`}
                onClick={handleSend}
                disabled={!canSend}
                aria-label={editingMsg ? 'Save changes' : 'Send message'}
                title={editingMsg ? 'Save changes' : 'Send'}
              >
                {sending || uploading
                  ? <i className="fa-solid fa-spinner fa-spin" />
                  : editingMsg
                    ? <i className="fa-solid fa-check" />
                    : <i className="fa-solid fa-paper-plane" />
                }
              </button>
            </div>
            <p className="cc-input-hint">
              {editingMsg ? 'Enter to save · Esc to cancel' : 'Enter to send · Shift+Enter for new line · Right-click to delete/edit'}
            </p>
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        deleting={deletingMsg}
      />
    </>
  );
}

// ─── Delete Confirmation Modal ───────────────────────────────────────────────
function DeleteConfirmModal({ isOpen, onClose, onConfirm, deleting }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '380px', margin: 'auto',
          background: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-default, #e2e8f0)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          padding: '24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#ef4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', marginBottom: '16px',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.15)',
        }}>
          <i className="fa-solid fa-trash-can" />
        </div>

        <h3 style={{
          margin: '0 0 8px', fontSize: '18px', fontWeight: 700,
          color: 'var(--text-primary, #0f172a)',
        }}>
          Delete Message?
        </h3>

        <p style={{
          margin: '0 0 24px', fontSize: '13px', color: 'var(--text-secondary, #64748b)',
          lineHeight: 1.5, maxWidth: '280px',
        }}>
          Are you sure you want to delete this message? This message will be permanently marked as deleted.
        </p>

        <div style={{
          display: 'flex', gap: '10px', width: '100%',
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            style={{
              flex: 1, padding: '11px 16px', borderRadius: '12px',
              border: '1px solid var(--border-default, #cbd5e1)',
              background: 'var(--bg-elevated, #f8fafc)',
              color: 'var(--text-primary, #334155)',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            style={{
              flex: 1, padding: '11px 16px', borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#ffffff',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
              transition: 'all 0.15s ease',
            }}
          >
            {deleting ? (
              <i className="fa-solid fa-spinner fa-spin" />
            ) : (
              <>
                <i className="fa-solid fa-trash-can" />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
