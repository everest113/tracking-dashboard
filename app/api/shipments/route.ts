import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const shipments = await prisma.shipment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    
    return NextResponse.json(shipments)
  } catch (error) {
    console.error('Error fetching shipments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shipments' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { poNumber, trackingNumber, carrier } = body

    if (!poNumber || !trackingNumber) {
      return NextResponse.json(
        { error: 'PO Number and Tracking Number are required' },
        { status: 400 }
      )
    }

    const shipment = await prisma.shipment.create({
      data: {
        poNumber,
        trackingNumber,
        carrier,
        status: 'pending',
      },
    })

    return NextResponse.json(shipment, { status: 201 })
  } catch (error) {
    console.error('Error creating shipment:', error)
    return NextResponse.json(
      { error: 'Failed to create shipment' },
      { status: 500 }
    )
  }
}
