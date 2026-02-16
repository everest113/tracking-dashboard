/**
 * Front API Client
 * Refactored to use base SDK architecture with proper validation
 */

import { BaseSdkClient } from '../base-client'
import { z } from 'zod'
import {
  FrontConversationSchema,
  FrontMessageSchema,
  FrontListResponseSchema,
  FrontSendReplyResponseSchema,
  type FrontConversation,
  type FrontMessage,
  type FrontListResponse,
  type FrontSendReplyRequest,
  type FrontSendReplyResponse,
} from './schemas'

export class FrontClient extends BaseSdkClient {
  constructor(apiKey: string) {
    super({
      baseUrl: 'https://api2.frontapp.com',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    })
  }

  /**
   * List all inboxes
   */
  async listInboxes(): Promise<Array<{ id: string; name: string }>> {
    const InboxSchema = z.object({
      id: z.string(),
      name: z.string(),
    })
    
    const response = await this.get<FrontListResponse<z.infer<typeof InboxSchema>>>(
      '/inboxes',
      FrontListResponseSchema(InboxSchema)
    )
    return response._results
  }

  /**
   * Find inbox by name
   */
  async findInboxByName(name: string): Promise<string | null> {
    const inboxes = await this.listInboxes()
    const inbox = inboxes.find(i => i.name.toLowerCase() === name.toLowerCase())
    return inbox?.id || null
  }

  /**
   * Search ALL conversations in an inbox with date filtering (paginated)
   * Uses the search endpoint with proper date filtering support
   */
  async searchAllInboxConversations(
    inboxId: string,
    options: {
      after?: Date
      pageSize?: number
      maxPages?: number
    } = {}
  ): Promise<FrontConversation[]> {
    const pageSize = options.pageSize || 100
    const maxPages = options.maxPages || 1000
    
    // Build search query using Front's search syntax
    // Format: inbox:ID after:TIMESTAMP
    const parts: string[] = [`inbox:${inboxId}`]
    
    if (options.after) {
      const timestamp = Math.floor(options.after.getTime() / 1000)
      parts.push(`after:${timestamp}`)
    }
    
    const query = parts.join(' ')
    console.log(`Search query: "${query}"`)
    
    let allConversations: FrontConversation[] = []
    let currentPage = 0
    let nextPageToken: string | null | undefined = undefined

    do {
      console.log(`Searching page ${currentPage + 1} (${allConversations.length} conversations so far)...`)
      
      const endpoint: string = nextPageToken
        ? new URL(nextPageToken).pathname + new URL(nextPageToken).search
        : `/conversations/search/${encodeURIComponent(query)}?limit=${pageSize}`
      
      const response: FrontListResponse<FrontConversation> = await this.get<FrontListResponse<FrontConversation>>(
        endpoint,
        FrontListResponseSchema(FrontConversationSchema)
      )

      allConversations = allConversations.concat(response._results)
      nextPageToken = response._pagination.next

      currentPage++

      if (currentPage >= maxPages) {
        console.warn(`Reached maximum page limit (${maxPages}). Stopping pagination.`)
        break
      }

      if (nextPageToken) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

    } while (nextPageToken)

    console.log(`Found ${allConversations.length} total conversations across ${currentPage} pages`)
    return allConversations
  }

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(conversationId: string): Promise<FrontMessage[]> {
    const response = await this.get<FrontListResponse<FrontMessage>>(
      `/conversations/${conversationId}/messages`,
      FrontListResponseSchema(FrontMessageSchema)
    )

    return response._results
  }

  /**
   * Search conversations by email address.
   * Uses Front's search API with contact email filter.
   */
  async searchConversationsByEmail(
    email: string,
    options: {
      inboxId?: string
      limit?: number
    } = {}
  ): Promise<FrontConversation[]> {
    const limit = options.limit || 25
    
    // Build search query using Front's search syntax
    // Format: contact:email@example.com [inbox:ID]
    const parts: string[] = [`contact:${email}`]
    
    if (options.inboxId) {
      parts.push(`inbox:${options.inboxId}`)
    }
    
    const query = parts.join(' ')
    
    const endpoint = `/conversations/search/${encodeURIComponent(query)}?limit=${limit}`
    
    const response = await this.get<FrontListResponse<FrontConversation>>(
      endpoint,
      FrontListResponseSchema(FrontConversationSchema)
    )

    return response._results
  }

