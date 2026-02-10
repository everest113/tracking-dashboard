import { createExtractionClient } from '../../core'
import { TrackingExtractionResultSchema, type EmailMessage, type TrackingExtractionResult } from './schemas'
import { buildTrackingExtractionInstructions } from './prompts'

/**
 * Extract tracking information from email messages
 */
export async function extractTracking(
  messages: EmailMessage[]
): Promise<TrackingExtractionResult> {
  if (!messages || messages.length === 0) {
    return { supplier: '', shipments: [] }
  }

  const client = createExtractionClient()
  const instructions = buildTrackingExtractionInstructions(messages)

  try {
    const result = await client.extract({
      input: '',
      schema: TrackingExtractionResultSchema,
      instructions,
    })

    // Normalize tracking numbers
    const normalizedShipments = result.shipments
      .filter(shipment => {
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
    return { supplier: '', shipments: [] }
  }
}
