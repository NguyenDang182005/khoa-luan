import { apiClient } from './client'
import { AllAgentsPerfSchema, IntentStatsSchema } from '../schemas/agent.schema'
import type { IntentStats } from '../schemas/agent.schema'

export type { IntentStats }

/** 1 câu hỏi trong quiz WF03 sinh (5 MCQ + 2 essay) */
export interface QuizQuestion {
  id: number
  type: "mcq" | "essay"
  question: string
  options?: Record<string, string>
  correct?: string
  explanation?: string
}

export interface QuizSubmitResult {
  sessionId?: string
  scenario?: string
  score_percent?: number
  correct_count?: number
  total_mcq?: number
  essay_avg?: number
  overall_feedback?: string
  results?: Array<{
    id?: number
    type?: string
    correct?: boolean
    score?: number
    feedback?: string
  }>
}

export interface AgentChatResult {
  answer: string
  latencyMs: number
  /** WF03 generate_quiz — có mặt khi AI trả form bài test */
  questions?: QuizQuestion[]
  scenarioType?: string
  /** Q16-session: phiên chat (backend sở hữu) — client lưu và gửi lại lượt sau */
  sessionId?: string
  sessionType?: string
}

export interface ChatHistoryMessage {
  id: string
  role: string
  content: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface AgentChatSession {
  id: string
  type: string
  channel: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  messages: ChatHistoryMessage[]
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
  chat: async (
    message: string,
    opts?: { sessionId?: string; sessionType?: string },
  ): Promise<AgentChatResult> => {
    const startTime = Date.now()
    try {
      // Chat AI có thể mất 30-60s (Gemini + RAG): vượt quá timeout mặc định 15s của apiClient.
      const { data } = await apiClient.post(
        '/agents/chat',
        { message, sessionId: opts?.sessionId, sessionType: opts?.sessionType },
        { timeout: 100_000 },
      )
      const answer: string =
        data?.answer ?? data?.response ?? data?.output ?? data?.message ?? 'Không có phản hồi từ AI Agent.'
      const questions: QuizQuestion[] | undefined = Array.isArray(data?.questions)
        ? (data.questions as QuizQuestion[])
        : undefined
      return {
        answer,
        latencyMs: typeof data?.latencyMs === 'number' ? data.latencyMs : Date.now() - startTime,
        questions,
        scenarioType: typeof data?.scenarioType === 'string' ? data.scenarioType : undefined,
        sessionId: typeof data?.sessionId === 'string' ? data.sessionId : undefined,
        sessionType: typeof data?.sessionType === 'string' ? data.sessionType : undefined,
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; code?: string }
      if (e.code === 'ECONNABORTED') {
        throw new Error('AI Agent phản hồi quá lâu (>100s). Vui lòng thử lại sau ít phút.')
      }
      const status = e.response?.status
      if (status === 502) {
        throw new Error('Agent AI (n8n) không phản hồi. Kiểm tra workflow WF01 đang active.')
      }
      if (status === 400) {
        throw new Error('Tài khoản của bạn chưa liên kết hồ sơ nhân viên, không thể chat với AI.')
      }
      throw err
    }
  },
  /**
   * Nộp bài quiz (5 MCQ + 2 essay) — WF03 chấm điểm, lưu TrainingSession/Attempt.
   * Body: { scenarioType, answers: [{ questionId, question, type, answer, correctAnswer? }] }
   */
  submitQuiz: async (
    scenarioType: string,
    answers: Array<{
      questionId: number
      question: string
      type: 'mcq' | 'essay'
      answer: string
      correctAnswer?: string
    }>,
  ): Promise<QuizSubmitResult> => {
    const { data } = await apiClient.post('/training/submit', { scenarioType, answers }, { timeout: 100_000 })
    return data as QuizSubmitResult
  },
  /** Q16 — phiên chat web gần nhất của nhân viên theo loại (kèm messages) */
  getLatestSession: async (type: 'HR_QA' | 'TRAINING' | 'OTHER'): Promise<AgentChatSession | null> => {
    const { data } = await apiClient.get(`/agents/chat-session/latest/${type}`)
    return (data ?? null) as AgentChatSession | null
  },
  /** Q19(i1) — "Phiên mới": đóng phiên hiện tại, mở phiên mới cùng loại */
  renewSession: async (type: 'HR_QA' | 'TRAINING' | 'OTHER'): Promise<AgentChatSession> => {
    const { data } = await apiClient.post('/agents/chat-session/renew', { type })
    return data as AgentChatSession
  },
}
