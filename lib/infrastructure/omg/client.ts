/**
 * OMG Orders API Client
 *
 * Reverse-engineered client for stitchi.omgorders.app
 * Handles authentication with auto-refresh of JWT tokens.
 */

const OMG_API_BASE = 'https://prod-api.omgorders.app'
const OMG_CLIENT_ID = 'stitchi'

// Token expiry buffer - refresh 5 minutes before actual expiry
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000

interface OMGTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp in ms
}

interface OMGUser {
  id: string
  email: string
  name: string
  role: string
  avatar?: string
  subscriberId?: string
}

interface OMGAuthResponse {
  access_token: string
  refresh_token: string
  user: OMGUser
}

// In-memory token cache (per-instance)
let cachedTokens: OMGTokens | null = null

/**
 * Parse JWT to extract expiry time
 */
function parseJwtExpiry(token: string): number {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString())
    // Convert seconds to milliseconds
    return decoded.exp * 1000
  } catch {
    // Default to 30 minutes from now if parsing fails
    return Date.now() + 30 * 60 * 1000
  }
}

/**
 * Login to OMG API
 */
async function login(): Promise<OMGTokens> {
  const username = process.env.OMG_USERNAME
  const password = process.env.OMG_PASSWORD

  if (!username || !password) {
    throw new Error('OMG_USERNAME and OMG_PASSWORD environment variables are required')
  }

  const response = await fetch(`${OMG_API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://stitchi.omgorders.app',
    },
    body: JSON.stringify({
      username,
      password,
      client: OMG_CLIENT_ID,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OMG login failed: ${response.status} ${error}`)
  }

  const data: OMGAuthResponse = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: parseJwtExpiry(data.access_token),
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshTokens(refreshToken: string): Promise<OMGTokens> {
  const response = await fetch(`${OMG_API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${refreshToken}`,
    },
  })

  if (!response.ok) {
    // Refresh failed, need to re-login
    throw new Error('Token refresh failed')
  }

  const data: OMGAuthResponse = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: parseJwtExpiry(data.access_token),
  }
}

/**
 * Get valid access token, refreshing or re-authenticating as needed
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedTokens && cachedTokens.expiresAt > Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
    return cachedTokens.accessToken
  }

  // Try to refresh if we have a refresh token
  if (cachedTokens?.refreshToken) {
    try {
      cachedTokens = await refreshTokens(cachedTokens.refreshToken)
      return cachedTokens.accessToken
    } catch {
      // Refresh failed, fall through to login
      console.log('[OMG] Token refresh failed, re-authenticating...')
    }
  }

  // Login fresh
  cachedTokens = await login()
  return cachedTokens.accessToken
}

/**
 * Make authenticated request to OMG API
 */
async function omgFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()

  const response = await fetch(`${OMG_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OMG API error: ${response.status} ${error}`)
  }

  return response.json()
}

// ============================================================================
// API Methods
// ============================================================================

export interface OMGOrder {
  _id: string
  number: string
  name: string
  status: {
    approval: {
      value: string
      by?: string
      at?: string
    }
  }
  customer: {
    _id: string
    name: string
    email?: string[]
  }
  createdAt: string
  updatedAt: string
}

export interface OMGTracking {
  _id: string
  carrierId: string
  number: string // Tracking number
  status: string
  comment?: string
  createdAt: string
  createdBy?: {
    _id: string
    name: string
  }
}

export interface OMGPurchaseOrder {
  _id: string
  poNumber: string
  order: {
    _id: string
    number: string
  }
  supplier: {
    _id: string
    name: string
  }
  customer: {
    _id: string
    name: string
  }
  status: {
    operations: string
  }
  tracking: OMGTracking[]
  inHandsDate?: string
  shipDate?: string
  createdAt: string
  updatedAt: string
}

interface OMGListResponse<T> {
  data: T[]
  results: number
}

/**
 * List orders with pagination
 */
export async function listOrders(
  offset = 0,
  limit = 50
): Promise<{ orders: OMGOrder[]; total: number }> {
  const response = await omgFetch<OMGListResponse<OMGOrder>>(
    `/orders?offset=${offset}&limit=${limit}`
  )
  return {
    orders: response.data,
    total: response.results,
  }
}

