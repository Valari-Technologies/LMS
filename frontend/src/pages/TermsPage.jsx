import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsPage() {
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
            <i className="fa-solid fa-scale-balanced"></i>
            <span>LEGAL AGREEMENT</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2rem, 3.8vw, 2.8rem)', fontWeight: 900, color: 'var(--ud-black)', marginBottom: '10px' }}>
            OneTutor Terms of Service
          </h1>
          <p style={{ fontSize: '0.92rem', color: '#64748b', margin: 0 }}>
            Effective Date: January 1, 2026 • Last Updated: September 2026
          </p>
        </div>
      </section>

      <section style={{ maxWidth: '900px', margin: '48px auto 0 auto', padding: '0 24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '40px', boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: '32px', color: '#334155', lineHeight: 1.7, fontSize: '0.95rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>1. Acceptance of Terms</h2>
            <p style={{ margin: 0 }}>
              By creating an account or accessing any course content, video lectures, live masterclasses, or community features on <strong>OneTutor</strong>, you agree to be bound by these Terms of Service. If you do not agree, you must discontinue use of the platform immediately.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>2. Account Responsibilities & Security</h2>
            <p style={{ margin: 0 }}>
              You are responsible for maintaining the confidentiality of your login credentials. You may not transfer, share, or sell your OneTutor account credentials to third parties. Concurrent login activity detected from multiple geographical locations simultaneously may result in temporary account suspension.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>3. Course Content & Intellectual Property</h2>
            <p style={{ margin: 0 }}>
              All video recordings, code repositories, downloadable PDFs, and curriculum materials provided on OneTutor are the exclusive intellectual property of OneTutor and its respective instructors. You are granted a non-exclusive, non-transferable license for personal, non-commercial educational use only.
            </p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>4. Community Conduct Guidelines</h2>
            <p style={{ marginBottom: '10px' }}>When participating in course community channels or live session chats, you agree NOT to:</p>
            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Post offensive, harassing, discriminatory, or unlawful content.</li>
              <li>Spam community discussion boards or promote external commercial products.</li>
              <li>Share malicious scripts, malware, or vulnerability exploits.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>5. Termination & Modifications</h2>
            <p style={{ margin: 0 }}>
              OneTutor reserves the right to suspend or terminate accounts that violate our community conduct policies. We may update these terms periodically, and continued use of the platform constitutes acceptance of revised terms.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
