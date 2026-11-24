import { useState, useEffect } from 'react';
import { getStudentCommunityOverview, markCommunityRead, getCommunityMessages } from '../api/community';
import { ChatPanel, resolveMediaUrl } from '../pages/admin/AdminCommunityPage';
import { isChatMuted, toggleMuteChat } from './CommunityToastNotifier';
import StudentTutorDoubtView from './StudentTutorDoubtView';

export default function CourseCommunityWhatsAppView({
  initialCourseId,
  currentCourse,
  currentUser,
  initialChatMode = 'group'
}) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [chatMode, setChatMode] = useState(initialChatMode);
  // Always open THIS course's chat first
  const [mobileShowChat, setMobileShowChat] = useState(true);
  const [, setMuteVersion] = useState(0);

  useEffect(() => {
    if (initialChatMode) setChatMode(initialChatMode);
  }, [initialChatMode]);

  useEffect(() => {
    function handleMuteToggle() {
      setMuteVersion(v => v + 1);
    }
    function handleNewMsg(e) {
      const { courseId: cId, lastMessage } = e.detail || {};
      if (!cId || !lastMessage) return;
      setCourses(prev => prev.map(c => String(c.courseId) === String(cId) ? { ...c, lastMessage } : c));
    }
    window.addEventListener('community-mute-toggle', handleMuteToggle);
    window.addEventListener('community-new-message', handleNewMsg);
    return () => {
      window.removeEventListener('community-mute-toggle', handleMuteToggle);
      window.removeEventListener('community-new-message', handleNewMsg);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadCommunities() {
      try {
        setLoading(true);
        const list = await getStudentCommunityOverview();
        if (!mounted) return;
        let enrolled = Array.isArray(list) ? list : [];

        // If the current course is not in the list yet, ensure it is added as fallback
        const currentIdStr = String(initialCourseId || currentCourse?.id || '');
        let target = enrolled.find(c => String(c.courseId) === currentIdStr);
        if (!target && currentCourse) {
          const fallbackCourse = {
            courseId: initialCourseId || currentCourse.id,
            courseName: currentCourse.name || currentCourse.title || 'Course Community',
            courseThumbnail: currentCourse.thumbnail || '',
            unreadCount: 0,
            lastMessage: 'Tap to chat with tutors and classmates'
          };
          enrolled = [fallbackCourse, ...enrolled];
          target = fallbackCourse;
        }

        setCourses(enrolled);

        // Fetch last message snippets for courses that need it
        enrolled.forEach(async (c) => {
          if (!c.lastMessage && c.totalMessages > 0) {
            try {
              const res = await getCommunityMessages(c.courseId, { page: 0, size: 50 });
              const content = res?.content || [];
              if (content.length > 0) {
                const latest = content[content.length - 1];
                const snippet = latest.content || (latest.messageType === 'image' ? '📷 Photo' : latest.messageType === 'video' ? '🎥 Video' : '📄 Attachment');
                if (mounted) {
                  setCourses(prev => prev.map(item => String(item.courseId) === String(c.courseId) ? { ...item, lastMessage: snippet } : item));
                }
              }
            } catch {}
          }
        });

        // Always select THIS course FIRST!
        if (target) {
          if (target.unreadCount > 0) {
            target.unreadCount = 0;
            markCommunityRead(target.courseId).catch(() => {});
            window.dispatchEvent(new CustomEvent('community-read', { detail: { courseId: target.courseId } }));
          }
          setSelectedCourse(target);
          setMobileShowChat(true); // Open this course chat first!
        } else if (enrolled.length > 0) {
          setSelectedCourse(enrolled[0]);
          setMobileShowChat(true);
        }
      } catch (err) {
        console.error('Failed to load student community list:', err);
        if (currentCourse && mounted) {
          const fallback = {
            courseId: initialCourseId || currentCourse.id,
            courseName: currentCourse.name || currentCourse.title || 'Course Community',
            courseThumbnail: currentCourse.thumbnail || '',
            unreadCount: 0,
            lastMessage: ''
          };
          setCourses([fallback]);
          setSelectedCourse(fallback);
          setMobileShowChat(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCommunities();
    return () => { mounted = false; };
  }, [initialCourseId, currentCourse]);

  function handleSelectCourse(c) {
    setCourses(prev => prev.map(item => String(item.courseId) === String(c.courseId) ? { ...item, unreadCount: 0 } : item));
    setSelectedCourse({ ...c, unreadCount: 0 });
    setMobileShowChat(true);
    if (c.unreadCount > 0) {
      markCommunityRead(c.courseId).catch(() => {});
      window.dispatchEvent(new CustomEvent('community-read', { detail: { courseId: c.courseId } }));
    }
  }

  const filteredCourses = courses.filter(c =>
    !search || (c.courseName || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading && courses.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#ffffff',
        borderRadius: 0,
        border: 'none',
        color: '#5A70D3'
      }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '28px' }}></i>
      </div>
    );
  }

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
      {/* 1. Left Channels / Chats Sidebar (WhatsApp Chats List) */}
      <div className="ot-community-sidebar" style={{ borderRadius: 0, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}>
        {/* Header */}
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
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Chats</span>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#5A70D3',
                background: 'rgba(90, 112, 211, 0.1)',
                padding: '2px 8px',
                borderRadius: '9999px'
              }}>
                {courses.length}
              </span>
            </div>
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
              placeholder="Search course chats…"
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

        {/* Channels List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {filteredCourses.map(c => {
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
                    : <i className="fa-solid fa-graduation-cap" />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: isActive ? '#5A70D3' : '#0f172a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '4px'
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.courseName}
                    </span>
                    {isChatMuted(c.courseId) && (
                      <i className="fa-solid fa-bell-slash" style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0 }} title="Muted" />
                    )}
                  </div>
                  <div style={{
                    fontSize: '0.76rem',
                    color: '#64748b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '2px'
                  }}>
                    {c.lastMessage || 'No messages yet'}
                  </div>
                </div>

                {/* Unread badge */}
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
          })}

          {filteredCourses.length === 0 && (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              No chats match your search
            </div>
          )}
        </div>
      </div>

      {/* 2. Right Conversation Area (WhatsApp Chat Screen) */}
      <div className="ot-community-chat" style={{ borderRadius: 0, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
        {selectedCourse ? (
          <>
            {/* WhatsApp Style Top Header Bar */}
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
              {/* Mobile Back Button: Switches to WhatsApp Chats List */}
              <button
                type="button"
                className="ot-whatsapp-back-btn"
                onClick={() => setMobileShowChat(false)}
                aria-label="Back to chats"
                title="Back to all course chats"
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
                <i className="fa-solid fa-arrow-left"></i>
              </button>

              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                overflow: 'hidden',
                background: 'rgba(90, 112, 211, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#5A70D3',
                fontSize: '17px',
                flexShrink: 0
              }}>
                {selectedCourse.courseThumbnail
                  ? <img src={resolveMediaUrl(selectedCourse.courseThumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <i className="fa-solid fa-comments"></i>}
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
                <span style={{ fontSize: '0.74rem', color: chatMode === 'doubts' ? '#4f46e5' : '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: chatMode === 'doubts' ? '#4f46e5' : '#16a34a', display: 'inline-block' }}></span>
                  {chatMode === 'doubts' ? 'Personal Tutor Doubt Desk' : 'Course Community Channel'}
                </span>
              </div>

              {/* Channel Mode Toggle: Group Discussion vs Ask Tutor */}
              <div style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                borderRadius: '10px',
                padding: '3px',
                border: '1px solid #e2e8f0',
                flexShrink: 0
              }}>
                <button
                  type="button"
                  onClick={() => setChatMode('group')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: chatMode === 'group' ? '#ffffff' : 'transparent',
                    color: chatMode === 'group' ? '#5A70D3' : '#64748b',
                    boxShadow: chatMode === 'group' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <i className="fa-solid fa-users"></i>
                  <span>Group Chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChatMode('doubts')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: chatMode === 'doubts' ? '#ffffff' : 'transparent',
                    color: chatMode === 'doubts' ? '#4f46e5' : '#64748b',
                    boxShadow: chatMode === 'doubts' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <i className="fa-solid fa-user-graduate" style={{ color: chatMode === 'doubts' ? '#4f46e5' : '#818cf8' }}></i>
                  <span>Ask Tutor (Doubts)</span>
                </button>
              </div>

              {/* Mute Chat Notifications Button */}
              <button
                type="button"
                onClick={() => toggleMuteChat(selectedCourse.courseId)}
                title={isChatMuted(selectedCourse.courseId) ? 'Notifications MUTED for this chat (Click to unmute)' : 'Notifications ON for this chat (Click to mute)'}
                aria-label={isChatMuted(selectedCourse.courseId) ? 'Unmute notifications' : 'Mute notifications'}
                style={{
                  background: isChatMuted(selectedCourse.courseId) ? '#f1f5f9' : 'rgba(90, 112, 211, 0.08)',
                  border: '1px solid ' + (isChatMuted(selectedCourse.courseId) ? '#e2e8f0' : 'rgba(90, 112, 211, 0.2)'),
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  color: isChatMuted(selectedCourse.courseId) ? '#64748b' : '#5A70D3',
                  transition: 'all 0.15s ease'
                }}
              >
                <i className={`fa-solid ${isChatMuted(selectedCourse.courseId) ? 'fa-bell-slash' : 'fa-bell'}`}></i>
              </button>
            </div>

            {/* Chat Messages Panel */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {chatMode === 'doubts' ? (
                <StudentTutorDoubtView
                  key={`doubt-${selectedCourse.courseId}`}
                  courseId={selectedCourse.courseId}
                  courseName={selectedCourse.courseName}
                  currentUser={currentUser}
                  onBackToGroup={() => setChatMode('group')}
                />
              ) : (
                <ChatPanel
                  key={selectedCourse.courseId}
                  courseId={selectedCourse.courseId}
                  courseName={selectedCourse.courseName}
                  currentUser={currentUser}
                  availableCourses={courses}
                  placeholder="Share ideas or ask classmates a question…"
                />
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            Select a course chat to begin
          </div>
        )}
      </div>
    </div>
  );
}
