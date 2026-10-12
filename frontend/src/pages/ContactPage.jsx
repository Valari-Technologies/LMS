import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { submitContactMessage, getMyContactMessages } from '../api/contact';
import { useAuth } from '../auth/AuthContext';

export default function ContactPage() {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Enquiry',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Past inquiries history for authenticated users
  const [myInquiries, setMyInquiries] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'

  // Pre-fill user information if authenticated
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || user.name || '',
        email: prev.email || user.email || ''
      }));
      loadMyInquiries();
    }
  }, [user]);

  async function loadMyInquiries() {
    setLoadingHistory(true);
    try {
      const list = await getMyContactMessages();
      setMyInquiries(list || []);
    } catch (e) {
      console.error('Failed to load user inquiries', e);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage('');
    setSubmitting(true);

    try {
      const res = await submitContactMessage(formData);
      setSubmittedData(res?.data || { ...formData, id: 'NEW' });
      setFormData({
        name: user?.name || '',
        email: user?.email || '',
        subject: 'General Enquiry',
        message: ''
      });
      if (user) {
        loadMyInquiries();
      }
    } catch (err) {
      console.error('Failed to submit contact message', err);
      setErrorMessage(
        err?.response?.data?.message ||
        'Unable to send message at this moment. Please verify your details or try again later.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ot-contact-wrapper">
      {/* Header */}
      <section className="ot-contact-header">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="ot-contact-header-badge">
            <i className="fa-solid fa-headset"></i>
            <span>24/7 SUPPORT & ASSISTANCE</span>
          </div>
          <h1 className="ot-contact-title">
            We're Here to Help You Succeed.
          </h1>
          <p className="ot-contact-subtitle">
            Have a question about a course, technical issues, or corporate enterprise licensing? Reach out directly to the OneTutor team.
          </p>
        </div>
      </section>

      {/* Main Container */}
      <section className="ot-contact-container">
        {/* Toggle between Send Inquiry and My Past Inquiries if logged in */}
        {user && (
          <div className="ot-contact-tabs-outer">
            <div className="ot-contact-tabs-pill">
              <button
                type="button"
                onClick={() => setActiveTab('new')}
                className={`ot-contact-tab-btn ${activeTab === 'new' ? 'active' : ''}`}
              >
                <i className="fa-solid fa-paper-plane" style={{ color: activeTab === 'new' ? '#5A70D3' : 'inherit' }}></i>
                <span>Send Message</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('history');
                  loadMyInquiries();
                }}
                className={`ot-contact-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              >
                <i className="fa-solid fa-clock-rotate-left" style={{ color: activeTab === 'history' ? '#5A70D3' : 'inherit' }}></i>
                <span>My Inquiries {myInquiries.length > 0 ? `(${myInquiries.length})` : ''}</span>
                {myInquiries.some(i => i.status === 'REPLIED') && (
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }}></span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: My Inquiries History (for logged in students) */}
        {user && activeTab === 'history' ? (
          <div className="ot-contact-inquiries-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0b1f3a', margin: '0 0 4px 0' }}>
                  Your Support Tickets & Official Replies
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>
                  Review all inquiries submitted from your account and read official responses from administrators.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('new')}
                className="ud-btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.86rem', borderRadius: '8px' }}
              >
                <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i>
                <span>New Inquiry</span>
              </button>
            </div>

            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.8rem', color: '#5A70D3', marginBottom: '12px' }}></i>
                <div>Loading your inquiries...</div>
              </div>
            ) : myInquiries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 0', color: '#64748b' }}>
                <i className="fa-regular fa-comments" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '12px' }}></i>
                <p>You have not submitted any inquiries yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {myInquiries.map(inq => (
                  <div
                    key={inq.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '16px 18px',
                      background: inq.status === 'REPLIED' ? 'rgba(16, 185, 129, 0.02)' : '#ffffff'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: '#e0e7ff',
                          color: '#4338ca',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}>
                          {inq.subject}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          Ticket #{inq.id} • {new Date(inq.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {inq.status === 'REPLIED' ? (
                        <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: '0.74rem', padding: '3px 9px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-solid fa-check"></i>
                          <span>Replied</span>
                        </span>
                      ) : (
                        <span style={{ background: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: '0.74rem', padding: '3px 9px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d97706' }}></span>
                          <span>In Review</span>
                        </span>
                      )}
                    </div>

                    <div style={{ color: '#1e293b', fontSize: '0.92rem', lineHeight: 1.55, marginBottom: inq.replyMessage ? '14px' : '0' }}>
                      {inq.message}
                    </div>

                    {/* Admin Response Box */}
                    {inq.replyMessage ? (
                      <div style={{
                        marginTop: '12px',
                        padding: '14px 16px',
                        background: '#f8fafc',
                        borderLeft: '4px solid #5A70D3',
                        borderRadius: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ fontWeight: 800, color: '#5A70D3', fontSize: '0.78rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-reply"></i>
                            <span>Official Response from {inq.repliedByName || 'Support Team'}</span>
                          </div>
                          {inq.repliedAt && (
                            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                              {new Date(inq.repliedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#0b1f3a', fontSize: '0.9rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                          {inq.replyMessage}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-hourglass-half" style={{ color: '#d97706', fontSize: '0.75rem' }}></i>
                        <span>An administrator will review your message and reply via email to {inq.email}.</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Tab 1: Form Card (Prominent / First) + Contact Sidebar */
          <div className="ot-contact-grid">
            {/* Form Card (Desktop Left / Mobile Top) */}
            <div className="ot-contact-form-card">
              {submittedData ? (
                <div style={{ textAlign: 'center', padding: '24px 8px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.2rem',
                    margin: '0 auto 16px auto'
                  }}>
                    <i className="fa-solid fa-circle-check"></i>
                  </div>
                  <h3 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 8px 0', color: '#0b1f3a' }}>
                    Inquiry Submitted Successfully!
                  </h3>
                  <div style={{
                    display: 'inline-block',
                    background: '#e0e7ff',
                    color: '#4338ca',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    padding: '4px 12px',
                    borderRadius: '999px',
                    marginBottom: '14px'
                  }}>
                    Ticket Ref: #{submittedData.id}
                  </div>
                  <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: 1.55, maxWidth: '440px', margin: '0 auto 20px auto' }}>
                    Thank you, <strong>{submittedData.name}</strong>. A support specialist has received your message regarding <em>"{submittedData.subject}"</em> and will reply to <strong>{submittedData.email}</strong>.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setSubmittedData(null)}
                      className="ud-btn-secondary"
                      style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '0.88rem' }}
                    >
                      <span>Submit Another Message</span>
                    </button>
                    {user && (
                      <button
                        type="button"
                        onClick={() => {
                          setSubmittedData(null);
                          setActiveTab('history');
                          loadMyInquiries();
                        }}
                        className="ud-btn-primary"
                        style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '0.88rem' }}
                      >
                        <span>View My Inquiries</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--ud-black)', margin: 0 }}>
                      Send Us a Message
                    </h3>
                    <span style={{ fontSize: '0.76rem', color: '#64748b' }}>* All fields required</span>
                  </div>

                  {errorMessage && (
                    <div style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '0.86rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <i className="fa-solid fa-triangle-exclamation"></i>
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                      <span>Your Name *</span>
                      {user && (
                        <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-solid fa-lock" style={{ fontSize: '0.66rem', color: '#94a3b8' }}></i>
                          <span>Signed in</span>
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={Boolean(user)}
                      placeholder="e.g. Alex Morgan"
                      value={formData.name}
                      onChange={e => !user && setFormData({ ...formData, name: e.target.value })}
                      className="ot-contact-field-input"
                      style={{
                        background: user ? '#f1f5f9' : '#ffffff',
                        color: user ? '#475569' : '#0b1f3a',
                        cursor: user ? 'not-allowed' : 'text'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                      <span>Email Address *</span>
                      {user && (
                        <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <i className="fa-solid fa-lock" style={{ fontSize: '0.66rem', color: '#94a3b8' }}></i>
                          <span>Verified</span>
                        </span>
                      )}
                    </label>
                    <input
                      type="email"
                      required
                      readOnly={Boolean(user)}
                      placeholder="e.g. alex@example.com"
                      value={formData.email}
                      onChange={e => !user && setFormData({ ...formData, email: e.target.value })}
                      className="ot-contact-field-input"
                      style={{
                        background: user ? '#f1f5f9' : '#ffffff',
                        color: user ? '#475569' : '#0b1f3a',
                        cursor: user ? 'not-allowed' : 'text'
                      }}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                      Administrator responses will be delivered directly to this email address.
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Topic *</label>
                    <select
                      value={formData.subject}
                      onChange={e => setFormData({ ...formData, subject: e.target.value })}
                      className="ot-contact-field-input"
                      style={{ background: '#ffffff', cursor: 'pointer' }}
                    >
                      <option>General Enquiry</option>
                      <option>Course Enrollment & Billing</option>
                      <option>Technical Issue / Bug Report</option>
                      <option>Instructor & Teaching Partnerships</option>
                      <option>Enterprise & Corporate Licensing</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Message *</label>
                    <textarea
                      required
                      rows="5"
                      placeholder="How can we help you today? Please provide as much detail as possible..."
                      value={formData.message}
                      onChange={e => setFormData({ ...formData, message: e.target.value })}
                      className="ot-contact-field-input"
                      style={{ resize: 'vertical', minHeight: '110px' }}
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="ud-btn-primary"
                    style={{
                      width: '100%',
                      padding: '13px',
                      justifyContent: 'center',
                      fontSize: '0.95rem',
                      borderRadius: '10px',
                      minHeight: '48px'
                    }}
                  >
                    {submitting ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                        <span>Sending Message...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Message</span>
                        <i className="fa-solid fa-paper-plane" style={{ fontSize: '0.85rem' }}></i>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Sidebar Cards (Desktop Right / Mobile Bottom) */}
            <div className="ot-contact-sidebar">
              {/* Contact Information */}
              <div className="ot-contact-info-card">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '18px' }}>
                  Contact Information
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Email */}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(90, 112, 211, 0.1)', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', flexShrink: 0 }}>
                      <i className="fa-solid fa-envelope"></i>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ud-gray)', textTransform: 'uppercase' }}>Email Support</div>
                      <a href="mailto:support@onetutor.com" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ud-black)', textDecoration: 'none', display: 'inline-block', marginTop: '1px' }}>
                        support@onetutor.com
                      </a>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Response time: within 2 hours</div>
                    </div>
                  </div>

                  {/* Phone */}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', flexShrink: 0 }}>
                      <i className="fa-solid fa-phone"></i>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ud-gray)', textTransform: 'uppercase' }}>Call Support</div>
                      <a href="tel:+18005556638" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ud-black)', textDecoration: 'none', display: 'inline-block', marginTop: '1px' }}>
                        +1 (800) 555-ONETUTOR
                      </a>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>Mon – Fri, 9am – 6pm EST</div>
                    </div>
                  </div>

                  {/* Headquarters */}
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', flexShrink: 0 }}>
                      <i className="fa-solid fa-location-dot"></i>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ud-gray)', textTransform: 'uppercase' }}>Global Headquarters</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ud-black)', marginTop: '1px' }}>OneTutor Technology Tower</div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>500 Innovation Way, Suite 1200<br />San Francisco, CA 94105</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instant Assistance */}
              <div className="ot-contact-info-card">
                <h4 style={{ fontSize: '1.08rem', fontWeight: 800, marginBottom: '12px', color: 'var(--ud-black)' }}>Instant Assistance</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Link to="/help-center" style={{ color: '#5A70D3', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-circle-question"></i>
                    <span>Browse OneTutor Help Center & FAQ</span>
                  </Link>
                  <Link to="/system-status" style={{ color: '#059669', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-server"></i>
                    <span>Check Real-Time System Status</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
