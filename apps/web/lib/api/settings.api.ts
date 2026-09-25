import { z } from 'zod'
import { apiClient } from './client'
import {
  GeofenceSchema,
  IntegrationsSchema,
  LeavePolicySchema,
  SecurityPolicySchema,
  SessionInfoSchema,
  LoginHistoryEntrySchema,
  AiAgentConfigSchema,
  AuditLogEntrySchema,
} from '../schemas/settings.schema'
import { SalaryConfigSchema } from '../schemas/payroll.schema'
import type {
  Geofence,
  Integrations,
  LeavePolicy,
  SecurityPolicy,
  SessionInfo,
  LoginHistoryEntry,
  AiAgentConfig,
  AuditLogEntry,
} from '../schemas/settings.schema'
import type { SalaryConfig } from '../schemas/payroll.schema'

export type {
  Geofence,
  Integrations,
  LeavePolicy,
  SecurityPolicy,
  SessionInfo,
  LoginHistoryEntry,
  AiAgentConfig,
  AuditLogEntry,
}

export interface UpdateLeavePolicyInput {
  annualQuotaDays?: number
  seniorityBonusEveryYears?: number
  seniorityBonusDays?: number
  prorateByJoinMonth?: boolean
  maxCarryOverDays?: number
  note?: string
}

export interface UpdateSecurityPolicyInput {
  passwordMinLength?: number
  requireUppercase?: boolean
  requireLowercase?: boolean
  requireDigit?: boolean
  requireSpecial?: boolean
  passwordMaxAgeDays?: number
  maxFailedAttempts?: number
  lockoutMinutes?: number
  accessTokenTtlHours?: number
}

export interface UpdateAiAgentConfigInput {
  enabled?: boolean
  webhookUrl?: string | null
  /** Gửi key mới khi muốn thay đổi; undefined = giữ nguyên; null = xóa (fallback env) */
  apiKey?: string | null
  timeoutMs?: number
}

export interface UpdateGeofenceInput {
  name?: string
  lat?: number
  lng?: number
  radiusM?: number
}

export interface UpdateSalaryConfigInput {
  year: number
  bhxhRate?: number
  bhytRate?: number
  bhtnRate?: number
  pitFreeAmount?: number
  overtimeRate?: number
  otWeekendRate?: number
  otHolidayRate?: number
  standardWorkHours?: number
}

/** Trang Cài Đặt — chỉ HR_ADMIN/ADMIN (backend chặn bằng RolesGuard) */
export const settingsApi = {
  getGeofence: async (): Promise<Geofence> => {
    const { data } = await apiClient.get('/settings/geofence')
    return GeofenceSchema.parse(data)
  },
  updateGeofence: async (input: UpdateGeofenceInput): Promise<Geofence> => {
    const { data } = await apiClient.patch('/settings/geofence', input)
    return GeofenceSchema.parse(data)
  },
  /** Ping DB / n8n / Slack / Gemini */
  getIntegrations: async (): Promise<Integrations> => {
    const { data } = await apiClient.get('/settings/integrations')
    return IntegrationsSchema.parse(data)
  },
  /** Chính sách phép năm (Admin) — backend tự tạo bản ghi default nếu chưa có */
  getLeavePolicy: async (): Promise<LeavePolicy> => {
    const { data } = await apiClient.get('/settings/leave-policy')
    return LeavePolicySchema.parse(data)
  },
  /** Cập nhật chính sách phép năm (Admin) — backend ghi audit log tự động */
  updateLeavePolicy: async (input: UpdateLeavePolicyInput): Promise<LeavePolicy> => {
    const { data } = await apiClient.patch('/settings/leave-policy', input)
    return LeavePolicySchema.parse(data)
  },
  /** Tạo/cập nhật cấu hình lương theo năm (Admin) */
  updateSalaryConfig: async (input: UpdateSalaryConfigInput): Promise<SalaryConfig> => {
    const { data } = await apiClient.post('/salary-config', input)
    return SalaryConfigSchema.parse(data)
  },

  // ── Bảo mật ──
  getSecurityPolicy: async (): Promise<SecurityPolicy> => {
    const { data } = await apiClient.get('/settings/security-policy')
    return SecurityPolicySchema.parse(data)
  },
  updateSecurityPolicy: async (input: UpdateSecurityPolicyInput): Promise<SecurityPolicy> => {
    const { data } = await apiClient.patch('/settings/security-policy', input)
    return SecurityPolicySchema.parse(data)
  },
  getSessions: async (): Promise<SessionInfo[]> => {
    const { data } = await apiClient.get('/settings/sessions')
    return z.array(SessionInfoSchema).parse(data)
  },
  revokeSession: async (sessionId: string): Promise<{ revoked: boolean }> => {
    const { data } = await apiClient.delete(`/settings/sessions/${sessionId}`)
    return data
  },
  revokeOtherSessions: async (): Promise<{ revoked: number }> => {
    const { data } = await apiClient.post('/settings/sessions/revoke-others')
    return data
  },
  getLoginHistory: async (limit = 20): Promise<LoginHistoryEntry[]> => {
    const { data } = await apiClient.get('/settings/login-history', { params: { limit } })
    return z.array(LoginHistoryEntrySchema).parse(data)
  },

  // ── AI Agent ──
  getAiConfig: async (): Promise<AiAgentConfig> => {
    const { data } = await apiClient.get('/settings/ai-config')
    return AiAgentConfigSchema.parse(data)
  },
  updateAiConfig: async (input: UpdateAiAgentConfigInput): Promise<AiAgentConfig> => {
    const { data } = await apiClient.patch('/settings/ai-config', input)
    return AiAgentConfigSchema.parse(data)
  },
  testAiConnection: async (): Promise<AiConnectionTest> => {
    const { data } = await apiClient.post('/settings/ai/test-connection')
    return AiConnectionTestSchema.parse(data)
  },

  // ── Nhật ký thay đổi ──
  getAuditLog: async (params: { page?: number; limit?: number; section?: string } = {}): Promise<{
    items: AuditLogEntry[]
    total: number
    page: number
    pageCount: number
  }> => {
    const { data } = await apiClient.get('/settings/audit-log', { params })
    return AuditLogPageSchema.parse(data)
  },
}

export interface AiConnectionTest {
  healthz: { ok: boolean; latencyMs: number | null; detail: string }
  roundTrip: { ok: boolean; latencyMs: number | null; detail: string } | null
}

export const AiConnectionTestSchema = z.object({
  healthz: z.object({
    ok: z.boolean(),
    latencyMs: z.number().nullable(),
    detail: z.string(),
  }),
  roundTrip: z
    .object({
      ok: z.boolean(),
      latencyMs: z.number().nullable(),
      detail: z.string(),
    })
    .nullable(),
})

export const AuditLogPageSchema = z.object({
  items: z.array(AuditLogEntrySchema),
  total: z.number(),
  page: z.number(),
  pageCount: z.number(),
})
