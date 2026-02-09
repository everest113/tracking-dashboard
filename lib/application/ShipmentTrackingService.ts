import { Shipment as S } from '../domain/entities/Shipment'
import { TrackingNumber as TN } from '../domain/value-objects/TrackingNumber'
import { ShipmentStatus as SS } from '../domain/value-objects/ShipmentStatus'
import { createPrismaShipmentRepository } from '../infrastructure/repositories/PrismaShipmentRepository'
import { createShip24Client } from '../infrastructure/sdks/ship24/client'
import { createRegisterTrackerUseCase } from './use-cases/registerTracker'
import { createUpdateShipmentTrackingUseCase } from './use-cases/updateShipmentTracking'
import { createProcessWebhookUseCase } from './use-cases/processWebhook'
import type { Ship24Tracking } from '../infrastructure/sdks/ship24/schemas'

/**
 * Shipment Tracking Service - Functional Style
 * Pure dependency injection, no classes, no 'this'
 */

export interface ShipmentTrackingService {
  registerTracker(trackingNumber: string, carrier: string | null, poNumber?: string): Promise<any>
  registerTrackersBulk(shipments: Array<{ trackingNumber: string; carrier: string | null; poNumber?: string }>): Promise<any>
  updateActiveShipments(limit?: number): Promise<any>
  backfillTrackers(): Promise<any>
  processWebhook(trackerId: string, trackingNumber: string, tracking: Ship24Tracking): Promise<any>
  getShipment(trackingNumber: string): Promise<any>
}

/**
 * Create Shipment Tracking Service (factory function)
 */
export const createShipmentTrackingService = (): ShipmentTrackingService => {
  // Dependencies
  const repository = createPrismaShipmentRepository()
  const ship24Client = createShip24Client()
  
  // Use cases (dependency injection via closures)
  const registerTrackerUC = createRegisterTrackerUseCase(repository, ship24Client)
  const updateTrackingUC = createUpdateShipmentTrackingUseCase(repository, ship24Client)
  const processWebhookUC = createProcessWebhookUseCase(repository)

  return {
    /**
     * Register a single tracker
     */
    async registerTracker(trackingNumber: string, carrier: string | null, poNumber?: string) {
      // Validate tracking number
      const tnResult = TN.create(trackingNumber)
      if (!tnResult.success) {
        const errorMsg = tnResult.error.message
        return {
          success: false,
          trackerId: null,
          error: errorMsg,
        }
      }

      const tn = tnResult.value

      // Find or create shipment
      let shipment = await repository.findByTrackingNumber(tn)

      if (!shipment) {
        const statusResult = SS.create('pending')
        if (!statusResult.success) {
          const errorMsg = statusResult.error.message
          return {
            success: false,
            trackerId: null,
            error: errorMsg,
          }
        }

        shipment = S.create({
          trackingNumber: tn,
          carrier,
          poNumber: poNumber || null,
          supplier: null,
          status: statusResult.value,
          ship24TrackerId: null,
          shippedDate: null,
          estimatedDelivery: null,
          deliveredDate: null,
          lastChecked: null,
          frontConversationId: null,
        })
        shipment = await repository.save(shipment)
      }

      const result = await registerTrackerUC({ shipment })
      
      if (!result.success) {
        const errorMsg = result.error.message
        return {
          success: false,
          trackerId: null,
          error: errorMsg,
        }
      }

      return result.value
    },

    /**
     * Register multiple trackers in bulk
     */
    async registerTrackersBulk(
      shipments: Array<{ trackingNumber: string; carrier: string | null; poNumber?: string }>
    ) {
      const results = []

      for (const item of shipments) {
        const result = await this.registerTracker(item.trackingNumber, item.carrier, item.poNumber)
        results.push({
          trackingNumber: item.trackingNumber,
          ...result,
        })
      }

      return results
    },

    /**
     * Update tracking for active shipments
     */
    async updateActiveShipments(limit: number = 50) {
      const shipments = await repository.findActiveShipments(limit)
      const results = []

      for (const shipment of shipments) {
        const result = await updateTrackingUC({ shipment })
        
        if (result.success) {
          results.push({
            trackingNumber: TN.toString(shipment.trackingNumber),
            ...result.value,
          })
        } else {
          const errorMsg = result.error.message
          results.push({
            trackingNumber: TN.toString(shipment.trackingNumber),
            success: false,
            error: errorMsg,
            statusChanged: false,
            oldStatus: SS.toString(shipment.status),
            newStatus: SS.toString(shipment.status),
          })
        }
      }

      return results
    },

    /**
     * Backfill tracker registration for unregistered shipments
     */
    async backfillTrackers() {
      const unregistered = await repository.findUnregisteredShipments()
      const results = []

      for (const shipment of unregistered) {
        const result = await registerTrackerUC({ shipment })
        
        const output = result.success ? result.value : {
          success: false,
          trackerId: null,
          error: result.error.message,
        }

        results.push({
          trackingNumber: TN.toString(shipment.trackingNumber),
          ...output,
        })
      }

      return {
        total: unregistered.length,
        registered: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      }
    },

    /**
     * Process webhook from Ship24
     */
    async processWebhook(trackerId: string, trackingNumber: string, tracking: Ship24Tracking) {
      const result = await processWebhookUC({
        trackerId,
        trackingNumber,
        tracking,
      })

      if (result.success) {
        return result.value
      }

      const errorMsg = result.error.message
      return {
        success: false,
        statusChanged: false,
        oldStatus: 'unknown',
        newStatus: 'unknown',
        trackingNumber,
        error: errorMsg,
      }
    },

    /**
     * Get shipment by tracking number
     */
    async getShipment(trackingNumber: string) {
      const tnResult = TN.create(trackingNumber)
      if (!tnResult.success) {
        return null
      }
      
      return repository.findByTrackingNumber(tnResult.value)
    }
  }
}

/**
 * Singleton instance
 */
let serviceInstance: ShipmentTrackingService | null = null

export const getShipmentTrackingService = (): ShipmentTrackingService => {
  if (!serviceInstance) {
    serviceInstance = createShipmentTrackingService()
  }
  return serviceInstance
}
