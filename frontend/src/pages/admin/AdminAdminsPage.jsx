import { useState, useEffect } from 'react';
import { getAdmins, createAdmin, disableUserAccount, enableUserAccount, resetUserPassword, updateUserPermissions } from '../../api/users';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../auth/AuthContext';
import AlertBanner from '../../components/AlertBanner';

const ALL_NAVBAR_ITEMS = [
  { path: '/admin', label: 'Dashboard / Overview' },
  { path: '/admin/creator-dashboard', label: 'Creator Studio' },
  { path: '/admin/courses', label: 'Courses' },
  { path: '/admin/batches', label: 'Batches' },
  { path: '/admin/categories', label: 'Categories' },
  { path: '/admin/coupons', label: 'Coupons & Discounts' },
  { path: '/admin/banners', label: 'Hero Banners' },
  { path: '/admin/promo-banner', label: 'Promo Banner' },
  { path: '/admin/media', label: 'Media Library' },
  { path: '/admin/live-sessions', label: 'Live Sessions' },
  { path: '/admin/contact-messages', label: 'Support Inquiries' },
  { path: '/admin/notifications', label: 'Notification Center' },
  { path: '/admin/community', label: 'Community' },
  { path: '/admin/students', label: 'Students' },
  { path: '/admin/admins', label: 'Administrators / Staff' },
  { path: '/admin/enrollments', label: 'Enrollments' },
  { path: '/admin/progress', label: 'Progress Tracking' },
  { path: '/admin/audit-logs', label: 'Audit Logs' },
];

function getDefaultPermissions(role) {
  const map = {};
  const isContent = role === 'content_creator';
  const isReadOnly = role === 'readonly_admin';

  ALL_NAVBAR_ITEMS.forEach((item) => {
    if (isContent) {
      const enabled = item.path === '/admin/courses' || item.path === '/admin/categories' || item.path === '/admin/media' || item.path === '/admin/creator-dashboard';
      map[item.path] = { enabled, mode: 'EDITABLE' };
    } else if (isReadOnly) {
      map[item.path] = { enabled: true, mode: 'READ_ONLY' };
    } else {
      map[item.path] = { enabled: true, mode: 'EDITABLE' };
    }
  });
  return map;
}

function parsePermissionsToState(permissionsJson, role) {
  if (!permissionsJson) {
    return getDefaultPermissions(role);
  }
  try {
    const parsed = typeof permissionsJson === 'string' ? JSON.parse(permissionsJson) : permissionsJson;
    const map = {};
    ALL_NAVBAR_ITEMS.forEach((item) => {
      if (parsed && parsed[item.path] !== undefined) {
        map[item.path] = { enabled: true, mode: parsed[item.path] === 'READ_ONLY' ? 'READ_ONLY' : 'EDITABLE' };
      } else {
        map[item.path] = { enabled: false, mode: 'READ_ONLY' };
      }
    });
    return map;
  } catch (e) {
    return getDefaultPermissions(role);
  }
}

function formatLastSeen(timestamp) {
  if (!timestamp) return { primary: 'Never', secondary: null, isOnline: false };
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  const formattedDateTime = date.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  if (diffSecs < 75) {
    return { primary: 'Online', secondary: null, isOnline: true };
  }
  if (diffMins < 60) {
    return { primary: `${diffMins || 1}m ago`, secondary: formattedDateTime, isOnline: false };
  }
  if (diffHours < 24) {
    return { primary: `${diffHours}h ago`, secondary: formattedDateTime, isOnline: false };
  }
  return { primary: formattedDateTime, secondary: null, isOnline: false };
}

