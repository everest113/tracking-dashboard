import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'

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
      updated: results.filter((r: any) => r.statusChanged).length,
      delivered: results.filter((r: any) => r.newStatus === 'delivered').length,
      errors: results.filter((r: any) => !r.success).length,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    }

    console.log('=== Cron: Tracking Update Complete ===')
    console.log(JSON.stringify(summary, null, 2))

    return NextResponse.json(summary)

  } catch (error: any) {
    console.error('=== Cron: Tracking Update Error ===')
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
