import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getCourse } from '../../api/courses';
import { listSections } from '../../api/sections';
import { listContents, listResources } from '../../api/contents';
import {
  getCourseProgress,
  getContentProgress,
  updateContentProgress,
  startPlaybackSession,
  markContentComplete
} from '../../api/progress';
import {
  getNotesForContent,
  createNote,
  updateNote,
  deleteNote
} from '../../api/notes';
import { useAuth } from '../../auth/AuthContext';
import { ChatPanel } from '../admin/AdminCommunityPage';
import { getStudentCommunityOverview, markCommunityRead } from '../../api/community';
import { recordCourseAccess } from '../../utils/courseHistory';
import AssessmentPlayer from '../../components/assessments/AssessmentPlayer';
import { getAssessmentInfo } from '../../api/assessments';
import { uploadUserMedia } from '../../api/media';
import { VIDEO_QUALITY_OPTIONS, getQualityVideoUrl, resolveMediaUrl } from '../../utils/mediaUtils';

const SAVE_INTERVAL_MS = 8000; // persist every ~8s
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1').replace(/\/+$/, '');

function getDocIconClass(filename = '') {
  const lower = filename ? filename.toLowerCase() : '';
  if (lower.endsWith('.pdf')) return 'fa-solid fa-file-pdf';
  if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'fa-solid fa-file-word';
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'fa-solid fa-file-powerpoint';
  if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'fa-solid fa-file-excel';
  return 'fa-solid fa-file-lines';
}

function handleOpenFile(fileUrl, fileName) {
  if (!fileUrl) return;
  const fullUrl = resolveMediaUrl(fileUrl);
  const lowerName = (fileName || fileUrl).toLowerCase();

  // If it's Word, Excel, or PPT and hosted on Cloudinary or remote HTTP URL, view via Google Docs Viewer
  if ((lowerName.endsWith('.doc') || lowerName.endsWith('.docx') || lowerName.endsWith('.ppt') || lowerName.endsWith('.pptx') || lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')) && fullUrl.startsWith('http') && !fullUrl.includes('localhost')) {
    window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(fullUrl)}`, '_blank', 'noopener,noreferrer');
  } else {
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  }
}

function formatTime(s) {
  if (!s || isNaN(s) || s <= 0) return '0:00';
  const total = Math.floor(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatDurationHuman(s) {
  if (!s || isNaN(s) || s <= 0) return '';
  const total = Math.round(s);
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) {
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
  }
  if (m >= 5) {
    return `${m} min`;
  }
  if (sec > 0) {
    return `${m}m ${sec}s`;
  }
  return `${m} min`;
}

function parseVttText(vttText) {
  if (!vttText || typeof vttText !== 'string') return [];
  const lines = vttText.split(/\r?\n/);
  const cues = [];
  let start = null;
  let end = null;
  let textLines = [];

  const parseTs = (str) => {
    if (!str) return 0;
    const cleanStr = str.trim().replace(',', '.');
    const parts = cleanStr.split(':');
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    }
    if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      if (start !== null && textLines.length > 0) {
        cues.push({ start, end, text: textLines.join(' ') });
        textLines = [];
      }
      const times = line.split('-->');
      start = parseTs(times[0]);
      end = parseTs(times[1]);
    } else if (start !== null && line.length > 0 && !line.startsWith('WEBVTT') && !line.startsWith('NOTE') && !line.match(/^\d+$/)) {
      textLines.push(line);
    } else if (line.length === 0 && start !== null) {
      if (textLines.length > 0) {
        cues.push({ start, end, text: textLines.join(' ') });
        textLines = [];
      }
      start = null;
      end = null;
    }
  }
  if (start !== null && textLines.length > 0) {
    cues.push({ start, end, text: textLines.join(' ') });
  }
  return cues;
}

async function handleDownloadFile(fileUrl, fileName) {
  if (!fileUrl) return;
  let fullUrl = resolveMediaUrl(fileUrl);
  if (fullUrl.includes('/api/v1/media/')) {
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + 'disposition=attachment';
  }

  try {
    const response = await fetch(fullUrl);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || fileUrl.substring(fileUrl.lastIndexOf('/') + 1) || 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = fileName || true;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const str = String(url).trim();
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = str.match(regExp);
  return (match && match[2] && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&enablejsapi=1` : null;
}

function isDirectVideoUrl(url) {
  if (!url) return false;
  const clean = String(url).split('?')[0].toLowerCase();
  return clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.ogg') || clean.endsWith('.mkv') || clean.endsWith('.mov') || clean.includes('/media/files/');
}

function extractContentResources(content, apiResources = []) {
  if (!content) return [];
  const list = [];
  const seenUrls = new Set();

  const add = (r) => {
    if (!r) return;
    const url = r.url || r.description || '';
    if (!url) return;
    const name = r.name || r.title || (url.includes('/') ? url.substring(url.lastIndexOf('/') + 1) : 'Resource File');
    const type = r.type || r.resourceType || 'file';
    const id = r.id || `${url}-${name}`;
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      list.push({ id, name, url, type });
    }
  };

  (apiResources || []).forEach(add);
  (content.resources || []).forEach(add);
  (content.contentResources || []).forEach(add);

  return list;
}

