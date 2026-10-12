import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getStudentCommunityOverview, getAdminCommunityOverview } from '../api/community';
import { getLiveSessions } from '../api/live';
import { subscribeSyncEvents, SYNC_EVENTS } from '../utils/syncEvents';

export function isChatMuted(courseId) {
  try {
    const muted = JSON.parse(localStorage.getItem('onetutor_muted_chats') || '[]');
    return muted.includes(Number(courseId));
  } catch {
    return false;
  }
}

export function toggleMuteChat(courseId) {
  try {
    let muted = JSON.parse(localStorage.getItem('onetutor_muted_chats') || '[]');
    const id = Number(courseId);
    if (muted.includes(id)) {
      muted = muted.filter(x => x !== id);
    } else {
      muted.push(id);
    }
    localStorage.setItem('onetutor_muted_chats', JSON.stringify(muted));
    window.dispatchEvent(new CustomEvent('community-mute-toggle', { detail: { courseId: id, muted: muted.includes(id) } }));
    return muted.includes(id);
  } catch {
    return false;
  }
}

export function isLiveNotificationMuted() {
  try {
    return localStorage.getItem('onetutor_live_notifications_muted') === 'true';
  } catch {
    return false;
  }
}

export function toggleLiveNotificationMute() {
  try {
    const currentlyMuted = isLiveNotificationMuted();
    const nextMuted = !currentlyMuted;
    localStorage.setItem('onetutor_live_notifications_muted', nextMuted ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('live-notifications-mute-toggle', { detail: { muted: nextMuted } }));
    return nextMuted;
  } catch {
    return false;
  }
}

export function isSessionNotificationMuted(sessionId) {
  try {
    const muted = JSON.parse(localStorage.getItem('onetutor_muted_live_sessions') || '[]');
    return muted.includes(Number(sessionId));
  } catch {
    return false;
  }
}

export function toggleMuteSession(sessionId) {
  try {
    let muted = JSON.parse(localStorage.getItem('onetutor_muted_live_sessions') || '[]');
    const id = Number(sessionId);
    if (muted.includes(id)) {
      muted = muted.filter(x => x !== id);
    } else {
      muted.push(id);
    }
    localStorage.setItem('onetutor_muted_live_sessions', JSON.stringify(muted));
    window.dispatchEvent(new CustomEvent('live-session-mute-toggle', { detail: { sessionId: id, muted: muted.includes(id) } }));
    return muted.includes(id);
  } catch {
    return false;
  }
}

/**
 * Checks whether a live session is scheduled on the current calendar date (today).
 */
export function isCurrentDaySession(session) {
  if (!session?.scheduledAt) return false;
  const now = new Date();
  const sessionDate = new Date(session.scheduledAt);
  if (isNaN(sessionDate.getTime())) return false;

  return (
    sessionDate.getFullYear() === now.getFullYear() &&
    sessionDate.getMonth() === now.getMonth() &&
    sessionDate.getDate() === now.getDate()
  );
}

/**
 * Checks whether a live session is currently active or upcoming TODAY.
 * Completely ignores past sessions, sessions from previous days/months, and ended sessions.
 */
export function isSessionActiveOrUpcomingToday(session) {
  if (!session) return false;

  const rawStatus = String(session.status || '').toLowerCase();
  if (rawStatus === 'cancelled' || rawStatus === 'completed') {
    return false;
  }

  // Strictly enforce current calendar day only (no old/past days)
  if (!isCurrentDaySession(session)) {
    return false;
  }

  const now = new Date();
  const scheduledDate = new Date(session.scheduledAt);
  if (isNaN(scheduledDate.getTime())) return false;

  // If session has an end time and the end time has already passed today, it has completed
  if (session.endTime) {
    const endDate = new Date(session.endTime);
    if (!isNaN(endDate.getTime()) && endDate <= now) {
      return false;
    }
  } else {
    // If no end time specified:
    // If scheduled time was more than 3 hours ago today, consider it finished unless marked 'live'
    const threeHoursMs = 3 * 60 * 60 * 1000;
    if (now.getTime() - scheduledDate.getTime() > threeHoursMs && rawStatus !== 'live') {
      return false;
    }
  }

  return true;
}

