// ============================================================
// Recording Resources and Overview Management Utility
// Provides persistent storage, syncing, and helpers for recorded video resources & overviews
// ============================================================

import { resolveMediaUrl } from './mediaUtils';
import { updateLiveSession } from '../api/live';

const OVERVIEWS_KEY = 'onetutor_rec_overviews';
const RESOURCES_KEY = 'onetutor_rec_resources';

const DEFAULT_SAMPLE_OVERVIEWS = {};
const DEFAULT_SAMPLE_RESOURCES = {};

const TAG_START = '<!--OT_REC_DATA:';
const TAG_END = '-->';

/**
 * Clean session description for user-facing UI (removes any embedded metadata block).
 */
export function cleanDescription(desc) {
  if (!desc || typeof desc !== 'string') return '';
  const idx = desc.indexOf(TAG_START);
  if (idx === -1) return desc.trim();
  const endIdx = desc.indexOf(TAG_END, idx);
  if (endIdx === -1) return desc.substring(0, idx).trim();
  return (desc.substring(0, idx) + desc.substring(endIdx + TAG_END.length)).trim();
}

/**
 * Extract structured recording metadata (resources, overviews, custom titles) from session description
 * and sync them directly into local storage so any student on any browser/incognito session has instant access.
 */
export function parseSessionRecordingMetadata(session) {
  if (!session || !session.description) return null;
  const desc = session.description;
  const startIdx = desc.indexOf(TAG_START);
  if (startIdx === -1) return null;
  const endIdx = desc.indexOf(TAG_END, startIdx);
  if (endIdx === -1) return null;

  try {
    const jsonStr = desc.substring(startIdx + TAG_START.length, endIdx).trim();
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return null;

    if (data.recordings && typeof data.recordings === 'object') {
      const rawRes = localStorage.getItem(RESOURCES_KEY);
      const resMap = rawRes ? JSON.parse(rawRes) : {};
      const rawOv = localStorage.getItem(OVERVIEWS_KEY);
      const ovMap = rawOv ? JSON.parse(rawOv) : {};

      Object.entries(data.recordings).forEach(([recId, recData]) => {
        if (Array.isArray(recData.resources)) {
          // If remote has resources, merge/sync them so students always see them
          const cleanRes = recData.resources.filter(r => !isLegacySampleResource(r));
          resMap[String(recId)] = cleanRes;
          if (session.id) {
            resMap[`sess_${session.id}`] = cleanRes;
            resMap[`sess_${session.id}_${recId}`] = cleanRes;
          }
        }
        if (recData.overview || recData.title) {
          const ovObj = {
            overview: recData.overview || '',
            title: recData.title || ''
          };
          ovMap[String(recId)] = ovObj;
          if (session.id) {
            ovMap[`sess_${session.id}`] = ovObj;
            ovMap[`sess_${session.id}_${recId}`] = ovObj;
          }
        }
      });

      localStorage.setItem(RESOURCES_KEY, JSON.stringify(resMap));
      localStorage.setItem(OVERVIEWS_KEY, JSON.stringify(ovMap));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('recording-resources-changed', {
          detail: { sessionId: session.id, data }
        }));
      }
    }
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * Sync session recording resources, overview, and title up to the backend database via LiveSession description.
 * This guarantees that every student (on any device, browser profile, or incognito window) gets all files.
 */
