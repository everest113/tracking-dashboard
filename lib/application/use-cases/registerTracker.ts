import type { Shipment } from '@/lib/domain/entities/Shipment'
import { Shipment as S } from '@/lib/domain/entities/Shipment'
import type { ShipmentRepository } from '@/lib/infrastructure/repositories/PrismaShipmentRepository'
import type { Ship24Client } from '@/lib/infrastructure/sdks/ship24/client'
import { Ship24Mapper } from '@/lib/infrastructure/mappers/Ship24Mapper'
import { TrackingNumber } from '@/lib/domain/value-objects/TrackingNumber'
import { Result, Ok, Err } from '@/lib/domain/core/Result'
import { domainEvents } from '@/lib/domain/events'

import { getErrorMessage } from '@/lib/utils/fetch-helpers'
/**
 * Register Tracker Use Case - Functional Style
 * Pure function that takes dependencies and returns an async function
 */

export interface RegisterTrackerInput {
  readonly shipment: Shipment
}

export interface RegisterTrackerOutput {
  readonly success: boolean
  readonly trackingNumber: string
  readonly trackerId?: string
  readonly shipment?: Shipment
  readonly error?: string
}

/**
 * Create registerTracker use case (dependency injection via closure)
 */
export const createRegisterTrackerUseCase = (
  repo: ShipmentRepository,
  ship24: Ship24Client
) => async (
  input: RegisterTrackerInput
): Promise<Result<RegisterTrackerOutput, Error>> => {
  const { shipment } = input

  try {
    // Check if already registered
    if (S.hasTracker(shipment)) {
      // Already registered, fetch latest data
      try {
        const response = await ship24.getTrackerResults(shipment.ship24TrackerId!)
        const tracking = response.data.trackings[0]
        
        if (tracking) {
          const updateData = Ship24Mapper.toDomainTrackingUpdate(tracking)
          const updatedShipment = S.withTracking(shipment, {
            status: updateData.status,
            shippedDate: updateData.shippedDate || undefined,
            estimatedDelivery: updateData.estimatedDelivery || undefined,
            deliveredDate: updateData.deliveredDate || undefined,
            carrier: updateData.carrier || undefined,
          })
          
          const savedShipment = await repo.save(updatedShipment)
          
          return Ok({
            success: true,
            trackingNumber: TrackingNumber.toString(savedShipment.trackingNumber),
            trackerId: savedShipment.ship24TrackerId || undefined,
            shipment: savedShipment,
          })
        }
      } catch (error) {
        console.warn(`Failed to fetch initial tracking data for existing tracker:`, getErrorMessage(error))
      }
      
      // If fetch failed, still return success (tracker is registered)
      return Ok({
        success: true,
        trackingNumber: TrackingNumber.toString(shipment.trackingNumber),
        trackerId: shipment.ship24TrackerId || undefined,
        shipment,
      })
    }

    // Register with Ship24
    const response = await ship24.registerTracker(
      TrackingNumber.toString(shipment.trackingNumber),
      Ship24Mapper.normalizeCarrierCode(shipment.carrier)?.[0],
      shipment.poNumber || undefined
    )

    const trackerId = response.data.tracker.trackerId

    // Update shipment with tracker ID (immutable)
    const updatedShipmentResult = S.withTrackerId(shipment, trackerId)
    
    if (!updatedShipmentResult.success) {
      return Err(updatedShipmentResult.error)
    }

    let updatedShipment = updatedShipmentResult.value

    // Immediately fetch latest tracking data
    try {
      const trackingResponse = await ship24.getTrackerResults(trackerId)
      const tracking = trackingResponse.data.trackings[0]
      
      if (tracking) {
        const updateData = Ship24Mapper.toDomainTrackingUpdate(tracking)
        updatedShipment = S.withTracking(updatedShipment, {
          status: updateData.status,
          shippedDate: updateData.shippedDate || undefined,
          estimatedDelivery: updateData.estimatedDelivery || undefined,
          deliveredDate: updateData.deliveredDate || undefined,
          carrier: updateData.carrier || undefined,
        })
      }
    } catch (error) {
      console.warn(`Failed to fetch initial tracking data for ${trackerId}:`, getErrorMessage(error))
      // Don't fail the whole operation - tracker is registered, we'll get data later
    }

    // Persist
    const savedShipment = await repo.save(updatedShipment)

    // Emit tracker registered event
    if (savedShipment.id) {
      domainEvents.emit('ShipmentTrackerRegistered', {
        shipmentId: savedShipment.id,
        trackingNumber: TrackingNumber.toString(savedShipment.trackingNumber),
        trackerId,
      })
    }

    return Ok({
      success: true,
      trackingNumber: TrackingNumber.toString(savedShipment.trackingNumber),
      trackerId,
      shipment: savedShipment,
    })
  } catch (error: unknown) {
    const errorMsg = getErrorMessage(error)
    console.error(`Failed to register tracker for ${TrackingNumber.toString(shipment.trackingNumber)}:`, errorMsg)
    
    // Emit tracker failed event
    if (shipment.id) {
      domainEvents.emit('ShipmentTrackerFailed', {
        shipmentId: shipment.id,
        trackingNumber: TrackingNumber.toString(shipment.trackingNumber),
        error: errorMsg,
      })
    }
    
    return Ok({
        trackingNumber: TrackingNumber.toString(input.shipment.trackingNumber),
        success: false,
        error: errorMsg,
    })
  }
}
