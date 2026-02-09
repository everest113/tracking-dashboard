import { NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test if syncHistory model is available
    const models = Object.keys(prisma).filter(key => !key.startsWith('$') && !key.startsWith('_'))
    
    // Try to count records
    const syncHistoryCount = await prisma.sync_history.count()
    
    return NextResponse.json({
      success: true,
      message: 'Prisma client working',
      models,
      syncHistoryCount,
    })
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