export async function syncSessionRecordingDataToBackend(session, recordingId, updatedResources = null, updatedOverview = null, updatedTitle = null) {
  if (!session || !session.id) return;
  try {
    const baseDesc = cleanDescription(session.description || '');

    // Existing metadata or new object
    let currentData = {};
    const startIdx = (session.description || '').indexOf(TAG_START);
    if (startIdx !== -1) {
      const endIdx = (session.description || '').indexOf(TAG_END, startIdx);
      if (endIdx !== -1) {
        try {
          currentData = JSON.parse((session.description || '').substring(startIdx + TAG_START.length, endIdx).trim()) || {};
        } catch (e) {}
      }
    }
    if (!currentData.recordings) currentData.recordings = {};

    const recKey = String(recordingId || (session.recordings?.[0]?.id || 1));
    if (!currentData.recordings[recKey]) currentData.recordings[recKey] = {};

    // Get current local storage maps
    const rawRes = localStorage.getItem(RESOURCES_KEY);
    const resMap = rawRes ? JSON.parse(rawRes) : {};
    const rawOv = localStorage.getItem(OVERVIEWS_KEY);
    const ovMap = rawOv ? JSON.parse(rawOv) : {};

    // Determine resources to save
    let resourcesToSave = null;
    if (updatedResources !== null) {
      resourcesToSave = updatedResources.filter(r => !isLegacySampleResource(r));
    } else {
      if (Array.isArray(resMap[recKey]) && resMap[recKey].length > 0) {
        resourcesToSave = resMap[recKey].filter(r => !isLegacySampleResource(r));
      } else if (Array.isArray(resMap[`sess_${session.id}`]) && resMap[`sess_${session.id}`].length > 0) {
        resourcesToSave = resMap[`sess_${session.id}`].filter(r => !isLegacySampleResource(r));
      } else if (Array.isArray(resMap[String(session.id)])) {
        resourcesToSave = resMap[String(session.id)].filter(r => !isLegacySampleResource(r));
      }
    }

    if (resourcesToSave !== null) {
      currentData.recordings[recKey].resources = resourcesToSave;
      currentData.recordings[`sess_${session.id}`] = {
        ...(currentData.recordings[`sess_${session.id}`] || {}),
        resources: resourcesToSave
      };
      // Also alias to recording 1 if this is the first recording
      if (session.recordings && session.recordings[0] && String(session.recordings[0].id) === recKey) {
        currentData.recordings['1'] = {
          ...(currentData.recordings['1'] || {}),
          resources: resourcesToSave
        };
      }
    }

    // Determine overview & title to save
    let overviewToSave = updatedOverview;
    let titleToSave = updatedTitle;
    if (overviewToSave === null) {
      overviewToSave = ovMap[recKey]?.overview || ovMap[`sess_${session.id}`]?.overview || null;
    }
    if (titleToSave === null) {
      titleToSave = ovMap[recKey]?.title || ovMap[`sess_${session.id}`]?.title || null;
    }

    if (overviewToSave !== null) {
      currentData.recordings[recKey].overview = overviewToSave;
      if (!currentData.recordings[`sess_${session.id}`]) currentData.recordings[`sess_${session.id}`] = {};
      currentData.recordings[`sess_${session.id}`].overview = overviewToSave;
    }
    if (titleToSave !== null) {
      currentData.recordings[recKey].title = titleToSave;
      if (!currentData.recordings[`sess_${session.id}`]) currentData.recordings[`sess_${session.id}`] = {};
      currentData.recordings[`sess_${session.id}`].title = titleToSave;
    }

    const newDesc = `${baseDesc}\n${TAG_START}${JSON.stringify(currentData)}${TAG_END}`;

    await updateLiveSession(session.id, {
      courseId: session.courseId || session.course?.id,
      batchId: session.batchId || session.batch?.id || null,
      title: session.title,
      description: newDesc,
      scheduledAt: session.scheduledAt,
      endTime: session.endTime,
      meetingUrl: session.meetingUrl,
      status: session.status
    });
    session.description = newDesc;
  } catch (err) {
    console.warn('Failed to sync recording metadata to backend:', err);
  }
}

/**
 * Automatically push existing local resources and overviews up to backend database for any sessions missing them.
 */
export async function autoSyncLocalResourcesToBackend(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return;
  try {
    const rawRes = localStorage.getItem(RESOURCES_KEY);
    const rawOv = localStorage.getItem(OVERVIEWS_KEY);
    if (!rawRes && !rawOv) return;

    const resMap = rawRes ? JSON.parse(rawRes) : {};
    const ovMap = rawOv ? JSON.parse(rawOv) : {};

    for (const session of sessions) {
      if (!session || !session.id) continue;
      const desc = session.description || '';
      const hasTag = desc.includes(TAG_START);

      // Check if this session or its recordings have any local resources or overviews
      let hasLocalData = false;
      const sessKey = `sess_${session.id}`;
      if ((Array.isArray(resMap[sessKey]) && resMap[sessKey].length > 0) || ovMap[sessKey]?.overview) {
        hasLocalData = true;
      }
      (session.recordings || []).forEach(r => {
        const rKey = String(r.id);
        if ((Array.isArray(resMap[rKey]) && resMap[rKey].length > 0) || ovMap[rKey]?.overview) {
          hasLocalData = true;
        }
      });

      // If we have local data and backend description doesn't have it, sync!
      if (hasLocalData && !hasTag) {
        const firstRecId = session.recordings?.[0]?.id || 1;
        await syncSessionRecordingDataToBackend(session, firstRecId);
      }
    }
  } catch (e) {
    console.warn('Error in autoSyncLocalResourcesToBackend:', e);
  }
}

/**
 * Get the overview text and custom title for a recording.
 */
