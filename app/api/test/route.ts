import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    frontToken: process.env.FRONT_API_TOKEN ? 'SET' : 'MISSING',
    openaiKey: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING',
    databaseUrl: process.env.DATABASE_URL ? 'SET' : 'MISSING',
  })
}
