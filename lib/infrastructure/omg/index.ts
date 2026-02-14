/**
 * OMG Orders API Integration
 *
 * Provides access to order and tracking data from stitchi.omgorders.app
 */

export {
  // Read operations
  listOrders,
  getPurchaseOrders,
  getPurchaseOrder,
  getAllTrackingNumbers,
  findByTrackingNumber,
  findPurchaseOrderByPoNumber,
  // Write operations
  addTrackingToPurchaseOrder,
  batchAddTracking,
  // Types
  type OMGOrder,
  type OMGPurchaseOrder,
  type OMGTracking,
  type AddTrackingInput,
} from './client'
