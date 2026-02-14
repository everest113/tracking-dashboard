import type {
  NotificationService,
  NotificationResult,
  TriggerOptions,
} from '@/lib/application/notifications/ports/NotificationService'
import { getKnockClient } from './KnockClient'

/**
 * Knock implementation of NotificationService.
 */
export function createKnockNotificationService(): NotificationService {
  return {
    async triggerForObject(
      workflow: string,
      collection: string,
      objectId: string,
      data: Record<string, unknown>,
      options?: TriggerOptions
    ): Promise<NotificationResult> {
      const knock = getKnockClient()

      if (!knock) {
        console.log(`[knock] Skipping trigger (no API key): ${workflow}`, { collection, objectId })
        return { success: true, workflowRunId: 'mock-no-api-key' }
      }

      try {
        const response = await knock.workflows.trigger(
          workflow,
          {
            recipients: [{ id: objectId, collection }],
            data,
            tenant: options?.tenant,
            actor: options?.actor,
            cancellation_key: options?.cancellationKey,
          },
          options?.idempotencyKey
            ? { idempotencyKey: options.idempotencyKey }
            : undefined
        )

        console.log(`[knock] Triggered workflow: ${workflow}`, {
          workflowRunId: response.workflow_run_id,
          collection,
          objectId,
        })

        return { success: true, workflowRunId: response.workflow_run_id }
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error)
        console.error(`[knock] Failed to trigger workflow: ${workflow}`, { error: message })
        return { success: false, error: message }
      }
    },

    async triggerForUsers(
      workflow: string,
      userIds: string[],
      data: Record<string, unknown>,
      options?: TriggerOptions
    ): Promise<NotificationResult> {
      const knock = getKnockClient()

      if (!knock) {
        console.log(`[knock] Skipping trigger (no API key): ${workflow}`, { userIds })
        return { success: true, workflowRunId: 'mock-no-api-key' }
      }

      if (userIds.length === 0) {
        return { success: true }
      }

      try {
        const response = await knock.workflows.trigger(
          workflow,
          {
            recipients: userIds,
            data,
            tenant: options?.tenant,
            actor: options?.actor,
            cancellation_key: options?.cancellationKey,
          },
          options?.idempotencyKey
            ? { idempotencyKey: options.idempotencyKey }
            : undefined
        )

        console.log(`[knock] Triggered workflow: ${workflow}`, {
          workflowRunId: response.workflow_run_id,
          userIds,
        })

        return { success: true, workflowRunId: response.workflow_run_id }
      } catch (error) {
        const message = error instanceof Error ? error.message : JSON.stringify(error)
        console.error(`[knock] Failed to trigger workflow: ${workflow}`, { error: message })
        return { success: false, error: message }
      }
    },

    async cancelWorkflow(
      workflow: string,
      cancellationKey: string,
      recipientIds: string[]
    ): Promise<NotificationResult> {
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
    },
  }
}
