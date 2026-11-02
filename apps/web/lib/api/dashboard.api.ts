import { apiClient } from './client'
import { KpiSchema, AttendanceChartSchema, DeptDistributionSchema, PendingLeavesSchema, AiActivitySchema } from '../schemas/dashboard.schema'

export const dashboardApi = {
  getKpis: async () => {
    const { data } = await apiClient.get('/dashboard/kpis')
    return KpiSchema.parse(data)
  },
  getAttendanceChart: async (month?: number, year?: number) => {
    const params = new URLSearchParams()
    if (month) params.set('month', String(month))
    if (year) params.set('year', String(year))
    const { data } = await apiClient.get(`/dashboard/attendance-chart?${params}`)
    return AttendanceChartSchema.parse(data)
  },
  getDeptDistribution: async () => {
    const { data } = await apiClient.get('/dashboard/department-distribution')
    return DeptDistributionSchema.parse(data)
  },
  getPendingLeaves: async () => {
    const { data } = await apiClient.get('/dashboard/pending-leaves')
    return PendingLeavesSchema.parse(data)
  },
  getAiActivity: async () => {
    const { data } = await apiClient.get('/dashboard/ai-activity')
    return AiActivitySchema.parse(data)
  },
  // approverId do server lấy từ JWT — web không gửi.
  approveLeave: async (id: string) => {
    const { data } = await apiClient.patch(`/leave/${id}/approve`, {})
    return data
  },
  rejectLeave: async (id: string, reason: string) => {
    const { data } = await apiClient.patch(`/leave/${id}/reject`, { rejectionReason: reason })
    return data
  },
}
