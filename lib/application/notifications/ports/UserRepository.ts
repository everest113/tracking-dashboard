/**
 * Port for notification user operations.
 * Users are recipients who can receive notifications.
 */
export interface UserRepository {
  /**
   * Identify/upsert a user in the notification system.
   */
  identify(userId: string, properties: UserProperties): Promise<UserResult>

  /**
   * Delete a user from the notification system.
   */
  delete(userId: string): Promise<UserResult>
}

export type UserProperties = {
  email?: string
  name?: string
  phone_number?: string
  timezone?: string
  locale?: string
  avatar?: string
  [key: string]: unknown
}

export type UserResult = {
  success: boolean
  error?: string
}
