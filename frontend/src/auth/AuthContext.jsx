import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, googleLogin as apiGoogleLogin, verifyLoginOtp as apiVerifyLoginOtp, getCurrentUser } from '../api/auth';
import { api } from '../api/client';
import FloatingAuthModal from '../components/FloatingAuthModal';

// Persist AuthContext instance across Vite Hot Module Replacement to prevent context splitting
const AuthContext = (typeof window !== 'undefined' && window.__OneTutorAuthContext)
  ? window.__OneTutorAuthContext
  : ((typeof window !== 'undefined') ? (window.__OneTutorAuthContext = createContext(null)) : createContext(null));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
      return;
    }
    try {
      const me = await getCurrentUser();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    const handleSessionExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [loadUser]);

  // Periodic heartbeat while logged in (keeps lastActiveAt fresh, and instantly detects session invalidation from another device)
  useEffect(() => {
    if (!user) return;

    function sendHeartbeat() {
      api.post('/users/heartbeat').catch(() => {});
    }

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 3_000);

    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
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
    return data.user;
  };

  const loginWithGoogle = async (googlePayload) => {
    const data = await apiGoogleLogin(googlePayload);
    setUser(data.user);
    return data.user;
  };

  const loginWithOtp = async ({ email, otp }) => {
    const data = await apiVerifyLoginOtp({ email, otp });
    setUser(data.user);
    return data.user;
  };

  const setSessionUser = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
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
