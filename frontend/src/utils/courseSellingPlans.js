/**
 * Utility module for handling 3 Course Selling Plans / Pricing Tiers:
 * 1. LIVE_ONLY       -> Only Live Section (Live Classes & Attendance)
 * 2. FULL_ACCESS     -> Live + Recording Videos (Full access to all features)
 * 3. RECORDED_ONLY   -> Recording Videos (Full HD lecture replays at own pace)
 */

export const PLAN_TYPES = {
  LIVE_ONLY: 'LIVE_ONLY',
  FULL_ACCESS: 'FULL_ACCESS',
  RECORDED_ONLY: 'RECORDED_ONLY'
};

export const PLAN_DEFINITIONS = [
  {
    id: PLAN_TYPES.LIVE_ONLY,
    key: 'liveOnly',
    name: 'Live Sessions Only',
    shortName: 'Live Only',
    tag: 'Interactive Live',
    badge: 'LIVE CLASSROOM',
    icon: 'fa-solid fa-tower-broadcast',
    color: '#0284c7',
    bgColor: 'rgba(2, 132, 199, 0.08)',
    borderColor: '#38bdf8',
    description: 'Attend all scheduled live interactive class sessions with instant Q&A and attendance tracking.',
    defaultPrice: 499,
    allowsLive: true,
    allowsRecordings: false,
    features: [
      { text: 'Live online classroom participation', included: true },
      { text: 'Direct interactive Q&A with instructor', included: true },
      { text: 'Live attendance & participation tracking', included: true },
      { text: 'Course community chat & discussions', included: true },
      { text: 'Recorded class video replays', included: false }
    ]
  },
  {
    id: PLAN_TYPES.FULL_ACCESS,
    key: 'liveAndRecorded',
    name: 'Live + Recording Videos',
    shortName: 'Live + Recordings',
    tag: 'Full Access',
    badge: 'BEST VALUE · RECOMMENDED',
    isRecommended: true,
    icon: 'fa-solid fa-crown',
    color: '#5A70D3',
    bgColor: 'rgba(90, 112, 211, 0.1)',
    borderColor: '#5A70D3',
    description: 'Complete all-in-one access: attend live classroom sessions AND watch video replays anytime.',
    defaultPrice: 899,
    allowsLive: true,
    allowsRecordings: true,
    features: [
      { text: 'Live online classroom participation', included: true },
      { text: 'Unlimited access to recorded class replays', included: true },
      { text: 'Live attendance & participation tracking', included: true },
      { text: 'Downloadable lesson notes & attachments', included: true },
      { text: 'Course community chat & peer discussions', included: true },
      { text: 'Lifetime access with playback speed & subtitles', included: true }
    ]
  },
  {
    id: PLAN_TYPES.RECORDED_ONLY,
    key: 'recordedOnly',
    name: 'Recording Videos Only',
    shortName: 'Recordings Only',
    tag: 'Self-Paced Learning',
    badge: 'ON-DEMAND REPLAYS',
    icon: 'fa-solid fa-circle-play',
    color: '#059669',
    bgColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: '#34d399',
    description: 'Watch all recorded class video replays on-demand at your own pace anytime, anywhere.',
    defaultPrice: 349,
    allowsLive: false,
    allowsRecordings: true,
    features: [
      { text: 'Full HD video recordings of every class session', included: true },
      { text: 'Playback speed controls & subtitle tracks', included: true },
      { text: 'Downloadable classroom notes & code attachments', included: true },
      { text: 'Course community chat & discussions', included: true },
      { text: 'Live scheduled interactive classes', included: false }
    ]
  }
];

const STORAGE_KEY_SELLING_PLANS = 'onetutor_course_selling_plans_';
const STORAGE_KEY_ENROLLED_PLANS = 'onetutor_enrolled_plan_';

/**
 * Returns default selling plans structure for a course.
 */
