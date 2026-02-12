import { RPCHandler } from '@orpc/server/fetch'
import { onError } from '@orpc/server'
import { appRouter } from '@/lib/orpc/router'
import { createContext } from '@/lib/orpc/context'

// Next.js: Force dynamic rendering (no static generation for API routes)
export const dynamic = 'force-dynamic'

const isDev = process.env.NODE_ENV === 'development'

const handler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      // Always log errors
      console.error('🔴 oRPC Error:', error)
      
      // Log Zod validation errors if present
      if (error.cause && 'issues' in error.cause) {
        console.error('📋 Validation issues:', JSON.stringify(error.cause.issues, null, 2))
      }
    }),
  ],
})

async function handleRequest(request: Request) {
  const url = new URL(request.url)
  
  // Only log requests in development
  if (isDev) {
    console.log('🌐 Request:', request.method, url.pathname)
  }
  
  try {
    const result = await handler.handle(request, {
      prefix: '/api/orpc',
      context: await createContext(request),
    })

    if (result.response) {
      if (isDev) {
        console.log('✅ Response:', result.response.status)
      }
      return result.response
    } else {
      if (isDev) {
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
