import { apiClient } from './client'
import { AttendanceListSchema, AttendanceRecordSchema, AttendanceRecord } from '../schemas/attendance.schema'

export type { AttendanceRecord }

export const attendanceApi = {
  /** Bảng chấm công 1 tháng của 1 nhân viên */
  listByEmployee: async (employeeId: string, month: number, year: number): Promise<AttendanceRecord[]> => {
    const { data } = await apiClient.get(`/attendance/employee/${employeeId}`, { params: { month, year } })
    return AttendanceListSchema.parse(data)
  },
  checkIn: async (employeeId: string, location?: string): Promise<AttendanceRecord> => {
    const { data } = await apiClient.post('/attendance/check-in', { employeeId, location })
    return AttendanceRecordSchema.parse(data)
  },
  checkOut: async (employeeId: string): Promise<AttendanceRecord> => {
    const { data } = await apiClient.post('/attendance/check-out', { employeeId })
    return AttendanceRecordSchema.parse(data)
  },
}

/** Khoảng cách Haversine giữa 2 tọa độ (mét) */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
