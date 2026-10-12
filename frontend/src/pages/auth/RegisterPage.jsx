import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendRegisterOtp, verifyRegisterOtp } from '../../api/auth';
import { useAuth } from '../../auth/AuthContext';
import GoogleAuthButton from '../../components/GoogleAuthButton';
import oneTutorBrandImg from '../../assets/images/oneTutorBrand.png';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: Info, 2: OTP Verification
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const { loginWithGoogle, setSessionUser } = useAuth();
  const navigate = useNavigate();
  const otpInputRef = useRef(null);

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  useEffect(() => {
    if (step === 2 && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Step 1: Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await sendRegisterOtp(form.email);
      if (res?.devOtp) {
        setDevOtpHint(res.devOtp);
      }
      setStep(2);
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      const details = err.response?.data?.details;
      const message = details ? Object.values(details)[0] : err.response?.data?.message;
      setError(message || 'Failed to send verification code. Please check your email and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await sendRegisterOtp(form.email);
      if (res?.devOtp) {
        setDevOtpHint(res.devOtp);
      }
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Verify OTP and create user
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const authData = await verifyRegisterOtp({
        name: form.name,
        email: form.email,
        password: form.password,
        otp: otp.trim()
      });
      setSessionUser(authData.user);
      navigate('/student');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification code. Please check and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Google Sign-up handler
  const handleGoogleSuccess = async (googlePayload) => {
    setSubmitting(true);
    setError('');
    try {
      const loggedUser = await loginWithGoogle(googlePayload);
      const isStaff = ['admin', 'super_admin', 'superadmin', 'content_creator', 'creator'].includes(loggedUser?.role?.toLowerCase());
      navigate(isStaff ? '/admin' : '/student');
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-up failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {step === 1 ? (
          <>
            <div className="auth-header">
              <div className="auth-icon-wrap" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
                <img src={oneTutorBrandImg} alt="OneTutor Logo" style={{ height: '48px', width: 'auto', objectFit: 'contain' }} />
              </div>
              <h1 className="auth-title">Create Account</h1>
              <p className="auth-subtitle">Sign up and start your interactive learning journey today</p>
            </div>

            {error && (
              <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}

            {/* Google Signup */}
            <GoogleAuthButton
              mode="signup"
              onAuthSuccess={handleGoogleSuccess}
              onError={(msg) => setError(msg)}
              disabled={submitting}
            />

            {/* Divider */}
            <div className="auth-divider">
              <span>or sign up with email</span>
            </div>

            <form onSubmit={handleSendOtp} className="auth-form">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  name="name"
                  className="form-control"
                  placeholder="Jane Doe"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  className="form-control"
                  placeholder="jane@organization.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password (min 8 characters)</label>
                <div className="password-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem', marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                disabled={submitting}
              >
                <span>{submitting ? 'Sending verification code…' : 'Continue & Verify Email'}</span>
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            </form>

            <div className="auth-links">
              <span style={{ color: 'var(--text-secondary)' }}>Already have an account?</span>
              <Link to="/login">Sign In</Link>
            </div>
          </>
        ) : (
          /* Step 2: OTP Verification */
          <>
            <div className="auth-header">
              <div className="auth-icon-wrap" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <i className="fa-solid fa-envelope"></i>
              </div>
              <h1 className="auth-title">Verify Your Email</h1>
              <p className="auth-subtitle">
                We sent a 6-digit code to <br /><strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong>
              </p>
            </div>

            {error && (
              <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}

            {devOtpHint && (
              <div style={{
                background: 'var(--accent-subtle)',
                border: '1px solid var(--accent-primary)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.84rem',
                color: 'var(--text-primary)',
                textAlign: 'center'
              }}>
                <span style={{ fontWeight: 700 }}>Verification Code: </span>
                <code style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{devOtpHint}</code>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="auth-form">
              <div className="form-group" style={{ textAlign: 'center' }}>
                <label className="form-label" style={{ marginBottom: '8px' }}>Enter 6-Digit Code</label>
                <input
                  ref={otpInputRef}
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  className="form-control"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    letterSpacing: '0.35em',
                    textAlign: 'center',
                    padding: '12px'
                  }}
                  required
                />
              </div>

              <div className="otp-resend-row">
                <span>Didn't get the code?</span>
                <button
                  type="button"
                  className="otp-resend-btn"
                  onClick={handleResendOtp}
                  disabled={!canResend || submitting}
                >
                  {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
                </button>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem', marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                disabled={submitting || otp.length !== 6}
              >
                <span>{submitting ? 'Verifying…' : 'Verify & Complete Signup'}</span>
                <i className="fa-solid fa-circle-check"></i>
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '6px'
                }}
              >
                ← Change email or name
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

