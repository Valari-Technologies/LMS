import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  getAdminCommunityOverview,
  getCommunityMessages,
  pollCommunityMessages,
  sendCommunityMessage,
  editCommunityMessage,
  deleteCommunityMessage,
  markCommunityRead,
  uploadCommunityMedia,
  getCommunityMembers,
  toggleCommunityMemberStatus,
  getMyCommunityStatus,
} from '../../api/community';
import { listAdminCourses } from '../../api/courses';
import { isChatMuted, toggleMuteChat } from '../../components/CommunityToastNotifier';
import { usePermission } from '../../hooks/usePermission';

const BACKEND = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:8080';
const POLL_INTERVAL_MS = 4000;
const MAX_FILE_MB = 50;

export function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BACKEND}${url}`;
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

function downloadImage(url, filename = 'image.jpg') {
  fetch(url)
    .then(resp => {
      if (!resp.ok) throw new Error('Network error');
      return resp.blob();
    })
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    })
    .catch(() => {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
}

// ─── Share Modal ─────────────────────────────────────────────────────────────
function ShareModal({ msg, currentCourseId, courses = [], onClose, onShared }) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [sharing, setSharing] = useState(false);

  const filtered = courses.filter(c =>
    !search || (c.courseName || c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  async function handleSend() {
    if (!selectedId || sharing) return;
    setSharing(true);
    try {
      const payload = {
        content: msg.content || null,
        messageType: msg.messageType || 'text',
        mediaAssetId: msg.mediaAssetId || null,
      };
      const sent = await sendCommunityMessage(selectedId, payload);
      const targetCourse = courses.find(c => (c.courseId || c.id) === selectedId);
      const targetName = targetCourse?.courseName || targetCourse?.name || 'Chat';
      const snippet = msg.content || (msg.messageType === 'image' ? '📷 Photo' : msg.messageType === 'video' ? '🎥 Video' : '📄 Attachment');
      window.dispatchEvent(new CustomEvent('community-new-message', {
        detail: { courseId: selectedId, lastMessage: snippet }
      }));
      onShared?.(targetName, selectedId, sent);
      onClose();
    } catch (e) {
      alert(e?.response?.data?.error?.message || 'Failed to share message');
    } finally {
      setSharing(false);
    }
  }

  let previewText = msg.content || '';
  if (msg.messageType === 'image') previewText = '📷 Photo' + (msg.content ? `: ${msg.content}` : '');
  else if (msg.messageType === 'video') previewText = '🎥 Video';
  else if (msg.messageType === 'pdf' || msg.messageType === 'file') previewText = '📄 ' + (msg.mediaName || 'Document');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '440px', maxHeight: '85vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '16px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--accent-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-primary)', fontSize: '14px',
            }}>
              <i className="fa-solid fa-share" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Share Message</h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>Choose a chat to forward to</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '18px', cursor: 'pointer', padding: '4px',
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div style={{
          margin: '12px 16px 8px', padding: '10px 14px',
          background: 'var(--bg-elevated)', borderRadius: '10px',
          borderLeft: '4px solid var(--accent-primary)',
          fontSize: '13px', color: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          {msg.messageType === 'image' && msg.mediaUrl && (
            <img
              src={resolveMediaUrl(msg.mediaUrl)}
              alt=""
              style={{ width: '38px', height: '38px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>Forwarding:</div>
            <div style={{ fontWeight: 500 }}>{previewText || 'Attachment'}</div>
          </div>
        </div>

        <div style={{ padding: '8px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)', borderRadius: '10px',
          }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)', fontSize: '13px' }} />
            <input
              type="text"
              placeholder="Search chats…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: '13px', width: '100%',
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 12px', maxHeight: '280px' }}>
          {filtered.map(c => {
            const cid = c.courseId || c.id;
            const cname = c.courseName || c.name;
            const cthumb = c.courseThumbnail || c.thumbnail;
            const isSelected = selectedId === cid;
            const isCurrent = Number(cid) === Number(currentCourseId);

            return (
              <div
                key={cid}
                onClick={() => setSelectedId(cid)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: '10px',
                  cursor: 'pointer', marginBottom: '4px',
                  background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden',
                  background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#fff', fontSize: '15px', flexShrink: 0,
                }}>
                  {cthumb ? (
                    <img src={resolveMediaUrl(cthumb)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <i className="fa-solid fa-graduation-cap" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {cname} {isCurrent && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(this chat)</span>}
                  </div>
                </div>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: isSelected ? 'none' : '2px solid var(--border-default)',
                  background: isSelected ? 'var(--accent-primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '11px', flexShrink: 0,
                }}>
                  {isSelected && <i className="fa-solid fa-check" />}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No chats found
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
          background: 'var(--bg-surface)',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-default)',
              background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedId || sharing}
            onClick={handleSend}
            style={{
              padding: '8px 20px', borderRadius: '8px', border: 'none',
              background: (!selectedId || sharing) ? 'var(--border-default)' : 'var(--accent-gradient)',
              color: '#fff', cursor: (!selectedId || sharing) ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            {sharing ? (
              <i className="fa-solid fa-spinner fa-spin" />
            ) : (
              <>
                <i className="fa-solid fa-paper-plane" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PDF / Document In-App Preview Modal ──────────────────────────────────────
function PdfPreviewModal({ doc, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!doc?.url) return;
    let active = true;
    let createdBlobUrl = null;
    setLoading(true);
    setError(null);

    fetch(doc.url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (!active) return;
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        createdBlobUrl = URL.createObjectURL(pdfBlob);
        setBlobUrl(createdBlobUrl);
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        console.warn('PDF blob loading error, falling back to direct url:', err);
        setError('Could not load in-page preview. Please use the download button.');
        setLoading(false);
      });

    return () => {
      active = false;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [doc?.url]);

  if (!doc) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '94vw', maxWidth: '1020px', height: '88vh',
          background: 'var(--bg-surface, #1e293b)',
          borderRadius: '16px', border: '1px solid var(--border-default)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            background: 'var(--bg-elevated, #0f172a)',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0,
            }}>
              <i className="fa-solid fa-file-pdf" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '420px',
              }}>
                {doc.name || 'Document.pdf'}
              </div>
              {doc.size > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {(doc.size / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => downloadImage(blobUrl || doc.url, doc.name || 'document.pdf')}
              style={{
                background: 'var(--accent-gradient, linear-gradient(135deg, #4f46e5, #111111))',
                border: 'none', color: '#fff',
                borderRadius: '8px', padding: '8px 18px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '13px', fontWeight: 600,
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <i className="fa-solid fa-download" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--bg-surface, rgba(255,255,255,0.1))',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary, #fff)',
                borderRadius: '50%', width: '36px', height: '36px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', transition: 'all 0.2s',
              }}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        {/* Document Body */}
        <div style={{ flex: 1, position: 'relative', background: '#525659', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#fff' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '13px', opacity: 0.85 }}>Loading PDF preview…</span>
            </div>
          )}
          {!loading && error && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', color: '#fff', padding: '24px', textAlign: 'center' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '36px', color: '#f59e0b' }} />
              <span style={{ fontSize: '14px', maxWidth: '380px' }}>{error}</span>
              <button
                type="button"
                onClick={() => downloadImage(doc.url, doc.name || 'document.pdf')}
                style={{
                  background: 'var(--accent-gradient)', border: 'none', color: '#fff',
                  borderRadius: '8px', padding: '9px 20px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                <i className="fa-solid fa-download" /> Download Document
              </button>
            </div>
          )}
          {!loading && blobUrl && !error && (
            <iframe
              src={`${blobUrl}#toolbar=1`}
              title={doc.name || 'Document Preview'}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ──────────────────────────────────────────────────────────
