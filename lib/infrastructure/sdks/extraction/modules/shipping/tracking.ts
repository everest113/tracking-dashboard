import { createExtractionClient } from '../../core'
import { TrackingExtractionResultSchema, type EmailMessage, type TrackingExtractionResult } from './schemas'
import { buildTrackingExtractionInstructions } from './prompts'

/**
 * Remove carrier prefixes from tracking numbers
 */
function stripCarrierPrefix(trackingNumber: string): string {
  const carrierPrefixes = ['UPS', 'USPS', 'FEDEX', 'DHL', 'ONTRAC', 'LASERSHIP']
  
  let cleaned = trackingNumber
  for (const prefix of carrierPrefixes) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length)
      break
    }
  }
  
  return cleaned
}

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
      .map(shipment => {
        // First normalize: uppercase and remove spaces/dashes
        let normalized = shipment.trackingNumber
          .toUpperCase()
          .replace(/[\s-]/g, '')
        
        // Then strip carrier prefix if present
        normalized = stripCarrierPrefix(normalized)
        
        return {
          ...shipment,
          trackingNumber: normalized,
        }
      })

    return {
      ...result,
      shipments: normalizedShipments,
    }
  } catch (error) {
    console.error('Tracking extraction error:', error)
    return { supplier: '', shipments: [] }
  }
}
