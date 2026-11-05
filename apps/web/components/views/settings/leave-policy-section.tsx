"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { CalendarDays, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { settingsApi } from "@/lib/api/settings.api"
import type { LeavePolicy } from "@/lib/schemas/settings.schema"

export function LeavePolicySection({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [policy, setPolicy] = useState<LeavePolicy | null>(null)
  const [saved, setSaved] = useState<LeavePolicy | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dirty = useMemo(
    () =>
      Boolean(
        policy &&
          saved &&
          JSON.stringify({ ...policy, note: policy.note ?? "" }) !== JSON.stringify({ ...saved, note: saved.note ?? "" }),
      ),
    [policy, saved],
  )

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const load = useCallback(async () => {
    try {
      const p = await settingsApi.getLeavePolicy()
      setPolicy(p)
      setSaved(p)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!policy || busy) return
    setBusy(true)
    setMsg(null)
    setError(null)
    try {
      const savedNew = await settingsApi.updateLeavePolicy({
        annualQuotaDays: Number(policy.annualQuotaDays),
        seniorityBonusEveryYears: 0,
        seniorityBonusDays: 0,
        prorateByJoinMonth: policy.prorateByJoinMonth,
        maxCarryOverDays: 0,
        note: policy.note ?? "",
      })
      setPolicy(savedNew)
      setSaved(savedNew)
      setMsg("Đã lưu chính sách phép năm. Số dư phép của nhân viên sẽ tính lại theo cấu hình mới.")
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(m ?? "Không lưu được chính sách phép năm.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" /> Chính sách phép năm
        </CardTitle>
        <CardDescription>
          Chu kỳ theo năm dương lịch (01/01 – 31/12). Số dư phép = ngày phép chuẩn/năm (tính tỷ lệ pro-rate nếu vào làm trong năm) − số ngày đã dùng.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!policy ? (
          <div className="flex h-16 items-center justify-center gap-2 text-body-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tải...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              <div>
                <label htmlFor="leave-quota" className="text-body-sm font-medium text-secondary-foreground">
                  Ngày phép chuẩn/năm
                </label>
                <Input
                  id="leave-quota"
                  type="number"
                  min={0}
                  max={365}
                  value={String(policy.annualQuotaDays)}
                  onChange={(e) => setPolicy({ ...policy, annualQuotaDays: Number(e.target.value) })}
                  className="mt-1.5 tabular"
                />
                <p className="mt-1 text-caption text-muted-foreground">Số ngày phép chuẩn mỗi năm (mặc định 12)</p>
              </div>
              <div>
                <label htmlFor="leave-note" className="text-body-sm font-medium text-secondary-foreground">
                  Ghi chú chính sách
                </label>
                <Input
                  id="leave-note"
                  value={policy.note ?? ""}
                  placeholder="VD: Áp dụng theo Bộ luật Lao động 2019"
                  onChange={(e) => setPolicy({ ...policy, note: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-sunken p-4 md:col-span-2">
                <div>
                  <p className="text-body font-medium text-foreground">Tính theo tháng vào làm</p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    Năm đầu: 12 × (số tháng làm việc / 12). VD: vào 01/07 → 6 ngày.
                  </p>
                </div>
                <Switch
                  checked={policy.prorateByJoinMonth}
                  onCheckedChange={(v) => setPolicy({ ...policy, prorateByJoinMonth: v })}
                  aria-label="Tính theo tháng vào làm"
                />
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
      {policy && (
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
