import { os } from '@orpc/server'
import type { Context } from './context'

// Base procedure with context
const baseProcedure = os.context<Context>()

// Public procedure with logging middleware
export const publicProcedure = baseProcedure.use(async ({ context, next, path }) => {
  const startTime = Date.now()
  
  context.logger.info(`[oRPC] ${path.join('.')}`, {
    path: path.join('.'),
  })

  try {
    const result = await next({ context })
    const duration = Date.now() - startTime
    
    context.logger.info(`[oRPC] ${path.join('.')} completed`, {
      path: path.join('.'),
      durationMs: duration,
    })
    
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    
    context.logger.error(`[oRPC] ${path.join('.')} failed`, {
      path: path.join('.'),
      durationMs: duration,
      error,
    })
    
    throw error
  }
})
