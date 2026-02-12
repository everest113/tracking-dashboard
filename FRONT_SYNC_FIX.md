# Front Email Sync Fix - Root Cause Analysis

## Problem
Front email sync stopped working after oRPC migration - API was returning 0 conversations even though Front API was working correctly when tested with curl.

## Root Cause
The Next.js dev server was using a **cached/stale Front API token** that had different permissions than the token in `.env.local`.

### Evidence
- App token `iat`: 1769675092
- .env.local token `iat`: 1769675037  

These were two different JWT tokens issued at different times, with potentially different scopes/permissions.

## Diagnosis Process
1. ✅ Confirmed inbox ID (`inb_jsvaf`) was correct
2. ✅ Confirmed API endpoint was correct (`/conversations/search/...`)
3. ✅ Confirmed base URL was correct (`api2.frontapp.com`)
4. ✅ Verified curl with same endpoint returned data (5 results, total: 33)
5. ❌ App returned 0 results with same endpoint
6. 🔍 Added debug logging to see exact API key being used
7. **💡 FOUND: App was using a different token than .env.local!**

## Solution
**Restart the dev server** to force reload environment variables from `.env.local`.

```bash
# Kill old dev server
pkill -f "next dev"

# Start fresh
npm run dev -- -p 3001
```

## Results (After Fix)
```json
{
  "conversationsProcessed": 22,
  "conversationsAlreadyScanned": 11,
  "shipmentsAdded": 4,
  "shipmentsSkipped": 2,
  "conversationsWithNoTracking": 15,
  "totalConversations": 33
}
```

## Changes Made
1. Reverted `lib/infrastructure/sdks/front/client.ts` to original working version (no custom domain)
2. Reverted `lib/infrastructure/sdks/front/schemas.ts` to original schemas  
3. Reverted `lib/infrastructure/sdks/base-client.ts` to original (removed debug logging)
4. Removed temporary test files

## Lessons Learned
1. **Next.js dev server caches environment variables** - changes to `.env.local` require server restart
2. **Always verify the actual values being used at runtime**, not just what's in config files
3. **JWT tokens can have different permissions** - similar tokens != same permissions
4. **Debug from first principles**: Don't assume environment vars are correct - log the actual values

## Prevention
- Consider adding a startup health check that validates critical API tokens
- Document that `.env.local` changes require dev server restart
- Add token validation/refresh logic if Front tokens expire

---

**Commit:** `39895c1` - "fix: revert Front SDK to original working state (no custom domain)"
**Date:** 2026-02-11
**Time to Resolution:** ~2 hours (including extensive debugging)
