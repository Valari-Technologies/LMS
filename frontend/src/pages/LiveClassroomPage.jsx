import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getLiveClassroomJoinInfo } from '../api/live';
import JitsiMeetClassroom from '../components/JitsiMeetClassroom';

export default function LiveClassroomPage({ role = 'student' }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [joinInfo, setJoinInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  useEffect(() => {
    let active = true;

    async function fetchJoinInfo() {
      setLoading(true);
      setError(null);
      setErrorCode(null);

      try {
        const data = await getLiveClassroomJoinInfo(sessionId);
        if (active) {
          setJoinInfo(data);
        }
      } catch (err) {
        if (active) {
          const status = err.response?.status;
          const code = err.response?.data?.error?.code || err.response?.data?.code || '';
          const message = err.response?.data?.error?.message || err.response?.data?.message || 'Failed to enter the live classroom.';
          setErrorCode(code || (status === 403 ? 'ENROLLMENT_REQUIRED' : 'ERROR'));
          setError(message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (sessionId) {
      fetchJoinInfo();
    }

    return () => {
      active = false;
    };
  }, [sessionId]);

  const handleLeave = () => {
    const isAdminRole = role === 'admin' || role === 'super_admin' || role === 'superadmin';
    if (isAdminRole) {
      navigate('/admin/live-sessions');
    } else {
      navigate('/student/live-classes');
    }
  };

  // 1. Loading screen
  if (loading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#0b0f19',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          gap: '20px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '4px solid rgba(255,255,255,0.12)',
            borderTopColor: '#6366f1',
            animation: 'classroomSpin 0.8s linear infinite',
          }}
        />
        <style>{`
          @keyframes classroomSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>Verifying Classroom Access…</h2>
          <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
            Checking course enrollment and connecting to OneTutor secure classroom
          </p>
        </div>
      </div>
    );
  }

  // 2. Access Denied / Enrollment Required screen
  if (error || !joinInfo) {
    const isEnrollmentError = errorCode === 'ENROLLMENT_REQUIRED';

    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#0b0f19',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            background: '#1e293b',
            borderRadius: '16px',
            padding: '36px',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
            textAlign: 'center',
            color: '#ffffff',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: isEnrollmentError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <i
              className={`fa-solid ${isEnrollmentError ? 'fa-lock' : 'fa-triangle-exclamation'}`}
              style={{ fontSize: '1.8rem', color: isEnrollmentError ? '#ef4444' : '#f59e0b' }}
            />
          </div>

          <h2 style={{ margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 800 }}>
            {isEnrollmentError ? 'Course Enrollment Required' : 'Unable to Join Classroom'}
          </h2>

          <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.55, margin: '0 0 28px' }}>
            {error || 'You do not have permission to join this live classroom.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {joinInfo?.courseId ? (
              <Link
                to={`/student/courses/${joinInfo.courseId}`}
                className="btn btn-primary"
                style={{ padding: '12px 20px', fontSize: '0.95rem', justifyContent: 'center' }}
              >
                <i className="fa-solid fa-graduation-cap" style={{ marginRight: '8px' }} />
                View & Enroll in Course
              </Link>
            ) : null}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLeave}
              style={{ padding: '12px 20px', fontSize: '0.95rem', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-arrow-left" style={{ marginRight: '8px' }} />
              {role === 'admin' ? 'Return to Live Sessions' : 'Return to Live Classes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Live Classroom Environment
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#090d16',
        overflow: 'hidden',
      }}
    >
      {/* Top Classroom Control Bar */}
      <header
        style={{
          height: '60px',
          background: 'linear-gradient(90deg, #0f172a 0%, #1e1b4b 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          color: '#ffffff',
          zIndex: 20,
          flexShrink: 0,
        }}
      >
        {/* Left: Leave & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
          <button
            type="button"
            onClick={handleLeave}
            className="btn btn-sm btn-secondary"
            style={{
              padding: '6px 14px',
              fontSize: '0.84rem',
              fontWeight: 700,
              gap: '6px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.1)',
              borderColor: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
            }}
            title="Leave classroom and return to OneTutor"
          >
            <i className="fa-solid fa-arrow-left" />
            <span>Leave Classroom</span>
          </button>

          <div style={{ height: '24px', width: '1px', background: 'rgba(255,255,255,0.15)' }} />

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '340px',
                }}
              >
                {joinInfo.title}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.78rem',
                color: '#94a3b8',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '340px',
              }}
            >
              Course: <strong style={{ color: '#cbd5e1' }}>{joinInfo.courseName}</strong>
            </div>
          </div>
        </div>

        {/* Right: Badges & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Glowing Red Live Indicator */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '20px',
              color: '#ef4444',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.5px',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 8px #ef4444',
                animation: 'pulseDot 1.5s infinite',
              }}
            />
            <style>{`
              @keyframes pulseDot {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.3); opacity: 0.6; }
              }
            `}</style>
            <span>LIVE NOW</span>
          </div>

          {/* Role badge */}
          <div
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: joinInfo.isModerator ? 'rgba(99, 102, 241, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              border: `1px solid ${joinInfo.isModerator ? 'rgba(99, 102, 241, 0.5)' : 'rgba(16, 185, 129, 0.5)'}`,
              color: joinInfo.isModerator ? '#a5b4fc' : '#6ee7b7',
            }}
          >
            <i className={`fa-solid ${joinInfo.isModerator ? 'fa-shield-halved' : 'fa-user-graduate'}`} style={{ marginRight: '5px' }} />
            {joinInfo.isModerator ? 'Host / Moderator' : 'Enrolled Student'}
          </div>
        </div>
      </header>

      {/* Main Jitsi Meeting Embedded Container */}
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <JitsiMeetClassroom
          domain={joinInfo.domain || 'meet.jit.si'}
          roomName={joinInfo.roomName}
          userDisplayName={joinInfo.userDisplayName || user?.name || 'OneTutor User'}
          userEmail={joinInfo.userEmail || user?.email || ''}
          isModerator={joinInfo.isModerator}
          onLeave={handleLeave}
        />
      </main>
    </div>
  );
}
