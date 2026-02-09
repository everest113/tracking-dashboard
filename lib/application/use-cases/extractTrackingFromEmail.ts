import { extractTracking, type EmailMessage, type TrackingExtractionResult } from '@/lib/infrastructure/sdks/extraction'

/**
 * Use Case: Extract Tracking Information from Email
 * 
 * Orchestrates the extraction of tracking numbers, PO numbers,
 * carrier information, and supplier details from email messages.
 * 
 * This is a thin wrapper around the shipping module that adds
 * application-layer business rules.
 */
export async function extractTrackingFromEmail(
  messages: EmailMessage[]
): Promise<TrackingExtractionResult> {
  // Validate input
  if (!messages || messages.length === 0) {
    return { supplier: null, shipments: [] }
  }

  // Extract using shipping module
  const result = await extractTracking(messages)

  // Business rule: If supplier is missing and we have a sender, use sender as fallback
  if (!result.supplier && messages[0]?.senderName) {
    result.supplier = messages[0].senderName
  }

  return result
}
