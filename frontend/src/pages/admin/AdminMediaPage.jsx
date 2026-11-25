import { useState, useEffect, useRef } from 'react';
import { listMedia, uploadMedia, updateMedia, deleteMedia } from '../../api/media';
import { useNotification } from '../../context/NotificationContext';
import { usePermission } from '../../hooks/usePermission';
import { resolveMediaUrl } from '../../utils/mediaUtils';

export default function AdminMediaPage() {
  const { isReadOnly } = usePermission();
  const { toast, confirm } = useNotification();
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('ALL'); // 'ALL' | 'ONETUTOR' | 'USER'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [editName, setEditName] = useState('');
  const [editFile, setEditFile] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

  useEffect(() => {
    loadMedia();
  }, [search, sourceFilter, page]);

  async function loadMedia() {
    setLoading(true);
    try {
      const res = await listMedia({ search, source: sourceFilter, page, size: 24 });
      setMediaList(res?.content || []);
      setTotalPages(res?.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function getFileCategory(name = '', mime = '') {
    const lowerName = name.toLowerCase();
    const lowerMime = mime.toLowerCase();

    if (lowerMime.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg|bmp|ico)$/.test(lowerName)) {
      return 'image';
    }
    if (lowerMime.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/.test(lowerName)) {
      return 'video';
    }
    if (lowerMime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/.test(lowerName)) {
      return 'audio';
    }
    if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
      return 'pdf';
    }
    if (lowerMime.includes('word') || /\.(doc|docx)$/.test(lowerName)) {
      return 'word';
    }
    if (lowerMime.includes('excel') || lowerMime.includes('spreadsheet') || /\.(xls|xlsx|csv)$/.test(lowerName)) {
      return 'excel';
    }
    if (lowerMime.includes('presentation') || lowerMime.includes('powerpoint') || /\.(ppt|pptx)$/.test(lowerName)) {
      return 'powerpoint';
    }
    if (lowerMime.includes('zip') || /\.(zip|rar|7z|tar|gz)$/.test(lowerName)) {
      return 'archive';
    }
    if (lowerMime.startsWith('text/') || /\.(txt|md|json|xml|html|css|js)$/.test(lowerName)) {
      return 'text';
    }
    return 'file';
  }

  async function handleFileUpload(file) {
    if (isReadOnly) return;
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadFileName(file.name);
    const cat = getFileCategory(file.name, file.type);
    const tempUrl = URL.createObjectURL(file);
    const tempId = 'temp-' + Date.now();

    const optimisticAsset = {
      id: tempId,
      filename: file.name,
      fileName: file.name,
      originalName: file.name,
      fileType: cat,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      url: tempUrl,
      storagePath: tempUrl,
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };

    setMediaList(prev => [optimisticAsset, ...prev]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // Upload directly to Cloudinary
    try {
      const realAsset = await uploadMedia(file, (pct) => setUploadProgress(pct));
      setMediaList(prev => prev.map(a => a.id === tempId ? (realAsset || a) : a));
      toast.success(`"${file.name}" uploaded to Cloudinary successfully!`);
    } catch (err) {
      setMediaList(prev => prev.filter(a => a.id !== tempId));
      toast.error(err.response?.data?.message || err.message || 'Failed to upload media asset to Cloudinary.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  async function handleDelete(id, filename) {
    if (isReadOnly) return;
    const confirmed = await confirm({
      title: 'Delete Asset from Cloudinary?',
      description: `Are you sure you want to permanently delete "${filename}" from Cloudinary? This action cannot be undone.`,
      confirmText: 'Delete from Cloudinary',
      cancelText: 'Cancel',
      variant: 'delete'
    });
    if (!confirmed) return;

    try {
      await deleteMedia(id);
      toast.success(`Asset "${filename}" deleted from Cloudinary.`);
      setMediaList(prev => prev.filter(a => a.id !== id));
      loadMedia();
      if (selectedAsset && selectedAsset.id === id) setSelectedAsset(null);
    } catch (e) {
      toast.error('Failed to delete asset from Cloudinary');
    }
  }

  function openEditModal(asset) {
    setEditingAsset(asset);
    setEditName(asset.filename || asset.fileName || '');
    setEditFile(null);
    setUpdateProgress(0);
  }

  async function handleUpdateSubmit(e) {
    e.preventDefault();
    if (isReadOnly || !editingAsset) return;
    setUpdating(true);
    setUpdateProgress(0);
    try {
      const updated = await updateMedia(editingAsset.id, { name: editName, file: editFile });
      toast.success('Asset updated on Cloudinary successfully!');
      setEditingAsset(null);
      setMediaList(prev => prev.map(a => a.id === editingAsset.id ? (updated || a) : a));
      loadMedia();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update asset on Cloudinary.');
    } finally {
      setUpdating(false);
      setUpdateProgress(0);
    }
  }

  function copyUrl(asset) {
    const rawUrl = (asset.storagePath && (asset.storagePath.startsWith('http://') || asset.storagePath.startsWith('https://')))
      ? asset.storagePath
      : (asset.url && (asset.url.startsWith('http://') || asset.url.startsWith('https://'))
        ? asset.url
        : (asset.storagePath || asset.url || ''));
    const fullUrl = resolveMediaUrl(rawUrl);
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(asset.id);
    toast.info('Cloudinary CDN URL copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function isUserSideAsset(asset) {
    if (!asset) return false;
    if (asset.uploaderSource === 'USER') return true;
    if (asset.uploaderSource === 'ONETUTOR') return false;
    if (asset.uploadedByRole === 'student') return true;
    if (['admin', 'super_admin', 'content_creator', 'readonly_admin'].includes(asset.uploadedByRole)) return false;
    const email = (asset.uploadedBy || '').toLowerCase();
    if (email && !email.includes('admin') && !email.includes('onetutor') && email.includes('@')) {
      return true;
    }
    return false;
  }

  const filteredMedia = mediaList.filter((asset) => {
    // 1. Source filter (One Tutor vs User)
    const isUser = isUserSideAsset(asset);
    if (sourceFilter === 'ONETUTOR' && isUser) return false;
    if (sourceFilter === 'USER' && !isUser) return false;

    // 2. Category filter
    const cat = getFileCategory(asset.filename || asset.fileName, asset.mimeType);
    if (categoryFilter === 'IMAGE') return cat === 'image';
    if (categoryFilter === 'VIDEO') return cat === 'video';
    if (categoryFilter === 'AUDIO') return cat === 'audio';
    if (categoryFilter === 'DOCUMENT') return ['pdf', 'word', 'excel', 'powerpoint', 'text'].includes(cat);
    if (categoryFilter === 'ARCHIVE') return cat === 'archive';
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title-wrap">
          <h1 className="page-title">Cloudinary Media & Documents</h1>
          <p className="page-subtitle">
            Upload, manage, update, and stream all images, documents, videos, and audio hosted on Cloudinary CDN.
          </p>
        </div>

        {!isReadOnly && (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              style={{ display: 'none' }}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
            />
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                  Uploading to Cloudinary…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: '6px' }}></i>
                  Upload to Cloudinary
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '32px 20px',
          textAlign: 'center',
          background: dragOver ? 'var(--accent-subtle)' : 'var(--bg-card)',
          cursor: 'pointer',
          marginBottom: '24px',
          transition: 'all var(--transition-fast)'
        }}
      >
        <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>
          <i className="fa-solid fa-cloud-arrow-up" style={{ color: 'var(--accent-primary)' }}></i>
        </div>
        <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
          {uploading ? 'Uploading asset directly to Cloudinary CDN...' : 'Click to select or drag & drop files here'}
        </div>
        <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '6px' }}>
          Supports <strong>Images</strong> (PNG, JPG, WebP, GIF, SVG), <strong>Documents</strong> (PDF, DOCX, XLSX, PPTX, TXT, CSV), <strong>Media</strong> (MP4, MP3, WAV), and <strong>Archives</strong> (ZIP, RAR) up to 100MB
        </div>

        {uploading && (
          <div style={{ marginTop: '16px', maxWidth: '420px', marginInline: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
              <span>Uploading <strong>{uploadFileName}</strong></span>
              <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{uploadProgress}%</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-card-hover, rgba(255,255,255,0.08))', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #06b6d4)', transition: 'width 0.2s ease', borderRadius: '999px' }} />
            </div>
          </div>
        )}
      </div>

      {/* Search & Category Filter Bar */}
      <div className="table-card" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Row 1: Source Filter (One Tutor vs User) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-subtle, #f1f5f9)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Source:
            </span>
            <div style={{
              display: 'inline-flex',
              background: 'var(--border-subtle, #f1f5f9)',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid var(--border-default, #e2e8f0)',
              gap: '4px'
            }}>
              {[
                { id: 'ALL', label: 'All Media', icon: 'fa-layer-group', desc: 'All assets' },
                { id: 'ONETUTOR', label: 'One Tutor', icon: 'fa-graduation-cap', desc: 'Added by One Tutor side' },
                { id: 'USER', label: 'User', icon: 'fa-user', desc: 'Added by user side' }
              ].map((s) => {
                const isActive = sourceFilter === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSourceFilter(s.id); setPage(0); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '6px 16px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      background: isActive ? 'var(--accent-primary, #4f46e5)' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--text-secondary, #64748b)',
                      boxShadow: isActive ? '0 2px 6px rgba(79, 70, 229, 0.28)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title={s.desc}
                  >
                    <i className={`fa-solid ${s.icon}`} style={{ fontSize: '0.8rem' }}></i>
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {sourceFilter === 'ONETUTOR' && 'Showing only assets added by One Tutor (courses, curriculum & staff)'}
            {sourceFilter === 'USER' && 'Showing only assets uploaded by user side (doubt clearance & community)'}
            {sourceFilter === 'ALL' && 'Showing all Cloudinary assets from One Tutor and users'}
          </span>
        </div>

        {/* Row 2: Search Input & Asset Types */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="search"
            className="form-control"
            placeholder="Search media & documents by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            style={{ flex: 1, minWidth: '220px' }}
          />

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All Types', icon: 'fa-shapes' },
              { id: 'IMAGE', label: 'Images', icon: 'fa-image' },
              { id: 'DOCUMENT', label: 'Documents & PDFs', icon: 'fa-file-lines' },
              { id: 'VIDEO', label: 'Videos', icon: 'fa-film' },
              { id: 'AUDIO', label: 'Audio', icon: 'fa-music' },
              { id: 'ARCHIVE', label: 'Archives', icon: 'fa-file-zipper' }
            ].map((cat) => (
              <button
                key={cat.id}
                className={`btn btn-sm ${categoryFilter === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCategoryFilter(cat.id)}
              >
                <i className={`fa-solid ${cat.icon}`} style={{ marginRight: '5px' }}></i>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
          Loading Cloudinary assets...
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <p>No assets found matching the selected filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {filteredMedia.map((asset) => {
            const fileName = asset.filename || asset.fileName || 'file';
            const cat = getFileCategory(fileName, asset.mimeType);
            const isCloudinary = asset.url?.includes('cloudinary.com') || asset.url?.startsWith('http');
            const isUser = isUserSideAsset(asset);

            return (
              <div key={asset.id} className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div
                  onClick={() => setSelectedAsset(asset)}
                  style={{
                    height: '150px',
                    background: 'linear-gradient(135deg, #131d33 0%, #1e293b 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  {cat === 'image' ? (
                    <img src={resolveMediaUrl(asset.url)} alt={fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : cat === 'video' ? (
                    <span style={{ fontSize: '2.5rem' }}><i className="fa-solid fa-film" style={{ color: '#a78bfa' }}></i></span>
                  ) : cat === 'audio' ? (
                    <span style={{ fontSize: '2.5rem' }}><i className="fa-solid fa-music" style={{ color: '#38bdf8' }}></i></span>
                  ) : cat === 'pdf' ? (
                    <span style={{ fontSize: '2.5rem' }}><i className="fa-solid fa-file-pdf" style={{ color: '#ef4444' }}></i></span>
                  ) : cat === 'word' ? (
                    <span style={{ fontSize: '2.5rem' }}><i className="fa-solid fa-file-word" style={{ color: '#3b82f6' }}></i></span>
                  ) : cat === 'excel' ? (
                    <span style={{ fontSize: '2.5rem' }}><i className="fa-solid fa-file-excel" style={{ color: '#10b981' }}></i></span>
                  ) : cat === 'powerpoint' ? (
                    <span style={{ fontSize: '2.5rem' }}><i className="fa-solid fa-file-powerpoint" style={{ color: '#f97316' }}></i></span>
                  ) : cat === 'archive' ? (
                    <span style={{ fontSize: '2.5rem' }}><i className="fa-solid fa-file-zipper" style={{ color: '#f59e0b' }}></i></span>
                  ) : cat === 'text' ? (
                    <span style={{ fontSize: '2.5rem' }}><i className="fa-solid fa-file-lines" style={{ color: '#94a3b8' }}></i></span>
                  ) : (
                    <span style={{ fontSize: '2.5rem' }}><i className="fa-solid fa-file" style={{ color: '#94a3b8' }}></i></span>
                  )}

                  {/* Cloudinary Badge */}
                  {isCloudinary && (
                    <span style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      fontSize: '0.68rem',
                      fontWeight: '800',
                      background: 'rgba(56, 189, 248, 0.95)',
                      color: '#0f172a',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                      ☁️ Cloudinary
                    </span>
                  )}

                  {/* Source Badge: One Tutor vs User */}
                  <span style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    fontSize: '0.68rem',
                    fontWeight: '800',
                    background: isUser ? 'rgba(245, 158, 11, 0.95)' : 'rgba(90, 112, 211, 0.95)',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <i className={`fa-solid ${isUser ? 'fa-user' : 'fa-graduation-cap'}`}></i>
                    {isUser ? 'User' : 'One Tutor'}
                  </span>

                  <span style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)'
                  }}>
                    {cat.toUpperCase()}
                  </span>
                </div>

                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fileName}>
                    {fileName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {formatBytes(asset.fileSize)} • {new Date(asset.createdAt).toLocaleDateString()}
                  </div>

                  {/* Uploader Display */}
                  <div style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    marginTop: '4px',
                    color: isUser ? '#d97706' : '#5A70D3',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <i className={`fa-solid ${isUser ? 'fa-user' : 'fa-graduation-cap'}`}></i>
                    <span>
                      {isUser
                        ? `User: ${asset.uploaderName || asset.uploadedBy || 'Student'}`
                        : 'One Tutor'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => copyUrl(asset)}
                      style={{ flex: 1 }}
                      title="Copy Cloudinary direct link"
                    >
                      {copiedId === asset.id ? <><i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i>Copied</> : <><i className="fa-solid fa-link" style={{ marginRight: '4px' }}></i>CDN Link</>}
                    </button>
                    {!isReadOnly && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(asset)}
                        title="Update name or replace file on Cloudinary"
                      >
                        <i className="fa-solid fa-pen"></i>
                      </button>
                    )}
                    {!isReadOnly && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDelete(asset.id, fileName)}
                        style={{ color: '#ef4444' }}
                        title="Delete file permanently from Cloudinary"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Asset Preview Modal */}
      {selectedAsset && (
        <div className="modal-backdrop" onClick={() => setSelectedAsset(null)}>
          <div className="modal-dialog" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  {selectedAsset.filename || selectedAsset.fileName}
                </div>
                {selectedAsset.url?.includes('cloudinary.com') && (
                  <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: '600' }}>
                    ☁️ Cloudinary CDN Asset
                  </span>
                )}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedAsset(null)}>✕</button>
            </div>

            <div style={{ textAlign: 'center', background: '#090d16', borderRadius: 'var(--radius-md)', overflow: 'hidden', minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              {(() => {
                const fileName = selectedAsset.filename || selectedAsset.fileName || '';
                const cat = getFileCategory(fileName, selectedAsset.mimeType);

                const previewSrc = resolveMediaUrl(selectedAsset.url);

                if (cat === 'video') {
                  return <video src={previewSrc} controls style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '8px' }} />;
                }
                if (cat === 'image') {
                  return <img src={previewSrc} alt={fileName} style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain' }} />;
                }
                if (cat === 'audio') {
                  return <audio src={previewSrc} controls style={{ width: '100%' }} />;
                }
                if (cat === 'pdf') {
                  return (
                    <div style={{ width: '100%', height: '460px', display: 'flex', flexDirection: 'column' }}>
                      <iframe src={previewSrc} title={fileName} width="100%" height="400px" style={{ border: 'none', borderRadius: '8px', background: '#fff' }} />
                      <div style={{ marginTop: '10px' }}>
                        <a href={previewSrc} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                          <i className="fa-solid fa-up-right-from-square" style={{ marginRight: '6px' }}></i>
                          Open PDF in New Window
                        </a>
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{ color: '#fff', padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '14px' }}>
                      {cat === 'word' ? <i className="fa-solid fa-file-word" style={{ color: '#3b82f6' }}></i> :
                       cat === 'excel' ? <i className="fa-solid fa-file-excel" style={{ color: '#10b981' }}></i> :
                       cat === 'powerpoint' ? <i className="fa-solid fa-file-powerpoint" style={{ color: '#f97316' }}></i> :
                       cat === 'archive' ? <i className="fa-solid fa-file-zipper" style={{ color: '#f59e0b' }}></i> :
                       <i className="fa-solid fa-file" style={{ color: '#94a3b8' }}></i>}
                    </div>
                    <p style={{ margin: '0 0 16px 0', fontSize: '0.95rem' }}>{fileName}</p>
                    <a href={previewSrc} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                      <i className="fa-solid fa-cloud-arrow-down" style={{ marginRight: '6px' }}></i>
                      Download from Cloudinary
                    </a>
                  </div>
                );
              })()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <span>{formatBytes(selectedAsset.fileSize)} • {selectedAsset.mimeType}</span>
                <span>•</span>
                <span style={{
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: isUserSideAsset(selectedAsset) ? 'rgba(245, 158, 11, 0.12)' : 'rgba(90, 112, 211, 0.12)',
                  color: isUserSideAsset(selectedAsset) ? '#d97706' : '#5A70D3'
                }}>
                  {isUserSideAsset(selectedAsset)
                    ? `Uploaded by User (${selectedAsset.uploaderName || selectedAsset.uploadedBy || 'Student'})`
                    : 'Uploaded by One Tutor'}
                </span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => copyUrl(selectedAsset)}>
                {copiedId === selectedAsset.id ? '✓ Copied' : 'Copy Cloudinary URL'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Update Asset Modal */}
      {editingAsset && (
        <div className="modal-backdrop" onClick={() => setEditingAsset(null)}>
          <div className="modal-dialog" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Edit Cloudinary Asset</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingAsset(null)}>✕</button>
            </div>

            <form onSubmit={handleUpdateSubmit}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Asset Title / Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter title..."
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Replace File on Cloudinary (Optional)</label>
                <input
                  type="file"
                  className="form-control"
                  ref={editFileInputRef}
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                />
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                  If selected, the existing asset on Cloudinary will be destroyed and replaced with this file.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingAsset(null)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updating}
                >
                  {updating ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                      Updating on Cloudinary...
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
