import { NextResponse } from 'next/server'
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
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