/**
 * Get purchase orders for an order
 */
export async function getPurchaseOrders(
  orderId: string
): Promise<OMGPurchaseOrder[]> {
  const response = await omgFetch<OMGListResponse<OMGPurchaseOrder>>(
    `/orders/${orderId}/purchaseOrders?offset=0&limit=100`
  )
  return response.data
}

/**
 * Get full purchase order details including tracking
 */
export async function getPurchaseOrder(
  orderId: string,
  poId: string
): Promise<OMGPurchaseOrder> {
  const response = await omgFetch<{ data: OMGPurchaseOrder }>(
    `/orders/${orderId}/purchaseOrders/${poId}`
  )
  return response.data
}

/**
 * Find all tracking numbers across all orders
 * Useful for matching with shipments
 * 
 * Note: This fetches full PO details for each order which can be slow.
 * Consider caching results or using findByTrackingNumber for single lookups.
 */
export async function getAllTrackingNumbers(): Promise<
  Array<{
    trackingNumber: string
    carrier: string
    poNumber: string
    orderNumber: string
    orderName: string
    customerName: string
    status: string
    orderId: string
    poId: string
  }>
> {
  const results: Array<{
    trackingNumber: string
    carrier: string
    poNumber: string
    orderNumber: string
    orderName: string
    customerName: string
    status: string
    orderId: string
    poId: string
  }> = []

  // Fetch all orders (paginated)
  let offset = 0
  const limit = 50
  let hasMore = true

  while (hasMore) {
    const { orders, total } = await listOrders(offset, limit)

    for (const order of orders) {
      // Get POs for this order (list endpoint)
      const pos = await getPurchaseOrders(order._id)

      for (const po of pos) {
        // Need to fetch full PO details to get tracking
        // The list endpoint doesn't include tracking array
        try {
          const fullPo = await getPurchaseOrder(order._id, po._id)
          
          // Extract tracking numbers
          for (const tracking of fullPo.tracking || []) {
            results.push({
              trackingNumber: tracking.number,
              carrier: tracking.carrierId,
              poNumber: fullPo.poNumber,
              orderNumber: order.number,
              orderName: order.name,
              customerName: order.customer?.name || 'Unknown',
              status: fullPo.status?.operations || 'Unknown',
              orderId: order._id,
              poId: po._id,
            })
          }
        } catch (err) {
          console.warn(`[OMG] Failed to fetch PO ${po._id}:`, err)
        }
      }
    }

    offset += limit
    hasMore = offset < total
  }

  return results
}

/**
 * Find OMG order info by tracking number
 */
export async function findByTrackingNumber(
  trackingNumber: string
): Promise<{
  trackingNumber: string
  carrier: string
  poNumber: string
  orderNumber: string
  orderName: string
  customerName: string
  status: string
} | null> {
  // This is inefficient for single lookups - consider caching or indexing
  const allTracking = await getAllTrackingNumbers()
  return allTracking.find((t) => t.trackingNumber === trackingNumber) || null
}

// ============================================================================
// PO Number Lookup & Tracking Push
// ============================================================================

/**
 * Parse PO number to extract order number
 * PO format: "{orderNumber}-{sequence}" e.g., "189-1"
 */
function parsePoNumber(poNumber: string): { orderNumber: string; sequence: string } | null {
  const match = poNumber.match(/^(\d+)-(\d+)$/)
  if (!match) return null
  return {
    orderNumber: match[1],
    sequence: match[2],
  }
}

/**
 * Find a purchase order by PO number (e.g., "189-1")
 * Returns the PO with order context needed for API calls
 */
