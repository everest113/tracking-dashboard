import { NextResponse } from 'next/server'
import type { TrackingUpdateResult } from '@/lib/application/types'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { prisma } from '@/lib/prisma'
import { createShip24Client } from '@/lib/infrastructure/sdks/ship24/client'
import { Ship24Mapper } from '@/lib/infrastructure/mappers/Ship24Mapper'

/**
 * Manual tracking update endpoint
 * Fetches latest tracking info from Ship24 cache for active shipments
 */
export async function POST() {
  const startTime = Date.now()
  
  try {
    console.log('=== Manual Tracking Update Started ===')

    const limit = 50
    const shipments = await prisma.shipments.findMany({
      where: {
        status: {
          notIn: ['delivered'],
        },
        ship24_tracker_id: {
          not: null,
        },
      },
      orderBy: {
        last_checked: 'asc',
      },
      take: limit,
    })

    console.log(`Found ${shipments.length} shipments to update`)

    if (shipments.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        updated: 0,
        errors: 0,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
    }

    const ship24Client = createShip24Client()
    const results: TrackingUpdateResult[] = []
    let errors = 0

    for (const shipment of shipments) {
      try {
        console.log(`Updating ${shipment.tracking_number}...`)

        const response = await ship24Client.getTrackerResults(shipment.ship24_tracker_id!)
        
        if (response.data?.trackings?.[0]) {
          const tracking = response.data.trackings[0]
          const trackingUpdate = Ship24Mapper.toDomainTrackingUpdate(tracking)
          
          const newStatus = trackingUpdate.status.type
          const oldStatus = shipment.status

          await prisma.shipments.update({
            where: { id: shipment.id },
            data: {
              status: newStatus,
              last_checked: new Date(),
              ...(trackingUpdate.estimatedDelivery && {
                estimated_delivery: trackingUpdate.estimatedDelivery
              }),
              ...(trackingUpdate.deliveredDate && {
                delivered_date: trackingUpdate.deliveredDate
              }),
              ...(trackingUpdate.shippedDate && {
                shipped_date: trackingUpdate.shippedDate
              }),
            }
          })

          const statusChanged = oldStatus !== newStatus

          results.push({
            success: true,
            trackingNumber: shipment.tracking_number,
            oldStatus,
            newStatus,
            statusChanged,
          })

          if (statusChanged) {
            console.log(`  ✓ ${shipment.tracking_number}: ${oldStatus} → ${newStatus}`)
          }
        } else {
          results.push({
            success: false,
            trackingNumber: shipment.tracking_number,
            oldStatus: shipment.status,
            newStatus: shipment.status,
            statusChanged: false,
            error: 'No tracking data available'
          })
        }
      } catch (error) {
        console.error(`  ✗ Error updating ${shipment.tracking_number}:`, getErrorMessage(error))
        errors++
        results.push({
          success: false,
          trackingNumber: shipment.tracking_number,
          oldStatus: shipment.status,
          newStatus: shipment.status,
          statusChanged: false,
          error: getErrorMessage(error)
        })
      }
    }

    const duration = Date.now() - startTime

    const summary = {
      success: true,
      checked: shipments.length,
      updated: results.filter((r: TrackingUpdateResult) => r.statusChanged).length,
      delivered: results.filter((r: TrackingUpdateResult) => r.newStatus === 'delivered').length,
      errors,
      durationMs: duration,
      timestamp: new Date().toISOString()
    }

    console.log('=== Manual Update Complete ===')
    console.log(JSON.stringify(summary, null, 2))

    return NextResponse.json(summary)

  } catch (error) {
    console.error('=== Manual Update Error ===')
    console.error('Error:', getErrorMessage(error))

    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
