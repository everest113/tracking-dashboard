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

// Export for testing/debugging
export const _internal = {
  login,
  refreshTokens,
  getAccessToken,
  clearCache: () => {
    cachedTokens = null
  },
}
