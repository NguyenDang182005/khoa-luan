import { apiClient } from './client'
import {
  ChatHistoryMessageSchema,
  ChatHistorySchema,
  EscalationQueueSchema,
  ConversationListSchema,
  PiiAuditSchema,
  ChatHistoryMessage,
  EscalationCase,
  ConversationItem,
  PiiAuditItem,
} from '../schemas/escalation.schema'
import type { ReplyDelivery } from '../schemas/escalation.schema'

export type { EscalationCase, ConversationItem, ChatHistoryMessage, PiiAuditItem, ReplyDelivery }

// Tất cả endpoint dưới đây đều qua NestJS bằng JWT của user đăng nhập.
// Browser không còn giữ x-api-key của n8n.
export const escalationApi = {
  getQueue: async (): Promise<EscalationCase[]> => {
    const { data } = await apiClient.get('/agents/escalation-queue')
    return EscalationQueueSchema.parse(data)
  },
  /** Tất cả hội thoại CSKH (đang bot + đã escalate) */
  getAllConversations: async (): Promise<ConversationItem[]> => {
    const { data } = await apiClient.get('/agents/conversations')
    return ConversationListSchema.parse(data)
  },
  getChatHistory: async (sessionId: string): Promise<{ messages: ChatHistoryMessage[] }> => {
    const { data } = await apiClient.get(`/agents/chat-history/${sessionId}`)
    return ChatHistorySchema.parse(data)
  },
  reactivateBot: async (sessionId: string) => {
    const { data } = await apiClient.post(`/agents/chat-session/${sessionId}/reactivate`)
    return data
  },
  deactivateBot: async (sessionId: string) => {
    const { data } = await apiClient.post(`/agents/chat-session/${sessionId}/deactivate`)
    return data
  },
  /** Chuyên viên gửi phản hồi tiếp quản — lưu lịch sử + forward ra Slack DM khách */
  sendHumanReply: async (
    sessionId: string,
    content: string,
  ): Promise<{ message: ChatHistoryMessage; delivery: ReplyDelivery | null }> => {
    const { data } = await apiClient.post(`/agents/chat-session/${sessionId}/reply`, { content })
    const message = ChatHistoryMessageSchema.parse(data)
    const raw = data as { delivery?: ReplyDelivery }
    return { message, delivery: raw.delivery ?? null }
  },
  /** Nhật ký PII thật: các tin nhắn đã lưu (kèm bản masking trong metadata) theo phiên */
  getPiiAudit: async (limit = 20): Promise<PiiAuditItem[]> => {
    const { data } = await apiClient.get('/agents/pii-audit', { params: { limit } })
    return PiiAuditSchema.parse(data).items
  },
}
