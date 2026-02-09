import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mapShip24Status } from '@/lib/ship24-client'
import crypto from 'crypto'

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
  } catch (error) {
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

    // Ship24 webhook structure:
    // {
    //   "webhook": {
    //     "id": "webhook-id",
    //     "trackerId": "tracker-id",
    //     ...
    //   },
    //   "data": {
    //     "trackings": [{
    //       "tracker": { trackerId, trackingNumber, ... },
    //       "shipment": { status, statusMilestone, delivery: {...}, ... },
    //       "events": [...]
    //     }]
    //   }
    // }

    const tracking = payload.data?.trackings?.[0]
    
    if (!tracking) {
      console.warn('Webhook: No tracking data in payload')
      return NextResponse.json({ success: true, message: 'No tracking data' })
    }

    const tracker = tracking.tracker || {}
    const shipment = tracking.shipment || {}
    const events = tracking.events || []

    const trackerId = tracker.trackerId
    const trackingNumber = tracker.trackingNumber

    if (!trackerId || !trackingNumber) {
      console.error('Webhook: Missing trackerId or trackingNumber')
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Find shipment in database by trackerId or trackingNumber
    let dbShipment = await prisma.shipment.findFirst({
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

    // Extract tracking information
    const latestStatus = shipment.statusMilestone || shipment.status || 'unknown'
    const newStatus = mapShip24Status(latestStatus)
    const oldStatus = dbShipment.status

    // Prepare update data
    const updateData: any = {
      status: newStatus,
      last_checked: new Date(),
    }

    // Update ship24_tracker_id if not set
    if (!dbShipment.ship24_tracker_id) {
      updateData.ship24_tracker_id = trackerId
    }

    // Update dates if available
    if (shipment.delivery?.estimatedDeliveryDate) {
      updateData.estimated_delivery = new Date(shipment.delivery.estimatedDeliveryDate)
    }

    if (shipment.delivery?.actualDeliveryDate) {
      updateData.delivered_date = new Date(shipment.delivery.actualDeliveryDate)
    }

    if (shipment.shipDate) {
      updateData.shipped_date = new Date(shipment.shipDate)
    }

    // Update carrier if available and not set
    if (tracker.courierCode && !dbShipment.carrier) {
      updateData.carrier = Array.isArray(tracker.courierCode) ? tracker.courierCode[0] : tracker.courierCode
    }

    // Update shipment in database
    await prisma.$transaction(async (tx) => {
      // Update shipment
      await tx.shipment.update({
        where: { id: dbShipment.id },
        data: updateData
      })

      // Store tracking events
      if (events && events.length > 0) {
        for (const event of events) {
          const location = event.location || {}
          const eventTime = event.datetime || event.occurrenceDateTime
          const description = event.statusDetails || event.status || 'Status update'

          // Check if event already exists
          const existingEvent = await tx.trackingEvent.findFirst({
            where: {
              shipment_id: dbShipment.id,
              event_time: eventTime ? new Date(eventTime) : undefined,
              message: description
            }
          })

          // Only create if it doesn't exist
          if (!existingEvent) {
            await tx.trackingEvent.create({
              data: {
                shipment_id: dbShipment.id,
                status: mapShip24Status(event.status || 'unknown'),
                location: location.city
                  ? `${location.city}, ${location.state || ''} ${location.postalCode || ''}`.trim()
                  : null,
                message: description,
                event_time: eventTime ? new Date(eventTime) : new Date()
              }
            })
          }
        }
      }
    })

    const statusChanged = oldStatus !== newStatus
    const duration = Date.now() - startTime

    const response = {
      success: true,
      trackerId,
      trackingNumber,
      statusChanged,
      oldStatus,
      newStatus,
      eventsAdded: events.length,
      durationMs: duration,
      timestamp: new Date().toISOString()
    }

    console.log('Webhook processed:', response)

    if (statusChanged) {
      console.log(`  ✅ Status changed: ${oldStatus} → ${newStatus}`)
      if (newStatus === 'delivered') {
        console.log(`  🎉 DELIVERED: ${trackingNumber}`)
      }
    } else {
      console.log(`  ⏸️  No status change (still ${newStatus})`)
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
        timestamp: new Date().toISOString()
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
