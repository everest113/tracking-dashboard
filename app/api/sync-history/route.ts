import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 10

    // Fetch sync history, most recent first
    const history = await prisma.sync_history.findMany({
      where: {
        source: 'manual'  // Only show manual syncs
      },
      orderBy: {
        started_at: 'desc'
      },
      take: limit,
    })

    // Get the most recent sync for backward compatibility
    const lastSync = history.length > 0 ? {
      id: history[0].id,
      started_at: history[0].started_at.toISOString(),
      completed_at: history[0].completed_at?.toISOString() || null,
      conversations_processed: history[0].conversations_processed,
      shipments_added: history[0].shipments_added,
    } : null

    return NextResponse.json({
      success: true,
      lastSync,
      history: history.map(h => ({
        id: h.id,
        source: h.source,
        conversations_processed: h.conversations_processed,
        conversations_already_scanned: h.conversations_already_scanned,
        shipments_added: h.shipments_added,
        shipments_skipped: h.shipments_skipped,
        conversations_with_no_tracking: h.conversations_with_no_tracking,
        duration_ms: h.duration_ms,
        errors: h.errors,
        status: h.status,
        started_at: h.started_at.toISOString(),
        completed_at: h.completed_at?.toISOString() || null,
      }))
    })
  } catch (error) {
    console.error('Failed to fetch sync history:', getErrorMessage(error))
    return NextResponse.json(
      { 
        success: false, 
        error: getErrorMessage(error)
      },
      { status: 500 }
    )
  }
}
