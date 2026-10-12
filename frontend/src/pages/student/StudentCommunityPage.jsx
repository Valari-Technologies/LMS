import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getStudentCommunityOverview, markCommunityRead, getCommunityMessages } from '../../api/community';
import { ChatPanel, resolveMediaUrl } from '../admin/AdminCommunityPage';
import { isChatMuted, toggleMuteChat } from '../../components/CommunityToastNotifier';

export default function StudentCommunityPage() {
  const { user } = useAuth();
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(!!courseId);
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
      setCourses(prev => prev.map(c => c.courseId === cId ? { ...c, lastMessage } : c));
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
    let mounted = true;
    async function init() {
      try {
        const list = await getStudentCommunityOverview();
        if (!mounted) return;
        const enrolled = list || [];
        setCourses(enrolled);

        // Fetch last message for courses that have messages but missing lastMessage
        enrolled.forEach(async (c) => {
          if (!c.lastMessage && c.totalMessages > 0) {
            try {
              const res = await getCommunityMessages(c.courseId, { page: 0, size: 50 });
              const content = res?.content || [];
              if (content.length > 0) {
                const latest = content[content.length - 1];
                const snippet = latest.content || (latest.messageType === 'image' ? '📷 Photo' : latest.messageType === 'video' ? '🎥 Video' : (latest.messageType === 'pdf' || latest.messageType === 'file') ? '📄 Attachment' : 'Attachment');
                setCourses(prev => prev.map(item => item.courseId === c.courseId ? { ...item, lastMessage: snippet } : item));
              }
            } catch {}
          }
        });

        const fromUrl = courseId
          ? enrolled.find(c => String(c.courseId) === String(courseId))
          : null;
        if (fromUrl) {
          if (fromUrl.unreadCount > 0) {
            fromUrl.unreadCount = 0;
            markCommunityRead(fromUrl.courseId).catch(() => {});
            window.dispatchEvent(new CustomEvent('community-read', { detail: { courseId: fromUrl.courseId } }));
          }
          setSelectedCourse(fromUrl);
        } else {
          setSelectedCourse(null);
        }
      } catch (e) {
        console.error('Student community init error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!courseId || courses.length === 0) return;
    const match = courses.find(c => String(c.courseId) === String(courseId));
    if (match) {
      if (match.unreadCount > 0) {
        setCourses(prev => prev.map(item => item.courseId === match.courseId ? { ...item, unreadCount: 0 } : item));
        markCommunityRead(match.courseId).catch(() => {});
        window.dispatchEvent(new CustomEvent('community-read', { detail: { courseId: match.courseId } }));
      }
      setSelectedCourse({ ...match, unreadCount: 0 });
    }
  }, [courseId]);

  function selectCourse(course) {
    setCourses(prev => prev.map(item => item.courseId === course.courseId ? { ...item, unreadCount: 0 } : item));
    setSelectedCourse({ ...course, unreadCount: 0 });
    setMobileShowChat(true);
    navigate(`/student/community/${course.courseId}`);
    if (course.unreadCount > 0) {
      markCommunityRead(course.courseId).catch(() => {});
      window.dispatchEvent(new CustomEvent('community-read', { detail: { courseId: course.courseId } }));
    }
  }

  const filteredCourses = courses.filter(c =>
    !search || c.courseName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#5A70D3' }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '32px' }} />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', gap: '16px', minHeight: '65vh', padding: '32px 24px',
        background: 'radial-gradient(circle at 86% 12%, rgba(90, 112, 211, 0.08) 0%, transparent 40%), #F7F8FC'
      }}>
        <div style={{
          width: '84px', height: '84px', borderRadius: '50%', background: 'rgba(90, 112, 211, 0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', color: '#5A70D3',
          boxShadow: '0 4px 14px rgba(90, 112, 211, 0.15)'
        }}>
          <i className="fa-solid fa-comments" />
        </div>
        <h3 style={{ color: '#0b1f3a', margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>No course communities yet</h3>
        <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem', maxWidth: '400px', lineHeight: 1.5 }}>
          Enroll in any course to automatically unlock its community channel and collaborate with classmates and tutors.
        </p>
        <button
          type="button"
          onClick={() => navigate('/student/courses')}
          style={{
            marginTop: '10px', padding: '12px 26px', border: 'none', borderRadius: '9999px',
            background: '#5A70D3', color: '#FFFFFF', fontWeight: 700, fontSize: '0.94rem',
            cursor: 'pointer', boxShadow: '0 3px 12px rgba(90, 112, 211, 0.25)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#007055'}
          onMouseLeave={e => e.currentTarget.style.background = '#5A70D3'}
        >
          Browse Courses
        </button>
      </div>
    );
  }

  return (
    <div className={`ot-community-wrap ${mobileShowChat ? 'sc-chat-open' : ''}`}>
      {/* Sidebar Channel List */}
      <div className="ot-community-sidebar">
        <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-comments" style={{ color: '#5A70D3' }} />
              <span>Community <span style={{ color: '#5A70D3' }}>Hub</span></span>
            </h2>
            <button
              type="button"
              onClick={toggleNotifications}
              title={notificationsEnabled ? 'Toast notifications ON (Click to turn OFF)' : 'Toast notifications OFF (Click to turn ON)'}
              aria-label={notificationsEnabled ? 'Mute notifications' : 'Unmute notifications'}
              style={{
                background: notificationsEnabled ? 'rgba(90, 112, 211, 0.08)' : '#f1f5f9',
                border: notificationsEnabled ? '1px solid #E8E8E8' : '1px solid #e2e8f0',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                padding: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.88rem',
                color: notificationsEnabled ? '#5A70D3' : '#64748b',
                transition: 'all 0.18s ease',
              }}
            >
              <i className={`fa-solid ${notificationsEnabled ? 'fa-bell' : 'fa-bell-slash'}`} />
            </button>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
            {courses.length} enrolled course{courses.length !== 1 ? 's' : ''}
          </p>
          <div style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              color: '#94a3b8', fontSize: '0.82rem',
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search course channels…"
              style={{
                width: '100%', padding: '9px 12px 9px 34px', fontSize: '0.86rem',
                background: '#f8fafc', color: '#0f172a',
                border: '1px solid #e2e8f0', borderRadius: '9999px', outline: 'none',
                boxSizing: 'border-box', fontWeight: 500,
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#5A70D3';
                e.target.style.boxShadow = '0 0 0 3px rgba(90, 112, 211, 0.12)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
        </div>

        {/* Channels List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {filteredCourses.map(c => {
            const isActive = selectedCourse?.courseId === c.courseId;
            return (
              <button
                key={c.courseId}
                type="button"
                className={`ot-community-item ${isActive ? 'active' : ''}`}
                onClick={() => selectCourse(c)}
                style={{ borderRadius: '12px', marginBottom: '4px' }}
              >
                <div style={{
                  width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0, overflow: 'hidden',
                  background: isActive ? '#5A70D3' : 'rgba(90, 112, 211, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isActive ? '#ffffff' : '#5A70D3', fontSize: '18px',
                }}>
                  {c.courseThumbnail
                    ? <img src={resolveMediaUrl(c.courseThumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <i className="fa-solid fa-graduation-cap" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.88rem', fontWeight: 700,
                    color: isActive ? '#5A70D3' : '#0b1f3a',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.courseName}</span>
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
                    marginTop: '2px',
                  }}>
                    {c.lastMessage || 'No messages yet'}
                  </div>
                </div>

                {/* Unread badge */}
                {c.unreadCount > 0 && (
                  <div style={{
                    minWidth: '22px', height: '22px', borderRadius: '9999px', padding: '0 6px',
                    background: '#5A70D3', color: '#FFFFFF', fontSize: '0.7rem', fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(90, 112, 211, 0.3)',
                  }}>
                    {c.unreadCount > 99 ? '99+' : c.unreadCount}
                  </div>
                )}
              </button>
            );
          })}

          {filteredCourses.length === 0 && (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
              No course channels match your search
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Panel Area */}
      <div className="ot-community-chat">
        {selectedCourse ? (
          <>
            <div style={{
              padding: '14px 22px', background: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', gap: '12px',
              boxShadow: '0 1px 4px rgba(11, 31, 58, 0.03)', flexShrink: 0,
            }}>
              <button
                type="button"
                className="mobile-only"
                onClick={() => setMobileShowChat(false)}
                aria-label="Back to course list"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#64748b', fontSize: '18px', padding: '6px',
                }}
              >
                <i className="fa-solid fa-arrow-left" />
              </button>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px', overflow: 'hidden',
                background: 'rgba(90, 112, 211, 0.08)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#5A70D3', fontSize: '18px', flexShrink: 0,
              }}>
                {selectedCourse.courseThumbnail
                  ? <img src={resolveMediaUrl(selectedCourse.courseThumbnail)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <i className="fa-solid fa-comments" />}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0b1f3a' }}>
                  {selectedCourse.courseName}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#5A70D3', fontWeight: 600 }}>Community Channel</span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Per-chat Mute Toggle (Icon only) */}
                <button
                  type="button"
                  onClick={() => toggleMuteChat(selectedCourse.courseId)}
                  title={isChatMuted(selectedCourse.courseId) ? 'Notifications MUTED for this chat (Click to unmute)' : 'Notifications ON for this chat (Click to mute)'}
                  aria-label={isChatMuted(selectedCourse.courseId) ? 'Unmute notifications' : 'Mute notifications'}
                  style={{
                    background: isChatMuted(selectedCourse.courseId) ? '#f1f5f9' : 'rgba(90, 112, 211, 0.08)',
                    border: '1px solid ' + (isChatMuted(selectedCourse.courseId) ? '#e2e8f0' : '#E8E8E8'),
                    borderRadius: '50%',
                    width: '36px',
                    height: '36px',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.95rem',
                    color: isChatMuted(selectedCourse.courseId) ? '#64748b' : '#5A70D3',
                    boxShadow: isChatMuted(selectedCourse.courseId) ? 'none' : '0 2px 8px rgba(90, 112, 211, 0.12)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <i className={`fa-solid ${isChatMuted(selectedCourse.courseId) ? 'fa-bell-slash' : 'fa-bell'}`} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <ChatPanel
                key={selectedCourse.courseId}
                courseId={selectedCourse.courseId}
                courseName={selectedCourse.courseName}
                currentUser={user}
                availableCourses={courses}
                placeholder="Share ideas or ask classmates a question…"
              />
            </div>
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', textAlign: 'center', gap: '16px', padding: '32px',
            background: 'radial-gradient(circle at 80% 20%, rgba(90, 112, 211, 0.08) 0%, transparent 40%), #F7F8FC'
          }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(90, 112, 211, 0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', color: '#5A70D3',
              boxShadow: '0 4px 14px rgba(90, 112, 211, 0.12)'
            }}>
              <i className="fa-solid fa-comments" />
            </div>
            <h3 style={{ color: '#0b1f3a', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Select a Course Channel</h3>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.92rem', maxWidth: '380px', lineHeight: 1.5 }}>
              Choose any of your enrolled course channels on the left to start collaborating with classmates and tutors.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
