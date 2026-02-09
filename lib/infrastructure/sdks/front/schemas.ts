import { z } from 'zod'

/**
 * Front API Response Schemas
 * Docs: https://dev.frontapp.com/reference/introduction
 */

/**
 * Front Author Schema
 */
export const FrontAuthorSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
})

export type FrontAuthor = z.infer<typeof FrontAuthorSchema>

/**
 * Front Recipient Schema
 */
export const FrontRecipientSchema = z.object({
  handle: z.string(),
  name: z.string().optional(),
})

export type FrontRecipient = z.infer<typeof FrontRecipientSchema>

/**
 * Front Message Schema
 */
export const FrontMessageSchema = z.object({
  id: z.string(),
  type: z.string(),
  body: z.string(),
  text: z.string(),
  subject: z.string(),
  created_at: z.number(),
  author: FrontAuthorSchema,
  recipients: z.array(FrontRecipientSchema),
})

export type FrontMessage = z.infer<typeof FrontMessageSchema>

/**
 * Front Conversation Links Schema
 */
export const FrontConversationLinksSchema = z.object({
  related: z.object({
    messages: z.string(),
  }),
})

/**
 * Front Conversation Schema
 */
export const FrontConversationSchema = z.object({
  id: z.string(),
  subject: z.string(),
  status: z.string(),
  created_at: z.number(),
  _links: FrontConversationLinksSchema,
})

export type FrontConversation = z.infer<typeof FrontConversationSchema>

/**
 * Front Inbox Schema
 */
export const FrontInboxSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type FrontInbox = z.infer<typeof FrontInboxSchema>

/**
 * Front Pagination Schema
 */
export const FrontPaginationSchema = z.object({
  next: z.string().optional(),
  prev: z.string().optional(),
})

/**
 * Front API List Response Schema (generic)
 */
export const FrontListResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    _results: z.array(itemSchema),
    _pagination: FrontPaginationSchema.optional(),
  })

/**
 * Specific Response Schemas
 */
export const FrontInboxListResponseSchema = FrontListResponseSchema(FrontInboxSchema)
export const FrontConversationListResponseSchema = FrontListResponseSchema(FrontConversationSchema)
export const FrontMessageListResponseSchema = FrontListResponseSchema(FrontMessageSchema)

export type FrontInboxListResponse = z.infer<typeof FrontInboxListResponseSchema>
export type FrontConversationListResponse = z.infer<typeof FrontConversationListResponseSchema>
export type FrontMessageListResponse = z.infer<typeof FrontMessageListResponseSchema>
