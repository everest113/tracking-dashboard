/**
 * Port for notification service operations.
 * Infrastructure layer implements this interface.
 */
export interface NotificationService {
  /**
   * Trigger a workflow for an object (fans out to subscribers).
   */
  triggerForObject(
    workflow: string,
    collection: string,
    objectId: string,
    data: Record<string, unknown>,
    options?: TriggerOptions
  ): Promise<NotificationResult>

  /**
   * Trigger a workflow for specific users.
   */
  triggerForUsers(
    workflow: string,
    userIds: string[],
    data: Record<string, unknown>,
    options?: TriggerOptions
  ): Promise<NotificationResult>

  /**
   * Cancel a workflow run.
   */
  cancelWorkflow(
    workflow: string,
    cancellationKey: string,
    recipientIds: string[]
  ): Promise<NotificationResult>
}

export type TriggerOptions = {
  tenant?: string
  actor?: string
  idempotencyKey?: string
  cancellationKey?: string
}

export type NotificationResult = {
  success: boolean
  workflowRunId?: string
  error?: string
}
