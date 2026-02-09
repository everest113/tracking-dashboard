export interface ShipmentResponse {
  id: number
  trackingNumber: string
  carrier: string | null
  status: string
  poNumber: string | null
  supplier: string | null
  createdAt: string
  updatedAt: string
}

export interface SyncHistoryResponse {
  id: number
  started_at: string
  completed_at: string | null
  conversations_processed: number
  shipments_added: number
}
