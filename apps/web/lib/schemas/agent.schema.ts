import { z } from 'zod'

export const AgentPerfSchema = z.object({
  avgLatency: z.number().nullable(),
  lastLatency: z.number().nullable(),
  callCount: z.number(),
  successRate: z.number().nullable(),
  lastActivity: z.string().nullable(),
})

export const AllAgentsPerfSchema = z.object({
  wf01: AgentPerfSchema,
  wf02: AgentPerfSchema,
  wf03: AgentPerfSchema,
  wf04: AgentPerfSchema,
})

export const IntentStatsSchema = z.object({
  total: z.number(),
  byIntent: z.object({
    HR_QA: z.number(),
    CSKH: z.number(),
    TRAINING: z.number(),
    OTHER: z.number(),
  }),
  escalations: z.number(),
})

export type AgentPerf = z.infer<typeof AgentPerfSchema>
export type AllAgentsPerf = z.infer<typeof AllAgentsPerfSchema>
export type IntentStats = z.infer<typeof IntentStatsSchema>
