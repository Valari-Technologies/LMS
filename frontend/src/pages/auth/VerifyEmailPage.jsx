import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyEmail } from '../../api/auth';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token. Please click the exact link from your email.');
      return;
    }
    verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message || 'Your email has been verified successfully!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Email verification link is invalid or has expired.');
      });
  }, [params]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div 
          className="auth-icon-wrap"
          style={{
            background: status === 'success' 
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
              : status === 'error' 
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                : 'var(--accent-gradient)'
          }}
        >
          {status === 'verifying' ? '⏳' : status === 'success' ? '✓' : '✕'}
        </div>

        <h1 className="auth-title">Email Verification</h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: '14px 0 24px 0', lineHeight: 1.6 }}>
          {status === 'verifying' ? 'Please wait while we verify your email address credentials…' : message}
        </p>

        {status !== 'verifying' && (
          <Link 
            to="/login" 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {status === 'success' ? 'Proceed to Sign In →' : 'Return to Sign In'}
          </Link>
        )}
      </div>
    </div>
  );
}
