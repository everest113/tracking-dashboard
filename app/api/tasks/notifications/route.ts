import { NextResponse } from 'next/server'

import { dispatchAllChannels } from '@/lib/application/notifications/dispatcher'

const CRON_HEADER = 'vercel-cron/1.0'

export async function GET(request: Request) {
  const userAgent = request.headers.get('user-agent') ?? ''
  if (!userAgent.includes(CRON_HEADER)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await dispatchAllChannels()

  const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0)
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)

  return NextResponse.json({
    results,
    summary: {
      totalProcessed,
      totalErrors,
    },
  })
}
