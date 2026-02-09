import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTrackingInfo, mapShip24Status } from '@/lib/ship24-client'

/**
 * Cron endpoint to update tracking information for active shipments
 * Only calls Ship24 API for non-delivered shipments
 */
export async function GET(request: Request) {
  const startTime = Date.now()
  
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== Ship24 Tracking Update Started ===')

    // Get all NON-DELIVERED shipments (this is where we save API calls!)
    const activeShipments = await prisma.shipment.findMany({
      where: {
        status: {
          notIn: ['delivered']
        }
      },
      orderBy: {
        lastChecked: 'asc' // Check oldest first
      },
      take: 50 // Limit to prevent timeout
    })

    console.log(`Found ${activeShipments.length} active (non-delivered) shipments to check`)

    if (activeShipments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active shipments to check',
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
        console.log(`[${shipment.trackingNumber}] Checking status (current: ${shipment.status}, carrier: ${shipment.carrier || 'auto'})`)
        
        // Fetch tracking data from Ship24
        const trackingInfo = await getTrackingInfo(
          shipment.trackingNumber,
          shipment.carrier
        )
        
        const newStatus = mapShip24Status(trackingInfo.status_description)
        const oldStatus = shipment.status
        
        // Prepare update data
        const updateData: any = {
          lastChecked: new Date(),
          status: newStatus,
        }
        
        // Update dates if available
        if (trackingInfo.estimated_delivery_date) {
          updateData.estimatedDelivery = new Date(trackingInfo.estimated_delivery_date)
        }
        
        if (trackingInfo.actual_delivery_date) {
          updateData.deliveredDate = new Date(trackingInfo.actual_delivery_date)
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
                shipmentId: shipment.id,
                eventTime: latestEvent.occurred_at ? new Date(latestEvent.occurred_at) : undefined,
                message: latestEvent.description
              }
            })
            
            // Only create if it doesn't exist
            if (!existingEvent) {
              await tx.trackingEvent.create({
                data: {
                  shipmentId: shipment.id,
                  status: newStatus,
                  location: latestEvent.city_locality 
                    ? `${latestEvent.city_locality}, ${latestEvent.state_province || ''} ${latestEvent.postal_code || ''}`.trim()
                    : null,
                  message: latestEvent.description,
                  eventTime: latestEvent.occurred_at ? new Date(latestEvent.occurred_at) : new Date()
                }
              })
            }
          }
        })
        
        // Log status changes
        if (oldStatus !== newStatus) {
          statusChanges.push({
            trackingNumber: shipment.trackingNumber,
            old: oldStatus,
            new: newStatus
          })
          console.log(`  ✅ Status changed: ${oldStatus} → ${newStatus}`)
          
          if (newStatus === 'delivered') {
            deliveredShipments.push(shipment.trackingNumber)
            console.log(`  🎉 DELIVERED: ${shipment.trackingNumber}`)
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
        const errorMsg = `${shipment.trackingNumber}: ${err.message}`
        console.error(`  ❌ Failed:`, err.message)
        errorMessages.push(errorMsg)
        
        // Still update lastChecked to avoid repeatedly hitting failed lookups
        try {
          await prisma.shipment.update({
            where: { id: shipment.id },
            data: { lastChecked: new Date() }
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
      errorMessages: errorMessages.slice(0, 10), // Limit error list
      durationMs: duration,
      timestamp: new Date().toISOString(),
    }

    console.log('=== Tracking Update Complete ===')
    console.log(JSON.stringify(summary, null, 2))

    return NextResponse.json(summary)
    
  } catch (error: any) {
    console.error('=== FATAL ERROR ===')
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
