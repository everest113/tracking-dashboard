import type { z } from 'zod'

/**
 * Core types for the extraction framework
 */

export interface ExtractionInput<TSchema extends z.ZodType> {
  /** Unstructured input text to extract from */
  input: string
  
  /** Zod schema defining the expected output structure */
  schema: TSchema
  
  /** Instructions for the AI on what to extract */
  instructions: string
  
  /** System prompt (optional, defaults to generic extraction prompt) */
  system?: string
  
  /** AI model to use (optional, defaults to gpt-4o-mini) */
  model?: string
}

export type ExtractionOutput<TSchema extends z.ZodType> = z.infer<TSchema>

export interface ExtractionClient {
  extract<TSchema extends z.ZodType>(
    input: ExtractionInput<TSchema>
  ): Promise<ExtractionOutput<TSchema>>
}
