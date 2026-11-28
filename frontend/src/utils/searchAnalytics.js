/**
 * Search Analytics Utility
 * Tracks user search queries and course search frequencies dynamically across all user searches.
 * Provides top 4 most searched courses and dynamic popular search keywords.
 */

const SEARCH_ANALYTICS_STORAGE_KEY = 'onetutor_search_analytics_v1';

export const INITIAL_POPULAR_TOPICS = [
  'Spring Boot',
  'MERN Stack',
  'React',
  'Microservices',
  'Cloud Native',
  'Java',
  'PostgreSQL',
  'JavaScript',
  'Web Development'
];

/**
 * Returns stored search analytics data.
 */
export function getSearchAnalytics() {
  try {
    const raw = localStorage.getItem(SEARCH_ANALYTICS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          courseSearchCounts: parsed.courseSearchCounts || {},
          queryCounts: parsed.queryCounts || {}
        };
      }
    }
  } catch (e) {
    console.warn('[searchAnalytics] Failed to read search analytics:', e);
  }
  return {
    courseSearchCounts: {},
    queryCounts: {}
  };
}

/**
 * Persists search analytics to storage and notifies other tabs/components.
 */
function saveSearchAnalytics(data) {
  try {
    localStorage.setItem(SEARCH_ANALYTICS_STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('onetutor-search-analytics-updated', { detail: data }));
  } catch (e) {
    console.warn('[searchAnalytics] Failed to save search analytics:', e);
  }
}

/**
 * Records a search event for a query string and any courses matched by that query.
 */
export function recordSearch(query, matchedCourseIds = []) {
  const trimmed = (query || '').trim().toLowerCase();
  const analytics = getSearchAnalytics();

  if (trimmed) {
    // Format query nicely (capitalize first letter of words)
    const formattedQuery = trimmed.length > 2
      ? trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : trimmed.toUpperCase();

    analytics.queryCounts[formattedQuery] = (analytics.queryCounts[formattedQuery] || 0) + 1;
  }

  if (Array.isArray(matchedCourseIds)) {
    matchedCourseIds.forEach(id => {
      if (id) {
        const key = String(id);
        analytics.courseSearchCounts[key] = (analytics.courseSearchCounts[key] || 0) + 1;
      }
    });
  }

  saveSearchAnalytics(analytics);
}

/**
 * Records when a user explicitly clicks or searches for a specific course.
 */
export function recordCourseSearch(courseId, courseName = '') {
  if (!courseId) return;
  const analytics = getSearchAnalytics();
  const key = String(courseId);
  analytics.courseSearchCounts[key] = (analytics.courseSearchCounts[key] || 0) + 1;

  if (courseName && courseName.trim()) {
    const name = courseName.trim();
    analytics.queryCounts[name] = (analytics.queryCounts[name] || 0) + 1;
  }

  saveSearchAnalytics(analytics);
}

/**
 * Returns the top N most searched courses based on cumulative user search activity.
 * Guaranteed to return up to `limit` courses by falling back to published catalog courses.
 */
export function getTopSearchedCourses(allCourses = [], limit = 4) {
  if (!Array.isArray(allCourses) || allCourses.length === 0) return [];
  const analytics = getSearchAnalytics();
  const counts = analytics.courseSearchCounts || {};

  // Sort courses by search count descending; if tie, sort by enrollment or ID
  const sorted = [...allCourses].sort((a, b) => {
    const countA = counts[String(a.id)] || 0;
    const countB = counts[String(b.id)] || 0;
    if (countB !== countA) return countB - countA;
    return (b.enrollmentCount || 0) - (a.enrollmentCount || 0);
  });

  return sorted.slice(0, limit).map((c, index) => ({
    ...c,
    searchRank: index + 1,
    searchCount: counts[String(c.id)] || 0
  }));
}

/**
 * Returns the top search queries dynamically, blended with curated popular topics.
 */
export function getTopSearchQueries(limit = 8) {
  const analytics = getSearchAnalytics();
  const sortedQueries = Object.entries(analytics.queryCounts || {})
    .sort((a, b) => b[1] - a[1])
    .map(([q]) => q)
    .filter(Boolean);

  const seen = new Set(sortedQueries.map(q => q.toLowerCase()));
  const result = [...sortedQueries];

  INITIAL_POPULAR_TOPICS.forEach(topic => {
    if (!seen.has(topic.toLowerCase()) && result.length < limit * 2) {
      seen.add(topic.toLowerCase());
      result.push(topic);
    }
  });

  return result.slice(0, limit);
}