export function getDefaultSellingPlans(basePrice = 499, currency = 'INR') {
  const p = Number(basePrice) || 0;
  // If basePrice is 0 or unconfigured, default to standard tier prices
  if (!p || p <= 0) {
    return {
      liveOnly: {
        enabled: true,
        price: 499,
        currency: currency || 'INR'
      },
      liveAndRecorded: {
        enabled: true,
        price: 899,
        currency: currency || 'INR'
      },
      recordedOnly: {
        enabled: true,
        price: 349,
        currency: currency || 'INR'
      }
    };
  }

  // If basePrice is low (e.g. testing with ₹1, ₹1.5, ₹10) preserve exact base price
  if (p <= 10) {
    return {
      liveOnly: {
        enabled: true,
        price: p,
        currency: currency || 'INR'
      },
      liveAndRecorded: {
        enabled: true,
        price: p,
        currency: currency || 'INR'
      },
      recordedOnly: {
        enabled: true,
        price: p,
        currency: currency || 'INR'
      }
    };
  }

  // Proportional pricing without hardcoded Math.max(99/149) floors
  return {
    liveOnly: {
      enabled: true,
      price: Math.round(p * 0.8),
      currency: currency || 'INR'
    },
    liveAndRecorded: {
      enabled: true,
      price: p,
      currency: currency || 'INR'
    },
    recordedOnly: {
      enabled: true,
      price: Math.round(p * 0.6),
      currency: currency || 'INR'
    }
  };
}

/**
 * Parses selling plans from a course object or localStorage, respecting exact configured prices.
 */
export function parseSellingPlans(course) {
  if (!course) return null;
  const isFree = course.pricingType === 'free' || Number(course.price) === 0;
  if (isFree) return null;

  let raw = course.sellingPlans;

  // Check localStorage if not on course object or if course is an ID
  if (!raw && course.id) {
    try {
      raw = localStorage.getItem(`${STORAGE_KEY_SELLING_PLANS}${course.id}`);
    } catch {
      // ignore
    }
  }

  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && (parsed.liveOnly || parsed.liveAndRecorded || parsed.recordedOnly)) {
        const getTierPrice = (tierKey, defaultRatio = 1) => {
          const tier = parsed[tierKey];
          if (tier && tier.price !== undefined && tier.price !== null && tier.price !== '') {
            const num = Number(tier.price);
            if (!isNaN(num) && num >= 0) return num;
          }
          const bp = Number(course.price) || 0;
          return bp > 0 ? (bp <= 10 ? bp : Math.round(bp * defaultRatio)) : 0;
        };

        return {
          liveOnly: {
            enabled: parsed.liveOnly?.enabled !== false,
            price: getTierPrice('liveOnly', 0.8),
            currency: parsed.liveOnly?.currency || course.currency || 'INR'
          },
          liveAndRecorded: {
            enabled: parsed.liveAndRecorded?.enabled !== false,
            price: getTierPrice('liveAndRecorded', 1),
            currency: parsed.liveAndRecorded?.currency || course.currency || 'INR'
          },
          recordedOnly: {
            enabled: parsed.recordedOnly?.enabled !== false,
            price: getTierPrice('recordedOnly', 0.6),
            currency: parsed.recordedOnly?.currency || course.currency || 'INR'
          }
        };
      }
    } catch {
      // ignore parse error and use default
    }
  }

  // Fallback constructed from course price
  return getDefaultSellingPlans(course.price, course.currency);
}

/**
 * Saves selling plans for a course to localStorage for immediate multi-tab sync.
 */
export function saveCourseSellingPlans(courseId, plans) {
  if (!courseId || !plans) return;
  try {
    localStorage.setItem(`${STORAGE_KEY_SELLING_PLANS}${courseId}`, JSON.stringify(plans));
    window.dispatchEvent(new CustomEvent('onetutor-selling-plans-updated', {
      detail: { courseId: String(courseId), plans }
    }));
  } catch (err) {
    console.warn('[courseSellingPlans] Failed to save selling plans to storage:', err);
  }
}

/**
 * Gets the active selling plans for a course, prioritizing localStorage for latest live edits.
 */
