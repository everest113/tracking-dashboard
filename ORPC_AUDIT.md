# oRPC Implementation Audit

**Date:** 2026-02-11  
**Branch:** feature/upcoming-changes  
**Status:** ❌ Non-functional (404 errors on all endpoints)

## Summary

Our oRPC implementation has **5 critical issues** preventing it from working. The main problems are using the wrong handler class, incorrect route structure, and misunderstanding how to compose routers.

---

## Issues Found

### 🔴 CRITICAL #1: Using Wrong Handler Class

**Current:**
```typescript
// app/api/orpc/[...orpc]/route.ts
import { ORPCHandler } from '@orpc/server/fetch'
```

**Official Docs:**
```typescript
import { RPCHandler } from '@orpc/server/fetch'
```

**Impact:** `ORPCHandler` doesn't exist in `@orpc/server/fetch` exports. This is likely causing TypeScript/runtime errors.

**Fix:** Change `ORPCHandler` → `RPCHandler`

---

### 🔴 CRITICAL #2: Using `serve` Wrapper Incorrectly

**Current:**
```typescript
// app/api/orpc/[...orpc]/route.ts
import { serve } from '@orpc/server/next'

const handler = new ORPCHandler(appRouter)
const serveResult = serve<Context>(handler, {
  context: (req) => createContext(req),
})

export const GET = serveResult.GET
export const POST = serveResult.POST
// etc.
```

**Official Docs:**
```typescript
import { RPCHandler } from '@orpc/server/fetch'

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error(error)
    }),
  ],
})

async function handleRequest(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: '/rpc',
    context: {}, // Provide initial context if needed
  })

  return response ?? new Response('Not found', { status: 404 })
}

export const HEAD = handleRequest
export const GET = handleRequest
export const POST = handleRequest
export const PUT = handleRequest
export const PATCH = handleRequest
export const DELETE = handleRequest
```

**Impact:** The `serve` wrapper from `@orpc/server/next` may not properly handle routing. The docs show direct `handler.handle()` calls.

**Fix:** Remove `serve` wrapper, call `handler.handle()` directly with proper `prefix`

---

### 🔴 CRITICAL #3: Missing `prefix` Option

**Current:**
```typescript
// No prefix specified in handler.handle() call
```

**Official Docs:**
```typescript
const { response } = await handler.handle(request, {
  prefix: '/rpc',  // <-- Required!
  context: {},
})
```

**Impact:** The handler doesn't know where to strip the prefix from the URL path. Calling `/api/orpc/shipments.list` can't match `shipments.list` without knowing to strip `/api/orpc`.

**Fix:** Add `prefix: '/api/orpc'` to handler.handle() options

---

### 🟡 WARNING #4: Route File Name

**Current:**
```
app/api/orpc/[...orpc]/route.ts
```

**Recommended (from docs):**
```
app/rpc/[[...rest]]/route.ts
```

**Differences:**
- Docs use `/rpc` not `/api/orpc` (simpler path)
- Docs use `[[...rest]]` (optional catch-all) not `[...orpc]` (required catch-all)
- Docs use generic name `rest` not `orpc`

**Impact:** Minor - our path works, but optional catch-all `[[...]]` is more flexible (handles both `/api/orpc` and `/api/orpc/foo`).

**Fix:** Consider renaming to `app/api/orpc/[[...rest]]/route.ts`

---

### 🟢 INFO #5: Router Structure - Actually Correct!

**Current:**
```typescript
// We wrapped with os.router() - this is WRONG
export const appRouter = os.router({
  'shipments.list': shipmentsRouter.list,
  'shipments.create': shipmentsRouter.create,
  // ...
})
```

**Official Docs:**
```typescript
// Plain object - no os.router() wrapper!
export const router = {
  planet: {
    list: listPlanet,
    find: findPlanet,
    create: createPlanet
  }
}
```

**Impact:** **Using `os.router()` is actually OPTIONAL**. Plain objects work fine. Our flattened structure with dot notation keys (`'shipments.list'`) might be the issue - oRPC expects nested objects.

**Fix:** 
```typescript
// Option A: Plain nested object (recommended)
export const appRouter = {
  shipments: shipmentsRouter,
  trackingStats: trackingStatsRouter,
  // ...
}

// Option B: Keep os.router() but nested, not flattened
export const appRouter = os.router({
  shipments: shipmentsRouter,
  trackingStats: trackingStatsRouter,
  // ...
})
```

---

## Client Issues

### ✅ CORRECT: Client Setup

**Current:**
```typescript
import { ORPCLink } from '@orpc/client/fetch'

const link = new ORPCLink({
  url: getBaseURL(), // Returns window.location.origin + '/api/orpc'
})

export const api = createORPCClient<AppRouter>(link)
```

**Status:** ✅ This is correct! `ORPCLink` is the right class name (docs may show `RPCLink` as an alias).

**Note:** Once server is fixed, client should work as-is.

---

## Logging/Middleware

### ✅ CORRECT: Logging Infrastructure

