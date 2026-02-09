import { createExtractionClient } from '../../core'
import { TrackingExtractionResultSchema, type EmailMessage, type TrackingExtractionResult } from './schemas'
import { buildTrackingExtractionInstructions } from './prompts'

/**
 * Extract tracking information from email messages
 * 
 * This is a domain-optimized extraction module built on top of
 * the generic extraction core. It includes:
 * - Shipping-specific prompt engineering
 * - Tracking number validation and normalization
 * - Supplier identification logic
 */
export async function extractTracking(
  messages: EmailMessage[]
): Promise<TrackingExtractionResult> {
  // Validate input
  if (!messages || messages.length === 0) {
    return { supplier: null, shipments: [] }
  }

  // Create extraction client
  const client = createExtractionClient()

  // Build prompt from messages
  const instructions = buildTrackingExtractionInstructions(messages)

  try {
    // Extract using core client
    const result = await client.extract({
      input: '', // Instructions already contain the full context
      schema: TrackingExtractionResultSchema,
      instructions,
    })

    // Post-process: Normalize tracking numbers
    const normalizedShipments = result.shipments
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
      ...result,
      shipments: normalizedShipments,
    }
  } catch (error) {
    console.error('Tracking extraction error:', error)
    return { supplier: null, shipments: [] }
  }
}
