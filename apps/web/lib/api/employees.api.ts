import { apiClient } from './client'
import {
  EmployeeListSchema,
  EmployeeDetailSchema,
  DepartmentsListSchema,
  ActiveContractSchema,
  ResetPasswordResponseSchema,
} from '../schemas/employee.schema'
import type { Contract, EmployeeDetail } from '../schemas/employee.schema'

export interface UpdateEmployeeInput {
  fullName?: string
  phone?: string
  address?: string
  dateOfBirth?: string
  nationalId?: string
  gender?: string
  status?: string
}

export interface CreateEmployeeInput {
  fullName: string
  email: string
  joinDate: string
  departmentId: string
  positionId: string
  phone?: string
  role?: 'ADMIN' | 'EMPLOYEE'
}

export interface UpdateAccountInput {
  email?: string
  role?: 'ADMIN' | 'EMPLOYEE'
}

export interface ResetPasswordInput {
  mode: 'GENERATE' | 'MANUAL'
  newPassword?: string
}

export interface Position {
  id: string
  title: string
  code: string
}

export const employeesApi = {
  list: async (params?: { search?: string; departmentId?: string; page?: number; limit?: number }) => {
    const { data } = await apiClient.get('/employees', { params })
    const parsed = EmployeeListSchema.parse(data)
    return {
      data: parsed.data,
      total: parsed.meta.total,
      page: parsed.meta.page,
      totalPages: parsed.meta.totalPages,
    }
  },
  getById: async (id: string) => {
    const { data } = await apiClient.get(`/employees/${id}`)
    return EmployeeDetailSchema.parse(data)
  },
  /**
   * Cập nhật hồ sơ nhân viên (không gồm hợp đồng/lương).
   * NOTE: PATCH /employees/:id trả về object employee PHẲNG (departmentId, positionId...)
   * — không đủ trường cho EmployeeDetailSchema (cần department/position lồng nhau).
   * Parse schema trên response phẳng sẽ ném ZodError khiến UI báo lỗi dù server đã lưu (HTTP 200).
   * → PATCH xong luôn refetch getById() để nhận đúng shape chi tiết.
   */
  update: async (id: string, input: UpdateEmployeeInput) => {
    await apiClient.patch(`/employees/${id}`, input)
    return employeesApi.getById(id)
  },
  /** Đổi trạng thái làm việc: ACTIVE | PROBATION | ON_LEAVE | TERMINATED (cùng lý do refetch như update) */
  updateStatus: async (id: string, status: string) => {
    await apiClient.patch(`/employees/${id}/status`, { status })
    return employeesApi.getById(id)
  },
  /** Cập nhật email/role tài khoản (chỉ ADMIN) */
  updateAccount: async (id: string, input: UpdateAccountInput) => {
    const { data } = await apiClient.patch(`/employees/${id}/account`, input)
    return data as { id: string; email: string; role: string; isActive: boolean; googleId: string | null; facebookId: string | null }
  },
  /**
   * Admin đặt lại mật khẩu nhân viên (chỉ ADMIN).
   * mode=GENERATE → response có generatedPassword, server chỉ trả ĐÚNG 1 LẦN để admin chuyển tay.
   * Mọi phiên đăng nhập cũ của nhân viên bị thu hồi sau khi đặt lại.
   */
  resetPassword: async (id: string, input: ResetPasswordInput) => {
    const { data } = await apiClient.post(`/employees/${id}/reset-password`, input)
    return ResetPasswordResponseSchema.parse(data)
  },
  getByCode: async (code: string) => {
    const { data } = await apiClient.get(`/employees/by-code/${code}`)
    return EmployeeDetailSchema.parse(data)
  },
  getDepartments: async () => {
    const { data } = await apiClient.get('/departments')
    return DepartmentsListSchema.parse(data)
  },
  getPositions: async (): Promise<Position[]> => {
    const { data } = await apiClient.get('/positions')
    return Array.isArray(data) ? data : []
  },
  create: async (input: CreateEmployeeInput) => {
    const { data } = await apiClient.post('/employees', input)
    return data
  },
}

export const contractsApi = {
  /** Hợp đồng đang active của một nhân viên (kèm lương cơ bản thật) */
  getActive: async (employeeId: string): Promise<Contract | null> => {
    const { data } = await apiClient.get(`/contracts/active/${employeeId}`)
    return ActiveContractSchema.parse(data ?? null)
  },
}

export type { EmployeeDetail }
