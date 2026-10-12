import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function TeachPage() {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [expertise, setExpertise] = useState('Full-Stack Engineering (React & Java)');
  const [bio, setBio] = useState('');

  const benefits = [
    { icon: 'fa-earth-americas', title: 'Global Student Reach', desc: 'Share your knowledge with over 50,000 active students from 120+ countries.' },
    { icon: 'fa-chart-line-up', title: 'Attractive Revenue Share', desc: 'Earn lucrative passive income from student enrollments with direct monthly payouts.' },
    { icon: 'fa-toolbox', title: 'Dedicated Curriculum Support', desc: 'Our instructional design team helps you record, edit, and structure production-grade courses.' },
    { icon: 'fa-headset', title: 'Technical & Media Infrastructure', desc: 'Access OneTutor’s streaming platform, automated quiz engines, and live classroom tools.' },
  ];

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setName('');
      setEmail('');
      setBio('');
    }, 3000);
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Hero */}
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
            <i className="fa-solid fa-chalkboard-user"></i>
            <span>TEACH ON ONETUTOR</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)', fontWeight: 900, color: 'var(--ud-black)', marginBottom: '18px' }}>
            Inspire the Next Generation of Developers.
          </h1>
          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.15rem)', color: 'var(--ud-gray)', lineHeight: 1.65, maxWidth: '720px', margin: '0 auto 32px auto' }}>
            Become an instructor on OneTutor. Share your real-world software engineering expertise, create high-impact video courses, and host interactive live masterclasses.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ maxWidth: '1140px', margin: '60px auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--ud-black)', marginBottom: '10px' }}>
            Why Teach With OneTutor?
          </h2>
          <p style={{ color: 'var(--ud-gray)', fontSize: '0.98rem' }}>
            We provide everything you need to create world-class technical education.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          {benefits.map((b, idx) => (
            <div key={idx} style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 4px 14px -3px rgba(0,0,0,0.04)' }}>
              <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(164, 53, 240, 0.1)', color: 'var(--ud-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '16px' }}>
                <i className={`fa-solid ${b.icon}`}></i>
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '8px' }}>
                {b.title}
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--ud-gray)', lineHeight: 1.55, margin: 0 }}>
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Application Form */}
      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '40px', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--ud-black)', marginBottom: '8px', textAlign: 'center' }}>
            Apply to Become an Instructor
          </h2>
          <p style={{ color: 'var(--ud-gray)', fontSize: '0.92rem', textAlign: 'center', marginBottom: '28px' }}>
            Fill out the form below and our instructor onboarding team will contact you.
          </p>

          {submitted ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: '3.5rem', color: '#10b981', marginBottom: '16px' }}></i>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 10px 0' }}>Application Submitted!</h3>
              <p style={{ color: 'var(--ud-gray)', fontSize: '0.95rem', margin: 0 }}>
                Thank you for your interest in teaching at OneTutor. We will review your profile and reach out within 2 business days.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, marginBottom: '6px' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Dr. Michael Vance"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, marginBottom: '6px' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="michael@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, marginBottom: '6px' }}>Primary Topic of Expertise *</label>
                <select
                  value={expertise}
                  onChange={e => setExpertise(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem', background: '#ffffff' }}
                >
                  <option>Full-Stack Engineering (React & Java)</option>
                  <option>Cloud Architecture & DevOps (AWS/Docker/K8s)</option>
                  <option>AI & Machine Learning Systems</option>
                  <option>Database Engineering & PostgreSQL</option>
                  <option>Mobile App Development (React Native/Flutter)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, marginBottom: '6px' }}>Brief Professional Bio & Teaching Experience *</label>
                <textarea
                  required
                  rows="4"
                  placeholder="Tell us about your background, years of industry experience, and what courses you would like to create..."
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.92rem', resize: 'vertical' }}
                ></textarea>
              </div>

              <button type="submit" className="ud-btn-primary" style={{ padding: '12px', justifyContent: 'center', fontSize: '0.95rem', marginTop: '6px' }}>
                <span>Submit Instructor Application</span>
                <i className="fa-solid fa-paper-plane" style={{ fontSize: '0.85rem' }}></i>
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
