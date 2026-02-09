import { NextResponse } from 'next/server'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'

/**
 * Backfill Ship24 trackers (DDD version)
 * Uses the new Domain-Driven Design architecture
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    console.log('=== Ship24 Tracker Backfill Started (DDD) ===')

    const service = getShipmentTrackingService()
    const result = await service.backfillTrackers()

    const duration = Date.now() - startTime

    const summary = {
      success: true,
      registered: result.registered,
      failed: result.failed,
      total: result.total,
      errorMessages: result.results
        .filter((r: any) => !r.success && r.error)
        .map((r: any) => `${r.trackingNumber}: ${r.error}`)
        .slice(0, 10),
      durationMs: duration,
      timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
