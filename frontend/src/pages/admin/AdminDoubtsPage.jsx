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
// Lightbox Modal for Image Previews
// ─────────────────────────────────────────────────────────────────────────────
function ImageLightboxModal({ url, filename, onClose }) {
  if (!url) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '10px', zIndex: 100000 }}>
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
// MAIN ADMIN DOUBTS PAGE (WhatsApp Exact Layout & Styling)
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDoubtsPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
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
          // If previous selection exists in new list, maintain it; otherwise select first
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

  return (
    <div className="page" style={{ paddingBottom: '24px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div className="page-title-wrap">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-circle-question" style={{ color: '#5A70D3' }} />
            <span>Doubt Clearance Desk</span>
          </h1>
          <p className="page-subtitle">
            Private 1-on-1 clearance space: answer student doubts and provide academic guidance.
          </p>
        </div>

        {/* Quick KPI stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'rgba(90, 112, 211, 0.1)',
            color: '#5A70D3',
            fontSize: '0.84rem',
            fontWeight: 700
          }}>
            <i className="fa-solid fa-circle-question" />
            <span>{stats.totalDoubtsAsked} Doubts Asked</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: waitingCount > 0 ? 'rgba(217, 119, 6, 0.12)' : 'rgba(22, 163, 74, 0.1)',
            color: waitingCount > 0 ? '#b45309' : '#16a34a',
            fontSize: '0.84rem',
            fontWeight: 700
          }}>
            <i className={`fa-solid ${waitingCount > 0 ? 'fa-clock' : 'fa-check-circle'}`} />
            <span>{waitingCount > 0 ? `${waitingCount} Waiting for Reply` : 'All Cleared'}</span>
          </div>
        </div>
      </div>

      {/* Main WhatsApp-Style Split Card */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          height: 'calc(100vh - 170px)',
          minHeight: '620px',
          display: 'flex',
          border: '1px solid var(--border-default)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}
      >
        {/* ──────────────────────────────────────────────────────────────────
            1. Left Sidebar: Doubt Threads (WhatsApp Chats List)
            ────────────────────────────────────────────────────────────────── */}
        <div style={{
          width: '320px',
          borderRight: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          background: 'var(--bg-surface)'
        }}>
          {/* Header Controls */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Course Filter Dropdown */}
            <select
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '0.84rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">All Courses ({courses.length})</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || c.title}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-magnifying-glass" style={{
                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)', fontSize: '0.8rem'
              }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search student or course…"
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  borderRadius: '20px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setFilter('all')}
                style={{
                  flex: 1,
                  padding: '5px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filter === 'all' ? '#5A70D3' : 'var(--bg-elevated)',
                  color: filter === 'all' ? '#ffffff' : 'var(--text-muted)'
                }}
              >
                All ({threads.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('waiting')}
                style={{
                  flex: 1,
                  padding: '5px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filter === 'waiting' ? '#d97706' : 'rgba(217, 119, 6, 0.1)',
                  color: filter === 'waiting' ? '#ffffff' : '#b45309'
                }}
              >
                Waiting ({waitingCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('answered')}
                style={{
                  flex: 1,
                  padding: '5px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filter === 'answered' ? '#15803d' : 'rgba(21, 128, 61, 0.1)',
                  color: filter === 'answered' ? '#ffffff' : '#15803d'
                }}
              >
                Answered
              </button>
            </div>
          </div>

          {/* Threads List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingThreads ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#5A70D3' }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px' }} />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No doubts match your search
              </div>
            ) : (
              filteredThreads.map(t => {
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
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 14px',
                      background: isSelected ? 'rgba(90, 112, 211, 0.08)' : 'none',
                      border: 'none',
                      borderLeft: isSelected ? '3px solid #5A70D3' : '3px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'none'; }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: '#5A70D3',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 800,
                      flexShrink: 0,
                      overflow: 'hidden'
                    }}>
                      {t.studentAvatar ? (
                        <img src={resolveMediaUrl(t.studentAvatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        getInitials(t.studentName)
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          color: isSelected ? '#5A70D3' : 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {t.studentName}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {formatTime(t.lastMessageTime)}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.74rem', color: '#5A70D3', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                        {t.courseName}
                      </div>

                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {t.lastMessage || 'No messages'}
                      </div>
                    </div>

                    {/* Status badge / unread */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isWaiting ? 'rgba(217, 119, 6, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                        color: isWaiting ? '#b45309' : '#15803d'
                      }}>
                        {isWaiting ? 'Waiting' : 'Answered'}
                      </span>

                      {t.unreadCount > 0 && (
                        <div style={{
                          minWidth: '18px',
                          height: '18px',
                          borderRadius: '9999px',
                          padding: '0 4px',
                          background: '#5A70D3',
                          color: '#ffffff',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {t.unreadCount > 99 ? '99+' : t.unreadCount}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────
            2. Right Area: Conversation Pane (WhatsApp Style Chat Screen)
            ────────────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedThread ? (
            <>
              {/* WhatsApp Header */}
              <div style={{
                padding: '12px 20px',
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: 'var(--shadow-sm)',
                flexShrink: 0
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#5A70D3',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 800,
                  flexShrink: 0,
                  overflow: 'hidden'
                }}>
                  {selectedThread.studentAvatar ? (
                    <img src={resolveMediaUrl(selectedThread.studentAvatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    getInitials(selectedThread.studentName)
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {selectedThread.studentName}
                    </h3>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'rgba(90, 112, 211, 0.1)',
                      color: '#5A70D3'
                    }}>
                      Student
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {selectedThread.studentEmail} • <strong style={{ color: '#5A70D3' }}>{selectedThread.courseName}</strong>
                  </div>
                </div>

                <div style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  background: selectedThread.status === 'waiting_for_tutor' ? 'rgba(217, 119, 6, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                  color: selectedThread.status === 'waiting_for_tutor' ? '#b45309' : '#15803d'
                }}>
                  {selectedThread.status === 'waiting_for_tutor' ? 'Waiting for your reply' : 'Answered'}
                </div>
              </div>

              {/* Chat Messages Container */}
              <div
                ref={messagesContainerRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px 20px',
                  background: 'var(--bg-elevated)',
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
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No messages in this thread
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isTutor = msg.senderId === user?.id || (msg.senderRole && msg.senderRole !== 'student');
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const showDate = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);

                    return (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Date Group Pill */}
                        {showDate && (
                          <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
                            <span style={{
                              padding: '3px 12px',
                              background: 'var(--border-default)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              borderRadius: '9999px'
                            }}>
                              {formatDate(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        {/* WhatsApp Message Bubble */}
                        <div style={{
                          display: 'flex',
                          justifyContent: isTutor ? 'flex-end' : 'flex-start',
                          marginBottom: '6px'
                        }}>
                          {!isTutor && (
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
                                getInitials(msg.senderName || selectedThread.studentName)
                              )}
                            </div>
                          )}

                          <div className="cc-bubble-wrap" style={{ maxWidth: '68%', position: 'relative' }}>
                            {!isTutor && (
                              <div style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--text-secondary)',
                                marginBottom: '2px',
                                paddingLeft: '2px'
                              }}>
                                {msg.senderName || selectedThread.studentName}
                              </div>
                            )}

                            <div style={{
                              background: isTutor
                                ? 'linear-gradient(135deg, #5A70D3 0%, #4355B9 100%)'
                                : 'var(--bg-surface)',
                              color: isTutor ? '#ffffff' : 'var(--text-primary)',
                              padding: msg.messageType === 'text' ? '9px 13px' : '6px',
                              borderRadius: isTutor ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              boxShadow: isTutor
                                ? '0 2px 8px rgba(90, 112, 211, 0.22)'
                                : 'var(--shadow-sm)',
                              border: isTutor ? 'none' : '1px solid var(--border-default)',
                              position: 'relative'
                            }}>
                              {/* Text message */}
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

                              {/* Image message */}
                              {msg.messageType === 'image' && msg.mediaUrl && (
                                <div
                                  onClick={() => setPreviewImage(resolveMediaUrl(msg.mediaUrl))}
                                  style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}
                                  title="Click to view image"
                                >
                                  <img
                                    src={resolveMediaUrl(msg.mediaUrl)}
                                    alt=""
                                    style={{ maxWidth: '240px', maxHeight: '180px', borderRadius: '10px', display: 'block', objectFit: 'cover' }}
                                  />
                                </div>
                              )}

                              {/* Video message */}
                              {msg.messageType === 'video' && msg.mediaUrl && (
                                <video
                                  src={resolveMediaUrl(msg.mediaUrl)}
                                  controls
                                  style={{ maxWidth: '260px', borderRadius: '10px', display: 'block' }}
                                />
                              )}

                              {/* PDF / Document message */}
                              {(msg.messageType === 'pdf' || msg.messageType === 'file') && msg.mediaUrl && (
                                <div
                                  onClick={() => downloadMedia(resolveMediaUrl(msg.mediaUrl), msg.mediaName || 'attachment.pdf')}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    color: isTutor ? '#ffffff' : 'var(--text-primary)',
                                    padding: '8px 6px',
                                    cursor: 'pointer'
                                  }}
                                  title="Click to download file"
                                >
                                  <i className="fa-solid fa-file-pdf" style={{ fontSize: '24px', color: isTutor ? '#ffffff' : '#ef4444' }} />
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
                                  <i className="fa-solid fa-download" style={{ fontSize: '13px', opacity: 0.8 }} />
                                </div>
                              )}
                            </div>

                            {/* Timestamp */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              justifyContent: isTutor ? 'flex-end' : 'flex-start',
                              marginTop: '2px',
                              padding: '0 2px'
                            }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {formatTime(msg.createdAt)}
                              </span>
                              {isTutor && (
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
                  background: 'var(--bg-surface)',
                  borderTop: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <i className="fa-solid fa-paperclip" style={{ color: '#5A70D3', fontSize: '14px' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedFile.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
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
                background: 'var(--bg-surface)',
                borderTop: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'flex-end',
                gap: '10px',
                flexShrink: 0
              }}>
                {/* Paperclip attachment */}
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
                  disabled={sendingReply || uploading}
                  title="Attach file"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    fontSize: '15px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#5A70D3'; e.currentTarget.style.borderColor = '#5A70D3'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                >
                  <i className="fa-solid fa-paperclip" />
                </button>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={e => {
                    setReplyText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={`Reply to ${selectedThread.studentName}'s doubt (Shift+Enter for new line)...`}
                  rows={1}
                  disabled={sendingReply || uploading}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    fontSize: '0.88rem',
                    borderRadius: '20px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
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
                  onClick={() => handleSendReply()}
                  disabled={(!replyText.trim() && !selectedFile) || sendingReply || uploading}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: 'none',
                    background: (!replyText.trim() && !selectedFile) || sendingReply || uploading ? 'var(--border-default)' : '#5A70D3',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: (!replyText.trim() && !selectedFile) || sendingReply || uploading ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    fontSize: '15px',
                    boxShadow: (!replyText.trim() && !selectedFile) ? 'none' : '0 2px 8px rgba(90, 112, 211, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {sendingReply || uploading ? (
                    <i className="fa-solid fa-spinner fa-spin" />
                  ) : (
                    <i className="fa-solid fa-paper-plane" />
                  )}
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '14px', color: 'var(--text-muted)' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(90, 112, 211, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                color: '#5A70D3'
              }}>
                <i className="fa-solid fa-circle-question" />
              </div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>
                Select a Doubt Thread
              </h3>
              <p style={{ margin: 0, fontSize: '0.86rem', maxWidth: '320px', lineHeight: 1.4 }}>
                Choose a student doubt thread from the list on the left to view question history and reply.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <ImageLightboxModal
          url={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
