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
import { resolveMediaUrl } from './AdminCommunityPage';

const POLL_INTERVAL_MS = 4000;

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
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
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

  const messagesEndRef = useRef(null);
  const lastMsgIdRef = useRef(0);
  const pollTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load courses list and overall doubt stats
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

  // Load threads whenever course filter changes
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
          setSelectedThread(valid[0]);
        } else {
          setSelectedThread(null);
        }
      } catch (err) {
        console.error('Failed to load doubt threads:', err);
      } finally {
        if (mounted) setLoadingThreads(false);
      }
    }

    loadThreads();
    return () => { mounted = false; };
  }, [selectedCourseId]);

  // Load messages when selected thread changes
  useEffect(() => {
    if (!selectedThread) {
      setMessages([]);
      return;
    }

    let mounted = true;
    setLoadingMessages(true);
    setMessages([]);
    lastMsgIdRef.current = 0;

    async function loadMessages() {
      try {
        const data = await getStudentThreadMessages(selectedThread.courseId, selectedThread.studentId, { page: 0, size: 50 });
        if (!mounted) return;
        const list = data?.content || [];
        setMessages(list);
        if (list.length > 0) {
          lastMsgIdRef.current = list[list.length - 1].id;
        }
        markTutorThreadRead(selectedThread.courseId, selectedThread.studentId).catch(() => {});
        setThreads(prev => prev.map(t =>
          t.studentId === selectedThread.studentId && t.courseId === selectedThread.courseId
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
    return () => { mounted = false; };
  }, [selectedThread?.courseId, selectedThread?.studentId]);

  // Polling for live messages in active thread
  useEffect(() => {
    if (!selectedThread) return;

    function startPolling() {
      pollTimerRef.current = setInterval(async () => {
        try {
          const fresh = await pollStudentThreadMessages(
            selectedThread.courseId,
            selectedThread.studentId,
            lastMsgIdRef.current
          );
          if (Array.isArray(fresh) && fresh.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMsgs = fresh.filter(m => !existingIds.has(m.id));
              if (newMsgs.length === 0) return prev;
              const combined = [...prev, ...newMsgs];
              lastMsgIdRef.current = combined[combined.length - 1].id;
              markTutorThreadRead(selectedThread.courseId, selectedThread.studentId, lastMsgIdRef.current).catch(() => {});
              return combined;
            });
          }
        } catch {}
      }, POLL_INTERVAL_MS);
    }

    startPolling();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [selectedThread?.courseId, selectedThread?.studentId]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sendingReply]);

  async function handleSendReply() {
    const toSend = replyText.trim();
    if ((!toSend && !selectedFile) || sendingReply || uploading || !selectedThread) return;

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
    } catch (err) {
      alert(err?.response?.data?.error?.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
      setUploading(false);
      setUploadProgress(0);
    }
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
    <div className="page" style={{ paddingBottom: '30px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div className="page-title-wrap">
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-circle-question" style={{ color: '#6d28d9' }}></i>
            <span>Doubt Clearance Desk</span>
          </h1>
          <p className="page-subtitle">
            Private 1-on-1 clearance space: answer student doubts and provide academic guidance.
          </p>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(109, 40, 217, 0.1)', color: '#6d28d9' }}>
            <i className="fa-solid fa-circle-question"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-val" style={{ color: '#6d28d9' }}>{stats.totalDoubtsAsked}</span>
            <span className="kpi-label">Doubts Asked</span>
            <span className="kpi-sub">Total student questions submitted</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(21, 128, 61, 0.1)', color: '#15803d' }}>
            <i className="fa-solid fa-comments"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-val" style={{ color: '#15803d' }}>{stats.totalDoubtsReplied}</span>
            <span className="kpi-label">Doubts Replied</span>
            <span className="kpi-sub">Tutor responses given</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706' }}>
            <i className="fa-solid fa-hourglass-half"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-val" style={{ color: '#d97706' }}>{stats.pendingDoubts}</span>
            <span className="kpi-label">Pending Doubts</span>
            <span className="kpi-sub" style={{ color: stats.pendingDoubts > 0 ? '#b45309' : '#15803d', fontWeight: 700 }}>
              {stats.pendingDoubts > 0 ? '⚠️ Awaiting instructor answer' : '✓ All doubts cleared'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Workspace: Left List + Right Conversation */}
      <div className="card" style={{
        display: 'flex',
        height: 'calc(100vh - 340px)',
        minHeight: '520px',
        padding: 0,
        overflow: 'hidden',
        borderRadius: '16px',
        border: '1px solid var(--border-default)'
      }}>
        {/* Left Column: Course Selector, Filter, and Student Doubt Threads */}
        <div style={{
          width: '360px',
          borderRight: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          flexShrink: 0
        }}>
          {/* Filter Bar */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                placeholder="Search student by name or email…"
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 30px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Category Filter Pills */}
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
                  background: filter === 'all' ? '#6d28d9' : 'var(--bg-elevated)',
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
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {loadingThreads ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6d28d9' }}>
                <i className="fa-solid fa-circle-notch fa-spin"></i>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No doubts in this filter
              </div>
            ) : (
              filteredThreads.map(t => {
                const isActive = selectedThread?.studentId === t.studentId && selectedThread?.courseId === t.courseId;
                const isWaiting = t.status === 'waiting_for_tutor';
                return (
                  <button
                    key={`${t.courseId}-${t.studentId}`}
                    type="button"
                    onClick={() => setSelectedThread(t)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: 'none',
                      background: isActive ? 'rgba(109, 40, 217, 0.08)' : 'transparent',
                      borderLeft: isActive ? '3px solid #6d28d9' : '3px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      textAlign: 'left',
                      marginBottom: '2px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: '#6d28d9',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 800,
                      overflow: 'hidden',
                      flexShrink: 0
                    }}>
                      {t.studentAvatar ? (
                        <img src={resolveMediaUrl(t.studentAvatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        getInitials(t.studentName)
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.studentName}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {formatTime(t.lastMessageTime)}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.74rem', color: '#6d28d9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.courseName}
                      </div>

                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {t.lastMessage || 'Sent attachment'}
                      </div>

                      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '9999px',
                          background: isWaiting ? 'rgba(217, 119, 6, 0.15)' : 'rgba(21, 128, 61, 0.15)',
                          color: isWaiting ? '#b45309' : '#15803d'
                        }}>
                          {isWaiting ? '⚠️ Waiting for Reply' : '✓ Replied'}
                        </span>

                        {t.unreadCount > 0 && (
                          <span style={{
                            background: '#ef4444',
                            color: '#ffffff',
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            borderRadius: '9999px',
                            padding: '0 5px',
                            minWidth: '16px',
                            textAlign: 'center'
                          }}>
                            {t.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: 1-on-1 Conversation Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)' }}>
          {selectedThread ? (
            <>
              {/* Header */}
              <div style={{
                padding: '14px 20px',
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: '#6d28d9',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 800,
                    overflow: 'hidden'
                  }}>
                    {selectedThread.studentAvatar ? (
                      <img src={resolveMediaUrl(selectedThread.studentAvatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      getInitials(selectedThread.studentName)
                    )}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {selectedThread.studentName}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {selectedThread.studentEmail} • <strong style={{ color: '#6d28d9' }}>{selectedThread.courseName}</strong>
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '8px',
                  background: selectedThread.status === 'waiting_for_tutor' ? 'rgba(217, 119, 6, 0.15)' : 'rgba(21, 128, 61, 0.15)',
                  color: selectedThread.status === 'waiting_for_tutor' ? '#b45309' : '#15803d'
                }}>
                  {selectedThread.status === 'waiting_for_tutor' ? '⏳ Waiting for your reply' : '✓ Doubt Answered'}
                </span>
              </div>

              {/* Messages Scroll Area */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {loadingMessages ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#6d28d9' }}>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  </div>
                ) : messages.map(msg => {
                  const isTutorSender = msg.senderRole === 'admin' || msg.senderRole === 'super_admin' || msg.senderRole === 'superadmin';
                  const isOwn = msg.senderId === user?.id || isTutorSender;

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isOwn ? 'flex-end' : 'flex-start',
                        maxWidth: '100%'
                      }}
                    >
                      <div style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: isTutorSender ? '#6d28d9' : 'var(--text-muted)',
                        marginBottom: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>{isOwn ? 'You (Instructor)' : msg.senderName}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{formatTime(msg.createdAt)}</span>
                      </div>

                      <div style={{
                        maxWidth: '78%',
                        background: isOwn ? '#6d28d9' : 'var(--bg-surface)',
                        color: isOwn ? '#ffffff' : 'var(--text-primary)',
                        padding: '10px 14px',
                        borderRadius: isOwn ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        boxShadow: isOwn
                          ? '0 2px 6px rgba(109, 40, 217, 0.25)'
                          : '0 2px 6px rgba(0,0,0,0.04)',
                        border: isOwn ? 'none' : '1px solid var(--border-default)',
                        wordBreak: 'break-word',
                        fontSize: '0.88rem',
                        lineHeight: 1.45
                      }}>
                        {msg.mediaUrl && (
                          <div style={{ marginBottom: msg.content ? '8px' : '0' }}>
                            {msg.messageType === 'image' ? (
                              <img
                                src={resolveMediaUrl(msg.mediaUrl)}
                                alt=""
                                style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', cursor: 'pointer' }}
                                onClick={() => window.open(resolveMediaUrl(msg.mediaUrl), '_blank')}
                              />
                            ) : msg.messageType === 'video' ? (
                              <video src={resolveMediaUrl(msg.mediaUrl)} controls style={{ maxWidth: '100%', maxHeight: '260px', borderRadius: '8px' }} />
                            ) : (
                              <a
                                href={resolveMediaUrl(msg.mediaUrl)}
                                target="_blank"
                                rel="noreferrer"
                                download
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 12px',
                                  background: isOwn ? 'rgba(255,255,255,0.15)' : 'var(--bg-elevated)',
                                  color: isOwn ? '#ffffff' : 'var(--text-primary)',
                                  borderRadius: '8px',
                                  textDecoration: 'none',
                                  fontSize: '0.82rem',
                                  fontWeight: 600
                                }}
                              >
                                <i className={`fa-solid ${getFileIcon(msg.messageType, msg.mediaMimeType)}`}></i>
                                <span>{msg.mediaName || 'Download Attachment'}</span>
                                <i className="fa-solid fa-arrow-down" style={{ fontSize: '0.72rem' }}></i>
                              </a>
                            )}
                          </div>
                        )}
                        {msg.content && <div>{msg.content}</div>}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Selected File Chip */}
              {selectedFile && (
                <div style={{
                  padding: '8px 20px',
                  background: 'rgba(109, 40, 217, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.82rem',
                  color: '#6d28d9',
                  borderTop: '1px solid var(--border-default)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className={`fa-solid ${getFileIcon(selectedFile.type, selectedFile.type)}`}></i>
                    <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    style={{ background: 'none', border: 'none', color: '#6d28d9', cursor: 'pointer', fontWeight: 800 }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Reply Box */}
              <div style={{
                padding: '12px 18px',
                background: 'var(--bg-surface)',
                borderTop: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx,.zip,.txt,.py,.java,.js"
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file or code"
                  disabled={uploading || sendingReply}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '50%',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                >
                  <i className="fa-solid fa-paperclip"></i>
                </button>

                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  placeholder="Reply directly to this student's doubt… (Enter to send)"
                  rows={1}
                  disabled={sendingReply || uploading}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-default)',
                    outline: 'none',
                    fontSize: '0.88rem',
                    lineHeight: 1.4,
                    resize: 'none',
                    fontFamily: 'inherit',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)'
                  }}
                />

                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={(!replyText.trim() && !selectedFile) || sendingReply || uploading}
                  title="Send Reply"
                  style={{
                    background: (!replyText.trim() && !selectedFile) || sendingReply || uploading
                      ? 'var(--text-muted)'
                      : '#6d28d9',
                    border: 'none',
                    borderRadius: '50%',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: (!replyText.trim() && !selectedFile) || sendingReply || uploading ? 'not-allowed' : 'pointer',
                    color: '#ffffff'
                  }}
                >
                  {sendingReply || uploading ? (
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                  ) : (
                    <i className="fa-solid fa-paper-plane"></i>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Select a student doubt from the list to view and reply
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
