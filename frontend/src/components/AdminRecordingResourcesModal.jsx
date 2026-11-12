import { useState, useEffect, useRef } from 'react';
import { uploadMedia, listMedia } from '../api/media';
import { resolveMediaUrl } from '../utils/mediaUtils';
import { toast } from '../context/NotificationContext';
import {
  getRecordingResources,
  addRecordingResource,
  deleteRecordingResource,
  clearAllRecordingResources,
  inferResourceType,
  getResourceVisual,
  downloadResourceFile
} from '../utils/recordingResources';

export default function AdminRecordingResourcesModal({ recording, session, onClose, onUpdated }) {
  const [resources, setResources] = useState([]);
  const [activeSourceTab, setActiveSourceTab] = useState('upload'); // 'upload' | 'library' | 'url'
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form states for manual or URL attachment
  const [resourceForm, setResourceForm] = useState({
    name: '',
    url: '',
    type: 'PDF',
    size: ''
  });

  // Media Library states
  const [mediaLibrary, setMediaLibrary] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const fileInputRef = useRef(null);

  const recId = recording?.id;

  const reloadResources = () => {
    if (!recId) return;
    const list = getRecordingResources(recId, recording?.subtitleUrl);
    setResources(list);
    if (onUpdated) onUpdated();
  };

  useEffect(() => {
    reloadResources();
  }, [recId, recording?.subtitleUrl]);

  // Load media library when library tab is activated
  useEffect(() => {
    if (activeSourceTab === 'library') {
      loadMedia();
    }
  }, [activeSourceTab, mediaSearch]);

  const loadMedia = async () => {
    setMediaLoading(true);
    try {
      const data = await listMedia({ search: mediaSearch, size: 24 });
      setMediaLibrary(data?.content || data || []);
    } catch (e) {
      console.warn('Failed to load media library:', e);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const inferred = inferResourceType(file.name);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    const sizeStr = `${sizeMb} MB`;

    setSubmitting(true);
    setUploadProgress(10);

    try {
      const uploaded = await uploadMedia(file, (percent) => {
        setUploadProgress(percent);
      });

      const fileUrl = uploaded?.storagePath || uploaded?.url || (uploaded?.id ? `/api/v1/media/files/${uploaded.id}` : '');
      if (!fileUrl) throw new Error('Upload succeeded but no file URL returned');

      addRecordingResource(recId, {
        name: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
        url: fileUrl,
        type: inferred,
        size: sizeStr
      });

      toast.success(`Attached "${file.name}" to recording successfully!`);
      reloadResources();
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      toast.error('Failed to upload resource file. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectFromLibrary = (asset) => {
    const assetUrl = asset.storagePath || asset.url || `/api/v1/media/files/${asset.id}`;
    const assetName = asset.filename || asset.originalName || 'Class Resource';
    const inferred = inferResourceType(assetName, assetUrl);

    addRecordingResource(recId, {
      name: assetName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
      url: assetUrl,
      type: inferred,
      size: asset.size ? `${(asset.size / (1024 * 1024)).toFixed(1)} MB` : ''
    });

    toast.success(`Attached "${assetName}" to recording!`);
    reloadResources();
  };

  const handleSaveUrlResource = (e) => {
    e.preventDefault();
    if (!resourceForm.name.trim() || !resourceForm.url.trim()) {
      toast.error('Resource name and URL/path are required.');
      return;
    }

    addRecordingResource(recId, {
      name: resourceForm.name.trim(),
      url: resourceForm.url.trim(),
      type: resourceForm.type || inferResourceType(resourceForm.name, resourceForm.url),
      size: resourceForm.size || ''
    });

    toast.success(`Resource "${resourceForm.name}" attached successfully!`);
    setResourceForm({ name: '', url: '', type: 'PDF', size: '' });
    reloadResources();
  };

  const handleDelete = (r) => {
    if (r.isSystemSubtitle) {
      toast.error('System generated subtitle streams cannot be deleted here.');
      return;
    }
    deleteRecordingResource(recId, r.id);
    toast.success(`Removed "${r.name}".`);
    reloadResources();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 4500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 4501
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(90, 112, 211, 0.12)',
              color: '#5A70D3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.15rem'
            }}>
              <i className="fa-solid fa-paperclip"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                Recording Class Resources
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                {session?.title || 'Live Interactive Class'} &bull; Recording #{recording?.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#64748b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem'
            }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* Section 1: Currently Attached Resources List */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                  Currently Attached ({resources.length})
                </span>
                {resources.filter(r => !r.isSystemSubtitle).length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearAllRecordingResources(recId);
                      toast.success('All attached resources removed.');
                      reloadResources();
                    }}
                    style={{
                      border: '1px solid #fecdd3',
                      background: '#fff1f2',
                      color: '#e11d48',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Remove all uploaded resources for this recording"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    <span>Clear All</span>
                  </button>
                )}
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Available for student download in Resources tab
              </span>
            </div>

            {resources.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px'
              }}>
                <i className="fa-regular fa-folder-open" style={{ fontSize: '1.8rem', color: '#94a3b8', marginBottom: '8px', display: 'block' }}></i>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                  No downloadable resources attached yet
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Attach PDFs, slides, code ZIPs, or documentation links below.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {resources.map((r) => {
                  const visual = getResourceVisual(r.type);
                  return (
                    <div
                      key={r.id}
                      style={{
                        padding: '10px 14px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: visual.bg,
                          color: visual.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                          flexShrink: 0
                        }}>
                          <i className={visual.icon}></i>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                            <span style={{ fontWeight: 700, color: visual.color }}>{visual.badge}</span>
                            {r.size && <span>&bull; {r.size}</span>}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => downloadResourceFile(r.url, r.name)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Test download file"
                        >
                          <i className="fa-solid fa-download"></i>
                          <span>Download</span>
                        </button>
                        {!r.isSystemSubtitle && (
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: '#fff1f2',
                              border: '1px solid #fecdd3',
                              color: '#e11d48',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                            title="Remove resource"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Attach New Resource */}
          <div style={{
            borderTop: '1px solid #e2e8f0',
            paddingTop: '18px'
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.94rem', fontWeight: 800, color: '#0f172a' }}>
              Attach a New Resource
            </h4>

            {/* Source Tab Switcher */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setActiveSourceTab('upload')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: activeSourceTab === 'upload' ? 800 : 600,
                  background: activeSourceTab === 'upload' ? '#5A70D3' : '#f8fafc',
                  color: activeSourceTab === 'upload' ? '#ffffff' : '#64748b',
                  border: activeSourceTab === 'upload' ? '1px solid #5A70D3' : '1px solid #cbd5e1',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-cloud-arrow-up"></i>
                <span>Direct Upload</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSourceTab('library')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: activeSourceTab === 'library' ? 800 : 600,
                  background: activeSourceTab === 'library' ? '#5A70D3' : '#f8fafc',
                  color: activeSourceTab === 'library' ? '#ffffff' : '#64748b',
                  border: activeSourceTab === 'library' ? '1px solid #5A70D3' : '1px solid #cbd5e1',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-photo-film"></i>
                <span>Media Library</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSourceTab('url')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: activeSourceTab === 'url' ? 800 : 600,
                  background: activeSourceTab === 'url' ? '#5A70D3' : '#f8fafc',
                  color: activeSourceTab === 'url' ? '#ffffff' : '#64748b',
                  border: activeSourceTab === 'url' ? '1px solid #5A70D3' : '1px solid #cbd5e1',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-link"></i>
                <span>External Link / URL</span>
              </button>
            </div>

            {/* Tab 1: Upload File */}
            {activeSourceTab === 'upload' && (
              <div style={{
                padding: '24px',
                background: '#f8fafc',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <i className="fa-solid fa-file-arrow-up" style={{ fontSize: '2rem', color: '#5A70D3', marginBottom: '8px', display: 'block' }}></i>
                <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0f172a', marginBottom: '4px' }}>
                  Upload PDF, PPT, Code ZIP, or Document
                </div>
                <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Files are securely stored and uploaded directly to Cloudinary CDN for instant student downloads.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="rec-resource-file"
                  onChange={handleUploadFile}
                  style={{ display: 'none' }}
                  accept=".pdf,.zip,.rar,.tar,.gz,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.js,.py,.html,.css"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    background: '#5A70D3',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.86rem',
                    border: 'none',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <i className={`fa-solid ${submitting ? 'fa-spinner fa-spin' : 'fa-plus'}`}></i>
                  <span>{submitting ? `Uploading (${uploadProgress}%)…` : 'Select File to Attach'}</span>
                </button>
              </div>
            )}

            {/* Tab 2: Media Library */}
            {activeSourceTab === 'library' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Search media library by file name…"
                  value={mediaSearch}
                  onChange={(e) => setMediaSearch(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem'
                  }}
                />
                {mediaLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i> Loading library…
                  </div>
                ) : mediaLibrary.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.86rem' }}>
                    No media assets found.
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: '10px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    padding: '4px'
                  }}>
                    {mediaLibrary.map(asset => (
                      <div
                        key={asset.id}
                        onClick={() => handleSelectFromLibrary(asset)}
                        style={{
                          padding: '10px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: '#ffffff',
                          textAlign: 'center',
                          transition: 'all 0.15s ease'
                        }}
                        title={`Attach ${asset.filename || 'this file'}`}
                      >
                        <i className="fa-solid fa-file" style={{ fontSize: '1.4rem', color: '#5A70D3', marginBottom: '4px', display: 'block' }}></i>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {asset.filename || asset.originalName || 'Asset'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>
                          + Attach
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: External URL / Link */}
            {activeSourceTab === 'url' && (
              <form onSubmit={handleSaveUrlResource} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Resource Label / Title *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Full Stack Architecture Notes"
                      value={resourceForm.name}
                      onChange={(e) => setResourceForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Format / Type
                    </label>
                    <select
                      value={resourceForm.type}
                      onChange={(e) => setResourceForm(prev => ({ ...prev, type: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                    >
                      <option value="PDF">PDF Document</option>
                      <option value="ZIP">ZIP Archive / Code</option>
                      <option value="SLIDES">Lecture Slides</option>
                      <option value="DOCUMENT">Document</option>
                      <option value="CODE">Source Code</option>
                      <option value="LINK">External Link</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Download URL or Direct Link *
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/... or https://github.com/..."
                    value={resourceForm.url}
                    onChange={(e) => setResourceForm(prev => ({ ...prev, url: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      background: '#5A70D3',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '0.84rem',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i>
                    Attach Resource
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              background: '#0f172a',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.86rem',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

