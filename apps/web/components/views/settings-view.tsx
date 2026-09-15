"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Coins,
  MapPin,
  PlugZap,
  Loader2,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

import { settingsApi } from "@/lib/api/settings.api"
import type { Geofence, IntegrationStatus } from "@/lib/schemas/settings.schema"
import { payrollApi } from "@/lib/api/payroll.api"
import type { SalaryConfig } from "@/lib/schemas/payroll.schema"

const SALARY_FIELDS: Array<{ key: keyof SalaryConfig; label: string; step: string; hint: string }> = [
  { key: "bhxhRate", label: "BHXH (%)", step: "0.001", hint: "Tỷ lệ nhân viên đóng, VD 0.08 = 8%" },
  { key: "bhytRate", label: "BHYT (%)", step: "0.001", hint: "VD 0.015 = 1.5%" },
  { key: "bhtnRate", label: "BHTN (%)", step: "0.001", hint: "VD 0.01 = 1%" },
  { key: "pitFreeAmount", label: "Giảm trừ gia cảnh (đ)", step: "100000", hint: "Mức miễn thuế TNCN, mặc định 11.000.000" },
  { key: "overtimeRate", label: "Hệ số OT ngày thường", step: "0.1", hint: "Mặc định 1.5" },
  { key: "otWeekendRate", label: "Hệ số OT cuối tuần", step: "0.1", hint: "Mặc định 2.0" },
  { key: "otHolidayRate", label: "Hệ số OT ngày lễ", step: "0.1", hint: "Mặc định 3.0" },
  { key: "standardWorkHours", label: "Giờ làm chuẩn/ngày", step: "0.5", hint: "Dùng để tính công và OT" },
]

function StatusBadge({ status }: { status: IntegrationStatus["status"] }) {
  if (status === "ok") return <Badge variant="success">Hoạt động</Badge>
  if (status === "error") return <Badge variant="coral">Lỗi</Badge>
  return <Badge variant="warning">Chưa cấu hình</Badge>
}

function StatusIcon({ status }: { status: IntegrationStatus["status"] }) {
  if (status === "ok") return <CheckCircle2 className="size-4 text-emerald-400" />
  if (status === "error") return <AlertTriangle className="size-4 text-agent-coral" />
  return <HelpCircle className="size-4 text-agent-amber" />
}

