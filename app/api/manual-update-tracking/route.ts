import { NextResponse } from 'next/server'

/**
 * Manual trigger endpoint for tracking updates
 * This allows users to trigger an immediate update via the UI
 */
export async function POST(request: Request) {
  try {
    // Get the base URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'

    // Call the cron endpoint with proper auth
    const response = await fetch(`${baseUrl}/api/cron/update-tracking`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to trigger update' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Manual update error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to trigger update' },
      { status: 500 }
    )
  }
}
