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
  type FrontConversation,
  type FrontMessage,
  type FrontListResponse,
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
   * Get a single page of conversations from an inbox
   */
  async getInboxConversationsPage(
    inboxId: string,
    options: {
      limit?: number
      after?: number | Date
      pageToken?: string
    } = {}
  ): Promise<FrontListResponse<FrontConversation>> {
    const params = new URLSearchParams()
    
    if (options.limit) {
      params.append('limit', options.limit.toString())
    }
    
    if (options.after) {
      const timestamp = typeof options.after === 'number' 
        ? options.after 
        : Math.floor(options.after.getTime() / 1000)
      params.append('q[after]', timestamp.toString())
    }

    // If pageToken is provided, use it directly as the endpoint
    if (options.pageToken) {
      // pageToken is a full URL from _pagination.next
      const url = new URL(options.pageToken)
      return await this.get<FrontListResponse<FrontConversation>>(
        url.pathname + url.search,
        FrontListResponseSchema(FrontConversationSchema)
      )
    }

    const queryString = params.toString()
    const endpoint = `/inboxes/${inboxId}/conversations${queryString ? `?${queryString}` : ''}`

    return await this.get<FrontListResponse<FrontConversation>>(
      endpoint,
      FrontListResponseSchema(FrontConversationSchema)
    )
  }

  /**
   * Get ALL conversations from an inbox (handles pagination automatically)
   */
  async getAllInboxConversations(
    inboxId: string,
    options: {
      pageSize?: number
      after?: number | Date
      maxPages?: number  // Safety limit to prevent infinite loops
    } = {}
  ): Promise<FrontConversation[]> {
    const pageSize = options.pageSize || 100
    const maxPages = options.maxPages || 1000  // Safety limit
    
    let allConversations: FrontConversation[] = []
    let currentPage = 0
    let nextPageToken: string | null | undefined = undefined

    do {
      console.log(`Fetching page ${currentPage + 1} (${allConversations.length} conversations so far)...`)
      
      const response = await this.getInboxConversationsPage(inboxId, {
        limit: pageSize,
        after: options.after,
        pageToken: nextPageToken || undefined,
      })

      allConversations = allConversations.concat(response._results)
      nextPageToken = response._pagination.next

      currentPage++

      // Safety check
      if (currentPage >= maxPages) {
        console.warn(`Reached maximum page limit (${maxPages}). Stopping pagination.`)
        break
      }

      // Small delay to avoid rate limiting
      if (nextPageToken) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

    } while (nextPageToken)

    console.log(`Fetched ${allConversations.length} total conversations across ${currentPage} pages`)
    return allConversations
  }

  /**
   * Get conversations from an inbox (single page - deprecated, use getAllInboxConversations)
   * @deprecated Use getAllInboxConversations for automatic pagination
   */
  async getInboxConversations(
    inboxId: string,
    options: {
      limit?: number
      after?: number | Date
    } = {}
  ): Promise<FrontConversation[]> {
    const response = await this.getInboxConversationsPage(inboxId, options)
    return response._results
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
