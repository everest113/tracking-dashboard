import { NextResponse } from 'next/server'

import { dispatchEvents } from '@/lib/application/events/dispatcher'
import { registerEventHandlers } from '@/lib/application/events/registerHandlers'
import { listTopics } from '@/lib/application/events/registry'

registerEventHandlers()

const CRON_HEADER = 'vercel-cron/1.0'

export async function GET(request: Request) {
  const userAgent = request.headers.get('user-agent') ?? ''
  if (!userAgent.includes(CRON_HEADER)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const topics = listTopics()
  const results = []

  for (const topic of topics) {
    const result = await dispatchEvents(topic)
    results.push({ topic, ...result })
  }

  return NextResponse.json({ results })
}