function MessageBubble({ msg, currentUser, courseId, onDelete, onEdit, onShare, onImageClick, onDocClick }) {
  const isOwn = msg.senderId === currentUser?.id;
  const isAdmin = msg.senderRole === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const touchTimerRef = useRef(null);
  const touchMovedRef = useRef(false);

  // WhatsApp-style 10-minute edit limit
  const isEditable = isOwn && !msg.deleted && (Date.now() - new Date(msg.createdAt).getTime()) <= 10 * 60 * 1000;

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleTouchStart = () => {
    touchMovedRef.current = false;
    touchTimerRef.current = setTimeout(() => {
      if (!touchMovedRef.current) {
        if (navigator.vibrate) try { navigator.vibrate(40); } catch {}
        setMenuOpen(true);
      }
    }, 450);
  };

  const handleTouchMove = () => {
    touchMovedRef.current = true;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'flex-end',
      flexDirection: isOwn ? 'row-reverse' : 'row', marginBottom: '4px',
    }}>
      {!isOwn && (
        <div style={{
          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
          background: isAdmin ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #5A70D3 0%, #4355B9 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 700, color: '#fff', overflow: 'hidden',
        }}>
          {msg.senderAvatar
            ? <img src={resolveMediaUrl(msg.senderAvatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : getInitials(msg.senderName)}
        </div>
      )}

      <div
        className="cc-bubble-wrap"
        style={{ maxWidth: '65%', position: 'relative' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {!isOwn && (
          <div style={{ fontSize: '11px', fontWeight: 600, color: isAdmin ? '#f59e0b' : 'var(--text-secondary)', marginBottom: '3px', paddingLeft: '2px' }}>
            {msg.senderName}{isAdmin && ' ⭐'}
          </div>
        )}
        <div
          style={{
            background: isOwn ? 'linear-gradient(135deg, #5A70D3 0%, #4355B9 100%)' : 'var(--bg-elevated)',
            color: isOwn ? '#fff' : 'var(--text-primary)',
            padding: msg.deleted ? '10px 14px' : (msg.messageType === 'text' ? '10px 14px' : '8px'),
            borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            boxShadow: isOwn ? '0 2px 8px rgba(90, 112, 211, 0.22)' : 'var(--shadow-sm)',
            border: isOwn ? 'none' : '1px solid var(--border-default)',
            position: 'relative',
          }}
          onContextMenu={!msg.deleted ? (e) => { e.preventDefault(); setMenuOpen(true); } : undefined}
        >
          {msg.deleted ? (
            <p style={{ margin: 0, fontSize: '14px', fontStyle: 'italic', opacity: 0.8, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-ban" /> {msg.content || 'This message was deleted'}
            </p>
          ) : (
            <>
              {msg.content && <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</p>}

              {/* Image message — click opens in lightbox in the same tab with download option */}
              {msg.messageType === 'image' && msg.mediaUrl && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageClick?.(resolveMediaUrl(msg.mediaUrl), msg.mediaName || 'image.jpg');
                  }}
                  style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}
                  title="Click to view image"
                >
                  <img
                    src={resolveMediaUrl(msg.mediaUrl)}
                    alt={msg.mediaName || 'Image'}
                    style={{ maxWidth: '220px', maxHeight: '160px', borderRadius: '10px', display: 'block', objectFit: 'cover' }}
                  />
                </div>
              )}

              {msg.messageType === 'video' && msg.mediaUrl && (
                <video src={resolveMediaUrl(msg.mediaUrl)} controls style={{ maxWidth: '240px', borderRadius: '10px', display: 'block' }} />
              )}

              {/* PDF / File message — opens in modal in the same tab with download option */}
              {(msg.messageType === 'pdf' || msg.messageType === 'file') && msg.mediaUrl && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onDocClick?.(resolveMediaUrl(msg.mediaUrl), msg.mediaName || 'Document.pdf', msg.mediaSize);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    color: isOwn ? '#fff' : 'var(--text-primary)', padding: '8px 4px',
                    cursor: 'pointer',
                  }}
                  title="Click to open document"
                >
                  <i className="fa-solid fa-file-pdf" style={{ fontSize: '24px', opacity: 0.9, color: isOwn ? '#fff' : '#ef4444' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {msg.mediaName || 'Document.pdf'}
                    </div>
                    {msg.mediaSize > 0 && <div style={{ fontSize: '11px', opacity: 0.7 }}>{(msg.mediaSize / 1024 / 1024).toFixed(1)} MB</div>}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadImage(resolveMediaUrl(msg.mediaUrl), msg.mediaName || 'document.pdf');
                    }}
                    title="Download document"
                    style={{
                      background: 'none', border: 'none',
                      color: isOwn ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer', padding: '6px', fontSize: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <i className="fa-solid fa-arrow-down-to-line" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: isOwn ? 'flex-end' : 'flex-start', marginTop: '3px', paddingLeft: '2px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {formatTime(msg.createdAt)}
            {msg.edited && !msg.deleted && <span style={{ marginLeft: '4px', fontStyle: 'italic', opacity: 0.85 }}>· Edited</span>}
          </span>
          {!msg.deleted && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}
              title="Options"
              style={{
                background: 'none', border: 'none', padding: '0 2px',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px',
              }}
            >
              <i className="fa-solid fa-ellipsis-vertical" />
            </button>
          )}
        </div>

        {menuOpen && !msg.deleted && (
          <div ref={menuRef} style={{
            position: 'absolute', top: '100%', [isOwn ? 'right' : 'left']: 0, zIndex: 50,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
            borderRadius: '10px', boxShadow: 'var(--shadow-lg)', padding: '4px', minWidth: '130px',
          }}>
            {/* Share / Forward — always available for any message */}
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onShare?.(msg); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', borderRadius: '6px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-subtle)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <i className="fa-solid fa-share" style={{ color: 'var(--accent-primary)' }} /> Share
            </button>

            {/* Delete option — placed directly below Share as requested */}
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onDelete(msg.id, msg); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '13px', borderRadius: '6px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg, rgba(239, 68, 68, 0.1))'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <i className="fa-solid fa-trash-can" /> Delete
            </button>

            {isEditable && (
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onEdit(msg); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', borderRadius: '6px' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-subtle)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--accent-primary)' }} /> Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Panel ──────────────────────────────────────────────────────────────
export function ChatPanel({ courseId, courseName, currentUser, availableCourses = [], placeholder = 'Reply to students…' }) {
  const { isReadOnly } = usePermission();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUserDisabled, setIsUserDisabled] = useState(false);
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [shareMsg, setShareMsg] = useState(null);
  const [shareToast, setShareToast] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deletingMsg, setDeletingMsg] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const lastMsgIdRef = useRef(0);
  const pollTimerRef = useRef(null);
  const pollErrorCountRef = useRef(0);

  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (e.key === 'Escape') {
        if (previewImage) setPreviewImage(null);
        if (previewDoc) setPreviewDoc(null);
        if (shareMsg) setShareMsg(null);
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [previewImage, previewDoc, shareMsg]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setMessages([]);
    setEditingMsg(null);
    setIsUserDisabled(false);
    lastMsgIdRef.current = 0;
    isInitialLoadRef.current = true;

    async function init() {
      try {
        const [data, disabledStatus] = await Promise.all([
          getCommunityMessages(courseId, { page: 0, size: 50 }),
          currentUser?.role === 'student' ? getMyCommunityStatus(courseId).catch(() => false) : Promise.resolve(false),
        ]);
        if (!mounted) return;
        setIsUserDisabled(!!disabledStatus);
        const msgs = data?.content || [];
        setMessages(msgs);
        if (msgs.length > 0) {
          lastMsgIdRef.current = msgs[msgs.length - 1].id;
          const last = msgs[msgs.length - 1];
          const snippet = last.content || (last.messageType === 'image' ? '📷 Photo' : last.messageType === 'video' ? '🎥 Video' : (last.messageType === 'pdf' || last.messageType === 'file') ? '📄 Attachment' : 'Attachment');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('community-new-message', { detail: { courseId, lastMessage: snippet } }));
          }, 0);
        }

        // Auto mark read and sync navbar badge
        markCommunityRead(courseId).catch(() => {});
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('community-read', { detail: { courseId } }));
        }, 0);
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }
    init();
    return () => { mounted = false; };
  }, [courseId, currentUser]);

  useEffect(() => {
    if (loading) return;
    pollErrorCountRef.current = 0;
    async function poll() {
      try {
        const newMsgs = await pollCommunityMessages(courseId, lastMsgIdRef.current);
        pollErrorCountRef.current = 0;
        if (newMsgs?.length > 0) {
          const latest = newMsgs[newMsgs.length - 1];
          lastMsgIdRef.current = Math.max(lastMsgIdRef.current, latest.id);
          const snippet = latest.content || (latest.messageType === 'image' ? '📷 Photo' : latest.messageType === 'video' ? '🎥 Video' : (latest.messageType === 'pdf' || latest.messageType === 'file') ? '📄 Attachment' : 'Attachment');

          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const fresh = newMsgs.filter(m => !ids.has(m.id));
            if (!fresh.length) return prev;
            return [...prev, ...fresh];
          });

          // Dispatch event outside state updater on next tick
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('community-new-message', { detail: { courseId, lastMessage: snippet } }));
          }, 0);

          // Since chat is actively open, mark new messages as read immediately
          markCommunityRead(courseId, latest.id).catch(() => {});
        }
      } catch {
        pollErrorCountRef.current += 1;
        if (pollErrorCountRef.current >= 5) {
          clearInterval(pollTimerRef.current);
        }
      }
    }
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollTimerRef.current);
  }, [courseId, loading]);

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
        // Direct instant jump to the last message on initial open (no scroll-down animation)
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
        // Subsequent new messages: scroll smoothly only if already near the bottom
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
  }

  async function handleSend(e) {
    e?.preventDefault();

    // Handling message edit
    if (editingMsg) {
      const hasText = text.trim().length > 0;
      if (!hasText) return;
      if (sending) return;
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

    // Normal message sending
    const hasText = text.trim().length > 0;
    const hasFile = !!selectedFile;
    if (!hasText && !hasFile) return;
    if (sending || uploading) return;
    setSending(true);
    try {
      let mediaAssetId = null;
      let messageType = 'text';
      if (hasFile) {
        setUploading(true);
        const asset = await uploadCommunityMedia(selectedFile, setUploadProgress);
        mediaAssetId = asset.id;
        messageType = asset.fileType || 'file';
        setUploading(false);
        setUploadProgress(0);
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
      const snippet = newMsg.content || (newMsg.messageType === 'image' ? '📷 Photo' : newMsg.messageType === 'video' ? '🎥 Video' : (newMsg.messageType === 'pdf' || newMsg.messageType === 'file') ? '📄 Attachment' : 'Attachment');
      window.dispatchEvent(new CustomEvent('community-new-message', { detail: { courseId, lastMessage: snippet } }));
      setTimeout(() => scrollToBottom(false), 50);
    } catch (e) {
      alert(e?.response?.data?.error?.message || 'Failed to send message');
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
    const deletedText = 'This message was deleted';
    try {
      await deleteCommunityMessage(courseId, deleteTargetId);
      setMessages(prev => prev.map(m => m.id === deleteTargetId ? { ...m, deleted: true, content: deletedText, mediaUrl: null, mediaName: null, mediaMimeType: null, messageType: 'text' } : m));
    } catch (err) {
      if (err?.response?.status === 403) {
        setMessages(prev => prev.map(m => m.id === deleteTargetId ? { ...m, deleted: true, content: deletedText, mediaUrl: null, mediaName: null, mediaMimeType: null, messageType: 'text' } : m));
      } else {
        alert(err?.response?.data?.error?.message || 'Could not delete message');
      }
    } finally {
      setDeletingMsg(false);
      setDeleteTargetId(null);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape' && editingMsg) { cancelEdit(); }
  }

  const groupedMessages = messages.reduce((acc, msg, idx) => {
    const prev = messages[idx - 1];
    if (!prev || !isSameDay(prev.createdAt, msg.createdAt)) {
      acc.push({ type: 'separator', date: msg.createdAt });
    }
    acc.push({ type: 'message', msg });
    return acc;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages area */}
      <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', color: 'var(--accent-primary)' }} />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px', gap: '12px' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: 'var(--accent-primary)' }}>
              <i className="fa-solid fa-comments" />
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>No messages yet. Be the first to start the conversation!</p>
          </div>
        )}

        {groupedMessages.map((item, idx) => {
          if (item.type === 'separator') {
            return (
              <div key={`sep-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0 6px' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 10px', borderRadius: '20px', border: '1px solid var(--border-default)' }}>
                  {formatDate(item.date)}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
              </div>
            );
          }
          return (
            <MessageBubble
              key={item.msg.id}
              msg={item.msg}
              currentUser={currentUser}
              courseId={courseId}
              onDelete={handleDelete}
              onEdit={startEdit}
              onShare={setShareMsg}
              onImageClick={(url, name) => setPreviewImage({ url, name })}
              onDocClick={(url, name, size) => setPreviewDoc({ url, name, size })}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Editing Banner */}
      {editingMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px', background: 'var(--accent-subtle)',
          borderTop: '2px solid var(--accent-primary)', color: 'var(--text-primary)',
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
              color: 'var(--text-muted)', fontSize: '13px', padding: '4px',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <i className="fa-solid fa-xmark" />
            <span style={{ fontSize: '11px' }}>Cancel</span>
          </button>
        </div>
      )}

      {/* File preview */}
      {selectedFile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-default)', margin: '0 0 0 0' }}>
          <i className="fa-solid fa-paperclip" style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</span>
          <button onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {uploading && (
        <div style={{ padding: '6px 12px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <span>Uploading…</span><span>{uploadProgress}%</span>
          </div>
          <div style={{ height: '3px', borderRadius: '3px', background: 'var(--border-default)' }}>
            <div style={{ height: '100%', borderRadius: '3px', background: 'var(--accent-gradient)', width: `${uploadProgress}%`, transition: 'width 0.2s' }} />
          </div>
        </div>
      )}

      {/* Input */}
      {isUserDisabled ? (
        <div style={{
          padding: '14px 18px',
          borderTop: '1px solid rgba(239, 68, 68, 0.25)',
          background: 'rgba(239, 68, 68, 0.08)',
          textAlign: 'center',
          color: '#ef4444',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '16px', flexShrink: 0 }} />
          <span>Your participation in this community chat has been disabled by an administrator. You can view past messages, but cannot send new messages.</span>
        </div>
      ) : isReadOnly ? (
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-surface)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <i className="fa-solid fa-lock" style={{ color: 'var(--text-muted)' }} />
          <span>Read-Only Mode: Messaging is disabled for read-only accounts.</span>
        </div>
      ) : (
        <div style={{ padding: '12px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            {!editingMsg && (
              <>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>
                  <i className="fa-solid fa-paperclip" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,video/*,application/pdf" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file && file.size <= MAX_FILE_MB * 1024 * 1024) setSelectedFile(file);
                    else if (file) alert(`File must be smaller than ${MAX_FILE_MB} MB`);
                    e.target.value = '';
                  }} />
              </>
            )}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={editingMsg ? 'Edit message…' : placeholder}
              rows={1}
              style={{ flex: 1, padding: '9px 12px', fontSize: '13px', resize: 'none', lineHeight: 1.5, background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '20px', outline: 'none', fontFamily: 'inherit', maxHeight: '100px', overflowY: 'auto' }}
              onFocus={e => e.target.style.borderColor = 'var(--border-focus)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }} />
            <button type="submit" disabled={sending || uploading || (!text.trim() && !selectedFile)}
              title={editingMsg ? 'Save changes' : 'Send'}
              style={{ width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: (sending || uploading || (!text.trim() && !selectedFile)) ? 'var(--border-default)' : 'var(--accent-gradient)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px' }}>
              {sending || uploading
                ? <i className="fa-solid fa-spinner fa-spin" />
                : editingMsg
                  ? <i className="fa-solid fa-check" />
                  : <i className="fa-solid fa-paper-plane" />}
            </button>
          </form>
        </div>
      )}

      {/* ── Share Modal (WhatsApp Style) ── */}
      {shareMsg && (
        <ShareModal
          msg={shareMsg}
          currentCourseId={courseId}
          courses={availableCourses}
          onClose={() => setShareMsg(null)}
          onShared={(targetName, targetId, sentMsg) => {
            if (Number(targetId) === Number(courseId) && sentMsg) {
              setMessages(prev => [...prev, sentMsg]);
            }
            setShareToast(`Message shared to ${targetName}!`);
            setTimeout(() => setShareToast(null), 3000);
          }}
        />
      )}

      {/* ── Image Lightbox Modal ── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.88)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
        >
          {/* Top Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '16px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <i className="fa-solid fa-image" style={{ color: 'var(--accent-primary)', fontSize: '18px' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {previewImage.name}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => downloadImage(previewImage.url, previewImage.name)}
                style={{
                  background: 'rgba(255, 255, 255, 0.18)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '7px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >
                <i className="fa-solid fa-download" />
                <span>Download</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.18)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  transition: 'all 0.2s',
                }}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          </div>

          {/* Centered Image */}
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={previewImage.url}
              alt={previewImage.name}
              style={{
                maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain',
                borderRadius: '8px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Document / PDF Modal (In-Page Preview with Download Option) ── */}
      {previewDoc && (
        <PdfPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* ── Toast notification feedback ── */}
      {shareToast && (
        <div style={{
          position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--accent-primary)',
          color: '#fff', padding: '10px 20px', borderRadius: '30px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 99999,
          fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <i className="fa-solid fa-circle-check" style={{ color: '#22c55e' }} />
          <span>{shareToast}</span>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      <DeleteConfirmModal
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        deleting={deletingMsg}
      />
    </div>
  );
}

// ─── Community Members Modal (WhatsApp Group Info Style) ──────────────────────
function CommunityMembersModal({ courseId, courseName, courseThumbnail, onClose }) {
  const { isReadOnly } = usePermission();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let active = true;
    getCommunityMembers(courseId)
      .then(data => {
        if (active) setMembers(data || []);
      })
      .catch(err => {
        console.error('Failed to load community members', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [courseId]);

  async function handleToggleStatus(member) {
    if (isReadOnly || updatingId) return;
    const targetStatus = !member.isDisabled;
    setUpdatingId(member.userId);
    try {
      const updated = await toggleCommunityMemberStatus(courseId, member.userId, targetStatus);
      setMembers(prev => prev.map(m => m.userId === member.userId ? { ...m, isDisabled: updated.isDisabled } : m));
      setToast(`Community access ${targetStatus ? 'disabled' : 'enabled'} for ${member.name}`);
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      alert(e?.response?.data?.error?.message || 'Failed to update member status');
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = members.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = members.filter(m => !m.isDisabled).length;
  const disabledCount = members.filter(m => m.isDisabled).length;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px', maxHeight: '88vh',
          background: 'var(--bg-surface, #1e293b)',
          border: '1px solid var(--border-default)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', position: 'relative',
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px', background: 'var(--bg-elevated, #0f172a)',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px', height: '46px', borderRadius: '12px', overflow: 'hidden',
              background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', fontSize: '20px', flexShrink: 0,
            }}>
              {courseThumbnail ? (
                <img src={resolveMediaUrl(courseThumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <i className="fa-solid fa-users-gear" />
              )}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {courseName}
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span><i className="fa-solid fa-user-check" style={{ color: '#22c55e', marginRight: '4px' }} />{activeCount} Active</span>
                {disabledCount > 0 && <span><i className="fa-solid fa-user-slash" style={{ color: '#ef4444', marginRight: '4px' }} />{disabledCount} Disabled</span>}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--bg-surface, rgba(255,255,255,0.1))',
              border: '1px solid var(--border-default)', color: 'var(--text-secondary)',
              borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px',
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', background: 'var(--bg-input)',
            border: '1px solid var(--border-default)', borderRadius: '10px',
          }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: 'var(--text-muted)', fontSize: '13px' }} />
            <input
              type="text"
              placeholder="Search students by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: '13px', width: '100%',
              }}
            />
          </div>
        </div>

        {/* Members List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', color: 'var(--accent-primary)' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No community members found
            </div>
          ) : (
            filtered.map(m => (
              <div
                key={m.userId}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: '12px', marginBottom: '8px',
                  background: m.isDisabled ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-elevated)',
                  border: m.isDisabled ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-default)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    background: m.isDisabled ? '#475569' : 'linear-gradient(135deg, #5A70D3 0%, #4355B9 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '14px', fontWeight: 700, overflow: 'hidden',
                  }}>
                    {m.avatar ? <img src={resolveMediaUrl(m.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.name)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                      {m.isDisabled ? (
                        <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                          Disabled
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                      {m.email}
                    </div>
                  </div>
                </div>

                {/* Status Toggle Button */}
                <button
                  type="button"
                  disabled={updatingId === m.userId || isReadOnly}
                  onClick={() => handleToggleStatus(m)}
                  style={{
                    padding: '6px 14px', borderRadius: '20px',
                    background: m.isDisabled
                      ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                      : 'rgba(239, 68, 68, 0.12)',
                    color: m.isDisabled ? '#ffffff' : '#ef4444',
                    border: m.isDisabled ? 'none' : '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '12px', fontWeight: 700, cursor: (updatingId === m.userId || isReadOnly) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    transition: 'all 0.2s', flexShrink: 0,
                    boxShadow: m.isDisabled ? '0 2px 8px rgba(34,197,94,0.3)' : 'none',
                  }}
                >
                  {updatingId === m.userId ? (
                    <i className="fa-solid fa-spinner fa-spin" />
                  ) : m.isDisabled ? (
                    <>
                      <i className="fa-solid fa-user-check" />
                      <span>Enable</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-user-slash" />
                      <span>Disable</span>
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-surface)', textAlign: 'right' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
            background: '#0f172a', border: '1px solid var(--accent-primary)',
            color: '#fff', padding: '8px 16px', borderRadius: '20px',
            fontSize: '12px', fontWeight: 600, boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            zIndex: 100, display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <i className="fa-solid fa-circle-check" style={{ color: '#22c55e' }} />
            <span>{toast}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Admin Community Page ───────────────────────────────────────────────
export default function AdminCommunityPage() {
  const { user } = useAuth();
  const [allCourses, setAllCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('onetutor_community_notifications') !== 'disabled';
  });
  const [muteVersion, setMuteVersion] = useState(0);

  useEffect(() => {
    function handleNotifToggle() {
      setNotificationsEnabled(localStorage.getItem('onetutor_community_notifications') !== 'disabled');
    }
    function handleMuteToggle() {
      setMuteVersion(v => v + 1);
    }
    function handleNewMsg(e) {
      const { courseId: cId, lastMessage } = e.detail || {};
      if (!cId || !lastMessage) return;
      setAllCourses(prev => prev.map(c => c.courseId === cId ? { ...c, lastMessage } : c));
    }
    window.addEventListener('community-notif-toggle', handleNotifToggle);
    window.addEventListener('community-mute-toggle', handleMuteToggle);
    window.addEventListener('community-new-message', handleNewMsg);
    return () => {
      window.removeEventListener('community-notif-toggle', handleNotifToggle);
      window.removeEventListener('community-mute-toggle', handleMuteToggle);
      window.removeEventListener('community-new-message', handleNewMsg);
    };
  }, []);

  const toggleNotifications = () => {
    const nextState = !notificationsEnabled;
    setNotificationsEnabled(nextState);
    localStorage.setItem('onetutor_community_notifications', nextState ? 'enabled' : 'disabled');
    window.dispatchEvent(new Event('community-notif-toggle'));
  };

  useEffect(() => {
    async function init() {
      try {
        const [statsResult, coursesResult] = await Promise.allSettled([
          getAdminCommunityOverview(),
          listAdminCourses({ size: 200 }),
        ]);

        const stats   = statsResult.status   === 'fulfilled' ? (statsResult.value   || []) : [];
        const courses = coursesResult.status === 'fulfilled' ? (coursesResult.value?.content || []) : [];

        // Merge: enrich every course with its total and unread message counts
        const statsMap = new Map(stats.map(s => [s.courseId, s]));
        const enriched = courses.map(c => ({
          courseId: c.id,
          courseName: c.name,
          courseThumbnail: c.thumbnail,
          totalMessages: statsMap.get(c.id)?.totalMessages ?? 0,
          unreadCount: statsMap.get(c.id)?.unreadCount ?? 0,
          lastMessage: statsMap.get(c.id)?.lastMessage || null,
          status: c.status,
        }));
        // Sort courses with unread messages first, then by total messages
        enriched.sort((a, b) => {
          const unreadComp = b.unreadCount - a.unreadCount;
          if (unreadComp !== 0) return unreadComp;
          return b.totalMessages - a.totalMessages;
        });
        setAllCourses(enriched);

        // Fetch last message for courses that have messages but missing lastMessage
        enriched.forEach(async (c) => {
          if (!c.lastMessage && c.totalMessages > 0) {
            try {
              const res = await getCommunityMessages(c.courseId, { page: 0, size: 50 });
              const content = res?.content || [];
              if (content.length > 0) {
                const latest = content[content.length - 1];
                const snippet = latest.content || (latest.messageType === 'image' ? '📷 Photo' : latest.messageType === 'video' ? '🎥 Video' : (latest.messageType === 'pdf' || latest.messageType === 'file') ? '📄 Attachment' : 'Attachment');
                setAllCourses(prev => prev.map(item => item.courseId === c.courseId ? { ...item, lastMessage: snippet } : item));
              }
            } catch {}
          }
        });
      } catch (e) {
        console.error('Admin community init error:', e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  function handleSelectCourse(c) {
    setSelectedCourse(c);
    if (c.unreadCount > 0) {
      setAllCourses(prev => prev.map(item => item.courseId === c.courseId ? { ...item, unreadCount: 0 } : item));
      markCommunityRead(c.courseId).catch(() => {});
      window.dispatchEvent(new CustomEvent('community-read', { detail: { courseId: c.courseId } }));
    }
  }

  const filteredCourses = allCourses.filter(c =>
    !search || c.courseName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '28px', color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', overflow: 'hidden', background: 'var(--bg-page)' }}>
      {/* Sidebar */}
      <div style={{
        width: '280px', flexShrink: 0, borderRight: '1px solid var(--border-default)',
        background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Sidebar header */}
        <div style={{ padding: '20px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              <i className="fa-solid fa-comments" style={{ marginRight: '8px', color: 'var(--accent-primary)' }} />
              Community
            </h2>
            <button
              type="button"
              onClick={toggleNotifications}
              title={notificationsEnabled ? 'Toast notifications ON (Click to turn OFF)' : 'Toast notifications OFF (Click to turn ON)'}
              style={{
                background: 'none',
                border: 'none',
                padding: '0 4px',
                margin: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justify: 'center',
                flexShrink: 0,
                lineHeight: 1,
                transition: 'transform 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.0)'}
            >
              <i
                className={`fa-solid ${notificationsEnabled ? 'fa-bell' : 'fa-bell-slash'}`}
                style={{
                  color: notificationsEnabled ? '#fbbf24' : 'var(--text-muted)',
                  fontSize: '20px',
                  lineHeight: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justify: 'center',
                  filter: 'none',
                  transition: 'all 0.25s ease',
                }}
              />
            </button>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
            {allCourses.length} course{allCourses.length !== 1 ? 's' : ''}
          </p>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '12px' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search courses…"
              style={{
                width: '100%', padding: '8px 10px 8px 30px', fontSize: '13px',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border-default)', borderRadius: '8px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Course list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredCourses.map(c => {
            const isActive = selectedCourse?.courseId === c.courseId;
            return (
              <button
                key={c.courseId}
                onClick={() => handleSelectCourse(c)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', background: isActive ? 'var(--accent-subtle)' : 'none',
                  border: 'none', borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'none'; }}
              >
                {/* Thumbnail */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0, overflow: 'hidden',
                  background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '16px',
                }}>
                  {c.courseThumbnail
                    ? <img src={resolveMediaUrl(c.courseThumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <i className="fa-solid fa-graduation-cap" />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.courseName}</span>
                    {isChatMuted(c.courseId) && (
                      <i className="fa-solid fa-bell-slash" style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }} title="Muted" />
                    )}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '2px',
                  }}>
                    {c.lastMessage || 'No messages yet'}
                  </div>
                </div>

                {/* WhatsApp-style unread badge: only shown if there are unread messages, removed when opened */}
                {c.unreadCount > 0 && (
                  <div style={{
                    minWidth: '22px', height: '22px', borderRadius: '11px', padding: '0 6px',
                    background: '#22c55e', color: '#fff', fontSize: '10px', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    boxShadow: '0 2px 4px rgba(34,197,94,0.3)',
                  }}>
                    {c.unreadCount > 99 ? '99+' : c.unreadCount}
                  </div>
                )}
              </button>
            );
          })}

          {filteredCourses.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No courses found
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedCourse ? (
          <>
            {/* Chat header (Click title or avatar for WhatsApp Group Info) */}
            <div style={{
              padding: '12px 20px', background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', gap: '12px',
              boxShadow: 'var(--shadow-sm)', flexShrink: 0,
            }}>
              <div
                onClick={() => setShowMembersModal(true)}
                title="Click to view & manage group members"
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                  padding: '4px 8px', borderRadius: '10px', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden',
                  background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px', flexShrink: 0,
                }}>
                  {selectedCourse.courseThumbnail
                    ? <img src={resolveMediaUrl(selectedCourse.courseThumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <i className="fa-solid fa-comments" />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{selectedCourse.courseName}</span>
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: '11px', color: 'var(--text-muted)' }} />
                  </h3>
                  <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, marginTop: '1px' }}>
                    <i className="fa-solid fa-users" style={{ marginRight: '4px' }} />
                    Group Info • Click to manage members
                  </div>
                </div>
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Per-chat Mute Toggle (WhatsApp style) */}
                <button
                  type="button"
                  onClick={() => toggleMuteChat(selectedCourse.courseId)}
                  title={isChatMuted(selectedCourse.courseId) ? 'Notifications MUTED for this chat (Click to unmute)' : 'Notifications ON for this chat (Click to mute)'}
                  aria-label={isChatMuted(selectedCourse.courseId) ? 'Unmute notifications' : 'Mute notifications'}
                  style={{
                    background: isChatMuted(selectedCourse.courseId) ? 'var(--bg-elevated)' : 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid ' + (isChatMuted(selectedCourse.courseId) ? 'var(--border-default)' : 'rgba(245, 158, 11, 0.3)'),
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    color: isChatMuted(selectedCourse.courseId) ? 'var(--text-muted)' : '#d97706',
                    transition: 'all 0.2s',
                  }}
                >
                  <i className={`fa-solid ${isChatMuted(selectedCourse.courseId) ? 'fa-bell-slash' : 'fa-bell'}`} style={{ color: isChatMuted(selectedCourse.courseId) ? '#9ca3af' : '#f59e0b' }} />
                </button>
              </div>
            </div>

            {/* Chat messages + input */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <ChatPanel
                key={selectedCourse.courseId}
                courseId={selectedCourse.courseId}
                courseName={selectedCourse.courseName}
                currentUser={user}
                availableCourses={allCourses}
              />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '16px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', color: 'var(--accent-primary)' }}>
              <i className="fa-solid fa-comments" />
            </div>
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Select a Course</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>Choose a course from the sidebar to view its community chat</p>
          </div>
        )}
      </div>

      {/* Community Members Modal */}
      {showMembersModal && selectedCourse && (
        <CommunityMembersModal
          courseId={selectedCourse.courseId}
          courseName={selectedCourse.courseName}
          courseThumbnail={selectedCourse.courseThumbnail}
          onClose={() => setShowMembersModal(false)}
        />
      )}
    </div>
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
