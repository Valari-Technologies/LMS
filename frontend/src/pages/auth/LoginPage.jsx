import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import GoogleAuthButton from '../../components/GoogleAuthButton';
import oneTutorBrandImg from '../../assets/images/oneTutorBrand.png';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [logoutNotice, setLogoutNotice] = useState(() => {
    const notice = sessionStorage.getItem('logoutNotice');
    if (notice) {
      sessionStorage.removeItem('logoutNotice');
      return notice;
    }
    return '';
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLogoutNotice('');
    setSubmitting(true);
    try {
      const user = await login({ email, password });
      const isStaff = ['admin', 'super_admin', 'superadmin', 'content_creator', 'creator', 'readonly_admin', 'read_only_admin'].includes(user?.role?.toLowerCase());
      navigate(redirect || (isStaff ? '/admin' : '/student'));
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please verify credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (googlePayload) => {
    setSubmitting(true);
    setError('');
    setLogoutNotice('');
    try {
      const user = await loginWithGoogle(googlePayload);
      const isStaff = ['admin', 'super_admin', 'superadmin', 'content_creator', 'creator', 'readonly_admin', 'read_only_admin'].includes(user?.role?.toLowerCase());
      navigate(redirect || (isStaff ? '/admin' : '/student'));
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon-wrap" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
            <img src={oneTutorBrandImg} alt="OneTutor Logo" style={{ height: '48px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <h1 className="auth-title">Log In to OneTutor</h1>
          <p className="auth-subtitle">Welcome back! Access your courses and learning progress</p>
        </div>

        {logoutNotice && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#ef4444',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md, 8px)',
            marginBottom: '20px',
            fontSize: '0.88rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '1.2rem', flexShrink: 0 }}></i>
            <div>{logoutNotice}</div>
          </div>
        )}

        {error && (
          <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign In Button */}
        <GoogleAuthButton
          mode="signin"
          onAuthSuccess={handleGoogleSuccess}
          onError={(msg) => setError(msg)}
          disabled={submitting}
        />


        {/* Divider */}
        <div className="auth-divider">
          <span>or log in with email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-control" 
              placeholder="name@organization.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label">Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>
            <div className="password-input-wrap">
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="form-control" 
                placeholder="••••••••"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
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
            <span>{submitting ? 'Authenticating…' : 'Sign In'}</span>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </form>

        {/* Quick Demo Fill Buttons */}
        <div style={{ marginTop: '20px', padding: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
            Quick fill demo accounts:
          </span>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button 
              type="button" 
              onClick={() => fillDemo('admin@onetutor.local', 'Admin@12345')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.76rem' }}
            >
              Demo Super Admin
            </button>
            <button 
              type="button" 
              onClick={() => fillDemo('creator@onetutor.local', 'Creator@12345')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.76rem' }}
            >
              Demo Content Creator
            </button>
            <button 
              type="button" 
              onClick={() => fillDemo('student@onetutor.local', 'Student@12345')}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.76rem' }}
            >
              Demo Student
            </button>
          </div>
        </div>

        <div className="auth-links">
          <span style={{ color: 'var(--text-secondary)' }}>Don't have an account?</span>
          <Link to={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'}>Sign up</Link>
        </div>

        <Link to="/" className="auth-back-home">
          <i className="fa-solid fa-arrow-left"></i>
          <span>Back to Home</span>
        </Link>
      </div>
    </div>
  );
}
