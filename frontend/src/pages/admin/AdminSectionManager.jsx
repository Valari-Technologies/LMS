import { useEffect, useState, useRef } from 'react';
import { 
  listSections, 
  createSection, 
  updateSection, 
  archiveSection, 
  deleteSectionPermanently, 
  restoreSection 
} from '../../api/sections';
import { 
  listContents, 
  createContent, 
  updateContent, 
  archiveContent, 
  deleteContentPermanently, 
  restoreContent, 
  addResource,
  listResources,
  updateResource,
  deleteResource,
  generateAdminSubtitles
} from '../../api/contents';
import { listMedia, uploadMedia } from '../../api/media';
import { useNotification } from '../../context/NotificationContext';
import AlertBanner from '../../components/AlertBanner';
import AssessmentAdminEditor from '../../components/assessments/AssessmentAdminEditor';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../auth/AuthContext';
import RecordingVideoPlayer from '../../components/RecordingVideoPlayer';
import { resolveMediaUrl } from '../../utils/mediaUtils';

const CONTENT_TYPES = ['VIDEO', 'PDF', 'IMAGE'];

const CONTENT_TYPE_OPTIONS = [
  { value: 'VIDEO', label: 'Video' },
  { value: 'PDF', label: 'PDF Document' },
  { value: 'IMAGE', label: 'Image' },
];

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const str = String(url).trim();
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = str.match(regExp);
  return (match && match[2] && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

export default function AdminSectionManager({ courseId, isReadOnly: propIsReadOnly }) {
  const { isReadOnly: hookIsReadOnly } = usePermission();
  const isReadOnly = propIsReadOnly || hookIsReadOnly;
  const { user } = useAuth();
  const isContentCreator = user?.role === 'content_creator' || user?.role === 'creator';
  const { toast, confirm } = useNotification();
  const [sections, setSections] = useState([]);
  const [contentsBySection, setContentsBySection] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [showArchivedLessons, setShowArchivedLessons] = useState({});

  // Form states
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionDesc, setNewSectionDesc] = useState('');
  const [creatingSection, setCreatingSection] = useState(false);

  // Per-section content forms
  const [contentForms, setContentForms] = useState({});

  // Editing content description/overview
  const [editingContentDesc, setEditingContentDesc] = useState('');

  // Editing states
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [editingSectionDesc, setEditingSectionDesc] = useState('');
  const [sectionSaving, setSectionSaving] = useState(false);

  const [editingContentId, setEditingContentId] = useState(null);
  const [editingContentTitle, setEditingContentTitle] = useState('');
  const [editingContentType, setEditingContentType] = useState('VIDEO');
  const [editingContentMedia, setEditingContentMedia] = useState('');
  const [contentSaving, setContentSaving] = useState(false);

  // Global Action feedback
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [submittingContentSection, setSubmittingContentSection] = useState(null);

  // Media Library Picker Modal
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaList, setMediaList] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [activeMediaPickerSection, setActiveMediaPickerSection] = useState(null);
  const [isMediaPickerForEdit, setIsMediaPickerForEdit] = useState(false);
  const [uploadingNewMedia, setUploadingNewMedia] = useState(false);
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0);

  // Lecture Resource Manager Modal
  const [activeResourceContent, setActiveResourceContent] = useState(null);
  const [lessonResources, setLessonResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [resourceForm, setResourceForm] = useState({ name: '', url: '', type: 'PDF' });
  const [resourceSubmitting, setResourceSubmitting] = useState(false);
  const [resourceUploading, setResourceUploading] = useState(false);
  const [resourceSourceTab, setResourceSourceTab] = useState('upload'); // 'upload' | 'library' | 'url'
  const [resourceMediaList, setResourceMediaList] = useState([]);
  const [resourceMediaLoading, setResourceMediaLoading] = useState(false);
  const [resourceMediaSearch, setResourceMediaSearch] = useState('');
  const [activeAssessmentContent, setActiveAssessmentContent] = useState(null);
  const [subtitleGenerating, setSubtitleGenerating] = useState({});

  const handleGenerateSubtitles = async (c) => {
    setSubtitleGenerating(prev => ({ ...prev, [c.id]: true }));
    try {
      toast.info(`Queued subtitle generation job for "${c.title}"...`);
      await generateAdminSubtitles(c.id);
      toast.success(`Subtitle generation started for "${c.title}"! Status will update shortly.`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to trigger subtitle generation');
    } finally {
      setSubtitleGenerating(prev => ({ ...prev, [c.id]: false }));
    }
  };

  const fileInputRef = useRef(null);
  const resourceFileInputRef = useRef(null);
  const inlineFileInputRefs = useRef({});
  const editFileInputRef = useRef(null);

  // Direct Video/File Uploading States
  const [directUploadSectionId, setDirectUploadSectionId] = useState(null);
  const [directUploadProgress, setDirectUploadProgress] = useState(0);
  const [directUploadForEdit, setDirectUploadForEdit] = useState(false);
  const [previewLessonModal, setPreviewLessonModal] = useState(null);

  const notifySuccess = (msg) => {
    setActionSuccess(msg);
    toast.success(msg);
    setTimeout(() => setActionSuccess(null), 4500);
  };

  const notifyError = (msg) => {
    setActionError(msg);
    toast.error(msg);
    setTimeout(() => setActionError(null), 5000);
  };

  const load = async () => {
    try {
      const data = await listSections(courseId, true);
      setSections(data || []);
      const map = {};
      for (const s of (data || [])) {
        map[s.id] = await listContents(s.id, true);
      }
      setContentsBySection(map);
    } catch (err) {
      console.error('Failed to load curriculum:', err);
      setActionError('Failed to load course sections');
    }
  };

  useEffect(() => {
    load();
  }, [courseId]);

  // Section Handlers
  const handleAddSection = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!newSectionTitle.trim()) {
      toast.warning('Please enter a section title');
      return;
    }
    setCreatingSection(true);
    setActionError(null);
    try {
      await createSection(courseId, { 
        title: newSectionTitle.trim(), 
        description: newSectionDesc.trim() || null 
      });
      setNewSectionTitle('');
      setNewSectionDesc('');
      notifySuccess('Section created successfully');
      await load();
    } catch (err) {
      console.error('Failed to create section:', err);
      const msg = err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Failed to create section';
      setActionError(`Error creating section: ${msg}`);
      toast.error(`Failed to create section: ${msg}`);
    } finally {
      setCreatingSection(false);
    }
  };

  const handleStartEditSection = (s) => {
    setEditingSectionId(s.id);
    setEditingSectionTitle(s.title);
    setEditingSectionDesc(s.description || '');
  };

  const handleCancelEditSection = () => {
    setEditingSectionId(null);
    setEditingSectionTitle('');
    setEditingSectionDesc('');
  };

  const handleSaveEditSection = async (id) => {
    if (isReadOnly) return;
    if (!editingSectionTitle.trim()) {
      toast.warning('Section title is required');
      return;
    }
    setSectionSaving(true);
    try {
      await updateSection(id, {
        title: editingSectionTitle.trim(),
        description: editingSectionDesc.trim() || null
      });
      setEditingSectionId(null);
      notifySuccess('Section updated successfully');
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update section');
    } finally {
      setSectionSaving(false);
    }
  };

  const handleArchiveSection = async (s) => {
    const confirmed = await confirm({
      title: 'Archive Section?',
      description: `Archive section "${s.title}"?\n\nIt will be hidden from students, but all lectures are kept in the database.`,
      confirmText: 'Archive Section',
      cancelText: 'Cancel',
      variant: 'archive'
    });
    if (!confirmed) return;

    try {
      await archiveSection(s.id);
      notifySuccess(`Section "${s.title}" archived`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to archive section');
    }
  };

  const handleRestoreSection = async (s) => {
    try {
      await restoreSection(s.id);
      notifySuccess(`Section "${s.title}" restored to active`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to restore section');
    }
  };

  const handleDeleteSectionPermanently = async (s) => {
    const confirmed = await confirm({
      title: 'Permanently Delete Section?',
      description: `PERMANENTLY DELETE section "${s.title}"?\n\nThis will permanently erase this section, all its lectures, and associated resources. This action CANNOT be undone!`,
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      variant: 'delete'
    });
    if (!confirmed) return;

    try {
      await deleteSectionPermanently(s.id);
      notifySuccess(`Section "${s.title}" permanently deleted`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to delete section');
    }
  };

  // Content Handlers
  const contentForm = (sectionId) =>
    contentForms[sectionId] || { title: '', contentType: 'VIDEO', mediaReference: '', description: '' };

  const updateContentForm = (sectionId, field, value) => {
    setContentForms({
      ...contentForms,
      [sectionId]: { ...contentForm(sectionId), [field]: value },
    });
  };

  const handleAddContent = async (sectionId, e) => {
    e.preventDefault();
    const form = contentForm(sectionId);
    if (!form.title.trim()) return;

    setSubmittingContentSection(sectionId);
    setActionError(null);
    try {
      let typeToSave = form.contentType || 'VIDEO';
      const mediaRef = (form.mediaReference || '').trim();
      // Auto-detect YouTube or external video links so they are saved as VIDEO and play smoothly
      if (getYouTubeEmbedUrl(mediaRef) || mediaRef.includes('youtube.com') || mediaRef.includes('youtu.be')) {
        typeToSave = 'VIDEO';
      }

      await createContent(sectionId, {
        title: form.title.trim(),
        contentType: typeToSave,
        mediaReference: mediaRef,
        description: (form.description || '').trim() || null,
      });

      setContentForms({
        ...contentForms,
        [sectionId]: { title: '', contentType: 'VIDEO', mediaReference: '', description: '' },
      });
      notifySuccess('Lesson added successfully');
      await load();
    } catch (err) {
      console.error('Failed to add lesson:', err);
      const msg = err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Failed to add lesson';
      setActionError(`Error adding lesson: ${msg}`);
    } finally {
      setSubmittingContentSection(null);
    }
  };

  const handleStartEditContent = (content) => {
    setEditingContentId(content.id);
    setEditingContentTitle(content.title);
    setEditingContentType(content.contentType || 'VIDEO');
    setEditingContentMedia(content.mediaReference || '');
    setEditingContentDesc(content.description || '');
  };

  const handleCancelEditContent = () => {
    setEditingContentId(null);
    setEditingContentTitle('');
    setEditingContentMedia('');
    setEditingContentDesc('');
  };

  const handleSaveEditContent = async (contentId) => {
    if (!editingContentTitle.trim()) {
      toast.warning('Lesson title is required');
      return;
    }
    setContentSaving(true);
    try {
      let typeToSave = editingContentType || 'VIDEO';
      const mediaRef = (editingContentMedia || '').trim();
      if (getYouTubeEmbedUrl(mediaRef) || mediaRef.includes('youtube.com') || mediaRef.includes('youtu.be')) {
        typeToSave = 'VIDEO';
      }
      await updateContent(contentId, {
        title: editingContentTitle.trim(),
        contentType: typeToSave,
        mediaReference: mediaRef || null,
        description: editingContentDesc.trim() || null,
      });
      setEditingContentId(null);
      notifySuccess('Lesson updated successfully');
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update lesson');
    } finally {
      setContentSaving(false);
    }
  };

  const handleArchiveContent = async (c) => {
    const confirmed = await confirm({
      title: 'Archive Lesson?',
      description: `Archive lesson "${c.title}"?\n\nIt will be hidden from students, but can be restored later.`,
      confirmText: 'Archive Lesson',
      cancelText: 'Cancel',
      variant: 'archive'
    });
    if (!confirmed) return;

    try {
      await archiveContent(c.id);
      notifySuccess(`Lesson "${c.title}" archived`);
      await load();
    } catch (err) {
      console.error('Failed to archive content:', err);
      setActionError('Failed to archive lesson');
    }
  };

  const handleRestoreContent = async (c) => {
    try {
      await restoreContent(c.id);
      notifySuccess(`Lesson "${c.title}" restored to active`);
      await load();
    } catch (err) {
      console.error('Failed to restore content:', err);
      setActionError('Failed to restore lesson');
    }
  };

  const handleDeleteContentPermanently = async (c) => {
    const confirmed = await confirm({
      title: 'Permanently Delete Lesson?',
      description: `PERMANENTLY DELETE lesson "${c.title}"?\n\nThis will permanently erase this lesson and its resources. This action CANNOT be undone!`,
      confirmText: 'Delete Lesson',
      cancelText: 'Cancel',
      variant: 'delete'
    });
    if (!confirmed) return;

    try {
      await deleteContentPermanently(c.id);
      notifySuccess(`Lesson "${c.title}" permanently deleted`);
      await load();
    } catch (err) {
      console.error('Failed to delete content:', err);
      setActionError('Failed to permanently delete lesson');
    }
  };

  const toggleShowArchivedLessons = (sectionId) => {
    setShowArchivedLessons(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Media Picker
  const openMediaPicker = async (sectionId, isEdit = false) => {
    setActiveMediaPickerSection(sectionId);
    setIsMediaPickerForEdit(isEdit);
    setMediaLoading(true);
    try {
      const res = await listMedia({ page: 0, size: 50 });
      setMediaList(res?.content || []);
    } catch (e) {
      console.error(e);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleSelectMedia = (asset) => {
    const mediaUrl = asset.url || asset.storagePath || asset.fileUrl || asset.filePath || '';

    // Infer content type from mime type or file extension
    let inferredType = 'VIDEO';
    const mime = (asset.mimeType || '').toLowerCase();
    const name = (asset.filename || asset.originalName || asset.fileName || '').toLowerCase();
    if (mime.includes('pdf') || name.endsWith('.pdf')) inferredType = 'PDF';
    else if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(name)) inferredType = 'IMAGE';
    else if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv|m4v)$/i.test(name)) inferredType = 'VIDEO';

    const rawFileName = asset.originalName || asset.filename || asset.fileName || '';
    const cleanTitle = rawFileName.replace(/\.[^/.]+$/, '').trim();

    if (isMediaPickerForEdit) {
      setEditingContentMedia(mediaUrl);
      if (inferredType) setEditingContentType(inferredType);
      if (!editingContentTitle.trim() && cleanTitle) {
        setEditingContentTitle(cleanTitle);
      }
    } else {
      // Use functional updater to avoid stale closure over contentForms
      const sectionId = activeMediaPickerSection;
      setContentForms(prev => {
        const current = prev[sectionId] || { title: '', contentType: 'VIDEO', mediaReference: '' };
        return {
          ...prev,
          [sectionId]: {
            ...current,
            mediaReference: mediaUrl,
            contentType: inferredType,
            title: current.title.trim() ? current.title : cleanTitle,
          },
        };
      });
    }
    setActiveMediaPickerSection(null);
    setIsMediaPickerForEdit(false);
  };

  const handleDirectUploadContent = async (sectionId, e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDirectUploadSectionId(sectionId);
    setDirectUploadForEdit(isEdit);
    setDirectUploadProgress(0);
    toast.info(`Uploading "${file.name}" to Cloudinary/server...`);

    try {
      const uploaded = await uploadMedia(file, (pct) => setDirectUploadProgress(pct));
      const mediaUrl = uploaded?.url || uploaded?.storagePath || uploaded?.fileUrl || uploaded?.filePath || '';

      const rawFileName = uploaded?.originalName || uploaded?.filename || uploaded?.fileName || file.name || '';
      const cleanTitle = rawFileName.replace(/\.[^/.]+$/, '').trim();

      let inferredType = 'VIDEO';
      const mime = (uploaded?.mimeType || file.type || '').toLowerCase();
      const lowerName = rawFileName.toLowerCase();
      if (mime.includes('pdf') || lowerName.endsWith('.pdf')) inferredType = 'PDF';
      else if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(lowerName)) inferredType = 'IMAGE';
      else inferredType = 'VIDEO';

      if (isEdit) {
        setEditingContentMedia(mediaUrl);
        if (inferredType) setEditingContentType(inferredType);
        if (!editingContentTitle.trim() && cleanTitle) {
          setEditingContentTitle(cleanTitle);
        }
      } else {
        setContentForms(prev => {
          const current = prev[sectionId] || { title: '', contentType: 'VIDEO', mediaReference: '', description: '' };
          return {
            ...prev,
            [sectionId]: {
              ...current,
              mediaReference: mediaUrl,
              contentType: inferredType,
              title: current.title.trim() ? current.title : cleanTitle,
            }
          };
        });
      }

      toast.success(`"${file.name}" uploaded successfully!`);
    } catch (err) {
      console.error('Direct video upload failed:', err);
      toast.error('Failed to upload video file');
    } finally {
      setDirectUploadSectionId(null);
      setDirectUploadForEdit(false);
      setDirectUploadProgress(0);
      if (e.target) e.target.value = '';
    }
  };

  const handleUploadNewMedia = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingNewMedia(true);
    setMediaUploadProgress(0);
    toast.info(`Uploading "${file.name}" to Cloudinary...`);
    try {
      const uploaded = await uploadMedia(file, (pct) => setMediaUploadProgress(pct));
      handleSelectMedia(uploaded);
      toast.success(`"${file.name}" uploaded to Cloudinary successfully!`);
    } catch (err) {
      toast.error('Failed to upload media file');
    } finally {
      setUploadingNewMedia(false);
      setMediaUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Open Resource Manager Modal
  const openResourceManager = async (content) => {
    setActiveResourceContent(content);
    setEditingResourceId(null);
    setResourceForm({ name: '', url: '', type: 'PDF' });
    setLessonResources(content.resources || []);
    setResourceSourceTab('upload');
    setResourcesLoading(true);
    try {
      const data = await listResources(content.id);
      setLessonResources(data || []);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setResourcesLoading(false);
    }
  };

  const reloadLessonResources = async (contentId) => {
    try {
      const data = await listResources(contentId);
      setLessonResources(data || []);
    } catch (err) {
      console.error('Failed to reload lesson resources:', err);
    }
  };

  const handleStartEditResource = (r) => {
    setEditingResourceId(r.id);
    setResourceForm({
      name: r.name || '',
      url: r.url || '',
      type: r.type || 'PDF',
    });
    setResourceSourceTab('url');
  };

  const handleCancelEditResource = () => {
    setEditingResourceId(null);
    setResourceForm({ name: '', url: '', type: 'PDF' });
  };

  const handleSaveResource = async (e) => {
    e.preventDefault();
    if (!activeResourceContent) return;
    if (!resourceForm.name.trim() || !resourceForm.url.trim()) {
      toast.error('Resource label and URL/path are required');
      return;
    }
    setResourceSubmitting(true);
    try {
      if (editingResourceId) {
        await updateResource(editingResourceId, {
          name: resourceForm.name.trim(),
          url: resourceForm.url.trim(),
          type: resourceForm.type,
        });
        toast.success('Resource updated successfully');
        setEditingResourceId(null);
      } else {
        await addResource(activeResourceContent.id, {
          name: resourceForm.name.trim(),
          url: resourceForm.url.trim(),
          type: resourceForm.type,
        });
        toast.success('Resource attached successfully');
      }
      setResourceForm({ name: '', url: '', type: 'PDF' });
      await reloadLessonResources(activeResourceContent.id);
      load();
    } catch (err) {
      toast.error(editingResourceId ? 'Failed to update resource' : 'Failed to add resource');
    } finally {
      setResourceSubmitting(false);
    }
  };

  const handleDeleteResource = async (r) => {
    const isOk = await confirm({
      title: 'Delete Resource',
      message: `Are you sure you want to delete "${r.name}"? Students will no longer be able to access or download this resource.`,
      confirmText: 'Delete Resource',
      isDanger: true,
    });
    if (!isOk) return;

    try {
      await deleteResource(r.id);
      toast.success('Resource deleted successfully');
      if (editingResourceId === r.id) {
        setEditingResourceId(null);
        setResourceForm({ name: '', url: '', type: 'PDF' });
      }
      await reloadLessonResources(activeResourceContent.id);
      load();
    } catch (err) {
      toast.error('Failed to delete resource');
    }
  };

  const handleUploadResourceFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview and population (0ms delay)
    const tempUrl = URL.createObjectURL(file);
    let inferred = 'PDF';
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') inferred = 'PDF';
    else if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) inferred = 'ZIP';
    else if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'html', 'css', 'sql', 'json'].includes(ext)) inferred = 'CODE';
    else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'].includes(ext)) inferred = 'DOCUMENT';
    else if (['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'].includes(ext)) inferred = 'IMAGE';
    else inferred = 'OTHER';

    setResourceForm(prev => ({
      ...prev,
      url: tempUrl,
      name: prev.name.trim() || file.name.replace(/\.[^/.]+$/, ''),
      type: inferred
    }));
    if (resourceFileInputRef.current) resourceFileInputRef.current.value = '';

    uploadMedia(file)
      .then(uploaded => {
        const fileUrl = uploaded?.fileUrl || uploaded?.filePath || uploaded?.url || '';
        if (fileUrl) {
          setResourceForm(prev => ({
            ...prev,
            url: fileUrl
          }));
        }
        toast.success(`"${file.name}" uploaded to Cloudinary!`);
      })
      .catch(err => {
        toast.error('Failed to sync file to Cloudinary');
      });
  };

  const handleLoadResourceMedia = async () => {
    setResourceMediaLoading(true);
    try {
      const res = await listMedia({ search: resourceMediaSearch, size: 24 });
      setResourceMediaList(res?.content || []);
    } catch (err) {
      console.error(err);
    } finally {
      setResourceMediaLoading(false);
    }
  };

  const handleSelectMediaForResource = (asset) => {
    const mediaUrl = asset.fileUrl || asset.filePath || asset.url || '';
    let inferred = 'PDF';
    if (asset.mimeType === 'application/pdf') inferred = 'PDF';
    else if (asset.mimeType?.includes('zip') || asset.mimeType?.includes('compressed')) inferred = 'ZIP';
    else if (asset.mimeType?.startsWith('image/')) inferred = 'IMAGE';
    else if (asset.mimeType?.startsWith('text/')) inferred = 'DOCUMENT';
    else inferred = 'OTHER';

    setResourceForm(prev => ({
      ...prev,
      url: mediaUrl,
      name: prev.name.trim() || asset.originalFilename || asset.filename || 'Resource File',
      type: inferred
    }));
    toast.success(`Selected "${asset.originalFilename || asset.filename}"`);
  };

  const getResourceTypeConfig = (type = '') => {
    const t = (type || '').toUpperCase();
    switch (t) {
      case 'PDF':
        return { icon: 'fa-solid fa-file-pdf', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)', label: 'PDF' };
      case 'ZIP':
        return { icon: 'fa-solid fa-file-zipper', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.25)', label: 'ZIP' };
      case 'GITHUB':
        return { icon: 'fa-brands fa-github', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.25)', label: 'GitHub' };
      case 'CODE':
        return { icon: 'fa-solid fa-code', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.25)', label: 'Code' };
      case 'DOCUMENT':
        return { icon: 'fa-solid fa-file-lines', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)', label: 'Doc' };
      case 'IMAGE':
        return { icon: 'fa-solid fa-file-image', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', label: 'Image' };
      case 'LINK':
        return { icon: 'fa-solid fa-arrow-up-right-from-square', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.25)', label: 'Link' };
      default:
        return { icon: 'fa-solid fa-paperclip', color: 'var(--text-muted)', bg: 'var(--bg-surface-raised)', border: 'var(--border-subtle)', label: t || 'File' };
    }
  };

  // Filter sections
  const activeSections = sections.filter(s => s.status === 'active' || s.status === 'pending_approval' || !s.status);
  const archivedSections = sections.filter(s => s.status === 'archived');
  const filteredSections = statusFilter === 'active'
    ? activeSections
    : statusFilter === 'archived'
      ? archivedSections
      : sections;

  if (activeAssessmentContent) {
    return (
      <div style={{ marginTop: '16px' }}>
        <AssessmentAdminEditor
          contentId={activeAssessmentContent.id}
          contentTitle={activeAssessmentContent.title}
          onClose={() => {
            setActiveAssessmentContent(null);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Toast / Alert Banners */}
      <AlertBanner type="success" message={actionSuccess} onClose={() => setActionSuccess(null)} />
      <AlertBanner type="error" message={actionError} onClose={() => setActionError(null)} />

      {isContentCreator && (
        <div style={{
          background: 'rgba(234, 179, 8, 0.12)',
          color: '#854d0e',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '0.86rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '1rem', color: '#ca8a04' }}></i>
          <span>Curriculum updates made by Content Creators will move the course to Draft status until Super Admin approves and publishes the changes to student pages.</span>
        </div>
      )}

      {/* Add New Section Form */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '18px 20px',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-xs)'
      }}>
        <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa-solid fa-plus" style={{ fontSize: '0.9rem' }}></i> Add New Curriculum Section
        </div>
        <form onSubmit={handleAddSection} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              placeholder="Section Title (e.g. Chapter 1: Foundations & Architecture)"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              className="form-control"
              style={{ flex: '1 1 300px' }}
              required
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creatingSection || !newSectionTitle.trim()}
              style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {creatingSection ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>Adding Section...</span>
                </>
              ) : (
                '+ Add Section'
              )}
            </button>
          </div>
          <input
            placeholder="Optional Section Description or Overview"
            value={newSectionDesc}
            onChange={(e) => setNewSectionDesc(e.target.value)}
            className="form-control"
            style={{ fontSize: '0.88rem' }}
          />
        </form>
      </div>

      {/* Filter Tabs & Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        borderBottom: '1px solid var(--border-subtle)',
        paddingBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            Course Sections
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            ({sections.length} total)
          </span>
        </div>

        {/* Status Filter Buttons */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '4px 12px', fontSize: '0.82rem' }}
            onClick={() => setStatusFilter('all')}
          >
            All ({sections.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'active' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '4px 12px', fontSize: '0.82rem' }}
            onClick={() => setStatusFilter('active')}
          >
            Active ({activeSections.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'archived' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '4px 12px', fontSize: '0.82rem' }}
            onClick={() => setStatusFilter('archived')}
          >
            Archived ({archivedSections.length})
          </button>
        </div>
      </div>

      {/* Sections List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {filteredSections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-default)' }}>
            {statusFilter === 'archived'
              ? 'No archived sections.'
              : statusFilter === 'active'
                ? 'No active sections. Add a section above or restore from archived.'
                : 'No sections created yet. Add your first section above to start building the course curriculum.'}
          </div>
        ) : (
          filteredSections.map((s) => {
            const isArchived = s.status === 'archived';
            const isEditing = editingSectionId === s.id;
            const allLectures = contentsBySection[s.id] || [];
            const activeLectures = allLectures.filter(c => c.status === 'active' || c.status === 'pending_approval' || !c.status);
            const archivedLectures = allLectures.filter(c => c.status === 'archived');
            const showArchivedForThisSection = showArchivedLessons[s.id];

            // If toggled to show archived, show all; otherwise show active
            const displayedLectures = showArchivedForThisSection ? allLectures : activeLectures;

            return (
              <div
                key={s.id}
                style={{
                  borderRadius: 'var(--radius-lg)',
                  border: isArchived ? '1px dashed rgba(245, 158, 11, 0.4)' : '1px solid var(--border-default)',
                  background: isArchived ? 'rgba(245, 158, 11, 0.02)' : 'var(--bg-surface)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-xs)',
                  opacity: isArchived ? 0.88 : 1,
                  transition: 'all var(--transition-fast)'
                }}
              >
                {/* Section Header */}
                <div style={{
                  padding: '16px 20px',
                  background: isArchived ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-card)',
                  borderBottom: '1px solid var(--border-subtle)'
                }}>
                  {isEditing ? (
                    /* Inline Section Editing Form */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--primary)' }}>
                        Editing Section Details
                      </div>
                      <input
                        required
                        className="form-control"
                        placeholder="Section Title"
                        value={editingSectionTitle}
                        onChange={(e) => setEditingSectionTitle(e.target.value)}
                      />
                      <input
                        className="form-control"
                        placeholder="Section Description (Optional)"
                        value={editingSectionDesc}
                        onChange={(e) => setEditingSectionDesc(e.target.value)}
                        style={{ fontSize: '0.88rem' }}
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleCancelEditSection}
                          disabled={sectionSaving}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveEditSection(s.id)}
                          disabled={sectionSaving}
                        >
                          {sectionSaving ? 'Saving…' : 'Save Section'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Section Header Display */
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      {/* Left: Title & Status */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <i className="fa-solid fa-folder" style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}></i>
                          <span style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                            {s.title}
                          </span>

                          {/* Status Badge */}
                          {isArchived ? (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.74rem',
                              fontWeight: '700',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#d97706',
                              border: '1px solid rgba(245, 158, 11, 0.35)'
                            }}>
                              <i className="fa-solid fa-box-archive" style={{ marginRight: '4px' }}></i> Archived
                            </span>
                          ) : s.status === 'pending_approval' ? (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.74rem',
                              fontWeight: '700',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.35)'
                            }}>
                              <i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i> Pending Approval
                            </span>
                          ) : (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.74rem',
                              fontWeight: '700',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}>
                              ✓ Active
                            </span>
                          )}

                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            ({activeLectures.length} active {activeLectures.length === 1 ? 'lesson' : 'lessons'}{archivedLectures.length > 0 ? `, ${archivedLectures.length} archived` : ''})
                          </span>
                        </div>

                        {s.description && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '28px' }}>
                            {s.description}
                          </div>
                        )}
                      </div>

                      {/* Right: Section Actions (Edit, Archive/Restore, Delete) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {/* Edit Section Button */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleStartEditSection(s)}
                          title="Edit section title and description"
                        >
                          <i className="fa-solid fa-pencil" style={{ marginRight: '4px' }}></i> Edit
                        </button>

                        {/* Archive or Restore Button */}
                        {isArchived ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                            onClick={() => handleRestoreSection(s)}
                            title="Restore section to active status"
                          >
                            <i className="fa-solid fa-rotate-left" style={{ marginRight: '4px' }}></i> Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#d97706', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                            onClick={() => handleArchiveSection(s)}
                            title="Archive section (hide from active view)"
                          >
                            <i className="fa-solid fa-box-archive" style={{ marginRight: '4px' }}></i> Archive
                          </button>
                        )}

                        {/* Permanent Delete Button */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                          onClick={() => handleDeleteSectionPermanently(s)}
                          title="Permanently remove this section and all contents"
                        >
                          <i className="fa-solid fa-trash" style={{ marginRight: '4px' }}></i> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Lecture Content Items */}
                <div style={{ padding: '18px 20px' }}>
                  {/* Lecture list header & toggle archived */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                      Lectures & Content ({activeLectures.length})
                    </span>
                    {archivedLectures.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{
                          fontSize: '0.78rem',
                          color: showArchivedForThisSection ? '#d97706' : 'var(--text-muted)',
                          background: showArchivedForThisSection ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                          border: showArchivedForThisSection ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                          padding: '2px 8px'
                        }}
                        onClick={() => toggleShowArchivedLessons(s.id)}
                      >
                        {showArchivedForThisSection ? <><i className="fa-solid fa-eye-slash" style={{ marginRight: '4px' }}></i> Hide Archived Lessons</> : <><i className="fa-solid fa-eye" style={{ marginRight: '4px' }}></i> Show Archived Lessons ({archivedLectures.length})</>}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                    {displayedLectures.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '10px 0', fontStyle: 'italic' }}>
                        {activeLectures.length === 0 && archivedLectures.length > 0
                          ? `All ${archivedLectures.length} lessons in this section are archived. Click "Show Archived Lessons" to view, restore, or delete them.`
                          : 'No lectures or contents added to this section yet.'}
                      </div>
                    ) : (
                      displayedLectures.map((c) => {
                        const isLessonArchived = c.status === 'archived';
                        const isContentEditing = editingContentId === c.id;

                        if (isContentEditing) {
                          return (
                            <div
                              key={c.id}
                              style={{
                                padding: '14px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--primary)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                              }}
                            >
                              <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--primary)' }}>
                                Edit Lesson
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                <input
                                  required
                                  className="form-control"
                                  placeholder="Lesson Title"
                                  value={editingContentTitle}
                                  onChange={(e) => setEditingContentTitle(e.target.value)}
                                  style={{ flex: '1 1 200px' }}
                                />
                                <select
                                  className="form-select"
                                  value={editingContentType}
                                  onChange={(e) => setEditingContentType(e.target.value)}
                                  style={{ minWidth: '160px', flex: '0 0 auto' }}
                                >
                                  {CONTENT_TYPE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                                <input
                                  className="form-control"
                                  placeholder="Media URL or reference path"
                                  value={editingContentMedia}
                                  onChange={(e) => setEditingContentMedia(e.target.value)}
                                  style={{ flex: '2 1 240px' }}
                                />
                                <input
                                  type="file"
                                  ref={editFileInputRef}
                                  style={{ display: 'none' }}
                                  accept="video/*,application/pdf,image/*"
                                  onChange={(e) => handleDirectUploadContent(s.id, e, true)}
                                />
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => editFileInputRef.current?.click()}
                                  disabled={directUploadSectionId === s.id && directUploadForEdit}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                  <i className={`fa-solid ${directUploadSectionId === s.id && directUploadForEdit ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
                                  {directUploadSectionId === s.id && directUploadForEdit ? `Uploading (${directUploadProgress}%)...` : 'Upload Video'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => openMediaPicker(s.id, true)}
                                >
                                  <i className="fa-solid fa-folder-open" style={{ marginRight: '4px' }}></i> Library
                                </button>
                                {editingContentMedia && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setPreviewLessonModal({ title: editingContentTitle || 'Preview', contentType: editingContentType, mediaReference: editingContentMedia })}
                                    title="Test play this video URL"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981' }}
                                  >
                                    <i className="fa-solid fa-play" /> Test Play
                                  </button>
                                )}
                              </div>
                              {directUploadSectionId === s.id && directUploadForEdit && (
                                <div style={{ background: 'rgba(90, 112, 211, 0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(90, 112, 211, 0.25)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                    <span><i className="fa-solid fa-cloud-arrow-up" style={{ color: '#5A70D3', marginRight: '6px' }}></i> Uploading video...</span>
                                    <span style={{ color: '#5A70D3' }}>{directUploadProgress}%</span>
                                  </div>
                                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.max(directUploadProgress, 5)}%`, height: '100%', background: 'linear-gradient(90deg, #5A70D3, #7E92EB)', transition: 'width 0.2s ease' }} />
                                  </div>
                                </div>
                              )}
                              <textarea
                                className="form-control"
                                placeholder="Video Overview / Description (optional) — shown to students in the Overview tab"
                                value={editingContentDesc}
                                onChange={(e) => setEditingContentDesc(e.target.value)}
                                rows={3}
                                style={{ fontSize: '0.88rem', resize: 'vertical' }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={handleCancelEditContent}
                                  disabled={contentSaving}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleSaveEditContent(c.id)}
                                  disabled={contentSaving}
                                >
                                  {contentSaving ? 'Saving…' : 'Save Lesson'}
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={c.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 14px',
                              borderRadius: 'var(--radius-md)',
                              background: isLessonArchived ? 'rgba(245, 158, 11, 0.04)' : 'var(--bg-card)',
                              border: isLessonArchived ? '1px dashed rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)',
                              gap: '10px',
                              opacity: isLessonArchived ? 0.85 : 1
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                {c.title}
                              </span>
                              <span className="role-tag">{c.contentType}</span>

                              {isLessonArchived && (
                                <span style={{
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-full)',
                                  fontSize: '0.7rem',
                                  fontWeight: '700',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  color: '#d97706',
                                  border: '1px solid rgba(245, 158, 11, 0.35)'
                                }}>
                                  <i className="fa-solid fa-box-archive" style={{ marginRight: '4px' }}></i> Archived
                                </span>
                              )}

                              {c.status === 'pending_approval' && (
                                <span style={{
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-full)',
                                  fontSize: '0.7rem',
                                  fontWeight: '700',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.35)'
                                }}>
                                  <i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i> Pending Approval
                                </span>
                              )}

                              {c.mediaReference && (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.mediaReference}>
                                  {c.mediaReference}
                                </span>
                              )}

                              {/* Subtitle Status Badge for Video Lessons */}
                              {(c.contentType === 'VIDEO' || (c.mediaReference && c.mediaReference.includes('/media/files/'))) && (
                                c.subtitleUrl || c.subtitleStatus === 'COMPLETED' ? (
                                  <span style={{
                                    padding: '1px 6px',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: '0.7rem',
                                    fontWeight: '700',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    color: '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.35)'
                                  }} title="English subtitles ready (WebVTT)">
                                    🟢 English Subtitles Ready
                                  </span>
                                ) : c.subtitleStatus === 'PROCESSING' || c.subtitleStatus === 'PENDING' ? (
                                  <span style={{
                                    padding: '1px 6px',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: '0.7rem',
                                    fontWeight: '700',
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#d97706',
                                    border: '1px solid rgba(245, 158, 11, 0.35)'
                                  }} title="Generating AI English subtitles using Whisper...">
                                    🟡 Generating Subtitles (EN)...
                                  </span>
                                ) : c.subtitleStatus === 'FAILED' ? (
                                  <span style={{
                                    padding: '1px 6px',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: '0.7rem',
                                    fontWeight: '700',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239, 68, 68, 0.35)'
                                  }} title={c.subtitleError || "Subtitle generation failed"}>
                                    🔴 Translation Failed
                                  </span>
                                ) : null
                              )}
                              {c.resources && c.resources.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openResourceManager(c)}
                                  style={{
                                    fontSize: '0.72rem',
                                    background: 'var(--warning-bg)',
                                    color: 'var(--warning-text)',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-full)',
                                    fontWeight: '700',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  title="Manage attached resources"
                                >
                                  <i className="fa-solid fa-paperclip"></i> {c.resources.length} resources
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {/* Preview Lesson */}
                              {c.mediaReference && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => setPreviewLessonModal(c)}
                                  title="Test play this video / preview lecture resource"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <i className="fa-solid fa-play" /> Preview
                                </button>
                              )}

                              {/* Edit Lesson */}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleStartEditContent(c)}
                                title="Edit lesson title and media"
                              >
                                <i className="fa-solid fa-pencil" style={{ marginRight: '4px' }}></i> Edit
                              </button>

                              {/* Resource Button (only active lessons) */}
                              {!isLessonArchived && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => openResourceManager(c)}
                                  title="Manage attached resources"
                                >
                                  <i className="fa-solid fa-paperclip" style={{ marginRight: '4px' }}></i>
                                  {c.resources?.length ? `Resources (${c.resources.length})` : '+ Resource'}
                                </button>
                              )}

                              {/* Assessment Button (only active lessons) */}
                              {!isLessonArchived && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                                  onClick={() => setActiveAssessmentContent(c)}
                                  title="Manage 1-mark assessment for this lesson"
                                >
                                  <i className="fa-solid fa-list-check" style={{ marginRight: '4px' }}></i> Assessment
                                </button>
                              )}

                              {/* Generate Subtitles Button (only active video lessons) */}
                              {!isLessonArchived && (c.contentType === 'VIDEO' || c.mediaReference?.includes('/media/files/')) && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: '#6366f1', borderColor: 'rgba(99, 102, 241, 0.4)' }}
                                  onClick={() => handleGenerateSubtitles(c)}
                                  disabled={subtitleGenerating[c.id]}
                                  title="Generate AI English subtitles from video audio using Whisper"
                                >
                                  <i className={`fa-solid ${subtitleGenerating[c.id] ? 'fa-spinner fa-spin' : 'fa-closed-captioning'}`} style={{ marginRight: '4px' }}></i>
                                  {subtitleGenerating[c.id] ? 'Translating...' : c.subtitleUrl ? '↺ Regenerate CC' : '+ AI Subtitles (EN)'}
                                </button>
                              )}

                              {/* Archive or Restore */}
                              {isLessonArchived ? (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                                  onClick={() => handleRestoreContent(c)}
                                  title="Restore lesson back to active"
                                >
                                  <i className="fa-solid fa-rotate-left" style={{ marginRight: '4px' }}></i> Restore
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ color: '#d97706', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                                  onClick={() => handleArchiveContent(c)}
                                  title="Archive lesson (hide from students)"
                                >
                                  <i className="fa-solid fa-box-archive" style={{ marginRight: '4px' }}></i> Archive
                                </button>
                              )}

                              {/* Permanent Delete */}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                onClick={() => handleDeleteContentPermanently(c)}
                                title="Permanently delete this lesson"
                              >
                                <i className="fa-solid fa-trash" style={{ marginRight: '4px' }}></i> Delete
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Inline Add Content Form */}
                  <form
                    onSubmit={(e) => handleAddContent(s.id, e)}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '10px',
                      alignItems: 'center',
                      background: 'var(--bg-card)',
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-default)'
                    }}
                  >
                    <input
                      placeholder="Lesson Title"
                      required
                      className="form-control"
                      value={contentForm(s.id).title}
                      onChange={(e) => updateContentForm(s.id, 'title', e.target.value)}
                      style={{ flex: '1 1 200px' }}
                    />

                    <select
                      className="form-select"
                      value={contentForm(s.id).contentType}
                      onChange={(e) => updateContentForm(s.id, 'contentType', e.target.value)}
                      style={{ minWidth: '160px', flex: '0 0 auto' }}
                    >
                      {CONTENT_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    <input
                      placeholder="Media URL or reference path"
                      className="form-control"
                      value={contentForm(s.id).mediaReference}
                      onChange={(e) => updateContentForm(s.id, 'mediaReference', e.target.value)}
                      style={{ flex: '2 1 240px' }}
                    />

                    <input
                      type="file"
                      ref={(el) => (inlineFileInputRefs.current[s.id] = el)}
                      style={{ display: 'none' }}
                      accept="video/*,application/pdf,image/*"
                      onChange={(e) => handleDirectUploadContent(s.id, e, false)}
                    />

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => inlineFileInputRefs.current[s.id]?.click()}
                      disabled={directUploadSectionId === s.id && !directUploadForEdit}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <i className={`fa-solid ${directUploadSectionId === s.id && !directUploadForEdit ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
                      {directUploadSectionId === s.id && !directUploadForEdit ? `Uploading (${directUploadProgress}%)...` : 'Upload Video'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openMediaPicker(s.id, false)}
                    >
                      <i className="fa-solid fa-folder-open" style={{ marginRight: '4px' }}></i> Library
                    </button>

                    {contentForm(s.id).mediaReference && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setPreviewLessonModal({ title: contentForm(s.id).title || 'Preview', contentType: contentForm(s.id).contentType, mediaReference: contentForm(s.id).mediaReference })}
                        title="Test play this video before saving"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981' }}
                      >
                        <i className="fa-solid fa-play" /> Test Play
                      </button>
                    )}

                    {directUploadSectionId === s.id && !directUploadForEdit && (
                      <div style={{ flex: '1 1 100%', background: 'rgba(90, 112, 211, 0.08)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(90, 112, 211, 0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          <span><i className="fa-solid fa-cloud-arrow-up" style={{ color: '#5A70D3', marginRight: '6px' }}></i> Uploading video to CDN/server...</span>
                          <span style={{ color: '#5A70D3' }}>{directUploadProgress}%</span>
                        </div>
                        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(directUploadProgress, 5)}%`, height: '100%', background: 'linear-gradient(90deg, #5A70D3, #7E92EB)', transition: 'width 0.2s ease' }} />
                        </div>
                      </div>
                    )}

                    <textarea
                      placeholder="Video Overview / Description (optional)"
                      className="form-control"
                      value={contentForm(s.id).description}
                      onChange={(e) => updateContentForm(s.id, 'description', e.target.value)}
                      rows={2}
                      style={{ flex: '1 1 100%', fontSize: '0.85rem', resize: 'vertical' }}
                    />

                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={submittingContentSection === s.id}
                    >
                      {submittingContentSection === s.id ? 'Adding…' : '+ Add Lesson'}
                    </button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Media Picker Modal */}
      {activeMediaPickerSection && (
        <div className="modal-backdrop" onClick={() => { setActiveMediaPickerSection(null); setIsMediaPickerForEdit(false); }}>
          <div className="modal-dialog" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Select Media Asset
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => { setActiveMediaPickerSection(null); setIsMediaPickerForEdit(false); }}>✕</button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleUploadNewMedia}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingNewMedia}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className={`fa-solid ${uploadingNewMedia ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                {uploadingNewMedia ? `Uploading to Cloudinary... ${mediaUploadProgress > 0 ? `(${mediaUploadProgress}%)` : ''}` : 'Upload New File Directly'}
              </button>
            </div>

            {uploadingNewMedia && (
              <div style={{ marginBottom: '16px', background: 'rgba(90, 112, 211, 0.08)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(90, 112, 211, 0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  <span><i className="fa-solid fa-cloud-arrow-up" style={{ color: '#5A70D3', marginRight: '6px' }}></i> Uploading to Cloudinary CDN...</span>
                  <span style={{ color: '#5A70D3' }}>{mediaUploadProgress}%</span>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(mediaUploadProgress, 5)}%`, height: '100%', background: 'linear-gradient(90deg, #5A70D3, #7E92EB)', transition: 'width 0.2s ease', borderRadius: '4px' }} />
                </div>
              </div>
            )}

            {mediaLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading media library…</div>
            ) : mediaList.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No media assets found.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', maxHeight: '360px', overflowY: 'auto' }}>
                {mediaList.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => handleSelectMedia(asset)}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {asset.filename || asset.originalName || asset.fileName}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {asset.mimeType || asset.fileType}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resource Manager Modal */}
      {activeResourceContent && (
        <div className="modal-backdrop" onClick={() => setActiveResourceContent(null)}>
          <div
            className="modal-dialog"
            style={{ maxWidth: '720px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-folder-open" style={{ color: 'var(--brand-primary)', fontSize: '1.1rem' }}></i>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                    Lesson Resources
                  </h2>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--brand-primary-light, rgba(99, 102, 241, 0.1))',
                    color: 'var(--brand-primary)'
                  }}>
                    {lessonResources.length} attached
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Manage downloadable lecture slides, source codes, and reference links for <strong>"{activeResourceContent.title}"</strong>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveResourceContent(null)}
                style={{ borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body with Scroll */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Section 1: Attached Resources List */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Currently Attached ({lessonResources.length})
                  </span>
                  {resourcesLoading && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-circle-notch fa-spin"></i> Loading...
                    </span>
                  )}
                </div>

                {lessonResources.length === 0 ? (
                  <div style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: 'var(--bg-surface-raised, rgba(0,0,0,0.02))',
                    border: '1px dashed var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    fontSize: '0.88rem'
                  }}>
                    <i className="fa-solid fa-paperclip" style={{ fontSize: '1.6rem', marginBottom: '8px', opacity: 0.4, display: 'block' }}></i>
                    No resources attached to this lecture yet. Add one below!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {lessonResources.map((res) => {
                      const cfg = getResourceTypeConfig(res.type);
                      const isEditing = editingResourceId === res.id;
                      return (
                        <div
                          key={res.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            background: isEditing ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card)',
                            border: isEditing ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                            gap: '12px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            {/* Type badge */}
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              background: cfg.bg,
                              color: cfg.color,
                              border: `1px solid ${cfg.border}`,
                              flexShrink: 0
                            }}>
                              <i className={cfg.icon}></i>
                              {cfg.label}
                            </span>

                            {/* Name & URL */}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {res.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {res.url}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.78rem', textDecoration: 'none' }}
                              title="Open link / download preview"
                            >
                              <i className="fa-solid fa-arrow-up-right-from-square"></i>
                            </a>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                              onClick={() => handleStartEditResource(res)}
                              title="Edit resource"
                            >
                              <i className="fa-solid fa-pencil"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                              onClick={() => handleDeleteResource(res)}
                              title="Delete resource"
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: Add or Edit Resource Form */}
              <div style={{
                background: 'var(--bg-surface-raised, rgba(0,0,0,0.02))',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className={editingResourceId ? "fa-solid fa-pen-to-square" : "fa-solid fa-circle-plus"} style={{ color: 'var(--brand-primary)' }}></i>
                    {editingResourceId ? 'Edit Resource' : 'Attach New Resource'}
                  </div>
                  {editingResourceId && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleCancelEditResource}
                      style={{ fontSize: '0.78rem' }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {/* Source Tabs (Upload / Library / URL) */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setResourceSourceTab('upload')}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.82rem',
                      fontWeight: resourceSourceTab === 'upload' ? '700' : '500',
                      border: resourceSourceTab === 'upload' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                      background: resourceSourceTab === 'upload' ? 'var(--brand-primary-light, rgba(99, 102, 241, 0.1))' : 'var(--bg-card)',
                      color: resourceSourceTab === 'upload' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-cloud-arrow-up"></i> Direct Upload
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setResourceSourceTab('library');
                      handleLoadResourceMedia();
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.82rem',
                      fontWeight: resourceSourceTab === 'library' ? '700' : '500',
                      border: resourceSourceTab === 'library' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                      background: resourceSourceTab === 'library' ? 'var(--brand-primary-light, rgba(99, 102, 241, 0.1))' : 'var(--bg-card)',
                      color: resourceSourceTab === 'library' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-photo-film"></i> Media Library
                  </button>

                  <button
                    type="button"
                    onClick={() => setResourceSourceTab('url')}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.82rem',
                      fontWeight: resourceSourceTab === 'url' ? '700' : '500',
                      border: resourceSourceTab === 'url' ? '1px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                      background: resourceSourceTab === 'url' ? 'var(--brand-primary-light, rgba(99, 102, 241, 0.1))' : 'var(--bg-card)',
                      color: resourceSourceTab === 'url' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-link"></i> External URL
                  </button>
                </div>

                {/* Sub-view for Upload */}
                {resourceSourceTab === 'upload' && (
                  <div style={{
                    border: '1px dashed var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    textAlign: 'center',
                    marginBottom: '14px',
                    background: 'var(--bg-card)'
                  }}>
                    <input
                      ref={resourceFileInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      onChange={handleUploadResourceFile}
                    />
                    <i className="fa-solid fa-file-arrow-up" style={{ fontSize: '1.8rem', color: 'var(--brand-primary)', marginBottom: '8px' }}></i>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Upload any PDF, slides, source code ZIP, or documents directly.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => resourceFileInputRef.current?.click()}
                      disabled={resourceUploading}
                    >
                      {resourceUploading ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '6px' }}></i>
                          Uploading file…
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-arrow-up-from-bracket" style={{ marginRight: '6px' }}></i>
                          Choose File from Device
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Sub-view for Media Library Picker */}
                {resourceSourceTab === 'library' && (
                  <div style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    marginBottom: '14px',
                    background: 'var(--bg-card)'
                  }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search media files by name..."
                        value={resourceMediaSearch}
                        onChange={(e) => setResourceMediaSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleLoadResourceMedia(); }}
                        style={{ fontSize: '0.82rem', height: '34px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleLoadResourceMedia}
                        disabled={resourceMediaLoading}
                        style={{ height: '34px' }}
                      >
                        {resourceMediaLoading ? '...' : 'Search'}
                      </button>
                    </div>

                    {resourceMediaLoading ? (
                      <div style={{ textAlign: 'center', padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-circle-notch fa-spin"></i> Loading media files...
                      </div>
                    ) : resourceMediaList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        No media files found in library.
                      </div>
                    ) : (
                      <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {resourceMediaList.map(asset => (
                          <div
                            key={asset.id}
                            onClick={() => handleSelectMediaForResource(asset)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              background: 'var(--bg-surface)',
                              fontSize: '0.82rem'
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }}>
                              {asset.originalFilename || asset.filename || 'Untitled Asset'}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {asset.fileType || asset.mimeType}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Resource Form Inputs */}
                <form onSubmit={handleSaveResource}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '10px', marginBottom: '10px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                        Resource Label *
                      </label>
                      <input
                        required
                        className="form-control"
                        placeholder="e.g. Lecture Slides PDF, Source Code ZIP"
                        value={resourceForm.name}
                        onChange={(e) => setResourceForm({ ...resourceForm, name: e.target.value })}
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                        Resource Type
                      </label>
                      <select
                        className="form-select"
                        value={resourceForm.type}
                        onChange={(e) => setResourceForm({ ...resourceForm, type: e.target.value })}
                        style={{ fontSize: '0.85rem' }}
                      >
                        <option value="PDF">PDF</option>
                        <option value="ZIP">ZIP</option>
                        <option value="CODE">Source Code</option>
                        <option value="DOCUMENT">Document</option>
                        <option value="GITHUB">GitHub</option>
                        <option value="LINK">External Link</option>
                        <option value="IMAGE">Image</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                      Resource URL / File Path *
                    </label>
                    <input
                      required
                      className="form-control"
                      placeholder="https://... or /api/v1/media/files/..."
                      value={resourceForm.url}
                      onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveResourceContent(null)}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={resourceSubmitting}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {resourceSubmitting ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin"></i> Saving…
                        </>
                      ) : (
                        <>
                          <i className={editingResourceId ? "fa-solid fa-check" : "fa-solid fa-plus"}></i>
                          {editingResourceId ? 'Update Resource' : 'Attach Resource'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}
      {/* Lesson Media Preview Modal */}
      {previewLessonModal && (
        <div className="modal-backdrop" onClick={() => setPreviewLessonModal(null)}>
          <div
            className="modal-dialog"
            style={{ maxWidth: '840px', width: '92vw', padding: '20px', background: '#0b141a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="role-tag" style={{ background: '#5A70D3', color: '#ffffff' }}>
                  {previewLessonModal.contentType || 'VIDEO'}
                </span>
                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#ffffff' }}>
                  {previewLessonModal.title}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewLessonModal(null)}
                style={{ color: '#ffffff', background: 'rgba(255,255,255,0.1)' }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000000', minHeight: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {String(previewLessonModal.contentType || '').toUpperCase() === 'VIDEO' ||
              /\.(mp4|webm|mov|mkv|m4v)(\?.*)?$/i.test(previewLessonModal.mediaReference || '') ||
              (previewLessonModal.mediaReference && (previewLessonModal.mediaReference.includes('youtube.com') || previewLessonModal.mediaReference.includes('youtu.be') || previewLessonModal.mediaReference.includes('/video/upload') || previewLessonModal.mediaReference.includes('/media/files/'))) ? (
                <RecordingVideoPlayer
                  key={previewLessonModal.id || previewLessonModal.mediaReference}
                  url={previewLessonModal.mediaReference}
                  title={previewLessonModal.title}
                  subtitleUrl={previewLessonModal.subtitleUrl}
                  autoPlay={true}
                  onClose={() => setPreviewLessonModal(null)}
                  style={{ width: '100%', borderRadius: '12px' }}
                />
              ) : String(previewLessonModal.contentType || '').toUpperCase() === 'PDF' || /\.pdf(\?.*)?$/i.test(previewLessonModal.mediaReference || '') ? (
                <iframe
                  src={resolveMediaUrl(previewLessonModal.mediaReference)}
                  title={previewLessonModal.title}
                  style={{ width: '100%', height: '520px', border: 'none' }}
                />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#ffffff' }}>
                  <p>Resource: {previewLessonModal.contentType}</p>
                  {previewLessonModal.mediaReference && (
                    <a
                      href={resolveMediaUrl(previewLessonModal.mediaReference)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ marginTop: '12px' }}
                    >
                      Open Resource ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