export async function findPurchaseOrderByPoNumber(
  poNumber: string
): Promise<{
  po: OMGPurchaseOrder
  order: OMGOrder
} | null> {
  const parsed = parsePoNumber(poNumber)
  if (!parsed) {
    console.warn(`[OMG] Invalid PO number format: ${poNumber}`)
    return null
  }

  // Find the order by order number
  // We need to search through orders to find matching order number
  let offset = 0
  const limit = 50
  let hasMore = true

  while (hasMore) {
    const { orders, total } = await listOrders(offset, limit)

    for (const order of orders) {
      if (order.number === parsed.orderNumber) {
        // Found the order, now find the PO
        const pos = await getPurchaseOrders(order._id)
        const matchingPo = pos.find((po) => po.poNumber === poNumber)

        if (matchingPo) {
          // Get full PO details
          const fullPo = await getPurchaseOrder(order._id, matchingPo._id)
          return { po: fullPo, order }
        }
      }
    }

    offset += limit
    hasMore = offset < total
  }

  return null
}

/**
 * Carrier ID mapping for OMG
 */
const CARRIER_MAP: Record<string, string> = {
  'ups': 'UPS',
  'fedex': 'FedEx',
  'usps': 'USPS',
  'dhl': 'DHL',
  'ontrac': 'OnTrac',
  // Add more as needed
}

/**
 * Normalize carrier name to OMG format
 */
function normalizeCarrier(carrier: string): string {
  const lower = carrier.toLowerCase()
  return CARRIER_MAP[lower] || carrier
}

export interface AddTrackingInput {
  trackingNumber: string
  carrier: string
  status?: string
  comment?: string
}

/**
 * Add tracking to a purchase order
 * 
 * @param poNumber - PO number (e.g., "189-1")
 * @param tracking - Tracking details
 * @returns The created tracking entry, or null if PO not found
 */
export async function addTrackingToPurchaseOrder(
  poNumber: string,
  tracking: AddTrackingInput
): Promise<OMGTracking | null> {
  // Find the PO
  const result = await findPurchaseOrderByPoNumber(poNumber)
  if (!result) {
    console.warn(`[OMG] PO not found: ${poNumber}`)
    return null
  }

  const { po, order } = result

  // Check if tracking already exists
  const existingTracking = po.tracking?.find(
    (t) => t.number === tracking.trackingNumber
  )
  if (existingTracking) {
    console.log(`[OMG] Tracking ${tracking.trackingNumber} already exists on PO ${poNumber}`)
    return existingTracking
  }

  // Add tracking via API
  const response = await omgFetch<{ data: OMGTracking }>(
    `/orders/${order._id}/purchaseOrders/${po._id}/tracking`,
    {
      method: 'POST',
      body: JSON.stringify({
        number: tracking.trackingNumber,
        carrierId: normalizeCarrier(tracking.carrier),
        status: tracking.status || 'Shipped',
        comment: tracking.comment || '',
      }),
    }
  )

  console.log(`[OMG] Added tracking ${tracking.trackingNumber} to PO ${poNumber}`)
  return response.data
}

/**
 * Batch add tracking to multiple POs
 * Useful for syncing multiple shipments at once
 */
export async function batchAddTracking(
  items: Array<{
    poNumber: string
    trackingNumber: string
    carrier: string
  }>
): Promise<{
  success: Array<{ poNumber: string; trackingNumber: string }>
  failed: Array<{ poNumber: string; trackingNumber: string; error: string }>
}> {
  const success: Array<{ poNumber: string; trackingNumber: string }> = []
  const failed: Array<{ poNumber: string; trackingNumber: string; error: string }> = []

  for (const item of items) {
    try {
      const result = await addTrackingToPurchaseOrder(item.poNumber, {
        trackingNumber: item.trackingNumber,
        carrier: item.carrier,
      })

      if (result) {
        success.push({ poNumber: item.poNumber, trackingNumber: item.trackingNumber })
      } else {
        failed.push({
          poNumber: item.poNumber,
          trackingNumber: item.trackingNumber,
          error: 'PO not found',
        })
      }
    } catch (err) {
      failed.push({
        poNumber: item.poNumber,
        trackingNumber: item.trackingNumber,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return { success, failed }
}

// Export for testing/debugging
export const _internal = {
  login,
  refreshTokens,
  getAccessToken,
  clearCache: () => {
    cachedTokens = null
  },
}
