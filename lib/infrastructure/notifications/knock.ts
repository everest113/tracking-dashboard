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

// =============================================================================
// Constants
// =============================================================================

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
 * Knock object collection for shipments.
 */
export const SHIPMENTS_COLLECTION = 'shipments'

// =============================================================================
// Types
// =============================================================================

export type ShipmentObjectData = {
  trackingNumber: string
  status: string
  carrier: string | null
  poNumber: string | null
  supplier: string | null
  estimatedDelivery: string | null
  deliveredDate: string | null
  shippedDate: string | null
}

export type ShipmentNotificationData = {
  trackingNumber: string
  status: string
  carrier: string | null
  poNumber: string | null
  previousStatus?: string | null
  estimatedDelivery?: string | null
  deliveredDate?: string | null
}

export type UserProperties = {
  email?: string
  name?: string
  phone_number?: string
  timezone?: string
  locale?: string
  avatar?: string
  // Custom properties
  role?: string
  company?: string
  [key: string]: unknown
}

export type TriggerOptions = {
  tenant?: string
  actor?: string
  idempotencyKey?: string
  cancellationKey?: string
}

// =============================================================================
// Object Management
// =============================================================================

/**
 * Upsert a shipment as a Knock Object.
 * Call this whenever a shipment is created or updated.
 */
export async function upsertShipmentObject(
  shipmentId: string,
  data: ShipmentObjectData
): Promise<{ success: boolean; error?: string }> {
  const knock = getKnockClient()

  if (!knock) {
    console.log(`[knock] Skipping object upsert (no API key): ${shipmentId}`)
    return { success: true }
  }

  try {
    await knock.objects.set(SHIPMENTS_COLLECTION, shipmentId, data)
    console.log(`[knock] Upserted shipment object: ${shipmentId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed to upsert shipment object: ${shipmentId}`, { error: message })
    return { success: false, error: message }
  }
}

/**
 * Delete a shipment object from Knock.
 */
export async function deleteShipmentObject(
  shipmentId: string
): Promise<{ success: boolean; error?: string }> {
  const knock = getKnockClient()

  if (!knock) {
    return { success: true }
  }

  try {
    await knock.objects.delete(SHIPMENTS_COLLECTION, shipmentId)
    console.log(`[knock] Deleted shipment object: ${shipmentId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed to delete shipment object: ${shipmentId}`, { error: message })
    return { success: false, error: message }
  }
}

// =============================================================================
// Subscription Management
// =============================================================================

/**
 * Subscribe users to a shipment.
 * Subscribed users will automatically receive notifications when the shipment is triggered.
 */
export async function subscribeToShipment(
  shipmentId: string,
  userIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const knock = getKnockClient()

  if (!knock) {
    console.log(`[knock] Skipping subscription (no API key): ${shipmentId}`, { userIds })
    return { success: true }
  }

  if (userIds.length === 0) {
    return { success: true }
  }

  try {
    await knock.objects.addSubscriptions(SHIPMENTS_COLLECTION, shipmentId, {
      recipients: userIds,
    })
    console.log(`[knock] Subscribed users to shipment: ${shipmentId}`, { userIds })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed to subscribe users: ${shipmentId}`, { error: message })
    return { success: false, error: message }
  }
}

/**
 * Unsubscribe users from a shipment.
 */
export async function unsubscribeFromShipment(
  shipmentId: string,
  userIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const knock = getKnockClient()

  if (!knock) {
    return { success: true }
  }

  if (userIds.length === 0) {
    return { success: true }
  }

  try {
    await knock.objects.deleteSubscriptions(SHIPMENTS_COLLECTION, shipmentId, {
      recipients: userIds,
    })
    console.log(`[knock] Unsubscribed users from shipment: ${shipmentId}`, { userIds })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed to unsubscribe users: ${shipmentId}`, { error: message })
    return { success: false, error: message }
  }
}

/**
 * Get all subscribers for a shipment.
 */