export default function AdminAdminsPage() {
  const { user: currentUser, refreshUser } = useAuth();
  const { toast, confirm } = useNotification();
  const isReadOnlyUser = currentUser?.role === 'readonly_admin' || currentUser?.role === 'read_only_admin';
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'content_creator',
    password: '',
    confirmPassword: '',
  });

  const [createPermissions, setCreatePermissions] = useState(() => getDefaultPermissions('content_creator'));

  const [editRole, setEditRole] = useState('content_creator');
  const [editPermissions, setEditPermissions] = useState({});

  const [resetForm, setResetForm] = useState({
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    loadAdmins(true);
    const interval = setInterval(() => {
      loadAdmins(false);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  async function loadAdmins(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const res = await getAdmins();
      setAdmins(res?.content || []);
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  function handleCreateRoleChange(newRole) {
    setCreateForm((prev) => ({ ...prev, role: newRole }));
    setCreatePermissions(getDefaultPermissions(newRole));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);

    if (createForm.password !== createForm.confirmPassword) {
      const msg = 'Passwords do not match.';
      setError(msg);
      toast.warning(msg);
      return;
    }

    if (createForm.password.length < 8) {
      const msg = 'Password must be at least 8 characters.';
      setError(msg);
      toast.warning(msg);
      return;
    }

    const activePermissionsMap = {};
    Object.keys(createPermissions).forEach((path) => {
      if (createPermissions[path].enabled) {
        activePermissionsMap[path] = createPermissions[path].mode;
      }
    });

    setSubmitting(true);
    try {
      await createAdmin({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        password: createForm.password,
        permissions: JSON.stringify(activePermissionsMap),
      });
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', role: 'content_creator', password: '', confirmPassword: '' });
      setCreatePermissions(getDefaultPermissions('content_creator'));
      toast.success(`Account for ${createForm.name} created successfully!`);
      loadAdmins();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create user account.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function openEditPermissionsModal(user) {
    setSelectedUser(user);
    setEditRole(user.role || 'content_creator');
    setEditPermissions(parsePermissionsToState(user.permissions, user.role));
    setError(null);
    setShowPermissionsModal(true);
  }

  async function handleSavePermissions(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const activePermissionsMap = {};
      Object.keys(editPermissions).forEach((path) => {
        if (editPermissions[path].enabled) {
          activePermissionsMap[path] = editPermissions[path].mode;
        }
      });
      await updateUserPermissions(selectedUser.id, {
        role: editRole,
        permissions: JSON.stringify(activePermissionsMap),
      });
      setShowPermissionsModal(false);
      toast.success(`Permissions for ${selectedUser.name} updated successfully!`);
      if (currentUser && currentUser.id === selectedUser.id && refreshUser) {
        await refreshUser();
      }
      setSelectedUser(null);
      loadAdmins();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update user permissions.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(user) {
    const isDisabling = user.status === 'active';
    const actionText = isDisabling ? 'Disable' : 'Enable';
    const confirmed = await confirm({
      title: `${actionText} Account for ${user.name}?`,
      description: isDisabling
        ? `Are you sure you want to disable ${user.name} (${user.email})? They will immediately lose access to the portal until re-enabled.`
        : `Are you sure you want to enable ${user.name} (${user.email})? They will regain access to log in.`,
      confirmText: `${actionText} Account`,
      cancelText: 'Cancel',
      variant: isDisabling ? 'warning' : 'info',
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      if (user.status === 'active') {
        await disableUserAccount(user.id);
      } else {
        await enableUserAccount(user.id);
      }
      toast.success(`Account ${user.name} successfully ${actionText.toLowerCase()}d.`);
      loadAdmins();
    } catch (e) {
      toast.error(e.response?.data?.message || `Failed to ${actionText.toLowerCase()} account`);
    } finally {
      setActionLoading(false);
    }
  }

  function openResetPasswordModal(user) {
    setSelectedUser(user);
    setResetForm({ password: '', confirmPassword: '' });
    setError(null);
    setShowResetModal(true);
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError(null);

    if (resetForm.password !== resetForm.confirmPassword) {
      const msg = 'Passwords do not match.';
      setError(msg);
      toast.warning(msg);
      return;
    }

    if (resetForm.password.length < 8) {
      const msg = 'New password must be at least 8 characters.';
      setError(msg);
      toast.warning(msg);
      return;
    }

    setSubmitting(true);
    try {
      await resetUserPassword(selectedUser.id, resetForm.password);
      setShowResetModal(false);
      toast.success(`Password for ${selectedUser.name} updated successfully!`);
      setSelectedUser(null);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredAdmins = admins.filter((a) => {
    if (roleFilter === 'ALL') return true;
    return (a.role || '').toUpperCase() === roleFilter;
  });

  const getRoleBadge = (roleStr) => {
    const r = (roleStr || '').toUpperCase();
    if (r === 'SUPER_ADMIN') {
      return <span className="role-tag" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-primary)', fontWeight: '700' }}>SUPER ADMIN</span>;
    }
    if (r === 'READONLY_ADMIN' || r === 'READ_ONLY_ADMIN') {
      return <span className="role-tag" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontWeight: '700' }}>READ-ONLY ADMIN</span>;
    }
    if (r === 'CONTENT_CREATOR') {
      return <span className="role-tag" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0284c7', fontWeight: '700' }}>CONTENT CREATOR</span>;
    }
    return <span className="role-tag" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#4f46e5', fontWeight: '700' }}>ADMIN</span>;
  };

  const renderPermissionsGrid = (permissionsMap, setPermissionsMap) => {
    const setAllMode = (mode) => {
      const updated = {};
      ALL_NAVBAR_ITEMS.forEach((item) => {
        updated[item.path] = { enabled: true, mode };
      });
      setPermissionsMap(updated);
    };

    const clearAll = () => {
      const updated = {};
      ALL_NAVBAR_ITEMS.forEach((item) => {
        updated[item.path] = { enabled: false, mode: 'READ_ONLY' };
      });
      setPermissionsMap(updated);
    };

    return (
      <div style={{ marginTop: '14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>Navbar Links &amp; Access Rights</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Select which pages appear in sidebar and set Read-Only vs Editable mode</div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '2px 8px' }} onClick={() => setAllMode('EDITABLE')}>
              Select All (Editable)
            </button>
            <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '2px 8px' }} onClick={() => setAllMode('READ_ONLY')}>
              Select All (Read-Only)
            </button>
            <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '2px 8px' }} onClick={clearAll}>
              Clear All
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
          {ALL_NAVBAR_ITEMS.map((item) => {
            const state = permissionsMap[item.path] || { enabled: false, mode: 'READ_ONLY' };
            return (
              <div
                key={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: state.enabled ? '1px solid var(--accent-primary, #6366f1)' : '1px solid var(--border-subtle)',
                  background: state.enabled ? 'var(--accent-subtle, rgba(99, 102, 241, 0.05))' : 'var(--bg-surface)'
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: state.enabled ? '700' : '500', color: 'var(--text-primary)', flex: 1, margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={state.enabled}
                    onChange={(e) => {
                      setPermissionsMap({
                        ...permissionsMap,
                        [item.path]: { ...state, enabled: e.target.checked }
                      });
                    }}
                  />
                  <span>{item.label}</span>
                </label>

                {state.enabled && (
                  <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setPermissionsMap({ ...permissionsMap, [item.path]: { ...state, mode: 'READ_ONLY' } })}
                      style={{
                        padding: '2px 7px',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        background: state.mode === 'READ_ONLY' ? '#f59e0b' : 'var(--bg-surface)',
                        color: state.mode === 'READ_ONLY' ? '#ffffff' : 'var(--text-muted)'
                      }}
                    >
                      Read-Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermissionsMap({ ...permissionsMap, [item.path]: { ...state, mode: 'EDITABLE' } })}
                      style={{
                        padding: '2px 7px',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        background: state.mode === 'EDITABLE' ? '#10b981' : 'var(--bg-surface)',
                        color: state.mode === 'EDITABLE' ? '#ffffff' : 'var(--text-muted)'
                      }}
                    >
                      Editable
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Administration &amp; Staff Accounts</h1>
          <p className="page-subtitle">
            Manage Super Admins, Administrators, Content Creators, and Read-Only Admin credentials and page access rights.
          </p>
        </div>
        {!isReadOnlyUser && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <i className="fa-solid fa-user-plus" style={{ marginRight: '6px' }}></i>
            Create Staff / Creator Account
          </button>
        )}
      </div>

      <div className="table-card">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All Personnel' },
              { id: 'READONLY_ADMIN', label: 'Read-Only Admins' },
              { id: 'CONTENT_CREATOR', label: 'Content Creators' },
              { id: 'ADMIN', label: 'Admins' },
              { id: 'SUPER_ADMIN', label: 'Super Admins' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRoleFilter(tab.id)}
                className={`btn btn-sm ${roleFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-muted)' }}>
            Showing {filteredAdmins.length} of {admins.length} accounts
          </div>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Personnel</th>
                <th>Role</th>
                <th>Status</th>
                <th>Account Created</th>
                <th>Last Seen</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-empty">Loading administrative accounts…</td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty">No accounts found matching your selection.</td>
                </tr>
              ) : (
                filteredAdmins.map((a) => {
                  const initials = a.name
                    ? a.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                    : 'A';
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="avatar-circle" style={{ width: '36px', height: '36px', fontSize: '0.85rem' }}>
                            {a.profileImage ? (
                              <img src={a.profileImage} alt={a.name} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              initials
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{a.name}</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{a.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {getRoleBadge(a.role)}
                      </td>
                      <td>
                        <span className={`status-badge ${a.status}`}>
                          {a.status}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const { primary, secondary, isOnline } = formatLastSeen(a.lastActiveAt);
                          return (
                            <div>
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.86rem',
                                  fontWeight: isOnline ? '700' : '600',
                                  color: isOnline ? '#10b981' : 'var(--text-primary)'
                                }}
                              >
                                <span
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: isOnline ? '#10b981' : (a.lastActiveAt ? '#94a3b8' : '#cbd5e1'),
                                    boxShadow: isOnline ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none'
                                  }}
                                />
                                {primary}
                              </div>
                              {secondary && (
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {secondary}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isReadOnlyUser ? (
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>View Only</span>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            {(a.role || '').toUpperCase() !== 'SUPER_ADMIN' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                title="Configure Navbar Links & Permissions"
                                onClick={() => openEditPermissionsModal(a)}
                              >
                                <i className="fa-solid fa-sliders" style={{ marginRight: '4px' }}></i>
                                Rights
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Reset Password / Credentials"
                              onClick={() => openResetPasswordModal(a)}
                            >
                              <i className="fa-solid fa-key" style={{ marginRight: '4px' }}></i>
                              Reset
                            </button>
                            {(a.role || '').toUpperCase() !== 'SUPER_ADMIN' && (
                              <button
                                className={`btn btn-sm ${a.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                                disabled={actionLoading}
                                onClick={() => handleToggleStatus(a)}
                              >
                                {a.status === 'active' ? 'Disable' : 'Enable'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Account Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Create Staff / Creator Account
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(false)} aria-label="Close modal">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <AlertBanner type="error" message={error} onClose={() => setError(null)} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Account Role *</label>
                  <select
                    className="form-control"
                    value={createForm.role}
                    onChange={(e) => handleCreateRoleChange(e.target.value)}
                  >
                    <option value="content_creator">Content Creator (Course &amp; Category CRUD, restricted from publish)</option>
                    <option value="readonly_admin">Read-Only Super Admin (View-Only access to Super Admin portal)</option>
                    <option value="super_admin">Super Admin (Full Administrative Privileges)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g. Creator John"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address (Login ID) *</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="creator@onetutor.local"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password * (minimum 8 characters)</label>
                  <input
                    type="password"
                    required
                    className="form-control"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    className="form-control"
                    value={createForm.confirmPassword}
                    onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>

                {/* Navbar Links & Permissions Grid */}
                {renderPermissionsGrid(createPermissions, setCreatePermissions)}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating…' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {showPermissionsModal && selectedUser && (
        <div className="modal-backdrop" onClick={() => setShowPermissionsModal(false)}>
          <div className="modal-dialog" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Configure Access Rights for {selectedUser.name}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPermissionsModal(false)} aria-label="Close modal">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSavePermissions}>
              <AlertBanner type="error" message={error} onClose={() => setError(null)} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <strong>User:</strong> {selectedUser.name} ({selectedUser.email})
                </div>

                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select
                    className="form-control"
                    value={editRole}
                    onChange={(e) => {
                      const nr = e.target.value;
                      setEditRole(nr);
                      setEditPermissions(getDefaultPermissions(nr));
                    }}
                  >
                    <option value="content_creator">Content Creator</option>
                    <option value="readonly_admin">Read-Only Super Admin</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                {renderPermissionsGrid(editPermissions, setEditPermissions)}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPermissionsModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving…' : 'Save Access Rights'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedUser && (
        <div className="modal-backdrop" onClick={() => setShowResetModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Reset Credentials for {selectedUser.name}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowResetModal(false)} aria-label="Close modal">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleResetPassword}>
              <AlertBanner type="error" message={error} onClose={() => setError(null)} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <strong>Login ID:</strong> {selectedUser.email}
                </div>

                <div className="form-group">
                  <label className="form-label">New Password * (minimum 8 characters)</label>
                  <input
                    type="password"
                    required
                    className="form-control"
                    value={resetForm.password}
                    onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password *</label>
                  <input
                    type="password"
                    required
                    className="form-control"
                    value={resetForm.confirmPassword}
                    onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowResetModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Updating Password…' : 'Update Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
