import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '../../api/auth';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const token = params.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await resetPassword({ token, newPassword });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-icon-wrap" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <i className="fa-solid fa-check"></i>
          </div>
          <h1 className="auth-title">Password Reset Complete</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '14px 0 24px 0' }}>
            Your account password has been successfully updated. You can now sign in with your new credentials.
          </p>
          <button 
            onClick={() => navigate('/login')} 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>Sign In Now</span>
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon-wrap">
            <i className="fa-solid fa-key"></i>
          </div>
          <h1 className="auth-title">Set New Password</h1>
          <p className="auth-subtitle">Choose a new secure password for your account</p>
        </div>

        {error && (
          <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{error}</span>
          </div>
        )}

        {!token && (
          <div className="form-error">
            Missing reset token. Please request a new password reset link.
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">New Password (min 8 characters)</label>
            <input 
              type="password" 
              className="form-control" 
              placeholder="••••••••"
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              minLength={8} 
              required 
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1rem', marginTop: '6px' }}
            disabled={submitting || !token}
          >
            {submitting ? 'Updating Password…' : 'Save New Password →'}
          </button>
        </form>

        <div className="auth-links" style={{ justifyContent: 'center' }}>
          <Link to="/login">← Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}
