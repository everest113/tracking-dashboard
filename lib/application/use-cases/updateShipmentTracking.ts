import type { Shipment } from '@/lib/domain/entities/Shipment'
import { Shipment as S } from '@/lib/domain/entities/Shipment'
import { TrackingNumber } from '@/lib/domain/value-objects/TrackingNumber'
import { ShipmentStatus } from '@/lib/domain/value-objects/ShipmentStatus'
import type { ShipmentRepository } from '@/lib/infrastructure/repositories/PrismaShipmentRepository'
import type { Ship24Client } from '@/lib/infrastructure/sdks/ship24/client'
import { Ship24Mapper } from '@/lib/infrastructure/mappers/Ship24Mapper'
import { Result, Ok, Err, DomainError } from '@/lib/domain/core/Result'

/**
 * Update Shipment Tracking Use Case - Functional Style
 */

export interface UpdateShipmentTrackingInput {
  readonly shipment: Shipment
}

export interface UpdateShipmentTrackingOutput {
  readonly success: boolean
  readonly statusChanged: boolean
  readonly oldStatus: string
  readonly newStatus: string
  readonly shipment?: Shipment
  readonly error?: string
}

/**
 * Create updateShipmentTracking use case
 */
export const createUpdateShipmentTrackingUseCase = (
  repo: ShipmentRepository,
  ship24: Ship24Client
) => async (
  input: UpdateShipmentTrackingInput
): Promise<Result<UpdateShipmentTrackingOutput, Error>> => {
  const { shipment } = input
  const oldStatus = ShipmentStatus.toString(shipment.status)

  try {
    if (!S.hasTracker(shipment)) {
      return Err(new DomainError('Shipment does not have a Ship24 tracker ID'))
    }

    // Fetch tracking data from Ship24
    const response = await ship24.getTrackerResults(shipment.ship24TrackerId!)
    
    const tracking = response.data.trackings[0]
    if (!tracking) {
      return Err(new DomainError('No tracking data found'))
    }

    // Map to domain data
    const updateData = Ship24Mapper.toDomainTrackingUpdate(tracking)

    // Update shipment (immutable - returns new instance)
    const updatedShipment = S.withTracking(shipment, {
      status: updateData.status,
      shippedDate: updateData.shippedDate || undefined,
      estimatedDelivery: updateData.estimatedDelivery || undefined,
      deliveredDate: updateData.deliveredDate || undefined,
      carrier: updateData.carrier || undefined,
    })

    // Persist new version
    const savedShipment = await repo.save(updatedShipment)

    const newStatus = ShipmentStatus.toString(savedShipment.status)
    const statusChanged = oldStatus !== newStatus

    return Ok({
      success: true,
      statusChanged,
      oldStatus,
      newStatus,
      shipment: savedShipment,
    })
  } catch (error: any) {
    console.error(`Failed to update tracking for ${TrackingNumber.toString(shipment.trackingNumber)}:`, error.message)
    
    return Ok({
      success: false,
      statusChanged: false,
      oldStatus,
      newStatus: oldStatus,
      error: error.message,
    })
  }
}
