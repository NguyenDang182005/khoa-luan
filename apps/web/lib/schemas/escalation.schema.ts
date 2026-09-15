import { z } from 'zod'

/** n8n WF04 lưu metadata thật: model, escalated, escalateReason (+ summary khi escalate) */
export const EscalationCaseMetadataSchema = z.object({
  model: z.string().optional(),
  escalated: z.boolean().optional(),
  escalateReason: z.string().optional(),
  summary: z.string().optional(),
  customerName: z.string().optional(),
  phone: z.string().optional(),
})

export const EscalationCaseSchema = z.object({
  id: z.string(),
  externalId: z.string().nullable(),
  lastMessage: z.string().nullable(),
  lastMessageAt: z.string().nullable(),
  messageCount: z.number(),
  metadata: EscalationCaseMetadataSchema.nullable(),
})

export const EscalationQueueSchema = z.array(EscalationCaseSchema)

/** GET /agents/conversations — mọi phiên CSKH (đang bot + đã escalate) */
export const ConversationItemSchema = EscalationCaseSchema.extend({
  escalated: z.boolean(),
})

export const ConversationListSchema = z.array(ConversationItemSchema)

export const ChatHistoryMessageSchema = z.object({
  id: z.string(),
  role: z.string(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
})

export const ChatHistorySchema = z.object({
  messages: z.array(ChatHistoryMessageSchema),
})

export const PiiAuditItemSchema = z.object({
  id: z.string(),
  role: z.string(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  session: z
    .object({
      id: z.string(),
      type: z.string().nullable(),
      channel: z.string().nullable(),
      externalId: z.string().nullable(),
    })
    .nullable(),
})

export const PiiAuditSchema = z.object({
  items: z.array(PiiAuditItemSchema),
})

export type EscalationCase = z.infer<typeof EscalationCaseSchema>
export type ConversationItem = z.infer<typeof ConversationItemSchema>
export type ChatHistoryMessage = z.infer<typeof ChatHistoryMessageSchema>
export type PiiAuditItem = z.infer<typeof PiiAuditItemSchema>

export interface ReplyDelivery {
  delivered: boolean
  reason?: string
  ts?: string
}
