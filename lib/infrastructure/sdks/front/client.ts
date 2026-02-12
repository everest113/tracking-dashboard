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
    
    // First, let's test if we can get ANY conversations from this inbox
    let testQuery = `inbox:${inboxId}`
    console.log(`🔍 Testing inbox access with query: "${testQuery}"`)
    
    try {
      const testEndpoint = `/conversations/search/${encodeURIComponent(testQuery)}?limit=5`
      console.log(`   Test endpoint: ${testEndpoint}`)
      const testResponse: FrontListResponse<FrontConversation> = await this.get<FrontListResponse<FrontConversation>>(
        testEndpoint,
        FrontListResponseSchema(FrontConversationSchema)
      )
      console.log(`   ✅ Test query returned ${testResponse._results.length} conversations`)
      if (testResponse._results.length > 0) {
        const latest = testResponse._results[0]
        console.log(`   Latest conversation: ${latest.id} - "${latest.subject}" (created: ${latest.created_at})`)
      }
    } catch (error) {
      console.error(`   ❌ Test query failed:`, error)
    }
    
    const parts: string[] = [`inbox:${inboxId}`]
    
    let timestampStr = ''
    if (options.after) {
      const timestamp = Math.floor(options.after.getTime() / 1000)
      timestampStr = `after:${timestamp}`
      parts.push(timestampStr)
    }
    
    const query = parts.join(' ')
    console.log(`\n🔍 Actual search query: "${query}"`)
    console.log(`  - Inbox: ${inboxId}`)
    console.log(`  - After date: ${options.after?.toISOString() || 'none'}`)
    console.log(`  - Timestamp: ${timestampStr || 'none'}`)
    
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

      console.log(`API returned ${response._results.length} conversations on this page`)
      if (response._results.length > 0) {
        console.log(`Sample conversation:`, {
          id: response._results[0].id,
          subject: response._results[0].subject,
          created_at: response._results[0].created_at,
        })
      }

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
