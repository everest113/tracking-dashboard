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

// Maximum tracking numbers per extraction (prevents SKU floods)
const MAX_TRACKING_PER_EXTRACTION = 20

/**
 * Additional validation for tracking numbers
 * Returns true if the tracking number looks valid for the carrier
 * 
 * IMPORTANT: Be conservative - false negatives are better than false positives
 * to avoid wasting Ship24 API calls on non-tracking numbers
 */
function validateTrackingNumber(trackingNumber: string, carrier: string): boolean {
  const cleaned = trackingNumber.toUpperCase().replace(/[\s-]/g, '')
  
  switch (carrier) {
    case 'ups':
      // UPS: 1Z + 16 alphanumeric = 18 total (very reliable format)
      return /^1Z[A-Z0-9]{16}$/.test(cleaned)
    
    case 'usps':
      // USPS: 20-22 digits starting with 9 (most common prefix)
      // OR international format: 2 letters + 9 digits + 2 letters
      return /^9\d{19,21}$/.test(cleaned) || /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(cleaned)
    
    case 'fedex':
      // FedEx Express: 12 digits starting with 7 or 4 (common prefixes)
      // FedEx Ground: 15 digits starting with 9
      // Be conservative to avoid SKU/invoice numbers
      if (/^[47]\d{11}$/.test(cleaned)) return true // Express
      if (/^9\d{14}$/.test(cleaned)) return true // Ground
      return false
    
    case 'dhl':
      // DHL: Only accept JJD waybill format (10-digit pure numeric is too risky)
      return /^JJD\d{10,}$/i.test(cleaned)
    
    case 'other':
      // For "other" carriers, reject pure numeric (too risky for false positives)
      // Only accept if it has some structure (letters + numbers)
      return cleaned.length >= 10 && /[A-Z]/.test(cleaned) && /\d/.test(cleaned)
    
    default:
      return false // Reject unknown carriers
  }
}

/**
 * Filter out sequential numbers that are likely SKUs/item codes
 */
function filterSequentialShipments<T extends { trackingNumber: string }>(shipments: T[]): T[] {
  if (shipments.length <= 3) return shipments
  
  // Sort numeric-only tracking numbers
  const numericShipments = shipments.filter(s => /^\d+$/.test(s.trackingNumber))
  if (numericShipments.length <= 3) return shipments
  
  // Check for sequential patterns (common SKU increments: 1, 64, 128, 256, 1000)
  const nums = numericShipments.map(s => ({ ...s, value: BigInt(s.trackingNumber) }))
    .sort((a, b) => a.value < b.value ? -1 : 1)
  
  let sequentialCount = 0
  const suspiciousDiffs = [BigInt(1), BigInt(64), BigInt(128), BigInt(256), BigInt(512), BigInt(1000), BigInt(10000)]
  
  for (let i = 0; i < nums.length - 1; i++) {
    const diff = nums[i + 1].value - nums[i].value
    if (suspiciousDiffs.includes(diff)) {
      sequentialCount++
    }
  }
  
  // If more than 30% of numbers are sequential, it's likely SKU data - reject all numeric
  const sequentialRatio = sequentialCount / (nums.length - 1)
  if (sequentialRatio > 0.3) {
    console.warn(`[Extraction] Rejecting ${numericShipments.length} numbers due to sequential pattern (${(sequentialRatio * 100).toFixed(0)}% sequential)`)
    return shipments.filter(s => !/^\d+$/.test(s.trackingNumber))
  }
  
  return shipments
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
  let validatedShipments = result.shipments
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
  
  // Filter out sequential SKU-like numbers
  validatedShipments = filterSequentialShipments(validatedShipments)
  
  // Limit results to prevent floods
  if (validatedShipments.length > MAX_TRACKING_PER_EXTRACTION) {
    console.warn(`[Extraction] Limiting ${validatedShipments.length} tracking numbers to ${MAX_TRACKING_PER_EXTRACTION}`)
    validatedShipments = validatedShipments.slice(0, MAX_TRACKING_PER_EXTRACTION)
  }

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
    })

    // Combine results
    const shipments = trackingResult.shipments.map(tracking => ({
      trackingNumber: tracking.trackingNumber,
      carrier: tracking.carrier,
      poNumber: metadata.poNumber || '',
      shippedDate: tracking.shippedDate || '',  // Shipped date comes from tracking extraction
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