export function SettingsView() {
  // ── Cấu hình lương ──
  const [salary, setSalary] = useState<SalaryConfig | null>(null)
  const [salaryBusy, setSalaryBusy] = useState(false)
  const [salaryMsg, setSalaryMsg] = useState<string | null>(null)
  const [salaryError, setSalaryError] = useState<string | null>(null)

  // ── Geofence ──
  const [geofence, setGeofence] = useState<Geofence | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoMsg, setGeoMsg] = useState<string | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  // ── Integrations ──
  const [integrations, setIntegrations] = useState<Awaited<ReturnType<typeof settingsApi.getIntegrations>> | null>(null)
  const [pinging, setPinging] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      setSalary(await payrollApi.getSalaryConfig())
    } catch (e) {
      console.error(e)
    }
    try {
      setGeofence(await settingsApi.getGeofence())
    } catch (e) {
      console.error(e)
    }
    setPinging(true)
    try {
      setIntegrations(await settingsApi.getIntegrations())
    } catch (e) {
      console.error(e)
    } finally {
      setPinging(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const saveSalary = async () => {
    if (!salary || salaryBusy) return
    setSalaryBusy(true)
    setSalaryMsg(null)
    setSalaryError(null)
    try {
      const saved = await settingsApi.updateSalaryConfig({
        year: salary.year,
        bhxhRate: Number(salary.bhxhRate),
        bhytRate: Number(salary.bhytRate),
        bhtnRate: Number(salary.bhtnRate),
        pitFreeAmount: Number(salary.pitFreeAmount),
        overtimeRate: Number(salary.overtimeRate),
        otWeekendRate: Number(salary.otWeekendRate),
        otHolidayRate: Number(salary.otHolidayRate),
        standardWorkHours: Number(salary.standardWorkHours),
      })
      setSalary(saved)
      setSalaryMsg(`Đã lưu cấu hình lương năm ${saved.year}. Lần tính lương sau sẽ dùng cấu hình mới.`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setSalaryError(msg ?? "Không lưu được cấu hình lương.")
    } finally {
      setSalaryBusy(false)
    }
  }

  const saveGeofence = async () => {
    if (!geofence || geoBusy) return
    setGeoBusy(true)
    setGeoMsg(null)
    setGeoError(null)
    try {
      const saved = await settingsApi.updateGeofence({
        name: geofence.name,
        lat: Number(geofence.lat),
        lng: Number(geofence.lng),
        radiusM: Number(geofence.radiusM),
      })
      setGeofence(saved)
      setGeoMsg("Đã lưu vùng chấm công. Check-in/out trên Cổng Nhân Viên sẽ dùng tọa độ mới.")
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setGeoError(msg ?? "Không lưu được vùng chấm công.")
    } finally {
      setGeoBusy(false)
    }
  }

  const reping = async () => {
    setPinging(true)
    try {
      setIntegrations(await settingsApi.getIntegrations())
    } catch (e) {
      console.error(e)
    } finally {
      setPinging(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Cài Đặt Hệ Thống</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cấu hình lương & thuế, vùng chấm công GPS, và trạng thái tích hợp n8n / Slack / Gemini.
        </p>
      </div>

      {/* 1. Cấu hình lương & thuế */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Coins className="size-4 text-agent-amber" /> Cấu Hình Lương & Thuế (theo năm)
          </CardTitle>
          <CardDescription>
            Tỷ lệ bảo hiểm, mức giảm trừ gia cảnh và hệ số tăng ca — áp dụng khi chạy lương (WF Rule Engine).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!salary ? (
            <div className="flex h-20 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải cấu hình...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-4">
                  <label className="text-[11px] font-semibold text-muted-foreground">Năm áp dụng</label>
                  <Input
                    type="number"
                    value={salary.year}
                    onChange={(e) => setSalary({ ...salary, year: Number(e.target.value) })}
                    className="mt-1 h-8 w-32 text-xs font-mono"
                  />
                </div>
                {SALARY_FIELDS.map(({ key, label, step, hint }) => (
                  <div key={key} title={hint}>
                    <label className="text-[11px] font-semibold text-muted-foreground">{label}</label>
                    <Input
                      type="number"
                      step={step}
                      value={String(salary[key])}
                      onChange={(e) => setSalary({ ...salary, [key]: Number(e.target.value) })}
                      className="mt-1 h-8 text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
              {salaryMsg && <p className="mt-3 text-[11px] text-emerald-400">{salaryMsg}</p>}
              {salaryError && <p className="mt-3 text-[11px] text-agent-coral">{salaryError}</p>}
              <Button size="sm" className="mt-3 gap-1.5" onClick={saveSalary} disabled={salaryBusy}>
                {salaryBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Lưu Cấu Hình Lương
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 2. Vùng chấm công */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="size-4 text-agent-teal" /> Vùng Chấm Công (Geofence)
          </CardTitle>
          <CardDescription>
            Nhân viên chỉ check-in/out được khi GPS của họ nằm trong bán kính này quanh văn phòng. Cấu hình lưu trong DB
            (trước đây là biến môi trường NEXT_PUBLIC_OFFICE_*).
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
                    step="10"
                    value={String(geofence.radiusM)}
                    onChange={(e) => setGeofence({ ...geofence, radiusM: Number(e.target.value) })}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
              </div>
              {geoMsg && <p className="mt-3 text-[11px] text-emerald-400">{geoMsg}</p>}
              {geoError && <p className="mt-3 text-[11px] text-agent-coral">{geoError}</p>}
              <Button size="sm" className="mt-3 gap-1.5" onClick={saveGeofence} disabled={geoBusy}>
                {geoBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Lưu Vùng Chấm Công
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* 3. Trạng thái tích hợp */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <PlugZap className="size-4 text-agent-blue" /> Trạng Thái Tích Hợp
              </CardTitle>
              <CardDescription>
                {integrations
                  ? `Kiểm tra lần cuối: ${new Date(integrations.checkedAt).toLocaleTimeString("vi-VN")}`
                  : "Đang kiểm tra..."}
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={reping} disabled={pinging}>
              {pinging ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Kiểm Tra Lại
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!integrations ? (
            <div className="flex h-16 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang ping các dịch vụ...
            </div>
          ) : (
            integrations.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <StatusIcon status={item.status} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.detail ?? "--"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {item.latencyMs !== null && (
                    <span className="font-mono text-[11px] text-muted-foreground">{item.latencyMs}ms</span>
                  )}
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