export default function LearningPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [contentsBySection, setContentsBySection] = useState({});
  const [contentsProgressMap, setContentsProgressMap] = useState({});
  const [activeContent, setActiveContent] = useState(null);
  const [contentProgress, setContentProgress] = useState(null);
  const [courseProgress, setCourseProgress] = useState(null);
  const [liveVideoPercent, setLiveVideoPercent] = useState(0);
  const [theaterMode, setTheaterMode] = useState(false);
  const [isPortrait, setIsPortrait] = useState(() => {
    return localStorage.getItem('onetutor_video_portrait') === 'true';
  });
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [collapsedSidebar, setCollapsedSidebar] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      return true;
    }
    return false;
  });
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      return 'curriculum';
    }
    return 'overview';
  }); // overview | curriculum | notes | community | resources | announcements
  const [expandedSections, setExpandedSections] = useState({});
  const [curriculumExpanded, setCurriculumExpanded] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoVolume, setVideoVolume] = useState(1);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsHideTimer = useRef(null);

  // Video Quality & English Subtitles States
  const [videoQuality, setVideoQuality] = useState(() => {
    return localStorage.getItem('onetutor_video_quality') || 'high';
  });
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const qualityMenuRef = useRef(null);
  const pendingQualityRestoreRef = useRef(null);

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(() => {
    return localStorage.getItem('onetutor_subtitles_enabled') === 'true';
  });
  const [activeSubtitleText, setActiveSubtitleText] = useState('');
  const [parsedCues, setParsedCues] = useState([]);
  const [subtitleGenerating, setSubtitleGenerating] = useState(false);

  const hasSubtitles = Boolean(activeContent?.subtitleUrl && activeContent.subtitleUrl.trim().length > 0);

  // Helper to reliably find and update the active subtitle cue for a given playback second
  const updateActiveSubtitle = useCallback((currentTime) => {
    if (!subtitlesEnabled || !parsedCues || parsedCues.length === 0) {
      setActiveSubtitleText('');
      return;
    }
    const curTime = typeof currentTime === 'number' ? currentTime : (videoRef.current?.currentTime || 0);
    const match = parsedCues.find(c => curTime >= c.start && curTime <= c.end);
    setActiveSubtitleText(match ? match.text : '');
  }, [subtitlesEnabled, parsedCues]);

  const handleToggleSubtitles = () => {
    if (!hasSubtitles) return;
    setSubtitlesEnabled(prev => {
      const next = !prev;
      localStorage.setItem('onetutor_subtitles_enabled', String(next));
      if (!next) {
        setActiveSubtitleText('');
      } else {
        const curTime = videoRef.current?.currentTime || 0;
        if (parsedCues && parsedCues.length > 0) {
          const match = parsedCues.find(c => curTime >= c.start && curTime <= c.end);
          setActiveSubtitleText(match ? match.text : '');
        }
      }
      return next;
    });
  };

  // Fetch and parse VTT subtitle text whenever activeContent or subtitleUrl changes
  useEffect(() => {
    if (!activeContent?.subtitleUrl) {
      setParsedCues([]);
      setActiveSubtitleText('');
      return;
    }
    let isMounted = true;
    const fullUrl = resolveMediaUrl(activeContent.subtitleUrl);
    fetch(fullUrl)
      .then(res => res.ok ? res.text() : '')
      .then(text => {
        if (isMounted && text) {
          setParsedCues(parseVttText(text));
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [activeContent?.subtitleUrl, activeContent?.id]);

  // Sync active subtitle text whenever cues or subtitle setting updates
  useEffect(() => {
    updateActiveSubtitle(videoRef.current?.currentTime || 0);
  }, [updateActiveSubtitle]);

  // Poll subtitle status if subtitle generation is actively in progress
  useEffect(() => {
    if (!activeContent) return;
    const isVideo = String(activeContent.contentType).toUpperCase() === 'VIDEO' || isDirectVideoUrl(activeContent.mediaReference);
    if (!isVideo) return;

    if (activeContent.subtitleStatus === 'PROCESSING') {
      setSubtitleGenerating(true);
      let pollAttempts = 0;
      const MAX_ATTEMPTS = 60; // 60 * 4s = 4 minutes max wait (Whisper can take time)
      const POLL_INTERVAL_MS = 4000;

      const intervalId = setInterval(async () => {
        pollAttempts++;
        if (pollAttempts > MAX_ATTEMPTS) {
          clearInterval(intervalId);
          setSubtitleGenerating(false);
          return;
        }
        try {
          const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
          const res = await fetch(`${API_BASE}/contents/${activeContent.id}/subtitle-status`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          if (res.ok) {
            const json = await res.json();
            const data = json.data || json;
            if (data && data.subtitleUrl) {
              setActiveContent(prev => prev && prev.id === activeContent.id ? {
                ...prev,
                subtitleUrl: data.subtitleUrl,
                subtitleStatus: data.status || 'COMPLETED',
                subtitleLanguage: data.outputLanguage || 'en',
                subtitleSourceLanguage: data.sourceLanguage || 'ta'
              } : prev);
              setSubtitleGenerating(false);
              clearInterval(intervalId);
            } else if (data && data.status === 'FAILED') {
              setSubtitleGenerating(false);
              clearInterval(intervalId);
            }
          }
        } catch (ignored) {}
      }, POLL_INTERVAL_MS);

      return () => {
        clearInterval(intervalId);
      };
    } else {
      setSubtitleGenerating(false);
    }
  }, [activeContent?.id, activeContent?.subtitleUrl, activeContent?.subtitleStatus]);

  // Notes — persisted in database via REST API
  const [notes, setNotes] = useState('');
  const [notesList, setNotesList] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [deleteConfirmNoteId, setDeleteConfirmNoteId] = useState(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);

  // Voice recording states & refs for notes
  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Photo & File attachment states & refs for notes
  const [selectedNoteImageFiles, setSelectedNoteImageFiles] = useState([]);
  const [noteImagePreviewUrls, setNoteImagePreviewUrls] = useState([]);
  const noteImageInputRef = useRef(null);

  const [selectedNoteDocFiles, setSelectedNoteDocFiles] = useState([]);
  const noteDocInputRef = useRef(null);
  const noteTextareaRef = useRef(null);

  // In-app modal viewer state for documents and photos
  const [previewFileModal, setPreviewFileModal] = useState(null);
  const [imgZoom, setImgZoom] = useState(1);
  const [imgRotation, setImgRotation] = useState(0);
  const [showModalBars, setShowModalBars] = useState(true);

  const selectPreviewMediaItem = async (index, mediaList) => {
    const list = mediaList || previewFileModal?.mediaList || [];
    if (!list || list.length === 0) return;

    const validIdx = Math.max(0, Math.min(index, list.length - 1));
    const activeItem = list[validIdx];
    const fullUrl = resolveMediaUrl(activeItem.url);

    setImgZoom(1);
    setImgRotation(0);
    setShowModalBars(true);

    const newModal = {
      url: activeItem.url,
      fullUrl,
      name: activeItem.name || (activeItem.isImage ? `Photo ${validIdx + 1}` : 'File Attachment'),
      type: activeItem.type || (activeItem.isImage ? 'image' : 'other'),
      isImage: Boolean(activeItem.isImage),
      mediaList: list,
      activeMediaIndex: validIdx,
      loading: (activeItem.type === 'docx' || activeItem.type === 'text'),
      htmlContent: '',
      textContent: '',
      error: ''
    };

    setPreviewFileModal(newModal);

    if (activeItem.type === 'docx') {
      try {
        const response = await fetch(fullUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setPreviewFileModal(prev => (prev && prev.url === activeItem.url) ? {
          ...prev,
          loading: false,
          htmlContent: result.value || '<p style="color: #64748b; text-align: center;">Document is empty.</p>'
        } : prev);
      } catch (err) {
        console.error('Docx parse error:', err);
        setPreviewFileModal(prev => (prev && prev.url === activeItem.url) ? {
          ...prev,
          loading: false,
          error: 'Could not render document preview automatically. You can download the file to view it.'
        } : prev);
      }
    } else if (activeItem.type === 'text') {
      try {
        const response = await fetch(fullUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        setPreviewFileModal(prev => (prev && prev.url === activeItem.url) ? {
          ...prev,
          loading: false,
          textContent: text
        } : prev);
      } catch (err) {
        setPreviewFileModal(prev => (prev && prev.url === activeItem.url) ? {
          ...prev,
          loading: false,
          error: 'Could not load text file content.'
        } : prev);
      }
    }
  };

  const openInAppPreview = (fileUrl, fileName = '', isExplicitImage = false, mediaList = [], initialIndex = 0) => {
    if (!fileUrl && (!mediaList || !mediaList.length)) return;

    let normalizedList = [];
    if (Array.isArray(mediaList) && mediaList.length > 0) {
      normalizedList = mediaList.map((item, idx) => {
        if (typeof item === 'string') {
          const cleanStr = item.split('?')[0].toLowerCase();
          const isImg = isExplicitImage || /\.(png|jpe?g|webp|gif|svg|bmp)/i.test(cleanStr) || cleanStr.includes('photo') || cleanStr.includes('image');
          let type = 'other';
          if (isImg) type = 'image';
          else if (cleanStr.includes('.pdf')) type = 'pdf';
          else if (cleanStr.includes('.docx')) type = 'docx';
          else if (/\.(doc|ppt|pptx|xls|xlsx)/i.test(cleanStr)) type = 'office';
          else if (/\.(txt|json|csv|md|html|log)/i.test(cleanStr)) type = 'text';

          return {
            url: item,
            name: isImg ? `Photo ${idx + 1}` : (fileName || `Attachment ${idx + 1}`),
            isImage: isImg,
            type
          };
        }
        return item;
      });
    } else if (fileUrl) {
      const cleanStr = (fileName || fileUrl).split('?')[0].toLowerCase();
      const isImg = isExplicitImage || /\.(png|jpe?g|webp|gif|svg|bmp)/i.test(cleanStr) || cleanStr.includes('photo') || cleanStr.includes('image');
      let type = 'other';
      if (isImg) type = 'image';
      else if (cleanStr.includes('.pdf')) type = 'pdf';
      else if (cleanStr.includes('.docx')) type = 'docx';
      else if (/\.(doc|ppt|pptx|xls|xlsx)/i.test(cleanStr)) type = 'office';
      else if (/\.(txt|json|csv|md|html|log)/i.test(cleanStr)) type = 'text';

      normalizedList = [{
        url: fileUrl,
        name: fileName || (isImg ? 'Photo Preview' : 'File Preview'),
        isImage: isImg,
        type
      }];
    }

    const startIdx = Math.max(0, Math.min(initialIndex, normalizedList.length - 1));
    selectPreviewMediaItem(startIdx, normalizedList);
  };

  // Keyboard navigation for preview modal (Left & Right arrow keys)
  useEffect(() => {
    if (!previewFileModal || !previewFileModal.mediaList || previewFileModal.mediaList.length <= 1) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIdx = (previewFileModal.activeMediaIndex - 1 + previewFileModal.mediaList.length) % previewFileModal.mediaList.length;
        selectPreviewMediaItem(prevIdx, previewFileModal.mediaList);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIdx = (previewFileModal.activeMediaIndex + 1) % previewFileModal.mediaList.length;
        selectPreviewMediaItem(nextIdx, previewFileModal.mediaList);
      } else if (e.key === 'Escape') {
        setPreviewFileModal(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewFileModal]);

  // Editing states & refs for note attachments
  const [editingImageUrl, setEditingImageUrl] = useState('');
  const [editingImageFile, setEditingImageFile] = useState(null);
  const [editingImagePreviewUrl, setEditingImagePreviewUrl] = useState('');
  const editImageInputRef = useRef(null);

  const [editingFileUrl, setEditingFileUrl] = useState('');
  const [editingFileName, setEditingFileName] = useState('');
  const [editingDocFile, setEditingDocFile] = useState(null);
  const editDocInputRef = useRef(null);
  const [communityUnreadCount, setCommunityUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Strict Sequential Video Watching & Playback Session Anti-Cheat
  const [toastNotice, setToastNotice] = useState(null);
  const toastNoticeTimerRef = useRef(null);
  const maxWatchedPosRef = useRef(0);
  const playbackSessionIdRef = useRef(null);

  const triggerToast = useCallback((msg) => {
    setToastNotice(msg);
    clearTimeout(toastNoticeTimerRef.current);
    toastNoticeTimerRef.current = setTimeout(() => setToastNotice(null), 2400);
  }, []);

  const [currentAssessmentInfo, setCurrentAssessmentInfo] = useState(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [isFullWindowAssessment, setIsFullWindowAssessment] = useState(false);

  const [lectureResources, setLectureResources] = useState([]);

  // Dynamically load resources for active lecture/video
  useEffect(() => {
    if (!activeContent?.id) {
      setLectureResources([]);
      return;
    }
    const initial = extractContentResources(activeContent, []);
    setLectureResources(initial);

    let isMounted = true;
    listResources(activeContent.id)
      .then((data) => {
        if (isMounted && data) {
          setLectureResources(extractContentResources(activeContent, data));
        }
      })
      .catch(() => {
        // Fall back gracefully to activeContent.resources
      });

    return () => {
      isMounted = false;
    };
  }, [activeContent?.id]);

  const handleSidebarDownloadResources = useCallback(() => {
    if (!lectureResources || lectureResources.length === 0) return;

    if (lectureResources.length === 1) {
      const res = lectureResources[0];
      triggerToast(`Downloading "${res.name}"...`);
      handleDownloadFile(res.url, res.name);
    } else {
      triggerToast(`Downloading ${lectureResources.length} resources...`);
      lectureResources.forEach((res, idx) => {
        setTimeout(() => {
          handleDownloadFile(res.url, res.name);
        }, idx * 400);
      });
      setActiveTab('resources');
    }
  }, [lectureResources, triggerToast]);

  const handleStartFullWindowAssessment = () => {
    setShowAssessmentModal(false);
    setIsFullWindowAssessment(true);
  };

  useEffect(() => {
    if (!activeContent) {
      setCurrentAssessmentInfo(null);
      return;
    }
    getAssessmentInfo(activeContent.id)
      .then(info => setCurrentAssessmentInfo(info))
      .catch(() => setCurrentAssessmentInfo(null));
  }, [activeContent]);

  useEffect(() => {
    if (!courseId) return;
    recordCourseAccess(courseId);
    getStudentCommunityOverview()
      .then(list => {
        const match = (list || []).find(c => String(c.courseId) === String(courseId));
        if (match) {
          setCommunityUnreadCount(match.unreadCount || 0);
        }
      })
      .catch(() => {});
  }, [courseId]);

  const handleOpenCommunityTab = () => {
    setActiveTab('community');
    if (communityUnreadCount > 0) {
      setCommunityUnreadCount(0);
      markCommunityRead(Number(courseId)).catch(() => {});
      window.dispatchEvent(new CustomEvent('community-read', { detail: { courseId: Number(courseId) } }));
    }
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: prev[sectionId] === false ? true : false
    }));
  };

  const videoRef = useRef(null);
  const lastSavedAtRef = useRef(Date.now());
  const liveVideoPercentRef = useRef(0);
  const hasRestoredRef = useRef(false);
  const activeContentRef = useRef(activeContent);
  activeContentRef.current = activeContent;

  const refreshCourseProgress = useCallback(() => {
    getCourseProgress(courseId).then(setCourseProgress).catch(() => {});
  }, [courseId]);

  // Find all lectures flattened across active sections
  const allLectures = useMemo(() => {
    return sections.flatMap(s => contentsBySection[s.id] || []);
  }, [sections, contentsBySection]);

  const currentLectureIndex = useMemo(() => {
    if (!activeContent) return -1;
    return allLectures.findIndex(l => l.id === activeContent.id);
  }, [allLectures, activeContent]);

  const prevLecture = currentLectureIndex > 0 ? allLectures[currentLectureIndex - 1] : null;
  const nextLecture = currentLectureIndex >= 0 && currentLectureIndex < allLectures.length - 1 ? allLectures[currentLectureIndex + 1] : null;

  const completedLecturesCount = useMemo(() => {
    return allLectures.filter(l => {
      if (l.id === activeContent?.id) {
        return Boolean(contentProgress?.completed);
      }
      return Boolean(contentsProgressMap[l.id]?.completed);
    }).length;
  }, [allLectures, activeContent?.id, contentProgress?.completed, contentsProgressMap]);

  const activeSection = useMemo(() => {
    if (!activeContent) return sections[0] || null;
    for (const s of sections) {
      const list = contentsBySection[s.id] || [];
      if (list.some(c => c.id === activeContent.id)) return s;
    }
    return sections[0] || null;
  }, [sections, contentsBySection, activeContent]);

  // Video durations cache (contentId -> duration in seconds)
  const [lectureDurations, setLectureDurations] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('onetutor_lecture_durations') || '{}');
    } catch {
      return {};
    }
  });

  // Active probe elements reference to prevent premature garbage collection
  const probeElementsRef = useRef([]);

  // Whenever the active video reports its duration, update our cache and populate matching media lectures
  useEffect(() => {
    if (activeContent?.id && videoDuration > 0) {
      const rounded = Math.round(videoDuration);
      setLectureDurations(prev => {
        let changed = false;
        const next = { ...prev };
        if (next[activeContent.id] !== rounded) {
          next[activeContent.id] = rounded;
          changed = true;
        }
        // Also sync duration to any other lecture in the curriculum with the same media reference
        if (activeContent.mediaReference && allLectures.length > 0) {
          allLectures.forEach(l => {
            if (l.mediaReference === activeContent.mediaReference && next[l.id] !== rounded) {
              next[l.id] = rounded;
              changed = true;
            }
          });
        }
        if (!changed) return prev;
        try { localStorage.setItem('onetutor_lecture_durations', JSON.stringify(next)); } catch {}
        return next;
      });
    }
  }, [activeContent?.id, activeContent?.mediaReference, videoDuration, allLectures]);

  // Pre-probe video metadata for all other curriculum lectures
  useEffect(() => {
    if (!allLectures.length) return;

    allLectures.forEach(lecture => {
      const isVideo = String(lecture.contentType).toUpperCase() === 'VIDEO' || isDirectVideoUrl(lecture.mediaReference);
      if (!isVideo || !lecture.mediaReference) return;
      if (lectureDurations[lecture.id]) return;

      // Check if another lecture sharing this media reference already has duration cached
      const matchingCached = allLectures.find(l => l.id !== lecture.id && l.mediaReference === lecture.mediaReference && lectureDurations[l.id]);
      if (matchingCached && lectureDurations[matchingCached.id]) {
        const d = lectureDurations[matchingCached.id];
        setLectureDurations(prev => {
          if (prev[lecture.id] === d) return prev;
          const next = { ...prev, [lecture.id]: d };
          try { localStorage.setItem('onetutor_lecture_durations', JSON.stringify(next)); } catch {}
          return next;
        });
        return;
      }

      try {
        const mediaUrl = resolveMediaUrl(lecture.mediaReference);
        if (!mediaUrl || mediaUrl.includes('youtube.com') || mediaUrl.includes('youtu.be')) return;

        const probeVid = document.createElement('video');
        probeVid.preload = 'metadata';
        probeVid.crossOrigin = 'anonymous';
        probeVid.src = mediaUrl;
        probeElementsRef.current.push(probeVid);

        const cleanup = () => {
          probeVid.onloadedmetadata = null;
          probeVid.onerror = null;
          probeVid.src = '';
          const idx = probeElementsRef.current.indexOf(probeVid);
          if (idx !== -1) probeElementsRef.current.splice(idx, 1);
        };

        probeVid.onloadedmetadata = () => {
          if (probeVid.duration && !isNaN(probeVid.duration) && probeVid.duration > 0) {
            const rounded = Math.round(probeVid.duration);
            setLectureDurations(prev => {
              let updated = false;
              const next = { ...prev };
              if (next[lecture.id] !== rounded) {
                next[lecture.id] = rounded;
                updated = true;
              }
              // Also sync to any lectures sharing this same mediaReference
              allLectures.forEach(l => {
                if (l.mediaReference === lecture.mediaReference && next[l.id] !== rounded) {
                  next[l.id] = rounded;
                  updated = true;
                }
              });
              if (!updated) return prev;
              try { localStorage.setItem('onetutor_lecture_durations', JSON.stringify(next)); } catch {}
              return next;
            });
          }
          cleanup();
        };

        probeVid.onerror = () => {
          cleanup();
        };

        probeVid.load();
      } catch (ignored) {}
    });
  }, [allLectures, lectureDurations]);

  const totalCourseDurationText = useMemo(() => {
    if (!allLectures.length) return '';
    const totalSec = allLectures.reduce((sum, l) => {
      const d = (l.id === activeContent?.id && videoDuration > 0)
        ? Math.round(videoDuration)
        : (lectureDurations[l.id] || 0);
      return sum + d;
    }, 0);
    return totalSec > 0 ? formatDurationHuman(totalSec) : '';
  }, [allLectures, activeContent?.id, videoDuration, lectureDurations]);

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsVideoPlaying(true);
            setIsVideoBuffering(false);
          })
          .catch((err) => {
            console.warn('Playback prevented by browser autoplay policy:', err);
            setIsVideoPlaying(false);
          });
      }
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const handleTogglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.log('PiP not supported or failed', err);
    }
  };

  const handleToggleOrientation = () => {
    setIsPortrait(prev => {
      const next = !prev;
      localStorage.setItem('onetutor_video_portrait', String(next));
      triggerToast({
        message: next ? 'Switched to Portrait Mode (9:16)' : 'Switched to Landscape Mode (16:9)',
        icon: 'fa-solid fa-mobile-screen',
        type: 'info'
      });
      if (typeof window !== 'undefined' && window.screen && window.screen.orientation && window.screen.orientation.lock) {
        try {
          if (document.fullscreenElement) {
            window.screen.orientation.lock(next ? 'portrait' : 'landscape').catch(() => {});
          }
        } catch (e) {}
      }
      return next;
    });
  };

  const handleMuteToggle = () => {
    if (!videoRef.current) return;
    const next = !videoRef.current.muted;
    videoRef.current.muted = next;
    setVideoMuted(next);
    if (!next && videoVolume === 0) {
      videoRef.current.volume = 0.5;
      setVideoVolume(0.5);
    }
  };

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVideoVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
      setVideoMuted(v === 0);
    }
  };

  const isScrubbingRef = useRef(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const seekBarRef = useRef(null);

  const calculateSeekTime = useCallback((clientX) => {
    if (!seekBarRef.current || !videoDuration) return null;
    const rect = seekBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * videoDuration;
  }, [videoDuration]);

  const applySeek = useCallback((targetTime) => {
    if (!videoRef.current || targetTime === null) return;
    const isSequentialEnabled = course?.sequentialVideoEnabled !== false;
    if (isSequentialEnabled && targetTime > maxWatchedPosRef.current + 1.2) {
      videoRef.current.currentTime = maxWatchedPosRef.current;
      setVideoCurrentTime(maxWatchedPosRef.current);
      triggerToast("Watch sequentially before skipping ahead");
      return;
    }
    videoRef.current.currentTime = targetTime;
    setVideoCurrentTime(targetTime);
  }, [course?.sequentialVideoEnabled, triggerToast]);

  const handleSeekStart = (e) => {
    e.stopPropagation();
    if (!videoDuration || !videoRef.current) return;
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    showVideoControls();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const t = calculateSeekTime(clientX);
    applySeek(t);

    const handleSeekMove = (moveEvt) => {
      if (!isScrubbingRef.current) return;
      showVideoControls();
      const moveX = moveEvt.touches ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const targetT = calculateSeekTime(moveX);
      applySeek(targetT);
    };

    const handleSeekEnd = () => {
      isScrubbingRef.current = false;
      setIsScrubbing(false);
      window.removeEventListener('mousemove', handleSeekMove);
      window.removeEventListener('mouseup', handleSeekEnd);
      window.removeEventListener('touchmove', handleSeekMove);
      window.removeEventListener('touchend', handleSeekEnd);
    };

    window.addEventListener('mousemove', handleSeekMove);
    window.addEventListener('mouseup', handleSeekEnd);
    window.addEventListener('touchmove', handleSeekMove, { passive: false });
    window.addEventListener('touchend', handleSeekEnd);
  };

  const handleFullscreen = () => {
    const container = videoRef.current?.closest('.ot-video-card');
    if (!container) return;
    const isFs = Boolean(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    if (!isFs) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  // Fullscreen change listener to sync isFullscreen state across browser implementations
  useEffect(() => {
    const onFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);

  // Controls auto-hide: shows controls on activity, auto-hides after 2.5s during playback
  const showVideoControls = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsHideTimer.current);
    if (isVideoPlaying) {
      controlsHideTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isVideoPlaying]);

  // When playback state toggles: start hide timer on play, keep visible on pause
  useEffect(() => {
    if (isVideoPlaying) {
      clearTimeout(controlsHideTimer.current);
      controlsHideTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    } else {
      setShowControls(true);
      clearTimeout(controlsHideTimer.current);
    }
    return () => clearTimeout(controlsHideTimer.current);
  }, [isVideoPlaying]);

  // Video Quality Switcher handler (High, Medium, Low - seamlessly preserves currentTime & play state)
  const handleQualityChange = useCallback((newQuality) => {
    if (newQuality === videoQuality) {
      setShowQualityMenu(false);
      return;
    }
    const currentTime = videoRef.current ? videoRef.current.currentTime : 0;
    const wasPlaying = videoRef.current ? !videoRef.current.paused : false;

    // Store state so that when the new quality source loads, it resumes smoothly
    pendingQualityRestoreRef.current = { currentTime, wasPlaying };

    setVideoQuality(newQuality);
    localStorage.setItem('onetutor_video_quality', newQuality);
    setShowQualityMenu(false);

    const labels = {
      low: 'Low (360p - Data Saver)',
      medium: 'Medium (480p - Balanced)',
      high: 'High (Original HD)'
    };
    triggerToast({
      message: `Video quality switched to ${labels[newQuality] || newQuality}`,
      icon: 'fa-solid fa-sliders',
      type: 'info'
    });

    // Safety fallback in case onLoadedMetadata doesn't fire immediately
    setTimeout(() => {
      if (pendingQualityRestoreRef.current && videoRef.current) {
        const { currentTime: cTime, wasPlaying: wPlay } = pendingQualityRestoreRef.current;
        if (cTime > 0) videoRef.current.currentTime = cTime;
        if (wPlay) videoRef.current.play().catch(() => {});
        pendingQualityRestoreRef.current = null;
      }
    }, 250);
  }, [videoQuality, triggerToast]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target)) {
        setShowQualityMenu(false);
      }
    };
    if (showQualityMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showQualityMenu]);

  // Dynamic lively course progress calculation:
  // Combines real-time active playback percentage with persisted progress of all course lectures
  const overallProgressPercent = useMemo(() => {
    if (!allLectures.length) return Math.round(courseProgress?.progressPercent || 0);
    let total = 0;
    let allCompleted = true;

    for (const lecture of allLectures) {
      if (activeContent?.id === lecture.id) {
        if (contentProgress?.completed) {
          total += 100;
        } else {
          allCompleted = false;
          // While video is still playing and not completed, cap at 99% so it never shows 100% prematurely
          const currentPct = Math.min(99, Math.max(liveVideoPercent, Number(contentProgress?.progressPercent) || 0));
          total += currentPct;
        }
      } else {
        const p = contentsProgressMap[lecture.id];
        if (p?.completed) {
          total += 100;
        } else {
          allCompleted = false;
          total += Math.min(99, Math.max(0, Number(p?.progressPercent) || 0));
        }
      }
    }

    if (allCompleted) return 100;
    const avg = total / allLectures.length;
    // Cap at 99% until all lectures are fully completed
    return Math.min(99, Math.floor(avg));
  }, [allLectures, activeContent, contentProgress, liveVideoPercent, contentsProgressMap, courseProgress]);

  const loadNotesForContent = useCallback(async (contentId) => {
    if (!contentId) {
      setNotesList([]);
      return;
    }
    setNotesLoading(true);
    try {
      const dbNotes = await getNotesForContent(contentId);
      // Optional migration: check if any old localStorage notes exist and migrate them
      try {
        const localKey = `onetutor_notes_${contentId}`;
        const savedLocal = localStorage.getItem(localKey);
        if (savedLocal) {
          const localArr = JSON.parse(savedLocal);
          if (Array.isArray(localArr) && localArr.length > 0 && (!dbNotes || dbNotes.length === 0)) {
            for (const item of localArr) {
              await createNote(contentId, {
                text: item.text,
                videoTimestampSeconds: 0,
                videoTimestamp: item.timestamp || '0:00'
              }).catch(() => {});
            }
            localStorage.removeItem(localKey);
            const refetched = await getNotesForContent(contentId);
            setNotesList(refetched || []);
            setNotesLoading(false);
            return;
          }
        }
      } catch {}

      setNotesList(dbNotes || []);
    } catch {
      setNotesList([]);
    } finally {
      setNotesLoading(false);
    }
  }, []);

  const isLessonUnlocked = useCallback((content) => {
    if (course?.sequentialLessonUnlocking !== true) return true;
    const idx = allLectures.findIndex(l => l.id === content.id);
    if (idx <= 0) return true;
    const prevContent = allLectures[idx - 1];
    const prevProg = (prevContent.id === activeContent?.id) ? contentProgress : contentsProgressMap[prevContent.id];
    return Boolean(prevProg?.completed);
  }, [course?.sequentialLessonUnlocking, allLectures, activeContent?.id, contentProgress, contentsProgressMap]);

  const selectContent = useCallback(async (content, force = false) => {
    if (!force && !isLessonUnlocked(content)) {
      triggerToast("You must complete the previous lesson before starting this one.");
      return;
    }

    hasRestoredRef.current = false;
    lastSavedAtRef.current = Date.now();
    setActiveContent(content);
    loadNotesForContent(content.id);

    let progress = contentsProgressMap[content.id];
    if (!progress) {
      progress = await getContentProgress(content.id).catch(() => null);
      if (progress) {
        setContentsProgressMap(prev => ({ ...prev, [content.id]: progress }));
      }
    }
    setContentProgress(progress || null);

    const initMax = Number(progress?.maxWatchedPosition) || Number(progress?.videoPosition) || 0;
    maxWatchedPosRef.current = initMax;

    try {
      const sessionData = await startPlaybackSession(content.id);
      if (sessionData && sessionData.playbackSessionId) {
        playbackSessionIdRef.current = sessionData.playbackSessionId;
        const sMax = Number(sessionData.maxWatchedPosition) || 0;
        const sPos = Number(sessionData.videoPosition) || 0;
        maxWatchedPosRef.current = Math.max(initMax, sMax, sPos);
      }
    } catch (err) {
      console.warn('Playback session initialization fallback:', err);
    }

    const initialPct = Number(progress?.progressPercent) || 0;
    setLiveVideoPercent(initialPct);
    liveVideoPercentRef.current = initialPct;
  }, [contentsProgressMap, loadNotesForContent, isLessonUnlocked, triggerToast]);

  useEffect(() => {
    async function load() {
      try {
        const [courseData, sectionData] = await Promise.all([
          getCourse(courseId),
          listSections(courseId),
        ]);
        setCourse(courseData);
        setSections(sectionData || []);

        const contentMap = {};
        for (const s of (sectionData || [])) {
          contentMap[s.id] = await listContents(s.id).catch(() => []);
        }
        setContentsBySection(contentMap);

        const allItems = Object.values(contentMap).flat();
        let pMap = {};
        if (allItems.length > 0) {
          const progResults = await Promise.all(
            allItems.map(async (item) => {
              const p = await getContentProgress(item.id).catch(() => null);
              return [item.id, p];
            })
          );
          for (const [id, p] of progResults) {
            if (p) pMap[id] = p;
          }
          setContentsProgressMap(pMap);
        }

        const firstWithContent = (sectionData || []).find((s) => contentMap[s.id]?.length);
        if (firstWithContent && contentMap[firstWithContent.id]?.length > 0) {
          const firstItem = contentMap[firstWithContent.id][0];
          selectContent(firstItem);
        }
        refreshCourseProgress();
      } catch (err) {
        // Removed / not enrolled students must be redirected immediately
        const errorCode = err?.response?.data?.errorCode || '';
        const status = err?.response?.status;
        if (errorCode === 'ENROLLMENT_REMOVED' || errorCode === 'NOT_ENROLLED' || status === 403) {
          navigate('/student/my-courses', {
            replace: true,
            state: {
              accessError: errorCode === 'ENROLLMENT_REMOVED'
                ? 'Your access to this course has been removed by an administrator.'
                : 'You are not enrolled in this course.'
            }
          });
          return;
        }
        setError(err.response?.data?.message || 'Could not load course curriculum. Please ensure you are enrolled.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId, refreshCourseProgress, loadNotesForContent, navigate]);

  // Robust video position resume effect whenever activeContent or contentProgress is ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeContent || !contentProgress) return;

    const targetPos = contentProgress.videoPosition || 0;
    if (targetPos > 0 && !contentProgress.completed) {
      const applySeek = () => {
        try {
          if (video.duration && targetPos < video.duration - 2) {
            if (Math.abs(video.currentTime - targetPos) > 1) {
              video.currentTime = targetPos;
            }
            hasRestoredRef.current = true;
          }
        } catch (e) {
          console.warn('Seek to saved video position failed:', e);
        }
      };

      if (video.readyState >= 1 && video.duration) {
        applySeek();
      } else {
        video.addEventListener('loadedmetadata', applySeek, { once: true });
        video.addEventListener('canplay', applySeek, { once: true });
      }
    } else {
      hasRestoredRef.current = true;
    }
  }, [activeContent?.id, contentProgress?.videoPosition]);

  // Periodic heartbeat to keep course lastAccessedAt fresh while student is active on LearningPage
  useEffect(() => {
    if (!activeContent?.id) return;
    const heartbeat = setInterval(() => {
      const currentPos = videoRef.current?.currentTime || 0;
      const currentPct = liveVideoPercentRef.current || 0;
      updateContentProgress(activeContent.id, Math.floor(currentPos), currentPct.toFixed(2)).catch(() => {});
    }, 15_000);
    return () => clearInterval(heartbeat);
  }, [activeContent?.id]);


  // Save current progress on page unload or component unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      const video = videoRef.current;
      if (video && activeContentRef.current && video.currentTime > 1 && video.duration > 0) {
        const pos = Math.floor(video.currentTime);
        const pct = Math.min(100, (pos / video.duration) * 100);
        try {
          localStorage.setItem(`onetutor_last_pos_${activeContentRef.current.id}`, String(pos));
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      const video = videoRef.current;
      if (video && activeContentRef.current && video.currentTime > 1 && video.duration > 0) {
        const pos = Math.floor(video.currentTime);
        const pct = Math.min(100, (pos / video.duration) * 100);
        updateContentProgress(activeContentRef.current.id, pos, pct.toFixed(2)).catch(() => {});
      }
    };
  }, []);

  const persistVideoProgress = useCallback(async (position, percent) => {
    if (!activeContent) return;
    try {
      const updated = await updateContentProgress(activeContent.id, {
        videoPosition: Math.floor(position),
        progressPercent: percent.toFixed(2),
        maxWatchedPosition: Math.floor(maxWatchedPosRef.current),
        playbackSessionId: playbackSessionIdRef.current,
        playbackRate: videoRef.current?.playbackRate || 1.0,
        videoDuration: videoRef.current?.duration || 0
      });
      setContentProgress(updated);
      if (updated?.maxWatchedPosition) {
        maxWatchedPosRef.current = Math.max(maxWatchedPosRef.current, updated.maxWatchedPosition);
      }
      setContentsProgressMap(prev => ({ ...prev, [activeContent.id]: updated }));
      if (updated.completed) {
        refreshCourseProgress();
      }
    } catch (e) {
      console.error('Failed to persist video progress', e);
    }
  }, [activeContent, refreshCourseProgress]);

  const handleTimeUpdate = (e) => {
    const video = e.target;
    if (!video.duration || isNaN(video.duration) || video.duration <= 0) return;

    // Guard: do not process 0-time before saved position has been restored
    const targetPos = contentProgress?.videoPosition || 0;
    if (!hasRestoredRef.current && targetPos > 0 && video.currentTime < 1) {
      return;
    }
    hasRestoredRef.current = true;

    // Monotonically advance max watched position as video plays naturally
    if (!video.paused && video.currentTime > maxWatchedPosRef.current) {
      maxWatchedPosRef.current = video.currentTime;
    }

    // Strict sequential forward seek enforcement if user seeks past max watched position
    const isSequentialEnabled = course?.sequentialVideoEnabled !== false;
    if (isSequentialEnabled && video.currentTime > maxWatchedPosRef.current + 3.0) {
      video.currentTime = maxWatchedPosRef.current;
      triggerToast("Please watch the video sequentially before skipping ahead.");
      return;
    }

    const rawPercent = (video.currentTime / video.duration) * 100;
    const isAtEnd = video.currentTime >= video.duration - 0.5;
    const percent = isAtEnd ? 100 : Math.min(99, Math.max(0, rawPercent));

    // Lively real-time progress update as video plays
    if (Math.abs(percent - liveVideoPercentRef.current) >= 0.4 || Math.round(percent) !== Math.round(liveVideoPercentRef.current)) {
      liveVideoPercentRef.current = percent;
      setLiveVideoPercent(percent);
    }

    const now = Date.now();
    if (now - lastSavedAtRef.current > SAVE_INTERVAL_MS) {
      lastSavedAtRef.current = now;
      persistVideoProgress(video.currentTime, percent);
    }
  };

  const handleSeeking = (e) => {
    const video = e.target;
    if (!video || !video.duration) return;
    const isSequentialEnabled = course?.sequentialVideoEnabled !== false;
    if (isSequentialEnabled && video.currentTime > maxWatchedPosRef.current + 2.0) {
      video.currentTime = maxWatchedPosRef.current;
      triggerToast("Please watch the video sequentially before skipping ahead.");
    }
  };

  // Tab Inactive Auto-Pause Effect
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && videoRef.current && !videoRef.current.paused) {
        if (course?.pauseOnTabInactive !== false) {
          videoRef.current.pause();
          setIsVideoPlaying(false);
          triggerToast("Video paused automatically because your tab became inactive.");
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [course?.pauseOnTabInactive, triggerToast]);

  // Keyboard Seeking Guard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!videoRef.current || !activeContent) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        const isSequentialEnabled = course?.sequentialVideoEnabled !== false;
        const targetTime = videoRef.current.currentTime + 5;
        if (isSequentialEnabled && targetTime > maxWatchedPosRef.current + 1.2) {
          e.preventDefault();
          videoRef.current.currentTime = maxWatchedPosRef.current;
          triggerToast("Please watch the video sequentially before skipping ahead.");
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeContent, course?.sequentialVideoEnabled, triggerToast]);

  const handleVideoPause = (e) => {
    const video = e.target;
    if (!video.duration || isNaN(video.duration) || video.duration <= 0) return;
    if (video.currentTime < 1 && (contentProgress?.videoPosition || 0) > 2) return;
    const rawPercent = (video.currentTime / video.duration) * 100;
    const isAtEnd = video.currentTime >= video.duration - 0.5;
    const percent = isAtEnd ? 100 : Math.min(99, Math.max(0, rawPercent));
    persistVideoProgress(video.currentTime, percent);
  };

  const handleVideoEnded = (e) => {
    const video = e.target;
    if (!video.duration || isNaN(video.duration)) return;
    setLiveVideoPercent(100);
    liveVideoPercentRef.current = 100;
    persistVideoProgress(video.duration, 100);

    // Trigger assessment notification prompt if lesson has an active assessment not yet passed
    if (currentAssessmentInfo?.enabled && !currentAssessmentInfo?.userStatus?.passed) {
      setShowAssessmentModal(true);
      return; // Do not auto-advance to next lecture until assessment is addressed
    }

    if (autoPlayNext && nextLecture) {
      setTimeout(() => {
        selectContent(nextLecture);
      }, 1200);
    }
  };

  const handleLoadedMetadata = (e) => {
    const video = e.target;
    if (!video || !video.duration) return;
    const targetPos = contentProgress?.videoPosition || 0;
    if (targetPos > 0 && targetPos < video.duration - 2 && !contentProgress?.completed) {
      if (Math.abs(video.currentTime - targetPos) > 1) {
        video.currentTime = targetPos;
      }
      const initialPct = Math.min(100, Math.max(0, (targetPos / video.duration) * 100));
      setLiveVideoPercent(initialPct);
      liveVideoPercentRef.current = initialPct;
      hasRestoredRef.current = true;
    }
  };

  const handleToggleComplete = async () => {
    if (!activeContent) return;
    const updated = await markContentComplete(activeContent.id);
    setContentProgress(updated);
    setContentsProgressMap(prev => ({ ...prev, [activeContent.id]: updated }));
    if (updated.completed) {
      setLiveVideoPercent(100);
      liveVideoPercentRef.current = 100;
    } else {
      setLiveVideoPercent(0);
      liveVideoPercentRef.current = 0;
    }
    refreshCourseProgress();
  };

  const formatSeconds = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecordingNote = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Voice recording is not supported in your browser environment.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioBlob(audioBlob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecordingNote(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start voice recording:', err);
      let msg = 'Could not access microphone for voice recording.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Microphone access was blocked. Please click the site settings icon next to the URL in your browser address bar, set Microphone to "Allow", and refresh the page.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No microphone device was found on your computer. Please plug in a microphone or headset and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Your microphone is currently being used by another application (such as Zoom, Google Meet, Microsoft Teams, or Discord). Please close the other app and try again.';
      }
      alert(msg);
    }
  };

  const stopRecordingNote = () => {
    if (mediaRecorderRef.current && isRecordingNote) {
      mediaRecorderRef.current.stop();
      setIsRecordingNote(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const cancelRecordingNote = () => {
    if (mediaRecorderRef.current && isRecordingNote) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    setIsRecordingNote(false);
    setRecordingSeconds(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const clearRecordedAudio = () => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedAudioBlob(null);
    setRecordedAudioUrl('');
    setRecordingSeconds(0);
  };

  const handleNoteImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const validImages = files.filter(f => f.type.startsWith('image/'));
    if (validImages.length < files.length) {
      alert('Some selected files were skipped because they are not valid image files.');
    }
    if (!validImages.length) return;

    const newPreviews = validImages.map(f => URL.createObjectURL(f));
    setSelectedNoteImageFiles(prev => [...prev, ...validImages]);
    setNoteImagePreviewUrls(prev => [...prev, ...newPreviews]);
    if (noteImageInputRef.current) noteImageInputRef.current.value = '';
  };

  const removeNoteImageAt = (index) => {
    if (noteImagePreviewUrls[index] && noteImagePreviewUrls[index].startsWith('blob:')) {
      URL.revokeObjectURL(noteImagePreviewUrls[index]);
    }
    setSelectedNoteImageFiles(prev => prev.filter((_, i) => i !== index));
    setNoteImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const clearNoteImages = () => {
    noteImagePreviewUrls.forEach(url => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    setSelectedNoteImageFiles([]);
    setNoteImagePreviewUrls([]);
    if (noteImageInputRef.current) noteImageInputRef.current.value = '';
  };

  const handleNoteDocSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSelectedNoteDocFiles(prev => [...prev, ...files]);
    if (noteDocInputRef.current) noteDocInputRef.current.value = '';
  };

  const removeNoteDocAt = (index) => {
    setSelectedNoteDocFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearNoteDocs = () => {
    setSelectedNoteDocFiles([]);
    if (noteDocInputRef.current) noteDocInputRef.current.value = '';
  };

  const handleAddNote = async () => {
    const trimmedText = notes.trim();
    if ((!trimmedText && !recordedAudioBlob && selectedNoteImageFiles.length === 0 && selectedNoteDocFiles.length === 0) || !activeContent || savingNote) return;

    const currentSec = videoRef.current?.currentTime || 0;
    const timeFormatted = `${Math.floor(currentSec / 60)}:${Math.floor(currentSec % 60).toString().padStart(2, '0')}`;

    setSavingNote(true);
    try {
      let uploadedAudioUrl = null;
      if (recordedAudioBlob) {
        const ext = recordedAudioBlob.type.includes('mp4') ? 'mp4' : recordedAudioBlob.type.includes('wav') ? 'wav' : 'webm';
        const audioFile = new File([recordedAudioBlob], `voice-note-${Date.now()}.${ext}`, { type: recordedAudioBlob.type || 'audio/webm' });
        const mediaAsset = await uploadUserMedia(audioFile);
        uploadedAudioUrl = mediaAsset.url || mediaAsset.fileUrl || `/api/v1/media/files/${mediaAsset.id}`;
      }

      let uploadedImageUrl = null;
      if (selectedNoteImageFiles.length > 0) {
        const uploadPromises = selectedNoteImageFiles.map(file => uploadUserMedia(file));
        const mediaAssets = await Promise.all(uploadPromises);
        const urls = mediaAssets.map(asset => asset.url || asset.fileUrl || `/api/v1/media/files/${asset.id}`);
        uploadedImageUrl = urls.join(',');
      }

      let uploadedFileUrl = null;
      let uploadedFileName = null;
      if (selectedNoteDocFiles.length > 0) {
        const uploadPromises = selectedNoteDocFiles.map(file => uploadUserMedia(file));
        const mediaAssets = await Promise.all(uploadPromises);
        const urls = mediaAssets.map(asset => asset.url || asset.fileUrl || `/api/v1/media/files/${asset.id}`);
        const names = mediaAssets.map((asset, i) => asset.filename || selectedNoteDocFiles[i]?.name || 'Document');
        uploadedFileUrl = urls.join(',');
        uploadedFileName = names.join(',');
      }

      let count = 0;
      if (trimmedText) count++;
      if (uploadedAudioUrl) count++;
      if (uploadedImageUrl) count++;
      if (uploadedFileUrl) count++;

      let noteType = 'text';
      if (count > 1) {
        noteType = 'mixed';
      } else if (uploadedImageUrl) {
        noteType = 'image';
      } else if (uploadedFileUrl) {
        noteType = 'file';
      } else if (uploadedAudioUrl) {
        noteType = 'voice';
      }

      const created = await createNote(activeContent.id, {
        text: trimmedText || null,
        audioUrl: uploadedAudioUrl,
        imageUrl: uploadedImageUrl,
        fileUrl: uploadedFileUrl,
        fileName: uploadedFileName,
        noteType: noteType,
        videoTimestampSeconds: currentSec,
        videoTimestamp: timeFormatted
      });
      setNotesList(prev => [...prev, created]);
      setNotes('');
      if (noteTextareaRef.current) {
        noteTextareaRef.current.style.height = 'auto';
      }
      clearRecordedAudio();
      clearNoteImages();
      clearNoteDocs();
    } catch (err) {
      console.error('Error saving note:', err);
      alert(err.response?.data?.error?.message || err.message || 'Failed to save note to database');
    } finally {
      setSavingNote(false);
    }
  };

  const handleStartEdit = (note) => {
    setEditingNoteId(note.id);
    setEditingText(note.text || '');
    setEditingImageUrl(note.imageUrl || '');
    setEditingImageFile(null);
    setEditingImagePreviewUrl(note.imageUrl ? resolveMediaUrl(note.imageUrl) : '');

    setEditingFileUrl(note.fileUrl || '');
    setEditingFileName(note.fileName || '');
    setEditingDocFile(null);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingText('');
    setEditingImageUrl('');
    setEditingImageFile(null);
    if (editingImagePreviewUrl && editingImagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editingImagePreviewUrl);
    }
    setEditingImagePreviewUrl('');
    setEditingFileUrl('');
    setEditingFileName('');
    setEditingDocFile(null);
  };

  const handleEditImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }
    setEditingImageFile(file);
    const preview = URL.createObjectURL(file);
    setEditingImagePreviewUrl(preview);
  };

  const handleRemoveEditImage = () => {
    if (editingImagePreviewUrl && editingImagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editingImagePreviewUrl);
    }
    setEditingImageFile(null);
    setEditingImageUrl('');
    setEditingImagePreviewUrl('');
    if (editImageInputRef.current) editImageInputRef.current.value = '';
  };

  const handleEditDocSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditingDocFile(file);
    setEditingFileName(file.name);
  };

  const handleRemoveEditDoc = () => {
    setEditingDocFile(null);
    setEditingFileUrl('');
    setEditingFileName('');
    if (editDocInputRef.current) editDocInputRef.current.value = '';
  };

  const handleSaveEdit = async (note) => {
    if (savingNote) return;

    setSavingNote(true);
    try {
      let finalImageUrl = editingImageUrl;
      if (editingImageFile) {
        const mediaAsset = await uploadUserMedia(editingImageFile);
        finalImageUrl = mediaAsset.url || mediaAsset.fileUrl || `/api/v1/media/files/${mediaAsset.id}`;
      }

      let finalFileUrl = editingFileUrl;
      let finalFileName = editingFileName;
      if (editingDocFile) {
        const mediaAsset = await uploadUserMedia(editingDocFile);
        finalFileUrl = mediaAsset.url || mediaAsset.fileUrl || `/api/v1/media/files/${mediaAsset.id}`;
        finalFileName = mediaAsset.filename || editingDocFile.name;
      }

      const updated = await updateNote(note.id, {
        text: editingText.trim() || "",
        imageUrl: finalImageUrl || "",
        fileUrl: finalFileUrl || "",
        fileName: finalFileName || ""
      });

      setNotesList(prev => prev.map(n => (n.id === note.id ? updated : n)));
      handleCancelEdit();
    } catch (err) {
      console.error('Failed to update note:', err);
      alert(err.response?.data?.error?.message || err.message || 'Failed to update note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = (noteId) => {
    if (!noteId) return;
    setDeleteConfirmNoteId(noteId);
  };

  const handleConfirmDeleteNote = async () => {
    if (!deleteConfirmNoteId || isDeletingNote) return;
    setIsDeletingNote(true);
    try {
      await deleteNote(deleteConfirmNoteId);
      setNotesList(prev => prev.filter(n => n.id !== deleteConfirmNoteId));
      setDeleteConfirmNoteId(null);
    } catch (err) {
      console.error('Failed to delete note:', err);
    } finally {
      setIsDeletingNote(false);
    }
  };

  const handleSeekToNote = (note) => {
    if (!videoRef.current) return;
    if (note.videoTimestampSeconds != null && !isNaN(note.videoTimestampSeconds)) {
      videoRef.current.currentTime = note.videoTimestampSeconds;
      videoRef.current.play().catch(() => {});
    } else if (note.videoTimestamp) {
      const parts = note.videoTimestamp.split(':');
      if (parts.length === 2) {
        const sec = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        if (!isNaN(sec)) {
          videoRef.current.currentTime = sec;
          videoRef.current.play().catch(() => {});
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="ud-player-shell ud-player-centered">
        <div style={{ textAlign: 'center', color: '#0b1f3a', padding: '24px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px', color: '#5A70D3' }}>
            <i className="fa-solid fa-spinner fa-spin"></i>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0b1f3a' }}>Loading course player...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ud-player-shell ud-player-centered" style={{ padding: '20px', background: '#f4faf7' }}>
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center', background: '#ffffff', padding: '36px 24px', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 12px 30px rgba(11, 31, 58, 0.08)', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px', color: '#ef4444' }}>
            <i className="fa-solid fa-lock"></i>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0b1f3a', marginBottom: '10px' }}>Course Access Restricted</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.5 }}>{error}</p>
          <Link to="/student/courses" className="ot-live-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
            <i className="fa-solid fa-arrow-left"></i>
            <span>Browse Catalog to Enroll</span>
          </Link>
        </div>
      </div>
    );
  }

  const getContentIcon = (type) => {
    switch (type) {
      case 'VIDEO': return <i className="fa-solid fa-play"></i>;
      case 'PDF': return <i className="fa-solid fa-file-pdf"></i>;
      case 'IMAGE': return <i className="fa-solid fa-image"></i>;
      case 'DOWNLOAD': return <i className="fa-solid fa-download"></i>;
      case 'EXTERNAL_LINK': return <i className="fa-solid fa-arrow-up-right-from-square"></i>;
      default: return <i className="fa-solid fa-file-lines"></i>;
    }
  };

  const progressPercent = overallProgressPercent;  return (
    <div className="ot-learn-page">
      <div className="ot-learn-container">
        {/* 2-Column Grid Layout */}
        <div className={`ot-learn-layout ${theaterMode ? 'is-theater' : ''}`}>
          {/* ================================================================
              LEFT MAIN COLUMN: Video + Actions + Tabs + Curriculum Card
              ================================================================ */}
          <main className="ot-learn-main">
            {/* Video Viewport Card */}
            <div
              className={`ot-video-card ${!showControls && isVideoPlaying ? 'controls-hidden' : ''} ${isPortrait ? 'is-portrait' : ''}`}
              onMouseMove={showVideoControls}
              onMouseEnter={showVideoControls}
              onMouseLeave={() => {
                if (isVideoPlaying) {
                  clearTimeout(controlsHideTimer.current);
                  controlsHideTimer.current = setTimeout(() => setShowControls(false), 800);
                }
              }}
              onTouchStart={showVideoControls}
              onClick={() => {
                if (!showControls && isVideoPlaying) {
                  showVideoControls();
                }
              }}
            >
              {!activeContent ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px 20px' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '12px', color: '#5A70D3' }}>
                    <i className="fa-solid fa-video"></i>
                  </div>
                  <h3 style={{ color: '#ffffff', margin: '0 0 6px 0' }}>No lecture content selected</h3>
                  <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}>Select a lesson from the course curriculum to start learning.</p>
                </div>
              ) : (
                <>
                  {/* VIDEO / EXTERNAL VIDEO / YOUTUBE URL */}
                  {(String(activeContent.contentType).toUpperCase() === 'VIDEO' ||
                    !!getYouTubeEmbedUrl(activeContent.mediaReference) ||
                    isDirectVideoUrl(activeContent.mediaReference)) && (
                    getYouTubeEmbedUrl(activeContent.mediaReference) ? (
                      <iframe
                        key={activeContent.id}
                        title={activeContent.title}
                        src={getYouTubeEmbedUrl(activeContent.mediaReference)}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        style={{ width: '100%', height: '100%', border: 'none' }}
                      />
                    ) : (
                      <>
                        {/* Floating Toast Banner (Lock / Quality Alert) */}
                        {toastNotice && (
                          <div className={`ot-video-toast ${typeof toastNotice === 'object' && toastNotice.type === 'info' ? 'is-info' : ''}`}>
                            <i className={typeof toastNotice === 'object' && toastNotice.icon ? toastNotice.icon : "fa-solid fa-lock"}></i>
                            <span>{typeof toastNotice === 'object' ? toastNotice.message : toastNotice}</span>
                          </div>
                        )}

                        <video
                          key={activeContent.id}
                          ref={videoRef}
                          src={getQualityVideoUrl(resolveMediaUrl(activeContent.mediaReference), videoQuality)}
                          playsInline
                          preload="auto"
                          className="ot-video-player"
                          controlsList="nodownload"
                          disablePictureInPicture={false}
                          onContextMenu={(e) => e.preventDefault()}
                          onSeeking={(e) => {
                            updateActiveSubtitle(e.target.currentTime);
                            handleSeeking(e);
                          }}
                          onSeeked={(e) => {
                            const curTime = e.target.currentTime;
                            setVideoCurrentTime(curTime);
                            updateActiveSubtitle(curTime);
                          }}
                          onTimeUpdate={(e) => {
                            const curTime = e.target.currentTime;
                            setVideoCurrentTime(curTime);
                            updateActiveSubtitle(curTime);
                            handleTimeUpdate(e);
                          }}
                          onWaiting={() => setIsVideoBuffering(true)}
                          onPlaying={() => {
                            setIsVideoBuffering(false);
                            setIsVideoPlaying(true);
                          }}
                          onPlay={() => {
                            setIsVideoPlaying(true);
                            setIsVideoBuffering(false);
                            showVideoControls();
                          }}
                          onPause={() => {
                            setIsVideoPlaying(false);
                            setIsVideoBuffering(false);
                            setShowControls(true);
                            clearTimeout(controlsHideTimer.current);
                            if (videoRef.current) handleVideoPause({ target: videoRef.current });
                          }}
                          onEnded={() => {
                            setIsVideoPlaying(false);
                            setIsVideoBuffering(false);
                            setShowControls(true);
                            if (videoRef.current) handleVideoEnded({ target: videoRef.current });
                          }}
                          onError={(e) => {
                            console.warn('Video stream error, falling back to original quality:', e);
                            setIsVideoPlaying(false);
                            setIsVideoBuffering(false);
                            if (videoQuality !== 'high') {
                              setVideoQuality('high');
                              triggerToast({
                                message: 'Switched to original video source for stability',
                                icon: 'fa-solid fa-rotate-right',
                                type: 'info'
                              });
                            }
                          }}
                          onLoadedMetadata={(e) => {
                            const vid = e.target;
                            if (vid.duration && !isNaN(vid.duration)) {
                              setVideoDuration(vid.duration);
                            }
                            if (pendingQualityRestoreRef.current) {
                              const { currentTime: cTime, wasPlaying: wPlay } = pendingQualityRestoreRef.current;
                              pendingQualityRestoreRef.current = null;
                              if (cTime > 0) vid.currentTime = cTime;
                              if (wPlay) {
                                vid.play().catch(() => setIsVideoPlaying(false));
                              }
                            }
                            updateActiveSubtitle(vid.currentTime || 0);
                            handleLoadedMetadata(e);
                          }}
                          onDurationChange={(e) => {
                            if (e.target.duration && !isNaN(e.target.duration)) {
                              setVideoDuration(e.target.duration);
                            }
                          }}
                          onLoadedData={(e) => {
                            if (e.target.duration && !isNaN(e.target.duration)) {
                              setVideoDuration(e.target.duration);
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!showControls && isVideoPlaying) {
                              showVideoControls();
                            } else {
                              handleTogglePlay();
                            }
                          }}
                          onCanPlay={(e) => {
                            const video = e.target;
                            setIsVideoBuffering(false);
                            if (video.duration && !isNaN(video.duration)) {
                              setVideoDuration(video.duration);
                            }
                            if (pendingQualityRestoreRef.current) {
                              const { currentTime: cTime, wasPlaying: wPlay } = pendingQualityRestoreRef.current;
                              pendingQualityRestoreRef.current = null;
                              if (cTime > 0) video.currentTime = cTime;
                              if (wPlay) {
                                video.play().catch(() => setIsVideoPlaying(false));
                              }
                            }
                            const targetPos = contentProgress?.videoPosition || 0;
                            if (targetPos > 0 && !contentProgress?.completed && !hasRestoredRef.current) {
                              if (Math.abs(video.currentTime - targetPos) > 1) {
                                video.currentTime = targetPos;
                              }
                              hasRestoredRef.current = true;
                            }
                            updateActiveSubtitle(video.currentTime || 0);
                          }}
                        />

                        {/* YouTube-Style Closed Captions (Subtitles) */}
                        {subtitlesEnabled && activeSubtitleText && (
                          <div
                            className={`yt-caption-window-bottom ${
                              showControls || !isVideoPlaying
                                ? 'yt-caption-window-bottom--controls-visible'
                                : 'yt-caption-window-bottom--controls-hidden'
                            } ${isFullscreen ? 'yt-caption-fullscreen' : ''}`}
                          >
                            <span className="yt-caption-segment">
                              {activeSubtitleText}
                            </span>
                          </div>
                        )}

                        {/* Subtitle Generating Indicator (YouTube Toast Style) */}
                        {subtitleGenerating && subtitlesEnabled && !activeSubtitleText && (
                          <div
                            className={`yt-caption-window-bottom ${
                              showControls || !isVideoPlaying
                                ? 'yt-caption-window-bottom--controls-visible'
                                : 'yt-caption-window-bottom--controls-hidden'
                            }`}
                          >
                            <span
                              className="yt-caption-segment"
                              style={{
                                fontSize: '0.88rem',
                                color: 'rgba(255, 255, 255, 0.85)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '0.75rem' }}></i>
                              Loading subtitles...
                            </span>
                          </div>
                        )}

                        {/* Top Header Bar Overlay: Back Arrow (Left), CC & Quality (Right) */}
                        <div
                          className={`ot-video-top-bar ${showControls || !isVideoPlaying ? 'visible' : ''}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="ot-video-top-left">
                            <button
                              type="button"
                              className="ot-video-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (document.fullscreenElement) {
                                  if (document.exitFullscreen) document.exitFullscreen();
                                  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                                } else if (window.history.length > 1) {
                                  navigate(-1);
                                } else {
                                  navigate('/student/my-courses');
                                }
                              }}
                              title="Back"
                              aria-label="Back"
                            >
                              <i className="fa-solid fa-arrow-left"></i>
                            </button>
                            {activeContent?.title && (
                              <span className="ot-video-top-title" title={activeContent.title}>
                                {activeContent.title}
                              </span>
                            )}
                          </div>

                          <div className="ot-video-top-right">
                            {/* Subtitles (CC) Toggle Button */}
                            {(String(activeContent?.contentType).toUpperCase() === 'VIDEO' || isDirectVideoUrl(activeContent?.mediaReference)) && (
                              <button
                                type="button"
                                className={`ot-video-icon-btn ${!hasSubtitles ? 'is-disabled' : ''}`}
                                disabled={!hasSubtitles}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!hasSubtitles) return;
                                  handleToggleSubtitles();
                                }}
                                title={
                                  !hasSubtitles
                                    ? (activeContent?.subtitleStatus === 'PROCESSING' || subtitleGenerating
                                        ? 'Subtitles are currently generating...'
                                        : 'Subtitles not available for this video')
                                    : (subtitlesEnabled
                                        ? 'Subtitles (c) - On'
                                        : 'Subtitles (c) - Off')
                                }
                                aria-label={hasSubtitles ? 'Toggle subtitles' : 'Subtitles not available'}
                                aria-disabled={!hasSubtitles}
                              >
                                {activeContent?.subtitleStatus === 'PROCESSING' || subtitleGenerating ? (
                                  <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '0.95rem' }}></i>
                                ) : (
                                  <div className={`ot-yt-top-cc ${hasSubtitles && subtitlesEnabled ? 'is-active' : ''}`}>
                                    <span>CC</span>
                                  </div>
                                )}
                              </button>
                            )}

                            {/* Orientation Mode: Portrait vs Landscape in Top Bar */}
                            <button
                              type="button"
                              className={`ot-video-icon-btn ${isPortrait ? 'is-active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleOrientation();
                              }}
                              title={isPortrait ? 'Switch to Landscape mode (16:9)' : 'Switch to Portrait mode (9:16)'}
                              aria-label={isPortrait ? 'Switch to Landscape mode' : 'Switch to Portrait mode'}
                            >
                              {isPortrait ? (
                                <i className="fa-solid fa-mobile-screen" style={{ transform: 'rotate(90deg)', display: 'inline-block' }} />
                              ) : (
                                <i className="fa-solid fa-mobile-screen" style={{ display: 'inline-block' }} />
                              )}
                            </button>

                            {/* Video Quality / Settings Selector */}
                            <div ref={qualityMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                type="button"
                                className={`ot-video-icon-btn ${showQualityMenu ? 'is-open' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowQualityMenu(p => !p);
                                }}
                                title={`Settings • Quality: ${videoQuality.toUpperCase()}`}
                                aria-label="Settings"
                              >
                                <i className="fa-solid fa-gear"></i>
                                {videoQuality === 'high' && (
                                  <span className="ot-gear-hd-badge">HD</span>
                                )}
                              </button>

                              {showQualityMenu && (
                                <div
                                  className="ot-quality-menu"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="ot-quality-menu-header">
                                    <i className="fa-solid fa-sliders" style={{ fontSize: '0.72rem' }}></i>
                                    <span>Quality</span>
                                  </div>
                                  {VIDEO_QUALITY_OPTIONS.map((opt) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      className={`ot-quality-option-btn ${videoQuality === opt.id ? 'is-active' : ''}`}
                                      onClick={() => handleQualityChange(opt.id)}
                                    >
                                      <span>{opt.label}</span>
                                      {videoQuality === opt.id && (
                                        <i className="fa-solid fa-check"></i>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Center Play Button Overlay when Paused */}
                        {!isVideoPlaying && !isVideoBuffering && (
                          <button
                            type="button"
                            className="ot-video-center-play"
                            onClick={handleTogglePlay}
                            aria-label="Play video"
                          >
                            <i className="fa-solid fa-play"></i>
                          </button>
                        )}

                        {/* Center Buffering Spinner */}
                        {isVideoBuffering && (
                          <div className="ot-video-center-play" style={{ pointerEvents: 'none', background: 'rgba(0, 0, 0, 0.65)' }}>
                            <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#ffffff' }}></i>
                          </div>
                        )}

                        {/* Custom Control Bar */}
                        <div
                          className={`ot-custom-controls ${showControls || !isVideoPlaying ? 'visible' : ''}`}
                          onMouseEnter={() => { clearTimeout(controlsHideTimer.current); setShowControls(true); }}
                          onMouseLeave={() => { if (isVideoPlaying) controlsHideTimer.current = setTimeout(() => setShowControls(false), 1200); }}
                        >
                          {/* Seek Bar with Visual Unwatched Lock Region and Scrubber Ball Knob */}
                          <div
                            ref={seekBarRef}
                            className={`ot-ctrl-seek-bar ${isScrubbing ? 'is-dragging' : ''}`}
                            onMouseDown={handleSeekStart}
                            onTouchStart={handleSeekStart}
                            title={course?.sequentialVideoEnabled !== false ? `Watched: ${formatTime(videoCurrentTime)} / Max allowed: ${formatTime(maxWatchedPosRef.current)}` : "Seek"}
                            style={{ position: 'relative' }}
                          >
                            <div
                              className="ot-ctrl-seek-fill"
                              style={{ width: `${videoDuration ? (videoCurrentTime / videoDuration) * 100 : 0}%` }}
                            ></div>

                            {/* Scrubber Ball Knob */}
                            {videoDuration > 0 && (
                              <div
                                className="ot-ctrl-seek-ball"
                                style={{ left: `${Math.max(0, Math.min(100, (videoCurrentTime / videoDuration) * 100))}%` }}
                              />
                            )}

                            {course?.sequentialVideoEnabled !== false && videoDuration > 0 && maxWatchedPosRef.current < videoDuration && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  bottom: 0,
                                  left: `${(maxWatchedPosRef.current / videoDuration) * 100}%`,
                                  right: 0,
                                  background: 'rgba(239, 68, 68, 0.25)',
                                  backgroundImage: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.35) 0, rgba(239, 68, 68, 0.35) 6px, transparent 6px, transparent 12px)',
                                  pointerEvents: 'none',
                                  borderRadius: '0 4px 4px 0'
                                }}
                              />
                            )}
                          </div>

                          {/* Controls Row */}
                          <div className="ot-ctrl-row">
                            {/* Left: Prev, Play/Pause, Next */}
                            <div className="ot-ctrl-left">
                              <button
                                type="button"
                                className="ot-ctrl-btn"
                                onClick={() => prevLecture && selectContent(prevLecture)}
                                disabled={!prevLecture}
                                title={prevLecture ? `Prev: ${prevLecture.title}` : 'First'}
                              >
                                <i className="fa-solid fa-backward-step"></i>
                              </button>
                              <button
                                type="button"
                                className="ot-ctrl-btn ot-ctrl-play"
                                onClick={handleTogglePlay}
                                title={isVideoPlaying ? 'Pause' : 'Play'}
                              >
                                <i className={`fa-solid ${isVideoPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                              </button>
                              <button
                                type="button"
                                className="ot-ctrl-btn"
                                onClick={() => nextLecture && selectContent(nextLecture)}
                                disabled={!nextLecture}
                                title={nextLecture ? `Next: ${nextLecture.title}` : 'Last'}
                              >
                                <i className="fa-solid fa-forward-step"></i>
                              </button>
                              <span className="ot-ctrl-time">
                                {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
                              </span>
                            </div>

                            {/* Right: Volume, PiP, Auto, Subtitles (CC), Quality, Fullscreen */}
                            <div className="ot-ctrl-right">
                              <button
                                type="button"
                                className="ot-ctrl-btn"
                                onClick={handleMuteToggle}
                                title={videoMuted ? 'Unmute' : 'Mute'}
                              >
                                <i className={`fa-solid ${videoMuted || videoVolume === 0 ? 'fa-volume-xmark' : videoVolume < 0.5 ? 'fa-volume-low' : 'fa-volume-high'}`}></i>
                              </button>
                              <input
                                type="range"
                                className="ot-ctrl-volume"
                                min="0"
                                max="1"
                                step="0.05"
                                value={videoMuted ? 0 : videoVolume}
                                onChange={handleVolumeChange}
                                title="Volume"
                              />
                              <button
                                type="button"
                                className="ot-ctrl-btn ot-ctrl-pip"
                                onClick={handleTogglePiP}
                                title="Picture in Picture"
                              >
                                <i className="fa-regular fa-window-restore"></i>
                              </button>
                              <button
                                type="button"
                                className={`ot-ctrl-btn ${autoPlayNext ? 'ot-ctrl-btn--active' : ''}`}
                                onClick={() => setAutoPlayNext(p => !p)}
                                title={autoPlayNext ? 'Auto-play: ON' : 'Auto-play: OFF'}
                              >
                                <i className="fa-solid fa-forward-fast"></i>
                              </button>

                              {/* Subtitles (CC) in bottom controls bar */}
                              <button
                                type="button"
                                className={`ot-ctrl-btn ${hasSubtitles && subtitlesEnabled ? 'ot-ctrl-btn--active' : ''}`}
                                disabled={!hasSubtitles}
                                onClick={handleToggleSubtitles}
                                title={
                                  !hasSubtitles
                                    ? (activeContent?.subtitleStatus === 'PROCESSING' || subtitleGenerating
                                        ? 'Subtitles are currently generating...'
                                        : 'Subtitles not available for this video')
                                    : (subtitlesEnabled
                                        ? 'Subtitles (c) - On'
                                        : 'Subtitles (c) - Off')
                                }
                                aria-label={hasSubtitles ? 'Toggle subtitles' : 'Subtitles not available'}
                                aria-disabled={!hasSubtitles}
                              >
                                <i className="fa-regular fa-closed-captioning"></i>
                              </button>

                              {/* Orientation Mode: Portrait (9:16) vs Landscape (16:9) */}
                              <button
                                type="button"
                                className={`ot-ctrl-btn ${isPortrait ? 'ot-ctrl-btn--active' : ''}`}
                                onClick={handleToggleOrientation}
                                title={isPortrait ? 'Switch to Landscape mode (16:9)' : 'Switch to Portrait mode (9:16)'}
                                aria-label={isPortrait ? 'Switch to Landscape mode' : 'Switch to Portrait mode'}
                              >
                                {isPortrait ? (
                                  <i className="fa-solid fa-mobile-screen" style={{ transform: 'rotate(90deg)', display: 'inline-block' }} />
                                ) : (
                                  <i className="fa-solid fa-mobile-screen" style={{ display: 'inline-block' }} />
                                )}
                              </button>



                              {/* Fullscreen Button */}
                              <button
                                type="button"
                                className="ot-ctrl-btn"
                                onClick={handleFullscreen}
                                title={isFullscreen ? 'Exit Fullscreen (f)' : 'Fullscreen (f)'}
                              >
                                <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )
                  )}

                  {String(activeContent.contentType).toUpperCase() === 'PDF' && (
                    <iframe
                      key={activeContent.id}
                      title={activeContent.title}
                      src={resolveMediaUrl(activeContent.mediaReference)}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                  )}

                  {String(activeContent.contentType).toUpperCase() === 'IMAGE' && (
                    <img
                      key={activeContent.id}
                      src={resolveMediaUrl(activeContent.mediaReference)}
                      alt={activeContent.title}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: 'auto' }}
                    />
                  )}

                  {(String(activeContent.contentType).toUpperCase() === 'DOWNLOAD' || String(activeContent.contentType).toUpperCase() === 'RESOURCE') && (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#ffffff' }}>
                      <div style={{ fontSize: '3.5rem', marginBottom: '16px', color: '#5A70D3' }}>
                        <i className="fa-solid fa-download"></i>
                      </div>
                      <h3 style={{ marginBottom: '16px', fontSize: '1.4rem' }}>Downloadable File Asset</h3>
                      <a
                        href={resolveMediaUrl(activeContent.mediaReference)}
                        download
                        onClick={handleToggleComplete}
                        className="ot-completed-btn"
                        style={{ textDecoration: 'none' }}
                      >
                        <i className="fa-solid fa-download"></i>
                        <span>Download Resource File</span>
                      </a>
                    </div>
                  )}

                  {(String(activeContent.contentType).toUpperCase() === 'EXTERNAL_LINK' || String(activeContent.contentType).toUpperCase() === 'LINK') &&
                    !getYouTubeEmbedUrl(activeContent.mediaReference) &&
                    !isDirectVideoUrl(activeContent.mediaReference) && (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: '#ffffff' }}>
                      <div style={{ fontSize: '3.5rem', marginBottom: '16px', color: '#5A70D3' }}>
                        <i className="fa-solid fa-link"></i>
                      </div>
                      <h3 style={{ marginBottom: '16px', fontSize: '1.4rem' }}>External Educational Resource</h3>
                      <a
                        href={resolveMediaUrl(activeContent.mediaReference)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={handleToggleComplete}
                        className="ot-completed-btn"
                        style={{ textDecoration: 'none' }}
                      >
                        <span>Open External Resource</span>
                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Action Bar below video */}
            <div className="ot-learn-action-bar">
              <div className="ot-learn-action-info">
                {activeSection && (
                  <span className="ot-lecture-section-pill" style={{ marginBottom: '6px', display: 'inline-flex' }}>
                    <i className="fa-solid fa-layer-group" style={{ fontSize: '0.7rem', marginRight: '4px' }}></i>
                    {activeSection.title}
                  </span>
                )}
                <h2 className="ot-learn-lecture-title" title={activeContent?.title}>
                  {activeContent?.title || 'No lecture selected'}
                </h2>
                <div className="ot-learn-section-subtitle">
                  Lecture {currentLectureIndex + 1} of {allLectures.length}
                  {contentProgress?.completed && (
                    <span style={{ marginLeft: '10px', color: '#5A70D3', fontWeight: 700 }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i>Completed
                    </span>
                  )}
                </div>
              </div>

              {activeContent && (
                <div style={{ display: 'flex', itemsCenter: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {currentAssessmentInfo?.enabled && (
                    <button
                      onClick={handleStartFullWindowAssessment}
                      className={`ot-completed-btn ${currentAssessmentInfo.userStatus?.passed ? 'is-completed' : 'is-incomplete'}`}
                      style={{
                        background: currentAssessmentInfo.userStatus?.passed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(225, 29, 72, 0.15)',
                        borderColor: currentAssessmentInfo.userStatus?.passed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(225, 29, 72, 0.4)',
                        color: currentAssessmentInfo.userStatus?.passed ? '#10b981' : '#f43f5e'
                      }}
                    >
                      <i className={`fa-solid ${currentAssessmentInfo.userStatus?.passed ? 'fa-square-check' : 'fa-list-check'}`}></i>
                      <span>{currentAssessmentInfo.userStatus?.passed ? '✓ Assessment Passed' : 'Take Assessment'}</span>
                    </button>
                  )}

                  <button
                    onClick={handleToggleComplete}
                    className={`ot-completed-btn ${contentProgress?.completed ? 'is-completed' : 'is-incomplete'}`}
                  >
                    <i className={`fa-solid ${contentProgress?.completed ? 'fa-check-circle' : 'fa-circle-check'}`}></i>
                    <span>{contentProgress?.completed ? 'Completed' : 'Mark Complete'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Assessment Requirement Alert Banner */}
            {currentAssessmentInfo?.enabled && currentAssessmentInfo?.required && !currentAssessmentInfo?.userStatus?.passed && (
              <div style={{
                background: 'rgba(225, 29, 72, 0.1)',
                border: '1px solid rgba(225, 29, 72, 0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: '12px 16px',
                margin: '12px 0',
                display: 'flex',
                alignItems: 'center',
                justifySpace: 'between',
                flexWrap: 'wrap',
                gap: '12px',
                color: '#f43f5e',
                fontSize: '0.88rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-lock" style={{ fontSize: '1rem' }}></i>
                  <span><strong>Assessment Required:</strong> You must successfully complete the lesson assessment to unlock the next lesson.</span>
                </div>
                <button
                  onClick={handleStartFullWindowAssessment}
                  style={{
                    background: '#e11d48',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)'
                  }}
                >
                  Start Assessment Now ➔
                </button>
              </div>
            )}

            {/* Tabs Bar below Video */}
            <div className="ot-learn-tabs">
              <button
                className={`ot-learn-tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <i className="fa-regular fa-file-lines"></i>
                <span>Overview</span>
              </button>
              <button
                className={`ot-learn-tab ${activeTab === 'curriculum' ? 'active' : ''}`}
                onClick={() => setActiveTab('curriculum')}
              >
                <i className="fa-solid fa-list"></i>
                <span>Curriculum</span>
              </button>
              <button
                className={`ot-learn-tab ${activeTab === 'notes' ? 'active' : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                <i className="fa-regular fa-note-sticky"></i>
                <span>Notes</span>
              </button>
              <button
                className={`ot-learn-tab ${activeTab === 'community' ? 'active' : ''}`}
                onClick={handleOpenCommunityTab}
              >
                <i className="fa-solid fa-user-group"></i>
                <span>Community</span>
                {communityUnreadCount > 0 && <span className="ot-tab-badge">{communityUnreadCount}</span>}
              </button>
              <button
                className={`ot-learn-tab ${activeTab === 'resources' ? 'active' : ''}`}
                onClick={() => setActiveTab('resources')}
              >
                <i className="fa-solid fa-paperclip"></i>
                <span>Resources</span>
                {lectureResources.length > 0 && <span className="ot-tab-badge">{lectureResources.length}</span>}
              </button>
              {currentAssessmentInfo?.enabled && (
                <button
                  className={`ot-learn-tab ${activeTab === 'assessment' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('assessment');
                    handleStartFullWindowAssessment();
                  }}
                >
                  <i className="fa-solid fa-list-check"></i>
                  <span>
                    Assessment
                    {currentAssessmentInfo.required && !currentAssessmentInfo.userStatus?.passed && (
                      <span
                        style={{
                          color: '#dc2626',
                          fontWeight: 800,
                          fontSize: '1rem',
                          marginLeft: '3px',
                          lineHeight: 1
                        }}
                        title="Assessment Required"
                      >
                        *
                      </span>
                    )}
                  </span>
                  {currentAssessmentInfo.userStatus?.passed && (
                    <span className="ot-tab-badge" style={{ background: '#10b981' }}>
                      ✓ Passed
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Tab Content Panel */}
            <div className="ot-learn-tab-content-wrap">
              {activeTab === 'assessment' && activeContent && (
                <div className="ot-curriculum-panel-card" style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: currentAssessmentInfo?.userStatus?.passed ? 'rgba(90, 112, 211, 0.08)' : '#fff1f2', color: currentAssessmentInfo?.userStatus?.passed ? '#5A70D3' : '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 16px auto' }}>
                    <i className={`fa-solid ${currentAssessmentInfo?.userStatus?.passed ? 'fa-award' : 'fa-list-check'}`} />
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0b1f3a', margin: '0 0 8px 0' }}>
                    {activeContent.title} — Lesson Assessment
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto 24px auto', lineHeight: 1.6 }}>
                    {currentAssessmentInfo?.userStatus?.passed
                      ? 'You have successfully passed this assessment! You can retake it anytime.'
                      : 'Test your knowledge on this lesson to mark progress.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleStartFullWindowAssessment}
                    style={{
                      background: currentAssessmentInfo?.userStatus?.passed ? '#5A70D3' : '#e11d48',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 28px',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      boxShadow: currentAssessmentInfo?.userStatus?.passed ? '0 4px 14px rgba(90, 112, 211, 0.3)' : '0 4px 14px rgba(225, 29, 72, 0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <i className={`fa-solid ${currentAssessmentInfo?.userStatus?.passed ? 'fa-rotate-right' : 'fa-play'}`} />
                    <span>{currentAssessmentInfo?.userStatus?.passed ? 'Retake Assessment' : 'Take Assessment'}</span>
                  </button>
                </div>
              )}
              {(activeTab === 'curriculum' || activeTab === 'videos') && (
                <div className="ot-curriculum-panel-card">
                  <div
                    className="ot-curriculum-panel-header"
                    onClick={() => setCurriculumExpanded(prev => !prev)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div>
                      <h3 className="ot-curriculum-panel-title">Course Videos & Curriculum</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                        <p className="ot-curriculum-panel-subtitle" style={{ margin: 0 }}>Follow the modules in order to complete the course</p>
                        {totalCourseDurationText && (
                          <span className="ot-curriculum-total-time">
                            <i className="fa-regular fa-clock" style={{ marginRight: '4px', fontSize: '11px' }}></i>
                            {totalCourseDurationText}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="ot-progress-badge">
                        <i className="fa-solid fa-trophy" style={{ color: '#f59e0b' }}></i>
                        <span>{progressPercent}% Completed</span>
                      </div>
                      <i className={`fa-solid fa-chevron-${curriculumExpanded ? 'up' : 'down'}`} style={{ color: '#64748b' }}></i>
                    </div>
                  </div>

                  {/* Visual Progress Track */}
                  <div className="ot-curriculum-progress-track">
                    <div className="ot-curriculum-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                  </div>

                  {curriculumExpanded && (
                    <div className="ud-videos-sections-list">
                      {sections.map((sec, sIdx) => {
                        const secContents = contentsBySection[sec.id] || [];
                        const isExpanded = expandedSections[sec.id] !== false;

                        return (
                          <div key={sec.id} className="ud-videos-section-card">
                            <button
                              type="button"
                              className="ud-videos-section-header-btn"
                              onClick={() => toggleSection(sec.id)}
                            >
                              <div className="ud-videos-section-title-wrap">
                                <i className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} ud-accordion-chevron`}></i>
                                <span className="ud-videos-section-badge">Section {sIdx + 1}</span>
                                <span className="ud-videos-section-title">{sec.title}</span>
                              </div>
                              <span className="ud-videos-section-count">
                                {secContents.length} {secContents.length === 1 ? 'lecture' : 'lectures'}
                                {(() => {
                                  const secDurTotal = secContents.reduce((sum, c) => {
                                    const d = (c.id === activeContent?.id && videoDuration > 0)
                                      ? Math.round(videoDuration)
                                      : (lectureDurations[c.id] || 0);
                                    return sum + d;
                                  }, 0);
                                  const text = secDurTotal > 0 ? formatDurationHuman(secDurTotal) : null;
                                  return text ? ` • ${text}` : '';
                                })()}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="ud-videos-lectures-group">
                                {secContents.map((content, lIdx) => {
                                  const isActive = activeContent?.id === content.id;
                                  const prog = (content.id === activeContent?.id) ? contentProgress : contentsProgressMap[content.id];
                                  const isComplete = Boolean(prog?.completed);

                                  return (
                                    <div
                                      key={content.id}
                                      className={`ud-video-item-row ${isActive ? 'active' : ''}`}
                                      onClick={() => {
                                        selectContent(content);
                                        if (window.innerWidth <= 768 && videoRef.current) {
                                          videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                        }
                                      }}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => e.key === 'Enter' && selectContent(content)}
                                    >
                                      <div className="ud-video-item-left">
                                        <div className={`ud-video-item-status-icon ${isActive ? 'playing' : isComplete ? 'completed' : ''}`}>
                                          {isActive ? (
                                            <i className="fa-solid fa-play"></i>
                                          ) : isComplete ? (
                                            <i className="fa-solid fa-check"></i>
                                          ) : (
                                            <span>{lIdx + 1}</span>
                                          )}
                                        </div>

                                        <div className="ud-video-item-content">
                                          <div className="ud-video-item-title-row">
                                            <span className="ud-video-item-title">{content.title}</span>
                                            {isActive && <span className="ud-playing-badge">Now Playing</span>}
                                            {isComplete && <span className="ud-completed-badge">✓ Done</span>}
                                          </div>

                                          <div className="ud-video-item-sub">
                                            <span className="ud-video-type-info">
                                              {getContentIcon(content.contentType)}
                                              <span>{content.contentType || 'VIDEO'}</span>
                                            </span>
                                            {(() => {
                                              const durSec = (isActive && videoDuration > 0)
                                                ? Math.round(videoDuration)
                                                : (lectureDurations[content.id] || 0);
                                              const durText = durSec > 0 ? formatTime(durSec) : null;
                                              if (!durText) return null;
                                              return (
                                                <>
                                                  <span className="ud-video-meta-dot">•</span>
                                                  <span className="ud-video-duration-info">
                                                    <i className="fa-regular fa-clock" style={{ fontSize: '10px' }}></i>
                                                    <span>{durText}</span>
                                                  </span>
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="ud-video-item-right">
                                        <button
                                          type="button"
                                          className={`ud-video-action-play ${isActive ? 'active' : ''}`}
                                          aria-label={`Play ${content.title}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            selectContent(content);
                                            if (window.innerWidth <= 768 && videoRef.current) {
                                              videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                            }
                                          }}
                                        >
                                          {isActive ? (
                                            <>
                                              <i className="fa-solid fa-volume-high"></i>
                                              <span>Playing</span>
                                            </>
                                          ) : (
                                            <>
                                              <i className="fa-solid fa-play"></i>
                                              <span>Play</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'overview' && (
                <div className="ot-curriculum-panel-card">
                  <h2 className="ud-player-overview-title">
                    {activeContent?.title || course?.name}
                  </h2>
                  <div className="ud-player-overview-meta">
                    <span>Instructor: <strong style={{ color: '#0b1f3a' }}>OneTutor Academy</strong></span>
                    <span>Category: <strong style={{ color: '#0b1f3a' }}>{course?.categoryName || 'General'}</strong></span>
                  </div>
                  {activeContent?.description ? (
                    <div className="ud-player-overview-desc">
                      {activeContent.description}
                    </div>
                  ) : (
                    <div className="ud-player-overview-desc" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                      {course?.description || 'No overview provided for this video. The instructor has not added an overview yet.'}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="ot-curriculum-panel-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0b1f3a', margin: 0 }}>
                      Downloadable Lecture Resources
                    </h3>
                    {lectureResources.length > 1 && (
                      <button
                        type="button"
                        onClick={handleSidebarDownloadResources}
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#5A70D3',
                          background: 'rgba(90, 112, 211, 0.08)',
                          border: '1px solid rgba(90, 112, 211, 0.25)',
                          borderRadius: '8px',
                          padding: '6px 14px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="fa-solid fa-download"></i>
                        <span>Download All ({lectureResources.length})</span>
                      </button>
                    )}
                  </div>
                  {lectureResources.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No attached resource files for this lecture.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {lectureResources.map((r) => (
                        <div
                          key={r.id}
                          className="ud-player-resource-card"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: '#f8fafc',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            gap: '12px'
                          }}
                        >
                          <span className="ud-player-resource-name" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, color: '#1e293b', fontSize: '0.92rem' }}>
                            <i className="fa-solid fa-paperclip" style={{ color: '#5A70D3' }}></i>
                            <span>{r.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              triggerToast(`Downloading "${r.name}"...`);
                              handleDownloadFile(r.url, r.name);
                            }}
                            className="ud-player-resource-dl"
                            style={{
                              background: '#5A70D3',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '7px 16px',
                              fontSize: '0.84rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 6px rgba(90, 112, 211, 0.25)'
                            }}
                          >
                            <i className="fa-solid fa-download"></i>
                            <span>Download</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="ot-curriculum-panel-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0b1f3a', margin: 0 }}>
                        My Notes
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0 0' }}>
                        Stored securely in database • Linked to: <strong>{activeContent?.title || 'this video'}</strong>
                      </p>
                    </div>
                    {notesList.length > 0 && (
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#5A70D3', background: 'rgba(90, 112, 211, 0.08)', padding: '4px 12px', borderRadius: '9999px', border: '1px solid rgba(90, 112, 211, 0.2)' }}>
                        {notesList.length} note{notesList.length !== 1 ? 's' : ''} saved
                      </span>
                    )}
                  </div>

                  {/* Hidden File Inputs for Photo & Document Attachments */}
                  <input
                    type="file"
                    ref={noteImageInputRef}
                    accept="image/*"
                    multiple
                    onChange={handleNoteImageSelect}
                    style={{ display: 'none' }}
                  />
                  <input
                    type="file"
                    ref={noteDocInputRef}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    multiple
                    onChange={handleNoteDocSelect}
                    style={{ display: 'none' }}
                  />
                  {/* Note Input Bar */}
                  <div style={{ marginTop: '16px', marginBottom: '20px', width: '100%', boxSizing: 'border-box' }}>
                    {/* Attachment Previews Strip */}
                    {(noteImagePreviewUrls.length > 0 || selectedNoteDocFiles.length > 0 || recordedAudioUrl || isRecordingNote) && (
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px', padding: '10px 14px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
                        {isRecordingNote && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fca5a5', padding: '6px 14px', borderRadius: '20px', color: '#dc2626', fontSize: '0.84rem', fontWeight: 700 }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                            <span>Recording Voice Note: {formatSeconds(recordingSeconds)}</span>
                            <button type="button" onClick={cancelRecordingNote} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', marginLeft: '6px', fontSize: '0.85rem' }} title="Cancel recording">
                              <i className="fa-solid fa-xmark" />
                            </button>
                          </div>
                        )}
                        {recordedAudioUrl && !isRecordingNote && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 14px', borderRadius: '20px' }}>
                            <i className="fa-solid fa-microphone" style={{ color: '#059669', fontSize: '0.95rem' }} />
                            <audio src={recordedAudioUrl} controls style={{ height: '30px', width: '180px' }} />
                            <button type="button" onClick={clearRecordedAudio} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Discard voice recording">
                              <i className="fa-solid fa-trash-can" />
                            </button>
                          </div>
                        )}
                        {noteImagePreviewUrls.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {noteImagePreviewUrls.map((url, idx) => (
                              <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                                <img
                                  src={url}
                                  alt={`Creation Photo ${idx + 1}`}
                                  onClick={() => openInAppPreview(url, `Creation Photo ${idx + 1}`, true, noteImagePreviewUrls, idx)}
                                  style={{ width: '60px', height: '52px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                                  title="Click to preview creation photo full-screen"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeNoteImageAt(idx)}
                                  title="Remove photo"
                                  style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                >
                                  <i className="fa-solid fa-xmark" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => noteImageInputRef.current?.click()}
                              title="Add more photos"
                              style={{ width: '52px', height: '52px', borderRadius: '10px', border: '1px dashed #5A70D3', background: 'rgba(90, 112, 211, 0.05)', color: '#5A70D3', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', fontSize: '0.75rem', fontWeight: 700 }}
                            >
                              <i className="fa-solid fa-plus" style={{ fontSize: '0.9rem' }} />
                              <span>Add</span>
                            </button>
                          </div>
                        )}
                        {selectedNoteDocFiles.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {selectedNoteDocFiles.map((file, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '6px 14px', borderRadius: '20px' }}>
                                <i className="fa-solid fa-paperclip" style={{ color: '#2563eb', fontSize: '0.95rem' }} />
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e40af', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {file.name}
                                </span>
                                <button type="button" onClick={() => removeNoteDocAt(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Remove document">
                                  <i className="fa-solid fa-trash-can" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Modern Prompt Input Card (ChatGPT / Antigravity Style) */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%',
                        maxWidth: '100%',
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '18px',
                        padding: '14px 14px 10px 16px',
                        boxShadow: '0 3px 12px rgba(11, 31, 58, 0.05)',
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                        boxSizing: 'border-box'
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#5A70D3'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90, 112, 211, 0.12)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(11, 31, 58, 0.05)'; }}
                    >
                      {/* Top Multiline Text Area */}
                      <textarea
                        ref={noteTextareaRef}
                        rows={2}
                        placeholder={isRecordingNote ? "Recording voice note..." : "Message / Type a note..."}
                        value={notes}
                        onChange={e => {
                          setNotes(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${Math.min(e.target.scrollHeight, 130)}px`;
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddNote();
                          }
                        }}
                        disabled={savingNote || isRecordingNote}
                        style={{
                          width: '100%',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          fontSize: '0.95rem',
                          color: '#0b1f3a',
                          fontFamily: 'inherit',
                          padding: 0,
                          resize: 'none',
                          lineHeight: '1.5',
                          minHeight: '46px',
                          maxHeight: '130px',
                          height: 'auto',
                          overflowY: 'auto',
                          boxSizing: 'border-box'
                        }}
                      />

                      {/* Bottom Action Bar Row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '10px',
                          paddingTop: '6px',
                          borderTop: '1px solid #f1f5f9'
                        }}
                      >
                        {/* Left Action Buttons (Attachments) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Paperclip Button */}
                          <button
                            type="button"
                            onClick={() => noteDocInputRef.current?.click()}
                            disabled={savingNote || isRecordingNote}
                            title="Attach File (PDF/Word)"
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              background: selectedNoteDocFiles.length > 0 ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                              border: 'none',
                              color: selectedNoteDocFiles.length > 0 ? '#2563eb' : '#64748b',
                              fontSize: '1.05rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(90, 112, 211, 0.08)'; e.currentTarget.style.color = '#5A70D3'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = selectedNoteDocFiles.length > 0 ? 'rgba(37, 99, 235, 0.1)' : 'transparent'; e.currentTarget.style.color = selectedNoteDocFiles.length > 0 ? '#2563eb' : '#64748b'; }}
                          >
                            <i className="fa-solid fa-paperclip" />
                          </button>

                          {/* Camera Button */}
                          <button
                            type="button"
                            onClick={() => noteImageInputRef.current?.click()}
                            disabled={savingNote || isRecordingNote}
                            title="Add Photo / Image"
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '8px',
                              background: noteImagePreviewUrls.length > 0 ? 'rgba(90, 112, 211, 0.1)' : 'transparent',
                              border: 'none',
                              color: noteImagePreviewUrls.length > 0 ? '#5A70D3' : '#64748b',
                              fontSize: '1.05rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(90, 112, 211, 0.08)'; e.currentTarget.style.color = '#5A70D3'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = noteImagePreviewUrls.length > 0 ? 'rgba(90, 112, 211, 0.1)' : 'transparent'; e.currentTarget.style.color = noteImagePreviewUrls.length > 0 ? '#5A70D3' : '#64748b'; }}
                          >
                            <i className="fa-solid fa-camera" />
                          </button>
                        </div>

                        {/* Right Action Buttons (Mic + Primary Send Arrow) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* Mic Icon Button */}
                          <button
                            type="button"
                            onClick={isRecordingNote ? stopRecordingNote : startRecordingNote}
                            disabled={savingNote}
                            title={isRecordingNote ? "Stop Voice Recording" : "Record Voice Note"}
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background: isRecordingNote ? 'rgba(220, 38, 38, 0.1)' : 'transparent',
                              border: 'none',
                              color: isRecordingNote ? '#dc2626' : '#64748b',
                              fontSize: '1.05rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = isRecordingNote ? 'rgba(220, 38, 38, 0.15)' : 'rgba(90, 112, 211, 0.08)'; e.currentTarget.style.color = isRecordingNote ? '#dc2626' : '#5A70D3'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = isRecordingNote ? 'rgba(220, 38, 38, 0.1)' : 'transparent'; e.currentTarget.style.color = isRecordingNote ? '#dc2626' : '#64748b'; }}
                          >
                            <i className={`fa-solid ${isRecordingNote ? 'fa-square' : 'fa-microphone'}`} />
                          </button>

                          {/* Primary Circular Send Button with Right Arrow */}
                          <button
                            type="button"
                            onClick={handleAddNote}
                            disabled={savingNote || (!notes.trim() && !recordedAudioBlob && selectedNoteImageFiles.length === 0 && selectedNoteDocFiles.length === 0 && !isRecordingNote)}
                            title="Send / Save Note"
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: (!notes.trim() && !recordedAudioBlob && selectedNoteImageFiles.length === 0 && selectedNoteDocFiles.length === 0 && !isRecordingNote) ? '#cbd5e1' : '#5A70D3',
                              color: '#ffffff',
                              border: 'none',
                              cursor: (!notes.trim() && !recordedAudioBlob && selectedNoteImageFiles.length === 0 && selectedNoteDocFiles.length === 0 && !isRecordingNote) ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.95rem',
                              boxShadow: (!notes.trim() && !recordedAudioBlob && selectedNoteImageFiles.length === 0 && selectedNoteDocFiles.length === 0 && !isRecordingNote) ? 'none' : '0 3px 10px rgba(90, 112, 211, 0.3)',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                              if (notes.trim() || recordedAudioBlob || selectedNoteImageFiles.length > 0 || selectedNoteDocFiles.length > 0 || isRecordingNote) {
                                e.currentTarget.style.transform = 'scale(1.06)';
                              }
                            }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            {savingNote ? (
                              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '0.9rem', color: '#ffffff' }} />
                            ) : (
                              <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.95rem', color: '#ffffff' }} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes List */}
                  {notesLoading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px', color: '#5A70D3' }} />
                      <span>Loading notes from database...</span>
                    </div>
                  ) : notesList.length === 0 ? (
                    <div style={{ padding: '36px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                      <div style={{ fontSize: '2rem', color: '#5A70D3', marginBottom: '8px' }}>
                        <i className="fa-regular fa-note-sticky" />
                      </div>
                      <p style={{ margin: 0, fontWeight: 800, color: '#0b1f3a', fontSize: '0.95rem' }}>
                        No notes for this lecture yet
                      </p>
                      <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '0.84rem' }}>
                        Type notes, record voice notes, or attach photos/PDFs while watching. Your notes will be saved permanently.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        const allLectureMedia = notesList.flatMap((noteItem) => {
                          const imgs = (noteItem.imageUrl || '').split(',').map(s => s.trim()).filter(Boolean).map((u, i) => ({
                            url: u,
                            name: noteItem.fileName || `Photo ${i + 1}`,
                            isImage: true,
                            type: 'image',
                            noteId: noteItem.id
                          }));
                          const docs = (noteItem.fileUrl || '').split(',').map(s => s.trim()).filter(Boolean);
                          const docNames = (noteItem.fileName || '').split(',').map(s => s.trim()).filter(Boolean);
                          const docObjs = docs.map((u, i) => {
                            const dName = docNames[i] || (docs.length > 1 ? `Document ${i + 1}` : 'Attached Document');
                            const cleanStr = (dName || u).split('?')[0].toLowerCase();
                            let type = 'other';
                            if (cleanStr.includes('.pdf')) type = 'pdf';
                            else if (cleanStr.includes('.docx')) type = 'docx';
                            else if (/\.(txt|json|csv|md)/i.test(cleanStr)) type = 'text';
                            return {
                              url: u,
                              name: dName,
                              isImage: false,
                              type,
                              noteId: noteItem.id
                            };
                          });
                          return [...imgs, ...docObjs];
                        });

                        return notesList.map((n) => {
                          const isEditing = editingNoteId === n.id;
                          const timeDisplay = n.videoTimestamp || n.timestamp || '0:00';
                          const mediaCount = (n.text ? 1 : 0) + (n.audioUrl ? 1 : 0) + (n.imageUrl ? 1 : 0) + (n.fileUrl ? 1 : 0);

                          return (
                            <div
                              key={n.id || n.createdAt}
                              style={{
                                padding: '16px 20px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '14px',
                                background: '#ffffff',
                                position: 'relative',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 8px rgba(11, 31, 58, 0.02)',
                              }}
                            >
                              {/* Note Header */}
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => handleSeekToNote(n)}
                                  title={`Jump to ${timeDisplay} in video`}
                                  style={{
                                    background: '#5A70D3',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '9999px',
                                    padding: '4px 10px',
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    transition: 'opacity 0.2s ease',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                >
                                  <i className="fa-solid fa-play" style={{ fontSize: '8px' }} />
                                  <span>{timeDisplay}</span>
                                </button>

                                {mediaCount > 1 || n.noteType === 'mixed' ? (
                                  <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <i className="fa-solid fa-layer-group" /> Multi-Media Note
                                  </span>
                                ) : n.noteType === 'voice' || (n.audioUrl && !n.text) ? (
                                  <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <i className="fa-solid fa-microphone" /> Voice Note
                                  </span>
                                ) : n.noteType === 'image' || (n.imageUrl && !n.text) ? (
                                  <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <i className="fa-solid fa-image" /> Photo Note
                                  </span>
                                ) : n.noteType === 'file' || (n.fileUrl && !n.text) ? (
                                  <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <i className="fa-solid fa-paperclip" /> Document Note
                                  </span>
                                ) : (
                                  <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <i className="fa-regular fa-file-lines" /> Text Note
                                  </span>
                                )}

                                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#5A70D3' }}>
                                  {n.lectureTitle || activeContent?.title || 'Lecture'}
                                </span>

                                {n.createdAt && (
                                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '4px' }}>
                                    {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}

                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {!isEditing && (
                                    <button
                                      onClick={() => handleStartEdit(n)}
                                      title="Edit note"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#64748b',
                                        fontSize: '0.85rem',
                                        padding: '4px 6px',
                                        borderRadius: '4px',
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.color = '#5A70D3'}
                                      onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                                    >
                                      <i className="fa-solid fa-pen-to-square" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteNote(n.id)}
                                    title="Delete note"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: '#64748b',
                                      fontSize: '0.85rem',
                                      padding: '4px 6px',
                                      borderRadius: '4px',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                                  >
                                    <i className="fa-solid fa-trash" />
                                  </button>
                                </div>
                              </div>

                              {/* Audio Player if Voice Note */}
                              {n.audioUrl && (
                                <div style={{ marginTop: '10px', background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="fa-solid fa-volume-high" style={{ color: '#5A70D3' }} />
                                    <span>Voice Recording</span>
                                  </div>
                                  <audio controls src={resolveMediaUrl(n.audioUrl)} style={{ width: '100%', height: '36px', outline: 'none' }} />
                                </div>
                              )}

                              {/* Photo / Image Preview Grid & Document Files */}
                              {(() => {
                                const noteImages = (n.imageUrl || '').split(',').map(s => s.trim()).filter(Boolean).map((u, i) => ({
                                  url: u,
                                  name: `Photo ${i + 1}`,
                                  isImage: true,
                                  type: 'image'
                                }));

                                const docUrls = (n.fileUrl || '').split(',').map(s => s.trim()).filter(Boolean);
                                const docNames = (n.fileName || '').split(',').map(s => s.trim()).filter(Boolean);
                                const noteDocs = docUrls.map((u, i) => {
                                  const name = docNames[i] || (docUrls.length > 1 ? `Document ${i + 1}` : 'Attached Document');
                                  const cleanStr = (name || u).split('?')[0].toLowerCase();
                                  let type = 'other';
                                  if (cleanStr.includes('.pdf')) type = 'pdf';
                                  else if (cleanStr.includes('.docx')) type = 'docx';
                                  else if (/\.(txt|json|csv|md)/i.test(cleanStr)) type = 'text';
                                  return {
                                    url: u,
                                    name,
                                    isImage: false,
                                    type
                                  };
                                });

                                return (
                                  <>
                                    {/* Photo Attachment View */}
                                    {noteImages.length > 0 && (
                                      noteImages.length === 1 ? (
                                        <div style={{ marginTop: '10px' }}>
                                          <div
                                            onClick={() => {
                                              const startIdx = Math.max(0, allLectureMedia.findIndex(m => m.url === noteImages[0].url));
                                              openInAppPreview(noteImages[0].url, n.fileName || 'Photo Note', true, allLectureMedia, startIdx);
                                            }}
                                            title="Click to view photo full-screen"
                                            style={{ cursor: 'pointer', display: 'inline-block' }}
                                          >
                                            <img
                                              src={resolveMediaUrl(noteImages[0].url)}
                                              alt="Note photo"
                                              style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px', objectFit: 'contain', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'transform 0.15s ease' }}
                                              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)'; }}
                                              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                            />
                                          </div>
                                        </div>
                                      ) : (
                                        <div style={{ marginTop: '10px', maxWidth: '440px' }}>
                                          <div style={{ display: 'grid', gridTemplateColumns: noteImages.slice(0, 4).length === 2 ? '1fr 1fr' : '1fr 1fr', gap: '6px', borderRadius: '12px', overflow: 'hidden' }}>
                                            {noteImages.slice(0, 4).map((imgObj, idx) => (
                                              <div
                                                key={idx}
                                                onClick={() => {
                                                  const startIdx = Math.max(0, allLectureMedia.findIndex(m => m.url === imgObj.url));
                                                  openInAppPreview(imgObj.url, `Photo ${idx + 1} of ${noteImages.length}`, true, allLectureMedia, startIdx);
                                                }}
                                                style={{ position: 'relative', height: noteImages.slice(0, 4).length === 2 ? '160px' : '120px', cursor: 'pointer', overflow: 'hidden', background: '#0b141a' }}
                                              >
                                                <img
                                                  src={resolveMediaUrl(imgObj.url)}
                                                  alt={`Photo ${idx + 1}`}
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s ease' }}
                                                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
                                                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                                />
                                                {idx === 3 && (noteImages.length - 4) > 0 && (
                                                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(11, 20, 26, 0.72)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, backdropFilter: 'blur(2px)' }}>
                                                    +{(noteImages.length - 4) + 1}
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <i className="fa-solid fa-images" style={{ color: '#5A70D3' }} />
                                            <span>{noteImages.length} photos attached • Click to view gallery</span>
                                          </div>
                                        </div>
                                      )
                                    )}

                                    {/* Document File Attachments View */}
                                    {noteDocs.length > 0 && noteDocs.map((docObj, dIdx) => (
                                      <div key={dIdx} style={{ marginTop: '10px', background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontSize: '1.1rem', flexShrink: 0 }}>
                                            <i className={getDocIconClass(docObj.name || docObj.url)} />
                                          </div>
                                          <div style={{ overflow: 'hidden' }}>
                                            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0b1f3a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                              {docObj.name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Attached Document</div>
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const startIdx = Math.max(0, allLectureMedia.findIndex(m => m.url === docObj.url));
                                              openInAppPreview(docObj.url, docObj.name, false, allLectureMedia, startIdx);
                                            }}
                                            style={{
                                              background: '#ffffff',
                                              color: '#5A70D3',
                                              border: '1.5px solid #5A70D3',
                                              padding: '5px 12px',
                                              borderRadius: '8px',
                                              fontSize: '0.8rem',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '5px',
                                              transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(90, 112, 211, 0.08)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; }}
                                          >
                                            <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.78rem' }} />
                                            <span>Open</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDownloadFile(docObj.url, docObj.name)}
                                            style={{
                                              background: '#5A70D3',
                                              color: '#FFFFFF',
                                              border: 'none',
                                              padding: '6px 14px',
                                              borderRadius: '8px',
                                              fontSize: '0.8rem',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                              boxShadow: '0 2px 6px rgba(90, 112, 211, 0.2)',
                                              transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                                          >
                                            <i className="fa-solid fa-download" />
                                            <span>Download</span>
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </>
                                );
                              })()}

                            {/* Note Content / Edit Box */}
                            {isEditing ? (
                              <div style={{ marginTop: '10px', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1.5px solid #5A70D3' }}>
                                {/* Hidden inputs for editing attachments */}
                                <input
                                  type="file"
                                  ref={editImageInputRef}
                                  accept="image/*"
                                  onChange={handleEditImageSelect}
                                  style={{ display: 'none' }}
                                />
                                <input
                                  type="file"
                                  ref={editDocInputRef}
                                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                  onChange={handleEditDocSelect}
                                  style={{ display: 'none' }}
                                />

                                <textarea
                                  value={editingText}
                                  onChange={e => setEditingText(e.target.value)}
                                  placeholder="Edit note text..."
                                  rows={3}
                                  style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    boxSizing: 'border-box',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    background: '#ffffff'
                                  }}
                                />

                                {/* Photo attachment editor */}
                                <div style={{ marginTop: '12px' }}>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                                    Photo Attachment:
                                  </div>
                                  {editingImagePreviewUrl ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                      <img
                                        src={editingImagePreviewUrl}
                                        alt="Note photo"
                                        style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => editImageInputRef.current?.click()}
                                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', color: '#0b1f3a', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                      >
                                        <i className="fa-solid fa-arrows-rotate" style={{ color: '#0284c7' }} /> Change Photo
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleRemoveEditImage}
                                        style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                      >
                                        <i className="fa-solid fa-trash-can" /> Remove Photo
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => editImageInputRef.current?.click()}
                                      style={{ background: '#ffffff', border: '1px dashed #0284c7', color: '#0284c7', borderRadius: '8px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                      <i className="fa-solid fa-image" /> Add Photo to Note
                                    </button>
                                  )}
                                </div>

                                {/* Document attachment editor */}
                                <div style={{ marginTop: '12px' }}>
                                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                                    Document Attachment:
                                  </div>
                                  {editingFileName || editingFileUrl ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#1e40af' }}>
                                        <i className="fa-solid fa-file-lines" />
                                        <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {editingFileName || 'Attached Document'}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => editDocInputRef.current?.click()}
                                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', color: '#0b1f3a', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                      >
                                        <i className="fa-solid fa-arrows-rotate" style={{ color: '#2563eb' }} /> Change File
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleRemoveEditDoc}
                                        style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                      >
                                        <i className="fa-solid fa-trash-can" /> Remove File
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => editDocInputRef.current?.click()}
                                      style={{ background: '#ffffff', border: '1px dashed #2563eb', color: '#2563eb', borderRadius: '8px', padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                      <i className="fa-solid fa-paperclip" /> Attach File (PDF/Word)
                                    </button>
                                  )}
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="ud-player-nav-btn"
                                    disabled={savingNote}
                                    style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(n)}
                                    className="ot-completed-btn"
                                    disabled={savingNote}
                                    style={{ padding: '6px 16px', fontSize: '0.82rem' }}
                                  >
                                    {savingNote ? 'Updating Note...' : 'Update Note'}
                                  </button>
                                </div>
                              </div>
                            ) : n.text ? (
                              <p style={{ margin: '10px 0 0 0', color: '#334155', fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {n.text}
                              </p>
                            ) : null}
                          </div>
                        );
                      });
                      })()}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'community' && (
                <div className="ot-curriculum-panel-card" style={{ padding: '0', overflow: 'hidden' }}>
                  {/* Chat Header — same as StudentCommunityPage */}
                  <div style={{
                    padding: '14px 22px', background: '#ffffff',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    boxShadow: '0 1px 4px rgba(11, 31, 58, 0.03)', flexShrink: 0,
                  }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '12px', overflow: 'hidden',
                      background: 'rgba(90, 112, 211, 0.08)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: '#5A70D3', fontSize: '18px', flexShrink: 0,
                    }}>
                      {(course?.thumbnail || course?.thumbnailUrl || course?.imageUrl)
                        ? <img
                            src={resolveMediaUrl(course.thumbnail || course.thumbnailUrl || course.imageUrl)}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        : <i className="fa-solid fa-comments" />}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0b1f3a' }}>
                        {course?.name || 'Course Community'}
                      </h3>
                      <span style={{ fontSize: '0.74rem', color: '#5A70D3', fontWeight: 600 }}>Community Channel</span>
                    </div>
                  </div>
                  <div style={{ height: '540px' }}>
                    <ChatPanel courseId={courseId} courseName={course?.name} onChatRead={() => setCommunityUnreadCount(0)} />
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* ================================================================
              RIGHT COLUMN: Floating "Course content" Card
              ================================================================ */}
          <aside className="ot-course-content-sidebar">
            <div className="ot-sidebar-header">
              <h3 className="ot-sidebar-title">Course content</h3>
              <span className="ot-sidebar-meta">
                {sections.length} sections • {allLectures.length} lectures{totalCourseDurationText ? ` • ${totalCourseDurationText}` : ''}
              </span>
            </div>

            {/* Sections Stack */}
            <div className="ot-sidebar-sections-stack">
              {sections.map((sec, sIdx) => {
                const secContents = contentsBySection[sec.id] || [];
                const isExpanded = expandedSections[sec.id] !== false;
                const isCurrentSection = secContents.some(c => c.id === activeContent?.id);
                const completedInSec = secContents.filter(c => (c.id === activeContent?.id ? contentProgress?.completed : contentsProgressMap[c.id]?.completed)).length;
                const isSecFullyCompleted = secContents.length > 0 && completedInSec === secContents.length;

                return (
                  <div key={sec.id} className={`ot-sidebar-section-card ${isCurrentSection ? 'is-active-section' : ''}`}>
                    <button
                      type="button"
                      className="ot-sidebar-section-btn"
                      onClick={() => toggleSection(sec.id)}
                    >
                      <div className="ot-sidebar-section-btn-left">
                        <div className={`ot-section-num-circle ${isCurrentSection || isSecFullyCompleted ? 'active' : ''}`}>
                          {isSecFullyCompleted ? (
                            <i className="fa-solid fa-check" style={{ fontSize: '11px' }}></i>
                          ) : (
                            sIdx + 1
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="ot-sidebar-sec-title">{sec.title}</div>
                          <div className="ot-sidebar-sec-subtitle">
                            {secContents.length > 0 ? `${completedInSec} / ${secContents.length} lectures` : '0 lectures'}
                            {(() => {
                              const secDurTotal = secContents.reduce((sum, c) => {
                                const d = (c.id === activeContent?.id && videoDuration > 0)
                                  ? Math.round(videoDuration)
                                  : (lectureDurations[c.id] || 0);
                                return sum + d;
                              }, 0);
                              const text = secDurTotal > 0 ? formatDurationHuman(secDurTotal) : null;
                              return text ? ` • ${text}` : '';
                            })()}
                          </div>
                        </div>
                      </div>
                      <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} ot-sidebar-chevron ${isCurrentSection ? 'active' : ''}`}></i>
                    </button>

                    {isExpanded && (
                      <div className="ot-sidebar-lectures-list">
                        {secContents.map((content) => {
                          const isActive = activeContent?.id === content.id;
                          const prog = (content.id === activeContent?.id) ? contentProgress : contentsProgressMap[content.id];
                          const isComplete = Boolean(prog?.completed);

                          return (
                            <div
                              key={content.id}
                              className={`ot-sidebar-lecture-item ${isActive ? 'active' : ''}`}
                              onClick={() => selectContent(content)}
                            >
                              <div className="ot-sidebar-lecture-left">
                                <div className={`ot-sidebar-check-box ${isComplete ? 'checked' : ''}`}>
                                  {isComplete && <i className="fa-solid fa-check"></i>}
                                </div>
                                <div className="ot-sidebar-lecture-info">
                                  <div className="ot-sidebar-lecture-name">{content.title}</div>
                                  <div className="ot-sidebar-lecture-meta">
                                    <i className="fa-solid fa-play" style={{ fontSize: '9px', color: isActive ? '#5A70D3' : '#94a3b8' }}></i>
                                    <span>{content.contentType || 'VIDEO'}</span>
                                    {(() => {
                                      const durSec = (isActive && videoDuration > 0)
                                        ? Math.round(videoDuration)
                                        : (lectureDurations[content.id] || 0);
                                      const durText = durSec > 0 ? formatTime(durSec) : null;
                                      if (!durText) return null;
                                      return (
                                        <>
                                          <span style={{ margin: '0 4px', color: '#cbd5e1' }}>•</span>
                                          <span className="ot-sidebar-lecture-duration">
                                            {durText}
                                          </span>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="ot-sidebar-more-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectContent(content);
                                }}
                                title="Lecture options"
                              >
                                <i className="fa-solid fa-ellipsis-vertical"></i>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom: Progress + Download */}
            <div className="ot-sidebar-bottom-actions">
              <div className="ot-sidebar-progress-card">
                <div className="ot-sidebar-progress-top">
                  <span className="ot-sidebar-progress-label">Course Progress</span>
                  <span className="ot-sidebar-progress-val">{overallProgressPercent}%</span>
                </div>
                <div className="ot-sidebar-progress-bar">
                  <div className="ot-sidebar-progress-fill" style={{ width: `${overallProgressPercent}%` }}></div>
                </div>
                <div className="ot-sidebar-progress-stats">
                  <span>{completedLecturesCount} of {allLectures.length} completed</span>
                  <span>{allLectures.length - completedLecturesCount} remaining</span>
                </div>
              </div>
              {lectureResources.length > 0 && (
                <button
                  type="button"
                  className="ot-sidebar-download-btn"
                  onClick={handleSidebarDownloadResources}
                  title={lectureResources.length === 1 ? `Download ${lectureResources[0].name}` : `Download all ${lectureResources.length} resources`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-download"></i>
                    <span>Download Resources{lectureResources.length > 1 ? ` (${lectureResources.length})` : ''}</span>
                  </div>
                  <i className="fa-solid fa-arrow-down" style={{ fontSize: '13px' }}></i>
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ====================================================================
          CENTERED MODERN DELETE NOTE CONFIRMATION MODAL
          ==================================================================== */}
      {deleteConfirmNoteId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'modalFadeIn 0.2s ease-out',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingNote) {
              setDeleteConfirmNoteId(null);
            }
          }}
        >
          <style>{`
            @keyframes modalFadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes modalScaleIn {
              from { transform: scale(0.92); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}</style>
          
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '32px 28px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
              animation: 'modalScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close X Button */}
            <button
              type="button"
              onClick={() => setDeleteConfirmNoteId(null)}
              disabled={isDeletingNote}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: '#6a6f73',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px',
                lineHeight: 1,
              }}
              title="Close"
            >
              <i className="fa-solid fa-xmark" />
            </button>

            {/* Red Alert Trash Icon Circle */}
            <div
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                margin: '0 auto 16px auto',
              }}
            >
              <i className="fa-solid fa-trash-can" />
            </div>

            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#1c1d1f',
                margin: '0 0 8px 0',
              }}
            >
              Delete Note?
            </h3>

            <p
              style={{
                fontSize: '0.92rem',
                color: '#6a6f73',
                margin: '0 0 24px 0',
                lineHeight: 1.5,
              }}
            >
              Are you sure you want to delete this note? This action cannot be undone.
            </p>

            {/* Buttons Row: Cancel and OK */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                className="ud-btn-secondary"
                onClick={() => setDeleteConfirmNoteId(null)}
                disabled={isDeletingNote}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteNote}
                disabled={isDeletingNote}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  fontSize: '0.92rem',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#dc2626')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#ef4444')}
              >
                {isDeletingNote ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check" />
                    <span>OK</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Completion Prompt Modal (triggers when video ends) */}
      {showAssessmentModal && (
        <div className="modal-backdrop" style={{ zIndex: 9000 }}>
          <div className="modal-card" style={{ maxWidth: '520px', textAlign: 'center', padding: '32px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 16px' }}>
              🏆
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Lesson Video Completed!
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Great job completing <strong>{activeContent?.title}</strong>.
            </p>

            {currentAssessmentInfo?.required ? (
              <div style={{ background: 'rgba(225, 29, 72, 0.08)', border: '1px solid rgba(225, 29, 72, 0.25)', color: '#f43f5e', padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '20px', textAlign: 'left' }}>
                <strong>📝 Assessment Required:</strong> You must complete and pass the 1-mark assessment for this lesson before unlocking the next lesson.
              </div>
            ) : (
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '20px', textAlign: 'left' }}>
                <strong>📝 Optional Assessment Available:</strong> Test your knowledge with a quick 1-mark quiz.
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAssessmentModal(false)}
              >
                Review Lesson
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartFullWindowAssessment}
                style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', fontWeight: 800, padding: '10px 24px' }}
              >
                Start Assessment Now ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Window Assessment Mode Overlay */}
      {isFullWindowAssessment && activeContent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#f1f5f9',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          width: '100vw',
          height: '100vh'
        }}>
          <AssessmentPlayer
            contentId={activeContent.id}
            onClose={() => setIsFullWindowAssessment(false)}
            onLessonUnlocked={async () => {
              // 1. Locate next lesson: check same section first, then next section(s)
              let targetNextLesson = null;
              let targetNextSection = null;

              if (activeContent) {
                let curSecIdx = -1;
                let curContentIdx = -1;

                for (let sIdx = 0; sIdx < sections.length; sIdx++) {
                  const s = sections[sIdx];
                  const list = contentsBySection[s.id] || [];
                  const cIdx = list.findIndex(c => c.id === activeContent.id);
                  if (cIdx !== -1) {
                    curSecIdx = sIdx;
                    curContentIdx = cIdx;
                    break;
                  }
                }

                if (curSecIdx !== -1) {
                  const curSecContents = contentsBySection[sections[curSecIdx].id] || [];
                  // Check if same section has next lesson
                  if (curContentIdx + 1 < curSecContents.length) {
                    targetNextLesson = curSecContents[curContentIdx + 1];
                    targetNextSection = sections[curSecIdx];
                  } else {
                    // Check subsequent sections for next lesson
                    for (let sIdx = curSecIdx + 1; sIdx < sections.length; sIdx++) {
                      const nextSecContents = contentsBySection[sections[sIdx].id] || [];
                      if (nextSecContents.length > 0) {
                        targetNextLesson = nextSecContents[0];
                        targetNextSection = sections[sIdx];
                        break;
                      }
                    }
                  }
                }
              }

              // 2. Fetch fresh progress of completed assessment lesson
              if (activeContent) {
                try {
                  const freshProg = await getContentProgress(activeContent.id);
                  if (freshProg) {
                    setContentsProgressMap(prev => ({ ...prev, [activeContent.id]: freshProg }));
                    setContentProgress(freshProg);
                  }
                } catch (e) {
                  console.warn('Failed to refresh content progress:', e);
                }
              }

              refreshCourseProgress();
              setIsFullWindowAssessment(false);

              // 3. If target section found, expand it in the sidebar
              if (targetNextSection) {
                setExpandedSections(prev => ({ ...prev, [targetNextSection.id]: true }));
              }

              // 4. Navigate to next lesson if available, or celebrate course completion
              if (targetNextLesson) {
                selectContent(targetNextLesson, true);
              } else if (activeContent) {
                triggerToast("🎉 Congratulations! You have completed all lessons in this course.");
                getContentProgress(activeContent.id).then(setContentProgress).catch(() => {});
                getAssessmentInfo(activeContent.id).then(setCurrentAssessmentInfo).catch(() => {});
              }
            }}
          />
        </div>
      )}
      {previewFileModal && (
        <div
          onClick={() => setShowModalBars(prev => !prev)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: '#0b141a',
            display: 'flex',
            flexDirection: 'column',
            width: '100vw',
            height: '100vh',
            animation: 'modalFadeIn 0.2s ease-out',
            color: '#e9edef',
            userSelect: 'none',
            cursor: 'pointer'
          }}
        >
          {/* Unified WhatsApp Web Style Header Bar */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              height: showModalBars ? '56px' : '0px',
              opacity: showModalBars ? 1 : 0,
              overflow: 'hidden',
              pointerEvents: showModalBars ? 'auto' : 'none',
              transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              background: 'rgba(17, 27, 33, 0.96)',
              padding: showModalBars ? '0 12px' : '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              borderBottom: showModalBars ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
              flexShrink: 0,
              zIndex: 10
            }}
          >
            {/* Left: Back Arrow Symbol + Title Text */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setPreviewFileModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#aebac1',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  padding: '6px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '50%',
                  flexShrink: 0,
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                title="Close preview"
              >
                <i className="fa-solid fa-arrow-left" />
              </button>
              <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#e9edef', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {previewFileModal.name || (previewFileModal.type === 'image' ? 'Attached Photo' : 'Attached Document')}
              </span>
            </div>

            {/* Right: Rotate (if image) & Download Symbol */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {previewFileModal.type === 'image' && (
                <button
                  type="button"
                  onClick={() => setImgRotation(r => (r + 90) % 360)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#e9edef', width: '34px', height: '34px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.88rem' }}
                  title="Rotate Image"
                >
                  <i className="fa-solid fa-rotate-right" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDownloadFile(previewFileModal.url, previewFileModal.name)}
                style={{ background: '#00a884', color: '#111b21', border: 'none', width: '34px', height: '34px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}
                title="Download File"
              >
                <i className="fa-solid fa-download" />
              </button>
            </div>
          </div>

          {/* Full Screen Stage Content Area */}
          <div
            style={{
              flex: 1,
              background: previewFileModal.type === 'image' ? '#0b141a' : '#f8fafc',
              overflow: 'hidden',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Main Stage View Area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {previewFileModal.loading ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', color: '#0b1f3a' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2.5rem', color: '#5A70D3' }} />
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#475569' }}>Opening file preview...</span>
                </div>
              ) : previewFileModal.type === 'image' ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    background: '#0b141a'
                  }}
                >
                  <img
                    src={resolveMediaUrl(previewFileModal.url)}
                    alt={previewFileModal.name}
                    style={{
                      maxWidth: showModalBars ? '92vw' : '98vw',
                      maxHeight: showModalBars ? '76vh' : '94vh',
                      objectFit: 'contain',
                      transform: `scale(${imgZoom}) rotate(${imgRotation}deg)`,
                      transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                      cursor: imgZoom > 1 ? 'zoom-out' : 'zoom-in',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              ) : previewFileModal.type === 'docx' && previewFileModal.htmlContent ? (
                <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#f1f5f9', padding: '30px 20px', display: 'flex', justifyContent: 'center' }}>
                  <div
                    className="ot-docx-paper"
                    style={{
                      background: '#ffffff',
                      maxWidth: '850px',
                      width: '100%',
                      minHeight: '100%',
                      padding: '40px 50px',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
                      color: '#1e293b',
                      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                      lineHeight: 1.7,
                      fontSize: '0.98rem'
                    }}
                    dangerouslySetInnerHTML={{ __html: previewFileModal.htmlContent }}
                  />
                </div>
              ) : previewFileModal.type === 'text' && previewFileModal.textContent ? (
                <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#0f172a', padding: '24px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {previewFileModal.textContent}
                </div>
              ) : previewFileModal.type === 'pdf' ? (
                <iframe
                  src={resolveMediaUrl(previewFileModal.url)}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={previewFileModal.name}
                />
              ) : (resolveMediaUrl(previewFileModal.url).startsWith('http') && !resolveMediaUrl(previewFileModal.url).includes('localhost')) ? (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(resolveMediaUrl(previewFileModal.url))}&embedded=true`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title={previewFileModal.name}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: '#ffffff', textAlign: 'center' }}>
                  <div style={{ maxWidth: '440px' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'rgba(90, 112, 211, 0.08)', color: '#5A70D3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', margin: '0 auto 20px auto', boxShadow: '0 8px 20px rgba(90, 112, 211, 0.15)' }}>
                      <i className={getDocIconClass(previewFileModal.name || previewFileModal.url)} />
                    </div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', fontWeight: 800, color: '#0b1f3a' }}>
                      {previewFileModal.name || 'Document File'}
                    </h4>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
                      {previewFileModal.error || 'This document is available for instant download. Click below to open or save it on your computer.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(previewFileModal.url, previewFileModal.name)}
                      style={{
                        background: '#5A70D3',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px 26px',
                        fontSize: '0.92rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(90, 112, 211, 0.3)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <i className="fa-solid fa-download" />
                      <span>Download File</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Attachment Thumbnail Carousel Strip with Dark Image Stage Background */}
            {previewFileModal.mediaList && previewFileModal.mediaList.length > 0 && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  maxHeight: showModalBars ? '80px' : '0px',
                  opacity: showModalBars ? 1 : 0,
                  padding: showModalBars ? '12px 16px' : '0px 16px',
                  overflow: 'hidden',
                  pointerEvents: showModalBars ? 'auto' : 'none',
                  transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                  background: '#0b141a',
                  borderTop: showModalBars ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  overflowX: 'auto',
                  flexShrink: 0,
                  zIndex: 20
                }}
              >
                {previewFileModal.mediaList.map((item, idx) => {
                  const isActive = idx === previewFileModal.activeMediaIndex;
                  return (
                    <div
                      key={idx}
                      onClick={() => selectPreviewMediaItem(idx, previewFileModal.mediaList)}
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        position: 'relative',
                        flexShrink: 0,
                        background: '#1e293b',
                        border: isActive ? '3px solid #00a884' : '1px solid rgba(255, 255, 255, 0.15)',
                        opacity: isActive ? 1 : 0.75,
                        boxShadow: isActive ? '0 0 12px rgba(0, 168, 132, 0.6)' : 'none',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title={item.name || (item.isImage ? `Photo ${idx + 1}` : 'File attachment')}
                    >
                      {item.isImage ? (
                        <img
                          src={resolveMediaUrl(item.url)}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            background: '#1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#94a3b8'
                          }}
                        >
                          <i className={getDocIconClass(item.name || item.url)} style={{ fontSize: '1.2rem' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
