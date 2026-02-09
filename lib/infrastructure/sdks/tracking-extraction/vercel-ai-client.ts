import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { ExtractionResultSchema, type EmailMessage, type ExtractionResult } from './schemas'
import { SYSTEM_PROMPT, buildExtractionPrompt } from './prompts'

/**
 * Vercel AI SDK client for tracking extraction
 * Uses structured outputs with Zod validation
 */
export class TrackingExtractionClient {
  private readonly model: string

  constructor(model: string = 'gpt-4o-mini') {
    this.model = model
  }

  /**
   * Extract tracking information from email messages using AI
   */
  async extractFromEmails(messages: EmailMessage[]): Promise<ExtractionResult> {
    try {
      const prompt = buildExtractionPrompt(messages)

      // Use Vercel AI SDK's generateObject for structured output
      const { object } = await generateObject({
        model: openai(this.model),
        schema: ExtractionResultSchema,
        system: SYSTEM_PROMPT,
        prompt,
      })

      // Normalize tracking numbers
      const normalizedShipments = object.shipments
        .filter(shipment => {
          // Filter out invalid tracking numbers
          if (!shipment.trackingNumber || typeof shipment.trackingNumber !== 'string') {
            console.warn('Skipping shipment with invalid tracking number:', shipment)
            return false
          }
          return true
        })
        .map(shipment => ({
          ...shipment,
          trackingNumber: shipment.trackingNumber
            .toUpperCase()
            .replace(/[\s-]/g, ''),
        }))

      return {
        ...object,
        shipments: normalizedShipments,
      }
    } catch (error) {
      console.error('Tracking extraction error:', error)
      return { shipments: [] }
    }
  }
}

/**
 * Factory function for creating client
 */
export function createTrackingExtractionClient(model?: string): TrackingExtractionClient {
  return new TrackingExtractionClient(model)
}
