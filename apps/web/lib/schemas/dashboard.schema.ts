import { z } from 'zod'

export const KpiSchema = z.object({
  totalEmployees: z.number(),
  /** Hồ sơ đã nghỉ việc (TERMINATED) — không nằm trong totalEmployees */
  terminatedEmployees: z.number().optional().default(0),
  /** Tổng hồ sơ = đang làm việc + đã nghỉ việc */
  totalEmployeeRecords: z.number().optional(),
  todayAttendanceRate: z.number(),
  todayDetail: z.object({ onTime: z.number(), late: z.number(), onLeave: z.number() }),
  monthlyPayrollTotal: z.number(),
  aiResolutionRate: z.number().nullable(),
  escalationCount: z.number(),
  activeWorkflows: z.number(),
  totalAiMessages: z.number(),
})

export const AttendanceChartItemSchema = z.object({
  day: z.string(),
  onTime: z.number(),
  late: z.number(),
  leave: z.number(),
})
export const AttendanceChartSchema = z.array(AttendanceChartItemSchema)

export const DeptDistributionItemSchema = z.object({ name: z.string(), value: z.number() })
export const DeptDistributionSchema = z.array(DeptDistributionItemSchema)

export const PendingLeaveSchema = z.object({
  id: z.string(),
  type: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  totalDays: z.number(),
  overtimeHours: z.number().nullable().optional(),
  reason: z.string(),
  status: z.string(),
  employee: z.object({
    id: z.string().optional(),
    fullName: z.string(),
    employeeCode: z.string(),
    department: z.object({ name: z.string() }),
  }),
})
export const PendingLeavesSchema = z.array(PendingLeaveSchema)

export const AiWorkflowStatSchema = z.object({
  wf: z.string(),
  label: z.string(),
  desc: z.string(),
  total: z.number(),
  avgLatencyMs: z.number().nullable(),
  escalated: z.number().nullable(),
  lastActiveAt: z.string().nullable(),
})
export const AiActivitySchema = z.array(AiWorkflowStatSchema)

export type KpiData = z.infer<typeof KpiSchema>
export type AttendanceChartData = z.infer<typeof AttendanceChartSchema>
export type DeptDistributionData = z.infer<typeof DeptDistributionSchema>
export type PendingLeaveData = z.infer<typeof PendingLeaveSchema>
export type AiWorkflowStat = z.infer<typeof AiWorkflowStatSchema>
export type AiActivityData = z.infer<typeof AiActivitySchema>
