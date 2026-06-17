/**
 * Pendo/Novus Analytics Tracking Utility
 * Provides wrapper functions for tracking user activities in xLearn
 */

// Get the global pendo object
const getPendoInstance = () => {
  return (window as any).pendo;
};

/**
 * Initialize Pendo with user metadata
 */
export const initializePendo = (userId: string, email: string | null, displayName: string | null) => {
  const pendo = getPendoInstance();
  if (pendo && pendo.initialize) {
    pendo.initialize({
      visitor: {
        id: userId,
        email: email || undefined,
        displayName: displayName || undefined
      }
    });
  }
};

/**
 * Track a generic event
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  const pendo = getPendoInstance();
  if (pendo && pendo.track) {
    pendo.track(eventName, properties || {});
  } else {
    console.log(`[Analytics] Event: ${eventName}`, properties);
  }
};

/**
 * Plan Created - when user submits new course form
 */
export const trackPlanCreated = (planId: string, topic: string, planType: string, timeframe: string) => {
  trackEvent('Plan Created', {
    planId,
    topic,
    planType,
    timeframe,
    timestamp: new Date().toISOString()
  });
};

/**
 * Plan Opened - when user clicks "Enter Classroom"
 */
export const trackPlanOpened = (planId: string, planTopic: string) => {
  trackEvent('Plan Opened', {
    planId,
    planTopic,
    timestamp: new Date().toISOString()
  });
};

/**
 * Session Started - when user clicks "Start Session"
 */
export const trackSessionStarted = (planId: string, sessionId: string, sessionTitle: string) => {
  trackEvent('Session Started', {
    planId,
    sessionId,
    sessionTitle,
    timestamp: new Date().toISOString()
  });
};

/**
 * Session Content Generated - when AI generates notes/flashcards/videos
 */
export const trackSessionContentGenerated = (planId: string, sessionId: string, contentType: string) => {
  trackEvent('Session Content Generated', {
    planId,
    sessionId,
    contentType,
    timestamp: new Date().toISOString()
  });
};

/**
 * Quiz Submitted - when user submits evaluation quiz
 */
export const trackQuizSubmitted = (planId: string, sessionId: string, score: number, totalQuestions: number) => {
  trackEvent('Quiz Submitted', {
    planId,
    sessionId,
    score,
    totalQuestions,
    percentage: ((score / totalQuestions) * 100).toFixed(2),
    timestamp: new Date().toISOString()
  });
};

/**
 * Session Completed - when user unlocks next session
 */
export const trackSessionCompleted = (planId: string, sessionId: string, sessionTitle: string) => {
  trackEvent('Session Completed', {
    planId,
    sessionId,
    sessionTitle,
    timestamp: new Date().toISOString()
  });
};

/**
 * Course Completed - when user finishes final session
 */
export const trackCourseCompleted = (planId: string, planTopic: string, totalSessions: number) => {
  trackEvent('Course Completed', {
    planId,
    planTopic,
    totalSessions,
    timestamp: new Date().toISOString()
  });
};

/**
 * AI Diagnostic Requested - when user clicks "Perform AI Diagnostic"
 */
export const trackAIDiagnosticRequested = (userId: string) => {
  trackEvent('AI Diagnostic Requested', {
    userId,
    timestamp: new Date().toISOString()
  });
};

export default {
  initializePendo,
  trackEvent,
  trackPlanCreated,
  trackPlanOpened,
  trackSessionStarted,
  trackSessionContentGenerated,
  trackQuizSubmitted,
  trackSessionCompleted,
  trackCourseCompleted,
  trackAIDiagnosticRequested
};
