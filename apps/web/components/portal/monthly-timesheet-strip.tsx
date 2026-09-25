"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Clock, MapPin, Coffee, AlertCircle, Calendar } from "lucide-react"
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
const DOW_LABEL = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"]

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "--:--"
  try { return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) }
  catch { return "--:--" }
}

// Trả về màu dot + nhãn trạng thái
function getStatus(status: string | undefined, hasRecord: boolean, isWeekend: boolean, isFuture: boolean) {
  if (isWeekend || isFuture || !hasRecord && isFuture) return { dot: null, label: "", credit: "" }
  if (!hasRecord) return { dot: "bg-rose-500",    label: "Vắng",       credit: "V"   }
  switch (status) {
    case "PRESENT":  return { dot: "bg-emerald-500", label: "Đủ công",   credit: "1.0" }
    case "LATE":     return { dot: "bg-amber-500",   label: "Đi muộn",  credit: "1.0" }
    case "REMOTE":   return { dot: "bg-sky-500",     label: "Remote",    credit: "1.0" }
    case "HALF_DAY": return { dot: "bg-amber-400",   label: "Nửa ngày", credit: "0.5" }
    case "ON_LEAVE": return { dot: "bg-teal-500",    label: "Nghỉ phép", credit: "P"   }
    case "ABSENT":   return { dot: "bg-rose-500",    label: "Vắng",      credit: "V"   }
    default:         return { dot: null,             label: "",          credit: ""    }
  }
}

