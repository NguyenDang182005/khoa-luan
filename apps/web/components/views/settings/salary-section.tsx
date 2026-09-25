"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Coins, Loader2, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { payrollApi } from "@/lib/api/payroll.api"
import { settingsApi } from "@/lib/api/settings.api"
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

export function SalarySection({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [salary, setSalary] = useState<SalaryConfig | null>(null)
  const [saved, setSaved] = useState<SalaryConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dirty = useMemo(
    () => Boolean(salary && saved && JSON.stringify(salary) !== JSON.stringify(saved)),
    [salary, saved],
  )

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const load = useCallback(async () => {
    try {
      const s = await payrollApi.getSalaryConfig()
      setSalary(s)
      setSaved(s)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!salary || busy) return
    setBusy(true)
    setMsg(null)
    setError(null)
    try {
      const savedNew = await settingsApi.updateSalaryConfig({
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
      setSalary(savedNew)
      setSaved(savedNew)
      setMsg(`Đã lưu cấu hình lương năm ${savedNew.year}. Lần tính lương sau sẽ dùng cấu hình mới.`)
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(m ?? "Không lưu được cấu hình lương.")
    } finally {
      setBusy(false)
    }
  }

  return (
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
            {msg && <p className="mt-3 text-[11px] text-emerald-400">{msg}</p>}
            {error && <p className="mt-3 text-[11px] text-agent-coral">{error}</p>}
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" className="gap-1.5" onClick={save} disabled={busy || !dirty}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Lưu Cấu Hình Lương
              </Button>
              {dirty && <span className="text-[11px] text-agent-amber">● Có thay đổi chưa lưu</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
