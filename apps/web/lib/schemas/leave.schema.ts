import { z } from 'zod'

export const LeaveTypeEnum = z.enum(['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID', 'EMERGENCY', 'OT', 'LATE_PERMISSION', 'BUSINESS_TRIP', 'OTHER'])
export const LeaveStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])

export const LeaveRequestSchema = z.object({
  id: z.string(),
  type: LeaveTypeEnum,
  startDate: z.string(),
  endDate: z.string(),
  totalDays: z.number(),
  overtimeHours: z.number().nullable().optional(),
  reason: z.string(),
  status: LeaveStatusEnum,
  approvedAt: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  employee: z
    .object({
      id: z.string().optional(),
      fullName: z.string(),
      employeeCode: z.string(),
      department: z.object({ name: z.string() }).optional().nullable(),
    })
    .optional(),
  approvedBy: z
    .object({
      id: z.string(),
      fullName: z.string(),
    })
    .optional()
    .nullable(),
  createdAt: z.string().optional(),
})
export const LeaveListSchema = z.array(LeaveRequestSchema)

export const LeaveBalanceSchema = z.object({
  employeeId: z.string().optional(),
  year: z.number(),
  // Backend cũ trả { total, used, remaining }, backend mới có thể thêm totalDays/usedDays/remainingDays
  total: z.number().optional(),
  used: z.number().optional(),
  remaining: z.number().optional(),
  totalDays: z.number().optional(),
  usedDays: z.number().optional(),
  remainingDays: z.number().optional(),
}).transform((v) => ({
  employeeId: v.employeeId ?? '',
  year: v.year,
  totalDays: v.totalDays ?? v.total ?? 12,
  usedDays: v.usedDays ?? v.used ?? 0,
  remainingDays: v.remainingDays ?? v.remaining ?? (v.total ?? 12) - (v.used ?? 0),
}))

export const LeaveCreateSchema = z.object({
  employeeId: z.string().min(1, 'Vui lòng chọn nhân viên'),
  type: LeaveTypeEnum,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  reason: z.string().min(10, 'Lý do tối thiểu 10 ký tự').max(500, 'Lý do tối đa 500 ký tự'),
  overtimeHours: z.number().min(0).optional(),
  overtimeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ').optional(),
})

export type LeaveRequest = z.infer<typeof LeaveRequestSchema>
export type LeaveBalance = z.infer<typeof LeaveBalanceSchema>
export type LeaveCreateInput = z.infer<typeof LeaveCreateSchema>
