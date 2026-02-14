import type { NotificationService } from '@/lib/application/notifications/ports/NotificationService'
import type { ObjectRepository } from '@/lib/application/notifications/ports/ObjectRepository'
import type { UserRepository } from '@/lib/application/notifications/ports/UserRepository'
import { createKnockNotificationService } from './KnockNotificationService'
import { createKnockObjectRepository } from './KnockObjectRepository'
import { createKnockUserRepository } from './KnockUserRepository'

export { getKnockClient, isKnockConfigured, resetKnockClient } from './KnockClient'

// Singletons
let notificationService: NotificationService | null = null
let objectRepository: ObjectRepository | null = null
let userRepository: UserRepository | null = null

/**
 * Get the notification service singleton.
 */
export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = createKnockNotificationService()
  }
  return notificationService
}

/**
 * Get the object repository singleton.
 */
export function getObjectRepository(): ObjectRepository {
  if (!objectRepository) {
    objectRepository = createKnockObjectRepository()
  }
  return objectRepository
}

/**
 * Get the user repository singleton.
 */
export function getUserRepository(): UserRepository {
  if (!userRepository) {
    userRepository = createKnockUserRepository()
  }
  return userRepository
}

/**
 * Reset all singletons (useful for testing).
 */
export function resetAll(): void {
  notificationService = null
  objectRepository = null
  userRepository = null
}
