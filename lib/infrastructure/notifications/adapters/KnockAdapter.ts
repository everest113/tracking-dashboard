import { Knock } from '@knocklabs/node'
import type { NotificationService } from '@/lib/application/notifications/NotificationService'
import type { NotificationPayload, SendResult } from '@/lib/application/notifications/types'

/**
 * Knock adapter - sends notifications via Knock's unified API.
 * 
 * Knock handles multi-channel routing internally via workflows.
 * We trigger a workflow and Knock decides which channels to use
 * based on the workflow configuration and user preferences.
 */
export function createKnockAdapter(apiKey: string): NotificationService {
  const knock = new Knock(apiKey)

  return {
    async send(payload: NotificationPayload): Promise<SendResult> {
      try {
        // Map our channel to a Knock workflow key
        // In Knock, you define workflows in the dashboard that handle channel routing
        const workflowKey = getWorkflowKey(payload)

        const response = await knock.workflows.trigger(workflowKey, {
          recipients: [payload.recipient],
          data: {
            subject: payload.subject,
            body: payload.body,
            channel: payload.channel,
            ...payload.metadata,
          },
        })

        return {
          success: true,
          providerId: response.workflow_run_id,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error)
        return {
          success: false,
          error: message,
        }
      }
    },
  }
}

/**
 * Map notification channel/type to a Knock workflow key.
 * These workflow keys should match workflows defined in the Knock dashboard.
 */
function getWorkflowKey(payload: NotificationPayload): string {
  // Check for event-specific workflow in metadata
  const eventType = payload.metadata?.triggerEvent as string | undefined
  if (eventType) {
    // e.g., "shipment.delivered" -> "shipment-delivered"
    return eventType.replace(/\./g, '-')
  }

  // Fallback to channel-based workflow
  switch (payload.channel) {
    case 'EMAIL':
      return 'email-notification'
    case 'SLACK':
      return 'slack-notification'
    case 'SMS':
      return 'sms-notification'
    case 'WEBHOOK':
      return 'webhook-notification'
    default:
      return 'default-notification'
  }
}