export function getRecordingOverview(recordingId, defaultDesc = '', fallbackSessionId = null) {
  if (!recordingId && !fallbackSessionId) return cleanDescription(defaultDesc);
  try {
    const raw = localStorage.getItem(OVERVIEWS_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (recordingId && map[String(recordingId)] && map[String(recordingId)].overview) {
        return cleanDescription(map[String(recordingId)].overview);
      }
      if (fallbackSessionId && map[`sess_${fallbackSessionId}`] && map[`sess_${fallbackSessionId}`].overview) {
        return cleanDescription(map[`sess_${fallbackSessionId}`].overview);
      }
      if (fallbackSessionId && map[String(fallbackSessionId)] && map[String(fallbackSessionId)].overview) {
        return cleanDescription(map[String(fallbackSessionId)].overview);
      }
    }
  } catch (e) {}

  return cleanDescription(defaultDesc) || '';
}

/**
 * Get custom title for a recording if edited by admin.
 */
export function getRecordingCustomTitle(recordingId, defaultTitle = '', fallbackSessionId = null) {
  if (!recordingId && !fallbackSessionId) return defaultTitle;
  try {
    const raw = localStorage.getItem(OVERVIEWS_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (recordingId && map[String(recordingId)] && map[String(recordingId)].title) {
        return map[String(recordingId)].title;
      }
      if (fallbackSessionId && map[`sess_${fallbackSessionId}`] && map[`sess_${fallbackSessionId}`].title) {
        return map[`sess_${fallbackSessionId}`].title;
      }
      if (fallbackSessionId && map[String(fallbackSessionId)] && map[String(fallbackSessionId)].title) {
        return map[String(fallbackSessionId)].title;
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
 * Check if a resource is a legacy dummy/sample resource that should be purged.
 */
function isLegacySampleResource(r) {
  if (!r) return true;
  if (r.id === 101 || r.id === 102 || r.id === 103) return true;
  const legacyNames = [
    'full_stack_architecture_diagram.pdf',
    'live_session_2_demo_code.zip',
    'class_lecture_slides_key_notes.pdf'
  ];
  if (r.name && legacyNames.includes(String(r.name).trim().toLowerCase())) return true;
  if (r.url && (r.url.includes('tests/xhtml/testfiles/resources/pdf/dummy.pdf') || r.url.includes('/archive/refs/heads/main.zip'))) {
    return true;
  }
  return false;
}

/**
 * Get list of downloadable resources attached to a recording.
 */
export function getRecordingResources(recordingId, subtitleUrl = null, fallbackSessionId = null) {
  if (!recordingId && !fallbackSessionId) return [];
  let list = [];
  try {
    const raw = localStorage.getItem(RESOURCES_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (recordingId && Array.isArray(map[String(recordingId)]) && map[String(recordingId)].length > 0) {
        list = [...map[String(recordingId)]];
      } else if (fallbackSessionId && Array.isArray(map[`sess_${fallbackSessionId}`]) && map[`sess_${fallbackSessionId}`].length > 0) {
        list = [...map[`sess_${fallbackSessionId}`]];
      } else if (fallbackSessionId && recordingId && Array.isArray(map[`sess_${fallbackSessionId}_${recordingId}`]) && map[`sess_${fallbackSessionId}_${recordingId}`].length > 0) {
        list = [...map[`sess_${fallbackSessionId}_${recordingId}`]];
      } else if (fallbackSessionId && Array.isArray(map[String(fallbackSessionId)]) && map[String(fallbackSessionId)].length > 0) {
        list = [...map[String(fallbackSessionId)]];
      } else if (Array.isArray(map['1']) && map['1'].length > 0) {
        list = [...map['1']];
      }
    }
  } catch (e) {
    list = [];
  }

  // Purge any legacy sample resources if previously saved in user's browser localStorage
  if (list.some(isLegacySampleResource)) {
    list = list.filter(r => !isLegacySampleResource(r));
    try {
      const raw = localStorage.getItem(RESOURCES_KEY);
      const map = raw ? JSON.parse(raw) : {};
      if (recordingId) map[String(recordingId)] = list;
      if (fallbackSessionId) map[`sess_${fallbackSessionId}`] = list;
      localStorage.setItem(RESOURCES_KEY, JSON.stringify(map));
    } catch (e) {}
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
    let list = Array.isArray(map[String(recordingId)]) ? map[String(recordingId)] : [];
    // Ensure clean from legacy samples
    list = list.filter(r => !isLegacySampleResource(r));

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
    let list = Array.isArray(map[String(recordingId)]) ? map[String(recordingId)] : [];

    // Filter out the requested resource AND any legacy sample resources
    const filtered = list.filter(r => String(r.id) !== String(resourceId) && !isLegacySampleResource(r));
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
 * Clear all attached resources for a recording.
 */
export function clearAllRecordingResources(recordingId) {
  if (!recordingId) return false;
  try {
    const raw = localStorage.getItem(RESOURCES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[String(recordingId)] = [];
    localStorage.setItem(RESOURCES_KEY, JSON.stringify(map));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('recording-resources-changed', {
        detail: { recordingId, type: 'resources_cleared' }
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
