import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    console.log('=== Tracking Update Cron Started ===')

    // Get all shipments that are not delivered (pending, in_transit, out_for_delivery, exception)
    const activeShipments = await prisma.shipment.findMany({
      where: {
        status: {
          notIn: ['delivered']
        }
      },
      orderBy: {
        lastChecked: 'asc' // Check oldest first
      },
      take: 100 // Limit to prevent timeout (adjust as needed)
    })

    console.log(`Found ${activeShipments.length} active shipments to check`)

    let updated = 0
    let errors = 0
    const errorMessages: string[] = []

    // Update each shipment's tracking status
    for (const shipment of activeShipments) {
      try {
        // TODO: Replace this with actual tracking API call
        // Example: const status = await trackingApi.getStatus(shipment.trackingNumber, shipment.carrier)
        
        // For now, just update lastChecked timestamp
        // When you integrate a real tracking API (like EasyPost, AfterShip, or carrier APIs),
        // you would:
        // 1. Call the API with tracking number and carrier
        // 2. Parse the response for status, events, delivery date, etc.
        // 3. Update the shipment record with new data
        
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            lastChecked: new Date(),
            // Add these when you have real tracking data:
            // status: parsedStatus,
            // deliveredDate: parsedDeliveryDate,
            // estimatedDelivery: parsedEstimatedDelivery,
          }
        })

        // If you're creating tracking events:
        // await prisma.trackingEvent.create({
        //   data: {
        //     shipmentId: shipment.id,
        //     status: event.status,
        //     location: event.location,
        //     message: event.message,
        //     eventTime: event.timestamp,
        //   }
        // })

        updated++
        console.log(`Updated tracking for ${shipment.trackingNumber}`)
      } catch (err: any) {
        errors++
        const errorMsg = `Failed to update ${shipment.trackingNumber}: ${err.message}`
        console.error(errorMsg)
        errorMessages.push(errorMsg)
      }
    }

    const duration = Date.now() - startTime

    const summary = {
      success: true,
      checked: activeShipments.length,
      updated,
      errors,
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
