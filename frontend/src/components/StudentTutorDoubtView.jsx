import { useState, useEffect, useRef } from 'react';
import {
  getStudentDoubtMessages,
  pollStudentDoubtMessages,
  sendStudentDoubt,
  markStudentDoubtRead,
  getCourseDoubtThreads,
  getStudentThreadMessages,
  pollStudentThreadMessages,
  sendTutorDoubtReply,
  markTutorThreadRead,
  uploadCommunityMedia
} from '../api/community';
import { resolveMediaUrl } from '../pages/admin/AdminCommunityPage';

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
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
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

export default function StudentTutorDoubtView({
  courseId,
  courseName,
  currentUser,
  isTutorOrAdmin = false,
  initialStudentId = null,
  onBackToGroup = null
}) {
  if (isTutorOrAdmin) {
    return (
      <TutorDoubtInboxView
        courseId={courseId}
        courseName={courseName}
        currentUser={currentUser}
        initialStudentId={initialStudentId}
        onBackToGroup={onBackToGroup}
      />
    );
  }

  return (
    <StudentDoubtChatView
      courseId={courseId}
      courseName={courseName}
      currentUser={currentUser}
      onBackToGroup={onBackToGroup}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STUDENT DOUBT CHAT VIEW (1-on-1 with Tutors)
// ─────────────────────────────────────────────────────────────────────────────
function StudentDoubtChatView({ courseId, courseName, currentUser, onBackToGroup }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const messagesEndRef = useRef(null);
  const lastMsgIdRef = useRef(0);
  const pollTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const QUICK_PROMPTS = [
    '💡 Concept explanation doubt',
    '💻 Code debugging help',
    '📝 Assignment doubt',
    '❓ Question from live lecture'
  ];

  // Initial load
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setMessages([]);
    lastMsgIdRef.current = 0;

    async function loadInitial() {
      try {
        const data = await getStudentDoubtMessages(courseId, { page: 0, size: 50 });
        if (!mounted) return;
        const list = data?.content || [];
        setMessages(list);
        if (list.length > 0) {
          lastMsgIdRef.current = list[list.length - 1].id;
        }
        markStudentDoubtRead(courseId).catch(() => {});
      } catch (err) {
        console.error('Failed to load student doubts:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInitial();
    return () => { mounted = false; };
  }, [courseId]);

  // Polling for live tutor replies
  useEffect(() => {
    function startPolling() {
      pollTimerRef.current = setInterval(async () => {
        try {
          const fresh = await pollStudentDoubtMessages(courseId, lastMsgIdRef.current);
          if (Array.isArray(fresh) && fresh.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMsgs = fresh.filter(m => !existingIds.has(m.id));
              if (newMsgs.length === 0) return prev;
              const combined = [...prev, ...newMsgs];
              lastMsgIdRef.current = combined[combined.length - 1].id;
              markStudentDoubtRead(courseId, lastMsgIdRef.current).catch(() => {});
              return combined;
            });
          }
        } catch {
          // ignore transient poll error
        }
      }, POLL_INTERVAL_MS);
    }

    startPolling();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [courseId]);

  // Auto-scroll on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending]);

  async function handleSend(customText) {
    const toSend = (customText !== undefined ? customText : text).trim();
    if ((!toSend && !selectedFile) || sending || uploading) return;

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

      const sent = await sendStudentDoubt(courseId, {
        content: toSend || null,
        messageType,
        mediaAssetId
      });

      if (sent) {
        setMessages(prev => [...prev, sent]);
        lastMsgIdRef.current = sent.id;
      }
      setText('');
    } catch (err) {
      alert(err?.response?.data?.error?.message || 'Failed to send doubt message. Please try again.');
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#f8fafc',
      position: 'relative'
    }}>
      {/* Doubt Desk Header Banner */}
      <div style={{
        padding: '14px 20px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '20px',
            boxShadow: '0 4px 10px rgba(99, 102, 241, 0.25)'
          }}>
            <i className="fa-solid fa-user-graduate"></i>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                Ask Tutor • 1-on-1 Doubt Desk
              </h3>
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></span>
                Private & Confidential
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
              Direct private conversation between you and <strong style={{ color: '#4338ca' }}>{courseName || 'Course'}</strong> instructors
            </div>
          </div>
        </div>

        {onBackToGroup && (
          <button
            type="button"
            onClick={onBackToGroup}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <i className="fa-solid fa-users" style={{ color: '#5A70D3' }}></i>
            <span>Back to Group Chat</span>
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        {/* Welcome Notice Card */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e0e7ff',
          borderRadius: '14px',
          padding: '16px 20px',
          margin: '0 auto 10px auto',
          maxWidth: '680px',
          width: '100%',
          boxSizing: 'border-box',
          boxShadow: '0 2px 8px rgba(99, 102, 241, 0.05)',
          display: 'flex',
          gap: '14px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.1)',
            color: '#4f46e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0
          }}>
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e1b4b', marginBottom: '4px' }}>
              Personal Tutor Clearance Space
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.45 }}>
              Ask questions about lecture materials, difficult assignments, or code bugs without cluttering the group chat. Only verified course instructors have access to this thread.
            </div>

            {/* Quick Prompt Chips */}
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setText(prompt.replace(/^[^\s]+\s*/, '') + ': ')}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '9999px',
                      padding: '4px 12px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      color: '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#4f46e5';
                      e.currentTarget.style.color = '#4f46e5';
                      e.currentTarget.style.background = '#eef2ff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.color = '#334155';
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6366f1' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '26px' }}></i>
            <div style={{ fontSize: '0.82rem', marginTop: '8px', color: '#64748b' }}>Connecting to Doubt Desk…</div>
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#eef2ff',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              <i className="fa-regular fa-comment-dots"></i>
            </div>
            <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#1e293b' }}>
              No doubts submitted yet
            </div>
            <div style={{ fontSize: '0.82rem', maxWidth: '360px', lineHeight: 1.4 }}>
              Type your question below and course instructors will reply directly to guide you.
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <DoubtBubble key={msg.id} msg={msg} currentUserId={currentUser?.id} />
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Selected File Chip */}
      {selectedFile && (
        <div style={{
          padding: '8px 20px',
          background: '#e0e7ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.82rem',
          color: '#3730a3',
          borderTop: '1px solid #c7d2fe'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <i className={`fa-solid ${getFileIcon(selectedFile.type, selectedFile.type)}`}></i>
            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedFile(null)}
            style={{ background: 'none', border: 'none', color: '#4338ca', cursor: 'pointer', fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div style={{
        padding: '12px 18px',
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx,.zip,.txt,.py,.java,.js,.html,.css"
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files && e.target.files[0]) {
              setSelectedFile(e.target.files[0]);
            }
          }}
        />

        {/* Paperclip Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach photo, video, PDF, or code file"
          disabled={uploading || sending}
          style={{
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748b',
            fontSize: '16px',
            flexShrink: 0,
            transition: 'all 0.15s ease'
          }}
        >
          <i className="fa-solid fa-paperclip"></i>
        </button>

        {/* Text Input */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a personal doubt or question from tutor… (Enter to send)"
          rows={1}
          disabled={sending || uploading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '12px',
            border: '1px solid #cbd5e1',
            outline: 'none',
            fontSize: '0.88rem',
            lineHeight: 1.4,
            resize: 'none',
            fontFamily: 'inherit',
            background: '#f8fafc',
            color: '#0f172a',
            boxSizing: 'border-box'
          }}
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={(!text.trim() && !selectedFile) || sending || uploading}
          title="Send Doubt"
          style={{
            background: (!text.trim() && !selectedFile) || sending || uploading
              ? '#94a3b8'
              : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: (!text.trim() && !selectedFile) || sending || uploading ? 'not-allowed' : 'pointer',
            color: '#ffffff',
            fontSize: '15px',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(99, 102, 241, 0.25)',
            transition: 'all 0.15s ease'
          }}
        >
          {sending || uploading ? (
            <i className="fa-solid fa-circle-notch fa-spin"></i>
          ) : (
            <i className="fa-solid fa-paper-plane"></i>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TUTOR / ADMIN DOUBT INBOX VIEW (Manage all student doubts)
// ─────────────────────────────────────────────────────────────────────────────
function TutorDoubtInboxView({ courseId, courseName, currentUser, initialStudentId, onBackToGroup }) {
  const [threads, setThreads] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
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

  // Load doubt threads for this course
  useEffect(() => {
    let mounted = true;
    setLoadingThreads(true);

    async function loadThreads() {
      try {
        const list = await getCourseDoubtThreads(courseId);
        if (!mounted) return;
        const validThreads = Array.isArray(list) ? list : [];
        setThreads(validThreads);

        if (initialStudentId) {
          const matched = validThreads.find(t => String(t.studentId) === String(initialStudentId));
          if (matched) setSelectedStudent(matched);
        } else if (validThreads.length > 0) {
          setSelectedStudent(validThreads[0]);
        }
      } catch (err) {
        console.error('Failed to load course doubt threads:', err);
      } finally {
        if (mounted) setLoadingThreads(false);
      }
    }

    loadThreads();
    return () => { mounted = false; };
  }, [courseId, initialStudentId]);

  // Load messages when selected student changes
  useEffect(() => {
    if (!selectedStudent) {
      setMessages([]);
      return;
    }

    let mounted = true;
    setLoadingMessages(true);
    setMessages([]);
    lastMsgIdRef.current = 0;

    async function loadMessages() {
      try {
        const data = await getStudentThreadMessages(courseId, selectedStudent.studentId, { page: 0, size: 50 });
        if (!mounted) return;
        const list = data?.content || [];
        setMessages(list);
        if (list.length > 0) {
          lastMsgIdRef.current = list[list.length - 1].id;
        }
        markTutorThreadRead(courseId, selectedStudent.studentId).catch(() => {});
        // clear unread count locally
        setThreads(prev => prev.map(t => t.studentId === selectedStudent.studentId ? { ...t, unreadCount: 0 } : t));
      } catch (err) {
        console.error('Failed to load student thread messages:', err);
      } finally {
        if (mounted) setLoadingMessages(false);
      }
    }

    loadMessages();
    return () => { mounted = false; };
  }, [courseId, selectedStudent?.studentId]);

  // Polling for live student replies in the active thread
  useEffect(() => {
    if (!selectedStudent) return;

    function startPolling() {
      pollTimerRef.current = setInterval(async () => {
        try {
          const fresh = await pollStudentThreadMessages(courseId, selectedStudent.studentId, lastMsgIdRef.current);
          if (Array.isArray(fresh) && fresh.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMsgs = fresh.filter(m => !existingIds.has(m.id));
              if (newMsgs.length === 0) return prev;
              const combined = [...prev, ...newMsgs];
              lastMsgIdRef.current = combined[combined.length - 1].id;
              markTutorThreadRead(courseId, selectedStudent.studentId, lastMsgIdRef.current).catch(() => {});
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
  }, [courseId, selectedStudent?.studentId]);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sendingReply]);

  async function handleSendReply() {
    const toSend = replyText.trim();
    if ((!toSend && !selectedFile) || sendingReply || uploading || !selectedStudent) return;

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

      const sent = await sendTutorDoubtReply(courseId, selectedStudent.studentId, {
        content: toSend || null,
        messageType,
        mediaAssetId
      });

      if (sent) {
        setMessages(prev => [...prev, sent]);
        lastMsgIdRef.current = sent.id;
        // update thread status to answered
        setThreads(prev => prev.map(t => t.studentId === selectedStudent.studentId ? {
          ...t,
          status: 'answered',
          lastMessage: toSend || (messageType === 'image' ? '📷 Photo' : '📄 Attachment'),
          lastMessageTime: new Date().toISOString()
        } : t));
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
      t.studentEmail?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'waiting') return t.status === 'waiting_for_tutor';
    if (filter === 'answered') return t.status === 'answered';
    return true;
  });

  const waitingCount = threads.filter(t => t.status === 'waiting_for_tutor').length;

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      background: '#ffffff',
      overflow: 'hidden'
    }}>
      {/* Left Column: Student Doubt Threads List */}
      <div style={{
        width: '320px',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        flexShrink: 0
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Student Doubts</span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                background: '#ede9fe',
                color: '#6d28d9',
                padding: '2px 8px',
                borderRadius: '9999px'
              }}>
                {threads.length}
              </span>
            </div>
            {onBackToGroup && (
              <button
                type="button"
                onClick={onBackToGroup}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6366f1',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Group Chat →
              </button>
            )}
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <i className="fa-solid fa-magnifying-glass" style={{
              position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
              color: '#94a3b8', fontSize: '0.8rem'
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search student doubt…"
              style={{
                width: '100%',
                padding: '7px 10px 7px 30px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
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
                padding: '4px 6px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: filter === 'all' ? '#4f46e5' : '#f1f5f9',
                color: filter === 'all' ? '#ffffff' : '#475569'
              }}
            >
              All ({threads.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('waiting')}
              style={{
                flex: 1,
                padding: '4px 6px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: filter === 'waiting' ? '#d97706' : '#fef3c7',
                color: filter === 'waiting' ? '#ffffff' : '#92400e'
              }}
            >
              Waiting ({waitingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('answered')}
              style={{
                flex: 1,
                padding: '4px 6px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: filter === 'answered' ? '#16a34a' : '#f1f5f9',
                color: filter === 'answered' ? '#ffffff' : '#475569'
              }}
            >
              Answered
            </button>
          </div>
        </div>

        {/* Thread List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {loadingThreads ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#6366f1' }}>
              <i className="fa-solid fa-circle-notch fa-spin"></i>
            </div>
          ) : filteredThreads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: '0.82rem' }}>
              No doubts found in this category
            </div>
          ) : (
            filteredThreads.map(t => {
              const isActive = selectedStudent?.studentId === t.studentId;
              const isWaiting = t.status === 'waiting_for_tutor';
              return (
                <button
                  key={t.studentId}
                  type="button"
                  onClick={() => setSelectedStudent(t)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: 'none',
                    background: isActive ? '#eef2ff' : 'transparent',
                    borderLeft: isActive ? '3px solid #4f46e5' : '3px solid transparent',
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
                    background: '#6366f1',
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
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.studentName}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', flexShrink: 0 }}>
                        {formatTime(t.lastMessageTime)}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.74rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                      {t.lastMessage || 'Sent attachment'}
                    </div>

                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '9999px',
                        background: isWaiting ? '#fef3c7' : '#dcfce7',
                        color: isWaiting ? '#92400e' : '#15803d'
                      }}>
                        {isWaiting ? '⚠️ Waiting for Tutor' : '✓ Answered'}
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

      {/* Right Column: 1-on-1 Conversation with Selected Student */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
        {selectedStudent ? (
          <>
            {/* Header */}
            <div style={{
              padding: '12px 20px',
              background: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#6366f1',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: 800,
                  overflow: 'hidden'
                }}>
                  {selectedStudent.studentAvatar ? (
                    <img src={resolveMediaUrl(selectedStudent.studentAvatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    getInitials(selectedStudent.studentName)
                  )}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>
                    {selectedStudent.studentName}
                  </h4>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    {selectedStudent.studentEmail} • 1-on-1 Student Doubt
                  </div>
                </div>
              </div>

              <span style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '8px',
                background: selectedStudent.status === 'waiting_for_tutor' ? '#fef3c7' : '#dcfce7',
                color: selectedStudent.status === 'waiting_for_tutor' ? '#b45309' : '#15803d'
              }}>
                {selectedStudent.status === 'waiting_for_tutor' ? '⏳ Waiting for your reply' : '✓ Doubt Answered'}
              </span>
            </div>

            {/* Messages Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {loadingMessages ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6366f1' }}>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                </div>
              ) : messages.map(msg => (
                <DoubtBubble key={msg.id} msg={msg} currentUserId={currentUser?.id} isTutorPerspective={true} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Selected File Chip */}
            {selectedFile && (
              <div style={{
                padding: '8px 20px',
                background: '#e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.82rem',
                color: '#3730a3',
                borderTop: '1px solid #c7d2fe'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className={`fa-solid ${getFileIcon(selectedFile.type, selectedFile.type)}`}></i>
                  <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  style={{ background: 'none', border: 'none', color: '#4338ca', cursor: 'pointer', fontWeight: 800 }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Reply Input Bar */}
            <div style={{
              padding: '12px 18px',
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0',
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
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b'
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
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontSize: '0.88rem',
                  lineHeight: 1.4,
                  resize: 'none',
                  fontFamily: 'inherit',
                  background: '#f8fafc'
                }}
              />

              <button
                type="button"
                onClick={handleSendReply}
                disabled={(!replyText.trim() && !selectedFile) || sendingReply || uploading}
                title="Send Reply"
                style={{
                  background: (!replyText.trim() && !selectedFile) || sendingReply || uploading
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
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
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            Select a student doubt to view and reply
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Bubble Component
// ─────────────────────────────────────────────────────────────────────────────
function DoubtBubble({ msg, currentUserId, isTutorPerspective = false }) {
  const isOwn = msg.senderId === currentUserId;
  const isTutorSender = msg.senderRole === 'admin' || msg.senderRole === 'super_admin' || msg.senderRole === 'superadmin';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isOwn ? 'flex-end' : 'flex-start',
      maxWidth: '100%'
    }}>
      {/* Sender Header */}
      <div style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        color: isTutorSender ? '#4f46e5' : '#475569',
        marginBottom: '3px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span>{isOwn ? 'You' : msg.senderName}</span>
        {isTutorSender && (
          <span style={{
            background: '#e0e7ff',
            color: '#4338ca',
            fontSize: '0.62rem',
            padding: '1px 6px',
            borderRadius: '9999px',
            fontWeight: 800
          }}>
            ⭐ Tutor
          </span>
        )}
        <span style={{ color: '#94a3b8', fontWeight: 400 }}>{formatTime(msg.createdAt)}</span>
      </div>

      {/* Bubble Container */}
      <div style={{
        maxWidth: '78%',
        background: isOwn ? '#4f46e5' : '#ffffff',
        color: isOwn ? '#ffffff' : '#0f172a',
        padding: '10px 14px',
        borderRadius: isOwn ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
        boxShadow: isOwn
          ? '0 2px 6px rgba(79, 70, 229, 0.25)'
          : '0 2px 6px rgba(0,0,0,0.04)',
        border: isOwn ? 'none' : '1px solid #e2e8f0',
        wordBreak: 'break-word',
        fontSize: '0.88rem',
        lineHeight: 1.45
      }}>
        {/* Media Rendering */}
        {msg.mediaUrl && (
          <div style={{ marginBottom: msg.content ? '8px' : '0' }}>
            {msg.messageType === 'image' ? (
              <img
                src={resolveMediaUrl(msg.mediaUrl)}
                alt={msg.mediaName || 'Attachment'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '320px',
                  borderRadius: '8px',
                  display: 'block',
                  cursor: 'pointer'
                }}
                onClick={() => window.open(resolveMediaUrl(msg.mediaUrl), '_blank')}
              />
            ) : msg.messageType === 'video' ? (
              <video
                src={resolveMediaUrl(msg.mediaUrl)}
                controls
                style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', display: 'block' }}
              />
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
                  background: isOwn ? 'rgba(255,255,255,0.15)' : '#f1f5f9',
                  color: isOwn ? '#ffffff' : '#334155',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}
              >
                <i className={`fa-solid ${getFileIcon(msg.messageType, msg.mediaMimeType)}`}></i>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {msg.mediaName || 'Download Attachment'}
                </span>
                <i className="fa-solid fa-arrow-down" style={{ fontSize: '0.72rem' }}></i>
              </a>
            )}
          </div>
        )}

        {msg.content && <div>{msg.content}</div>}
      </div>
    </div>
  );
}
