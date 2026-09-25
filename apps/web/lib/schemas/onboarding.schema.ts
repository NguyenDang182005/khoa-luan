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

export const OnboardingTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  category: z.string(),
  dueAfterDays: z.number().default(7),
  isRequired: z.boolean().default(true),
  order: z.number().default(0),
  _count: z.object({ progresses: z.number() }).optional(),
})

export const OnboardingTaskCreateSchema = z.object({
  title: z.string().min(2, 'Tiêu đề tối thiểu 2 ký tự'),
  description: z.string().optional(),
  category: z.string().default('paperwork'),
  dueAfterDays: z.number().min(1).default(7),
  isRequired: z.boolean().default(true),
  order: z.number().default(0),
})

export const OnboardingProgressItemSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  taskId: z.string(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']),
  completedAt: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  employee: z
    .object({
      id: z.string(),
      fullName: z.string(),
      employeeCode: z.string(),
      joinDate: z.string().optional(),
      department: z.object({ name: z.string() }).optional().nullable(),
    })
    .optional(),
  task: OnboardingTaskSchema.optional(),
})

export type OnboardingTask = z.infer<typeof OnboardingTaskSchema>
export type OnboardingTaskCreateInput = z.infer<typeof OnboardingTaskCreateSchema>
export type OnboardingProgressItem = z.infer<typeof OnboardingProgressItemSchema>
