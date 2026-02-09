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
  }).optional(),
  recipient: z.object({
    handle: z.string(),
    role: z.string(),
  }),
  tags: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).optional(),
  links: z.object({
    related: z.object({
      events: z.string(),
      followers: z.string(),
      messages: z.string(),
      comments: z.string(),
      inboxes: z.string(),
    }),
  }),
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
  }).optional(),
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
 */
export const FrontListResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    _pagination: z.object({
      next: z.string().optional(),
      prev: z.string().optional(),
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
    next?: string
    prev?: string
  }
  _links: {
    self: string
  }
  _results: T[]
}
