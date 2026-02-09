import { NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'
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
      prisma.shipments.count(),
      
      // Delivered
      prisma.shipments.count({
        where: { status: 'delivered' }
      }),
      
      // In transit
      prisma.shipments.count({
        where: { status: 'in_transit' }
      }),
      
      // Pending
      prisma.shipments.count({
        where: { status: 'pending' }
      }),
      
      // Exception
      prisma.shipments.count({
        where: { status: 'exception' }
      }),
      
      // Recently checked (last hour)
      prisma.shipments.count({
        where: {
          last_checked: {
            gte: new Date(Date.now() - 60 * 60 * 1000)
          }
        }
      }),
      
      // Needs update (not checked in 24 hours and not delivered)
      prisma.shipments.count({
        where: {
          status: { notIn: ['delivered'] },
          OR: [
            { last_checked: null },
            {
              last_checked: {
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
  } catch (error: unknown) {
    console.error('Error fetching tracking stats:', error)
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
