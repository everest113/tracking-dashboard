import type { NotificationChannel } from '@prisma/client'
import type { NotificationPayload, SendResult } from './types'

export interface ChannelAdapter {
  channel: NotificationChannel
  send(payload: NotificationPayload): Promise<SendResult>
}
