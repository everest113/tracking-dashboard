import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Get tracking statistics
 */
export async function GET() {
  try {
    const [
      totalShipments,
      deliveredCount,
      inTransitCount,
      pendingCount,
      exceptionCount,
      recentlyChecked,
      needsUpdate
    ] = await Promise.all([
      // Total shipments
      prisma.shipment.count(),
      
      // Delivered
      prisma.shipment.count({
        where: { status: 'delivered' }
      }),
      
      // In transit
      prisma.shipment.count({
        where: { status: 'in_transit' }
      }),
      
      // Pending
      prisma.shipment.count({
        where: { status: 'pending' }
      }),
      
      // Exception
      prisma.shipment.count({
        where: { status: 'exception' }
      }),
      
      // Recently checked (last hour)
      prisma.shipment.count({
        where: {
          lastChecked: {
            gte: new Date(Date.now() - 60 * 60 * 1000)
          }
        }
      }),
      
      // Needs update (not checked in 24 hours and not delivered)
      prisma.shipment.count({
        where: {
          status: { notIn: ['delivered'] },
          OR: [
            { lastChecked: null },
            {
              lastChecked: {
                lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
              }
            }
          ]
        }
      })
    ])

    const activeShipments = totalShipments - deliveredCount

    return NextResponse.json({
      total: totalShipments,
      active: activeShipments,
      byStatus: {
        delivered: deliveredCount,
        in_transit: inTransitCount,
        pending: pendingCount,
        exception: exceptionCount
      },
      recentlyChecked,
      needsUpdate,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Error fetching tracking stats:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
