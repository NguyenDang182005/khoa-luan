import { apiClient } from './client'
import { GeofenceSchema, IntegrationsSchema } from '../schemas/settings.schema'
import { SalaryConfigSchema } from '../schemas/payroll.schema'
import type { Geofence, Integrations } from '../schemas/settings.schema'
import type { SalaryConfig } from '../schemas/payroll.schema'

export type { Geofence, Integrations }

export interface UpdateGeofenceInput {
  name?: string
  lat?: number
  lng?: number
  radiusM?: number
}

export interface UpdateSalaryConfigInput {
  year: number
  bhxhRate?: number
  bhytRate?: number
  bhtnRate?: number
  pitFreeAmount?: number
  overtimeRate?: number
  otWeekendRate?: number
  otHolidayRate?: number
  standardWorkHours?: number
}

/** Trang Cài Đặt — chỉ HR_ADMIN/ADMIN (backend chặn bằng RolesGuard) */
export const settingsApi = {
  getGeofence: async (): Promise<Geofence> => {
    const { data } = await apiClient.get('/settings/geofence')
    return GeofenceSchema.parse(data)
  },
  updateGeofence: async (input: UpdateGeofenceInput): Promise<Geofence> => {
    const { data } = await apiClient.patch('/settings/geofence', input)
    return GeofenceSchema.parse(data)
  },
  /** Ping DB / n8n / Slack / Gemini */
  getIntegrations: async (): Promise<Integrations> => {
    const { data } = await apiClient.get('/settings/integrations')
    return IntegrationsSchema.parse(data)
  },
  /** Tạo/cập nhật cấu hình lương theo năm (Admin) */
  updateSalaryConfig: async (input: UpdateSalaryConfigInput): Promise<SalaryConfig> => {
    const { data } = await apiClient.post('/salary-config', input)
    return SalaryConfigSchema.parse(data)
  },
}
