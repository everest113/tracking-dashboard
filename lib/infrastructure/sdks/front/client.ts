import {
  FrontInboxListResponseSchema,
  FrontConversationListResponseSchema,
  FrontMessageListResponseSchema,
  type FrontConversation,
  type FrontMessage,
  type FrontInbox,
} from './schemas'

/**
 * Front API Client - Functional Implementation
 * Docs: https://dev.frontapp.com/reference/introduction
 */

const FRONT_API_BASE = 'https://api2.frontapp.com'

export interface FrontClient {
  getInboxes(): Promise<FrontInbox[]>
  getInboxByName(name: string): Promise<FrontInbox | null>
  getInboxConversations(inboxId: string, options?: GetInboxConversationsOptions): Promise<FrontConversation[]>
  getConversationMessages(conversationId: string): Promise<FrontMessage[]>
  listConversations(options?: ListConversationsOptions): Promise<FrontConversation[]>
}

export interface GetInboxConversationsOptions {
  limit?: number
  after?: Date
}

export interface ListConversationsOptions {
  limit?: number
  after?: Date
  inboxId?: string
}

/**
 * Create Front API Client (factory function with dependency injection)
 */
export const createFrontClient = (apiToken: string = process.env.FRONT_API_TOKEN || ''): FrontClient => {
  /**
   * Internal fetch helper with error handling
   */
  const apiFetch = async (endpoint: string): Promise<any> => {
    const response = await fetch(`${FRONT_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Front API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  return {
    /**
     * Get all inboxes
     */
    async getInboxes(): Promise<FrontInbox[]> {
      const data = await apiFetch('/inboxes')
      const validated = FrontInboxListResponseSchema.parse(data)
      return validated._results
    },

    /**
     * Get inbox by name
     */
    async getInboxByName(name: string): Promise<FrontInbox | null> {
      const inboxes = await this.getInboxes()
      return inboxes.find(inbox => inbox.name === name) || null
    },

    /**
     * Get conversations from an inbox with optional date filtering
     */
    async getInboxConversations(
      inboxId: string,
      options: GetInboxConversationsOptions = {}
    ): Promise<FrontConversation[]> {
      const { limit = 1000, after } = options

      const conversations: FrontConversation[] = []
      const perPage = Math.min(100, limit) // Front API max is 100 per request

      // Build initial query
      let query = `limit=${perPage}`
      if (after) {
        // Convert date to Unix timestamp (seconds)
        const afterTimestamp = Math.floor(after.getTime() / 1000)
        query += `&after=${afterTimestamp}`
      }

      let pageUrl: string | null = `/inboxes/${inboxId}/conversations?${query}`
      let remaining = limit

      while (pageUrl && remaining > 0) {
        const data = await apiFetch(pageUrl)
        const validated = FrontConversationListResponseSchema.parse(data)
        const results = validated._results

        // Filter by date if needed (Front API after param might not work perfectly)
        const filteredResults = after
          ? results.filter((c) => c.created_at >= Math.floor(after.getTime() / 1000))
          : results

        // Add results up to the limit
        const toAdd = filteredResults.slice(0, remaining)
        conversations.push(...toAdd)
        remaining -= toAdd.length

        // Check for next page
        if (validated._pagination?.next && remaining > 0) {
          const nextUrl = new URL(validated._pagination.next)
          pageUrl = nextUrl.pathname + nextUrl.search
        } else {
          pageUrl = null
        }

        // If we've reached our limit or no more results, stop
        if (remaining <= 0 || results.length === 0) {
          break
        }
      }

      return conversations
    },

    /**
     * Get messages for a conversation
     */
    async getConversationMessages(conversationId: string): Promise<FrontMessage[]> {
      const data = await apiFetch(`/conversations/${conversationId}/messages`)
      const validated = FrontMessageListResponseSchema.parse(data)
      return validated._results
    },

    /**
     * List conversations (supports both inbox-scoped and global queries)
     * This method provides a unified interface for fetching conversations
     */
    async listConversations(options: ListConversationsOptions = {}): Promise<FrontConversation[]> {
      const { limit = 1000, after, inboxId } = options

      // If inboxId is provided, use inbox-scoped query
      if (inboxId) {
        return this.getInboxConversations(inboxId, { limit, after })
      }

      // Otherwise, fetch from default inbox (FRONT_SUPPLIERS_INBOX)
      const defaultInboxId = process.env.FRONT_SUPPLIERS_INBOX
      if (!defaultInboxId) {
        throw new Error('FRONT_SUPPLIERS_INBOX environment variable not set')
      }

      return this.getInboxConversations(defaultInboxId, { limit, after })
    },
  }
}

/**
 * Singleton instance
 */
let clientInstance: FrontClient | null = null

export const getFrontClient = (): FrontClient => {
  if (!clientInstance) {
    clientInstance = createFrontClient()
  }
  return clientInstance
}
