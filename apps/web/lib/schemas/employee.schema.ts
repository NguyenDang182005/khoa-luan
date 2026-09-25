import { z } from 'zod'

export const EmployeeSchema = z.object({
  id: z.string(),
  employeeCode: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  joinDate: z.string(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'PROBATION']),
  department: z.object({ id: z.string(), name: z.string() }),
  position: z.object({ id: z.string(), title: z.string() }),
  user: z.object({ email: z.string(), role: z.string(), avatarUrl: z.string().nullable().optional(), googleId: z.string().nullable().optional(), facebookId: z.string().nullable().optional(), isActive: z.boolean().optional() }).optional(),
})

export const EmployeeListSchema = z.object({
  success: z.boolean().optional(),
  data: z.array(EmployeeSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
})

export const DepartmentSchema = z.object({ id: z.string(), name: z.string(), code: z.string() })
export const DepartmentsListSchema = z.array(DepartmentSchema)

export const ContractSchema = z.object({
  id: z.string(),
  contractNumber: z.string(),
  type: z.enum(['FULL_TIME', 'PART_TIME', 'PROBATION', 'FREELANCE', 'INTERNSHIP']),
  baseSalary: z.number(),
  allowances: z.number(),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  signedDate: z.string(),
  isActive: z.boolean(),
})
export const ActiveContractSchema = ContractSchema.nullable()

/** Chi tiết đầy đủ (GET /employees/:id) — đủ 5 nhóm thông tin hồ sơ */
export const EmployeeDetailSchema = EmployeeSchema.extend({
  dateOfBirth: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  nationalId: z.string().nullable().optional(),
  manager: z
    .object({ id: z.string(), fullName: z.string(), employeeCode: z.string() })
    .nullable()
    .optional(),
  contracts: z.array(ContractSchema).optional(),
})

export type Contract = z.infer<typeof ContractSchema>
export type EmployeeDetail = z.infer<typeof EmployeeDetailSchema>

/** POST /employees/:id/reset-password — generatedPassword chỉ có khi mode=GENERATE và chỉ trả MỘT LẦN */
export const ResetPasswordResponseSchema = z.object({
  message: z.string(),
  fullName: z.string(),
  email: z.string(),
  generatedPassword: z.string().optional(),
})

export type ResetPasswordResult = z.infer<typeof ResetPasswordResponseSchema>

export type Employee = z.infer<typeof EmployeeSchema>
export type EmployeeList = z.infer<typeof EmployeeListSchema>
export type Department = z.infer<typeof DepartmentSchema>