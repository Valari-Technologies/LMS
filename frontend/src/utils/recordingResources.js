// ============================================================
// Recording Resources and Overview Management Utility
// Provides persistent storage, syncing, and helpers for recorded video resources & overviews
// ============================================================

import { resolveMediaUrl } from './mediaUtils';

const OVERVIEWS_KEY = 'onetutor_rec_overviews';
const RESOURCES_KEY = 'onetutor_rec_resources';

const DEFAULT_SAMPLE_OVERVIEWS = {
  '4': `Welcome to this recorded session replay! In this live interactive class, we conducted an in-depth architectural breakdown of full stack application patterns, modern state management, and real-time client-server synchronization.

Key Topics Covered in this Session:
• System architecture breakdown: separation of concerns between API services and client views
• Effective API endpoint structuring, request caching, and error boundary handling
• Real-time data synchronization patterns and optimistic UI updates
• Practical debugging walkthrough and question-and-answer discussion

Be sure to review the downloadable lecture materials, architectural diagram slides, and demo code in the Resources tab.`
};

const DEFAULT_SAMPLE_RESOURCES = {
  '4': [
    {
      id: 101,
      name: 'Full_Stack_Architecture_Diagram.pdf',
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      type: 'PDF',
      size: '1.4 MB',
      createdAt: '2026-10-28T10:00:00.000Z'
    },
    {
      id: 102,
      name: 'Live_Session_2_Demo_Code.zip',
      url: 'https://github.com/Valari-Technologies/LMS/archive/refs/heads/main.zip',
      type: 'ZIP',
      size: '4.8 MB',
      createdAt: '2026-10-28T10:30:00.000Z'
    },
    {
      id: 103,
      name: 'Class_Lecture_Slides_Key_Notes.pdf',
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      type: 'SLIDES',
      size: '2.1 MB',
      createdAt: '2026-10-28T11:00:00.000Z'
    }
  ]
};

/**
 * Get the overview text and custom title for a recording.
 */
export function getRecordingOverview(recordingId, defaultDesc = '') {
  if (!recordingId) return defaultDesc;
  try {
    const raw = localStorage.getItem(OVERVIEWS_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (map[String(recordingId)] && map[String(recordingId)].overview) {
        return map[String(recordingId)].overview;
      }
    }
  } catch (e) {}

  return DEFAULT_SAMPLE_OVERVIEWS[String(recordingId)] || defaultDesc || '';
}

/**
 * Get custom title for a recording if edited by admin.
 */
export function getRecordingCustomTitle(recordingId, defaultTitle = '') {
  if (!recordingId) return defaultTitle;
  try {
    const raw = localStorage.getItem(OVERVIEWS_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (map[String(recordingId)] && map[String(recordingId)].title) {
        return map[String(recordingId)].title;
      }
    }
  } catch (e) {}
  return defaultTitle;
}

/**
 * Save custom overview & title for a recording.
 */
export function setRecordingOverview(recordingId, overview, title = '') {
  if (!recordingId) return;
  try {
    const raw = localStorage.getItem(OVERVIEWS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[String(recordingId)] = {
      ...(map[String(recordingId)] || {}),
      overview: (overview || '').trim(),
      title: (title || '').trim(),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(OVERVIEWS_KEY, JSON.stringify(map));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('recording-resources-changed', {
        detail: { recordingId, type: 'overview' }
      }));
    }
  } catch (e) {}
}

/**
 * Get list of downloadable resources attached to a recording.
 */
export function getRecordingResources(recordingId, subtitleUrl = null) {
  if (!recordingId) return [];
  let list = [];
  try {
    const raw = localStorage.getItem(RESOURCES_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (Array.isArray(map[String(recordingId)])) {
        list = [...map[String(recordingId)]];
      }
    }
    // Fall back to sample resources for recording #4 if not yet modified
    if (list.length === 0 && DEFAULT_SAMPLE_RESOURCES[String(recordingId)]) {
      list = [...DEFAULT_SAMPLE_RESOURCES[String(recordingId)]];
    }
  } catch (e) {
    if (DEFAULT_SAMPLE_RESOURCES[String(recordingId)]) {
      list = [...DEFAULT_SAMPLE_RESOURCES[String(recordingId)]];
    }
  }

  // Include subtitles as a resource entry if available
  if (subtitleUrl && !list.some(r => r.type === 'VTT' || r.url === subtitleUrl)) {
    list.push({
      id: 'subtitles-vtt',
      name: 'English Subtitles (WebVTT File)',
      url: subtitleUrl,
      type: 'VTT',
      size: 'WebVTT stream',
      isSystemSubtitle: true,
      createdAt: new Date().toISOString()
    });
  }

  return list;
}

/**
 * Attach a new downloadable resource to a recording.
 */