export async function getShipmentSubscribers(
  shipmentId: string
): Promise<{ subscribers: string[]; error?: string }> {
  const knock = getKnockClient()

  if (!knock) {
    return { subscribers: [] }
  }

  try {
    const response = await knock.objects.listSubscriptions(SHIPMENTS_COLLECTION, shipmentId)
    const subscribers = response.entries.map((sub) => sub.recipient.id)
    return { subscribers }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed to get subscribers: ${shipmentId}`, { error: message })
    return { subscribers: [], error: message }
  }
}

// =============================================================================
// User Management
// =============================================================================

/**
 * Identify a user in Knock with full reserved properties.
 * Call this when users are created or updated in your system.
 */
export async function identifyUser(
  userId: string,
  properties: UserProperties
): Promise<{ success: boolean; error?: string }> {
  const knock = getKnockClient()

  if (!knock) {
    console.log(`[knock] Skipping user identify (no API key): ${userId}`)
    return { success: true }
  }

  try {
    await knock.users.identify(userId, properties)
    console.log(`[knock] Identified user: ${userId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed to identify user: ${userId}`, { error: message })
    return { success: false, error: message }
  }
}

/**
 * Delete a user from Knock.
 */
export async function deleteUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const knock = getKnockClient()

  if (!knock) {
    return { success: true }
  }

  try {
    await knock.users.delete(userId)
    console.log(`[knock] Deleted user: ${userId}`)
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed to delete user: ${userId}`, { error: message })
    return { success: false, error: message }
  }
}

// =============================================================================
// Workflow Triggers
// =============================================================================

/**
 * Trigger a Knock workflow for a shipment.
 * 
 * Uses the shipment object as recipient, which automatically fans out
 * to all subscribed users.
 * 
 * @param workflow - The workflow key to trigger
 * @param shipmentId - The shipment object ID (subscribers will be notified)
 * @param data - Event data to pass to the workflow
 * @param options - Additional trigger options (tenant, actor, idempotency)
 */
export async function triggerShipmentWorkflow(
  workflow: string,
  shipmentId: string,
  data: ShipmentNotificationData,
  options: TriggerOptions = {}
): Promise<{ success: boolean; workflowRunId?: string; error?: string }> {
  const knock = getKnockClient()

  if (!knock) {
    console.log(`[knock] Skipping trigger (no API key): ${workflow}`, { shipmentId, data })
    return { success: true, workflowRunId: 'mock-no-api-key' }
  }

  try {
    // Use shipment object as recipient - Knock fans out to all subscribers
    const response = await knock.workflows.trigger(
      workflow,
      {
        recipients: [
          {
            id: shipmentId,
            collection: SHIPMENTS_COLLECTION,
          },
        ],
        data,
        tenant: options.tenant,
        actor: options.actor,
        cancellation_key: options.cancellationKey,
      },
      options.idempotencyKey
        ? { idempotencyKey: options.idempotencyKey }
        : undefined
    )

    console.log(`[knock] Triggered workflow: ${workflow}`, {
      workflowRunId: response.workflow_run_id,
      shipmentId,
      tenant: options.tenant,
      actor: options.actor,
    })

    return {
      success: true,
      workflowRunId: response.workflow_run_id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed to trigger workflow: ${workflow}`, { error: message })
    return { success: false, error: message }
  }
}

/**
 * Trigger a workflow for specific users (bypassing subscriptions).
 * Use this for ad-hoc notifications to specific recipients.
 */
export async function triggerWorkflowForUsers(
  workflow: string,
  userIds: string[],
  data: Record<string, unknown>,
  options: TriggerOptions = {}
): Promise<{ success: boolean; workflowRunId?: string; error?: string }> {
  const knock = getKnockClient()

  if (!knock) {
    console.log(`[knock] Skipping trigger (no API key): ${workflow}`, { userIds, data })
    return { success: true, workflowRunId: 'mock-no-api-key' }
  }

  if (userIds.length === 0) {
    console.log(`[knock] Skipping trigger (no recipients): ${workflow}`)
    return { success: true }
  }

  try {
    const response = await knock.workflows.trigger(
      workflow,
      {
        recipients: userIds,
        data,
        tenant: options.tenant,
        actor: options.actor,
        cancellation_key: options.cancellationKey,
      },
      options.idempotencyKey
        ? { idempotencyKey: options.idempotencyKey }
        : undefined
    )

    console.log(`[knock] Triggered workflow: ${workflow}`, {
      workflowRunId: response.workflow_run_id,
      userIds,
    })

    return {
      success: true,
      workflowRunId: response.workflow_run_id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed to trigger workflow: ${workflow}`, { error: message })
    return { success: false, error: message }
  }
}

/**
 * Cancel a workflow run.
 */
export async function cancelWorkflow(
  workflow: string,
  cancellationKey: string,
  recipientIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const knock = getKnockClient()

  if (!knock) {
    return { success: true }
  }

  try {
    await knock.workflows.cancel(workflow, {
      cancellation_key: cancellationKey,
      recipients: recipientIds,
    })
    console.log(`[knock] Cancelled workflow: ${workflow}`, { cancellationKey })
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    console.error(`[knock] Failed to cancel workflow: ${workflow}`, { error: message })
    return { success: false, error: message }
  }
}
