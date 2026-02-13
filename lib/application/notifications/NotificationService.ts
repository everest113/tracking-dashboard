import type { NotificationPayload, SendResult } from './types'

export interface NotificationService {
  send(payload: NotificationPayload): Promise<SendResult>
}
