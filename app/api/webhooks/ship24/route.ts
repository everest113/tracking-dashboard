import { NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { prisma } from '@/lib/prisma'
import { Ship24Mapper } from '@/lib/infrastructure/mappers/Ship24Mapper'
import { ShipmentStatus } from '@/lib/domain/value-objects/ShipmentStatus'
import crypto from 'crypto'
import type { Prisma } from '@prisma/client'

/**
 * Verify Ship24 webhook signature
 * Ship24 signs webhooks using HMAC-SHA256
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
    
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch (error: unknown) {
    console.error('Signature verification error:', error)
    return false
  }
}

/**
 * Ship24 Webhook Endpoint
 * Receives real-time tracking updates from Ship24
 * 
 * Configure this URL in your Ship24 Dashboard:
 * https://dashboard.ship24.com/integrations/webhook/
 * 
 * Webhook URL: https://dash.stitchi.co/api/webhooks/ship24
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const payload = JSON.parse(rawBody)
    
    // Get Ship24 signature from headers (if provided)
    const signature = request.headers.get('x-ship24-signature') || 
                     request.headers.get('ship24-signature')
    
    // Verify signature if Ship24 provides one
    const signingSecret = process.env.SHIP24_WEBHOOK_SIGNING_SECRET
    if (signingSecret && signature) {
      const isValid = verifyShip24Signature(rawBody, signature, signingSecret)
      if (!isValid) {
        console.error('Webhook: Invalid Ship24 signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      console.log('✅ Ship24 signature verified')
    } else if (signingSecret && !signature) {
      console.warn('⚠️  No signature provided, but signing secret is configured')
    }
    
    // Fallback: URL secret validation (backward compatible)
    const url = new URL(request.url)
    const urlSecret = url.searchParams.get('secret')
    const urlSecretEnv = process.env.SHIP24_WEBHOOK_SECRET
    
    if (urlSecretEnv && (!urlSecret || urlSecret !== urlSecretEnv)) {
      console.error('Webhook: Invalid URL secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== Ship24 Webhook Received ===')
    console.log('Payload:', JSON.stringify(payload, null, 2))

    const tracking = payload.data?.trackings?.[0]
    
    if (!tracking) {
      console.warn('Webhook: No tracking data in payload')
      return NextResponse.json({ success: true, message: 'No tracking data' })
    }

    const tracker = tracking.tracker || {}
    const trackingNumber = tracker.trackingNumber
    const trackerId = tracker.trackerId

    if (!trackerId || !trackingNumber) {
      console.error('Webhook: Missing trackerId or trackingNumber')
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Find shipment in database by trackerId or trackingNumber
    const dbShipment = await prisma.shipments.findFirst({
      where: {
        OR: [
          { ship24_tracker_id: trackerId },
          { tracking_number: trackingNumber }
        ]
      }
    })

    if (!dbShipment) {
      console.warn(`Webhook: Shipment not found for tracker ${trackerId} / tracking ${trackingNumber}`)
      return NextResponse.json({ success: true, message: 'Shipment not found in database' })
    }

    // Map webhook data to domain
    const trackingUpdate = Ship24Mapper.toDomainTrackingUpdate(tracking)
    
    const newStatus = ShipmentStatus.toString(trackingUpdate.status)
    const oldStatus = dbShipment.status

    // Prepare update data
    const updateData: Prisma.shipmentsUpdateInput = {
      status: newStatus,
      last_checked: new Date(),
    }

    // Update ship24_tracker_id if not set
    if (!dbShipment.ship24_tracker_id) {
      updateData.ship24_tracker_id = trackerId
    }

    // Update dates if available
    if (trackingUpdate.estimatedDelivery) {
      updateData.estimated_delivery = trackingUpdate.estimatedDelivery
    }

    if (trackingUpdate.deliveredDate) {
      updateData.delivered_date = trackingUpdate.deliveredDate
    }

    if (trackingUpdate.shippedDate) {
      updateData.shipped_date = trackingUpdate.shippedDate
    }

    // Update carrier if available
    if (trackingUpdate.carrier && !dbShipment.carrier) {
      updateData.carrier = trackingUpdate.carrier
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Update shipment
      await tx.shipments.update({
        where: { id: dbShipment.id },
        data: updateData
      })

      // Store tracking events
      if (trackingUpdate.events && trackingUpdate.events.length > 0) {
        for (const event of trackingUpdate.events) {
          // Check if event already exists
          const existingEvent = await tx.tracking_events.findFirst({
            where: {
              shipment_id: dbShipment.id,
              event_time: event.occurredAt,
              message: event.description
            }
          })

          // Only create if it doesn't exist
          if (!existingEvent) {
            await tx.tracking_events.create({
              data: {
                shipment_id: dbShipment.id,
                status: event.status,
                location: event.location,
                message: event.description,
                event_time: event.occurredAt
              }
            })
          }
        }
      }
    })

    // Log status change
    const statusChanged = oldStatus !== newStatus
    
    if (statusChanged) {
      console.log(`✅ Webhook: Status updated for ${trackingNumber}: ${oldStatus} → ${newStatus}`)
    } else {
      console.log(`⏸️  Webhook: No status change for ${trackingNumber} (still ${newStatus})`)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      trackingNumber,
      statusChanged,
      oldStatus,
      newStatus,
      durationMs: duration,
      timestamp: new Date().toISOString()
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? getErrorMessage(error) : 'Failed to process webhook'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('=== Webhook Error ===')
    console.error('Error:', errorMessage)
    console.error('Stack:', errorStack)

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
