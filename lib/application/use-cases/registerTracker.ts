import type { Shipment } from '@/lib/domain/entities/Shipment'
import { Shipment as S } from '@/lib/domain/entities/Shipment'
import type { ShipmentRepository } from '@/lib/infrastructure/repositories/PrismaShipmentRepository'
import type { Ship24Client } from '@/lib/infrastructure/sdks/ship24/client'
import { Ship24Mapper } from '@/lib/infrastructure/mappers/Ship24Mapper'
import { TrackingNumber } from '@/lib/domain/value-objects/TrackingNumber'
import { Result, Ok, Err } from '@/lib/domain/core/Result'

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
      Ship24Mapper.normalizeCarrierCode(shipment.carrier)?.[0]
    )

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
      trackingNumber: TrackingNumber.toString(savedShipment.trackingNumber),
      trackerId,
      shipment: savedShipment,
    })
  } catch (error: unknown) {
    console.error(`Failed to register tracker for ${TrackingNumber.toString(shipment.trackingNumber)}:`, getErrorMessage(error))
    
    return Ok({
        trackingNumber: TrackingNumber.toString(input.shipment.trackingNumber),
        success: false,
        error: getErrorMessage(error),
    })
  }
}
