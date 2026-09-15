import { z } from 'zod'

export const MyOnboardingItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  isCompleted: z.boolean(),
  completedAt: z.string().nullable(),
})

export const MyOnboardingSchema = z.object({
  items: z.array(MyOnboardingItemSchema),
})

export type MyOnboardingItem = z.infer<typeof MyOnboardingItemSchema>
