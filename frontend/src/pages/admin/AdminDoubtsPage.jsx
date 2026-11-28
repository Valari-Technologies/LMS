import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import {
  getAllDoubtThreads,
  getDoubtStats,
  getStudentThreadMessages,
  pollStudentThreadMessages,
  sendTutorDoubtReply,
  markTutorThreadRead,
  uploadCommunityMedia
} from '../../api/community';
import { listAdminCourses } from '../../api/courses';
import { resolveMediaUrl } from '../../utils/mediaUtils';

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
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
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

// ─────────────────────────────────────────────────────────────────────────────
// PDF Preview Modal (Matches AdminCommunityPage)
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
          background: 'var(--bg-surface, #1e293b)',
          borderRadius: '16px', border: '1px solid var(--border-default)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', position: 'relative',
        }}
      >
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
              onClick={() => downloadMedia(blobUrl || doc.url, doc.name || 'document.pdf')}
              style={{
                background: 'var(--accent-gradient, linear-gradient(135deg, #5A70D3, #4355B9))',
                border: 'none', color: '#fff',
                borderRadius: '8px', padding: '8px 18px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '13px', fontWeight: 600,
                boxShadow: '0 2px 8px rgba(90, 112, 211, 0.3)',
                transition: 'opacity 0.2s',
              }}
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

        <div style={{ flex: 1, position: 'relative', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#fff' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: 'var(--accent-primary)' }} />
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
                  background: 'var(--accent-primary)', color: '#fff', border: 'none',
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
// Lightbox Image Preview Modal (Matches AdminCommunityPage)
// ─────────────────────────────────────────────────────────────────────────────
function ImageLightboxModal({ image, onClose }) {
  if (!image) return null;
  return (
    <div
      onClick={onClose}
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
          <i className="fa-solid fa-image" style={{ color: 'var(--accent-primary, #5A70D3)', fontSize: '18px' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {image.name || 'Image'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => downloadMedia(image.url, image.name || 'image.jpg')}
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
            onClick={onClose}
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
          src={image.url}
          alt={image.name || 'Image'}
          style={{
            maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain',
            borderRadius: '8px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ADMIN DOUBTS PAGE (Matches AdminCommunityPage Exact Layout & Design)
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDoubtsPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [highlightedCourseIdx, setHighlightedCourseIdx] = useState(0);
  const courseDropdownRef = useRef(null);
  const courseItemRefs = useRef([]);
  const [stats, setStats] = useState({ totalDoubtsAsked: 0, totalDoubtsReplied: 0, pendingDoubts: 0 });
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'waiting' | 'answered'
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
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

  // Load courses list and doubt KPI stats
  useEffect(() => {
    async function loadMeta() {
      try {
        const [courseRes, statsRes] = await Promise.allSettled([
          listAdminCourses({ size: 100 }),
          getDoubtStats()
        ]);
        if (courseRes.status === 'fulfilled') {
          const cList = courseRes.value?.content || (Array.isArray(courseRes.value) ? courseRes.value : []);
          setCourses(cList);
        }
        if (statsRes.status === 'fulfilled' && statsRes.value) {
          setStats(statsRes.value);
        }
      } catch (err) {
        console.error('Failed to load courses or doubt stats:', err);
      }
    }
    loadMeta();
  }, []);

  // Close course dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(e.target)) {
        setCourseDropdownOpen(false);
      }
    }
    if (courseDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [courseDropdownOpen]);

  // Sync highlighted course dropdown option when opened
  useEffect(() => {
    if (courseDropdownOpen) {
      const idx = selectedCourseId
        ? courses.findIndex(c => String(c.id) === String(selectedCourseId)) + 1
        : 0;
      setHighlightedCourseIdx(idx >= 0 ? idx : 0);
    }
  }, [courseDropdownOpen, selectedCourseId, courses]);

  // Auto-scroll highlighted option into view in dropdown
  useEffect(() => {
    if (courseDropdownOpen && courseItemRefs.current[highlightedCourseIdx]) {
      courseItemRefs.current[highlightedCourseIdx].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [highlightedCourseIdx, courseDropdownOpen]);

  const totalCourseOptions = courses.length + 1;

  function handleCourseDropdownKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!courseDropdownOpen) {
        setCourseDropdownOpen(true);
      } else {
        setHighlightedCourseIdx(prev => (prev + 1 < totalCourseOptions ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!courseDropdownOpen) {
        setCourseDropdownOpen(true);
      } else {
        setHighlightedCourseIdx(prev => (prev - 1 >= 0 ? prev - 1 : totalCourseOptions - 1));
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!courseDropdownOpen) {
        setCourseDropdownOpen(true);
      } else {
        if (highlightedCourseIdx === 0) {
          setSelectedCourseId('');
        } else if (courses[highlightedCourseIdx - 1]) {
          setSelectedCourseId(courses[highlightedCourseIdx - 1].id);
        }
        setCourseDropdownOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setCourseDropdownOpen(false);
    }
  }

  // Load doubt threads whenever course filter changes
  useEffect(() => {
    let mounted = true;
    setLoadingThreads(true);

    async function loadThreads() {
      try {
        const cId = selectedCourseId ? Number(selectedCourseId) : null;
        const list = await getAllDoubtThreads(cId);
        if (!mounted) return;
        const valid = Array.isArray(list) ? list : [];
        setThreads(valid);

        if (valid.length > 0) {
          const stillThere = valid.find(t =>
            selectedThread &&
            t.studentId === selectedThread.studentId &&
            t.courseId === selectedThread.courseId
          );
          if (stillThere) {
            setSelectedThread(stillThere);
          } else {
            setSelectedThread(valid[0]);
          }
        } else {
          setSelectedThread(null);
        }
      } catch (err) {
        console.error('Failed to load doubt threads:', err);
        if (mounted) setThreads([]);
      } finally {
        if (mounted) setLoadingThreads(false);
      }
    }

    loadThreads();
    return () => { mounted = false; };
  }, [selectedCourseId]);

  // Load conversation messages whenever selectedThread changes
  useEffect(() => {
    if (!selectedThread) {
      setMessages([]);
      return;
    }

    let mounted = true;
    const { courseId, studentId } = selectedThread;
    setLoadingMessages(true);
    setMessages([]);
    lastMsgIdRef.current = 0;

    async function loadMessages() {
      try {
        const data = await getStudentThreadMessages(courseId, studentId, { page: 0, size: 50 });
        if (!mounted) return;
        const list = data?.content || [];
        setMessages(list);
        if (list.length > 0) {
          lastMsgIdRef.current = list[list.length - 1].id;
        }

        markTutorThreadRead(courseId, studentId).catch(() => {});
        setThreads(prev => prev.map(t =>
          t.studentId === studentId && t.courseId === courseId
            ? { ...t, unreadCount: 0 }
            : t
        ));
      } catch (err) {
        console.error('Failed to load thread messages:', err);
      } finally {
        if (mounted) setLoadingMessages(false);
      }
    }

    loadMessages();

    // Live polling for student's new doubts
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const fresh = await pollStudentThreadMessages(courseId, studentId, lastMsgIdRef.current);
        if (Array.isArray(fresh) && fresh.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = fresh.filter(m => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            const combined = [...prev, ...newMsgs];
            lastMsgIdRef.current = combined[combined.length - 1].id;
            markTutorThreadRead(courseId, studentId, lastMsgIdRef.current).catch(() => {});
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
  }, [selectedThread?.courseId, selectedThread?.studentId]);

  // Auto-scroll messages container to bottom
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, loadingMessages]);

  function handleSelectThread(t) {
    setSelectedThread(t);
  }

  async function handleSendReply() {
    const toSend = replyText.trim();
    if (!toSend && !selectedFile) return;
    if (sendingReply || uploading) return;
    if (!selectedThread) return;

    setSendingReply(true);
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

      const sent = await sendTutorDoubtReply(selectedThread.courseId, selectedThread.studentId, {
        content: toSend || null,
        messageType,
        mediaAssetId
      });

      if (sent) {
        setMessages(prev => [...prev, sent]);
        lastMsgIdRef.current = sent.id;
        setThreads(prev => prev.map(t =>
          t.studentId === selectedThread.studentId && t.courseId === selectedThread.courseId
            ? {
                ...t,
                status: 'answered',
                lastMessage: toSend || (messageType === 'image' ? '📷 Photo' : '📄 Attachment'),
                lastMessageTime: new Date().toISOString()
              }
            : t
        ));
        setStats(prev => ({
          ...prev,
          totalDoubtsReplied: prev.totalDoubtsReplied + 1,
          pendingDoubts: Math.max(0, prev.pendingDoubts - 1)
        }));
      }
      setReplyText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      alert(err?.response?.data?.error?.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
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

  const filteredThreads = threads.filter(t => {
    const matchesSearch = !search ||
      t.studentName?.toLowerCase().includes(search.toLowerCase()) ||
      t.studentEmail?.toLowerCase().includes(search.toLowerCase()) ||
      t.courseName?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'waiting') return t.status === 'waiting_for_tutor';
    if (filter === 'answered') return t.status === 'answered';
    return true;
  });

  const waitingCount = threads.filter(t => t.status === 'waiting_for_tutor').length;

  // Group messages for WhatsApp date separators
  const groupedMessages = messages.reduce((acc, msg, idx) => {
    const prev = messages[idx - 1];
    if (!prev || !isSameDay(prev.createdAt, msg.createdAt)) {
      acc.push({ type: 'separator', date: msg.createdAt });
    }
    acc.push({ type: 'message', msg });
    return acc;
  }, []);

  if (loadingThreads && threads.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '28px', color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', overflow: 'hidden', background: 'var(--bg-page)' }}>
      {/* ──────────────────────────────────────────────────────────────────
          1. Left Sidebar: Channels / Threads List (Exact Community Style)
          ────────────────────────────────────────────────────────────────── */}
      <div style={{
        width: '300px', flexShrink: 0, borderRight: '1px solid var(--border-default)',
        background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Sidebar Header */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-circle-question" style={{ color: 'var(--accent-primary, #5A70D3)' }} />
              Doubt Clearance
            </h2>
            <span style={{
              fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
              background: waitingCount > 0 ? 'rgba(217, 119, 6, 0.15)' : 'rgba(22, 163, 74, 0.15)',
              color: waitingCount > 0 ? '#b45309' : '#15803d'
            }}>
              {waitingCount > 0 ? `${waitingCount} waiting` : 'All cleared'}
            </span>
          </div>

          <p style={{ margin: '0 0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
            {threads.length} thread{threads.length !== 1 ? 's' : ''} • {stats.totalDoubtsAsked || 0} asked • {stats.totalDoubtsReplied || 0} answered
          </p>

          {/* Course filter custom dropdown (Constrained to sidebar width with keyboard navigation) */}
          <div ref={courseDropdownRef} style={{ position: 'relative', marginBottom: '8px', width: '100%' }}>
            <button
              type="button"
              onClick={() => setCourseDropdownOpen(!courseDropdownOpen)}
              onKeyDown={handleCourseDropdownKeyDown}
              tabIndex={0}
              aria-haspopup="listbox"
              aria-expanded={courseDropdownOpen}
              style={{
                width: '100%',
                padding: '7px 10px',
                fontSize: '12px',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                textAlign: 'left'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {selectedCourseId
                  ? (courses.find(c => String(c.id) === String(selectedCourseId))?.name ||
                     courses.find(c => String(c.id) === String(selectedCourseId))?.title ||
                     'Selected Course')
                  : `All Courses (${courses.length})`}
              </span>
              <i
                className="fa-solid fa-chevron-down"
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  transition: 'transform 0.2s ease',
                  transform: courseDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  flexShrink: 0
                }}
              />
            </button>

            {courseDropdownOpen && (
              <div
                role="listbox"
                tabIndex={-1}
                onKeyDown={handleCourseDropdownKeyDown}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  width: '100%',
                  maxWidth: '100%',
                  background: 'var(--bg-surface, #ffffff)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
                  zIndex: 9999,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  boxSizing: 'border-box'
                }}
              >
                {/* 0. All Courses */}
                <div
                  ref={el => courseItemRefs.current[0] = el}
                  role="option"
                  aria-selected={!selectedCourseId}
                  onClick={() => {
                    setSelectedCourseId('');
                    setCourseDropdownOpen(false);
                  }}
                  onMouseEnter={() => setHighlightedCourseIdx(0)}
                  title={`All Courses (${courses.length})`}
                  style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: !selectedCourseId || highlightedCourseIdx === 0 ? 700 : 500,
                    color: !selectedCourseId || highlightedCourseIdx === 0 ? 'var(--accent-primary, #5A70D3)' : 'var(--text-primary)',
                    background: highlightedCourseIdx === 0
                      ? 'var(--accent-subtle, rgba(90, 112, 211, 0.14))'
                      : (!selectedCourseId ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : 'transparent'),
                    borderLeft: highlightedCourseIdx === 0 ? '3px solid var(--accent-primary, #5A70D3)' : '3px solid transparent',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.12s ease'
                  }}
                >
                  All Courses ({courses.length})
                </div>

                {/* 1..N. Courses List */}
                {courses.map((c, idx) => {
                  const optionIdx = idx + 1;
                  const isCur = String(c.id) === String(selectedCourseId);
                  const isHighlighted = highlightedCourseIdx === optionIdx;
                  const courseTitle = c.name || c.title || `Course #${c.id}`;
                  return (
                    <div
                      key={c.id}
                      ref={el => courseItemRefs.current[optionIdx] = el}
                      role="option"
                      aria-selected={isCur}
                      onClick={() => {
                        setSelectedCourseId(c.id);
                        setCourseDropdownOpen(false);
                      }}
                      onMouseEnter={() => setHighlightedCourseIdx(optionIdx)}
                      title={courseTitle}
                      style={{
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: isCur || isHighlighted ? 700 : 500,
                        color: isCur || isHighlighted ? 'var(--accent-primary, #5A70D3)' : 'var(--text-primary)',
                        background: isHighlighted
                          ? 'var(--accent-subtle, rgba(90, 112, 211, 0.14))'
                          : (isCur ? 'var(--accent-subtle, rgba(90, 112, 211, 0.08))' : 'transparent'),
                        borderLeft: isHighlighted ? '3px solid var(--accent-primary, #5A70D3)' : '3px solid transparent',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.12s ease'
                      }}
                    >
                      {courseTitle}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{
              position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', fontSize: '12px'
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search student or course…"
              style={{
                width: '100%', padding: '8px 10px 8px 30px', fontSize: '13px',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border-default)', borderRadius: '8px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filter Tabs: All / Waiting / Answered */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                flex: 1, padding: '5px 4px', fontSize: '11px', fontWeight: 600, borderRadius: '6px',
                border: 'none', cursor: 'pointer',
                background: filter === 'all' ? 'var(--accent-primary, #5A70D3)' : 'var(--bg-elevated)',
                color: filter === 'all' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s ease'
              }}
            >
              All ({threads.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('waiting')}
              style={{
                flex: 1, padding: '5px 4px', fontSize: '11px', fontWeight: 600, borderRadius: '6px',
                border: 'none', cursor: 'pointer',
                background: filter === 'waiting' ? '#d97706' : 'rgba(217, 119, 6, 0.1)',
                color: filter === 'waiting' ? '#fff' : '#b45309',
                transition: 'all 0.15s ease'
              }}
            >
              Waiting ({waitingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('answered')}
              style={{
                flex: 1, padding: '5px 4px', fontSize: '11px', fontWeight: 600, borderRadius: '6px',
                border: 'none', cursor: 'pointer',
                background: filter === 'answered' ? '#16a34a' : 'rgba(22, 163, 74, 0.1)',
                color: filter === 'answered' ? '#fff' : '#16a34a',
                transition: 'all 0.15s ease'
              }}
            >
              Answered
            </button>
          </div>
        </div>

        {/* Threads List */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {filteredThreads.map(t => {
            const isSelected = selectedThread &&
              selectedThread.studentId === t.studentId &&
              selectedThread.courseId === t.courseId;
            const isWaiting = t.status === 'waiting_for_tutor';

            return (
              <button
                key={`${t.courseId}-${t.studentId}`}
                type="button"
                onClick={() => handleSelectThread(t)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px', background: isSelected ? 'var(--accent-subtle)' : 'none',
                  border: 'none', borderLeft: isSelected ? '3px solid var(--accent-primary, #5A70D3)' : '3px solid transparent',
                  cursor: 'pointer', textAlign: 'left', transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'none'; }}
              >
                {/* Thumbnail / Avatar */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0, overflow: 'hidden',
                  background: isSelected ? 'var(--accent-gradient, linear-gradient(135deg, #5A70D3, #4355B9))' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '14px', fontWeight: 700
                }}>
                  {t.studentAvatar
                    ? <img src={resolveMediaUrl(t.studentAvatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : getInitials(t.studentName)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: 600, color: isSelected ? 'var(--accent-primary, #5A70D3)' : 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.studentName}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, flexShrink: 0 }}>
                      {formatTime(t.lastMessageTime)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '11px', color: 'var(--accent-primary, #5A70D3)', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px'
                  }}>
                    {t.courseName}
                  </div>
                  <div style={{
                    fontSize: '11px', color: 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px',
                  }}>
                    {t.lastMessage || 'No messages yet'}
                  </div>
                </div>

                {/* Status or unread badge */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                    background: isWaiting ? 'rgba(217, 119, 6, 0.15)' : 'rgba(22, 163, 74, 0.15)',
                    color: isWaiting ? '#b45309' : '#15803d'
                  }}>
                    {isWaiting ? 'Waiting' : 'Replied'}
                  </span>
                  {t.unreadCount > 0 && (
                    <div style={{
                      minWidth: '20px', height: '20px', borderRadius: '10px', padding: '0 5px',
                      background: '#22c55e', color: '#fff', fontSize: '10px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      boxShadow: '0 2px 4px rgba(34,197,94,0.3)',
                    }}>
                      {t.unreadCount > 99 ? '99+' : t.unreadCount}
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {filteredThreads.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No doubt threads found
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          2. Right Chat Area: WhatsApp Screen (Matches AdminCommunityPage)
          ────────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedThread ? (
          <>
            {/* WhatsApp Header */}
            <div style={{
              padding: '12px 20px', background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', gap: '12px',
              boxShadow: 'var(--shadow-sm)', flexShrink: 0,
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0, overflow: 'hidden',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '15px', fontWeight: 700
              }}>
                {selectedThread.studentAvatar
                  ? <img src={resolveMediaUrl(selectedThread.studentAvatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : getInitials(selectedThread.studentName)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedThread.studentName}
                  </h3>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                    background: 'var(--accent-subtle)', color: 'var(--accent-primary, #5A70D3)'
                  }}>
                    Student
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                  {selectedThread.studentEmail} • <span style={{ color: 'var(--accent-primary, #5A70D3)', fontWeight: 600 }}>{selectedThread.courseName}</span>
                </div>
              </div>

              <div style={{
                padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                background: selectedThread.status === 'waiting_for_tutor' ? 'rgba(217, 119, 6, 0.15)' : 'rgba(22, 163, 74, 0.15)',
                color: selectedThread.status === 'waiting_for_tutor' ? '#b45309' : '#15803d'
              }}>
                {selectedThread.status === 'waiting_for_tutor' ? '⏳ Waiting for your reply' : '✓ Answered'}
              </div>
            </div>

            {/* Messages Stream */}
            <div ref={messagesContainerRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '2px', background: 'var(--bg-page)' }}>
              {loadingMessages && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', color: 'var(--accent-primary)' }} />
                </div>
              )}

              {!loadingMessages && messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px', gap: '12px' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: 'var(--accent-primary)' }}>
                    <i className="fa-solid fa-comments" />
                  </div>
                  <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px' }}>No messages in this doubt thread yet.</p>
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
                const msg = item.msg;
                const isOwn = msg.senderId === user?.id || (msg.senderRole && msg.senderRole !== 'student');

                return (
                  <div key={msg.id} style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-end',
                    flexDirection: isOwn ? 'row-reverse' : 'row', marginBottom: '4px'
                  }}>
                    {!isOwn && (
                      <div style={{
                        width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, #5A70D3 0%, #4355B9 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 700, color: '#fff', overflow: 'hidden'
                      }}>
                        {msg.senderAvatar
                          ? <img src={resolveMediaUrl(msg.senderAvatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : getInitials(msg.senderName || selectedThread.studentName)}
                      </div>
                    )}

                    <div className="cc-bubble-wrap" style={{ maxWidth: '65%', position: 'relative' }}>
                      {!isOwn && (
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px', paddingLeft: '2px' }}>
                          {msg.senderName || selectedThread.studentName}
                        </div>
                      )}

                      <div style={{
                        background: isOwn ? 'linear-gradient(135deg, #5A70D3 0%, #4355B9 100%)' : 'var(--bg-elevated)',
                        color: isOwn ? '#fff' : 'var(--text-primary)',
                        padding: msg.messageType === 'text' ? '10px 14px' : '8px',
                        borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        boxShadow: isOwn ? '0 2px 8px rgba(90, 112, 211, 0.22)' : 'var(--shadow-sm)',
                        border: isOwn ? 'none' : '1px solid var(--border-default)',
                        position: 'relative'
                      }}>
                        {/* Text */}
                        {msg.content && (
                          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {msg.content}
                          </p>
                        )}

                        {/* Image */}
                        {msg.messageType === 'image' && msg.mediaUrl && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage({ url: resolveMediaUrl(msg.mediaUrl), name: msg.mediaName || 'doubt_attachment.jpg' });
                            }}
                            style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}
                            title="Click to view image"
                          >
                            <img
                              src={resolveMediaUrl(msg.mediaUrl)}
                              alt={msg.mediaName || 'Image'}
                              style={{ maxWidth: '240px', maxHeight: '180px', borderRadius: '10px', display: 'block', objectFit: 'cover' }}
                            />
                          </div>
                        )}

                        {/* Video */}
                        {msg.messageType === 'video' && msg.mediaUrl && (
                          <video src={resolveMediaUrl(msg.mediaUrl)} controls style={{ maxWidth: '260px', borderRadius: '10px', display: 'block' }} />
                        )}

                        {/* PDF / File */}
                        {(msg.messageType === 'pdf' || msg.messageType === 'file') && msg.mediaUrl && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewDoc({ url: resolveMediaUrl(msg.mediaUrl), name: msg.mediaName || 'Document.pdf', size: msg.mediaSize });
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              color: isOwn ? '#fff' : 'var(--text-primary)', padding: '8px 4px', cursor: 'pointer'
                            }}
                            title="Click to open document"
                          >
                            <i className="fa-solid fa-file-pdf" style={{ fontSize: '24px', opacity: 0.9, color: isOwn ? '#fff' : '#ef4444' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {msg.mediaName || 'Document.pdf'}
                              </div>
                              {msg.mediaSize > 0 && (
                                <div style={{ fontSize: '11px', opacity: 0.7 }}>{(msg.mediaSize / 1024 / 1024).toFixed(1)} MB</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Timestamp & checks row below bubble (matches Community Chat) */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        marginTop: '3px', paddingLeft: '2px', paddingRight: '2px'
                      }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {formatTime(msg.createdAt)}
                        </span>
                        {isOwn && (
                          <i className="fa-solid fa-check-double" style={{ fontSize: '10px', color: 'var(--accent-primary, #5A70D3)' }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div style={{ padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-default)', flexShrink: 0 }}>
              {selectedFile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: '8px', marginBottom: '8px' }}>
                  <i className="fa-solid fa-paperclip" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              )}

              {uploading && (
                <div style={{ padding: '4px 0 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    <span>Uploading attachment…</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div style={{ height: '3px', borderRadius: '3px', background: 'var(--border-default)' }}>
                    <div style={{ height: '100%', borderRadius: '3px', background: 'var(--accent-gradient, #5A70D3)', width: `${uploadProgress}%`, transition: 'width 0.2s' }} />
                  </div>
                </div>
              )}

              <form onSubmit={e => { e.preventDefault(); handleSendReply(); }} style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  accept="image/*,video/*,application/pdf,.doc,.docx"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file (image, video, PDF)"
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: 'none', border: '1px solid var(--border-default)',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}
                >
                  <i className="fa-solid fa-paperclip" />
                </button>

                <textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Reply to ${selectedThread.studentName}'s doubt…`}
                  rows={1}
                  style={{
                    flex: 1, padding: '9px 12px', fontSize: '13px', resize: 'none', lineHeight: 1.5,
                    background: 'var(--bg-input)', color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)', borderRadius: '20px', outline: 'none',
                    fontFamily: 'inherit', maxHeight: '100px', overflowY: 'auto'
                  }}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
                />

                <button
                  type="submit"
                  disabled={uploading || (!replyText.trim() && !selectedFile)}
                  title="Send reply"
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                    background: (uploading || (!replyText.trim() && !selectedFile)) ? 'var(--border-default)' : 'var(--accent-gradient, linear-gradient(135deg, #5A70D3, #4355B9))',
                    color: '#fff', cursor: (uploading || (!replyText.trim() && !selectedFile)) ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <i className="fa-solid fa-paper-plane" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '14px', color: 'var(--text-muted)' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: 'var(--accent-primary, #5A70D3)' }}>
              <i className="fa-solid fa-circle-question" />
            </div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700 }}>
              Select a Doubt Thread
            </h3>
            <p style={{ margin: 0, fontSize: '13px', maxWidth: '320px', lineHeight: 1.5 }}>
              Choose a student doubt thread from the list on the left to view question history and reply.
            </p>
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <ImageLightboxModal
          image={previewImage}
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
