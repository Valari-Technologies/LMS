import { useState, useEffect, useRef } from 'react';
import {
  getStudentDoubtMessages,
  pollStudentDoubtMessages,
  sendStudentDoubt,
  markStudentDoubtRead,
  getStudentCommunityOverview,
  uploadCommunityMedia
} from '../api/community';
import { resolveMediaUrl } from '../utils/mediaUtils';

const POLL_INTERVAL_MS = 3500;

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
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function isSameDay(iso1, iso2) {
  if (!iso1 || !iso2) return false;
  return new Date(iso1).toDateString() === new Date(iso2).toDateString();
}

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function downloadMedia(url, filename = 'download') {
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightbox Preview Modal for Images
// ─────────────────────────────────────────────────────────────────────────────
function ImageLightboxModal({ url, filename, onClose }) {
  if (!url) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '10px', zIndex: 10000 }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); downloadMedia(url, filename || 'image.jpg'); }}
          style={{
            background: '#5A70D3',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <i className="fa-solid fa-download" /> Download
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      <img
        src={url}
        alt=""
        style={{
          maxWidth: '90vw',
          maxHeight: '85vh',
          objectFit: 'contain',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF Preview Modal (Matches Community Chat)
// ─────────────────────────────────────────────────────────────────────────────
function PdfPreviewModal({ doc, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetch(doc.url)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load file');
        return r.blob();
      })
      .then(b => {
        if (!active) return;
        const objectUrl = window.URL.createObjectURL(b);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      if (blobUrl) window.URL.revokeObjectURL(blobUrl);
    };
  }, [doc.url]);

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
          background: '#ffffff',
          borderRadius: '16px', border: '1px solid #e2e8f0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', position: 'relative',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            background: '#0f172a',
            borderBottom: '1px solid #334155',
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
                fontSize: '14px', fontWeight: 600, color: '#ffffff',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '420px',
              }}>
                {doc.name || 'Document.pdf'}
              </div>
              {doc.size > 0 && (
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {(doc.size / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => downloadMedia(blobUrl || doc.url, doc.name || 'document.pdf')}
              style={{
                background: 'linear-gradient(135deg, #5A70D3, #4355B9)',
                border: 'none', color: '#fff',
                borderRadius: '8px', padding: '8px 18px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '13px', fontWeight: 600,
                boxShadow: '0 2px 8px rgba(90, 112, 211, 0.3)',
              }}
            >
              <i className="fa-solid fa-download" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                borderRadius: '50%', width: '36px', height: '36px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px',
              }}
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#fff' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: '#5A70D3' }} />
              <span style={{ fontSize: '13px' }}>Loading document preview…</span>
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', color: '#fff', padding: '20px' }}>
              <p style={{ margin: '0 0 12px' }}>Preview is not supported for this file type.</p>
              <button
                type="button"
                onClick={() => downloadMedia(doc.url, doc.name || 'document')}
                style={{
                  background: '#5A70D3', color: '#fff', border: 'none',
                  borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
                }}
              >
                Download File
              </button>
            </div>
          )}
          {!loading && !error && blobUrl && (
            <iframe
              src={blobUrl}
              title={doc.name}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN STUDENT 1-ON-1 DOUBT CLEARANCE COMPONENT (WhatsApp Style)
// ─────────────────────────────────────────────────────────────────────────────
export default function StudentTutorDoubtView({
  initialCourseId,
  currentCourse,
  currentUser
}) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [search, setSearch] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(true);

  // Conversation state for selected course
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const lastMsgIdRef = useRef(0);
  const pollTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Load enrolled courses list
  useEffect(() => {
    let mounted = true;
    async function loadCourseList() {
      try {
        setLoadingCourses(true);
        const list = await getStudentCommunityOverview();
        if (!mounted) return;
        let enrolled = Array.isArray(list) ? list : [];

        // Ensure currentCourse is in list
        const currentIdStr = String(initialCourseId || currentCourse?.id || '');
        let target = enrolled.find(c => String(c.courseId) === currentIdStr);
        if (!target && currentCourse) {
          const fallbackCourse = {
            courseId: initialCourseId || currentCourse.id,
            courseName: currentCourse.name || currentCourse.title || 'Course Doubt Desk',
            courseThumbnail: currentCourse.thumbnail || '',
            unreadCount: 0,
            lastMessage: 'Ask your instructor a private doubt'
          };
          enrolled = [fallbackCourse, ...enrolled];
          target = fallbackCourse;
        }

        setCourses(enrolled);

        if (target) {
          setSelectedCourse(target);
          setMobileShowChat(true);
        } else if (enrolled.length > 0) {
          setSelectedCourse(enrolled[0]);
          setMobileShowChat(true);
        }
      } catch (err) {
        console.error('Failed to load courses for doubts:', err);
        if (currentCourse && mounted) {
          const fallback = {
            courseId: initialCourseId || currentCourse.id,
            courseName: currentCourse.name || currentCourse.title || 'Course Doubt Desk',
            courseThumbnail: currentCourse.thumbnail || '',
            unreadCount: 0,
            lastMessage: ''
          };
          setCourses([fallback]);
          setSelectedCourse(fallback);
          setMobileShowChat(true);
        }
      } finally {
        if (mounted) setLoadingCourses(false);
      }
    }

    loadCourseList();
    return () => { mounted = false; };
  }, [initialCourseId, currentCourse]);

  // Load messages whenever selectedCourse changes
  useEffect(() => {
    if (!selectedCourse?.courseId) return;
    let mounted = true;
    const cId = selectedCourse.courseId;

    setLoadingMessages(true);
    setMessages([]);
    lastMsgIdRef.current = 0;

    async function loadThread() {
      try {
        const data = await getStudentDoubtMessages(cId, { page: 0, size: 50 });
        if (!mounted) return;
        const list = data?.content || [];
        setMessages(list);
        if (list.length > 0) {
          lastMsgIdRef.current = list[list.length - 1].id;
        }
        markStudentDoubtRead(cId).catch(() => {});
      } catch (err) {
        console.error('Failed to load doubt thread:', err);
      } finally {
        if (mounted) setLoadingMessages(false);
      }
    }

    loadThread();

    // Setup polling for live tutor replies
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const fresh = await pollStudentDoubtMessages(cId, lastMsgIdRef.current);
        if (Array.isArray(fresh) && fresh.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = fresh.filter(m => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            const combined = [...prev, ...newMsgs];
            lastMsgIdRef.current = combined[combined.length - 1].id;
            markStudentDoubtRead(cId, lastMsgIdRef.current).catch(() => {});
            return combined;
          });
        }
      } catch {
        // ignore transient poll error
      }
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [selectedCourse?.courseId]);

  // Auto-scroll to bottom on messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, loadingMessages]);

  function handleSelectCourse(c) {
    setSelectedCourse(c);
    setMobileShowChat(true);
  }

  async function handleSend(customText = null) {
    const toSend = (customText !== null ? customText : text).trim();
    if (!toSend && !selectedFile) return;
    if (sending || uploading) return;

    const cId = selectedCourse?.courseId;
    if (!cId) return;

    setSending(true);
    try {
      let mediaAssetId = null;
      let messageType = 'text';

      if (selectedFile) {
        setUploading(true);
        const uploaded = await uploadCommunityMedia(selectedFile, setUploadProgress);
        mediaAssetId = uploaded?.id || null;
        messageType = selectedFile.type?.startsWith('image/')
          ? 'image'
          : selectedFile.type?.startsWith('video/')
          ? 'video'
          : selectedFile.type?.includes('pdf')
          ? 'pdf'
          : 'file';
        setUploading(false);
        setSelectedFile(null);
      }

      const sent = await sendStudentDoubt(cId, {
        content: toSend || null,
        messageType,
        mediaAssetId
      });

      if (sent) {
        setMessages(prev => [...prev, sent]);
        lastMsgIdRef.current = sent.id;
        // Update sidebar last message
        setCourses(prev => prev.map(item =>
          String(item.courseId) === String(cId)
            ? { ...item, lastMessage: toSend || (messageType === 'image' ? '📷 Photo' : '📄 Attachment') }
            : item
        ));
      }
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      alert(err?.response?.data?.error?.message || 'Failed to submit doubt. Please check your network.');
    } finally {
      setSending(false);
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert('Attachment file size must be less than 50MB.');
      return;
    }
    setSelectedFile(file);
    e.target.value = '';
  }

  const filteredCourses = courses.filter(c =>
    !search || (c.courseName || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className={`ot-community-wrap ot-dashboard-community-fullbleed ot-dashboard-community-hub ${mobileShowChat ? 'sc-chat-open' : ''}`}
      style={{
        height: '100vh',
        maxHeight: '100vh',
        minHeight: '100vh',
        width: '100%',
        margin: 0,
        padding: 0,
        borderRadius: 0,
        border: 'none',
        boxShadow: 'none',
        background: '#ffffff',
        flex: 1
      }}
    >
      {/* ──────────────────────────────────────────────────────────────────
          1. Left Sidebar: Channels / Courses List (WhatsApp Style)
          ────────────────────────────────────────────────────────────────── */}
      <div className="ot-community-sidebar" style={{ borderRadius: 0 }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '16px 18px 12px',
          borderBottom: '1px solid #f1f5f9',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Doubt Clearance</span>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#5A70D3',
                background: 'rgba(90, 112, 211, 0.1)',
                padding: '2px 8px',
                borderRadius: '9999px'
              }}>
                1-on-1
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
              {courses.length} courses
            </span>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              fontSize: '0.82rem'
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search course doubts…"
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                fontSize: '0.85rem',
                background: '#f8fafc',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                borderRadius: '9999px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Course Doubt Channels List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {loadingCourses && courses.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', color: '#5A70D3' }}>
              <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '22px' }} />
            </div>
          ) : (
            filteredCourses.map(c => {
              const isActive = String(selectedCourse?.courseId) === String(c.courseId);
              return (
                <button
                  key={c.courseId}
                  type="button"
                  className={`ot-community-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectCourse(c)}
                  style={{
                    borderRadius: '12px',
                    marginBottom: '3px',
                    borderLeft: isActive ? '3px solid #5A70D3' : '3px solid transparent'
                  }}
                >
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    flexShrink: 0,
                    overflow: 'hidden',
                    background: isActive ? '#5A70D3' : 'rgba(90, 112, 211, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isActive ? '#ffffff' : '#5A70D3',
                    fontSize: '18px'
                  }}>
                    {c.courseThumbnail
                      ? <img src={resolveMediaUrl(c.courseThumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <i className="fa-solid fa-circle-question" />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: isActive ? '#5A70D3' : '#0f172a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {c.courseName}
                    </div>
                    <div style={{
                      fontSize: '0.76rem',
                      color: '#64748b',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '2px'
                    }}>
                      {c.lastMessage || 'Private clearance with instructor'}
                    </div>
                  </div>

                  {c.unreadCount > 0 && (
                    <div style={{
                      minWidth: '20px',
                      height: '20px',
                      borderRadius: '9999px',
                      padding: '0 5px',
                      background: '#5A70D3',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {c.unreadCount > 99 ? '99+' : c.unreadCount}
                    </div>
                  )}
                </button>
              );
            })
          )}

          {!loadingCourses && filteredCourses.length === 0 && (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              No doubts match your search
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          2. Right Area: Conversation Pane (WhatsApp Style Chat Screen)
          ────────────────────────────────────────────────────────────────── */}
      <div className="ot-community-chat" style={{ borderRadius: 0 }}>
        {selectedCourse ? (
          <>
            {/* Top Navigation Bar */}
            <div style={{
              padding: '10px 16px',
              background: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              flexShrink: 0
            }}>
              {/* Mobile Back Button */}
              <button
                type="button"
                className="ot-whatsapp-back-btn"
                onClick={() => setMobileShowChat(false)}
                aria-label="Back to doubts"
                title="Back to all course doubts"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#0f172a',
                  fontSize: '1.2rem',
                  padding: '6px 8px 6px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <i className="fa-solid fa-arrow-left" />
              </button>

              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                overflow: 'hidden',
                background: 'rgba(90, 112, 211, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#5A70D3',
                fontSize: '18px',
                flexShrink: 0
              }}>
                {selectedCourse.courseThumbnail
                  ? <img src={resolveMediaUrl(selectedCourse.courseThumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <i className="fa-solid fa-circle-question" />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  margin: 0,
                  fontSize: '0.96rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {selectedCourse.courseName}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                  Private 1-on-1 with Course Instructors
                </span>
              </div>
            </div>

            {/* Messages Screen */}
            <div
              ref={messagesContainerRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {loadingMessages ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5A70D3' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '26px' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                  padding: '24px'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(90, 112, 211, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#5A70D3',
                    fontSize: '28px',
                    marginBottom: '14px'
                  }}>
                    <i className="fa-solid fa-circle-question" />
                  </div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    Ask Your First Doubt
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b', maxWidth: '340px', lineHeight: 1.5 }}>
                    Have a question on code, assignments, or lectures? Send a message or screenshot to receive 1-on-1 guidance from course tutors.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isStudent = msg.senderId === currentUser?.id;
                  const isSuperAdminTutor = (!msg.senderName || msg.senderName.toLowerCase().includes('super admin') || msg.senderRole === 'super_admin' || msg.senderRole === 'admin');
                  const tutorDisplayName = isSuperAdminTutor ? 'One Tutor' : (msg.senderName || 'Instructor');
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const showDate = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);

                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      {/* Date Separator Pill */}
                      {showDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '14px 0 10px' }}>
                          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                          <span style={{
                            padding: '3px 12px',
                            background: '#e2e8f0',
                            color: '#475569',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            borderRadius: '9999px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                          }}>
                            {formatDate(msg.createdAt)}
                          </span>
                          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                        </div>
                      )}

                      {/* WhatsApp Message Bubble */}
                      <div style={{
                        display: 'flex',
                        justifyContent: isStudent ? 'flex-end' : 'flex-start',
                        marginBottom: '6px'
                      }}>
                        {!isStudent && (
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#5A70D3',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 800,
                            marginRight: '8px',
                            marginTop: '2px',
                            flexShrink: 0,
                            overflow: 'hidden'
                          }}>
                            {msg.senderAvatar ? (
                              <img src={resolveMediaUrl(msg.senderAvatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              getInitials(tutorDisplayName)
                            )}
                          </div>
                        )}

                        <div className="cc-bubble-wrap" style={{ maxWidth: '68%', position: 'relative' }}>
                          {!isStudent && (
                            <div style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#5A70D3',
                              marginBottom: '2px',
                              paddingLeft: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span>{tutorDisplayName}</span>
                              <span style={{ fontSize: '9px', background: 'rgba(90, 112, 211, 0.12)', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                Tutor
                              </span>
                            </div>
                          )}

                          <div style={{
                            background: isStudent
                              ? 'linear-gradient(135deg, #5A70D3 0%, #4355B9 100%)'
                              : '#ffffff',
                            color: isStudent ? '#ffffff' : '#0f172a',
                            padding: msg.messageType === 'text' ? '9px 13px' : '6px',
                            borderRadius: isStudent ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            boxShadow: isStudent
                              ? '0 2px 8px rgba(90, 112, 211, 0.22)'
                              : '0 1px 3px rgba(15, 23, 42, 0.08)',
                            border: isStudent ? 'none' : '1px solid #e2e8f0',
                            position: 'relative'
                          }}>
                            {/* Text content */}
                            {msg.content && (
                              <p style={{
                                margin: 0,
                                fontSize: '0.88rem',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                              }}>
                                {msg.content}
                              </p>
                            )}

                            {/* Image attachment */}
                            {msg.messageType === 'image' && msg.mediaUrl && (
                              <div
                                onClick={() => setPreviewImage(resolveMediaUrl(msg.mediaUrl))}
                                style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}
                                title="Click to view full image"
                              >
                                <img
                                  src={resolveMediaUrl(msg.mediaUrl)}
                                  alt=""
                                  style={{ maxWidth: '240px', maxHeight: '180px', borderRadius: '10px', display: 'block', objectFit: 'cover' }}
                                />
                              </div>
                            )}

                            {/* Video attachment */}
                            {msg.messageType === 'video' && msg.mediaUrl && (
                              <video
                                src={resolveMediaUrl(msg.mediaUrl)}
                                controls
                                style={{ maxWidth: '260px', borderRadius: '10px', display: 'block' }}
                              />
                            )}

                            {/* Document / PDF attachment */}
                            {(msg.messageType === 'pdf' || msg.messageType === 'file') && msg.mediaUrl && (
                              <div
                                onClick={() => setPreviewDoc({ url: resolveMediaUrl(msg.mediaUrl), name: msg.mediaName || 'Document.pdf', size: msg.mediaSize })}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  color: isStudent ? '#ffffff' : '#0f172a',
                                  padding: '8px 6px',
                                  cursor: 'pointer'
                                }}
                                title="Click to preview or download file"
                              >
                                <i className="fa-solid fa-file-pdf" style={{ fontSize: '24px', color: isStudent ? '#ffffff' : '#ef4444' }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '12px', fontWeight: 700, maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {msg.mediaName || 'Document.pdf'}
                                  </div>
                                  {msg.mediaSize > 0 && (
                                    <div style={{ fontSize: '10px', opacity: 0.8 }}>
                                      {(msg.mediaSize / 1024 / 1024).toFixed(1)} MB
                                    </div>
                                  )}
                                </div>
                                <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '13px', opacity: 0.8 }} />
                              </div>
                            )}
                          </div>

                          {/* Timestamp */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            justifyContent: isStudent ? 'flex-end' : 'flex-start',
                            marginTop: '2px',
                            padding: '0 2px'
                          }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                              {formatTime(msg.createdAt)}
                            </span>
                            {isStudent && (
                              <i className="fa-solid fa-check-double" style={{ fontSize: '10px', color: '#5A70D3' }} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* File Upload Preview Banner */}
            {selectedFile && (
              <div style={{
                padding: '8px 16px',
                background: '#f1f5f9',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <i className="fa-solid fa-paperclip" style={{ color: '#5A70D3', fontSize: '14px' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedFile.name}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            )}

            {/* Bottom Input Bar */}
            <div style={{
              padding: '12px 16px',
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '10px',
              flexShrink: 0
            }}>
              {/* Paperclip file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploading}
                title="Attach image, video or PDF"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontSize: '15px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#5A70D3'; e.currentTarget.style.borderColor = '#5A70D3'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
              >
                <i className="fa-solid fa-paperclip" />
              </button>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => {
                  setText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask your instructor a doubt (Shift+Enter for new line)..."
                rows={1}
                disabled={sending || uploading}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  fontSize: '0.88rem',
                  borderRadius: '20px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#0f172a',
                  outline: 'none',
                  resize: 'none',
                  maxHeight: '120px',
                  fontFamily: 'inherit',
                  lineHeight: 1.4,
                  boxSizing: 'border-box'
                }}
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={(!text.trim() && !selectedFile) || sending || uploading}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  background: (!text.trim() && !selectedFile) || sending || uploading ? '#cbd5e1' : '#5A70D3',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: (!text.trim() && !selectedFile) || sending || uploading ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  fontSize: '15px',
                  boxShadow: (!text.trim() && !selectedFile) ? 'none' : '0 2px 8px rgba(90, 112, 211, 0.35)',
                  transition: 'all 0.15s ease'
                }}
              >
                {sending || uploading ? (
                  <i className="fa-solid fa-spinner fa-spin" />
                ) : (
                  <i className="fa-solid fa-paper-plane" />
                )}
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            Select a course to view doubts
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <ImageLightboxModal
          url={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* PDF / Document Preview Modal */}
      {previewDoc && (
        <PdfPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