export function getSeenCommunityMessages(role = 'student') {
  try {
    return JSON.parse(localStorage.getItem(`onetutor_seen_community_messages_${role}`) || '{}');
  } catch {
    return {};
  }
}

export function markCommunityMessageDismissed(role = 'student', courseId, totalMessages, unreadCount) {
  if (!courseId) return;
  try {
    const seen = getSeenCommunityMessages(role);
    seen[courseId] = {
      totalMessages: Number(totalMessages) || (seen[courseId]?.totalMessages || 0),
      unreadCount: Number(unreadCount) || 0,
      timestamp: Date.now()
    };
    localStorage.setItem(`onetutor_seen_community_messages_${role}`, JSON.stringify(seen));
  } catch {}
}

export default function CommunityToastNotifier({ role = 'student' }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [toast, setToast] = useState(null); // { type, courseId, courseName, unreadCount, lastMessageSnippet, title, scheduledAt, autoDismiss, totalMessages }
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('onetutor_community_notifications') !== 'disabled';
  });

  const prevCountsRef = useRef({});

  // Auto-dismiss toast only if autoDismiss is true (5s for messages, NEVER for live classes)
  useEffect(() => {
    if (!toast || toast.autoDismiss === false) return;
    const autoDismissTimer = setTimeout(() => {
      if (toast.type === 'COMMUNITY_MESSAGE') {
        markCommunityMessageDismissed(role, toast.courseId, toast.totalMessages, toast.unreadCount);
      }
      setToast(null);
    }, 5000);
    return () => clearTimeout(autoDismissTimer);
  }, [toast, role]);

  // Dismiss live class toast if it is for a past date or if the session has ended
  useEffect(() => {
    if (toast?.type === 'LIVE_CLASS') {
      const now = new Date();
      const toastDate = new Date(toast.scheduledAt);
      const isToday =
        toastDate.getFullYear() === now.getFullYear() &&
        toastDate.getMonth() === now.getMonth() &&
        toastDate.getDate() === now.getDate();
      const hasEnded = toast.endTime ? new Date(toast.endTime) <= now : false;

      if (!isToday || hasEnded) {
        setToast(null);
      }
    }
  }, [toast]);

  // Dismiss live toast when student navigates to live classes page
  useEffect(() => {
    if (toast?.type === 'LIVE_CLASS' && (location.pathname.includes('/live-classes') || location.pathname.includes('/live-sessions'))) {
      setToast(null);
    }
  }, [location.pathname, toast]);

  // Sync state with localStorage changes or custom events
  useEffect(() => {
    function handleNotifToggle() {
      const enabled = localStorage.getItem('onetutor_community_notifications') !== 'disabled';
      setNotificationsEnabled(enabled);
      if (!enabled) {
        setToast(null);
      }
    }
    window.addEventListener('community-notif-toggle', handleNotifToggle);
    return () => window.removeEventListener('community-notif-toggle', handleNotifToggle);
  }, []);

  const toggleNotifications = (e) => {
    e.stopPropagation();
    const nextState = !notificationsEnabled;
    setNotificationsEnabled(nextState);
    localStorage.setItem('onetutor_community_notifications', nextState ? 'enabled' : 'disabled');
    window.dispatchEvent(new Event('community-notif-toggle'));
    if (!nextState) {
      setToast(null);
    }
  };

  useEffect(() => {
    let timer = null;

    async function checkNotifications() {
      if (!notificationsEnabled) return;

      const currentPath = location.pathname;
      const isCommunityPage = currentPath.includes('/community');
      const isLiveClassesPage = currentPath.includes('/live-classes') || currentPath.includes('/live-sessions');

      try {
        // 1. Check Live Classes only for students on student pages (NEVER on admin pages)
        // ONLY notify for CURRENT DAY updates (sessions scheduled today or active now)
        if (role === 'student' && !isLiveNotificationMuted()) {
          const liveList = await getLiveSessions().catch(() => []);
          const sessions = Array.isArray(liveList) ? liveList : (liveList?.content || []);
          let liveToastCandidate = null;

          let seenArray = [];
          try {
            seenArray = JSON.parse(localStorage.getItem('onetutor_seen_live_sessions') || '[]');
          } catch {
            seenArray = [];
          }
          const seenSet = new Set(seenArray);
          let seenSetModified = false;

          for (const s of sessions) {
            // NEVER notify for sessions from previous days/months or completed/cancelled sessions!
            if (!isSessionActiveOrUpcomingToday(s)) {
              if (!seenSet.has(s.id)) {
                seenSet.add(s.id);
                seenSetModified = true;
              }
              continue;
            }

            // At this point, the session is STRICTLY for the current day and active/upcoming!
            if (!seenSet.has(s.id) && !isLiveClassesPage && !isSessionNotificationMuted(s.id) && (s.canJoin !== false && s.enrolled !== false)) {
              seenSet.add(s.id);
              seenSetModified = true;

              const now = new Date();
              const scheduledDate = new Date(s.scheduledAt);
              const isLiveNow = s.status === 'live' || (scheduledDate <= now && (!s.endTime || new Date(s.endTime) > now));

              liveToastCandidate = {
                type: 'LIVE_CLASS',
                autoDismiss: false, // Student MUST manually click X or click toast
                id: s.id,
                courseName: s.courseName || 'Live Class',
                title: s.title || (isLiveNow ? 'Live Class in Progress' : 'Live Class Scheduled for Today'),
                scheduledAt: s.scheduledAt,
                endTime: s.endTime,
                isLiveNow,
              };
              break;
            }
          }

          if (seenSetModified) {
            try {
              localStorage.setItem('onetutor_seen_live_sessions', JSON.stringify(Array.from(seenSet)));
            } catch {}
          }

          if (liveToastCandidate) {
            setToast(liveToastCandidate);
            return;
          }
        }

        // 2. Check Community Messages
        const list = role === 'admin' 
          ? await getAdminCommunityOverview() 
          : await getStudentCommunityOverview();

        if (!list || !Array.isArray(list)) return;

        const seenMap = getSeenCommunityMessages(role);
        let seenMapModified = false;
        const newCounts = {};
        let msgToastCandidate = null;

        for (const item of list) {
          const cId = item.courseId;
          const isUserDisabled = item.disabled || item.isDisabled;
          if (isUserDisabled) {
            if (!seenMap[cId] || seenMap[cId].unreadCount !== 0 || seenMap[cId].totalMessages !== (item.totalMessages || 0)) {
              seenMap[cId] = { totalMessages: item.totalMessages || 0, unreadCount: 0, timestamp: Date.now() };
              seenMapModified = true;
            }
            continue;
          }

          const uCount = item.unreadCount || 0;
          const totalMsg = item.totalMessages || 0;
          const prev = prevCountsRef.current[cId] ?? seenMap[cId]?.unreadCount ?? 0;
          const seenRecord = seenMap[cId];

          newCounts[cId] = uCount;

          const isViewingThisCourse = isCommunityPage && (
            currentPath.endsWith(`/${cId}`) || location.search.includes(`courseId=${cId}`)
          );

          const muted = isChatMuted(cId);

          if (isViewingThisCourse) {
            // Actively viewing this community
            if (!seenRecord || seenRecord.unreadCount !== 0 || seenRecord.totalMessages !== totalMsg) {
              seenMap[cId] = { totalMessages: totalMsg, unreadCount: 0, timestamp: Date.now() };
              seenMapModified = true;
            }
            continue;
          }

          // Determine if there is a NEW message that hasn't been dismissed/seen yet
          let isNewMessage = false;
          if (uCount > 0) {
            if (!seenRecord) {
              // First time seeing unread message for this course
              isNewMessage = true;
            } else {
              const prevTotal = Number(seenRecord.totalMessages) || 0;
              const prevUnread = Number(seenRecord.unreadCount) || 0;
              // Only consider new if totalMessages increased OR unreadCount increased compared to when dismissed/seen
              if (totalMsg > prevTotal || uCount > prevUnread) {
                isNewMessage = true;
              }
            }
          }

          if (isNewMessage && !muted && !msgToastCandidate) {
            msgToastCandidate = {
              type: 'COMMUNITY_MESSAGE',
              autoDismiss: true, // 5s auto dismiss
              courseId: cId,
              courseName: item.courseName || item.name || 'Course Community',
              unreadCount: uCount,
              totalMessages: totalMsg,
              lastMessageSnippet: (typeof item.lastMessage === 'string' ? item.lastMessage : item.lastMessage?.content) || (item.lastMessage?.messageType === 'IMAGE' ? '📷 Photo' : item.lastMessage?.messageType === 'VIDEO' ? '🎥 Video' : item.lastMessage?.messageType === 'FILE' ? '📄 Attachment' : 'New message'),
            };

            // Immediately mark as seen so rapid navigation or re-render won't re-trigger the toast
            seenMap[cId] = { totalMessages: totalMsg, unreadCount: uCount, timestamp: Date.now() };
            seenMapModified = true;
          } else if (uCount === 0 && (!seenRecord || seenRecord.unreadCount > 0)) {
            seenMap[cId] = { totalMessages: totalMsg, unreadCount: 0, timestamp: Date.now() };
            seenMapModified = true;
          }
        }

        if (seenMapModified) {
          try {
            localStorage.setItem(`onetutor_seen_community_messages_${role}`, JSON.stringify(seenMap));
          } catch {}
        }

        prevCountsRef.current = newCounts;

        if (msgToastCandidate) {
          setToast(msgToastCandidate);
        }
      } catch (err) {
        // ignore network error
      }
    }

    checkNotifications();
    timer = setInterval(checkNotifications, 10000);

    function handleLiveSessionEvent() {
      checkNotifications();
    }
    function handleLiveMuteEvent(e) {
      if (e.detail?.muted) {
        setToast(prev => (prev?.type === 'LIVE_CLASS' ? null : prev));
      } else {
        checkNotifications();
      }
    }
    function handleCommunityRead(e) {
      const cId = e.detail?.courseId;
      if (!cId) return;
      setToast(prev => (prev?.type === 'COMMUNITY_MESSAGE' && Number(prev.courseId) === Number(cId) ? null : prev));
      const sMap = getSeenCommunityMessages(role);
      if (sMap[cId]) {
        sMap[cId].unreadCount = 0;
        sMap[cId].timestamp = Date.now();
        try {
          localStorage.setItem(`onetutor_seen_community_messages_${role}`, JSON.stringify(sMap));
        } catch {}
      }
    }
    function handleCommunityMute(e) {
      const { courseId: cId, muted } = e.detail || {};
      if (muted && cId) {
        setToast(prev => (prev?.type === 'COMMUNITY_MESSAGE' && Number(prev.courseId) === Number(cId) ? null : prev));
      }
    }

    window.addEventListener('live-sessions-changed', handleLiveSessionEvent);
    window.addEventListener('live-session-created', handleLiveSessionEvent);
    window.addEventListener('live-notifications-mute-toggle', handleLiveMuteEvent);
    window.addEventListener('community-read', handleCommunityRead);
    window.addEventListener('community-mute-toggle', handleCommunityMute);
    const unsubSync = subscribeSyncEvents((event) => {
      if (event.type === SYNC_EVENTS.LIVE_SESSIONS_CHANGED) {
        checkNotifications();
      }
    });

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener('live-sessions-changed', handleLiveSessionEvent);
      window.removeEventListener('live-session-created', handleLiveSessionEvent);
      window.removeEventListener('live-notifications-mute-toggle', handleLiveMuteEvent);
      window.removeEventListener('community-read', handleCommunityRead);
      window.removeEventListener('community-mute-toggle', handleCommunityMute);
      unsubSync();
    };
  }, [role, notificationsEnabled, location.pathname, location.search]);


  if (!notificationsEnabled || !toast) {
    return null;
  }

  const handleToastClick = () => {
    if (toast.type === 'LIVE_CLASS') {
      const targetUrl = role === 'admin' ? '/admin/live-sessions' : '/student/live-classes';
      setToast(null);
      navigate(targetUrl);
    } else {
      markCommunityMessageDismissed(role, toast.courseId, toast.totalMessages, toast.unreadCount);
      const targetUrl = role === 'admin'
        ? `/admin/community?courseId=${toast.courseId}`
        : `/student/community/${toast.courseId}`;
      setToast(null);
      navigate(targetUrl);
    }
  };

  const isLiveToast = toast.type === 'LIVE_CLASS';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        maxWidth: '360px',
        width: 'calc(100vw - 32px)',
        background: 'var(--ud-white, #ffffff)',
        color: '#1c1d1f',
        borderRadius: '12px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.22), 0 3px 10px rgba(0,0,0,0.1)',
        border: '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden',
        cursor: 'pointer',
        animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={handleToastClick}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes bellRing {
          0% { transform: rotate(0); }
          10% { transform: rotate(18deg); }
          20% { transform: rotate(-16deg); }
          30% { transform: rotate(14deg); }
          40% { transform: rotate(-12deg); }
          50% { transform: rotate(8deg); }
          60% { transform: rotate(-6deg); }
          70% { transform: rotate(4deg); }
          80% { transform: rotate(-2deg); }
          100% { transform: rotate(0); }
        }
      `}</style>
      
      {/* Toast Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          padding: '10px 14px',
          background: isLiveToast
            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#ffffff',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <i className={`fa-solid ${isLiveToast ? 'fa-video' : 'fa-comments'}`} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isLiveToast ? (toast.isLiveNow ? 'Live Class in Progress' : 'Live Class Scheduled Today') : 'New Community Message'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Shaking Glowing Gold Bell Toggle Icon inside Toast */}
          <button
            type="button"
            onClick={toggleNotifications}
            title={notificationsEnabled ? 'Global Notifications ON (Click to turn OFF)' : 'Global Notifications OFF'}
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
            }}
          >
            <i
              className={`fa-solid ${notificationsEnabled ? 'fa-bell' : 'fa-bell-slash'}`}
              style={{
                color: notificationsEnabled ? '#fbbf24' : '#d1d5db',
                fontSize: '20px',
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justify: 'center',
                filter: 'none',
                animation: notificationsEnabled ? 'bellRing 1.5s ease-in-out infinite' : 'none',
                transition: 'all 0.25s ease',
              }}
            />
          </button>

          {/* Close Toast */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (toast?.type === 'COMMUNITY_MESSAGE') {
                markCommunityMessageDismissed(role, toast.courseId, toast.totalMessages, toast.unreadCount);
              }
              setToast(null);
            }}
            title="Dismiss"
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '2px 4px',
              opacity: 0.85,
              flexShrink: 0,
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      </div>

      {/* Toast Content */}
      <div style={{ padding: '12px 14px' }}>
        {isLiveToast ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '14px', color: '#1c1d1f', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {toast.courseName}
              </span>
              <span
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                {toast.isLiveNow ? 'Live Now' : 'Today'}
              </span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              {toast.title}
            </div>
            {toast.scheduledAt && (
              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-regular fa-clock" style={{ color: '#ef4444' }} />
                <span>
                  {toast.isLiveNow ? 'Started at ' : 'Today at '}
                  {new Date(toast.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {toast.endTime && ` - ${new Date(toast.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#1c1d1f', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {toast.courseName}
              </span>
              <span
                style={{
                  background: '#22c55e',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  flexShrink: 0,
                }}
              >
                {toast.unreadCount} unread
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#6a6f73', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toast.lastMessageSnippet}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
