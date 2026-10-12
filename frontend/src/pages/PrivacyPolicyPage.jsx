import React from 'react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>
      <section
        style={{
          background: 'linear-gradient(180deg, #f7f9fa 0%, #ffffff 100%)',
          borderBottom: '1px solid #e2e8f0',
          padding: '56px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(164, 53, 240, 0.08)',
              border: '1px solid rgba(164, 53, 240, 0.2)',
              borderRadius: '999px',
              padding: '6px 16px',
              fontSize: '0.84rem',
              fontWeight: 700,
              color: 'var(--ud-purple)',
              marginBottom: '16px',
            }}
          >
            <i className="fa-solid fa-shield-halved"></i>
            <span>TRANSPARENCY & DATA PRIVACY</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2rem, 3.8vw, 2.8rem)', fontWeight: 900, color: 'var(--ud-black)', marginBottom: '10px' }}>
            OneTutor Privacy Policy
          </h1>
          <p style={{ fontSize: '0.92rem', color: '#64748b', margin: 0 }}>
            Effective Date: January 1, 2026 • Last Updated: September 2026
          </p>
        </div>
      </section>

      <section style={{ maxWidth: '900px', margin: '48px auto 0 auto', padding: '0 24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '40px', boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '32px', color: '#334155', lineHeight: 1.7, fontSize: '0.95rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>1. Introduction</h2>
            <p style={{ margin: 0 }}>
              At <strong>OneTutor</strong> ("we", "our", or "us"), we are committed to safeguarding your personal data and upholding your right to privacy. This Privacy Policy explains what information we collect, how we process and protect it when you use the OneTutor Learning Management System, our website, and mobile interfaces.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>2. Information We Collect</h2>
            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Account Registration:</strong> Name, email address, password hashes (BCrypt encrypted), and role permissions.</li>
              <li><strong>Course Progress & Analytics:</strong> Video playback resume timestamps, percentage completion, quiz scores, and certificate issuance records.</li>
              <li><strong>Technical Data:</strong> IP addresses, browser agent specs, device tokens for Firebase FCM push notifications, and access tokens.</li>
              <li><strong>Community Activity:</strong> Messages, files, and discussion posts shared within course community channels.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>3. How We Use Your Data</h2>
            <p style={{ marginBottom: '10px' }}>We process your information strictly for legitimate educational and service delivery purposes:</p>
            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>To provide seamless course delivery, video streaming, and resume-watching state.</li>
              <li>To issue real-time notifications regarding live classes, batch announcements, and community replies.</li>
              <li>To prevent fraudulent access and enforce stateless JWT security authentication.</li>
              <li>To generate aggregated, non-personally identifiable platform usage metrics.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>4. Data Security & Storage</h2>
            <p style={{ margin: 0 }}>
              All user passwords are stored using BCrypt salted hashing. Media assets and attachments are stored with UUID isolation in secure PostgreSQL databases. All network communication between your browser and OneTutor backend microservices is encrypted using TLS 1.3.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>5. Your Rights (GDPR & CCPA)</h2>
            <p style={{ margin: 0 }}>
              You have the right to request access to your personal profile data, request correction of inaccurate data, export your learning history, or request complete account deletion. To exercise any of these rights, contact us at <strong>privacy@onetutor.local</strong>.
            </p>
          </div>

          <div style={{ paddingTop: '20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Have questions about our privacy policy?</span>
            <Link to="/contact" className="ud-btn-secondary" style={{ padding: '8px 18px', fontSize: '0.86rem' }}>
              Contact Privacy Officer
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
