/**
 * Test endpoint to demonstrate the logger
 * 
 * Usage:
 * curl -X POST http://localhost:3000/api/test-logger \
 *   -H "Content-Type: application/json" \
 *   -d '{"test": "hello world"}'
 */

import { NextResponse } from 'next/server'
import { withLogging } from '@/lib/infrastructure/logging/middleware'
import { logPerformance } from '@/lib/infrastructure/logging'

export const POST = withLogging(async (request, { logger }) => {
  try {
    // Parse request body
    const body = await request.json()
    logger.info('Received test request', { body })

    // Simulate some work with performance tracking
    const endLog = logPerformance(logger, 'simulateWork')
    
    // Child logger with additional context
    const workLogger = logger.child({ operation: 'test-work' })
    
    workLogger.debug('Starting work', { input: body })
    
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 100))
    
    workLogger.debug('Work in progress', { progress: 50 })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    workLogger.info('Work completed', { result: 'success' })
    
    endLog() // Logs duration

    // Test different log levels
    logger.trace('This is a trace message')
    logger.debug('This is a debug message')
    logger.info('This is an info message')
    logger.warn('This is a warning', { warningType: 'test' })

    // Test error logging (without throwing)
    try {
      throw new Error('Test error - this is intentional')
    } catch (error) {
      logger.error('Caught test error', { error })
    }

    return NextResponse.json({
      success: true,
      message: 'Logger test completed',
    })
  } catch (error) {
    logger.fatal('Unexpected error in test endpoint', { error })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const GET = withLogging(async (request, { logger }) => {
  logger.info('GET request to test-logger')
  
  return NextResponse.json({
    message: 'Use POST to test the logger',
    examples: {
      curl: 'curl -X POST http://localhost:3000/api/test-logger -H "Content-Type: application/json" -d \'{"test": "hello"}\'',
    },
  })
})
