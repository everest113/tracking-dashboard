import { os } from '@orpc/server'
import type { Context } from './context'

// Base procedure with context
const baseProcedure = os.$context<Context>()

// Public procedure with logging middleware
export const publicProcedure = baseProcedure.use(async ({ context, next, path }) => {
  const startTime = Date.now()
  const procedurePath = path.join('.')
  
  // Log to both structured logger AND console for visibility
  context.logger.info(`[oRPC] ${procedurePath}`, {
    path: procedurePath,
  })
  console.log(`🔵 [oRPC START] ${procedurePath}`)

  try {
    const result = await next({ context })
    const duration = Date.now() - startTime
    
    context.logger.info(`[oRPC] ${procedurePath} completed`, {
      path: procedurePath,
      durationMs: duration,
    })
    console.log(`✅ [oRPC OK] ${procedurePath} (${duration}ms)`)
    
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    
    context.logger.error(`[oRPC] ${procedurePath} failed`, {
      path: procedurePath,
      durationMs: duration,
      error,
    })
    console.error(`❌ [oRPC ERROR] ${procedurePath} (${duration}ms):`, error)
    
    throw error
  }
})
