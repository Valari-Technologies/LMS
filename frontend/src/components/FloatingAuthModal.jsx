import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import GoogleAuthButton from './GoogleAuthButton';
import { sendRegisterOtp, verifyRegisterOtp, sendForgotPasswordOtp, verifyForgotPasswordOtp } from '../api/auth';
import oneTutorBrandImg from '../assets/images/oneTutorBrand.png';
import './FloatingAuthModal.css';

export default function FloatingAuthModal() {
  const {
    authModalOpen,
    closeAuthModal,
    authModalTab,
    setAuthModalTab,
    authRedirectUrl,
    login,
    loginWithGoogle,
    setSessionUser
  } = useAuth();

  const navigate = useNavigate();

  // Tab state: 'login' | 'register' | 'forgot'
  const activeTab = authModalTab || 'login';

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regStep, setRegStep] = useState(1); // 1: Form, 2: OTP
  const [regOtp, setRegOtp] = useState('');
  const [regDevOtp, setRegDevOtp] = useState('');
  const [regCountdown, setRegCountdown] = useState(60);
  const [regCanResend, setRegCanResend] = useState(false);

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP & New PW, 3: Success
  const [forgotDevOtp, setForgotDevOtp] = useState('');
  const [forgotCountdown, setForgotCountdown] = useState(60);
  const [forgotCanResend, setForgotCanResend] = useState(false);

  // Common status
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const regOtpRef = useRef(null);
  const forgotOtpRef = useRef(null);

  // Reset errors when switching tab
  useEffect(() => {
    setError('');
    setSuccessMsg('');
  }, [activeTab]);

  // Handle ESC key to close
  useEffect(() => {
    if (!authModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeAuthModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authModalOpen, closeAuthModal]);

  // Countdown timer for Register OTP
  useEffect(() => {
    let timer;
    if (regStep === 2 && regCountdown > 0) {
      timer = setInterval(() => {
        setRegCountdown((p) => {
          if (p <= 1) {
            setRegCanResend(true);
            return 0;
          }
          return p - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [regStep, regCountdown]);

  // Countdown timer for Forgot OTP
  useEffect(() => {
    let timer;
    if (forgotStep === 2 && forgotCountdown > 0) {
      timer = setInterval(() => {
        setForgotCountdown((p) => {
          if (p <= 1) {
            setForgotCanResend(true);
            return 0;
          }
          return p - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [forgotStep, forgotCountdown]);

  if (!authModalOpen) return null;

  // --- LOGIN HANDLERS ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login({ email: loginEmail, password: loginPassword });
      closeAuthModal();
      const isStaff = ['admin', 'super_admin', 'superadmin', 'content_creator', 'creator', 'readonly_admin', 'read_only_admin'].includes(user?.role?.toLowerCase());
      if (authRedirectUrl) {
        navigate(authRedirectUrl);
      } else if (isStaff) {
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (googlePayload) => {
    setSubmitting(true);
    setError('');
    try {
      const user = await loginWithGoogle(googlePayload);
      closeAuthModal();
      const isStaff = ['admin', 'super_admin', 'superadmin', 'content_creator', 'creator', 'readonly_admin', 'read_only_admin'].includes(user?.role?.toLowerCase());
      if (authRedirectUrl) {
        navigate(authRedirectUrl);
      } else if (isStaff) {
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (email, pass) => {
    setLoginEmail(email);
    setLoginPassword(pass);
    setError('');
  };

  // --- REGISTER HANDLERS ---
  const handleRegisterSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await sendRegisterOtp(regEmail);
      if (res?.devOtp) setRegDevOtp(res.devOtp);
      setRegStep(2);
      setRegCountdown(60);
      setRegCanResend(false);
    } catch (err) {
      const details = err.response?.data?.details;
      const msg = details ? Object.values(details)[0] : err.response?.data?.message;
      setError(msg || 'Failed to dispatch verification code. Please check your email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterResendOtp = async () => {
    if (!regCanResend) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await sendRegisterOtp(regEmail);
      if (res?.devOtp) setRegDevOtp(res.devOtp);
      setRegCountdown(60);
      setRegCanResend(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterVerifyOtp = async (e) => {
    e.preventDefault();
    if (regOtp.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const authData = await verifyRegisterOtp({
        name: regName,
        email: regEmail,
        password: regPassword,
        otp: regOtp.trim()
      });
      setSessionUser(authData.user);
      closeAuthModal();
      if (authRedirectUrl) {
        navigate(authRedirectUrl);
      } else {
        navigate('/student');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- FORGOT PASSWORD HANDLERS ---
  const handleForgotSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await sendForgotPasswordOtp(forgotEmail);
      if (res?.devOtp) setForgotDevOtp(res.devOtp);
      setForgotStep(2);
      setForgotCountdown(60);
      setForgotCanResend(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send recovery code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotResendOtp = async () => {
    if (!forgotCanResend) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await sendForgotPasswordOtp(forgotEmail);
      if (res?.devOtp) setForgotDevOtp(res.devOtp);
      setForgotCountdown(60);
      setForgotCanResend(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotResetPassword = async (e) => {
    e.preventDefault();
    if (forgotOtp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (forgotNewPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await verifyForgotPasswordOtp({
        email: forgotEmail,
        otp: forgotOtp.trim(),
        newPassword: forgotNewPassword
      });
      setForgotStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ot-auth-modal-overlay" onClick={closeAuthModal}>
      <div className="ot-auth-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          type="button"
          className="ot-auth-close-btn"
          onClick={closeAuthModal}
          aria-label="Close authentication modal"
          title="Close (Esc)"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {/* Header Logo & Title */}
        <div className="ot-auth-header">
          <img src={oneTutorBrandImg} alt="OneTutor" className="ot-auth-logo" />
          <h2 className="ot-auth-title">
            {activeTab === 'login' && 'Welcome Back'}
            {activeTab === 'register' && 'Create Your Account'}
            {activeTab === 'forgot' && 'Reset Password'}
          </h2>
          <p className="ot-auth-subtitle">
            {activeTab === 'login' && 'Sign in to access your courses, progress, and certificates'}
            {activeTab === 'register' && 'Join thousands of learners on OneTutor today'}
            {activeTab === 'forgot' && 'Follow the steps to securely recover your account'}
          </p>
        </div>

        {/* Tab Switcher (Sign In vs Create Account) */}
        {activeTab !== 'forgot' && (
          <div className="ot-auth-tabs">
            <button
              type="button"
              className={`ot-auth-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => { setAuthModalTab('login'); setError(''); }}
            >
              <i className="fa-solid fa-arrow-right-to-bracket"></i>
              <span>Sign In</span>
            </button>
            <button
              type="button"
              className={`ot-auth-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => { setAuthModalTab('register'); setError(''); }}
            >
              <i className="fa-solid fa-user-plus"></i>
              <span>Sign Up</span>
            </button>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="ot-auth-error">
            <i className="fa-solid fa-circle-exclamation" style={{ marginTop: '2px', flexShrink: 0 }}></i>
            <div>{error}</div>
          </div>
        )}
        {successMsg && (
          <div className="ot-auth-success">
            <i className="fa-solid fa-circle-check" style={{ marginTop: '2px', flexShrink: 0 }}></i>
            <div>{successMsg}</div>
          </div>
        )}

        {/* ========================================================
            TAB 1: SIGN IN (LOGIN)
           ======================================================== */}
        {activeTab === 'login' && (
          <div className="ot-auth-tab-content">
            <GoogleAuthButton
              mode="signin"
              onAuthSuccess={handleGoogleSuccess}
              onError={(msg) => setError(msg)}
              disabled={submitting}
            />

            <div className="ot-auth-divider">
              <span>or sign in with email</span>
            </div>

            <form onSubmit={handleLoginSubmit}>
              <div className="ot-auth-form-group">
                <label className="ot-auth-label">Email Address</label>
                <div className="ot-auth-input-wrap">
                  <input
                    type="email"
                    className="ot-auth-input"
                    placeholder="student@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="ot-auth-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="ot-auth-label" style={{ margin: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => { setAuthModalTab('forgot'); setForgotEmail(loginEmail); setError(''); }}
                    className="ot-auth-link-btn"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="ot-auth-input-wrap">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    className="ot-auth-input"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="ot-auth-pw-toggle"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fa-solid ${showLoginPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <button type="submit" className="ot-auth-submit-btn" disabled={submitting}>
                <span>{submitting ? 'Signing In…' : 'Sign In'}</span>
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            </form>

            {/* Quick Demo Fill Buttons */}
            <div className="ot-auth-demo-box">
              <span className="ot-auth-demo-label">Quick Fill Demo Roles:</span>
              <div className="ot-auth-demo-btns">
                <button
                  type="button"
                  onClick={() => fillDemo('admin@onetutor.local', 'Admin@12345')}
                  className="ot-auth-demo-pill"
                >
                  ⚡ Admin
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('creator@onetutor.local', 'Creator@12345')}
                  className="ot-auth-demo-pill"
                >
                  ⚡ Creator
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('student@onetutor.local', 'Student@12345')}
                  className="ot-auth-demo-pill"
                >
                  ⚡ Student
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '0.86rem', color: '#64748b' }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setAuthModalTab('register'); setError(''); }}
                className="ot-auth-link-btn"
                style={{ fontWeight: 700 }}
              >
                Sign Up
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2: CREATE ACCOUNT (REGISTER)
           ======================================================== */}
        {activeTab === 'register' && (
          <div className="ot-auth-tab-content">
            {regStep === 1 ? (
              <>
                <GoogleAuthButton
                  mode="signup"
                  onAuthSuccess={handleGoogleSuccess}
                  onError={(msg) => setError(msg)}
                  disabled={submitting}
                />

                <div className="ot-auth-divider">
                  <span>or register with email</span>
                </div>

                <form onSubmit={handleRegisterSendOtp}>
                  <div className="ot-auth-form-group">
                    <label className="ot-auth-label">Full Name</label>
                    <input
                      type="text"
                      className="ot-auth-input"
                      placeholder="Surya Prakash"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="ot-auth-form-group">
                    <label className="ot-auth-label">Email Address</label>
                    <input
                      type="email"
                      className="ot-auth-input"
                      placeholder="name@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="ot-auth-form-group">
                    <label className="ot-auth-label">Password (min. 8 characters)</label>
                    <div className="ot-auth-input-wrap">
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        className="ot-auth-input"
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="ot-auth-pw-toggle"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                      >
                        <i className={`fa-solid ${showRegPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="ot-auth-submit-btn" disabled={submitting}>
                    <span>{submitting ? 'Sending Code…' : 'Continue with Email'}</span>
                    <i className="fa-solid fa-arrow-right"></i>
                  </button>
                </form>
              </>
            ) : (
              <form onSubmit={handleRegisterVerifyOtp}>
                <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                  <span style={{ fontSize: '2.4rem', display: 'block', marginBottom: '8px' }}>📬</span>
                  <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                    We sent a 6-digit verification code to <strong style={{ color: '#0f172a' }}>{regEmail}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="ot-auth-link-btn"
                    style={{ marginTop: '4px' }}
                  >
                    Change email
                  </button>
                </div>

                {regDevOtp && (
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '8px 12px', color: '#92400e', fontSize: '0.8rem', textAlign: 'center', marginBottom: '16px' }}>
                    ⚡ Dev Code: <strong>{regDevOtp}</strong>{' '}
                    <button
                      type="button"
                      onClick={() => setRegOtp(regDevOtp)}
                      style={{ background: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontWeight: 700, cursor: 'pointer', marginLeft: '6px' }}
                    >
                      Fill
                    </button>
                  </div>
                )}

                <div className="ot-auth-form-group">
                  <label className="ot-auth-label" style={{ textAlign: 'center' }}>Enter 6-Digit Code</label>
                  <input
                    ref={regOtpRef}
                    type="text"
                    maxLength={6}
                    className="ot-auth-input ot-auth-otp-input"
                    placeholder="••••••"
                    value={regOtp}
                    onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '0.82rem' }}>
                  <span style={{ color: '#64748b' }}>
                    {regCountdown > 0 ? `Resend code in ${regCountdown}s` : 'Did not receive code?'}
                  </span>
                  <button
                    type="button"
                    onClick={handleRegisterResendOtp}
                    disabled={!regCanResend || submitting}
                    className="ot-auth-link-btn"
                    style={{ color: regCanResend ? '#4f46e5' : '#94a3b8', fontWeight: 700, cursor: regCanResend ? 'pointer' : 'not-allowed' }}
                  >
                    Resend Code
                  </button>
                </div>

                <button type="submit" className="ot-auth-submit-btn" disabled={submitting || regOtp.length !== 6}>
                  <span>{submitting ? 'Verifying…' : 'Complete Registration'}</span>
                  <i className="fa-solid fa-check"></i>
                </button>
              </form>
            )}

            <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '0.86rem', color: '#64748b' }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setAuthModalTab('login'); setError(''); }}
                className="ot-auth-link-btn"
                style={{ fontWeight: 700 }}
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: FORGOT PASSWORD
           ======================================================== */}
        {activeTab === 'forgot' && (
          <div className="ot-auth-tab-content">
            {forgotStep === 1 && (
              <form onSubmit={handleForgotSendOtp}>
                <div className="ot-auth-form-group">
                  <label className="ot-auth-label">Registered Email</label>
                  <input
                    type="email"
                    className="ot-auth-input"
                    placeholder="name@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <button type="submit" className="ot-auth-submit-btn" disabled={submitting}>
                  <span>{submitting ? 'Dispatching…' : 'Send Recovery Code'}</span>
                  <i className="fa-solid fa-paper-plane"></i>
                </button>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleForgotResetPassword}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
                    Enter verification code sent to <strong style={{ color: '#0f172a' }}>{forgotEmail}</strong>
                  </p>
                </div>

                {forgotDevOtp && (
                  <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '8px 12px', color: '#92400e', fontSize: '0.8rem', textAlign: 'center', marginBottom: '16px' }}>
                    ⚡ Dev Code: <strong>{forgotDevOtp}</strong>{' '}
                    <button
                      type="button"
                      onClick={() => setForgotOtp(forgotDevOtp)}
                      style={{ background: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '4px', padding: '2px 8px', fontWeight: 700, cursor: 'pointer', marginLeft: '6px' }}
                    >
                      Fill
                    </button>
                  </div>
                )}

                <div className="ot-auth-form-group">
                  <label className="ot-auth-label">6-Digit Code</label>
                  <input
                    ref={forgotOtpRef}
                    type="text"
                    maxLength={6}
                    className="ot-auth-input ot-auth-otp-input"
                    placeholder="••••••"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>

                <div className="ot-auth-form-group">
                  <label className="ot-auth-label">New Password (min. 8 characters)</label>
                  <div className="ot-auth-input-wrap">
                    <input
                      type={showForgotPw ? 'text' : 'password'}
                      className="ot-auth-input"
                      placeholder="••••••••"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="ot-auth-pw-toggle"
                      onClick={() => setShowForgotPw(!showForgotPw)}
                    >
                      <i className={`fa-solid ${showForgotPw ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div className="ot-auth-form-group">
                  <label className="ot-auth-label">Confirm New Password</label>
                  <input
                    type={showForgotPw ? 'text' : 'password'}
                    className="ot-auth-input"
                    placeholder="••••••••"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '0.82rem' }}>
                  <span style={{ color: '#64748b' }}>
                    {forgotCountdown > 0 ? `Resend in ${forgotCountdown}s` : 'Did not receive code?'}
                  </span>
                  <button
                    type="button"
                    onClick={handleForgotResendOtp}
                    disabled={!forgotCanResend || submitting}
                    className="ot-auth-link-btn"
                    style={{ color: forgotCanResend ? '#4f46e5' : '#94a3b8', fontWeight: 700, cursor: forgotCanResend ? 'pointer' : 'not-allowed' }}
                  >
                    Resend Code
                  </button>
                </div>

                <button type="submit" className="ot-auth-submit-btn" disabled={submitting || forgotOtp.length !== 6}>
                  <span>{submitting ? 'Updating Password…' : 'Reset Password & Proceed'}</span>
                  <i className="fa-solid fa-lock"></i>
                </button>
              </form>
            )}

            {forgotStep === 3 && (
              <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                <span style={{ fontSize: '3rem', color: '#10b981', display: 'block', marginBottom: '12px' }}>
                  <i className="fa-solid fa-circle-check"></i>
                </span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px', color: '#0f172a' }}>
                  Password Reset Successfully!
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '20px' }}>
                  Your password has been securely updated. You can now sign in with your new password.
                </p>
                <button
                  type="button"
                  className="ot-auth-submit-btn"
                  onClick={() => {
                    setAuthModalTab('login');
                    setLoginEmail(forgotEmail);
                    setForgotStep(1);
                    setForgotOtp('');
                    setForgotNewPassword('');
                    setForgotConfirmPassword('');
                  }}
                >
                  <span>Sign In Now</span>
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '0.86rem' }}>
              <button
                type="button"
                onClick={() => { setAuthModalTab('login'); setError(''); }}
                className="ot-auth-link-btn"
                style={{ fontWeight: 700 }}
              >
                ← Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
