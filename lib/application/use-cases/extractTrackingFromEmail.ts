import { createTrackingExtractionClient } from '@/lib/infrastructure/sdks/tracking-extraction/vercel-ai-client'
import type { EmailMessage, ExtractionResult } from '@/lib/infrastructure/sdks/tracking-extraction/schemas'

/**
 * Use Case: Extract Tracking Information from Email
 * 
 * Orchestrates the extraction of tracking numbers, PO numbers,
 * carrier information, and supplier details from email messages.
 */
export async function extractTrackingFromEmail(
  messages: EmailMessage[]
): Promise<ExtractionResult> {
  // Validate input
  if (!messages || messages.length === 0) {
    return { shipments: [] }
  }

  // Create extraction client
  const client = createTrackingExtractionClient()

  // Extract tracking information
  const result = await client.extractFromEmails(messages)

  // Business rule: If supplier is missing and we have a sender, use sender as fallback
  if (!result.supplier && messages[0]?.senderName) {
    result.supplier = messages[0].senderName
  }

  return result
}
