import { useState, useEffect, useRef, useCallback } from 'react';
import { resolveMediaUrl, VIDEO_QUALITY_OPTIONS, getQualityVideoUrl } from '../utils/mediaUtils';

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1&enablejsapi=1` : null;
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

/**
 * RecordingVideoPlayer
 * 
 * Reusable video player matching the exact custom course player style,
 * with complete button functionalities (play/pause, seek, volume, PiP,
 * quality selector, subtitles CC, fullscreen, auto-hide controls, keyboard shortcuts).
 * 
 * Specifically configured for Class Recordings:
 * - NO strict video tracking: The user can freely seek, play from any point, and view anywhere.
 * - Anti-Download Protection: Disables native browser download, disables right-click context menu,
 *   prevents dragging, and removes download controls.
 */
export default function RecordingVideoPlayer({
  url,
  title,
  courseName,
  subtitleUrl,
  autoPlay = true,
  onClose,
  className = '',
  style = {}
}) {
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const seekBarRef = useRef(null);
  const controlsHideTimer = useRef(null);
  const toastTimerRef = useRef(null);
  // Quality popover refs
  const topQualityMenuRef = useRef(null);
  const bottomQualityMenuRef = useRef(null);
  const pendingQualityRestoreRef = useRef(null);
  const isScrubbingRef = useRef(false);

  // Playback states
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastNotice, setToastNotice] = useState(null);

  // Volume states
  const [videoVolume, setVideoVolume] = useState(() => {
    const saved = localStorage.getItem('onetutor_video_volume');
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [videoMuted, setVideoMuted] = useState(false);

  // Video quality state
  const [videoQuality, setVideoQuality] = useState(() => {
    return localStorage.getItem('onetutor_video_quality') || 'high';
  });
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Subtitles states
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(() => {
    return localStorage.getItem('onetutor_subtitles_enabled') === 'true';
  });
  const [parsedCues, setParsedCues] = useState([]);
  const [activeSubtitleText, setActiveSubtitleText] = useState('');

  const ytEmbedUrl = getYouTubeEmbedUrl(url);
  const hasSubtitles = Boolean(subtitleUrl && subtitleUrl.trim().length > 0);

  // Toast banner trigger
  const triggerToast = useCallback((notice) => {
    setToastNotice(notice);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastNotice(null), 2200);
  }, []);

  // Controls auto-hide: shows on user activity, auto-hides after 2.5s during playback
  const showVideoControls = useCallback(() => {
    setShowControls(true);
    clearTimeout(controlsHideTimer.current);
    if (isVideoPlaying) {
      controlsHideTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isVideoPlaying]);

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

  // Load and parse VTT subtitles if available
  useEffect(() => {
    if (!subtitleUrl) {
      setParsedCues([]);
      setActiveSubtitleText('');
      return;
    }
    let isMounted = true;
    const fullUrl = resolveMediaUrl(subtitleUrl);
    fetch(fullUrl)
      .then(res => res.ok ? res.text() : '')
      .then(text => {
        if (isMounted && text) {
          setParsedCues(parseVttText(text));
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [subtitleUrl]);

  // Update active subtitle cue as video plays
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

  // Play / Pause toggle
  const handleTogglePlay = useCallback(() => {
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
  }, []);

  // PiP toggle
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

  // Mute toggle
  const handleMuteToggle = () => {
    if (!videoRef.current) return;
    const next = !videoRef.current.muted;
    videoRef.current.muted = next;
    setVideoMuted(next);
    if (!next && videoVolume === 0) {
      videoRef.current.volume = 0.5;
      setVideoVolume(0.5);
      localStorage.setItem('onetutor_video_volume', '0.5');
    }
  };

  // Volume slider change
  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVideoVolume(v);
    localStorage.setItem('onetutor_video_volume', String(v));
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
      setVideoMuted(v === 0);
    }
  };

  // Seeking logic - Completely open, NO strict watching restriction!
  const calculateSeekTime = useCallback((clientX) => {
    if (!seekBarRef.current || !videoDuration) return null;
    const rect = seekBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * videoDuration;
  }, [videoDuration]);

  const applySeek = useCallback((targetTime) => {
    if (!videoRef.current || targetTime === null) return;
    // FREE SEEKING: User can view anywhere, play from any part of the video!
    videoRef.current.currentTime = targetTime;
    setVideoCurrentTime(targetTime);
    updateActiveSubtitle(targetTime);
  }, [updateActiveSubtitle]);

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

  // Fullscreen Handler
  const handleFullscreen = () => {
    const container = cardRef.current;
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
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

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

  // Quality Switcher
  const handleQualityChange = useCallback((newQuality) => {
    if (newQuality === videoQuality) {
      setShowQualityMenu(false);
      return;
    }
    const currentTime = videoRef.current ? videoRef.current.currentTime : 0;
    const wasPlaying = videoRef.current ? !videoRef.current.paused : false;

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

    setTimeout(() => {
      if (pendingQualityRestoreRef.current && videoRef.current) {
        const { currentTime: cTime, wasPlaying: wPlay } = pendingQualityRestoreRef.current;
        if (cTime > 0) videoRef.current.currentTime = cTime;
        if (wPlay) videoRef.current.play().catch(() => {});
        pendingQualityRestoreRef.current = null;
      }
    }, 250);
  }, [videoQuality, triggerToast]);

  // Close quality dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      const isTopInside = topQualityMenuRef.current && topQualityMenuRef.current.contains(e.target);
      const isBottomInside = bottomQualityMenuRef.current && bottomQualityMenuRef.current.contains(e.target);
      if (!isTopInside && !isBottomInside) {
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

  // Keyboard Shortcuts (Space: Play/Pause, Left/Right: Seek 5s freely, F: Fullscreen, M: Mute, Up/Down: Volume)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!cardRef.current) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleMuteToggle();
      } else if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (videoRef.current) {
          const newTime = Math.max(0, videoRef.current.currentTime - 5);
          videoRef.current.currentTime = newTime;
          setVideoCurrentTime(newTime);
          showVideoControls();
        }
      } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        // UNRESTRICTED SEEKING FOR RECORDED CLASSES
        if (videoRef.current) {
          const newTime = Math.min(videoDuration || Infinity, videoRef.current.currentTime + 5);
          videoRef.current.currentTime = newTime;
          setVideoCurrentTime(newTime);
          showVideoControls();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (videoRef.current) {
          const newVol = Math.min(1, parseFloat((videoRef.current.volume + 0.1).toFixed(2)));
          videoRef.current.volume = newVol;
          videoRef.current.muted = false;
          setVideoVolume(newVol);
          setVideoMuted(false);
          showVideoControls();
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (videoRef.current) {
          const newVol = Math.max(0, parseFloat((videoRef.current.volume - 0.1).toFixed(2)));
          videoRef.current.volume = newVol;
          videoRef.current.muted = newVol === 0;
          setVideoVolume(newVol);
          setVideoMuted(newVol === 0);
          showVideoControls();
        }
      } else if ((e.key === 'c' || e.key === 'C') && hasSubtitles) {
        e.preventDefault();
        handleToggleSubtitles();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasSubtitles, videoDuration, handleTogglePlay]);

  // YouTube Embed fallback if external video
  if (ytEmbedUrl) {
    return (
      <div
        className={`ot-video-card ${className}`}
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#000000',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style
        }}
        onContextMenu={(e) => { e.preventDefault(); return false; }}
      >
        <iframe
          title={title || 'Recorded Class Video'}
          src={ytEmbedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>
    );
  }

  const resolvedVideoSrc = getQualityVideoUrl(resolveMediaUrl(url), videoQuality);

  return (
    <div
      ref={cardRef}
      className={`ot-video-card ${!showControls && isVideoPlaying ? 'controls-hidden' : ''} ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        background: '#000000',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        ...style
      }}
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
      // Strict Anti-Download: completely block right-click context menu
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }}
    >
      {/* Toast Notification Banner (Quality change / skip feedback) */}
      {toastNotice && (
        <div className={`ot-video-toast ${typeof toastNotice === 'object' && toastNotice.type === 'info' ? 'is-info' : ''}`}>
          <i className={typeof toastNotice === 'object' && toastNotice.icon ? toastNotice.icon : "fa-solid fa-circle-info"}></i>
          <span>{typeof toastNotice === 'object' ? toastNotice.message : toastNotice}</span>
        </div>
      )}

      {/* Main HTML5 Video Player */}
      <video
        ref={videoRef}
        src={resolvedVideoSrc}
        playsInline
        autoPlay={autoPlay}
        preload="auto"
        className="ot-video-player"
        // Strict Anti-Download Protection attributes
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture={false}
        disableRemotePlayback
        draggable={false}
        onDragStart={(e) => { e.preventDefault(); return false; }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          cursor: isVideoPlaying && !showControls ? 'none' : 'pointer'
        }}
        onSeeking={(e) => {
          updateActiveSubtitle(e.target.currentTime);
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
        }}
        onEnded={() => {
          setIsVideoPlaying(false);
          setIsVideoBuffering(false);
          setShowControls(true);
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
            if (wPlay) vid.play().catch(() => setIsVideoPlaying(false));
          }
          updateActiveSubtitle(vid.currentTime || 0);
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
          const vid = e.target;
          setIsVideoBuffering(false);
          if (vid.duration && !isNaN(vid.duration)) {
            setVideoDuration(vid.duration);
          }
          if (pendingQualityRestoreRef.current) {
            const { currentTime: cTime, wasPlaying: wPlay } = pendingQualityRestoreRef.current;
            pendingQualityRestoreRef.current = null;
            if (cTime > 0) vid.currentTime = cTime;
            if (wPlay) vid.play().catch(() => setIsVideoPlaying(false));
          }
          updateActiveSubtitle(vid.currentTime || 0);
        }}
      />

      {/* Closed Captions (Subtitles) Display */}
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

      {/* Top Header Bar Overlay: Title (Left), Close Button / Back, CC & Quality (Right) */}
      <div
        className={`ot-video-top-bar ${showControls || !isVideoPlaying ? 'visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => { e.preventDefault(); return false; }}
      >
        <div className="ot-video-top-left">
          {onClose && (
            <button
              type="button"
              className="ot-video-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (isFullscreen) {
                  handleFullscreen();
                } else {
                  onClose();
                }
              }}
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Close'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Close'}
            >
              <i className={`fa-solid ${isFullscreen ? 'fa-arrow-left' : 'fa-xmark'}`}></i>
            </button>
          )}
          {title && (
            <span className="ot-video-top-title" title={title}>
              {title}
            </span>
          )}
          {courseName && (
            <span style={{ fontSize: '0.72rem', color: '#5A70D3', fontWeight: 700, background: 'rgba(90, 112, 211, 0.15)', padding: '2px 8px', borderRadius: '9999px', marginLeft: '6px' }}>
              {courseName}
            </span>
          )}
        </div>

        <div className="ot-video-top-right">
          {/* Subtitles (CC) Toggle Button in Top Bar */}
          {hasSubtitles && (
            <button
              type="button"
              className="ot-video-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleSubtitles();
              }}
              title={subtitlesEnabled ? 'Subtitles (c) - On' : 'Subtitles (c) - Off'}
              aria-label="Toggle subtitles"
            >
              <div className={`ot-yt-top-cc ${subtitlesEnabled ? 'is-active' : ''}`}>
                <span>CC</span>
              </div>
            </button>
          )}

          {/* Quality / Settings Gear Selector in Top Bar */}
          <div ref={topQualityMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
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

      {/* Center Buffering Spinner Overlay */}
      {isVideoBuffering && (
        <div className="ot-video-center-play" style={{ pointerEvents: 'none', background: 'rgba(0, 0, 0, 0.65)' }}>
          <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#ffffff' }}></i>
        </div>
      )}

      {/* Custom Bottom Control Bar */}
      <div
        className={`ot-custom-controls ${showControls || !isVideoPlaying ? 'visible' : ''}`}
        onMouseEnter={() => { clearTimeout(controlsHideTimer.current); setShowControls(true); }}
        onMouseLeave={() => { if (isVideoPlaying) controlsHideTimer.current = setTimeout(() => setShowControls(false), 1200); }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => { e.preventDefault(); return false; }}
      >
        {/* Full-width Timeline / Seek Bar - NO strict tracking, users can seek anywhere! */}
        <div
          ref={seekBarRef}
          className={`ot-ctrl-seek-bar ${isScrubbing ? 'is-dragging' : ''}`}
          onMouseDown={handleSeekStart}
          onTouchStart={handleSeekStart}
          title="Seek anywhere"
          style={{ position: 'relative' }}
        >
          {/* Progress fill */}
          <div
            className="ot-ctrl-seek-fill"
            style={{ width: `${videoDuration ? (videoCurrentTime / videoDuration) * 100 : 0}%` }}
          />

          {/* Scrubber Ball Knob */}
          {videoDuration > 0 && (
            <div
              className="ot-ctrl-seek-ball"
              style={{ left: `${Math.max(0, Math.min(100, (videoCurrentTime / videoDuration) * 100))}%` }}
            />
          )}
        </div>

        {/* Controls Row */}
        <div className="ot-ctrl-row">
          {/* Left Controls: Rewind 10s, Play/Pause, Forward 10s, Time */}
          <div className="ot-ctrl-left">
            <button
              type="button"
              className="ot-ctrl-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (videoRef.current) {
                  const newTime = Math.max(0, videoRef.current.currentTime - 10);
                  videoRef.current.currentTime = newTime;
                  setVideoCurrentTime(newTime);
                  triggerToast({ message: '-10s', icon: 'fa-solid fa-rotate-left', type: 'info' });
                }
              }}
              title="Rewind 10s (j / ←)"
              aria-label="Rewind 10 seconds"
            >
              <i className="fa-solid fa-rotate-left"></i>
            </button>

            <button
              type="button"
              className="ot-ctrl-btn ot-ctrl-play"
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePlay();
              }}
              title={isVideoPlaying ? 'Pause (Space / k)' : 'Play (Space / k)'}
              aria-label={isVideoPlaying ? 'Pause' : 'Play'}
            >
              <i className={`fa-solid ${isVideoPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            </button>

            <button
              type="button"
              className="ot-ctrl-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (videoRef.current) {
                  const newTime = Math.min(videoDuration || Infinity, videoRef.current.currentTime + 10);
                  videoRef.current.currentTime = newTime;
                  setVideoCurrentTime(newTime);
                  triggerToast({ message: '+10s', icon: 'fa-solid fa-rotate-right', type: 'info' });
                }
              }}
              title="Forward 10s (l / →)"
              aria-label="Forward 10 seconds"
            >
              <i className="fa-solid fa-rotate-right"></i>
            </button>

            <span className="ot-ctrl-time">
              {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
            </span>
          </div>

          {/* Right Controls: Volume, PiP, Subtitles (CC), Quality Gear, Fullscreen */}
          <div className="ot-ctrl-right">
            {/* Volume Mute & Slider */}
            <button
              type="button"
              className="ot-ctrl-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleMuteToggle();
              }}
              title={videoMuted ? 'Unmute (m)' : 'Mute (m)'}
              aria-label="Mute / Unmute"
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
              onClick={(e) => e.stopPropagation()}
              title="Volume (↑ / ↓)"
              aria-label="Volume slider"
            />

            {/* Picture in Picture */}
            <button
              type="button"
              className="ot-ctrl-btn ot-ctrl-pip"
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePiP();
              }}
              title="Picture in Picture"
              aria-label="Picture in Picture"
            >
              <i className="fa-regular fa-window-restore"></i>
            </button>

            {/* Subtitles (CC) Button in Bottom Bar */}
            {hasSubtitles && (
              <button
                type="button"
                className={`ot-ctrl-btn ${subtitlesEnabled ? 'ot-ctrl-btn--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleSubtitles();
                }}
                title={subtitlesEnabled ? 'Subtitles (c) - On' : 'Subtitles (c) - Off'}
                aria-label="Toggle subtitles"
              >
                <i className="fa-regular fa-closed-captioning"></i>
              </button>
            )}

            {/* Quality Popover Trigger in Bottom Bar */}
            <div ref={bottomQualityMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                className={`ot-ctrl-btn ${showQualityMenu ? 'ot-ctrl-btn--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQualityMenu(p => !p);
                }}
                title={`Settings • Quality: ${videoQuality.toUpperCase()}`}
                aria-label="Settings"
              >
                <i className="fa-solid fa-gear"></i>
              </button>

              {showQualityMenu && (
                <div
                  className="ot-quality-menu"
                  style={{ bottom: 'calc(100% + 8px)', top: 'auto', right: 0 }}
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

            {/* Fullscreen Toggle */}
            <button
              type="button"
              className="ot-ctrl-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleFullscreen();
              }}
              title={isFullscreen ? 'Exit Fullscreen (f)' : 'Fullscreen (f)'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
