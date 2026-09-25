import { apiClient } from './client'
import { MyOnboardingSchema, MyOnboardingItem } from '../schemas/onboarding.schema'

export type { MyOnboardingItem }

export const onboardingApi = {
  /** Lộ trình hội nhập của chính người dùng đang đăng nhập (JWT) */
  getMy: async (): Promise<{ items: MyOnboardingItem[] }> => {
    const { data } = await apiClient.get('/agents/onboarding/my')
    return MyOnboardingSchema.parse(data)
  },

  /** Admin: Danh sách task template */
  findAllTasks: async (): Promise<any[]> => {
    const { data } = await apiClient.get('/onboarding/tasks')
    return data
  },

  /** Admin: Tạo task template */
  createTask: async (dto: any) => {
    const { data } = await apiClient.post('/onboarding/tasks', dto)
    return data
  },

  /** Admin: Cập nhật task template */
  updateTask: async (id: string, dto: any) => {
    const { data } = await apiClient.patch(`/onboarding/tasks/${id}`, dto)
    return data
  },

  /** Admin: Xóa task template */
  deleteTask: async (id: string) => {
    const { data } = await apiClient.delete(`/onboarding/tasks/${id}`)
    return data
  },

  /** Admin: Tổng hợp tiến độ onboarding tất cả nhân viên */
  getAllProgress: async (): Promise<any[]> => {
    const { data } = await apiClient.get('/onboarding/progress')
    return data
  },

  /** Admin: Tiến độ onboarding của 1 nhân viên */
  getEmployeeProgress: async (employeeId: string): Promise<any> => {
    const { data } = await apiClient.get(`/onboarding/progress/${employeeId}`)
    return data
  },

  /** Admin: Cập nhật trạng thái task */
  updateProgress: async (employeeId: string, taskId: string, dto: { status: string; note?: string }) => {
    const { data } = await apiClient.patch(`/onboarding/progress/${employeeId}/${taskId}`, dto)
    return data
  },

  /** Admin: Gán tất cả task onboarding cho nhân viên */
  assignTasksToEmployee: async (employeeId: string) => {
    const { data } = await apiClient.post(`/onboarding/assign/${employeeId}`)
    return data
  },
}