// ── Popover chi tiết ─────────────────────────────────────
function DayDetail({
  day, month, year, dow, record, isWeekend, isFuture,
  status,
}: {
  day: number; month: number; year: number; dow: number
  record: AttendanceRecord | null; isWeekend: boolean; isFuture: boolean
  status: ReturnType<typeof getStatus>
}) {
  return (
    <div className="w-48 space-y-2">
      <div>
        <p className="text-[11px] text-muted-foreground">{DOW_LABEL[dow]}</p>
        <p className="text-sm font-semibold">
          {String(day).padStart(2, "0")}/{String(month).padStart(2, "0")}/{year}
        </p>
      </div>
      <Separator />
      {isWeekend ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Coffee className="size-3 shrink-0" /> Cuối tuần
        </p>
      ) : isFuture ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Calendar className="size-3 shrink-0" /> Chưa có dữ liệu
        </p>
      ) : !record ? (
        <p className="text-xs text-rose-500 flex items-center gap-1.5">
          <AlertCircle className="size-3 shrink-0" /> Vắng mặt không phép
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground flex items-center gap-1 mb-0.5">
              <Clock className="size-2.5" /> Vào
            </p>
            <p className="font-mono font-semibold tabular-nums">{formatTime(record.checkIn)}</p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1 mb-0.5">
              <Clock className="size-2.5" /> Ra
            </p>
            <p className="font-mono font-semibold tabular-nums">{formatTime(record.checkOut)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Tổng giờ</p>
            <p className="font-mono font-semibold">
              {typeof record.workHours === "number" ? `${record.workHours.toFixed(1)}h` : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Tăng ca</p>
            <p className={cn("font-mono font-semibold", (record.overtime ?? 0) > 0 ? "text-emerald-500" : "")}>
              {(record.overtime ?? 0) > 0 ? `+${record.overtime!.toFixed(1)}h` : "—"}
            </p>
          </div>
          {record.location && (
            <div className="col-span-2 flex items-start gap-1 text-muted-foreground">
              <MapPin className="size-2.5 mt-0.5 shrink-0" />
              <span className="text-[10px] truncate">{record.location}</span>
            </div>
          )}
          {status.label && (
            <div className="col-span-2 flex items-center gap-1.5">
              {status.dot && <span className={cn("size-1.5 rounded-full", status.dot)} />}
              <span className="font-medium">{status.label}</span>
            </div>
          )}
        </div>
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
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7

  // Stats
  const stats = React.useMemo(() => {
    let credits = 0, late = 0, absent = 0, workdays = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay()
      if (dow !== 0 && dow !== 6) workdays++
      const ds = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`
      if (ds > today) continue
      const r = recordMap.get(ds)
      if (!r) { absent++; continue }
      if (["PRESENT","REMOTE","LATE","ON_LEAVE"].includes(r.status)) credits += 1
      else if (r.status === "HALF_DAY") credits += 0.5
      if (r.status === "LATE") late++
      if (r.status === "ABSENT") absent++
    }
    return { credits, late, absent, workdays }
  }, [daysInMonth, year, month, recordMap, today])

  const prevMonth = () => month === 1 ? onMonthChange(12, year - 1) : onMonthChange(month - 1, year)
  const nextMonth = () => month === 12 ? onMonthChange(1, year + 1) : onMonthChange(month + 1, year)

  // Prev/next month day numbers for empty cells
  const prevMonthDays = new Date(year, month - 1, 0).getDate()

  return (
    <div className="w-[400px] h-full rounded-2xl bg-card p-4 shadow-sm border border-border/50 flex flex-col">
      {/* ── TITLE + NAV ── */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-foreground tracking-tight">
          Tháng {month}, {year}
        </h3>
        <div className="flex items-center gap-0.5">
          <button
            onClick={prevMonth}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={nextMonth}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div className="flex items-center gap-3 mb-3 text-xs">
        <span className="flex items-center gap-1 text-foreground/80">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span>{stats.credits} Đủ</span>
        </span>
        <span className="flex items-center gap-1 text-foreground/80">
          <span className="size-2 rounded-full bg-amber-500" />
          <span>{stats.late} Muộn</span>
        </span>
        <span className="flex items-center gap-1 text-foreground/80">
          <span className="size-2 rounded-full bg-rose-500" />
          <span>{stats.absent} Vắng</span>
        </span>
      </div>

      {/* ── WEEKDAY HEADER ── */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className={cn(
            "text-center text-[11px] font-medium py-1",
            i >= 5 ? "text-rose-400/80 dark:text-rose-400/60" : "text-muted-foreground/60"
          )}>
            {d}
          </div>
        ))}
      </div>

      {/* ── CALENDAR GRID ── */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-7 flex-1 content-start">
          {Array.from({ length: totalCells }).map((_, idx) => {
            const day = idx - firstDow + 1
            const isOtherMonth = day < 1 || day > daysInMonth

            // Số ngày tháng khác
            if (isOtherMonth) {
              const otherDay = day < 1
                ? prevMonthDays + day
                : day - daysInMonth
              return (
                <div key={`o-${idx}`} className="flex flex-col items-center py-1.5 gap-1">
                  <span className="text-sm text-muted-foreground/25 w-7 text-center">{otherDay}</span>
                  <span className="h-1.5" />
                </div>
              )
            }

            const dow = new Date(year, month - 1, day).getDay()
            const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`
            const isToday   = dateStr === today
            const isFuture  = dateStr > today
            const isWeekend = dow === 0 || dow === 6
            const record    = recordMap.get(dateStr) ?? null
            const st        = getStatus(record?.status, !!record, isWeekend, isFuture)

            return (
              <Popover key={day}>
                <PopoverTrigger
                  className={cn(
                    "flex flex-col items-center py-1.5 gap-1 rounded-lg outline-none",
                    "transition-colors hover:bg-muted/40 cursor-pointer",
                    isFuture && "opacity-40 cursor-default hover:bg-transparent",
                  )}
                >
                  {/* Số ngày */}
                  <span className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm leading-none tabular-nums transition-colors",
                    isToday
                      ? "bg-foreground text-background font-bold"
                      : isWeekend
                        ? "text-rose-400/70 dark:text-rose-400/50 font-medium"
                        : "text-foreground/85 font-medium hover:text-foreground",
                  )}>
                    {day}
                  </span>

                  {/* Dot trạng thái */}
                  <span className="h-1.5 flex items-center justify-center">
                    {st.dot && !isFuture && (
                      <span className={cn("size-1.5 rounded-full", st.dot)} />
                    )}
                  </span>
                </PopoverTrigger>

                <PopoverContent side="top" align="center" sideOffset={4} className="p-3 w-auto">
                  <DayDetail
                    day={day} month={month} year={year} dow={dow}
                    record={record} isWeekend={isWeekend} isFuture={isFuture}
                    status={st}
                  />
                </PopoverContent>
              </Popover>
            )
          })}
        </div>
      )}
    </div>
  )
}
