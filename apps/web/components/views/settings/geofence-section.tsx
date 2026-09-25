"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { MapPin, Loader2, Save } from "lucide-react"
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
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4 text-agent-teal" /> Vùng Chấm Công (Geofence)
        </CardTitle>
        <CardDescription>
          Nhân viên chỉ check-in/out được khi GPS của họ nằm trong bán kính này quanh văn phòng.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!geofence ? (
          <div className="flex h-16 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tải...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="text-[11px] font-semibold text-muted-foreground">Tên văn phòng</label>
                <Input
                  value={geofence.name}
                  onChange={(e) => setGeofence({ ...geofence, name: e.target.value })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Vĩ độ (lat)</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={String(geofence.lat)}
                  onChange={(e) => setGeofence({ ...geofence, lat: Number(e.target.value) })}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Kinh độ (lng)</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={String(geofence.lng)}
                  onChange={(e) => setGeofence({ ...geofence, lng: Number(e.target.value) })}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Bán kính cho phép (m)</label>
                <Input
                  type="number"
                  min={20}
                  max={5000}
                  value={String(geofence.radiusM)}
                  onChange={(e) => setGeofence({ ...geofence, radiusM: Number(e.target.value) })}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
            </div>
            {msg && <p className="mt-3 text-[11px] text-emerald-400">{msg}</p>}
            {error && <p className="mt-3 text-[11px] text-agent-coral">{error}</p>}
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" className="gap-1.5" onClick={save} disabled={busy || !dirty}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Lưu Vùng Chấm Công
              </Button>
              {dirty && <span className="text-[11px] text-agent-amber">● Có thay đổi chưa lưu</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
