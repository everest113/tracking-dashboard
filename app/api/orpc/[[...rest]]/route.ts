import { RPCHandler } from '@orpc/server/fetch'
import { onError } from '@orpc/shared'
import { appRouter } from '@/lib/orpc/router'
import { createContext } from '@/lib/orpc/context'

/**
 * Enable verbose request/response logging.
 * Set DEBUG_ORPC=true in .env.local to enable.
 */
const DEBUG_ORPC = process.env.DEBUG_ORPC === 'true'

const handler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error: unknown) => {
      // Always log errors (these are important regardless of debug mode)
      console.error('🔴 oRPC Error:', error)
      
      // Log Zod validation errors if present
      if (error instanceof Error && error.cause && typeof error.cause === 'object' && 'issues' in error.cause) {
        console.error('📋 Validation issues:', JSON.stringify((error.cause as { issues: unknown[] }).issues, null, 2))
      }
    }),
  ],
})

async function handleRequest(request: Request) {
  const url = new URL(request.url)
  
  if (DEBUG_ORPC) {
    console.log('🌐 Request:', request.method, url.pathname)
  }
  
  try {
    const result = await handler.handle(request, {
      prefix: '/api/orpc',
      context: await createContext(request),
    })

    if (result.response) {
      if (DEBUG_ORPC) {
        console.log('✅ Response:', result.response.status)
      }
      return result.response
    } else {
      if (DEBUG_ORPC) {
        console.log('❌ No matching procedure for path:', url.pathname)
      }
      return new Response('Not found', { status: 404 })
    }
  } catch (error) {
    console.error('🔴 oRPC Handler Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export const HEAD = handleRequest
export const GET = handleRequest
export const POST = handleRequest
export const PUT = handleRequest
export const PATCH = handleRequest
export const DELETE = handleRequest
