/**
 * Front API Client
 * Refactored to use base SDK architecture with proper validation
 */

import { BaseSdkClient } from '../base-client'
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
   * Get conversations from an inbox
   */
  async getInboxConversations(
    inboxId: string,
    options: {
      limit?: number
      after?: number | Date
    } = {}
  ): Promise<FrontConversation[]> {
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

    const queryString = params.toString()
    const endpoint = `/inboxes/${inboxId}/conversations${queryString ? `?${queryString}` : ''}`

    const response = await this.get<FrontListResponse<FrontConversation>>(
      endpoint,
      FrontListResponseSchema(FrontConversationSchema)
    )

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
