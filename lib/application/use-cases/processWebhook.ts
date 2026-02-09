import type { Shipment } from '@/lib/domain/entities/Shipment'
import { Shipment as S } from '@/lib/domain/entities/Shipment'
import { TrackingNumber as TN } from '@/lib/domain/value-objects/TrackingNumber'
import { ShipmentStatus as SS } from '@/lib/domain/value-objects/ShipmentStatus'
import type { ShipmentRepository } from '@/lib/infrastructure/repositories/PrismaShipmentRepository'
import { Ship24Mapper } from '@/lib/infrastructure/mappers/Ship24Mapper'
import type { Ship24Tracking } from '@/lib/infrastructure/sdks/ship24/schemas'
import { Result, Ok, Err, NotFoundError } from '@/lib/domain/core/Result'

/**
 * Process Webhook Use Case - Functional Style
 */

export interface ProcessWebhookInput {
  readonly trackerId: string
  readonly trackingNumber: string
  readonly tracking: Ship24Tracking
}

export interface ProcessWebhookOutput {
  readonly success: boolean
  readonly statusChanged: boolean
  readonly oldStatus: string
  readonly newStatus: string
  readonly trackingNumber: string
  readonly shipment?: Shipment
  readonly error?: string
}

/**
 * Create processWebhook use case
 */
export const createProcessWebhookUseCase = (
  repo: ShipmentRepository
) => async (
  input: ProcessWebhookInput
): Promise<Result<ProcessWebhookOutput, Error>> => {
  const { trackerId, trackingNumber: rawTrackingNumber, tracking } = input

  try {
    // Validate tracking number
    const trackingNumberResult = TN.create(rawTrackingNumber)
    
    if (!trackingNumberResult.success) {
      return Err(trackingNumberResult.error)
    }

    const trackingNumber = trackingNumberResult.value

    // Find shipment by tracker ID or tracking number
    let shipment = await repo.findByShip24TrackerId(trackerId)
    
    if (!shipment) {
      shipment = await repo.findByTrackingNumber(trackingNumber)
    }

    if (!shipment) {
      return Err(new NotFoundError(`Shipment not found for tracker ${trackerId} / tracking ${TN.toString(trackingNumber)}`))
    }

    const oldStatus = SS.toString(shipment.status)

    // Map webhook data to domain
    const updateData = Ship24Mapper.toDomainTrackingUpdate(tracking)

    // Update shipment with tracker ID if not set (immutable)
    let updatedShipment = shipment
    if (!S.hasTracker(shipment) && trackerId) {
      const withTrackerResult = S.withTrackerId(shipment, trackerId)
      if (withTrackerResult.success) {
        updatedShipment = withTrackerResult.value
      }
    }

    // Update tracking information (immutable)
    updatedShipment = S.withTracking(updatedShipment, {
      status: updateData.status,
      shippedDate: updateData.shippedDate || undefined,
      estimatedDelivery: updateData.estimatedDelivery || undefined,
      deliveredDate: updateData.deliveredDate || undefined,
      carrier: updateData.carrier || undefined,
    })

    // Persist changes
    const savedShipment = await repo.save(updatedShipment)

    const newStatus = SS.toString(savedShipment.status)
    const statusChanged = oldStatus !== newStatus

    return Ok({
      success: true,
      statusChanged,
      oldStatus,
      newStatus,
      trackingNumber: TN.toString(trackingNumber),
      shipment: savedShipment,
    })
  } catch (error: any) {
    console.error(`Failed to process webhook for ${rawTrackingNumber}:`, error.message)
    
    return Ok({
      success: false,
      statusChanged: false,
      oldStatus: 'unknown',
      newStatus: 'unknown',
      trackingNumber: rawTrackingNumber,
      error: error.message,
    })
  }
}
