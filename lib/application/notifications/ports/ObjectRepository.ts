/**
 * Port for notification object operations.
 * Objects represent entities that can have subscribers and receive notifications.
 */
export interface ObjectRepository {
  /**
   * Upsert an object in the notification system.
   */
  upsert(
    collection: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<ObjectResult>

  /**
   * Delete an object from the notification system.
   */
  delete(collection: string, id: string): Promise<ObjectResult>

  /**
   * Subscribe users to an object.
   */
  subscribe(
    collection: string,
    id: string,
    userIds: string[]
  ): Promise<ObjectResult>

  /**
   * Unsubscribe users from an object.
   */
  unsubscribe(
    collection: string,
    id: string,
    userIds: string[]
  ): Promise<ObjectResult>

  /**
   * Get all subscribers for an object.
   */
  getSubscribers(
    collection: string,
    id: string
  ): Promise<{ subscribers: string[]; error?: string }>
}

export type ObjectResult = {
  success: boolean
  error?: string
}
