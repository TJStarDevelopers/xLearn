/**
 * Novus.ai (Pendo) Analytics Tracking Utility
 * Uses Novus REST API for event tracking with server-side authentication
 */

declare global {
  interface Window {
    pendo?: any;
  }
}

// Store token globally
let novusToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Fetch Novus authentication token from server
 */
async function getNovusToken(): Promise<string> {
  const now = Date.now();
  
  // Return cached token if still valid
  if (novusToken && now < tokenExpiresAt) {
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
    // Token expires in (expiresIn - 60 seconds) to refresh before expiry
    tokenExpiresAt = now + (data.expiresIn * 1000) - 60000;
    console.log('[Novus] Token acquired successfully, expires in', Math.floor((tokenExpiresAt - now) / 1000), 'seconds');
    return novusToken;
  } catch (error) {
    console.error('[Novus] Error fetching token:', error);
    return '';
  }
}

/**
 * Initialize Pendo SDK for session replay
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

    // Initialize Pendo for session replay and visitor tracking
    window.pendo.initialize({
      appId: '4798289792925696',
      visitor: {
        id: userId,
        email: email || 'unknown',
        displayName: displayName || 'User'
      },
      account: {
        id: 'xlearn-app'
      }
    });

    console.log('[Novus] Pendo initialized for user:', userId);
  } catch (error) {
    console.error('[Novus] Initialization error:', error);
  }
};

/**
 * Track a generic event with Novus via REST API
 */
export const trackEvent = async (eventName: string, properties?: Record<string, any>) => {
  try {
    const token = await getNovusToken();
    if (!token) {
      console.warn('[Novus] No token available for event tracking');
      return;
    }

    const eventPayload = {
      event: eventName,
      properties: {
        ...properties,
        timestamp: new Date().toISOString()
      }
    };

    // Send event directly to Novus API via server endpoint
    const response = await fetch('/api/novus-track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(eventPayload)
    });

    if (!response.ok) {
      console.error(`[Novus] Event tracking failed for ${eventName}:`, response.statusText);
      return;
    }

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
