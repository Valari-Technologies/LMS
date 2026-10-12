import React from 'react';
import { Link } from 'react-router-dom';

export default function AboutPage() {
  const stats = [
    { value: '50K+', label: 'Active Learners', icon: 'fa-users' },
    { value: '98%', label: 'Career Satisfaction', icon: 'fa-star' },
    { value: '140+', label: 'Production Projects', icon: 'fa-code-branch' },
    { value: '45+', label: 'Industry Mentors', icon: 'fa-chalkboard-user' },
  ];

  const pillars = [
    {
      icon: 'fa-laptop-code',
      color: '#a855f7',
      title: 'Industry-Grade Curriculums',
      desc: 'No theoretical filler. Every syllabus is designed around production architectures, cloud services, scalable microservices, and real-world design patterns.',
    },
    {
      icon: 'fa-tower-broadcast',
      color: '#ef4444',
      title: 'Interactive Live Masterclasses',
      desc: 'Engage in weekly interactive live workshops, real-time code reviews, and deep-dive architectural discussions directly with senior tech leads.',
    },
    {
      icon: 'fa-comments',
      color: '#3b82f6',
      title: 'Vibrant Developer Communities',
      desc: 'Never code alone. Collaborate with cohort peers, participate in batch group chats, get 24/7 unblocking from tutors, and build lasting professional networks.',
    },
    {
      icon: 'fa-certificate',
      color: '#10b981',
      title: 'Verified Industry Credentials',
      desc: 'Earn industry-recognized certificates with verifiable credential links to demonstrate your hands-on competencies directly to top tech recruiters.',
    },
  ];

  const values = [
    {
      title: 'Radical Practicality',
      desc: 'We prioritize code over theory. You learn by building production-ready applications, running test suites, and deploying to cloud environments.',
      tag: 'Hands-on',
    },
    {
      title: 'Mentorship at the Core',
      desc: 'Great engineers aren’t built in isolation. Our mentors are experienced engineers who guide, critique, and champion your growth every step.',
      tag: 'Guidance',
    },
    {
      title: 'Community-Driven Growth',
      desc: 'Learning with peers accelerates mastery. Our global student community fosters collaborative debugging, study cohorts, and hackathons.',
      tag: 'Together',
    },
    {
      title: 'Continuous Innovation',
      desc: 'Tech changes fast. We continuously refresh courses with the newest tools, frameworks, and modern software engineering best practices.',
      tag: 'Cutting-edge',
    },
  ];

  const team = [
    {
      name: 'Sarah Jenkins',
      role: 'Head of Curriculum & Cloud Lead',
      bio: 'Former AWS Principal Solutions Architect with 12+ years building enterprise distributed systems.',
      initials: 'SJ',
      bg: 'linear-gradient(135deg, #6366f1, #a855f7)',
    },
    {
      name: 'David Chen',
      role: 'Staff Full-Stack Architect',
      bio: 'Ex-Google Staff Engineer specializing in high-throughput React, TypeScript, and Java microservice ecosystems.',
      initials: 'DC',
      bg: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
    },
    {
      name: 'Elena Rostova',
      role: 'Lead AI & Data Systems Instructor',
      bio: 'AI researcher and author with a passion for bringing deep learning and LLM engineering to applied development.',
      initials: 'ER',
      bg: '#5A70D3',
    },
  ];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Hero Section */}
      <section
        style={{
          background: 'linear-gradient(180deg, #f7f9fa 0%, #ffffff 100%)',
          borderBottom: '1px solid #e2e8f0',
          padding: '72px 24px 72px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Eyebrow Badge */}
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
            <i className="fa-solid fa-graduation-cap"></i>
            <span>EMPOWERING THE NEXT GENERATION OF BUILDERS</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
              fontWeight: 900,
              lineHeight: 1.18,
              letterSpacing: '-0.8px',
              color: 'var(--ud-black)',
              margin: '0 auto 18px auto',
              maxWidth: '850px',
            }}
          >
            Democratizing High-Impact Tech Education for Everyone.
          </h1>

          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.15rem)',
              color: 'var(--ud-gray)',
              lineHeight: 1.65,
              maxWidth: '740px',
              margin: '0 auto 32px auto',
            }}
          >
            OneTutor was founded with a singular purpose: to close the gap between traditional tech learning and real production engineering. We combine industry-tested project curriculums, live mentorship with senior architects, and vibrant student communities.
          </p>

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/student/courses"
              className="ud-btn-primary"
              style={{
                padding: '13px 26px',
                fontSize: '1rem',
                fontWeight: 700,
              }}
            >
              <span>Explore Course Catalog</span>
              <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.88rem' }}></i>
            </Link>

            <Link
              to="/student/live-classes"
              className="ud-btn-secondary"
              style={{
                padding: '13px 26px',
                fontSize: '1rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <i className="fa-solid fa-tower-broadcast" style={{ color: '#ef4444' }}></i>
              <span>Live Masterclasses</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Floating Metrics Strip */}
      <section style={{ maxWidth: '1140px', margin: '48px auto 64px auto', padding: '0 24px' }}>
        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            padding: '28px 24px',
            gap: '24px',
          }}
        >
          {stats.map((st, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                borderRight: idx < stats.length - 1 ? '1px solid #f1f5f9' : 'none',
                paddingRight: '12px',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  background: 'rgba(164, 53, 240, 0.08)',
                  color: 'var(--ud-purple)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  flexShrink: 0,
                }}
              >
                <i className={`fa-solid ${st.icon}`}></i>
              </div>
              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--ud-black)', letterSpacing: '-0.5px' }}>
                  {st.value}
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--ud-gray)', fontWeight: 600 }}>
                  {st.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section style={{ maxWidth: '1140px', margin: '0 auto 72px auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
          {/* Mission Card */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '36px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.04)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '20px' }}>
              <i className="fa-solid fa-bullseye"></i>
            </div>
            <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>
              Our Mission
            </h3>
            <p style={{ color: 'var(--ud-gray)', lineHeight: 1.65, fontSize: '0.96rem', margin: 0 }}>
              To transform tech enthusiasts into battle-tested engineers. We reject outdated slide decks in favor of real terminal workflows, production architectures, continuous deployment pipelines, and proactive mentoring that leads to tangible career transformation.
            </p>
          </div>

          {/* Vision Card */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '36px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.04)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.12)', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '20px' }}>
              <i className="fa-solid fa-compass"></i>
            </div>
            <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '12px' }}>
              Our Vision
            </h3>
            <p style={{ color: 'var(--ud-gray)', lineHeight: 1.65, fontSize: '0.96rem', margin: 0 }}>
              To become the world’s most trusted engineering accelerator where developers from any background can master scalable system design, build production-grade portfolios, and connect directly with forward-thinking technology companies.
            </p>
          </div>
        </div>
      </section>

      {/* The 4 Core Pillars of OneTutor */}
      <section style={{ maxWidth: '1140px', margin: '0 auto 80px auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--ud-purple)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
            Why Learn With Us
          </div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ud-black)', margin: '0 0 12px 0' }}>
            The Four Pillars of OneTutor
          </h2>
          <p style={{ color: 'var(--ud-gray)', fontSize: '1rem', maxWidth: '640px', margin: '0 auto' }}>
            Engineered from the ground up to give learners maximum competitive advantage in today's demanding tech job market.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
          {pillars.map((pil, idx) => (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                padding: '28px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 14px -3px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.borderColor = 'rgba(164, 53, 240, 0.4)';
                e.currentTarget.style.boxShadow = '0 16px 28px -6px rgba(126, 34, 206, 0.12)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 4px 14px -3px rgba(0, 0, 0, 0.05)';
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: `${pil.color}15`,
                  color: pil.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  marginBottom: '18px',
                }}
              >
                <i className={`fa-solid ${pil.icon}`}></i>
              </div>
              <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '10px' }}>
                {pil.title}
              </h4>
              <p style={{ color: 'var(--ud-gray)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                {pil.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Core Values Section */}
      <section style={{ maxWidth: '1140px', margin: '0 auto 80px auto', padding: '0 24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '48px 36px', boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.04)' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--ud-black)', marginBottom: '10px' }}>
              Our Guiding Principles
            </h2>
            <p style={{ color: 'var(--ud-gray)', fontSize: '0.98rem', maxWidth: '580px', margin: '0 auto' }}>
              These values govern how we design our learning materials, recruit top instructors, and support our students.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
            {values.map((val, idx) => (
              <div key={idx} style={{ padding: '20px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', background: 'rgba(164, 53, 240, 0.1)', color: 'var(--ud-purple)', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '10px' }}>
                  {val.tag}
                </span>
                <h4 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--ud-black)', marginBottom: '8px' }}>
                  {val.title}
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--ud-gray)', lineHeight: 1.55, margin: 0 }}>
                  {val.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mentorship Team Spotlight */}
      <section style={{ maxWidth: '1140px', margin: '0 auto 80px auto', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--ud-purple)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
            World-Class Guidance
          </div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--ud-black)', margin: '0 0 10px 0' }}>
            Meet the Engineering Faculty
          </h2>
          <p style={{ color: 'var(--ud-gray)', fontSize: '0.98rem', maxWidth: '600px', margin: '0 auto' }}>
            Our lead tutors and mentors bring decades of collective production engineering experience at leading tech companies.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {team.map((m, idx) => (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '28px',
                textAlign: 'center',
                boxShadow: '0 4px 14px -3px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: m.bg,
                  color: '#ffffff',
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  boxShadow: '0 8px 20px -4px rgba(0, 0, 0, 0.2)',
                }}
              >
                {m.initials}
              </div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--ud-black)', margin: '0 0 4px 0' }}>
                {m.name}
              </h4>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--ud-purple)', marginBottom: '12px' }}>
                {m.role}
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--ud-gray)', lineHeight: 1.55, margin: 0 }}>
                {m.bio}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final Call to Action Strip */}
      <section style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 24px' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(164, 53, 240, 0.06) 0%, rgba(99, 102, 241, 0.06) 100%)',
            border: '1px solid rgba(164, 53, 240, 0.22)',
            borderRadius: '16px',
            padding: '52px 32px',
            textAlign: 'center',
            boxShadow: '0 4px 20px -4px rgba(164, 53, 240, 0.08)',
          }}
        >
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(1.7rem, 3.5vw, 2.3rem)', fontWeight: 900, color: 'var(--ud-black)', margin: '0 0 12px 0' }}>
              Start Building Your Future in Tech Today.
            </h2>
            <p style={{ fontSize: '1rem', color: 'var(--ud-gray)', lineHeight: 1.6, margin: '0 auto 28px auto' }}>
              Join thousands of aspiring and experienced developers mastering real-world software engineering with OneTutor.
            </p>

            <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                to="/register"
                className="ud-btn-primary"
                style={{
                  padding: '13px 28px',
                  fontSize: '1rem',
                  fontWeight: 700,
                }}
              >
                Create Free Account
              </Link>
              <Link
                to="/student/courses"
                className="ud-btn-secondary"
                style={{
                  padding: '13px 28px',
                  fontSize: '1rem',
                  fontWeight: 700,
                }}
              >
                Browse All Courses
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
