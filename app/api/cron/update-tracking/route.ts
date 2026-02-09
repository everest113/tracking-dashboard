import { NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import type { TrackingUpdateResult } from '@/lib/application/types'

/**
 * Cron endpoint to update tracking information for active shipments
 * Only calls Ship24 API for non-delivered shipments
 */
export async function GET(request: Request) {
  const startTime = Date.now()
  
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== Cron: Tracking Update Started ===')

    // Use the ShipmentTrackingService to update active shipments
    const service = getShipmentTrackingService()
    const results = await service.updateActiveShipments(50) // Limit to 50 per run

    const duration = Date.now() - startTime

    const summary = {
      success: true,
      checked: results.length,
      updated: results.filter((r: TrackingUpdateResult) => r.statusChanged).length,
      delivered: results.filter((r: TrackingUpdateResult) => r.newStatus === 'delivered').length,
      errors: results.filter((r: TrackingUpdateResult) => !r.success).length,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    }

    console.log('=== Cron: Tracking Update Complete ===')
    console.log(JSON.stringify(summary, null, 2))

    return NextResponse.json(summary)

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? getErrorMessage(error) : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('=== Cron: Tracking Update Error ===')
    console.error('Error:', errorMessage)
    console.error('Stack:', errorStack)

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
