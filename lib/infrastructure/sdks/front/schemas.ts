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
  }).nullable(),  // Recipient can be null in some cases
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
    name: z.string().nullish(),  // Recipient name can be null
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
 * Front Send Reply Request schema
 */
export const FrontSendReplyRequestSchema = z.object({
  body: z.string(), // HTML content of the message
  author_id: z.string().optional(), // Teammate ID to send from (uses default if not specified)
  subject: z.string().optional(), // Override subject (rarely needed for replies)
  options: z.object({
    archive: z.boolean().optional(), // Archive conversation after sending
    tag_ids: z.array(z.string()).optional(), // Tags to add
  }).optional(),
})

/**
 * Front Create Draft Request schema
 */
export const FrontCreateDraftRequestSchema = z.object({
  body: z.string(), // HTML content of the draft
  author_id: z.string(), // Teammate ID to create draft as (required)
  channel_id: z.string(), // Channel to send from (required - use cha_xxx format)
  subject: z.string().optional(), // Override subject
  mode: z.enum(['shared', 'private']).optional(), // Draft visibility (default: shared)
  signature_id: z.string().optional(), // Custom signature
  should_add_default_signature: z.boolean().optional(), // Add default signature
})

/**
 * Front Create Draft Response schema
 * The API returns the created draft message
 */
export const FrontCreateDraftResponseSchema = z.object({
  id: z.string(), // Message ID (msg_xxx)
  type: z.string(),
  is_draft: z.boolean(),
  created_at: z.number(),
  body: z.string(),
  text: z.string().optional(),
  author: z.object({
    id: z.string().optional(),
    email: z.string().optional(),
    username: z.string().optional(),
  }).nullable(),
  _links: z.object({
    self: z.string(),
    related: z.object({
      conversation: z.string(),
    }),
  }),
})

/**
 * Front Send Reply Response schema
 * The API returns the created message
 */
export const FrontSendReplyResponseSchema = z.object({
  id: z.string(), // Message ID (msg_xxx)
  type: z.string(),
  is_inbound: z.boolean(),
  created_at: z.number(),
  blurb: z.string(),
  body: z.string(),
  text: z.string(),
  author: z.object({
    id: z.string().optional(),
    email: z.string().optional(),
    username: z.string().optional(),
  }).nullable(),
  recipients: z.array(z.object({
    handle: z.string(),
    name: z.string().nullish(),
    role: z.string().optional(),
  })),
  _links: z.object({
    self: z.string(),
    related: z.object({
      conversation: z.string(),
    }),
  }),
})

/**
 * Type inference
 */
export type FrontConversation = z.infer<typeof FrontConversationSchema>
export type FrontMessage = z.infer<typeof FrontMessageSchema>
export type FrontSendReplyRequest = z.infer<typeof FrontSendReplyRequestSchema>
export type FrontSendReplyResponse = z.infer<typeof FrontSendReplyResponseSchema>
export type FrontCreateDraftRequest = z.infer<typeof FrontCreateDraftRequestSchema>
export type FrontCreateDraftResponse = z.infer<typeof FrontCreateDraftResponseSchema>
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
