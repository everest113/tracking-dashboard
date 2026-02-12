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