**Current:**
```typescript
// lib/orpc/base.ts
export const publicProcedure = os
  .$context<Context>()
  .use(async ({ context, next }) => {
    const start = Date.now()
    const { logger } = context
    
    logger.info('📥 Request started')
    
    try {
      const result = await next()
      const duration = Date.now() - start
      logger.info(`✅ Request completed in ${duration}ms`)
      console.log(`✅ Request completed in ${duration}ms`)
      return result
    } catch (error) {
      const duration = Date.now() - start
      logger.error(`❌ Request failed in ${duration}ms`)
      console.error(`❌ Request failed in ${duration}ms`, error)
      throw error
    }
  })
```

**Status:** ✅ This approach is correct and follows oRPC middleware patterns.

---

## Next.js Compatibility

### ✅ CORRECT: Next.js Version

**Current:**
```json
{
  "dependencies": {
    "next": "15.5.12"
  }
}
```

**oRPC Requirements:**
```json
{
  "peerDependencies": {
    "next": ">=14.0.0"
  }
}
```

**Status:** ✅ Next.js 15.5.12 meets requirements (>=14.0.0)

**Note:** However, Turbopack in Next.js 15 has stability issues (worker thread crashes). These may be unrelated to oRPC.

---

## Recommended Fixes (Priority Order)

### 1. Fix Route Handler (CRITICAL)

```typescript
// app/api/orpc/[[...rest]]/route.ts
import { RPCHandler } from '@orpc/server/fetch'  // Changed from ORPCHandler
import { appRouter } from '@/lib/orpc/router'
import { createContext, type Context } from '@/lib/orpc/context'
import { onError } from '@orpc/server'

const handler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error('🔴 oRPC Error:', error)
    }),
  ],
})

async function handleRequest(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: '/api/orpc',  // Critical: tells handler where to strip path
    context: await createContext(request),
  })

  return response ?? new Response('Not found', { status: 404 })
}

export const HEAD = handleRequest
export const GET = handleRequest
export const POST = handleRequest
export const PUT = handleRequest
export const PATCH = handleRequest
export const DELETE = handleRequest
```

### 2. Fix Router Structure

```typescript
// lib/orpc/router.ts - REMOVE os.router() wrappers on individual routers
// Just export plain objects

const shipmentsRouter = {
  list: publicProcedure.input(...).handler(...),
  create: publicProcedure.input(...).handler(...),
}

const trackingStatsRouter = {
  get: publicProcedure.output(...).handler(...),
}

// etc...

// Then compose - plain object, no os.router()
export const appRouter = {
  shipments: shipmentsRouter,
  trackingStats: trackingStatsRouter,
  syncHistory: syncHistoryRouter,
  manualUpdateTracking: manualUpdateTrackingRouter,
  trackers: trackersRouter,
  front: frontRouter,
}

export type AppRouter = typeof appRouter
```

### 3. Update Context Creation

```typescript
// lib/orpc/context.ts
import { createLogger } from '@/lib/infrastructure/logging/server-logger'

export type Context = {
  logger: ReturnType<typeof createLogger>
}

export async function createContext(request: Request): Promise<Context> {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  
  return {
    logger: createLogger({
      requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent') || undefined,
    }),
  }
}
```

### 4. Test After Changes

```bash
# Clear caches
rm -rf .next node_modules/.cache .turbopack

# Start server
PORT=3001 pnpm dev

# Test endpoint
curl -X POST http://localhost:3001/api/orpc/shipments.list \
  -H "Content-Type: application/json" \
  -d '{"pagination":{"page":1,"pageSize":5}}'
```

---

## What Was Actually Correct

✅ **Router business logic** - All procedures are well-structured  
✅ **Zod schemas** - Input/output validation is solid  
✅ **Logging middleware** - Pino integration is correct  
✅ **Client setup** - ORPCLink configuration is right  
✅ **Component migrations** - All frontend code using `api.*.*()` is correct  
✅ **Next.js version** - 15.5.12 is compatible  

---

## Root Cause Analysis

The core issue is **misunderstanding the official oRPC Next.js adapter pattern**:

1. We used `ORPCHandler` (doesn't exist) instead of `RPCHandler`
2. We used the `serve` wrapper instead of direct `handler.handle()` calls
3. We didn't provide the critical `prefix` option to tell the handler where to strip paths
4. We over-complicated the router with `os.router()` wrappers (plain objects work fine)

These issues prevented the handler from ever matching incoming requests → 404 errors.

---

## Time Investment vs. Alternatives

- **Time spent debugging:** ~3 hours
- **Estimated time to fix:** 30-60 minutes with these changes
- **Risk:** Medium (Turbopack crashes may be unrelated to oRPC)

### Alternatives if fixes fail:
1. **Downgrade to Next.js 14** - More stable Turbopack, oRPC's primary target
2. **Switch to tRPC** - More mature, better Next.js integration, larger community
3. **Enhanced API routes** - Keep current API routes, add type generation (e.g., with openapi-typescript)

---

## References

- [oRPC Next.js Adapter Docs](https://orpc.dev/docs/adapters/next)
- [oRPC Getting Started](https://orpc.dev/docs/getting-started)
- [oRPC GitHub Examples](https://github.com/unnoq/orpc)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
