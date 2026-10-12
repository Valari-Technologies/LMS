import React, { useState, useEffect } from 'react';
import {
  getAdminContactMessages,
  getAdminContactStats,
  replyToContactMessage,
  toggleArchiveContactMessage,
  deleteContactMessage
} from '../../api/contact';
import { useAuth } from '../../auth/AuthContext';
import { useNotification } from '../../context/NotificationContext';

const TOPIC_BADGES = {
  'General Enquiry': { bg: 'rgba(90, 112, 211, 0.1)', color: '#5A70D3', border: 'rgba(90, 112, 211, 0.25)' },
  'Course Enrollment & Billing': { bg: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: 'rgba(16, 185, 129, 0.25)' },
  'Technical Issue / Bug Report': { bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', border: 'rgba(239, 68, 68, 0.25)' },
  'Instructor & Teaching Partnerships': { bg: 'rgba(168, 85, 247, 0.1)', color: '#7e22ce', border: 'rgba(168, 85, 247, 0.25)' },
  'Enterprise & Corporate Licensing': { bg: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: 'rgba(245, 158, 11, 0.25)' },
};

const QUICK_TEMPLATES = [
  {
    title: 'General Assistance',
    text: 'Hello! Thank you for contacting OneTutor support. We have received your inquiry and our team is looking into this for you. We will follow up shortly with a comprehensive solution.'
  },
  {
    title: 'Issue Resolved',
    text: 'Hello! We have reviewed your inquiry and resolved the issue on our end. Please log into your account and check your dashboard. Let us know if you need any further assistance.'
  },
  {
    title: 'Billing & Access',
    text: 'Hello! Thank you for reaching out regarding your course enrollment. Your payment and enrollment status have been verified and your course access has been activated.'
  },
  {
    title: 'Enterprise Partnerships',
    text: 'Hello! Thank you for your interest in OneTutor enterprise solutions. Our academic partnerships team would love to schedule a demo to discuss tailored plans for your organization.'
  }
];

export default function AdminContactMessagesPage() {
  const { user } = useAuth();
  const { toast } = useNotification();

  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, replied: 0, archived: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING'); // PENDING | ALL | REPLIED | ARCHIVED
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Selected message for details & reply modal
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadMessages();
  }, [activeTab, search, page]);

  async function loadStats() {
    try {
      const data = await getAdminContactStats();
      if (data) setStats(data);
    } catch (e) {
      console.error('Failed to load contact stats', e);
    }
  }

  async function loadMessages() {
    setLoading(true);
    try {
      const data = await getAdminContactMessages({
        status: activeTab,
        search,
        page,
        size: 15
      });
      setMessages(data?.content || []);
      setTotalPages(data?.totalPages || 1);
      setTotalElements(data?.totalElements || 0);
    } catch (e) {
      console.error('Failed to load contact messages', e);
      if (toast?.error) toast.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenModal(msg) {
    setSelectedMessage(msg);
    setReplyText(msg.replyMessage || '');
  }

  function handleCloseModal() {
    setSelectedMessage(null);
    setReplyText('');
    setSendingReply(false);
  }

  async function handleSendReply(e) {
    e.preventDefault();
    if (!replyText.trim()) {
      if (toast?.warning) toast.warning('Please enter a reply message');
      return;
    }

    setSendingReply(true);
    try {
      const updated = await replyToContactMessage(selectedMessage.id, replyText);
      if (toast?.success) toast.success('Reply successfully sent via email and in-app notification!');
      setSelectedMessage(updated);
      loadMessages();
      loadStats();
    } catch (e) {
      console.error('Failed to send reply', e);
      if (toast?.error) toast.error(e?.response?.data?.message || 'Failed to dispatch reply');
    } finally {
      setSendingReply(false);
    }
  }

  async function handleToggleArchive(id, e) {
    if (e) e.stopPropagation();
    try {
      await toggleArchiveContactMessage(id);
      if (toast?.success) toast.success('Inquiry archive status updated');
      loadMessages();
      loadStats();
      if (selectedMessage && selectedMessage.id === id) {
        handleCloseModal();
      }
    } catch (e) {
      console.error('Failed to archive', e);
    }
  }

  async function handleDelete(id, e) {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this contact inquiry?')) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteContactMessage(id);
      if (toast?.success) toast.success('Inquiry deleted successfully');
      loadMessages();
      loadStats();
      if (selectedMessage && selectedMessage.id === id) {
        handleCloseModal();
      }
    } catch (e) {
      console.error('Failed to delete inquiry', e);
      if (toast?.error) toast.error('Failed to delete inquiry');
    } finally {
      setDeletingId(null);
    }
  }

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  return (
    <div style={{ padding: '24px 32px 60px 32px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(90, 112, 211, 0.15), rgba(75, 97, 196, 0.25))',
              color: '#5A70D3',
              fontSize: '1.2rem'
            }}>
              <i className="fa-solid fa-headset"></i>
            </span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0b1f3a', margin: 0 }}>
              Support & Contact Inquiries
            </h1>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.94rem', margin: 0 }}>
            Manage inbound contact submissions, customer inquiries, and reply directly to users via email and in-app alerts.
          </p>
        </div>

        <button
          onClick={() => { loadMessages(); loadStats(); }}
          className="ud-btn-secondary"
          style={{ padding: '8px 18px', fontSize: '0.88rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <i className="fa-solid fa-rotate-right"></i>
          <span>Refresh</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 10px rgba(11, 31, 58, 0.03)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
            <i className="fa-solid fa-clock"></i>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Pending Replies</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: stats.pending > 0 ? '#d97706' : '#0b1f3a' }}>{stats.pending}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 10px rgba(11, 31, 58, 0.03)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Resolved / Replied</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0b1f3a' }}>{stats.replied}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 10px rgba(11, 31, 58, 0.03)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(90, 112, 211, 0.12)', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
            <i className="fa-solid fa-inbox"></i>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Inquiries</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0b1f3a' }}>{stats.total}</div>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 10px rgba(11, 31, 58, 0.03)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(100, 116, 139, 0.12)', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
            <i className="fa-solid fa-box-archive"></i>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Archived</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0b1f3a' }}>{stats.archived}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 2px 10px rgba(11, 31, 58, 0.02)'
      }}>
        {/* Status Filter Tabs */}
        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
          {[
            { id: 'PENDING', label: 'Needs Reply', count: stats.pending, icon: 'fa-solid fa-circle-exclamation' },
            { id: 'ALL', label: 'All Inquiries', count: stats.total, icon: 'fa-solid fa-list' },
            { id: 'REPLIED', label: 'Replied', count: stats.replied, icon: 'fa-solid fa-check' },
            { id: 'ARCHIVED', label: 'Archived', count: stats.archived, icon: 'fa-solid fa-archive' }
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setPage(0); }}
                style={{
                  border: 'none',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#0b1f3a' : '#64748b',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: '0.86rem',
                  padding: '7px 14px',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: isActive ? '0 2px 6px rgba(11, 31, 58, 0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <i className={tab.icon} style={{ fontSize: '0.8rem', color: isActive ? '#5A70D3' : 'inherit' }}></i>
                <span>{tab.label}</span>
                <span style={{
                  background: isActive ? '#5A70D3' : '#e2e8f0',
                  color: isActive ? '#ffffff' : '#64748b',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '999px'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.9rem' }}></i>
          <input
            type="text"
            placeholder="Search name, email, subject, text..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            style={{
              width: '100%',
              padding: '9px 14px 9px 38px',
              borderRadius: '999px',
              border: '1px solid #cbd5e1',
              fontSize: '0.88rem',
              outline: 'none',
              background: '#f8fafc'
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      </div>

      {/* Messages List / Table */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 18px rgba(11, 31, 58, 0.04)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '70px 20px', color: '#64748b' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#5A70D3', marginBottom: '14px' }}></i>
            <div style={{ fontWeight: 600 }}>Loading inquiries...</div>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: '1.8rem', color: '#94a3b8' }}>
              <i className="fa-regular fa-envelope-open"></i>
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0b1f3a', marginBottom: '6px' }}>No inquiries found</h3>
            <p style={{ margin: 0, fontSize: '0.92rem' }}>
              {search ? `No messages match search term "${search}"` : `No ${activeTab.toLowerCase()} inquiries right now.`}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 800 }}>Sender</th>
                  <th style={{ padding: '14px 20px', fontWeight: 800 }}>Topic / Subject</th>
                  <th style={{ padding: '14px 20px', fontWeight: 800 }}>Message Snippet</th>
                  <th style={{ padding: '14px 20px', fontWeight: 800 }}>Status</th>
                  <th style={{ padding: '14px 20px', fontWeight: 800 }}>Received</th>
                  <th style={{ padding: '14px 20px', fontWeight: 800, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages.map(msg => {
                  const topicStyle = TOPIC_BADGES[msg.subject] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
                  const isPending = msg.status === 'PENDING';
                  const isReplied = msg.status === 'REPLIED';

                  return (
                    <tr
                      key={msg.id}
                      onClick={() => handleOpenModal(msg)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        background: isPending ? 'rgba(245, 158, 11, 0.03)' : '#ffffff',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = isPending ? 'rgba(245, 158, 11, 0.03)' : '#ffffff'}
                    >
                      {/* Sender */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: isPending ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #5A70D3, #4B61C4)',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {msg.name ? msg.name.substring(0, 2).toUpperCase() : '??'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0b1f3a', fontSize: '0.92rem' }}>
                              {msg.name}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{msg.email}</span>
                              {msg.userId && (
                                <span style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  User #{msg.userId}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Topic / Subject */}
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          background: topicStyle.bg,
                          color: topicStyle.color,
                          border: `1px solid ${topicStyle.border}`
                        }}>
                          {msg.subject}
                        </span>
                      </td>

                      {/* Message Snippet */}
                      <td style={{ padding: '16px 20px', maxWidth: '380px' }}>
                        <div style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: '#334155',
                          fontSize: '0.88rem'
                        }}>
                          {msg.message}
                        </div>
                        {msg.replyMessage && (
                          <div style={{
                            fontSize: '0.76rem',
                            color: '#059669',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            <i className="fa-solid fa-reply"></i>
                            <span>Replied: {msg.replyMessage}</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 20px' }}>
                        {isPending && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#fef3c7',
                            color: '#b45309',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.76rem',
                            fontWeight: 800
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d97706' }}></span>
                            Needs Reply
                          </span>
                        )}
                        {isReplied && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.76rem',
                            fontWeight: 800
                          }}>
                            <i className="fa-solid fa-check" style={{ fontSize: '0.7rem' }}></i>
                            Replied
                          </span>
                        )}
                        {msg.status === 'ARCHIVED' && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#f1f5f9',
                            color: '#64748b',
                            padding: '4px 10px',
                            borderRadius: '999px',
                            fontSize: '0.76rem',
                            fontWeight: 800
                          }}>
                            <i className="fa-solid fa-box-archive" style={{ fontSize: '0.7rem' }}></i>
                            Archived
                          </span>
                        )}
                      </td>

                      {/* Received Date */}
                      <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.84rem' }}>
                        <div>{new Date(msg.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenModal(msg)}
                            className="ud-btn-primary"
                            style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: '6px', background: isPending ? '#5A70D3' : '#64748b' }}
                            title={isPending ? 'Reply to inquiry' : 'View details'}
                          >
                            <i className={isPending ? 'fa-solid fa-reply' : 'fa-solid fa-eye'}></i>
                            <span>{isPending ? 'Reply' : 'View'}</span>
                          </button>

                          <button
                            onClick={e => handleToggleArchive(msg.id, e)}
                            style={{
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#64748b',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              cursor: 'pointer',
                              fontSize: '0.82rem'
                            }}
                            title={msg.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
                          >
                            <i className={msg.status === 'ARCHIVED' ? 'fa-solid fa-box-open' : 'fa-solid fa-box-archive'}></i>
                          </button>

                          {isSuperAdmin && (
                            <button
                              onClick={e => handleDelete(msg.id, e)}
                              disabled={deletingId === msg.id}
                              style={{
                                border: '1px solid #fecaca',
                                background: '#fef2f2',
                                color: '#ef4444',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                cursor: 'pointer',
                                fontSize: '0.82rem'
                              }}
                              title="Delete inquiry"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Showing {messages.length} of {totalElements} inquiries
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="ud-btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.82rem', borderRadius: '6px', opacity: page === 0 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page + 1 >= totalPages}
                className="ud-btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.82rem', borderRadius: '6px', opacity: page + 1 >= totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================
          MODAL: INQUIRY DETAILS & SUPER ADMIN REPLY COMPOSER
          =================================================================== */}
      {selectedMessage && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11, 31, 58, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(11, 31, 58, 0.25)',
            border: '1px solid #cbd5e1'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#5A70D3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Support Inquiry #{selectedMessage.id}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0b1f3a', margin: '4px 0 0 0' }}>
                  {selectedMessage.subject}
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                style={{
                  border: 'none',
                  background: '#ffffff',
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Sender Details Box */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px',
                fontSize: '0.86rem'
              }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Sender Name</div>
                  <div style={{ fontWeight: 700, color: '#0b1f3a', marginTop: '2px' }}>{selectedMessage.name}</div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Email Address</div>
                  <div style={{ fontWeight: 700, color: '#5A70D3', marginTop: '2px' }}>
                    <a href={`mailto:${selectedMessage.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {selectedMessage.email}
                    </a>
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Date Received</div>
                  <div style={{ fontWeight: 600, color: '#0b1f3a', marginTop: '2px' }}>
                    {new Date(selectedMessage.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Status</div>
                  <div style={{ fontWeight: 700, marginTop: '2px' }}>
                    {selectedMessage.status === 'PENDING' ? (
                      <span style={{ color: '#d97706' }}>● Pending Reply</span>
                    ) : selectedMessage.status === 'REPLIED' ? (
                      <span style={{ color: '#16a34a' }}>✓ Replied</span>
                    ) : (
                      <span style={{ color: '#64748b' }}>Archived</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Original Message Box */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                  User's Inquiry Message
                </label>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  color: '#0b1f3a',
                  fontSize: '0.94rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedMessage.message}
                </div>
              </div>

              {/* Already Replied Banner */}
              {selectedMessage.replyMessage && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  fontSize: '0.9rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-circle-check"></i>
                      <span>Previous Reply Dispatched to {selectedMessage.email}</span>
                    </div>
                    {selectedMessage.repliedAt && (
                      <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                        by {selectedMessage.repliedByName || 'Admin'} on {new Date(selectedMessage.repliedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div style={{ color: '#0b1f3a', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {selectedMessage.replyMessage}
                  </div>
                </div>
              )}

              {/* Quick Template Buttons */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Quick Response Templates
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {QUICK_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReplyText(tmpl.text)}
                      style={{
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e0e7ff'; e.currentTarget.style.color = '#4338ca'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; }}
                    >
                      {tmpl.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  {selectedMessage.replyMessage ? 'Send Follow-up / Update Reply' : 'Compose Official Support Reply'}
                </label>
                <textarea
                  rows="6"
                  required
                  placeholder={`Write your response to ${selectedMessage.name}... This will be delivered to ${selectedMessage.email} with OneTutor branding.`}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.92rem',
                    lineHeight: 1.5,
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                  onFocus={e => e.target.style.borderColor = '#5A70D3'}
                  onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    <i className="fa-solid fa-paper-plane" style={{ marginRight: '6px', color: '#5A70D3' }}></i>
                    Delivers HTML email directly to <strong>{selectedMessage.email}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="ud-btn-secondary"
                      style={{ padding: '10px 18px', borderRadius: '8px', fontSize: '0.9rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendingReply}
                      className="ud-btn-primary"
                      style={{ padding: '10px 22px', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {sendingReply ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin"></i>
                          <span>Sending Email...</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-envelope-circle-check"></i>
                          <span>{selectedMessage.replyMessage ? 'Resend / Update Reply' : 'Send Official Reply'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
