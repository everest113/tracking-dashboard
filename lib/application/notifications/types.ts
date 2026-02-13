import type { NotificationChannel, NotificationStatus } from '@prisma/client'

export type NotificationPayload = {
  channel: NotificationChannel
  recipient: string
  subject?: string
  body: string
  metadata?: Record<string, unknown>
}

export type SendResult = {
  success: boolean
  providerId?: string
  error?: string
}

export type QueuedNotification = {
  id: string
  ruleId: string | null
  eventId: string | null
  channel: NotificationChannel
  recipient: string
  subject: string | null
  body: string
  metadata: Record<string, unknown> | null
  status: NotificationStatus
  attempts: number
  availableAt: Date
  lockedAt: Date | null
  lastError: string | null
}

export type TemplateData = Record<string, unknown>
