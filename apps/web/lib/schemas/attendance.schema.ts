import { z } from 'zod'

export const AttendanceRecordSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  date: z.string(),
  checkIn: z.string().nullable(),
  checkOut: z.string().nullable(),
  status: z.string(),
  dayType: z.string().optional(),
  workHours: z.number().nullable().optional(),
  overtime: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
})

export const AttendanceListSchema = z.array(AttendanceRecordSchema)

export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>
