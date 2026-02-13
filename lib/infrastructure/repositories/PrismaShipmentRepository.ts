import { getEventQueue } from '@/lib/application/events/getEventQueue'
import { buildShipmentEvents } from '@/lib/application/events/shipment/buildShipmentEvents'
import { prisma } from '@/lib/prisma'
import type { Shipment } from '@/lib/domain/entities/Shipment'
import { Shipment as S } from '@/lib/domain/entities/Shipment'
import type { TrackingNumber } from '@/lib/domain/value-objects/TrackingNumber'
import { TrackingNumber as TN } from '@/lib/domain/value-objects/TrackingNumber'
import { createLogger, logPerformance } from '@/lib/infrastructure/logging'
import { prismaShipmentToRecord, recordToPrismaData } from './mappers'

/**
 * Prisma Shipment Repository - Functional Implementation
 * Works with plain Shipment objects
 * 
 * ✅ No 'any' types - fully type-safe
 * ✅ Structured logging with performance tracking
 * ✅ Follows DDD repository pattern
 * ✅ Proper mapping between Prisma (snake_case) and Domain (camelCase)
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

export const createPrismaShipmentRepository = (): ShipmentRepository => {
  const logger = createLogger({ repository: 'PrismaShipment' })

  return {
    async findById(id: number): Promise<Shipment | null> {
      logger.debug('Finding shipment by ID', { id })
      
      const record = await prisma.shipments.findUnique({
        where: { id },
      })

      if (!record) {
        logger.debug('Shipment not found', { id })
        return null
      }

      logger.debug('Shipment found', { id, trackingNumber: record.tracking_number })
      return S.fromDatabase(prismaShipmentToRecord(record))
    },

    async findByTrackingNumber(trackingNumber: TrackingNumber): Promise<Shipment | null> {
      const trackingNumberStr = TN.toString(trackingNumber)
      logger.debug('Finding shipment by tracking number', { trackingNumber: trackingNumberStr })
      
      const record = await prisma.shipments.findUnique({
        where: { tracking_number: trackingNumberStr },
      })

      if (!record) {
        logger.debug('Shipment not found', { trackingNumber: trackingNumberStr })
        return null
      }

      return S.fromDatabase(prismaShipmentToRecord(record))
    },

    async findByShip24TrackerId(trackerId: string): Promise<Shipment | null> {
      logger.debug('Finding shipment by Ship24 tracker ID', { trackerId })
      
      const record = await prisma.shipments.findFirst({
        where: { ship24_tracker_id: trackerId },
      })

      if (!record) {
        logger.debug('Shipment not found', { trackerId })
        return null
      }

      return S.fromDatabase(prismaShipmentToRecord(record))
    },

    async findActiveShipments(limit: number = 50): Promise<Shipment[]> {
      const endLog = logPerformance(logger, 'findActiveShipments', { limit })
      
      try {
        logger.debug('Finding active shipments', { limit })
        
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

        logger.info('Found active shipments', { count: records.length })
        
        return records.map((record) => S.fromDatabase(prismaShipmentToRecord(record)))
      } finally {
        endLog()
      }
    },

    async findUnregisteredShipments(): Promise<Shipment[]> {
      const endLog = logPerformance(logger, 'findUnregisteredShipments')
      
      try {
        logger.debug('Finding unregistered shipments')
        
        const records = await prisma.shipments.findMany({
          where: {
            ship24_tracker_id: null,
          },
        })

        logger.info('Found unregistered shipments', { count: records.length })
        
        return records.map((record) => S.fromDatabase(prismaShipmentToRecord(record)))
      } finally {
        endLog()
      }
    },

    async save(shipment: Shipment): Promise<Shipment> {
      const persistenceData = S.toPersistence(shipment)
      const prismaData = recordToPrismaData(persistenceData)
      const endLog = logPerformance(logger, 'saveShipment', { 
        trackingNumber: persistenceData.trackingNumber 
      })
      
      try {
        logger.debug('Saving shipment', { 
          trackingNumber: persistenceData.trackingNumber,
          status: persistenceData.status,
        })
        
        const existingRecord = await prisma.shipments.findUnique({
          where: { tracking_number: persistenceData.trackingNumber },
        })

        const record = await prisma.shipments.upsert({
          where: { 
            tracking_number: persistenceData.trackingNumber,
          },
          update: prismaData,
          create: prismaData,
        })

        logger.info('Shipment saved', { 
          id: record.id,
          trackingNumber: record.tracking_number,
          isNew: !shipment.id,
        })

        const previousShipment = existingRecord ? S.fromDatabase(prismaShipmentToRecord(existingRecord)) : null
        const savedShipment = S.fromDatabase(prismaShipmentToRecord(record))
        const events = buildShipmentEvents(previousShipment, savedShipment)
        if (events.length) {
          const eventQueue = getEventQueue()
          await eventQueue.enqueue(events)
        }
        
        return savedShipment
      } catch (error) {
        logger.error('Failed to save shipment', { 
          error,
          trackingNumber: persistenceData.trackingNumber,
        })
        throw error
      } finally {
        endLog()
      }
    },

    async saveMany(shipments: Shipment[]): Promise<void> {
      const endLog = logPerformance(logger, 'saveMany', { count: shipments.length })
      
      try {
        logger.info('Saving multiple shipments', { count: shipments.length })
        
        await prisma.$transaction(
          shipments.map(shipment => {
            const persistenceData = S.toPersistence(shipment)
            const prismaData = recordToPrismaData(persistenceData)
            return prisma.shipments.upsert({
              where: { tracking_number: persistenceData.trackingNumber },
              update: prismaData,
              create: prismaData,
            })
          })
        )

        logger.info('Successfully saved shipments', { count: shipments.length })
      } catch (error) {
        logger.error('Failed to save shipments', { 
          error,
          count: shipments.length,
        })
        throw error
      } finally {
        endLog()
      }
    }
  }
}

/**
 * Singleton repository instance
 */
let repositoryInstance: ShipmentRepository | null = null

/**
 * Get or create the shipment repository
 */
export function getShipmentRepository(): ShipmentRepository {
  if (!repositoryInstance) {
    repositoryInstance = createPrismaShipmentRepository()
  }
  return repositoryInstance
}
