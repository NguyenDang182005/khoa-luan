import { apiClient } from './client'
import { AllAgentsPerfSchema, IntentStatsSchema } from '../schemas/agent.schema'
import type { IntentStats } from '../schemas/agent.schema'

export type { IntentStats }

export interface AgentChatResult {
  answer: string
  latencyMs: number
}

export const agentsApi = {
  getPerformance: async () => {
    const { data } = await apiClient.get('/agents/performance')
    return AllAgentsPerfSchema.parse(data)
  },
  /** Thống kê định tuyến intent của Router Agent (WF01) — admin only */
  getIntentStats: async (): Promise<IntentStats> => {
    const { data } = await apiClient.get('/agents/intent-stats')
    return IntentStatsSchema.parse(data)
  },
  /**
   * Chat qua NestJS (JWT) — backend proxy tới n8n WF01 với x-api-key server-side.
   * Browser KHÔNG giữ bất kỳ key nào của n8n.
   */
  chat: async (message: string): Promise<AgentChatResult> => {
    const startTime = Date.now()
    try {
      const { data } = await apiClient.post('/agents/chat', { message })
      const answer: string =
        data?.answer ?? data?.response ?? data?.output ?? data?.message ?? 'Không có phản hồi từ AI Agent.'
      return { answer, latencyMs: typeof data?.latencyMs === 'number' ? data.latencyMs : Date.now() - startTime }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 502) {
        throw new Error('Agent AI (n8n) không phản hồi. Kiểm tra workflow WF01 đang active.')
      }
      if (status === 400) {
        throw new Error('Tài khoản của bạn chưa liên kết hồ sơ nhân viên, không thể chat với AI.')
      }
      throw err
    }
  },
}
