import { apiClient } from './client'
import { TrainingSessionsSchema, TrainingAnalyticsSchema } from '../schemas/training.schema'

export const trainingApi = {
  getQuestions: async (scenario?: string) => {
    const { data } = await apiClient.get('/training/questions', { params: scenario ? { scenario } : {} })
    return data
  },
  getMySessions: async (employeeId: string) => {
    const { data } = await apiClient.get('/training/my-sessions', { params: { employeeId } })
    return TrainingSessionsSchema.parse(data)
  },
  startSession: async (employeeId: string, scenario: string) => {
    const { data } = await apiClient.post('/training/sessions', { employeeId, scenario })
    return data
  },
  submitAttempt: async (sessionId: string, questionId: string, answer: string) => {
    const { data } = await apiClient.post(`/training/sessions/${sessionId}/attempts`, { questionId, answer })
    return data
  },
  getAnalytics: async (month?: number, year?: number) => {
    const { data } = await apiClient.get('/training/analytics', { params: { month, year } })
    return TrainingAnalyticsSchema.parse(data)
  },
}
