import { serve } from '@orpc/server/next'
import { ORPCHandler } from '@orpc/server/fetch'
import { appRouter } from '@/lib/orpc/router'
import { createContext, type Context } from '@/lib/orpc/context'

const handler = new ORPCHandler(appRouter)

export const { GET, POST, PUT, PATCH, DELETE } = serve<Context>(handler, {
  context: (req) => createContext(req),
})
