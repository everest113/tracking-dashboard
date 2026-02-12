import { RPCHandler } from '@orpc/server/fetch'
import { onError } from '@orpc/server'
import { appRouter } from '@/lib/orpc/router'
import { createContext } from '@/lib/orpc/context'

const handler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error('🔴 oRPC Error:', error)
    }),
  ],
})

async function handleRequest(request: Request) {
  const url = new URL(request.url)
  console.log('🌐 Request:', request.method, url.pathname)
  console.log('   Prefix: /api/orpc')
  console.log('   Path after prefix:', url.pathname.replace('/api/orpc', ''))
  
  try {
    const result = await handler.handle(request, {
      prefix: '/api/orpc',
      context: await createContext(request),
    })

    console.log('   Handler result:', { 
      hasResponse: !!result.response, 
      status: result.response?.status 
    })

    if (result.response) {
      console.log('✅ Response:', result.response.status)
      return result.response
    } else {
      console.log('❌ No matching procedure for path:', url.pathname)
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
