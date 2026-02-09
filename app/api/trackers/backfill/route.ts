import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'

/**
 * Backfill Ship24 trackers for all existing shipments
 * This registers all shipments that don't have a ship24_tracker_id yet
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    console.log('=== Ship24 Tracker Backfill Started ===')

    // Find all shipments without a ship24_tracker_id
    const unregisteredShipments = await prisma.shipments.findMany({
      where: {
        ship24_tracker_id: null
      },
      select: {
        id: true,
        tracking_number: true,
        carrier: true,
        po_number: true,
        status: true
      }
    })

    console.log(`Found ${unregisteredShipments.length} shipments to register`)

    if (unregisteredShipments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All shipments already registered',
        registered: 0,
        skipped: 0,
        errors: 0,
        timestamp: new Date().toISOString()
      })
    }

    let registered = 0
    let skipped = 0
    let errors = 0
    const errorMessages: string[] = []

    // Process in batches of 50 (Ship24 bulk limit)
    const BATCH_SIZE = 50
    const service = getShipmentTrackingService()
    
    for (let i = 0; i < unregisteredShipments.length; i += BATCH_SIZE) {
      const batch = unregisteredShipments.slice(i, i + BATCH_SIZE)
      
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} shipments)`)
      
      try {
        // Prepare tracker data
        const trackerData = batch.map((s: any) => ({
          trackingNumber: s.tracking_number,
          carrier: s.carrier,
          poNumber: s.po_number || undefined
        }))

        // Register trackers in bulk
        const results = await service.registerTrackersBulk(trackerData)

        console.log(`  Received ${results.length} results`)

        // Update database with tracker IDs
        for (const result of results) {
          const shipment = batch.find((s: any) => s.tracking_number === result.trackingNumber)
          
          if (shipment) {
            if (result.success && result.trackerId) {
              try {
                await prisma.shipments.update({
                  where: { id: shipment.id },
                  data: { 
                    ship24_tracker_id: result.trackerId,
                    updated_at: new Date()
                  }
                })
                
                registered++
                console.log(`  ✅ Registered: ${shipment.tracking_number} → ${result.trackerId}`)
              } catch (updateErr: any) {
                errors++
                const msg = `Failed to update ${shipment.tracking_number}: ${updateErr.message}`
                console.error(`  ❌ ${msg}`)
                errorMessages.push(msg)
              }
            } else {
              errors++
              const msg = `Failed to register ${result.trackingNumber}: ${result.error || 'Unknown error'}`
              console.error(`  ❌ ${msg}`)
              errorMessages.push(msg)
            }
          }
        }

        // Rate limiting: small delay between batches
        if (i + BATCH_SIZE < unregisteredShipments.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }

      } catch (batchErr: any) {
        errors += batch.length
        const msg = `Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${batchErr.message}`
        console.error(`  ❌ ${msg}`)
        errorMessages.push(msg)
      }
    }

    const duration = Date.now() - startTime

    const summary = {
      success: true,
      registered,
      skipped,
      errors,
      total: unregisteredShipments.length,
      errorMessages: errorMessages.slice(0, 10),
      durationMs: duration,
      timestamp: new Date().toISOString()
    }

    console.log('=== Backfill Complete ===')
    console.log(JSON.stringify(summary, null, 2))

    return NextResponse.json(summary)

  } catch (error: any) {
    console.error('=== Backfill Error ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to backfill trackers',
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
