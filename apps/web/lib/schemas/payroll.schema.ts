import { z } from 'zod'

export const PayrollStatusEnum = z.enum(['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'])

export const PayrollRecordSchema = z.object({
  id: z.string(),
  month: z.number(),
  year: z.number(),
  baseSalary: z.number(),
  allowances: z.number(),
  bonus: z.number(),
  /** Tạm ứng đã trừ trong kỳ (0 nếu không có) */
  advance: z.number().optional(),
  /** Khấu trừ bảo hiểm = BHXH + BHYT + BHTN (KHÔNG gồm thuế TNCN) */
  deductions: z.number(),
  bhxh: z.number().optional(),
  bhyt: z.number().optional(),
  bhtn: z.number().optional(),
  /** Trợ cấp BHXH (ốm đau/thai sản) do cơ quan BHXH chi trả — không nằm trong lương công ty */
  bhxhBenefit: z.number().optional(),
  tax: z.number(),
  netSalary: z.number(),
  workingDays: z.number(),
  actualWorkingDays: z.number(),
  overtimeHours: z.number(),
  overtimePay: z.number(),
  status: PayrollStatusEnum,
  paidAt: z.string().nullable().optional(),
  employee: z.object({
    id: z.string(),
    fullName: z.string(),
    employeeCode: z.string(),
    department: z.object({ name: z.string() }),
    position: z.object({ title: z.string() }),
  }).optional().nullable(),
})
export const PayrollListSchema = z.array(PayrollRecordSchema)

/** Dòng lịch sử lương của 1 nhân viên (không kèm employee) */
export const PayrollHistoryItemSchema = PayrollRecordSchema.omit({ employee: true })
export const PayrollHistorySchema = z.array(PayrollHistoryItemSchema)

export type PayrollHistoryItem = z.infer<typeof PayrollHistoryItemSchema>

export const SalaryConfigSchema = z.object({
  year: z.number(),
  bhxhRate: z.number(),
  bhytRate: z.number(),
  bhtnRate: z.number(),
  pitFreeAmount: z.number(),
  pitDependentDeduction: z.number().optional(),
  overtimeRate: z.number(),
  otWeekendRate: z.number(),
  otHolidayRate: z.number(),
  standardWorkHours: z.number(),
})

export type PayrollRecord = z.infer<typeof PayrollRecordSchema>
export type SalaryConfig = z.infer<typeof SalaryConfigSchema>
