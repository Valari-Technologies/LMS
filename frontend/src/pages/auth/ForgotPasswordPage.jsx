import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { sendForgotPasswordOtp, verifyForgotPasswordOtp } from '../../api/auth';
import { useAuth } from '../../auth/AuthContext';

export default function ForgotPasswordPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [email, setEmail] = useState(location.state?.email || user?.email || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!email && (location.state?.email || user?.email)) {
      setEmail(location.state?.email || user?.email || '');
    }
  }, [user, location.state]);
  const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Password, 3: Success
  const [devOtpHint, setDevOtpHint] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
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

  // Step 1: Request OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await sendForgotPasswordOtp(email);
      if (res?.devOtp) {
        setDevOtpHint(res.devOtp);
      }
      setStep(2);
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to dispatch verification code. Please try again.');
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
      const res = await sendForgotPasswordOtp(email);
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

  // Step 2: Verify OTP and set new password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await verifyForgotPasswordOtp({
        email: email.trim(),
        otp: otp.trim(),
        newPassword
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification code. Please check and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {step === 1 && (
          <>
            <div className="auth-header">
              <div className="auth-icon-wrap">
                <i className="fa-solid fa-lock"></i>
              </div>
              <h1 className="auth-title">Forgot Password</h1>
              <p className="auth-subtitle">
                Enter your registered email address to receive a 6-digit verification code.
              </p>
            </div>

            {error && (
              <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSendOtp} className="auth-form">
              <div className="form-group">
                <label className="form-label">Account Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="name@organization.com"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem', marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                disabled={submitting}
              >
                <span>{submitting ? 'Sending code…' : 'Send Verification Code'}</span>
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            </form>

            <div className="auth-links" style={{ justifyContent: 'center' }}>
              <Link to="/login">← Back to Sign In</Link>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="auth-header">
              <div className="auth-icon-wrap" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                <i className="fa-solid fa-key"></i>
              </div>
              <h1 className="auth-title">Reset Your Password</h1>
              <p className="auth-subtitle">
                Enter the code sent to <br /><strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
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
                <span style={{ fontWeight: 700 }}>Reset Code: </span>
                <code style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{devOtpHint}</code>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="auth-form">
              <div className="form-group" style={{ textAlign: 'center' }}>
                <label className="form-label" style={{ marginBottom: '8px' }}>Enter 6-Digit Verification Code</label>
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
                <span>Didn't receive code?</span>
                <button
                  type="button"
                  className="otp-resend-btn"
                  onClick={handleResendOtp}
                  disabled={!canResend || submitting}
                >
                  {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">New Password (min 8 characters)</label>
                <div className="password-input-wrap">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    className="form-control" 
                    placeholder="••••••••"
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
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

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="form-control" 
                  placeholder="••••••••"
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  minLength={8}
                  required 
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem', marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                disabled={submitting || otp.length !== 6 || !newPassword}
              >
                <span>{submitting ? 'Updating Password…' : 'Reset Password'}</span>
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
                ← Change email
              </button>
            </form>
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div className="auth-icon-wrap" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <h1 className="auth-title">Password Reset Complete!</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '14px 0 24px 0', lineHeight: 1.6 }}>
              Your password has been successfully updated. You can now sign in with your new credentials.
            </p>
            <button 
              onClick={() => navigate('/login')} 
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px' }}
            >
              <span>Sign In Now</span>
              <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