export function getCourseSellingPlans(courseId, course) {
  if (!courseId && !course) return null;
  const id = courseId || course?.id;

  // Try localStorage first for latest live updates
  if (id) {
    try {
      const local = localStorage.getItem(`${STORAGE_KEY_SELLING_PLANS}${id}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && (parsed.liveOnly || parsed.liveAndRecorded || parsed.recordedOnly)) {
          return {
            liveOnly: {
              enabled: parsed.liveOnly?.enabled !== false,
              price: parsed.liveOnly?.price !== undefined ? Number(parsed.liveOnly.price) : 0,
              currency: parsed.liveOnly?.currency || course?.currency || 'INR'
            },
            liveAndRecorded: {
              enabled: parsed.liveAndRecorded?.enabled !== false,
              price: parsed.liveAndRecorded?.price !== undefined ? Number(parsed.liveAndRecorded.price) : 0,
              currency: parsed.liveAndRecorded?.currency || course?.currency || 'INR'
            },
            recordedOnly: {
              enabled: parsed.recordedOnly?.enabled !== false,
              price: parsed.recordedOnly?.price !== undefined ? Number(parsed.recordedOnly.price) : 0,
              currency: parsed.recordedOnly?.currency || course?.currency || 'INR'
            }
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return parseSellingPlans(course);
}

/**
 * Returns an array of enabled plan definition objects with their current prices.
 */
export function getAvailablePlanList(course) {
  if (!course || course.pricingType === 'free' || Number(course.price) === 0) {
    return [];
  }
  const plans = getCourseSellingPlans(course.id, course) || getDefaultSellingPlans(course.price, course.currency);
  const currencySymbol = course.currency === 'USD' ? '$' : course.currency === 'EUR' ? '€' : course.currency === 'GBP' ? '£' : '₹';

  return PLAN_DEFINITIONS.filter(def => {
    const config = plans[def.key];
    return !config || config.enabled !== false;
  }).map(def => {
    const config = plans[def.key];
    const price = config && config.price !== undefined ? Number(config.price) : def.defaultPrice;
    const formattedPrice = Number.isInteger(price) ? price.toLocaleString() : price.toFixed(2);
    return {
      ...def,
      price,
      currency: course.currency || 'INR',
      currencySymbol,
      displayPrice: `${currencySymbol}${formattedPrice}`
    };
  });
}

/**
 * Saves the student's chosen plan on successful enrollment or payment.
 */
export function saveStudentEnrolledPlan(courseId, studentIdentifier, planId) {
  if (!courseId || !planId) return;
  try {
    const key = `${STORAGE_KEY_ENROLLED_PLANS}${courseId}_${studentIdentifier || 'current'}`;
    localStorage.setItem(key, planId);

    // Also set a course-level fallback key
    localStorage.setItem(`${STORAGE_KEY_ENROLLED_PLANS}${courseId}`, planId);

    window.dispatchEvent(new CustomEvent('onetutor-enrolled-plan-updated', {
      detail: { courseId: String(courseId), planId }
    }));
  } catch (err) {
    console.warn('[courseSellingPlans] Failed to save enrolled plan:', err);
  }
}

/**
 * Retrieves the enrolled plan definition for a student in a course.
 */
export function getStudentEnrolledPlan(courseId, studentIdentifier, enrollment = null) {
  // If explicitly in enrollment object
  if (enrollment?.planType && PLAN_TYPES[enrollment.planType]) {
    const found = PLAN_DEFINITIONS.find(p => p.id === enrollment.planType);
    if (found) return found;
  }

  // Look in localStorage
  if (courseId) {
    try {
      let stored = null;
      if (studentIdentifier) {
        stored = localStorage.getItem(`${STORAGE_KEY_ENROLLED_PLANS}${courseId}_${studentIdentifier}`);
      }
      if (!stored) {
        stored = localStorage.getItem(`${STORAGE_KEY_ENROLLED_PLANS}${courseId}`);
      }
      if (stored && PLAN_TYPES[stored]) {
        const found = PLAN_DEFINITIONS.find(p => p.id === stored);
        if (found) return found;
      }
    } catch {
      // ignore
    }
  }

  // Default to FULL_ACCESS so existing enrollments and free courses have full features
  return PLAN_DEFINITIONS.find(p => p.id === PLAN_TYPES.FULL_ACCESS);
}

/**
 * Checks whether a given planType allows a feature ('live' or 'recordings').
 */
export function checkPlanAccess(planType, feature) {
  if (!planType) return true; // default open
  const def = typeof planType === 'string'
    ? PLAN_DEFINITIONS.find(p => p.id === planType)
    : planType;

  if (!def) return true;
  if (feature === 'live') return !!def.allowsLive;
  if (feature === 'recordings') return !!def.allowsRecordings;
  return true;
}
