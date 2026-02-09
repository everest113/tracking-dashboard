/**
 * Front API Zod schemas for runtime validation
 */

import { z } from 'zod'

/**
 * Front Conversation schema
 */
export const FrontConversationSchema = z.object({
  id: z.string(),
  subject: z.string(),
  status: z.string(),
  assignee: z.object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
  }).nullable(),  // Conversations can have no assignee
  recipient: z.object({
    handle: z.string(),
    role: z.string(),
  }),
  tags: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).optional(),
  links: z.array(z.unknown()).optional(),  // Array of links (usually empty)
  _links: z.object({
    related: z.object({
      messages: z.string(),
    }),
  }),
  created_at: z.number(),
  is_private: z.boolean(),
})

/**
 * Front Message schema  
 */
export const FrontMessageSchema = z.object({
  id: z.string(),
  type: z.string(),
  body: z.string(),
  text: z.string(),
  subject: z.string().optional(),
  created_at: z.number(),
  author: z.object({
    email: z.string().optional(),
    name: z.string().optional(),
    username: z.string().optional(),
  }).nullable(),  // System/automated messages can have null author
  recipients: z.array(z.object({
    handle: z.string(),
    name: z.string().optional(),
    role: z.string().optional(),
  })),
  is_inbound: z.boolean().optional(),
  is_draft: z.boolean().optional(),
  blurb: z.string().optional(),
  attachments: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    url: z.string(),
    content_type: z.string(),
    size: z.number(),
  })).optional(),
  metadata: z.object({
    headers: z.record(z.string(), z.string()).optional(),
  }).optional(),
})

/**
 * Front List Response schema
 * Note: Front API returns null for pagination.next/prev when no more pages exist
 */
export const FrontListResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    _pagination: z.object({
      next: z.string().nullish(),  // Allow string, null, or undefined
      prev: z.string().nullish(),  // Allow string, null, or undefined
    }),
    _links: z.object({
      self: z.string(),
    }),
    _results: z.array(itemSchema),
  })

/**
 * Type inference
 */
export type FrontConversation = z.infer<typeof FrontConversationSchema>
export type FrontMessage = z.infer<typeof FrontMessageSchema>
export type FrontListResponse<T> = {
  _pagination: {
    next?: string | null
    prev?: string | null
  }
  _links: {
    self: string
  }
  _results: T[]
}