export function addRecordingResource(recordingId, resource) {
  if (!recordingId || !resource || !resource.name || !resource.url) return null;
  try {
    const raw = localStorage.getItem(RESOURCES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const list = Array.isArray(map[String(recordingId)])
      ? map[String(recordingId)]
      : (DEFAULT_SAMPLE_RESOURCES[String(recordingId)] ? [...DEFAULT_SAMPLE_RESOURCES[String(recordingId)]] : []);

    const newRes = {
      id: Date.now(),
      name: resource.name.trim(),
      url: resource.url.trim(),
      type: resource.type || inferResourceType(resource.name, resource.url),
      size: resource.size || '',
      createdAt: new Date().toISOString()
    };

    list.unshift(newRes);
    map[String(recordingId)] = list;
    localStorage.setItem(RESOURCES_KEY, JSON.stringify(map));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('recording-resources-changed', {
        detail: { recordingId, type: 'resource_added', resource: newRes }
      }));
    }
    return newRes;
  } catch (e) {
    return null;
  }
}

/**
 * Remove an attached resource from a recording.
 */
export function deleteRecordingResource(recordingId, resourceId) {
  if (!recordingId || !resourceId) return false;
  try {
    const raw = localStorage.getItem(RESOURCES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const list = Array.isArray(map[String(recordingId)])
      ? map[String(recordingId)]
      : (DEFAULT_SAMPLE_RESOURCES[String(recordingId)] ? [...DEFAULT_SAMPLE_RESOURCES[String(recordingId)]] : []);

    const filtered = list.filter(r => String(r.id) !== String(resourceId));
    map[String(recordingId)] = filtered;
    localStorage.setItem(RESOURCES_KEY, JSON.stringify(map));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('recording-resources-changed', {
        detail: { recordingId, type: 'resource_deleted', resourceId }
      }));
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Infer resource type from file name or URL.
 */
export function inferResourceType(name = '', url = '') {
  const combined = `${name} ${url}`.toLowerCase();
  const ext = combined.split('.').pop()?.split('?')[0]?.trim();

  if (ext === 'pdf' || combined.includes('.pdf')) return 'PDF';
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext) || combined.includes('.zip')) return 'ZIP';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'html', 'css', 'sql', 'json'].includes(ext)) return 'CODE';
  if (['ppt', 'pptx', 'key'].includes(ext) || combined.includes('slide')) return 'SLIDES';
  if (['doc', 'docx', 'txt', 'rtf', 'md'].includes(ext)) return 'DOCUMENT';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return 'IMAGE';
  if (['vtt', 'srt'].includes(ext)) return 'VTT';
  if (url.startsWith('http://') || url.startsWith('https://')) return 'LINK';
  return 'FILE';
}

/**
 * Visual styling and iconography for different resource types.
 */
export function getResourceVisual(type = 'FILE') {
  const t = String(type).toUpperCase();
  switch (t) {
    case 'PDF':
      return {
        icon: 'fa-solid fa-file-pdf',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.1)',
        border: 'rgba(239, 68, 68, 0.25)',
        badge: 'PDF Document'
      };
    case 'ZIP':
    case 'ARCHIVE':
      return {
        icon: 'fa-solid fa-file-zipper',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)',
        border: 'rgba(245, 158, 11, 0.25)',
        badge: 'ZIP Archive'
      };
    case 'CODE':
      return {
        icon: 'fa-solid fa-file-code',
        color: '#8b5cf6',
        bg: 'rgba(139, 92, 246, 0.1)',
        border: 'rgba(139, 92, 246, 0.25)',
        badge: 'Source Code'
      };
    case 'SLIDES':
    case 'PRESENTATION':
      return {
        icon: 'fa-solid fa-file-powerpoint',
        color: '#f97316',
        bg: 'rgba(249, 115, 22, 0.1)',
        border: 'rgba(249, 115, 22, 0.25)',
        badge: 'Lecture Slides'
      };
    case 'DOCUMENT':
    case 'DOC':
      return {
        icon: 'fa-solid fa-file-lines',
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.1)',
        border: 'rgba(59, 130, 246, 0.25)',
        badge: 'Document'
      };
    case 'VTT':
    case 'SUBTITLE':
      return {
        icon: 'fa-solid fa-closed-captioning',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.1)',
        border: 'rgba(16, 185, 129, 0.25)',
        badge: 'Subtitles (CC)'
      };
    case 'LINK':
      return {
        icon: 'fa-solid fa-arrow-up-right-from-square',
        color: '#06b6d4',
        bg: 'rgba(6, 182, 212, 0.1)',
        border: 'rgba(6, 182, 212, 0.25)',
        badge: 'External Link'
      };
    default:
      return {
        icon: 'fa-solid fa-paperclip',
        color: '#5A70D3',
        bg: 'rgba(90, 112, 211, 0.1)',
        border: 'rgba(90, 112, 211, 0.25)',
        badge: 'Attachment'
      };
  }
}

/**
 * Handle direct file download or external link opening.
 */
export async function downloadResourceFile(fileUrl, fileName) {
  if (!fileUrl) return;
  const resolved = resolveMediaUrl(fileUrl);
  let targetUrl = resolved || fileUrl;

  if (targetUrl.includes('/api/v1/media/')) {
    targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'disposition=attachment';
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error('Fetch failed');
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || fileUrl.substring(fileUrl.lastIndexOf('/') + 1) || 'resource-file';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = fileName || true;
    a.target = '_blank';
    a.rel = 'noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
