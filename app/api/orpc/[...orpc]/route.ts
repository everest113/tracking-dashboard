import { serve } from '@orpc/server/next'
import { ORPCHandler } from '@orpc/server/fetch'
import { appRouter } from '@/lib/orpc/router'
import { createContext, type Context } from '@/lib/orpc/context'

const handler = new ORPCHandler(appRouter)

// Wrap the serve functions to add logging
const serveResult = serve<Context>(handler, {
  context: (req) => createContext(req),
})

export const GET = async (req: any) => {
  console.log('🌐 GET request:', req.url, 'params:', req.nextUrl.searchParams.toString())
  return serveResult.GET(req)
}

export const POST = async (req: any) => {
  console.log('🌐 POST request:', req.url)
  return serveResult.POST(req)
}

export const { PUT, PATCH, DELETE } = serveResult
