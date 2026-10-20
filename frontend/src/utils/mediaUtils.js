const BACKEND_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1').replace(/\/api\/v1\/?$/, '');

/**
 * Resolves frontend public assets respecting Vite's base path (e.g. /LMS/ on GitHub Pages).
 */
export function resolvePublicAsset(path) {
  if (!path || typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Resolves any media or image URL to an accessible URL.
 * Handles full URLs (http/https/blob/data), backend relative paths (/api/v1/...),
 * storage paths, Windows backslashes, and misdirected frontend ports.
 */
export function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';

  // Fix Windows backslashes
  let normalized = trimmed.replace(/\\/g, '/');

  // Fix frontend dev port (5173/3000) incorrectly saved in backend paths
  normalized = normalized.replace(/^https?:\/\/(localhost|127\.0\.0\.1):(5173|3000)(\/api\/v1)?/i, `${BACKEND_BASE}/api/v1`);

  if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('blob:') || normalized.startsWith('data:')) {
    return normalized;
  }

  // If already prefixed with frontend base path (e.g. /LMS/...)
  const base = import.meta.env.BASE_URL || '/';
  if (base !== '/' && normalized.startsWith(base)) {
    return normalized;
  }

  // Handle local frontend static assets in public/
  const staticAssetNames = ['hero-student.', 'courses/', 'manifest.json'];
  const isStatic = staticAssetNames.some(name => normalized.startsWith(name) || normalized.startsWith(`/${name}`));
  if (isStatic) {
    return resolvePublicAsset(normalized);
  }

  const cleanPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${BACKEND_BASE}${cleanPath}`;
}

export const VIDEO_QUALITY_OPTIONS = [
  { id: 'high', label: '1080p / 720p (High)', shortLabel: 'High' },
  { id: 'medium', label: '480p (Medium)', shortLabel: 'Medium' },
  { id: 'low', label: '360p (Low)', shortLabel: 'Low' }
];

/**
 * Injects dynamic Cloudinary video transformations for real bandwidth and resolution reduction.
 */
export function transformCloudinaryVideoUrl(url, quality = 'high') {
  if (!url || typeof url !== 'string' || !url.includes('res.cloudinary.com') || !url.includes('/video/upload')) {
    return url;
  }

  let transform = '';
  if (quality === 'low') {
    transform = 'w_640,c_limit,q_35,vc_auto';
  } else if (quality === 'medium') {
    transform = 'w_854,c_limit,q_55,vc_auto';
  } else {
    transform = 'w_1280,c_limit,q_auto:good,vc_auto';
  }

  const uploadRegex = /\/video\/upload(?:\/(?:w_\d+|q_[a-zA-Z0-9:]+|c_[a-zA-Z0-9]+|vc_[a-zA-Z0-9]+)[^/]*)*\//i;
  if (uploadRegex.test(url)) {
    return url.replace(uploadRegex, `/video/upload/${transform}/`);
  }
  return url.replace('/video/upload/', `/video/upload/${transform}/`);
}

export function getQualityVideoUrl(url, quality = 'high') {
  if (!url || typeof url !== 'string') return '';
  const resolved = resolveMediaUrl(url);
  if (!resolved) return '';

  if (resolved.includes('youtube.com') || resolved.includes('youtu.be')) {
    return resolved;
  }

  // Real Cloudinary on-the-fly resolution & bitrate transcoding
  if (resolved.includes('res.cloudinary.com') && resolved.includes('/video/upload')) {
    return transformCloudinaryVideoUrl(resolved, quality);
  }

  // Real local backend transcoding via /api/v1/media/files/{id}?quality=low|medium|high
  try {
    const urlObj = new URL(resolved, window.location.origin);
    urlObj.searchParams.set('quality', quality);
    return urlObj.toString();
  } catch {
    const separator = resolved.includes('?') ? '&' : '?';
    return `${resolved}${separator}quality=${quality}`;
  }
}

