import { z } from 'zod'

export const ScenarioEnum = z.enum([
  'CUSTOMER_COMPLAINT', 'COLLEAGUE_CONFLICT', 'MANAGER_FEEDBACK',
  'NEW_EMPLOYEE_ONBOARDING', 'PERFORMANCE_REVIEW', 'GENERAL_COMMUNICATION',
])

export const AiScoreSchema = z
  .object({
    professional: z.number().nullish(),
    empathy: z.number().nullish(),
    problemSolving: z.number().nullish(),
    clarity: z.number().nullish(),
    essay_avg: z.number().nullish(),
  })
  .passthrough()

export const TrainingAttemptItemSchema = z
  .object({
    id: z.string(),
    answer: z.string(),
    isCorrect: z.boolean().nullable().optional(),
    aiEvaluation: z
      .object({
        question: z.string().nullish(),
        type: z.string().nullish(),
        feedback: z.string().nullish(),
        score: z.number().nullish(),
        correct_answer: z.string().nullish(),
        criteria: z.record(z.string(), z.number().nullish()).nullish(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough()

export const TrainingSessionSchema = z.object({
  id: z.string(),
  scenario: z.string(),
  status: z.string(),
  quizScore: z.number().nullable().optional(),
  aiScore: AiScoreSchema.nullable().optional(),
  totalScore: z.number().nullable().optional(),
  aiFeedback: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  // Từng câu đã làm (API my-sessions include attempts) — dùng cho phần "Chi tiết bài làm"
  attempts: z.array(TrainingAttemptItemSchema).optional(),
})
export const TrainingSessionsSchema = z.array(TrainingSessionSchema)

export const TrainingRadarItemSchema = z.object({
  subject: z.string(),
  benchmark: z.number(),
  actual: z.number(),
  fullMark: z.number(),
})

export const AnalyticsSessionSchema = z.object({
  id: z.string(),
  scenario: z.string().optional(),
  status: z.string(),
  quizScore: z.number().nullable().optional(),
  aiScore: AiScoreSchema.nullable().optional(),
  totalScore: z.number().nullable().optional(),
  aiFeedback: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  employee: z
    .object({
      fullName: z.string(),
      employeeCode: z.string(),
      department: z.object({ name: z.string() }).nullable().optional(),
    })
    .nullable()
    .optional(),
  attempts: z.array(TrainingAttemptItemSchema).optional(),
})

export const TrainingAnalyticsSchema = z.object({
  sessions: z.array(AnalyticsSessionSchema),
  radarData: z.array(TrainingRadarItemSchema),
  benchmark: z.object({
    professional: z.number().optional().default(8),
    empathy: z.number().optional().default(8),
    problemSolving: z.number().optional().default(8),
    clarity: z.number().optional().default(8),
  }),
})

export type AnalyticsSession = z.infer<typeof AnalyticsSessionSchema>
export type TrainingSession = z.infer<typeof TrainingSessionSchema>
export type TrainingAttemptItem = z.infer<typeof TrainingAttemptItemSchema>
export type AiScore = z.infer<typeof AiScoreSchema>
export type TrainingAnalytics = z.infer<typeof TrainingAnalyticsSchema>
