import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  const categories = [
    { icon: 'fa-user-gear', title: 'Account & Profile', count: '8 articles', desc: 'Managing email, password reset, profile images, and session security.' },
    { icon: 'fa-book-bookmark', title: 'Course Enrollment', count: '12 articles', desc: 'Self-enrollment, course access rights, and category catalog exploration.' },
    { icon: 'fa-circle-play', title: 'Video & Progress', count: '10 articles', desc: 'Debounced position resume, 80% completion rule, and playback troubleshooting.' },
    { icon: 'fa-tower-broadcast', title: 'Live Classes & Community', count: '9 articles', desc: 'Joining live WebRTC sessions, live chat moderation, and notifications.' },
  ];

  const faqs = [
    {
      q: 'How does the 80% video progress engine work?',
      a: 'OneTutor automatically tracks your playback position every 10 seconds. When you reach 80% completion of any video lesson, the content is automatically marked as completed in your student dashboard progress bar.',
    },
    {
      q: 'Can I resume my video from where I left off on another device?',
      a: 'Yes! Your exact playback timestamp is saved to PostgreSQL. When you reopen the course on mobile or tablet, your video will instantly prompt you to resume right where you left off.',
    },
    {
      q: 'How do I join a scheduled Live Class?',
      a: 'Navigate to "Live Classes" in your top menu bar. Any active or upcoming session will display a direct "Join Meeting" button 15 minutes before the scheduled start time.',
    },
    {
      q: 'What should I do if I forget my account password?',
      a: 'Click on "Log in" and select "Forgot Password". Enter your registered email address to receive an instant password reset link. In development environments, the token link is printed to the backend console.',
    },
    {
      q: 'How do I earn a course completion certificate?',
      a: 'Complete 100% of all section modules, video lessons, and downloadable resources. Once verified, a downloadable PDF certificate badge will generate on your course page.',
    },
  ];

  const filteredFaqs = searchQuery.trim() === ''
    ? faqs
    : faqs.filter(f => f.q.toLowerCase().includes(searchQuery.toLowerCase()) || f.a.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Header with Search */}
      <section
        style={{
          background: 'linear-gradient(180deg, #f7f9fa 0%, #ffffff 100%)',
          borderBottom: '1px solid #e2e8f0',
          padding: '64px 24px',
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
            <i className="fa-solid fa-life-ring"></i>
            <span>ONETUTOR KNOWLEDGE BASE</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3rem)', fontWeight: 900, color: 'var(--ud-black)', marginBottom: '20px' }}>
            How Can We Help You?
          </h1>

          <div style={{ position: 'relative', maxWidth: '600px', margin: '0 auto' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '1.1rem' }}></i>
            <input
              type="text"
              placeholder="Search help articles (e.g. video playback, live classes, password)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 20px 14px 50px',
                borderRadius: '30px',
                border: '1px solid #cbd5e1',
                fontSize: '1rem',
                boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section style={{ maxWidth: '1140px', margin: '50px auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
          {categories.map((c, idx) => (
            <div key={idx} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(164, 53, 240, 0.1)', color: 'var(--ud-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                  <i className={`fa-solid ${c.icon}`}></i>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>{c.count}</span>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '6px' }}>{c.title}</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--ud-gray)', lineHeight: 1.5, margin: 0 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQs Accordion */}
      <section style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '36px', boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--ud-black)', marginBottom: '24px' }}>
            Frequently Asked Questions
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredFaqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  style={{
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: isOpen ? 'rgba(164, 53, 240, 0.4)' : '#e2e8f0',
                    background: isOpen ? 'rgba(164, 53, 240, 0.03)' : '#ffffff',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                  }}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    style={{
                      width: '100%',
                      padding: '18px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      fontWeight: 800,
                      fontSize: '1rem',
                      color: 'var(--ud-black)',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{faq.q}</span>
                    <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ color: 'var(--ud-purple)', fontSize: '0.85rem' }}></i>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 20px 18px 20px', fontSize: '0.92rem', color: 'var(--ud-gray)', lineHeight: 1.6 }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '32px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--ud-gray)', marginBottom: '12px' }}>Still can't find what you're looking for?</p>
            <Link to="/contact" className="ud-btn-primary" style={{ padding: '10px 22px', fontSize: '0.9rem' }}>
              Contact OneTutor Support Team
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
