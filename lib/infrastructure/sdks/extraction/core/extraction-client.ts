import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { ExtractionClient, ExtractionInput, ExtractionOutput } from './types'
import type { z } from 'zod'

/**
 * Default system prompt for extraction tasks
 */
const DEFAULT_SYSTEM_PROMPT = `You are a precise data extraction assistant. 
Extract information exactly as specified in the schema.
ALL fields are required - use empty string "" for missing text fields.
Return only valid, high-confidence data.`

/**
 * Check if an error is a transient network error that should be retried
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const cause = (error as { cause?: Error }).cause
    
    // Check for common transient error codes
    const transientCodes = ['EPIPE', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']
    for (const code of transientCodes) {
      if (message.includes(code.toLowerCase())) return true
      if (cause && 'code' in cause && cause.code === code) return true
    }
    
    // Check for API connection errors
    if (message.includes('cannot connect to api')) return true
    if (message.includes('network error')) return true
    if (message.includes('socket hang up')) return true
    if (message.includes('write epipe')) return true
  }
  return false
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 5, baseDelayMs = 1000, maxDelayMs = 30000 } = options
  
  let lastError: unknown
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      // Only retry transient errors
      if (!isTransientError(error)) {
        throw error
      }
      
      if (attempt === maxAttempts) {
        console.error(`[Extraction] Failed after ${maxAttempts} attempts`, error)
        throw error
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs)
      const jitter = Math.random() * 0.3 * delay // 0-30% jitter
      const totalDelay = Math.round(delay + jitter)
      
      console.warn(`[Extraction] Attempt ${attempt} failed with transient error, retrying in ${totalDelay}ms...`)
      await sleep(totalDelay)
    }
  }
  
  throw lastError
}

/**
 * Generic extraction client powered by Vercel AI SDK
 * 
 * This is the core extraction engine that all domain-specific
 * modules use under the hood.
 */
export class GenericExtractionClient implements ExtractionClient {
  async extract<TSchema extends z.ZodType>(
    input: ExtractionInput<TSchema>
  ): Promise<ExtractionOutput<TSchema>> {
    const {
      input: text,
      schema,
      instructions,
      system = DEFAULT_SYSTEM_PROMPT,
      model = 'gpt-4o-mini',
    } = input

    return withRetry(async () => {
      const { object } = await generateObject({
        model: openai(model),
        schema,
        system,
        prompt: `${instructions}\n\n${text}`,
      })

      return object as ExtractionOutput<TSchema>
    }, {
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
    })
  }
}

/**
 * Factory function to create an extraction client
 */
export function createExtractionClient(): ExtractionClient {
  return new GenericExtractionClient()
}
