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
  // approverId do server lấy từ JWT — web không gửi (tránh tự duyệt đơn của mình).
  approve: async (id: string) => {
    const { data } = await apiClient.patch(`/leave/${id}/approve`, {})
    return data
  },
  reject: async (id: string, reason: string) => {
    const { data } = await apiClient.patch(`/leave/${id}/reject`, { rejectionReason: reason })
    return data
  },
  approveBulk: async (ids: string[]) => {
    return Promise.all(ids.map((id) => apiClient.patch(`/leave/${id}/approve`, {})))
  },
  rejectBulk: async (ids: string[], reason: string) => {
    return Promise.all(
      ids.map((id) => apiClient.patch(`/leave/${id}/reject`, { rejectionReason: reason }))
    )
  },
  cancel: async (id: string) => {
    const { data } = await apiClient.patch(`/leave/${id}/cancel`, {})
    return data
  },
}