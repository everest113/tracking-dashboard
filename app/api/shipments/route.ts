import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { shipmentSchema } from '@/lib/validations'
import { ZodError } from 'zod'

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
    
    // Validate with Zod
    const validatedData = shipmentSchema.parse(body)

    // Check if tracking number already exists
    const existingShipment = await prisma.shipment.findUnique({
      where: { trackingNumber: validatedData.trackingNumber },
    })

    if (existingShipment) {
      return NextResponse.json(
        { error: 'A shipment with this tracking number already exists' },
        { status: 409 }
      )
    }

    // Build the data object, converting date strings to Date objects
    const shipmentData: any = {
      trackingNumber: validatedData.trackingNumber,
      carrier: validatedData.carrier,
      status: 'pending',
    }

    // Add optional fields only if they have values
    if (validatedData.poNumber) {
      shipmentData.poNumber = validatedData.poNumber
    }

    if (validatedData.supplier) {
      shipmentData.supplier = validatedData.supplier
    }

    if (validatedData.shippedDate) {
      shipmentData.shippedDate = new Date(validatedData.shippedDate)
    }

    if (validatedData.estimatedDelivery) {
      shipmentData.estimatedDelivery = new Date(validatedData.estimatedDelivery)
    }

    const shipment = await prisma.shipment.create({
      data: shipmentData,
    })

    return NextResponse.json(shipment, { status: 201 })
  } catch (error) {
    // Zod validation error
    if (error instanceof ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      )
    }

    console.error('Error creating shipment:', error)
    return NextResponse.json(
      { error: 'Failed to create shipment' },
      { status: 500 }
    )
  }
}
