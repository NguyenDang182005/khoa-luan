"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AttendanceRecord } from "@/lib/api/attendance.api"
import { todayVN } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface MonthlyTimesheetStripProps {
  employeeId: string
  month: number
  year: number
  onMonthChange: (month: number, year: number) => void
  attendanceRecords: AttendanceRecord[]
  loading?: boolean
}

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
const DOW_LABEL = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"]

type BadgeVariant = "success" | "warning" | "info" | "destructive" | "secondary" | "default"

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "--:--"
  try { return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) }
  catch { return "--:--" }
}

function formatHours(h: number): string {
  return `${h.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} h`
}

function creditOfRecord(r: AttendanceRecord): number {
  if (r.status === "ABSENT") return 0
  if (r.dayType && r.dayType !== "NORMAL") return 0
  if (typeof r.workDays === "number") {
    // ON_LEAVE (nghỉ phép có duyệt) lưu workDays = 0 trong bảng attendance nhưng tính là 1 ngày nghỉ có phép trên lịch
    if (r.status === "ON_LEAVE") return 1
    return r.workDays
  }
  // Mới check-in mà chưa check-out → chưa chốt công (0 công)
  if (r.checkIn && !r.checkOut) return 0
  if (["PRESENT", "REMOTE", "LATE", "ON_LEAVE"].includes(r.status)) return 1
  if (r.status === "HALF_DAY") return 0.5
  return 0
}

// Trả về màu dot + nhãn trạng thái
function getStatus(
  record: AttendanceRecord | null,
  isWeekend: boolean,
  isFuture: boolean,
  isToday = false,
): {
  dot: string | null; label: string; credit: string; badge: BadgeVariant
} {
  if (isWeekend || isFuture) return { dot: null, label: "", credit: "", badge: "secondary" }
  // Hôm nay chưa có bản ghi = chưa chấm công, chưa phải vắng
  if (!record && isToday) return { dot: null, label: "Chưa chấm công", credit: "", badge: "secondary" }
  if (!record) return { dot: "bg-danger", label: "Vắng", credit: "V", badge: "destructive" }
  const inProgress = Boolean(record.checkIn && !record.checkOut)
  const creditNum = creditOfRecord(record)
  const creditStr = creditNum.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 4 })
  switch (record.status) {
    case "PRESENT":
      if (inProgress) {
        return {
          dot: "bg-info",
          label: "Đang làm việc (chưa check-out)",
          credit: creditStr,
          badge: "info",
        }
      }
      if (creditNum <= 0) {
        return {
          dot: "bg-muted-foreground",
          label: "Chưa phát sinh công (0 công)",
          credit: creditStr,
          badge: "secondary",
        }
      }
      if (creditNum < 1) {
        return {
          dot: "bg-info",
          label: `Công lẻ (${creditStr} công)`,
          credit: creditStr,
          badge: "info",
        }
      }
      return {
        dot: "bg-success",
        label: "Đủ công",
        credit: creditStr,
        badge: "success",
      }
    case "LATE":
      return {
        dot: creditNum <= 0 && !inProgress ? "bg-muted-foreground" : "bg-warning",
        label: inProgress
          ? "Đi muộn (chưa check-out)"
          : creditNum <= 0
            ? "Đi muộn (0 công)"
            : creditNum < 1
              ? `Đi muộn (${creditStr} công)`
              : "Đi muộn (Đủ công)",
        credit: creditStr,
        badge: creditNum <= 0 && !inProgress ? "secondary" : "warning",
      }
    case "REMOTE":
      return {
        dot: "bg-primary",
        label: inProgress ? "Làm từ xa (chưa check-out)" : "Làm từ xa",
        credit: creditStr,
        badge: "default",
      }
    case "HALF_DAY":
      return { dot: "bg-muted-foreground", label: "Nửa ngày", credit: creditStr, badge: "secondary" }
    case "ON_LEAVE":
      return { dot: "bg-info", label: "Nghỉ phép", credit: "P", badge: "info" }
    case "ABSENT":
      return { dot: "bg-danger", label: "Vắng", credit: "V", badge: "destructive" }
    default:
      return { dot: null, label: "", credit: "", badge: "secondary" }
  }
}

