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

/**
 * Trigger a Knock workflow for shipment events.
 * 
 * @param workflow - The workflow key to trigger
 * @param recipients - User IDs or objects to notify
 * @param data - Event data to pass to the workflow
 */
export async function triggerShipmentNotification(
  workflow: string,
  recipients: string[],
  data: Record<string, unknown>
): Promise<{ success: boolean; workflowRunId?: string; error?: string }> {
  const knock = getKnockClient()
  
  if (!knock) {
    console.log(`[knock] Skipping notification (no API key): ${workflow}`, data)
    return { success: true, workflowRunId: 'mock-no-api-key' }
  }

  try {
    const response = await knock.workflows.trigger(workflow, {
      recipients,
      data,
    })

    console.log(`[knock] Triggered workflow: ${workflow}`, {
      workflowRunId: response.workflow_run_id,
      recipients,
    })

    return {
      success: true,
      workflowRunId: response.workflow_run_id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed to trigger workflow: ${workflow}`, { error: message })
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Identify a user in Knock.
 * Call this when you have user information to sync with Knock.
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
