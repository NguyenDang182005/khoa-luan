"use client"

import { useEffect, useState, useCallback } from "react"
import { History, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { settingsApi } from "@/lib/api/settings.api"
import type { AuditLogEntry } from "@/lib/schemas/settings.schema"

const SECTION_LABELS: Record<string, { label: string; variant: "teal" | "blue" | "amber" | "warning" | "coral" }> = {
  leave_policy: { label: "Phép năm", variant: "teal" },
  security_policy: { label: "Bảo mật", variant: "blue" },
  ai_agent: { label: "AI Agent", variant: "amber" },
  salary_config: { label: "Lương & Thuế", variant: "warning" },
  geofence: { label: "Vùng chấm công", variant: "coral" },
  account: { label: "Tài khoản", variant: "teal" },
}

const FIELD_LABELS: Record<string, string> = {
  annualQuotaDays: "Ngày phép chuẩn/năm",
  seniorityBonusEveryYears: "Mốc thâm niên (năm)",
  seniorityBonusDays: "Ngày cộng thâm niên",
  prorateByJoinMonth: "Pro-rate theo tháng vào làm",
  maxCarryOverDays: "Chuyển thừa tối đa",
  note: "Ghi chú",
  passwordMinLength: "Độ dài mật khẩu tối thiểu",
  requireUppercase: "Yêu cầu chữ HOA",
  requireLowercase: "Yêu cầu chữ thường",
  requireDigit: "Yêu cầu chữ số",
  requireSpecial: "Yêu cầu ký tự đặc biệt",
  passwordMaxAgeDays: "Buộc đổi định kỳ (ngày)",
  maxFailedAttempts: "Khóa sau N lần sai",
  lockoutMinutes: "Thời gian khóa (phút)",
  accessTokenTtlHours: "Thời hạn phiên (giờ)",
  enabled: "Bật AI Agent",
  webhookUrl: "Webhook URL",
  apiKey: "API Key",
  timeoutMs: "Timeout (ms)",
  year: "Năm",
  bhxhRate: "BHXH (%)",
  bhytRate: "BHYT (%)",
  bhtnRate: "BHTN (%)",
  pitFreeAmount: "Giảm trừ gia cảnh",
  overtimeRate: "Hệ số OT ngày thường",
  otWeekendRate: "Hệ số OT cuối tuần",
  otHolidayRate: "Hệ số OT ngày lễ",
  standardWorkHours: "Giờ làm chuẩn",
  name: "Tên vùng",
  lat: "Vĩ độ",
  lng: "Kinh độ",
  radiusM: "Bán kính (m)",
  password: "Mật khẩu (đã che)",
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fmtValue(v: string | null): string {
  if (v === null || v === "") return "(trống)"
  return v
}

export function AuditLogSection() {
  const [items, setItems] = useState<AuditLogEntry[] | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [section, setSection] = useState<string>("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (p: number, sec: string) => {
    setBusy(true)
    try {
      const res = await settingsApi.getAuditLog({ page: p, limit: 20, section: sec || undefined })
      setItems(res.items)
      setTotal(res.total)
      setPageCount(Math.max(1, res.pageCount))
      setPage(res.page)
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load(1, section)
  }, [section, load])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <History className="size-4 text-agent-teal" /> Nhật Ký Thay Đổi Cài Đặt
            </CardTitle>
            <CardDescription>
              Mọi thay đổi cấu hình được ghi tự động: ai sửa, field nào, giá trị cũ → mới. Chỉ xem, không sửa/xóa.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Tất cả mục</option>
              {Object.entries(SECTION_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => load(page, section)} disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Tải Lại
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!items ? (
          <div className="flex h-16 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tải nhật ký...
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có thay đổi nào được ghi nhận.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Mục</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Giá trị cũ → mới</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const sec = SECTION_LABELS[it.section] ?? { label: it.section, variant: "default" as const }
                  return (
                    <TableRow key={it.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmt(it.createdAt)}</TableCell>
                      <TableCell className="text-xs text-foreground">{it.adminEmail}</TableCell>
                      <TableCell>
                        <Badge variant={sec.variant}>{sec.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-foreground">{FIELD_LABELS[it.field] ?? it.field}</TableCell>
                      <TableCell className="text-xs">
                        <span className="text-agent-coral line-through decoration-agent-coral/60">{fmtValue(it.oldValue)}</span>
                        <span className="mx-1.5 text-muted-foreground">→</span>
                        <span className="font-semibold text-emerald-400">{fmtValue(it.newValue)}</span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Trang {page}/{pageCount} — {total} bản ghi
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={page <= 1 || busy}
                  onClick={() => load(page - 1, section)}
                >
                  <ChevronLeft className="size-3.5" /> Trước
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={page >= pageCount || busy}
                  onClick={() => load(page + 1, section)}
                >
                  Sau <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
