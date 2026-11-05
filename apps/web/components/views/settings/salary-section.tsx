"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Coins, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { payrollApi } from "@/lib/api/payroll.api"
import { settingsApi } from "@/lib/api/settings.api"
import type { SalaryConfig } from "@/lib/schemas/payroll.schema"

// Rate lưu dạng thập phân (0.08 = 8%). Nhãn hiển thị dạng phần trăm cho khỏi nhập nhầm.
const SALARY_FIELDS: Array<{ key: keyof SalaryConfig; label: string; step: string; hint: string; percent?: boolean }> = [
  { key: "bhxhRate", label: "BHXH", step: "0.001", hint: "Nhập dạng thập phân: 0.08 = 8%", percent: true },
  { key: "bhytRate", label: "BHYT", step: "0.001", hint: "0.015 = 1,5%", percent: true },
  { key: "bhtnRate", label: "BHTN", step: "0.001", hint: "0.01 = 1%", percent: true },
  { key: "pitFreeAmount", label: "Giảm trừ bản thân (đ)", step: "100000", hint: "Mức giảm trừ bản thân, mặc định 15.500.000" },
  { key: "overtimeRate", label: "Hệ số OT ngày thường", step: "0.1", hint: "Mặc định 1.5" },
  { key: "otWeekendRate", label: "Hệ số OT cuối tuần", step: "0.1", hint: "Mặc định 2.0" },
  { key: "otHolidayRate", label: "Hệ số OT ngày lễ", step: "0.1", hint: "Mặc định 3.0" },
  { key: "standardWorkHours", label: "Giờ làm chuẩn/ngày", step: "0.5", hint: "Dùng để tính công và OT" },
]

/** Hiển thị rate dạng phần trăm (0.08 → "8", 0.015 → "1.5") */
const displayRate = (v: number): string => String(Math.round(v * 10000) / 100)

export function SalarySection({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [salary, setSalary] = useState<SalaryConfig | null>(null)
  const [saved, setSaved] = useState<SalaryConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const dirty = useMemo(
    () => Boolean(salary && saved && JSON.stringify(salary) !== JSON.stringify(saved)),
    [salary, saved],
  )

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const s = await payrollApi.getSalaryConfig()
      setSalary(s)
      setSaved(s)
    } catch (e) {
      console.error(e)
      setLoadError("Không tải được cấu hình lương.")
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
        <CardTitle className="flex items-center gap-2">
          <Coins className="size-4 text-primary" /> Cấu hình lương & thuế (theo năm)
        </CardTitle>
        <CardDescription>
          Tỷ lệ bảo hiểm, mức giảm trừ bản thân và hệ số tăng ca — áp dụng cho công thức tính lương mỗi lần chạy lương.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!salary && loadError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger-tint px-4 py-3 text-body-sm text-danger">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" /> {loadError}
            </span>
            <Button size="sm" variant="outline" onClick={load}>
              Thử lại
            </Button>
          </div>
        ) : !salary ? (
          <div className="flex h-20 items-center justify-center gap-2 text-body-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tải cấu hình...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="salary-year" className="text-body-sm font-medium text-secondary-foreground">
                  Năm áp dụng
                </label>
                <Input
                  id="salary-year"
                  type="number"
                  value={salary.year}
                  onChange={(e) => setSalary({ ...salary, year: Number(e.target.value) })}
                  className="mt-1.5 w-32 tabular"
                />
              </div>
              {SALARY_FIELDS.map(({ key, label, step, hint, percent }) => (
                <div key={key}>
                  <label htmlFor={`salary-${key}`} className="text-body-sm font-medium text-secondary-foreground">
                    {label}{percent ? " (%)" : ""}
                  </label>
                  <Input
                    id={`salary-${key}`}
                    type="number"
                    step={step}
                    value={percent ? displayRate(salary[key] as number) : String(salary[key])}
                    onChange={(e) =>
                      setSalary({ ...salary, [key]: Number(e.target.value) })
                    }
                    className="mt-1.5 tabular"
                  />
                  <p className="mt-1 text-caption text-muted-foreground">{hint}</p>
                  {key === "pitFreeAmount" && Number(salary[key]) > 0 && (
                    <p className="mt-0.5 text-caption tabular text-secondary-foreground">
                      = {Number(salary[key]).toLocaleString("vi-VN")} ₫
                    </p>
                  )}
                </div>
              ))}
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
      {salary && (
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
