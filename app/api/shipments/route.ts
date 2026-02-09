import { NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { prisma } from '@/lib/prisma'
import { shipmentSchema } from '@/lib/validations'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { ZodError } from 'zod'

/**
 * GET /api/shipments - Fetch all shipments
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '100')

    const shipments = await prisma.shipments.findMany({
      orderBy: { created_at: 'desc' },
      take: Math.min(limit, 1000),
      include: {
        tracking_events: {
          orderBy: { event_time: 'desc' },
          take: 5,
        },
      },
    })

    return NextResponse.json(shipments)
  } catch (error) {
    console.error('Error fetching shipments:', getErrorMessage(error))
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/shipments - Create a new shipment
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const validatedData = shipmentSchema.parse(body)

    const existingShipment = await prisma.shipments.findUnique({
      where: { tracking_number: validatedData.trackingNumber },
    })

    if (existingShipment) {
      return NextResponse.json(
        { error: 'Tracking number already exists' },
        { status: 409 }
      )
    }

    const newShipment = await prisma.shipments.create({
      data: {
        tracking_number: validatedData.trackingNumber,
        carrier: validatedData.carrier ?? null,
        po_number: validatedData.poNumber ?? null,
        supplier: validatedData.supplier ?? null,
        status: 'pending',
        updated_at: new Date(),
      },
    })

    const service = getShipmentTrackingService()
    service.registerTracker(
      newShipment.tracking_number,
      newShipment.carrier ?? undefined,
      newShipment.po_number ?? undefined
    ).then((result) => {
      if (result.success) {
        console.log(`Registered tracker: ${result.trackerId}`)
      }
    }).catch((err) => {
      console.error('Error registering tracker:', getErrorMessage(err))
    })

    return NextResponse.json(newShipment, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating shipment:', getErrorMessage(error))
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
