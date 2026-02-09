/**
 * Front API Client
 * Docs: https://dev.frontapp.com/reference/introduction
 */

const FRONT_API_BASE = 'https://api2.frontapp.com'

export type FrontConversation = {
  id: string
  subject: string
  status: string
  created_at: number
  _links: {
    related: {
      messages: string
    }
  }
}

export type FrontMessage = {
  id: string
  type: string
  body: string
  text: string
  subject: string
  created_at: number
  author: {
    email?: string
    name?: string
  }
  recipients: Array<{
    handle: string
    name?: string
  }>
}

export class FrontClient {
  private apiToken: string

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  private async fetch(endpoint: string) {
    const response = await fetch(`${FRONT_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Front API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  /**
   * Get inbox ID by name
   */
  async getInboxId(inboxName: string): Promise<string | null> {
    const data = await this.fetch('/inboxes')
    const inbox = data._results.find((i: any) => i.name === inboxName)
    return inbox?.id || null
  }

  /**
   * Get conversations from an inbox with optional date filtering
   * @param inboxId - Inbox ID
   * @param options - Query options
   */
  async getInboxConversations(
    inboxId: string, 
    options: {
      limit?: number
      after?: Date  // Get conversations created after this date
    } = {}
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
      const data = await this.fetch(pageUrl)
      const results = data._results || []
      
      // Filter by date if needed (Front API after param might not work perfectly)
      const filteredResults = after 
        ? results.filter((c: FrontConversation) => c.created_at >= Math.floor(after.getTime() / 1000))
        : results
      
      // Add results up to the limit
      const toAdd = filteredResults.slice(0, remaining)
      conversations.push(...toAdd)
      remaining -= toAdd.length

      // Check for next page
      if (data._pagination?.next && remaining > 0) {
        const nextUrl = new URL(data._pagination.next)
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
  }

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(conversationId: string): Promise<FrontMessage[]> {
    const data = await this.fetch(`/conversations/${conversationId}/messages`)
    return data._results || []
  }

  /**
   * Get full conversation with messages
   */
  async getFullConversation(conversationId: string) {
    const messages = await this.getConversationMessages(conversationId)
    return messages
  }
}

export const frontClient = new FrontClient(process.env.FRONT_API_TOKEN || '')
