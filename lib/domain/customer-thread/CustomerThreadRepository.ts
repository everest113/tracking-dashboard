/**
 * Customer Thread Repository Interface (Port)
 *
 * Defines the contract for customer thread link persistence.
 */

import type {
  CustomerThreadLink,
  CreateCustomerThreadInput,
  ThreadMatchStatusType,
} from './types'

export interface CustomerThreadRepository {
  /**
   * Create a new customer thread link.
   */
  create(input: CreateCustomerThreadInput): Promise<CustomerThreadLink>

  /**
   * Get thread link by shipment ID.
   */
  getByShipmentId(shipmentId: number): Promise<CustomerThreadLink | null>

  /**
   * Get thread link by conversation ID.
   */
  getByConversationId(conversationId: string): Promise<CustomerThreadLink[]>

  /**
   * Update match status (for manual review).
   */
  updateStatus(
    shipmentId: number,
    status: ThreadMatchStatusType,
    reviewedBy?: string
  ): Promise<CustomerThreadLink>

  /**
   * Update to a different conversation (manual link).
   */
  updateConversation(
    shipmentId: number,
    newConversationId: string,
    reviewedBy: string
  ): Promise<CustomerThreadLink>

  /**
   * Get all links pending review.
   */
  getPendingReview(limit?: number): Promise<CustomerThreadLink[]>

  /**
   * Delete a thread link.
   */
  delete(shipmentId: number): Promise<void>

  /**
   * Check if a shipment already has a thread link.
   */
  exists(shipmentId: number): Promise<boolean>
}
