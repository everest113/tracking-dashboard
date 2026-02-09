import { NextResponse } from 'next/server'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { Ship24WebhookPayloadSchema } from '@/lib/infrastructure/sdks/ship24/schemas'
import crypto from 'crypto'

/**
 * Verify Ship24 webhook signature
 */
function verifyShip24Signature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false
  
  try {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Ship24 Webhook Endpoint (DDD version)
 * Uses the new Domain-Driven Design architecture
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    
    // Verify signature if configured
    const signature = request.headers.get('x-ship24-signature') || 
                     request.headers.get('ship24-signature')
    const signingSecret = process.env.SHIP24_WEBHOOK_SIGNING_SECRET
    
    if (signingSecret && signature) {
      const isValid = verifyShip24Signature(rawBody, signature, signingSecret)
      if (!isValid) {
        console.error('Webhook: Invalid Ship24 signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      console.log('✅ Ship24 signature verified')
    }

    // Parse and validate payload with Zod
    const json = JSON.parse(rawBody)
    const validationResult = Ship24WebhookPayloadSchema.safeParse(json)
    
    if (!validationResult.success) {
      console.error('Webhook: Invalid payload schema', validationResult.error)
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const payload = validationResult.data
    console.log('=== Ship24 Webhook Received (DDD) ===')

    const tracking = payload.data.trackings[0]
    
    if (!tracking) {
      console.warn('Webhook: No tracking data in payload')
      return NextResponse.json({ success: true, message: 'No tracking data' })
    }

    const tracker = tracking.tracker
    const trackerId = tracker.trackerId
    const trackingNumber = tracker.trackingNumber

    if (!trackerId || !trackingNumber) {
      console.error('Webhook: Missing trackerId or trackingNumber')
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Process webhook using service
    const service = getShipmentTrackingService()
    const result = await service.processWebhook(trackerId, trackingNumber, tracking)

    const duration = Date.now() - startTime

    const response = {
      ...result,
      trackerId,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    }

    console.log('Webhook processed:', response)

    if (result.statusChanged) {
      console.log(`  ✅ Status changed: ${result.oldStatus} → ${result.newStatus}`)
      if (result.newStatus === 'delivered') {
        console.log(`  🎉 DELIVERED: ${trackingNumber}`)
      }
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('=== Webhook Error ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process webhook',
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * Handle HEAD requests (Ship24 validates webhook URL with HEAD)
 */
export async function HEAD(request: Request) {
  return new NextResponse(null, { status: 200 })
}
