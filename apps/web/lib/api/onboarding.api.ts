import { apiClient } from './client'
import { MyOnboardingSchema, MyOnboardingItem } from '../schemas/onboarding.schema'

export type { MyOnboardingItem }

export const onboardingApi = {
  /** Lộ trình hội nhập của chính người dùng đang đăng nhập (JWT) */
  getMy: async (): Promise<{ items: MyOnboardingItem[] }> => {
    const { data } = await apiClient.get('/agents/onboarding/my')
    return MyOnboardingSchema.parse(data)
  },
}
