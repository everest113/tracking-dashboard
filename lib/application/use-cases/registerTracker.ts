import type { Shipment } from '@/lib/domain/entities/Shipment'
import { Shipment as S } from '@/lib/domain/entities/Shipment'
import type { ShipmentRepository } from '@/lib/infrastructure/repositories/PrismaShipmentRepository'
import type { Ship24Client } from '@/lib/infrastructure/sdks/ship24/client'
import { Ship24Mapper } from '@/lib/infrastructure/mappers/Ship24Mapper'
import { TrackingNumber } from '@/lib/domain/value-objects/TrackingNumber'
import { Result, Ok, Err } from '@/lib/domain/core/Result'

/**
 * Register Tracker Use Case - Functional Style
 * Pure function that takes dependencies and returns an async function
 */

export interface RegisterTrackerInput {
  readonly shipment: Shipment
}

export interface RegisterTrackerOutput {
  readonly success: boolean
  readonly trackerId: string | null
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
      return Ok({
        success: true,
        trackerId: shipment.ship24TrackerId,
        shipment,
      })
    }

    // Register with Ship24
    const response = await ship24.registerTracker({
      trackingNumber: TrackingNumber.toString(shipment.trackingNumber),
      courierCode: Ship24Mapper.normalizeCarrierCode(shipment.carrier),
      shipmentReference: shipment.poNumber || undefined,
    })

    const trackerId = response.data.tracker.trackerId

    // Update shipment with tracker ID (immutable)
    const updatedShipmentResult = S.withTrackerId(shipment, trackerId)
    
    if (!updatedShipmentResult.success) {
      return Err(updatedShipmentResult.error)
    }

    const updatedShipment = updatedShipmentResult.value

    // Persist
    const savedShipment = await repo.save(updatedShipment)

    return Ok({
      success: true,
      trackerId,
      shipment: savedShipment,
    })
  } catch (error: any) {
    console.error(`Failed to register tracker for ${TrackingNumber.toString(shipment.trackingNumber)}:`, error.message)
    
    return Ok({
      success: false,
      trackerId: null,
      error: error.message,
    })
  }
}
