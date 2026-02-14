import { Knock } from '@knocklabs/node'

let knockClient: Knock | null = null

/**
 * Get the Knock client singleton.
 * Returns null if KNOCK_API_KEY is not configured.
 */
export function getKnockClient(): Knock | null {
  if (knockClient) return knockClient

  const apiKey = process.env.KNOCK_API_KEY
  if (!apiKey) return null

  knockClient = new Knock(apiKey)
  return knockClient
}

/**
 * Knock workflow keys for shipment notifications.
 * These must be created in the Knock dashboard.
 */
export const KnockWorkflows = {
  ShipmentCreated: 'shipment-created',
  ShipmentStatusChanged: 'shipment-status-changed',
  ShipmentDelivered: 'shipment-delivered',
  ShipmentException: 'shipment-exception',
} as const

export type ShipmentNotificationData = {
  trackingNumber: string
  status: string
  carrier: string | null
  poNumber: string | null
  previousStatus?: string | null
  estimatedDelivery?: string | null
  deliveredDate?: string | null
}

/**
 * Trigger a Knock workflow for shipment events.
 */
export async function triggerShipmentNotification(
  workflow: string,
  recipients: string[],
  data: ShipmentNotificationData
): Promise<{ success: boolean; workflowRunId?: string; error?: string }> {
  const knock = getKnockClient()

  if (!knock) {
    console.log(`[knock] Skipping (no API key): ${workflow}`, { recipients, data })
    return { success: true, workflowRunId: 'mock-no-api-key' }
  }

  if (recipients.length === 0) {
    console.log(`[knock] Skipping (no recipients): ${workflow}`)
    return { success: true }
  }

  try {
    const response = await knock.workflows.trigger(workflow, {
      recipients,
      data,
    })

    console.log(`[knock] Triggered: ${workflow}`, {
      workflowRunId: response.workflow_run_id,
      recipients,
    })

    return {
      success: true,
      workflowRunId: response.workflow_run_id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed: ${workflow}`, { error: message })
    return { success: false, error: message }
  }
}

/**
 * Identify a user in Knock.
 * Call this when you have user information to sync.
 */
export async function identifyUser(
  userId: string,
  properties: {
    email?: string
    name?: string
    phone_number?: string
    [key: string]: unknown
  }
): Promise<void> {
  const knock = getKnockClient()
  if (!knock) return

  await knock.users.identify(userId, properties)
}
