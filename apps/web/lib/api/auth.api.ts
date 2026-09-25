import { apiClient } from './client'

/** POST /auth/change-password — JWT, áp SecurityPolicy, thu hồi các phiên khác */
export const authApi = {
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const { data } = await apiClient.post('/auth/change-password', { currentPassword, newPassword })
    return data
  },
}
