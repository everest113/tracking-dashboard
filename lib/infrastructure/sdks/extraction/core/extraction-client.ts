import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { ExtractionClient, ExtractionInput, ExtractionOutput } from './types'
import type { z } from 'zod'

/**
 * Default system prompt for extraction tasks
 */
const DEFAULT_SYSTEM_PROMPT = `You are a precise data extraction assistant. 
Extract information exactly as specified in the schema.
Return only valid, high-confidence data.
If a field cannot be extracted with confidence, omit it.`

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

    try {
      const { object } = await generateObject({
        model: openai(model),
        schema,
        system,
        prompt: `${instructions}\n\n${text}`,
      })

      return object as ExtractionOutput<TSchema>
    } catch (error) {
      console.error('Extraction error:', error)
      throw error
    }
  }
}

/**
 * Factory function to create an extraction client
 */
export function createExtractionClient(): ExtractionClient {
  return new GenericExtractionClient()
}
