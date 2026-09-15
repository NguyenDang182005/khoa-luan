import { apiClient } from './client'
import {
  EmployeeListSchema,
  EmployeeDetailSchema,
  DepartmentsListSchema,
  ActiveContractSchema,
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
  /** Cập nhật hồ sơ nhân viên (không gồm hợp đồng/lương) */
  update: async (id: string, input: UpdateEmployeeInput) => {
    const { data } = await apiClient.patch(`/employees/${id}`, input)
    return EmployeeDetailSchema.parse(data)
  },
  /** Đổi trạng thái làm việc: ACTIVE | PROBATION | ON_LEAVE | TERMINATED */
  updateStatus: async (id: string, status: string) => {
    const { data } = await apiClient.patch(`/employees/${id}/status`, { status })
    return EmployeeDetailSchema.parse(data)
  },
  /** Cập nhật email/role tài khoản (chỉ ADMIN) */
  updateAccount: async (id: string, input: UpdateAccountInput) => {
    const { data } = await apiClient.patch(`/employees/${id}/account`, input)
    return data as { id: string; email: string; role: string; isActive: boolean; googleId: string | null; facebookId: string | null }
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
