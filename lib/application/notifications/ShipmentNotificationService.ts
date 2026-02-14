import type { NotificationService, TriggerOptions } from './ports/NotificationService'
import type { ObjectRepository } from './ports/ObjectRepository'
import type { ShipmentObjectData, ShipmentNotificationData } from './types'
import { SHIPMENTS_COLLECTION, ShipmentWorkflows } from './types'

/**
 * Application service for shipment notifications.
 * Orchestrates object sync and workflow triggers.
 */
export interface ShipmentNotificationService {
  /**
   * Sync a shipment to the notification system.
   */
  syncShipment(shipmentId: string, data: ShipmentObjectData): Promise<void>

  /**
   * Subscribe users to shipment notifications.
   */
  subscribeUsers(shipmentId: string, userIds: string[]): Promise<void>

  /**
   * Unsubscribe users from shipment notifications.
   */
  unsubscribeUsers(shipmentId: string, userIds: string[]): Promise<void>

  /**
   * Notify subscribers that a shipment was created.
   */
  notifyCreated(
    shipmentId: string,
    data: ShipmentNotificationData,
    options?: TriggerOptions
  ): Promise<void>

  /**
   * Notify subscribers that shipment status changed.
   */
  notifyStatusChanged(
    shipmentId: string,
    data: ShipmentNotificationData,
    options?: TriggerOptions
  ): Promise<void>

  /**
   * Notify subscribers that a shipment was delivered.
   */
  notifyDelivered(
    shipmentId: string,
    data: ShipmentNotificationData,
    options?: TriggerOptions
  ): Promise<void>

  /**
   * Notify subscribers of a shipment exception.
   */
  notifyException(
    shipmentId: string,
    data: ShipmentNotificationData,
    options?: TriggerOptions
  ): Promise<void>
}

/**
 * Create a shipment notification service.
 */
export function createShipmentNotificationService(
  notificationService: NotificationService,
  objectRepository: ObjectRepository
): ShipmentNotificationService {
  const triggerWorkflow = async (
    workflow: string,
    shipmentId: string,
    data: ShipmentNotificationData,
    options?: TriggerOptions
  ) => {
    const result = await notificationService.triggerForObject(
      workflow,
      SHIPMENTS_COLLECTION,
      shipmentId,
      data,
      options
    )
    if (!result.success) {
      console.error(`[shipment-notifications] Failed to trigger ${workflow}:`, result.error)
    }
  }

  return {
    async syncShipment(shipmentId: string, data: ShipmentObjectData) {
      const result = await objectRepository.upsert(SHIPMENTS_COLLECTION, shipmentId, data)
      if (!result.success) {
        console.error(`[shipment-notifications] Failed to sync shipment:`, result.error)
      }
    },

    async subscribeUsers(shipmentId: string, userIds: string[]) {
      const result = await objectRepository.subscribe(SHIPMENTS_COLLECTION, shipmentId, userIds)
      if (!result.success) {
        console.error(`[shipment-notifications] Failed to subscribe users:`, result.error)
      }
    },

    async unsubscribeUsers(shipmentId: string, userIds: string[]) {
      const result = await objectRepository.unsubscribe(SHIPMENTS_COLLECTION, shipmentId, userIds)
      if (!result.success) {
        console.error(`[shipment-notifications] Failed to unsubscribe users:`, result.error)
      }
    },

    async notifyCreated(shipmentId, data, options) {
      await triggerWorkflow(ShipmentWorkflows.Created, shipmentId, data, options)
    },

    async notifyStatusChanged(shipmentId, data, options) {
      await triggerWorkflow(ShipmentWorkflows.StatusChanged, shipmentId, data, options)
    },

    async notifyDelivered(shipmentId, data, options) {
      await triggerWorkflow(ShipmentWorkflows.Delivered, shipmentId, data, options)
    },

    async notifyException(shipmentId, data, options) {
      await triggerWorkflow(ShipmentWorkflows.Exception, shipmentId, data, options)
    },
  }
}
