import { z } from 'zod'

export const ScenarioEnum = z.enum([
  'CUSTOMER_COMPLAINT', 'COLLEAGUE_CONFLICT', 'MANAGER_FEEDBACK',
  'NEW_EMPLOYEE_ONBOARDING', 'PERFORMANCE_REVIEW', 'GENERAL_COMMUNICATION',
])

export const AiScoreSchema = z.object({
  professional: z.number().min(0).max(10),
  empathy: z.number().min(0).max(10),
  problemSolving: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
})

export const TrainingSessionSchema = z.object({
  id: z.string(),
  scenario: ScenarioEnum,
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'GRADED']),
  quizScore: z.number(),
  aiScore: AiScoreSchema.nullable(),
  totalScore: z.number(),
  aiFeedback: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
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
  scenario: ScenarioEnum.optional(),
  status: z.string(),
  quizScore: z.number().nullable().optional(),
  aiScore: AiScoreSchema.nullable().optional(),
  totalScore: z.number().nullable().optional(),
  aiFeedback: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  employee: z.object({
    fullName: z.string(),
    employeeCode: z.string(),
    department: z.object({ name: z.string() }),
  }).optional(),
})

export const TrainingAnalyticsSchema = z.object({
  sessions: z.array(AnalyticsSessionSchema),
  radarData: z.array(TrainingRadarItemSchema),
  benchmark: z.object({ professional: z.number(), empathy: z.number(), problemSolving: z.number(), clarity: z.number() }),
})

export type AnalyticsSession = z.infer<typeof AnalyticsSessionSchema>
export type TrainingSession = z.infer<typeof TrainingSessionSchema>
export type AiScore = z.infer<typeof AiScoreSchema>
export type TrainingAnalytics = z.infer<typeof TrainingAnalyticsSchema>
