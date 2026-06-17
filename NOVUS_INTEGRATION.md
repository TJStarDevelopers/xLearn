# Novus.ai Analytics Integration Guide

## Status: COMPLETE ✅

Your xLearn project now has complete Novus.ai (Pendo) analytics integration ready for the Mind the Product hackathon.

## What's Installed

### 1. Backend Components
- **Server Endpoint**: `/api/novus-token` (server.ts)
  - Securely exchanges your Novus credentials for authentication tokens
  - Uses your API Key, Secret, and App ID to get bearer tokens
  - Handles token caching to minimize API calls

### 2. Frontend Components
- **Novus SDK Loader** (index.html)
  - Loads official Pendo SDK from CDN: `https://cdn.pendo.io/pendo.js`
  - Initializes analytics tracking on page load
  
- **Tracking Utility** (src/utils/pendo.ts)
  - `initializePendo()` - Initialize tracking with user metadata
  - 8 tracked events:
    - Plan Created
    - Plan Opened
    - Session Started
    - Session Content Generated
    - Quiz Submitted (with scores)
    - Session Completed
    - Course Completed
    - AI Diagnostic Requested

### 3. Integration Points
Events are automatically tracked in:
- **App.tsx**: Plan creation, plan navigation, session management, course completion
- **ActiveSessionStudy.tsx**: Quiz submissions with scores
- **AIPerformanceCoach.tsx**: AI diagnostic requests

## Your Novus Credentials (Already Configured)

```
API Key: db1faccd-ee8b-49f1-bf23-62785e34cd0e
API Secret: 68abc1247d316699bd8bc2d856f3080f9393f3b41c61e96559110e90daf45e7c
App ID: 4798289792925696
```

These are embedded in `server.ts:866-875` for secure token exchange.

## How It Works

1. **User Signs In** → Firebase Auth
2. **Pendo Initialize** → Calls `initializePendo()` with user metadata
3. **Token Request** → Frontend calls `/api/novus-token` endpoint
4. **Token Exchange** → Server exchanges credentials with Novus API
5. **Authenticated Tracking** → All user actions sent to Novus with bearer token
6. **Dashboard** → Events appear in your Novus.ai dashboard

## Verification Steps

### 1. Check Server Endpoint
```bash
curl -X POST http://localhost:3000/api/novus-token \
  -H "Content-Type: application/json"
```

Should return:
```json
{
  "accessToken": "...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

### 2. Check Pendo SDK Loading
- Open browser DevTools Console (F12)
- Look for: `[Novus] Pendo SDK loaded successfully`
- Should appear on page load

### 3. Check User Initialization
- Sign in to xLearn with Google
- Console should show: `[Novus] Pendo initialized with user: [uid]`

### 4. Check Event Tracking
- Create a learning plan
- Console should show: `[Novus] Event tracked: Plan Created`
- Check Novus Dashboard → Events should appear after 30 seconds

## Debugging

### Events not appearing in Novus Dashboard?

**Check 1: Token Authentication**
```javascript
// In browser console
fetch('/api/novus-token')
  .then(r => r.json())
  .then(d => console.log('Token:', d.accessToken))
```

**Check 2: Pendo SDK Loaded**
```javascript
// In browser console
console.log('Pendo:', window.pendo)
console.log('Pendo.track:', window.pendo?.track)
```

**Check 3: Network Requests**
- Open DevTools → Network tab
- Look for POST requests to `novus-api.pendo.io`
- Should see token exchange and event submissions

**Check 4: Console Logs**
- All tracking operations log to console with `[Novus]` prefix
- Check for authentication or network errors

## Production Deployment

When deploying to Vercel:

1. The `/api/novus-token` endpoint works on Vercel serverless
2. Pendo SDK loads from CDN (no bundling needed)
3. All tracking calls work cross-origin with CORS headers enabled

Your Novus credentials are embedded in `server.ts` and will be deployed with your code.

## Next Steps for Hackathon

1. **Deploy to Vercel** (if not already)
   - Push from `firebase-integration` branch or merge to `main`
   - Vercel will automatically deploy

2. **Monitor Dashboard**
   - Go to https://novus-ai.pendo.io (or your Novus dashboard)
   - Use your credentials to log in
   - Monitor: Track events, Pages & click events, User journey

3. **Test User Journey**
   - Sign in with Google
   - Create a learning plan
   - Start a session
   - Submit a quiz
   - Check Novus dashboard for all events

4. **Share Dashboard Link**
   - For hackathon submission, you may need to provide read-only access to judges
   - Ask judges to view: Track events → Last 30 days

## Troubleshooting Network Errors

If you see "Unable to generate details for this session" errors:

These are NOT related to Novus tracking - they're related to Gemini API:
1. Check `GEMINI_API_KEY` environment variable is set
2. Ensure API quota limits aren't exceeded
3. App uses fallback content if Gemini fails

Novus tracking works independently of Gemini and will still capture all events.

## File Structure

```
xLearn/
├── server.ts                    # Novus token endpoint (line 861-899)
├── index.html                   # Pendo SDK loader
├── src/
│   ├── App.tsx                  # Tracking calls for plans/sessions
│   ├── utils/
│   │   └── pendo.ts            # All tracking functions
│   └── components/
│       ├── ActiveSessionStudy.tsx   # Quiz tracking
│       └── AIPerformanceCoach.tsx   # Diagnostic tracking
```

## Support

For Novus/Pendo documentation:
- https://pendo.io/documentation/
- https://novus.ai/docs/

For this integration issues:
- Check console logs with `[Novus]` prefix
- Verify `/api/novus-token` endpoint works
- Ensure Pendo SDK loads from CDN
