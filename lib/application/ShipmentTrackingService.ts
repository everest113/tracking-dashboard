import { Shipment as S } from '../domain/entities/Shipment'
import { TrackingNumber as TN } from '../domain/value-objects/TrackingNumber'
import { ShipmentStatus as SS } from '../domain/value-objects/ShipmentStatus'
import { createPrismaShipmentRepository } from '../infrastructure/repositories/PrismaShipmentRepository'
import { createShip24Client } from '../infrastructure/sdks/ship24/client'
import { createRegisterTrackerUseCase } from './use-cases/registerTracker'
import { createRegisterTrackersBulkUseCase } from './use-cases/registerTrackersBulk'
import { createUpdateShipmentTrackingUseCase } from './use-cases/updateShipmentTracking'
import { createProcessWebhookUseCase } from './use-cases/processWebhook'
import type { Ship24Tracking } from '../infrastructure/sdks/ship24/schemas'
import type { TrackingUpdateResult, TrackerRegistrationResult } from './types'

/**
 * Shipment Tracking Service - Functional Style
 * Pure dependency injection, no classes, no 'this'
 */

export interface ShipmentTrackingService {
  registerTracker(trackingNumber: string, carrier?: string | null, poNumber?: string): Promise<TrackerRegistrationResult>
  registerTrackersBulk(shipments: Array<{ trackingNumber: string; carrier?: string | null; poNumber?: string }>): Promise<TrackerRegistrationResult[]>
  updateActiveShipments(limit?: number): Promise<TrackingUpdateResult[]>
  backfillTrackers(): Promise<{ total: number; registered: number; skipped: number; errors: string[] }>
  processWebhook(trackerId: string, trackingNumber: string, tracking: Ship24Tracking): Promise<{ success: boolean; statusChanged: boolean; oldStatus: string; newStatus: string }>
  getShipment(trackingNumber: string): Promise<S | null>
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
  const registerTrackersBulkUC = createRegisterTrackersBulkUseCase(repository, ship24Client)
  const updateTrackingUC = createUpdateShipmentTrackingUseCase(repository, ship24Client)
  const processWebhookUC = createProcessWebhookUseCase(repository)

  return {
    /**
     * Register a single tracker
     */
    async registerTracker(trackingNumber: string, carrier?: string | null, poNumber?: string) {
      // Validate tracking number
      const tnResult = TN.create(trackingNumber)
      if (!tnResult.success) {
        const errorMsg = tnResult.error.message
        return {
        success: false,
        trackingNumber,
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
        trackingNumber,
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
        trackingNumber,
        error: errorMsg,
        }
      }

      return result.value
    },

    /**
     * Register multiple trackers in bulk (uses Ship24 bulk API)
     */
    async registerTrackersBulk(
      shipmentsInput: Array<{ trackingNumber: string; carrier: string | null; poNumber?: string }>
    ) {
      // Create or find shipments
      const shipments: S[] = []
      
      for (const item of shipmentsInput) {
        const tnResult = TN.create(item.trackingNumber)
        if (!tnResult.success) {
          continue // Skip invalid tracking numbers
        }

        const tn = tnResult.value
        let shipment = await repository.findByTrackingNumber(tn)

        if (!shipment) {
          const statusResult = SS.create('pending')
          if (!statusResult.success) continue

          shipment = S.create({
            trackingNumber: tn,
            carrier: item.carrier,
            poNumber: item.poNumber || null,
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

        shipments.push(shipment)
      }

      // Use bulk registration use case
      const result = await registerTrackersBulkUC({ shipments })
      
      if (!result.success) {
        return shipmentsInput.map(item => ({
          trackingNumber: item.trackingNumber,
          success: false,
          error: result.error.message,
        }))
      }

      return result.value
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
    async backfillTrackers(): Promise<{ total: number; registered: number; skipped: number; errors: string[] }> {
      const unregistered = await repository.findUnregisteredShipments()
      
      // Use bulk registration for efficiency
      const result = await registerTrackersBulkUC({ shipments: unregistered })
      
      if (!result.success) {
        return {
          total: unregistered.length,
          registered: 0,
          skipped: unregistered.length,
          errors: [result.error.message],
        }
      }

      const results = result.value

      return {
        total: unregistered.length,
        registered: results.filter(r => r.success).length,
        skipped: results.filter(r => !r.success).length,
        errors: results.filter(r => !r.success).map(r => r.error || "Unknown error"),
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
