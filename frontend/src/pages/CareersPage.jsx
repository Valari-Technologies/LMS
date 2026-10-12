import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function CareersPage() {
  const [selectedDept, setSelectedDept] = useState('All');
  const [appliedJob, setAppliedJob] = useState(null);
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantResume, setApplicantResume] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const perks = [
    { icon: 'fa-laptop-code', title: 'Remote-First Culture', desc: 'Work from anywhere in the world with flexible hours and asynchronous communication.' },
    { icon: 'fa-heart-pulse', title: 'Comprehensive Health & Wellness', desc: 'Top-tier medical, dental, and mental health coverage for you and your dependents.' },
    { icon: 'fa-book-open', title: 'Learning & Development Stipend', desc: '$2,500 annual budget for courses, conferences, tech books, and certifications.' },
    { icon: 'fa-plane-departure', title: 'Unlimited Paid Time Off', desc: 'Take the time you need to recharge with mandatory 3-week minimum annual leave.' },
    { icon: 'fa-money-bill-trend-up', title: 'Competitive Equity & Salary', desc: 'Top percentile salary packages with stock option grants in high-growth tech platform.' },
    { icon: 'fa-dumbbell', title: 'Home Office & Fitness Stipend', desc: '$1,000 one-time setup allowance + $150 monthly wellness allowance.' },
  ];

  const jobs = [
    {
      id: 1,
      title: 'Senior Staff Full-Stack Instructor',
      department: 'Engineering',
      location: 'Remote (US/EU/Asia)',
      type: 'Full-time',
      experience: '6+ Years',
      desc: 'Architect cutting-edge Spring Boot & React curriculums, mentor advanced developer cohorts, and record high-impact video lectures.',
    },
    {
      id: 2,
      title: 'Lead Cloud Architect & DevOps Mentor',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      experience: '5+ Years',
      desc: 'Lead real-world Kubernetes, Docker, and AWS CI/CD hands-on masterclasses for enterprise student cohorts.',
    },
    {
      id: 3,
      title: 'Senior Technical Content Strategist',
      department: 'Content',
      location: 'Remote',
      type: 'Full-time',
      experience: '3+ Years',
      desc: 'Craft in-depth technical blogs, architectural cheat sheets, and engaging course documentation.',
    },
    {
      id: 4,
      title: 'Community Experience & Student Success Manager',
      department: 'Operations',
      location: 'Remote',
      type: 'Full-time',
      experience: '2+ Years',
      desc: 'Nurture student discussion channels, organize hackathons, and ensure 100% student satisfaction and completion.',
    },
    {
      id: 5,
      title: 'Frontend Product Designer (UX/UI)',
      department: 'Design',
      location: 'Remote',
      type: 'Full-time',
      experience: '4+ Years',
      desc: 'Design beautiful, glassmorphic UI systems for OneTutor web application, code playgrounds, and video engines.',
    },
  ];

  const filteredJobs = selectedDept === 'All'
    ? jobs
    : jobs.filter(j => j.department.toLowerCase() === selectedDept.toLowerCase());

  function handleSubmitApplication(e) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setAppliedJob(null);
      setApplicantName('');
      setApplicantEmail('');
      setApplicantResume('');
    }, 2500);
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Hero Header */}
      <section
        style={{
          background: 'linear-gradient(180deg, #f7f9fa 0%, #ffffff 100%)',
          borderBottom: '1px solid #e2e8f0',
          padding: '72px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
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
              marginBottom: '20px',
            }}
          >
            <i className="fa-solid fa-briefcase"></i>
            <span>JOIN OUR MISSION</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
              fontWeight: 900,
              lineHeight: 1.18,
              color: 'var(--ud-black)',
              marginBottom: '18px',
            }}
          >
            Build the Future of Tech Education.
          </h1>

          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.15rem)',
              color: 'var(--ud-gray)',
              lineHeight: 1.65,
              maxWidth: '720px',
              margin: '0 auto 32px auto',
            }}
          >
            At OneTutor, we’re shaping how engineers master software architecture, cloud platforms, and modern web development. Join a passionate, global remote team.
          </p>
        </div>
      </section>

      {/* Perks & Benefits Section */}
      <section style={{ maxWidth: '1140px', margin: '60px auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--ud-black)', marginBottom: '10px' }}>
            Why You’ll Love Working at OneTutor
          </h2>
          <p style={{ color: 'var(--ud-gray)', fontSize: '0.98rem' }}>
            We care deeply about our team’s health, growth, and autonomy.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {perks.map((p, idx) => (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '28px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 14px -3px rgba(0, 0, 0, 0.04)',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'rgba(164, 53, 240, 0.1)',
                  color: 'var(--ud-purple)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  marginBottom: '16px',
                }}
              >
                <i className={`fa-solid ${p.icon}`}></i>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '8px' }}>
                {p.title}
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--ud-gray)', lineHeight: 1.55, margin: 0 }}>
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Open Positions */}
      <section style={{ maxWidth: '1140px', margin: '0 auto 60px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--ud-black)', margin: 0 }}>
              Open Positions ({filteredJobs.length})
            </h2>
            <p style={{ color: 'var(--ud-gray)', fontSize: '0.92rem', margin: '4px 0 0 0' }}>
              Find your next role and make an impact.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['All', 'Engineering', 'Content', 'Operations', 'Design'].map(dept => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: selectedDept === dept ? 'var(--ud-purple)' : '#cbd5e1',
                  background: selectedDept === dept ? 'var(--ud-purple)' : '#ffffff',
                  color: selectedDept === dept ? '#ffffff' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {filteredJobs.map(job => (
            <div
              key={job.id}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '24px 28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.03)',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(164, 53, 240, 0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
            >
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: 'rgba(164, 53, 240, 0.1)', color: 'var(--ud-purple)' }}>
                    {job.department}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    <i className="fa-solid fa-location-dot" style={{ marginRight: '4px' }}></i>
                    {job.location}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i>
                    {job.type}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ud-black)', margin: '0 0 6px 0' }}>
                  {job.title}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--ud-gray)', margin: 0, lineHeight: 1.5 }}>
                  {job.desc}
                </p>
              </div>

              <button
                onClick={() => setAppliedJob(job)}
                className="ud-btn-primary"
                style={{ padding: '10px 22px', fontSize: '0.9rem', whiteSpace: 'nowrap' }}
              >
                Apply Now
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Modal for Application */}
      {appliedJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', padding: '32px', maxWidth: '520px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <i className="fa-solid fa-circle-check" style={{ fontSize: '3.5rem', color: '#10b981', marginBottom: '16px' }}></i>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Application Received!</h3>
                <p style={{ color: 'var(--ud-gray)', fontSize: '0.95rem' }}>
                  Thank you for applying for <strong>{appliedJob.title}</strong>. Our recruiting team will review your application and respond within 48 hours.
                </p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Apply for Role</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ud-purple)', fontWeight: 700, marginTop: '2px' }}>{appliedJob.title}</div>
                  </div>
                  <button onClick={() => setAppliedJob(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <form onSubmit={handleSubmitApplication} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={applicantName}
                      onChange={e => setApplicantName(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="jane@example.com"
                      value={applicantEmail}
                      onChange={e => setApplicantEmail(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>LinkedIn or Portfolio URL *</label>
                    <input
                      type="url"
                      required
                      placeholder="https://linkedin.com/in/janedoe"
                      value={applicantResume}
                      onChange={e => setApplicantResume(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem' }}
                    />
                  </div>

                  <button type="submit" className="ud-btn-primary" style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}>
                    Submit Application
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
