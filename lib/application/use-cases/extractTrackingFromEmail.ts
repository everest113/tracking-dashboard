import { extractTracking, type EmailMessage, type TrackingExtractionResult } from '@/lib/infrastructure/sdks/extraction'

export async function extractTrackingFromEmail(
  messages: EmailMessage[]
): Promise<TrackingExtractionResult> {
  if (!messages || messages.length === 0) {
    return { supplier: '', shipments: [] }
  }

  const result = await extractTracking(messages)

  // Fallback: Use sender name if supplier not found
  if (!result.supplier && messages[0]?.senderName) {
    result.supplier = messages[0].senderName
  }

  return result
}