  /**
   * Search conversations by text query (order number, subject text, etc.)
   * Uses Front's general search which searches across subject and body.
   */
  async searchConversationsByQuery(
    query: string,
    options: {
      inboxId?: string
      limit?: number
    } = {}
  ): Promise<FrontConversation[]> {
    const limit = options.limit || 25
    
    // Build search query - optionally filter by inbox
    const parts: string[] = [query]
    
    if (options.inboxId) {
      parts.push(`inbox:${options.inboxId}`)
    }
    
    const searchQuery = parts.join(' ')
    
    const endpoint = `/conversations/search/${encodeURIComponent(searchQuery)}?limit=${limit}`
    
    const response = await this.get<FrontListResponse<FrontConversation>>(
      endpoint,
      FrontListResponseSchema(FrontConversationSchema)
    )

    return response._results
  }

  /**
   * Send a reply to a conversation.
   * This appends a new outbound message to an existing conversation thread.
   * 
   * @param conversationId - The conversation ID (cnv_xxx format)
   * @param body - HTML content of the message
   * @param options - Optional settings (author_id, archive after send, etc.)
   * @returns The created message
   */
  async sendReply(
    conversationId: string,
    body: string,
    options: Omit<FrontSendReplyRequest, 'body'> = {}
  ): Promise<FrontSendReplyResponse> {
    const payload: FrontSendReplyRequest = {
      body,
      ...options,
    }

    const response = await this.post<FrontSendReplyResponse>(
      `/conversations/${conversationId}/messages`,
      payload,
      FrontSendReplyResponseSchema
    )

    return response
  }

  /**
   * Get a single conversation by ID.
   */
  async getConversation(conversationId: string): Promise<FrontConversation> {
    return this.get<FrontConversation>(
      `/conversations/${conversationId}`,
      FrontConversationSchema
    )
  }
}

/**
 * Factory function to create Front client
 */
export function getFrontClient(): FrontClient {
  const apiKey = process.env.FRONT_API_TOKEN
  
  if (!apiKey) {
    throw new Error('FRONT_API_TOKEN environment variable is not set')
  }

  return new FrontClient(apiKey)
}

/**
 * Search conversations by email (convenience function).
 */
export async function searchConversationsByEmail(
  email: string,
  options?: { inboxId?: string; limit?: number }
): Promise<FrontConversation[]> {
  const client = getFrontClient()
  return client.searchConversationsByEmail(email, options)
}

/**
 * Search conversations by text query (order number, subject, etc.)
 * Uses Front's general search which searches subject and body.
 */
export async function searchConversationsByQuery(
  query: string,
  options?: { inboxId?: string; limit?: number }
): Promise<FrontConversation[]> {
  const client = getFrontClient()
  return client.searchConversationsByQuery(query, options)
}

/**
 * Send a reply to a conversation (convenience function).
 * 
 * @param conversationId - The conversation ID (cnv_xxx format)
 * @param body - HTML content of the message
 * @param options - Optional settings (author_id, etc.)
 * @returns The created message
 */
export async function sendReply(
  conversationId: string,
  body: string,
  options?: Omit<FrontSendReplyRequest, 'body'>
): Promise<FrontSendReplyResponse> {
  const client = getFrontClient()
  return client.sendReply(conversationId, body, options)
}

/**
 * Get a conversation by ID (convenience function).
 */
export async function getConversation(
  conversationId: string
): Promise<FrontConversation> {
  const client = getFrontClient()
  return client.getConversation(conversationId)
}

/**
 * Get messages for a conversation (convenience function).
 */
export async function getConversationMessages(
  conversationId: string
): Promise<FrontMessage[]> {
  const client = getFrontClient()
  return client.getConversationMessages(conversationId)
}

/**
 * Search conversations by query string (alias for searchConversationsByQuery).
 */
export async function searchConversations(
  query: string,
  options?: { inboxId?: string; limit?: number }
): Promise<FrontConversation[]> {
  return searchConversationsByQuery(query, options)
}
