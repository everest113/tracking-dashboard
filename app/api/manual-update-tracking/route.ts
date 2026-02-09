import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTrackerResults, mapShip24Status } from '@/lib/ship24-client'

/**
 * Manual trigger endpoint for tracking updates
 * Uses Ship24 cached results (fast) instead of re-tracking
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    console.log('=== Manual Tracking Update Started ===')

    // Get all NON-DELIVERED shipments that have a tracker ID
    const activeShipments = await prisma.shipment.findMany({
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

    // Process each shipment
    for (const shipment of activeShipments) {
      try {
        console.log(`[${shipment.tracking_number}] Fetching cached results (tracker: ${shipment.ship24_tracker_id})`)
        
        // Fetch tracking data from Ship24's cache (fast)
        const trackingInfo = await getTrackerResults(shipment.ship24_tracker_id!)
        
        const newStatus = mapShip24Status(trackingInfo.status_description)
        const oldStatus = shipment.status
        
        // Prepare update data
        const updateData: any = {
          last_checked: new Date(),
          status: newStatus,
        }
        
        // Update dates if available
        if (trackingInfo.estimated_delivery_date) {
          updateData.estimated_delivery = new Date(trackingInfo.estimated_delivery_date)
        }
        
        if (trackingInfo.actual_delivery_date) {
          updateData.delivered_date = new Date(trackingInfo.actual_delivery_date)
        }

        if (trackingInfo.ship_date) {
          updateData.shipped_date = new Date(trackingInfo.ship_date)
        }
        
        // Update carrier if we got it from Ship24
        if (trackingInfo.carrier_status_code && !shipment.carrier) {
          updateData.carrier = trackingInfo.carrier_status_code
        }
        
        // Use a transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
          // Update shipment
          await tx.shipment.update({
            where: { id: shipment.id },
            data: updateData
          })
          
          // Store latest tracking event if we have events
          if (trackingInfo.events && trackingInfo.events.length > 0) {
            const latestEvent = trackingInfo.events[0]
            
            // Check if this event already exists
            const existingEvent = await tx.trackingEvent.findFirst({
              where: {
                shipment_id: shipment.id,
                event_time: latestEvent.occurred_at ? new Date(latestEvent.occurred_at) : undefined,
                message: latestEvent.description
              }
            })
            
            // Only create if it doesn't exist
            if (!existingEvent) {
              await tx.trackingEvent.create({
                data: {
                  shipment_id: shipment.id,
                  status: newStatus,
                  location: latestEvent.city_locality 
                    ? `${latestEvent.city_locality}, ${latestEvent.state_province || ''} ${latestEvent.postal_code || ''}`.trim()
                    : null,
                  message: latestEvent.description,
                  event_time: latestEvent.occurred_at ? new Date(latestEvent.occurred_at) : new Date()
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
          await prisma.shipment.update({
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
