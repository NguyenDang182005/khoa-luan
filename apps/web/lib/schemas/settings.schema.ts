import { z } from 'zod'

/** Vùng địa lý chấm công (GET/PATCH /settings/geofence) */
export const GeofenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  radiusM: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const IntegrationStatusSchema = z.object({
  key: z.string(),
  name: z.string(),
  status: z.enum(['ok', 'error', 'not_configured']),
  latencyMs: z.number().nullable(),
  detail: z.string().nullable(),
})

export const IntegrationsSchema = z.object({
  checkedAt: z.string(),
  items: z.array(IntegrationStatusSchema),
})

/** Chính sách phép năm (GET/PATCH /settings/leave-policy) */
export const LeavePolicySchema = z.object({
  id: z.string(),
  annualQuotaDays: z.number(),
  seniorityBonusEveryYears: z.number(),
  seniorityBonusDays: z.number(),
  prorateByJoinMonth: z.boolean(),
  maxCarryOverDays: z.number(),
  note: z.string().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export type Geofence = z.infer<typeof GeofenceSchema>
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>
export type Integrations = z.infer<typeof IntegrationsSchema>
export type LeavePolicy = z.infer<typeof LeavePolicySchema>

/** Chính sách bảo mật (GET/PATCH /settings/security-policy) */
export const SecurityPolicySchema = z.object({
  id: z.string(),
  passwordMinLength: z.number(),
  requireUppercase: z.boolean(),
  requireLowercase: z.boolean(),
  requireDigit: z.boolean(),
  requireSpecial: z.boolean(),
  passwordMaxAgeDays: z.number(),
  maxFailedAttempts: z.number(),
  lockoutMinutes: z.number(),
  accessTokenTtlHours: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

/** Phiên đăng nhập active (GET /settings/sessions) — KHÔNG chứa refresh-token */
export const SessionInfoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  user: z.object({
    email: z.string(),
    role: z.string(),
    lastLoginAt: z.string().nullable().optional(),
  }),
})

/** Lịch sử đăng nhập (GET /settings/login-history) */
export const LoginHistoryEntrySchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  email: z.string(),
  success: z.boolean(),
  reason: z.string().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
  user: z
    .object({
      email: z.string(),
      role: z.string(),
    })
    .nullable()
    .optional(),
})

/** Cấu hình AI Agent (GET/PATCH /settings/ai-config) — GET trả apiKeySet, KHÔNG trả key */
export const AiAgentConfigSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  webhookUrl: z.string().nullable(),
  apiKeySet: z.boolean(),
  timeoutMs: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

/** Nhật ký thay đổi cài đặt (GET /settings/audit-log) */
export const AuditLogEntrySchema = z.object({
  id: z.string(),
  adminUserId: z.string().nullable(),
  adminEmail: z.string(),
  section: z.string(),
  field: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  createdAt: z.string(),
})

export type SecurityPolicy = z.infer<typeof SecurityPolicySchema>
export type SessionInfo = z.infer<typeof SessionInfoSchema>
export type LoginHistoryEntry = z.infer<typeof LoginHistoryEntrySchema>
export type AiAgentConfig = z.infer<typeof AiAgentConfigSchema>
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>
