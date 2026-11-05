"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { MapPin, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { settingsApi } from "@/lib/api/settings.api"
import type { Geofence } from "@/lib/schemas/settings.schema"

export function GeofenceSection({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [geofence, setGeofence] = useState<Geofence | null>(null)
  const [saved, setSaved] = useState<Geofence | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dirty = useMemo(
    () => Boolean(geofence && saved && JSON.stringify(geofence) !== JSON.stringify(saved)),
    [geofence, saved],
  )

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const load = useCallback(async () => {
    try {
      const g = await settingsApi.getGeofence()
      setGeofence(g)
      setSaved(g)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!geofence || busy) return
    setBusy(true)
    setMsg(null)
    setError(null)
    try {
      const savedNew = await settingsApi.updateGeofence({
        name: geofence.name,
        lat: Number(geofence.lat),
        lng: Number(geofence.lng),
        radiusM: Number(geofence.radiusM),
      })
      setGeofence(savedNew)
      setSaved(savedNew)
      setMsg("Đã lưu vùng chấm công. Check-in/out trên Cổng Nhân Viên sẽ dùng tọa độ mới.")
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(m ?? "Không lưu được vùng chấm công.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" /> Vùng chấm công (geofence)
        </CardTitle>
        <CardDescription>
          Nhân viên chỉ check-in/out được khi GPS của họ nằm trong bán kính này quanh văn phòng.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!geofence ? (
          <div className="flex h-16 items-center justify-center gap-2 text-body-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tải...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="geo-name" className="text-body-sm font-medium text-secondary-foreground">
                  Tên văn phòng
                </label>
                <Input
                  id="geo-name"
                  value={geofence.name}
                  onChange={(e) => setGeofence({ ...geofence, name: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label htmlFor="geo-lat" className="text-body-sm font-medium text-secondary-foreground">
                  Vĩ độ (lat)
                </label>
                <Input
                  id="geo-lat"
                  type="number"
                  step="0.0001"
                  value={String(geofence.lat)}
                  onChange={(e) => setGeofence({ ...geofence, lat: Number(e.target.value) })}
                  className="mt-1.5 tabular"
                />
              </div>
              <div>
                <label htmlFor="geo-lng" className="text-body-sm font-medium text-secondary-foreground">
                  Kinh độ (lng)
                </label>
                <Input
                  id="geo-lng"
                  type="number"
                  step="0.0001"
                  value={String(geofence.lng)}
                  onChange={(e) => setGeofence({ ...geofence, lng: Number(e.target.value) })}
                  className="mt-1.5 tabular"
                />
              </div>
              <div>
                <label htmlFor="geo-radius" className="text-body-sm font-medium text-secondary-foreground">
                  Bán kính cho phép (m)
                </label>
                <Input
                  id="geo-radius"
                  type="number"
                  min={20}
                  max={5000}
                  value={String(geofence.radiusM)}
                  onChange={(e) => setGeofence({ ...geofence, radiusM: Number(e.target.value) })}
                  className="mt-1.5 tabular"
                />
                <p className="mt-1 text-caption text-muted-foreground">Từ 20 đến 5000 m.</p>
              </div>
            </div>
            {msg && (
              <p className="mt-4 flex items-center gap-1.5 text-body-sm text-success">
                <CheckCircle2 className="size-4 shrink-0" /> {msg}
              </p>
            )}
            {error && (
              <p className="mt-4 flex items-center gap-1.5 text-body-sm text-danger">
                <AlertTriangle className="size-4 shrink-0" /> {error}
              </p>
            )}
          </>
        )}
      </CardContent>
      {geofence && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 rounded-b-lg border-t border-border bg-card px-5 py-4 sm:px-6">
          {dirty && (
            <span className="mr-auto flex items-center gap-1.5 text-body-sm text-warning">
              <span className="size-2 rounded-full bg-warning" aria-hidden="true" /> Có thay đổi chưa lưu
            </span>
          )}
          <Button onClick={save} disabled={busy || !dirty}>
            {busy && <Loader2 className="size-4 animate-spin" />} Lưu thay đổi
          </Button>
        </div>
      )}
    </Card>
  )
}
