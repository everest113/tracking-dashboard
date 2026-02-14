export * from './ports'
export * from './types'
export * from './ShipmentNotificationService'

import { createShipmentNotificationService, type ShipmentNotificationService } from './ShipmentNotificationService'
import { getNotificationService, getObjectRepository } from '@/lib/infrastructure/notifications/knock'

let shipmentNotificationService: ShipmentNotificationService | null = null

/**
 * Get the singleton shipment notification service.
 */
export function getShipmentNotificationService(): ShipmentNotificationService {
  if (!shipmentNotificationService) {
    shipmentNotificationService = createShipmentNotificationService(
      getNotificationService(),
      getObjectRepository()
    )
  }
  return shipmentNotificationService
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetShipmentNotificationService(): void {
  shipmentNotificationService = null
}
