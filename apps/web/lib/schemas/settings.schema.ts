import { z } from 'zod'

/** Vùng địa lý chấm công (GET/PATCH /settings/geofence) */
export const GeofenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  radiusM: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const IntegrationStatusSchema = z.object({
  key: z.string(),
  name: z.string(),
  status: z.enum(['ok', 'error', 'not_configured']),
  latencyMs: z.number().nullable(),
  detail: z.string().nullable(),
})

export const IntegrationsSchema = z.object({
  checkedAt: z.string(),
  items: z.array(IntegrationStatusSchema),
})

export type Geofence = z.infer<typeof GeofenceSchema>
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>
export type Integrations = z.infer<typeof IntegrationsSchema>
