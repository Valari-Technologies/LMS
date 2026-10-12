import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import AlertBanner from '../../components/AlertBanner';
import { usePermission } from '../../hooks/usePermission';

export default function AdminCategoriesPage() {
  const { isReadOnly } = usePermission();
  const { toast, confirm } = useNotification();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/categories', { params: { size: 100, includeArchived: true } });
      setCategories(res.data.data.content || []);
    } catch (err) {
      // ignore
    }
  };

  const openEdit = (c) => {
    setEditingCategory(c);
    setEditName(c.name);
    setEditDescription(c.description || '');
  };

  const closeEdit = () => {
    setEditingCategory(null);
    setEditName('');
    setEditDescription('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!editName.trim()) return;
    setEditLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.put(`/categories/${editingCategory.id}`, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      const msg = `Category "${editName.trim()}" updated successfully!`;
      setSuccess(msg);
      toast.success(msg);
      closeEdit();
      load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not update category.';
      setError(msg);
      toast.error(msg);
    } finally {
      setEditLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    setError('');
    setSuccess('');
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.post('/categories', { name: name.trim(), description: description.trim() });
      setName('');
      setDescription('');
      const msg = 'Category added successfully!';
      setSuccess(msg);
      toast.success(msg);
      load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not create category.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id, catName) => {
    if (isReadOnly) return;
    const confirmed = await confirm({
      title: 'Archive Category?',
      description: `Are you sure you want to archive category "${catName}"?\n\nExisting courses will keep it, but new courses cannot select it.`,
      confirmText: 'Archive Category',
      cancelText: 'Cancel',
      variant: 'archive'
    });
    if (!confirmed) return;

    try {
      await api.post(`/categories/${id}/archive`);
      const msg = `Category "${catName}" archived successfully!`;
      setSuccess(msg);
      toast.success(msg);
      load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not archive category.';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleUnarchive = async (id, catName) => {
    if (isReadOnly) return;
    setError('');
    setSuccess('');
    try {
      await api.post(`/categories/${id}/unarchive`);
      const msg = `Category "${catName}" unarchived successfully!`;
      setSuccess(msg);
      toast.success(msg);
      load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not unarchive category.';
      setError(msg);
      toast.error(msg);
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q));
  });

  const totalCount = categories.length;
  const activeCount = categories.filter((c) => c.status === 'active').length;
  const archivedCount = categories.filter((c) => c.status === 'archived').length;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Categories Management</h1>
          <p className="page-subtitle">
            Classify and organize courses into discoverable domain tracks.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="kpi-grid">
        <div
          className="kpi-card"
          onClick={() => setStatusFilter('ALL')}
          style={{ cursor: 'pointer', outline: statusFilter === 'ALL' ? '2px solid var(--accent-primary)' : 'none' }}
          title="Show all categories"
        >
          <div className="kpi-icon">
            <i className="fa-solid fa-tags"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-val">{totalCount}</span>
            <span className="kpi-label">Total Categories</span>
          </div>
        </div>
        <div
          className="kpi-card"
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'ALL' : 'active')}
          style={{ cursor: 'pointer', outline: statusFilter === 'active' ? '2px solid var(--success-text)' : 'none' }}
          title="Filter active categories"
        >
          <div className="kpi-icon" style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}>
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-val">{activeCount}</span>
            <span className="kpi-label">Active Categories</span>
          </div>
        </div>
        <div
          className="kpi-card"
          onClick={() => setStatusFilter(statusFilter === 'archived' ? 'ALL' : 'archived')}
          style={{ cursor: 'pointer', outline: statusFilter === 'archived' ? '2px solid var(--danger-text)' : 'none' }}
          title="Filter archived categories"
        >
          <div className="kpi-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
            <i className="fa-solid fa-box-archive"></i>
          </div>
          <div className="kpi-info">
            <span className="kpi-val">{archivedCount}</span>
            <span className="kpi-label">Archived Categories</span>
          </div>
        </div>
      </div>

      <AlertBanner type="error" message={error} onClose={() => setError('')} />
      <AlertBanner type="success" message={success} onClose={() => setSuccess('')} />

      {/* Add Category Form Card */}
      {!isReadOnly && (
        <div className="form-card">
          <h2 className="form-section-title">
            <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i> Add New Category
          </h2>
          <form onSubmit={handleCreate}>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  className="form-control"
                  placeholder="e.g. Mobile App Development"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <input
                  className="form-control"
                  placeholder="Brief summary of topics covered in this track"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating…' : '+ Add Category'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories Table Card */}
      <div className="table-card">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              Categories ({filteredCategories.length})
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`btn btn-sm ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`btn btn-sm ${statusFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('archived')}
                className={`btn btn-sm ${statusFilter === 'archived' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              >
                Archived ({archivedCount})
              </button>
            </div>
          </div>
          <div className="table-search">
            <input
              type="search"
              className="form-control"
              placeholder="Search categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Category Name</th>
                <th>Description</th>
                <th style={{ width: '15%' }}>Status</th>
                <th style={{ width: '18%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan="4" className="table-empty">
                    No categories found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((c) => (
                  <tr
                    key={c.id}
                    style={c.status === 'archived' ? { opacity: 0.85, background: 'rgba(239, 68, 68, 0.03)' } : {}}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                        <span>{c.status === 'archived' ? '📦' : '📁'}</span>
                        <span style={c.status === 'archived' ? { color: 'var(--text-secondary)' } : {}}>
                          {c.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {c.description || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${c.status}`}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!isReadOnly ? (
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button
                            onClick={() => openEdit(c)}
                            className="btn btn-secondary btn-sm"
                            title="Edit category"
                            aria-label="Edit category"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          {c.status === 'active' ? (
                            <button
                              onClick={() => handleArchive(c.id, c.name)}
                              className="btn btn-secondary btn-sm"
                              title="Archive category"
                              aria-label="Archive category"
                            >
                              <i className="fa-solid fa-box-archive"></i>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnarchive(c.id, c.name)}
                              className="btn btn-secondary btn-sm"
                              title="Unarchive category and set back to active"
                              aria-label="Unarchive category"
                              style={{
                                color: 'var(--accent-primary)',
                                borderColor: 'var(--accent-primary)',
                              }}
                            >
                              <i className="fa-solid fa-arrow-rotate-left"></i>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '0.78rem' }}>Read Only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="modal-backdrop" onClick={closeEdit}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>
                <i className="fa-solid fa-pen-to-square" style={{ marginRight: '8px', color: 'var(--accent-primary)' }}></i>
                Edit Category
              </h3>
              <button
                type="button"
                onClick={closeEdit}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Category Name *</label>
                <input
                  className="form-control"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Description (Optional)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Brief summary of topics covered in this track"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeEdit}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editLoading}
                >
                  {editLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