const LEGEND = [
  { dot: "bg-success", label: "Đủ công" },
  { dot: "bg-warning", label: "Đi muộn" },
  { dot: "bg-info", label: "Nghỉ phép" },
  { dot: "bg-primary", label: "Làm từ xa" },
  { dot: "bg-muted-foreground", label: "Nửa ngày" },
  { dot: "bg-danger", label: "Vắng" },
]

// ── Popover chi tiết ─────────────────────────────────────
function DayDetail({
  day, month, year, dow, record, isWeekend, isFuture, isToday,
  status,
}: {
  day: number; month: number; year: number; dow: number
  record: AttendanceRecord | null; isWeekend: boolean; isFuture: boolean; isToday: boolean
  status: ReturnType<typeof getStatus>
}) {
  return (
    <div>
      <p className="text-caption text-muted-foreground">{DOW_LABEL[dow]}</p>
      <p className="text-body font-semibold tabular">
        {String(day).padStart(2, "0")}/{String(month).padStart(2, "0")}/{year}
      </p>
      {isWeekend ? (
        <p className="mt-1 text-body-sm text-muted-foreground">Cuối tuần.</p>
      ) : isFuture ? (
        <p className="mt-1 text-body-sm text-muted-foreground">Chưa đến ngày.</p>
      ) : !record && isToday ? (
        <>
          <Badge variant="secondary" className="mt-2">Chưa chấm công</Badge>
          <p className="mt-2 text-body-sm text-muted-foreground">Hôm nay bạn chưa check-in.</p>
        </>
      ) : !record ? (
        <>
          <Badge variant="destructive" className="mt-2">
            <span className="size-1.5 rounded-full bg-danger" />
            Vắng mặt không phép
          </Badge>
          <p className="mt-2 text-body-sm text-muted-foreground">Không có dữ liệu chấm công.</p>
        </>
      ) : (
        <>
          {status.label && (
            <Badge variant={status.badge} className="mt-2">
              {status.dot && <span className={cn("size-1.5 rounded-full", status.dot)} />}
              {status.label}
            </Badge>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-2 text-body-sm">
            <div>
              <dt className="text-caption text-muted-foreground">Giờ vào</dt>
              <dd className="font-medium tabular">{formatTime(record.checkIn)}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Giờ ra</dt>
              <dd className="font-medium tabular">{formatTime(record.checkOut)}</dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Số công</dt>
              <dd className="font-medium tabular">
                {creditOfRecord(record).toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 4 })} công
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Tổng giờ</dt>
              <dd className="font-medium tabular">
                {typeof record.workHours === "number" ? formatHours(record.workHours) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">Tăng ca</dt>
              <dd className={cn("font-medium tabular", (record.overtime ?? 0) > 0 && "text-success")}>
                {(record.overtime ?? 0) > 0 ? `+${formatHours(record.overtime!)}` : "—"}
              </dd>
            </div>
          </dl>
          {record.location && (
            <p className="mt-2 flex items-start gap-1.5 text-caption text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 break-words">{record.location}</span>
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
export function MonthlyTimesheetStrip({
  month, year, onMonthChange, attendanceRecords, loading = false,
}: MonthlyTimesheetStripProps) {
  const today = todayVN()
  const daysInMonth = new Date(year, month, 0).getDate()

  const recordMap = React.useMemo(() => {
    const m = new Map<string, AttendanceRecord>()
    for (const r of attendanceRecords) if (r.date) m.set(r.date.slice(0, 10), r)
    return m
  }, [attendanceRecords])

  // Mon-based first day offset
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7

  // Stats
  const stats = React.useMemo(() => {
    let credits = 0, late = 0, absent = 0, workdays = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay()
      // #18: cuối tuần không phải ngày làm việc — không tính vắng khi không có bản ghi.
      if (dow !== 0 && dow !== 6) workdays++
      const ds = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`
      if (ds > today) continue
      const r = recordMap.get(ds)
      if (!r) { if (dow !== 0 && dow !== 6 && ds !== today) absent++; continue }
      credits += creditOfRecord(r)
      if (r.status === "LATE") late++
      if (r.status === "ABSENT") absent++
    }
    return { credits, late, absent, workdays }
  }, [daysInMonth, year, month, recordMap, today])

  const prevMonth = () => month === 1 ? onMonthChange(12, year - 1) : onMonthChange(month - 1, year)
  const nextMonth = () => month === 12 ? onMonthChange(1, year + 1) : onMonthChange(month + 1, year)

  return (
    <div className="flex w-full min-w-0 flex-col rounded-lg border border-border bg-card p-5 sm:p-6">
      {/* ── TITLE + NAV ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h3 font-semibold text-foreground">
            Bảng công tháng {month}/{year}
          </h2>
          <p className="text-body-sm text-muted-foreground">Nhấn vào ngày để xem chi tiết</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon-sm" onClick={prevMonth} aria-label="Tháng trước">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={nextMonth} aria-label="Tháng sau">
            <ChevronRight />
          </Button>
        </div>
      </div>

      {/* ── WEEKDAY HEADER ── */}
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-caption font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">{d}</span>
        ))}
      </div>

      {/* ── CALENDAR GRID ── */}
      {loading ? (
        <div className="mt-1 grid grid-cols-7 gap-1" aria-busy="true" aria-label="Đang tải bảng công">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square min-h-11 rounded-md" />
          ))}
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: firstDow }).map((_, idx) => (
            <span key={`o-${idx}`} aria-hidden="true" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const day = idx + 1
            const dow = new Date(year, month - 1, day).getDay()
            const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`
            const isToday   = dateStr === today
            const isFuture  = dateStr > today
            const isWeekend = dow === 0 || dow === 6
            const record    = recordMap.get(dateStr) ?? null
            const st        = getStatus(record, isWeekend, isFuture, isToday)
            const ariaStatus = st.label ? `: ${st.label}` : isWeekend ? ": cuối tuần" : isFuture ? ": chưa đến ngày" : ""

            return (
              <Popover key={day}>
                <PopoverTrigger
                  aria-label={`Ngày ${day}/${month}/${year}${isToday ? " (hôm nay)" : ""}${ariaStatus}`}
                  className={cn(
                    "flex aspect-square min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-md text-body-sm tabular outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20",
                    isToday
                      ? "font-semibold text-primary ring-2 ring-inset ring-primary"
                      : isWeekend || isFuture
                        ? "text-subtle-foreground"
                        : "text-foreground",
                  )}
                >
                  {day}
                  <span className={cn("size-1.5 rounded-full", st.dot && !isFuture ? st.dot : "bg-transparent")} />
                </PopoverTrigger>

                <PopoverContent side="bottom" align="center" sideOffset={6} className="w-64 p-4">
                  <DayDetail
                    day={day} month={month} year={year} dow={dow}
                    record={record} isWeekend={isWeekend} isFuture={isFuture} isToday={isToday}
                    status={st}
                  />
                </PopoverContent>
              </Popover>
            )
          })}
        </div>
      )}

      {/* ── LEGEND ── */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-caption text-muted-foreground">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", l.dot)} />
            {l.label}
          </span>
        ))}
      </div>

      {/* ── SUMMARY ── */}
      <dl className="mt-4 grid grid-cols-3 border-t border-border-subtle pt-4 text-center">
        <div>
          <dt className="text-caption text-muted-foreground">Ngày công</dt>
          <dd className="text-h3 font-semibold tabular">
            {stats.credits.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 4 })}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Đi muộn</dt>
          <dd className="text-h3 font-semibold tabular">{stats.late}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Vắng</dt>
          <dd className="text-h3 font-semibold tabular">{stats.absent}</dd>
        </div>
      </dl>
    </div>
  )
}
