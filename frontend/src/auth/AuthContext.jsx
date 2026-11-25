import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, googleLogin as apiGoogleLogin, verifyLoginOtp as apiVerifyLoginOtp, getCurrentUser } from '../api/auth';
import { api } from '../api/client';
import FloatingAuthModal from '../components/FloatingAuthModal';

// Persist AuthContext instance across Vite Hot Module Replacement to prevent context splitting
const AuthContext = (typeof window !== 'undefined' && window.__OneTutorAuthContext)
  ? window.__OneTutorAuthContext
  : ((typeof window !== 'undefined') ? (window.__OneTutorAuthContext = createContext(null)) : createContext(null));

function sanitizeUser(u) {
  if (!u) return null;
  const name = u.name;
  if (!name || name.toLowerCase().includes('super admin')) {
    return { ...u, name: 'One Tutor' };
  }
  return u;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('onetutor_auth_user');
      return raw ? sanitizeUser(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Helper to persist or clear onetutor_auth_user in sync with state
  const updateStoredUser = (userData) => {
    try {
      const clean = sanitizeUser(userData);
      if (clean) {
        localStorage.setItem('onetutor_auth_user', JSON.stringify(clean));
      } else {
        localStorage.removeItem('onetutor_auth_user');
      }
    } catch (e) {}
  };

  // Floating Auth Modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login'); // 'login' | 'register' | 'forgot'
  const [authRedirectUrl, setAuthRedirectUrl] = useState(null);

  const openAuthModal = useCallback((tab = 'login', redirectUrl = null) => {
    setAuthModalTab(tab);
    setAuthRedirectUrl(redirectUrl);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const loadUser = useCallback(async () => {
    const hasToken = !!localStorage.getItem('accessToken');
    if (!hasToken) {
      setUser(null);
      updateStoredUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await getCurrentUser();
      const cleanMe = sanitizeUser(me);
      setUser(cleanMe);
      updateStoredUser(cleanMe);
    } catch {
      setUser(null);
      updateStoredUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    const handleSessionExpired = () => {
      setUser(null);
      updateStoredUser(null);
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [loadUser]);

  // Periodic heartbeat while logged in (keeps lastActiveAt fresh, and detects session invalidation)
  useEffect(() => {
    if (!user) return;

    let consecutiveFailures = 0;

    function sendHeartbeat() {
      // Don't send if tab is hidden in background
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      // If server is unreachable/offline, back off to avoid spamming errors
      if (consecutiveFailures > 2 && Math.random() > 0.25) {
        return;
      }

      api.post('/users/heartbeat')
        .then(() => {
          consecutiveFailures = 0;
        })
        .catch(() => {
          consecutiveFailures++;
        });
    }

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30_000);

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  const login = async (credentials) => {
    const data = await apiLogin(credentials);
    setUser(data.user);
    updateStoredUser(data.user);
    return data.user;
  };

  const loginWithGoogle = async (googlePayload) => {
    const data = await apiGoogleLogin(googlePayload);
    setUser(data.user);
    updateStoredUser(data.user);
    return data.user;
  };

  const loginWithOtp = async ({ email, otp }) => {
    const data = await apiVerifyLoginOtp({ email, otp });
    setUser(data.user);
    updateStoredUser(data.user);
    return data.user;
  };

  const setSessionUser = (userData) => {
    setUser(userData);
    updateStoredUser(userData);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    updateStoredUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      loginWithOtp,
      loginWithGoogle,
      setSessionUser,
      logout,
      refreshUser: loadUser,
      authModalOpen,
      authModalTab,
      setAuthModalTab,
      authRedirectUrl,
      setAuthRedirectUrl,
      openAuthModal,
      closeAuthModal
    }}>
      {children}
      <FloatingAuthModal />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      loading: false,
      authModalOpen: false,
      authModalTab: 'login',
      authRedirectUrl: null,
      setAuthModalTab: () => {},
      setAuthRedirectUrl: () => {},
      openAuthModal: () => {},
      closeAuthModal: () => {},
      login: async () => {},
      logout: async () => {},
      loginWithGoogle: async () => {},
      loginWithOtp: async () => {},
      setSessionUser: () => {},
      refreshUser: async () => {},
    };
  }
  return ctx;
}
