import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createShip24Client } from '@/lib/infrastructure/sdks/ship24/client'
import { Ship24Mapper } from '@/lib/infrastructure/mappers/Ship24Mapper'
import { ShipmentStatus } from '@/lib/domain/value-objects/ShipmentStatus'

/**
 * Manual trigger endpoint for tracking updates
 * Uses Ship24 cached results (fast) instead of re-tracking
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    console.log('=== Manual Tracking Update Started ===')

    // Get all NON-DELIVERED shipments that have a tracker ID
    const activeShipments = await prisma.shipments.findMany({
      where: {
        status: {
          notIn: ['delivered']
        },
        ship24_tracker_id: {
          not: null
        }
      },
      orderBy: {
        last_checked: 'asc'
      },
      take: 50 // Limit to prevent timeout
    })

    console.log(`Found ${activeShipments.length} active shipments with registered trackers`)

    if (activeShipments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active shipments with registered trackers',
        checked: 0,
        updated: 0,
        timestamp: new Date().toISOString(),
      })
    }

    let updated = 0
    let skipped = 0
    let errors = 0
    const errorMessages: string[] = []
    const statusChanges: Array<{ trackingNumber: string; old: string; new: string }> = []
    const deliveredShipments: string[] = []

    const ship24Client = createShip24Client()

    // Process each shipment
    for (const shipment of activeShipments) {
      try {
        console.log(`[${shipment.tracking_number}] Fetching cached results (tracker: ${shipment.ship24_tracker_id})`)
        
        // Fetch tracking data from Ship24's cache (fast)
        const response = await ship24Client.getTrackerResults(shipment.ship24_tracker_id!)
        const tracking = response.data.trackings[0]
        
        if (!tracking) {
          throw new Error('No tracking data found')
        }

        // Map to domain
        const trackingUpdate = Ship24Mapper.toDomainTrackingUpdate(tracking)
        
        const newStatus = ShipmentStatus.toString(trackingUpdate.status)
        const oldStatus = shipment.status
        
        // Prepare update data
        const updateData: any = {
          last_checked: new Date(),
          status: newStatus,
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
        
        // Update carrier if we got it from Ship24
        if (trackingUpdate.carrier && !shipment.carrier) {
          updateData.carrier = trackingUpdate.carrier
        }
        
        // Use a transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
          // Update shipment
          await tx.shipments.update({
            where: { id: shipment.id },
            data: updateData
          })
          
          // Store latest tracking event if we have events
          if (trackingUpdate.events && trackingUpdate.events.length > 0) {
            const latestEvent = trackingUpdate.events[0]
            
            // Check if this event already exists
            const existingEvent = await tx.tracking_events.findFirst({
              where: {
                shipment_id: shipment.id,
                event_time: latestEvent.occurredAt,
                message: latestEvent.description
              }
            })
            
            // Only create if it doesn't exist
            if (!existingEvent) {
              await tx.tracking_events.create({
                data: {
                  shipment_id: shipment.id,
                  status: latestEvent.status,
                  location: latestEvent.location,
                  message: latestEvent.description,
                  event_time: latestEvent.occurredAt
                }
              })
            }
          }
        })
        
        // Log status changes
        if (oldStatus !== newStatus) {
          statusChanges.push({
            trackingNumber: shipment.tracking_number,
            old: oldStatus,
            new: newStatus
          })
          console.log(`  ✅ Status changed: ${oldStatus} → ${newStatus}`)
          
          if (newStatus === 'delivered') {
            deliveredShipments.push(shipment.tracking_number)
            console.log(`  🎉 DELIVERED: ${shipment.tracking_number}`)
          }
        } else {
          console.log(`  ⏸️  No change (still ${newStatus})`)
          skipped++
        }

        updated++
        
        // Rate limiting: add a small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (err: any) {
        errors++
        const errorMsg = `${shipment.tracking_number}: ${err.message}`
        console.error(`  ❌ Failed:`, err.message)
        errorMessages.push(errorMsg)
        
        // Still update lastChecked to avoid repeatedly hitting failed lookups
        try {
          await prisma.shipments.update({
            where: { id: shipment.id },
            data: { last_checked: new Date() }
          })
        } catch (updateErr) {
          console.error(`  ❌ Failed to update lastChecked:`, updateErr)
        }
      }
    }

    const duration = Date.now() - startTime

    const summary = {
      success: true,
      checked: activeShipments.length,
      updated,
      skipped,
      errors,
      statusChanges,
      deliveredShipments,
      errorMessages: errorMessages.slice(0, 10),
      durationMs: duration,
      timestamp: new Date().toISOString(),
    }

    console.log('=== Manual Update Complete ===')
    console.log(JSON.stringify(summary, null, 2))

    return NextResponse.json(summary)

  } catch (error: any) {
    console.error('=== Manual Update Error ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update tracking',
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
