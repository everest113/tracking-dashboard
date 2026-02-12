import type { Shipment } from '@/lib/domain/entities/Shipment'
import { Shipment as S } from '@/lib/domain/entities/Shipment'
import type { ShipmentRepository } from '@/lib/infrastructure/repositories/PrismaShipmentRepository'
import type { Ship24Client } from '@/lib/infrastructure/sdks/ship24/client'
import { Ship24Mapper } from '@/lib/infrastructure/mappers/Ship24Mapper'
import { TrackingNumber } from '@/lib/domain/value-objects/TrackingNumber'
import { Result, Ok } from '@/lib/domain/core/Result'
import { getErrorMessage } from '@/lib/utils/fetch-helpers'

export interface RegisterTrackersBulkInput {
  readonly shipments: Shipment[]
}

export interface RegisterTrackerBulkResult {
  readonly trackingNumber: string
  readonly success: boolean
  readonly trackerId?: string
  readonly error?: string
}

/**
 * Register multiple trackers using Ship24's bulk API
 * POST /trackers/bulk
 */
export const createRegisterTrackersBulkUseCase = (
  repo: ShipmentRepository,
  ship24: Ship24Client
) => async (
  input: RegisterTrackersBulkInput
): Promise<Result<RegisterTrackerBulkResult[], Error>> => {
  const { shipments } = input
  
  if (shipments.length === 0) {
    return Ok([])
  }

  try {
    // Filter to only shipments that need registration
    const unregistered = shipments.filter(s => !S.hasTracker(s))
    
    if (unregistered.length === 0) {
      // All already registered, return success for each
      return Ok(shipments.map(s => ({
        trackingNumber: TrackingNumber.toString(s.trackingNumber),
        success: true,
        trackerId: s.ship24TrackerId || undefined,
      })))
    }

    console.log(`📦 Bulk registering ${unregistered.length} trackers with Ship24...`)

    // Call Ship24 bulk API
    const response = await ship24.registerTrackersBulk(
      unregistered.map(s => ({
        trackingNumber: TrackingNumber.toString(s.trackingNumber),
        carrier: Ship24Mapper.normalizeCarrierCode(s.carrier)?.[0],
        poNumber: s.poNumber || undefined,
      }))
    )

    console.log(`Ship24 bulk response: ${response.status}`)
    console.log(`Created: ${response.summary?.totalCreated}, Existing: ${response.summary?.totalExisting}, Errors: ${response.summary?.totalErrors}`)

    // Process results
    const results: RegisterTrackerBulkResult[] = []
    const toUpdate: Shipment[] = []

    if (!response.data) {
      // Request-level error
      return Ok(unregistered.map(s => ({
        trackingNumber: TrackingNumber.toString(s.trackingNumber),
        success: false,
        error: response.error?.message || 'Bulk registration failed',
      })))
    }

    // Process each result
    for (let i = 0; i < unregistered.length; i++) {
      const shipment = unregistered[i]
      const trackingNumber = TrackingNumber.toString(shipment.trackingNumber)
      const result = response.data[i]

      if (!result || result.itemStatus === 'error') {
        const errorMsg = result?.errors?.[0]?.message || 'Unknown error'
        results.push({
          trackingNumber,
          success: false,
          error: errorMsg,
        })
        continue
      }

      const trackerId = result.tracker?.trackerId

      if (!trackerId) {
        results.push({
          trackingNumber,
          success: false,
          error: 'No tracker ID in response',
        })
        continue
      }

      // Update shipment with tracker ID
      const updatedResult = S.withTrackerId(shipment, trackerId)
      
      if (!updatedResult.success) {
        results.push({
          trackingNumber,
          success: false,
          error: updatedResult.error.message,
        })
        continue
      }

      toUpdate.push(updatedResult.value)
      results.push({
        trackingNumber,
        success: true,
        trackerId,
      })
    }

    // Batch update all shipments in database
    if (toUpdate.length > 0) {
      await Promise.all(toUpdate.map(s => repo.save(s)))
      console.log(`✅ Saved ${toUpdate.length} shipments with tracker IDs`)
    }

    // Fetch tracking data for all successfully registered trackers in parallel
    if (toUpdate.length > 0) {
      console.log(`🔄 Fetching initial tracking data for ${toUpdate.length} shipments...`)
      const fetchPromises = toUpdate.map(async (shipment) => {
        try {
          const trackingResponse = await ship24.getTrackerResults(shipment.ship24TrackerId!)
          const tracking = trackingResponse.data.trackings[0]
          
          if (tracking) {
            const updateData = Ship24Mapper.toDomainTrackingUpdate(tracking)
            const updatedShipment = S.withTracking(shipment, {
              status: updateData.status,
              shippedDate: updateData.shippedDate || undefined,
              estimatedDelivery: updateData.estimatedDelivery || undefined,
              deliveredDate: updateData.deliveredDate || undefined,
              carrier: updateData.carrier || undefined,
            })
            
            await repo.save(updatedShipment)
            console.log(`✅ Updated tracking data for ${TrackingNumber.toString(shipment.trackingNumber)}`)
          }
        } catch (error) {
          console.warn(
            `Failed to fetch initial tracking for ${TrackingNumber.toString(shipment.trackingNumber)}:`,
            getErrorMessage(error)
          )
          // Don't fail the whole operation
        }
      })

      await Promise.all(fetchPromises)
    }

    // Add results for already-registered shipments
    const alreadyRegistered = shipments.filter(s => S.hasTracker(s))
    for (const s of alreadyRegistered) {
      results.push({
        trackingNumber: TrackingNumber.toString(s.trackingNumber),
        success: true,
        trackerId: s.ship24TrackerId || undefined,
      })
    }

    return Ok(results)
  } catch (error: unknown) {
    console.error('❌ Bulk tracker registration failed:', getErrorMessage(error))
    
    // Return partial failure results
    return Ok(shipments.map(s => ({
      trackingNumber: TrackingNumber.toString(s.trackingNumber),
      success: false,
      error: getErrorMessage(error),
    })))
  }
}
