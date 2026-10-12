import React from 'react';

export default function SystemStatusPage() {
  const services = [
    { name: 'API Gateway & Auth Service (Spring Boot 3.3)', status: 'Operational', uptime: '99.99%', latency: '24ms', icon: 'fa-server' },
    { name: 'PostgreSQL Database & Migration Cluster', status: 'Operational', uptime: '100%', latency: '8ms', icon: 'fa-database' },
    { name: 'Media Asset Streaming & Cloudinary Storage', status: 'Operational', uptime: '99.98%', latency: '45ms', icon: 'fa-file-video' },
    { name: 'Live Webinars & WebRTC Classroom Relay', status: 'Operational', uptime: '99.95%', latency: '32ms', icon: 'fa-tower-broadcast' },
    { name: 'FCM Push Notifications & Alert Engine', status: 'Operational', uptime: '99.97%', latency: '18ms', icon: 'fa-bell' },
    { name: 'Community Real-Time Chat Engine', status: 'Operational', uptime: '99.99%', latency: '15ms', icon: 'fa-comments' },
  ];

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
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '999px',
              padding: '6px 16px',
              fontSize: '0.84rem',
              fontWeight: 700,
              color: '#059669',
              marginBottom: '16px',
            }}
          >
            <i className="fa-solid fa-circle" style={{ fontSize: '0.6rem', color: '#10b981' }}></i>
            <span>ALL SYSTEMS OPERATIONAL</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2rem, 3.8vw, 2.8rem)', fontWeight: 900, color: 'var(--ud-black)', marginBottom: '10px' }}>
            OneTutor Platform Status
          </h1>
          <p style={{ fontSize: '0.92rem', color: '#64748b', margin: 0 }}>
            Live status metrics, API gateway health, and service uptime.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: '900px', margin: '48px auto 0 auto', padding: '0 24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 4px 16px -2px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Core Microservices Health</h2>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>Updated seconds ago</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {services.map((s, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: '1px solid #f1f5f9',
                  background: '#f8fafc',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <i className={`fa-solid ${s.icon}`} style={{ fontSize: '1.1rem', color: 'var(--ud-purple)' }}></i>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--ud-black)' }}>{s.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Response Latency: {s.latency} • Uptime: {s.uptime}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '4px 12px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 800 }}>
                  <i className="fa-solid fa-check" style={{ fontSize: '0.75rem' }}></i>
                  <span>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
