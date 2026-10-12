import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function BlogPage() {
  const [selectedTag, setSelectedTag] = useState('All');

  const articles = [
    {
      id: 1,
      title: 'Building Enterprise Microservices with Spring Boot 3.3 and Java 21 Virtual Threads',
      excerpt: 'Learn how to leverage Project Loom virtual threads and Spring Data JPA to handle millions of concurrent connections with minimal memory overhead.',
      category: 'Backend Architecture',
      author: 'Sarah Jenkins',
      date: 'Sep 22, 2026',
      readTime: '6 min read',
      tag: 'Java & Spring',
      icon: 'fa-cubes',
    },
    {
      id: 2,
      title: 'Modern React 18 Patterns: Optimizing Re-renders with Server Components and Custom Hooks',
      excerpt: 'A comprehensive guide on performance tuning complex React frontends, debouncing state updates, and managing global context state cleanly.',
      category: 'Frontend Engineering',
      author: 'David Chen',
      date: 'Sep 18, 2026',
      readTime: '8 min read',
      tag: 'React & JS',
      icon: 'fa-code',
    },
    {
      id: 3,
      title: 'Zero-Downtime Database Migrations with PostgreSQL 16 and Flyway',
      excerpt: 'Strategies for modifying live database schemas in production without table locks, downtime, or breaking API backward compatibility.',
      category: 'Database & DevOps',
      author: 'Elena Rostova',
      date: 'Sep 12, 2026',
      readTime: '5 min read',
      tag: 'Database',
      icon: 'fa-database',
    },
    {
      id: 4,
      title: 'Designing Real-Time Video Streaming Engines with HTTP Range Requests and Cloudinary',
      excerpt: 'How OneTutor delivers smooth 1080p video playback, resume-position state persistence, and adaptive chunking across devices.',
      category: 'System Design',
      author: 'Sarah Jenkins',
      date: 'Sep 05, 2026',
      readTime: '10 min read',
      tag: 'System Design',
      icon: 'fa-video',
    },
  ];

  const tags = ['All', 'Backend Architecture', 'Frontend Engineering', 'Database & DevOps', 'System Design'];

  const filteredArticles = selectedTag === 'All'
    ? articles
    : articles.filter(a => a.category === selectedTag);

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(180deg, #f7f9fa 0%, #ffffff 100%)',
          borderBottom: '1px solid #e2e8f0',
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
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
            <i className="fa-solid fa-newspaper"></i>
            <span>ONETUTOR ENGINEERING BLOG</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.2rem)', fontWeight: 900, color: 'var(--ud-black)', marginBottom: '14px' }}>
            Insights, Architecture & Code Guides.
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--ud-gray)', lineHeight: 1.6, margin: 0 }}>
            Deep dives into modern software engineering, cloud architecture, system design, and learning strategies from the OneTutor engineering team.
          </p>
        </div>
      </section>

      {/* Filter Tabs & Grid */}
      <section style={{ maxWidth: '1140px', margin: '48px auto 0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '32px' }}>
          {tags.map(t => (
            <button
              key={t}
              onClick={() => setSelectedTag(t)}
              style={{
                padding: '8px 18px',
                borderRadius: '20px',
                border: '1px solid',
                borderColor: selectedTag === t ? 'var(--ud-purple)' : '#cbd5e1',
                background: selectedTag === t ? 'var(--ud-purple)' : '#ffffff',
                color: selectedTag === t ? '#ffffff' : '#475569',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
          {filteredArticles.map(art => (
            <article
              key={art.id}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 14px -3px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.borderColor = 'rgba(164, 53, 240, 0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '3px 10px', borderRadius: '6px', background: 'rgba(164, 53, 240, 0.1)', color: 'var(--ud-purple)' }}>
                  {art.category}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>{art.readTime}</span>
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ud-black)', lineHeight: 1.35, marginBottom: '10px' }}>
                {art.title}
              </h3>

              <p style={{ fontSize: '0.9rem', color: 'var(--ud-gray)', lineHeight: 1.6, flex: 1, marginBottom: '20px' }}>
                {art.excerpt}
              </p>

              <div style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                  By {art.author} • <span style={{ color: '#94a3b8', fontWeight: 500 }}>{art.date}</span>
                </div>
                <span style={{ color: 'var(--ud-purple)', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>Read Article</span>
                  <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.75rem' }}></i>
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
