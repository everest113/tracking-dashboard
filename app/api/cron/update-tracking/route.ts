import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTrackingInfo, mapShip24Status } from '@/lib/ship24-client'

/**
 * Cron endpoint to update tracking information for active shipments
 * Vercel Cron Jobs will call this endpoint on a schedule
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

    console.log('=== Tracking Update Cron Started (Ship24) ===')

    // Get all shipments that are not delivered
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

    console.log(`Found ${activeShipments.length} active shipments to check`)

    let updated = 0
    let errors = 0
    const errorMessages: string[] = []
    const statusChanges: Array<{ trackingNumber: string; old: string; new: string }> = []

    // Update each shipment's tracking status
    for (const shipment of activeShipments) {
      try {
        console.log(`Checking tracking for ${shipment.trackingNumber} (carrier: ${shipment.carrier || 'auto'})`)
        
        // Fetch real tracking data from Ship24
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
        
        // Update estimated/actual delivery dates if available
        if (trackingInfo.estimated_delivery_date) {
          updateData.estimatedDelivery = new Date(trackingInfo.estimated_delivery_date)
        }
        
        if (trackingInfo.actual_delivery_date) {
          updateData.deliveredDate = new Date(trackingInfo.actual_delivery_date)
        }
        
        // Update shipment record
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: updateData
        })
        
        // Log status changes
        if (oldStatus !== newStatus) {
          statusChanges.push({
            trackingNumber: shipment.trackingNumber,
            old: oldStatus,
            new: newStatus
          })
          console.log(`Status changed: ${shipment.trackingNumber} ${oldStatus} → ${newStatus}`)
        }

        updated++
      } catch (err: any) {
        errors++
        const errorMsg = `${shipment.trackingNumber}: ${err.message}`
        console.error(`Failed to update tracking:`, errorMsg)
        errorMessages.push(errorMsg)
        
        // Still update lastChecked even on error to avoid repeatedly hitting failed lookups
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: { lastChecked: new Date() }
        }).catch(() => {}) // Ignore errors on this fallback update
      }
    }

    const duration = Date.now() - startTime

    const summary = {
      success: true,
      checked: activeShipments.length,
      updated,
      errors,
      statusChanges,
      errorMessages: errorMessages.slice(0, 10), // Limit error list
      durationMs: duration,
      timestamp: new Date().toISOString(),
    }

    console.log('=== Tracking Update Complete ===', summary)

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
      },
      { status: 500 }
    )
  }
}
