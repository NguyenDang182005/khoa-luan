"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { CalendarDays, Loader2 } from "lucide-react"
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
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-agent-teal" /> Chính Sách Phép Năm
        </CardTitle>
        <CardDescription>
          Chu kỳ theo năm dương lịch (01/01 – 31/12). Số dư phép = ngày phép chuẩn/năm (tính tỷ lệ pro-rate nếu vào làm trong năm) − số ngày đã dùng.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!policy ? (
          <div className="flex h-16 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tải...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div title="Số ngày phép chuẩn mỗi năm (mặc định 12)">
                <label className="text-[11px] font-semibold text-muted-foreground">Ngày phép chuẩn/năm</label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={String(policy.annualQuotaDays)}
                  onChange={(e) => setPolicy({ ...policy, annualQuotaDays: Number(e.target.value) })}
                  className="mt-1 h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Ghi chú chính sách</label>
                <Input
                  value={policy.note ?? ""}
                  placeholder="VD: Áp dụng theo Bộ luật Lao động 2019"
                  onChange={(e) => setPolicy({ ...policy, note: e.target.value })}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <Switch
                  checked={policy.prorateByJoinMonth}
                  onCheckedChange={(v) => setPolicy({ ...policy, prorateByJoinMonth: v })}
                />
                <div>
                  <p className="text-xs font-semibold text-foreground">Tính theo tháng vào làm</p>
                  <p className="text-[11px] text-muted-foreground">
                    Năm đầu: 12 × (số tháng làm việc / 12). VD: vào 01/07 → 6 ngày.
                  </p>
                </div>
              </div>
            </div>
            {msg && <p className="mt-3 text-[11px] text-emerald-400">{msg}</p>}
            {error && <p className="mt-3 text-[11px] text-agent-coral">{error}</p>}
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" className="gap-1.5" onClick={save} disabled={busy || !dirty}>
                {busy && <Loader2 className="size-3.5 animate-spin" />} Lưu Chính Sách Phép
              </Button>
              {dirty && <span className="text-[11px] text-agent-amber">● Có thay đổi chưa lưu</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
