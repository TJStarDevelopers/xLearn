/**
 * Novus.ai (Pendo) Analytics Tracking Utility
 * Properly authenticated and configured tracking for xLearn
 */

// Declare Pendo on window
declare global {
  interface Window {
    pendo?: any;
  }
}

// Get the global pendo object
const getPendoInstance = (): any => {
  return typeof window !== 'undefined' ? window.pendo : null;
};

// Store token globally
let novusToken: string | null = null;

/**
 * Fetch Novus authentication token from server
 */
async function getNovusToken(): Promise<string> {
  if (novusToken) {
    return novusToken;
  }

  try {
    const response = await fetch('/api/novus-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      console.error('[Novus] Token fetch failed:', response.statusText);
      return '';
    }

    const data = await response.json();
    novusToken = data.accessToken;
    console.log('[Novus] Token acquired successfully');
    return novusToken;
  } catch (error) {
    console.error('[Novus] Error fetching token:', error);
    return '';
  }
}

/**
 * Initialize Pendo with user metadata and proper authentication
 */
export const initializePendo = async (userId: string, email: string | null, displayName: string | null) => {
  try {
    // Wait for Pendo SDK to load
    let attempts = 0;
    while (!window.pendo && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.pendo) {
      console.warn('[Novus] Pendo SDK failed to load after timeout');
      return;
    }

    // Get authentication token
    const token = await getNovusToken();
    if (!token) {
      console.warn('[Novus] Could not obtain authentication token');
      return;
    }

    // Initialize Pendo with app ID and authentication
    window.pendo.initialize({
      appId: '4798289792925696',
      visitor: {
        id: userId,
        email: email || undefined,
        displayName: displayName || undefined,
        custom: {
          authenticated: true,
          initTimestamp: new Date().toISOString()
        }
      },
      // Use authenticated session
      _authToken: token,
      enableLogging: true
    });

    console.log('[Novus] Pendo initialized with user:', userId);
  } catch (error) {
    console.error('[Novus] Initialization error:', error);
  }
};

/**
 * Track a generic event with Novus
 */
export const trackEvent = async (eventName: string, properties?: Record<string, any>) => {
  try {
    const pendo = getPendoInstance();
    if (!pendo || !pendo.track) {
      console.warn(`[Novus] Pendo not ready. Event queued: ${eventName}`, properties);
      return;
    }

    // Send event to Novus with token authorization
    const token = await getNovusToken();
    if (!token) {
      console.warn('[Novus] No token available for event tracking');
      return;
    }

    // Use Pendo's track method with authentication headers
    pendo.track(eventName, {
      ...properties,
      _authToken: token,
      timestamp: new Date().toISOString()
    });

    console.log(`[Novus] Event tracked: ${eventName}`, properties);
  } catch (error) {
    console.error(`[Novus] Error tracking event ${eventName}:`, error);
  }
};

/**
 * Plan Created - when user submits new course form
 */
export const trackPlanCreated = async (planId: string, topic: string, planType: string, timeframe: string) => {
  await trackEvent('Plan Created', {
    planId,
    topic,
    planType,
    timeframe,
    timestamp: new Date().toISOString()
  });
};

/**
 * Plan Opened - when user enters a plan/classroom
 */
export const trackPlanOpened = async (planId: string, topic: string) => {
  await trackEvent('Plan Opened', {
    planId,
    topic,
    timestamp: new Date().toISOString()
  });
};

/**
 * Session Started - when user begins a study session
 */
export const trackSessionStarted = async (planId: string, sessionId: string, sessionTitle: string) => {
  await trackEvent('Session Started', {
    planId,
    sessionId,
    sessionTitle,
    timestamp: new Date().toISOString()
  });
};

/**
 * Session Content Generated - when AI generates study materials
 */
export const trackSessionContentGenerated = async (planId: string, sessionId: string, contentType: string) => {
  await trackEvent('Session Content Generated', {
    planId,
    sessionId,
    contentType,
    timestamp: new Date().toISOString()
  });
};

/**
 * Quiz Submitted - when user completes a quiz
 */
export const trackQuizSubmitted = async (planId: string, sessionId: string, score: number, totalQuestions: number) => {
  const percentage = Math.round((score / totalQuestions) * 100);
  await trackEvent('Quiz Submitted', {
    planId,
    sessionId,
    score,
    totalQuestions,
    percentage,
    timestamp: new Date().toISOString()
  });
};

/**
 * Session Completed - when user unlocks next session
 */
export const trackSessionCompleted = async (planId: string, sessionId: string, sessionTitle: string) => {
  await trackEvent('Session Completed', {
    planId,
    sessionId,
    sessionTitle,
    timestamp: new Date().toISOString()
  });
};

/**
 * Course Completed - when entire curriculum is finished
 */
export const trackCourseCompleted = async (planId: string, courseName: string, totalSessions: number) => {
  await trackEvent('Course Completed', {
    planId,
    courseName,
    totalSessions,
    completionTimestamp: new Date().toISOString()
  });
};

/**
 * AI Diagnostic Requested - when user requests performance analysis
 */
export const trackAIDiagnosticRequested = async (userId: string) => {
  await trackEvent('AI Diagnostic Requested', {
    userId,
    timestamp: new Date().toISOString()
  });
};
