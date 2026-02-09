import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    // Get recent sync history
    const history = await prisma.sync_history.findMany({
      orderBy: { started_at: 'desc' },
      take: limit,
    })

    // Get last successful sync
    const lastSync = await prisma.sync_history.findFirst({
      where: { status: { in: ['success', 'partial'] } },
      orderBy: { completed_at: 'desc' },
    })

    return NextResponse.json({
      success: true,
      history,
      lastSync,
    })
  } catch (error: any) {
    console.error('Error fetching sync history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sync history' },
      { status: 500 }
    )
  }
}
