import { NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
import { prisma } from '@/lib/prisma'
import { shipmentSchema } from '@/lib/validations'
import { getShipmentTrackingService } from '@/lib/application/ShipmentTrackingService'
import { serializeShipment, serializeShipments } from '@/lib/infrastructure/repositories/serializers'
import { ZodError } from 'zod'

/**
 * GET /api/shipments - Fetch shipments with pagination, filtering, and sorting
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    
    // Pagination
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20'), 100)
    const skip = (page - 1) * pageSize
    
    // Filters
    const where: any = {}
    
    const trackingNumber = url.searchParams.get('trackingNumber')
    if (trackingNumber) {
      where.tracking_number = { contains: trackingNumber, mode: 'insensitive' }
    }
    
    const poNumber = url.searchParams.get('poNumber')
    if (poNumber) {
      where.po_number = { contains: poNumber, mode: 'insensitive' }
    }
    
    const supplier = url.searchParams.get('supplier')
    if (supplier) {
      where.supplier = { contains: supplier, mode: 'insensitive' }
    }
    
    const status = url.searchParams.get('status')
    if (status && status !== 'all') {
      where.status = status
    }
    
    const carrier = url.searchParams.get('carrier')
    if (carrier) {
      where.carrier = { contains: carrier, mode: 'insensitive' }
    }
    
    // Sorting
    const sortField = url.searchParams.get('sortField')
    const sortDirection = url.searchParams.get('sortDirection') as 'asc' | 'desc' || 'desc'
    
    const fieldMap: Record<string, string> = {
      trackingNumber: 'tracking_number',
      poNumber: 'po_number',
      supplier: 'supplier',
      status: 'status',
      shippedDate: 'shipped_date',
      estimatedDelivery: 'estimated_delivery',
      deliveredDate: 'delivered_date',
      createdAt: 'created_at',
    }
    
    const orderBy: any = sortField && fieldMap[sortField]
      ? { [fieldMap[sortField]]: sortDirection }
      : { created_at: 'desc' }
    
    // Get total count
    const total = await prisma.shipments.count({ where })
    
    // Get paginated results
    const shipments = await prisma.shipments.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        tracking_events: {
          orderBy: { event_time: 'desc' },
          take: 5,
        },
      },
    })

    const serialized = serializeShipments(shipments).map(s => ({
      ...s,
      shippedDate: s.shippedDate?.toISOString() ?? null,
      estimatedDelivery: s.estimatedDelivery?.toISOString() ?? null,
      deliveredDate: s.deliveredDate?.toISOString() ?? null,
      ship24LastUpdate: s.ship24LastUpdate?.toISOString() ?? null,
      lastChecked: s.lastChecked?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      trackingEvents: s.trackingEvents?.map(e => ({
        ...e,
        eventTime: e.eventTime?.toISOString() ?? null,
      })),
    }))

    return NextResponse.json({
      items: serialized,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page * pageSize < total,
        hasPrev: page > 1,
      },
    })
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

    return NextResponse.json(serializeShipment(newShipment), { status: 201 })
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
