import { createExtractionClient } from '../../core'
import { 
  TrackingOnlyResultSchema, 
  MetadataExtractionSchema,
  type EmailMessage, 
  type TrackingExtractionResult,
  type TrackingOnlyResult,
  type MetadataExtraction,
} from './schemas'
import { buildTrackingOnlyPrompt, buildMetadataPrompt } from './prompts'

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
 * Additional validation for tracking numbers
 * Returns true if the tracking number looks valid for the carrier
 */
function validateTrackingNumber(trackingNumber: string, carrier: string): boolean {
  const cleaned = trackingNumber.toUpperCase().replace(/[\s-]/g, '')
  
  switch (carrier) {
    case 'ups':
      // UPS: 1Z + 16 alphanumeric = 18 total
      return /^1Z[A-Z0-9]{16}$/.test(cleaned)
    
    case 'usps':
      // USPS: 20-22 digits OR 13 chars starting with 2 letters
      return /^\d{20,22}$/.test(cleaned) || /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(cleaned)
    
    case 'fedex':
      // FedEx: 12, 14, or 15 digits
      return /^\d{12}$/.test(cleaned) || /^\d{14,15}$/.test(cleaned)
    
    case 'dhl':
      // DHL: 10 digits (but NOT phone number pattern) OR JJD format
      // Reject if it looks like a US phone number (starts with common area code patterns)
      if (/^\d{10}$/.test(cleaned)) {
        // Reject obvious phone patterns (area codes starting with 2-9)
        const firstThree = cleaned.substring(0, 3)
        const phoneAreaCodes = ['800', '888', '877', '866', '855', '844', '833', '822']
        if (phoneAreaCodes.includes(firstThree)) return false
        // Accept if it looks like a DHL number
        return true
      }
      // JJD waybill format
      return /^JJD\d{10,}$/.test(cleaned)
    
    case 'other':
      // For "other" carriers, require at least 10 chars and some structure
      return cleaned.length >= 10
    
    default:
      return true
  }
}

/**
 * Step 1: Extract tracking numbers only
 */
async function extractTrackingOnly(messages: EmailMessage[]): Promise<TrackingOnlyResult> {
  const client = createExtractionClient()
  const prompt = buildTrackingOnlyPrompt(messages)

  const result = await client.extract({
    input: '',
    schema: TrackingOnlyResultSchema,
    instructions: prompt,
  })

  // Post-process: validate and normalize tracking numbers
  const validatedShipments = result.shipments
    .filter(shipment => {
      if (!shipment.trackingNumber || typeof shipment.trackingNumber !== 'string') {
        console.warn('[Extraction] Skipping shipment with invalid tracking number:', shipment)
        return false
      }
      
      // Normalize first
      const normalized = shipment.trackingNumber.toUpperCase().replace(/[\s-]/g, '')
      const cleaned = stripCarrierPrefix(normalized)
      
      // Validate against carrier format
      if (!validateTrackingNumber(cleaned, shipment.carrier)) {
        console.warn('[Extraction] Tracking number failed validation:', {
          original: shipment.trackingNumber,
          normalized: cleaned,
          carrier: shipment.carrier,
        })
        return false
      }
      
      // Reject low confidence
      if (shipment.confidence < 0.7) {
        console.warn('[Extraction] Rejecting low confidence tracking:', {
          trackingNumber: cleaned,
          confidence: shipment.confidence,
        })
        return false
      }
      
      return true
    })
    .map(shipment => ({
      ...shipment,
      trackingNumber: stripCarrierPrefix(
        shipment.trackingNumber.toUpperCase().replace(/[\s-]/g, '')
      ),
    }))

  return { shipments: validatedShipments }
}

/**
 * Step 2: Extract metadata (supplier, PO, dates)
 */
async function extractMetadata(messages: EmailMessage[]): Promise<MetadataExtraction> {
  const client = createExtractionClient()
  const prompt = buildMetadataPrompt(messages)

  const result = await client.extract({
    input: '',
    schema: MetadataExtractionSchema,
    instructions: prompt,
  })

  return result
}

/**
 * Extract tracking information from email messages
 * 
 * Two-step extraction:
 * 1. Extract tracking numbers (strict validation)
 * 2. If tracking found, extract metadata (supplier, PO, dates)
 */
export async function extractTracking(
  messages: EmailMessage[]
): Promise<TrackingExtractionResult> {
  if (!messages || messages.length === 0) {
    return { supplier: '', shipments: [] }
  }

  try {
    // Step 1: Extract tracking numbers
    console.log('[Extraction] Step 1: Extracting tracking numbers...')
    const trackingResult = await extractTrackingOnly(messages)
    
    // If no tracking numbers found, return early (skip metadata extraction)
    if (trackingResult.shipments.length === 0) {
      console.log('[Extraction] No tracking numbers found, skipping metadata extraction')
      return { supplier: '', shipments: [] }
    }
    
    console.log(`[Extraction] Found ${trackingResult.shipments.length} tracking number(s)`)
    
    // Step 2: Extract metadata (only if tracking found)
    console.log('[Extraction] Step 2: Extracting metadata...')
    const metadata = await extractMetadata(messages)
    
    console.log('[Extraction] Metadata:', {
      supplier: metadata.supplier || '(none)',
      poNumber: metadata.poNumber || '(none)',
      shippedDate: metadata.shippedDate || '(none)',
    })

    // Combine results
    const shipments = trackingResult.shipments.map(tracking => ({
      trackingNumber: tracking.trackingNumber,
      carrier: tracking.carrier,
      poNumber: metadata.poNumber || '',
      shippedDate: metadata.shippedDate || '',
      confidence: tracking.confidence,
    }))

    return {
      supplier: metadata.supplier || '',
      shipments,
    }
  } catch (error) {
    console.error('[Extraction] Error:', error)
    return { supplier: '', shipments: [] }
  }
}
