import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    // Get recent sync history
    const history = await prisma.syncHistory.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
    })

    // Get last successful sync
    const lastSync = await prisma.syncHistory.findFirst({
      where: { status: { in: ['success', 'partial'] } },
      orderBy: { completedAt: 'desc' },
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
