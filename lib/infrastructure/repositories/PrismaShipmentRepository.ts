import { prisma } from '@/lib/prisma'
import type { Shipment } from '@/lib/domain/entities/Shipment'
import { Shipment as S } from '@/lib/domain/entities/Shipment'
import type { TrackingNumber } from '@/lib/domain/value-objects/TrackingNumber'
import { TrackingNumber as TN } from '@/lib/domain/value-objects/TrackingNumber'

/**
 * Prisma Shipment Repository - Functional Implementation
 * Works with plain Shipment objects
 */
export interface ShipmentRepository {
  findById(id: number): Promise<Shipment | null>
  findByTrackingNumber(trackingNumber: TrackingNumber): Promise<Shipment | null>
  findByShip24TrackerId(trackerId: string): Promise<Shipment | null>
  findActiveShipments(limit?: number): Promise<Shipment[]>
  findUnregisteredShipments(): Promise<Shipment[]>
  save(shipment: Shipment): Promise<Shipment>
  saveMany(shipments: Shipment[]): Promise<void>
}

export const createPrismaShipmentRepository = (): ShipmentRepository => ({
  async findById(id: number): Promise<Shipment | null> {
    const record = await prisma.shipments.findUnique({
      where: { id },
    })

    return record ? S.fromDatabase(record as any) : null
  },

  async findByTrackingNumber(trackingNumber: TrackingNumber): Promise<Shipment | null> {
    const record = await prisma.shipments.findUnique({
      where: {tracking_number: TN.toString(trackingNumber) },
    })

    return record ? S.fromDatabase(record as any) : null
  },

  async findByShip24TrackerId(trackerId: string): Promise<Shipment | null> {
    const record = await prisma.shipments.findFirst({
      where: {ship24_tracker_id: trackerId },
    })

    return record ? S.fromDatabase(record as any) : null
  },

  async findActiveShipments(limit: number = 50): Promise<Shipment[]> {
    const records = await prisma.shipments.findMany({
      where: {
        status: {
          notIn: ['delivered'],
        },
        ship24_tracker_id: {
          not: null,
        },
      },
      orderBy: {
        last_checked: 'asc',
      },
      take: limit,
    })

    return records.map((r: any) => S.fromDatabase(r as any))
  },

  async findUnregisteredShipments(): Promise<Shipment[]> {
    const records = await prisma.shipments.findMany({
      where: {
        ship24_tracker_id: null,
      },
    })

    return records.map((r: any) => S.fromDatabase(r as any))
  },

  async save(shipment: Shipment): Promise<Shipment> {
    const data = S.toPersistence(shipment)
    
    const record = await prisma.shipments.upsert({
      where: { 
        tracking_number: data.trackingNumber,
      },
      update: data,
      create: data as any,
    })

    return S.fromDatabase(record as any)
  },

  async saveMany(shipments: Shipment[]): Promise<void> {
    await prisma.$transaction(
      shipments.map(shipment => {
        const data = S.toPersistence(shipment)
        return prisma.shipments.upsert({
          where: {tracking_number: data.trackingNumber },
          update: data,
          create: data as any,
        })
      })
    )
  }
})
