import { apiClient } from './client'
import { LeaveListSchema, LeaveBalanceSchema, LeaveCreateInput } from '../schemas/leave.schema'

export const leaveApi = {
  list: async (params?: { employeeId?: string; status?: string }) => {
    const { data } = await apiClient.get('/leave', { params })
    return LeaveListSchema.parse(data)
  },
  getBalance: async (employeeId: string, year?: number) => {
    const { data } = await apiClient.get(`/leave/balance/${employeeId}`, { params: year ? { year } : {} })
    return LeaveBalanceSchema.parse(data)
  },
  create: async (input: LeaveCreateInput) => {
    const { data } = await apiClient.post('/leave', input)
    return data
  },
  approve: async (id: string, approverId: string) => {
    const { data } = await apiClient.patch(`/leave/${id}/approve`, { approverId })
    return data
  },
  reject: async (id: string, approverId: string, reason: string) => {
    const { data } = await apiClient.patch(`/leave/${id}/reject`, { approverId, rejectionReason: reason })
    return data
  },
  cancel: async (id: string, employeeId: string) => {
    const { data } = await apiClient.patch(`/leave/${id}/cancel`, { employeeId })
    return data
  },
}
