"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { leaveApi } from "@/lib/api/leave.api"
import { payrollApi } from "@/lib/api/payroll.api"
import { attendanceApi, haversineMeters } from "@/lib/api/attendance.api"
import type { AttendanceRecord } from "@/lib/api/attendance.api"
import { onboardingApi } from "@/lib/api/onboarding.api"
import type { MyOnboardingItem } from "@/lib/api/onboarding.api"
import { agentsApi } from "@/lib/api/agents.api"
import type { ChatHistoryMessage as AgentHistoryMessage } from "@/lib/api/agents.api"
import { getChat, patchChat } from "@/lib/chat/chat-store"
import type { LeaveRequest } from "@/lib/schemas/leave.schema"
import { LeaveCreateSchema, LeaveTypeEnum } from "@/lib/schemas/leave.schema"
import type { PayrollRecord } from "@/lib/schemas/payroll.schema"
import * as React from "react"
import {
  Clock,
  CalendarCheck,
  MapPin,
  LocateFixed,
  Check,
  CircleCheck,
  CircleX,
  CircleAlert,
  Hourglass,
  Ban,
  Sparkles,
  X,
  Wallet,
  Loader2,
  AlertTriangle,
  LogIn,
  LogOut,
  Plus,
  ArrowRight,
  ChevronDown,
  Inbox,
  Send,
  RotateCcw,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { RichText } from "@/components/ui/rich-text"
import { todayVN, leaveTypeLabel, requestDurationLabel, payrollStatusLabel, vnd, fmtVNDate } from "@/lib/utils"
import { settingsApi } from "@/lib/api/settings.api"
import { MonthlyTimesheetStrip } from "@/components/portal/monthly-timesheet-strip"

// Tọa độ văn phòng: ưu tiên cấu hình trong DB (Trang Cài Đặt → Geofence),
// fallback qua biến env NEXT_PUBLIC_OFFICE_* rồi mới đến mặc định.
const OFFICE_FALLBACK = {
  name: process.env.NEXT_PUBLIC_OFFICE_NAME ?? "Văn phòng công ty",
  lat: Number(process.env.NEXT_PUBLIC_OFFICE_LAT ?? 10.7951),
  lng: Number(process.env.NEXT_PUBLIC_OFFICE_LNG ?? 106.7218),
  radiusM: Number(process.env.NEXT_PUBLIC_OFFICE_RADIUS_M ?? 200),
}
// Mock tạm: bỏ kiểm tra bán kính và cho check-in cả khi không lấy được GPS (khớp ATTENDANCE_GEOFENCE_MOCK ở API)
const GEOFENCE_MOCK = process.env.NEXT_PUBLIC_GEOFENCE_MOCK === "true"

const LEAVE_TYPE_OPTIONS = [
  LeaveTypeEnum.enum.ANNUAL,
  LeaveTypeEnum.enum.SICK,
  LeaveTypeEnum.enum.UNPAID,
  LeaveTypeEnum.enum.EMERGENCY,
  LeaveTypeEnum.enum.OT,
  LeaveTypeEnum.enum.LATE_PERMISSION,
  LeaveTypeEnum.enum.BUSINESS_TRIP,
  LeaveTypeEnum.enum.OTHER,
] as const

interface ChatEntry {
  role: "user" | "bot"
  text: string
  latency?: string
}

/** Q16/Q17 — Trợ lý HR portal dùng chung cơ chế session (key riêng cho bề mặt portal) */
const PORTAL_CHAT_KEY = "portal:HR_QA"
const PORTAL_GREETING: ChatEntry = {
  role: "bot",
  text: "Xin chào! Tôi là Trợ lý HR AI nội bộ. Bạn có câu hỏi nào về chính sách nhân sự hoặc ngày phép không?",
}

function timeHM(iso: string | null | undefined): string {
  if (!iso) return "--:--"
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
}

function formatDateVN(dateStr: string | null | undefined): string {
  if (!dateStr) return "--/--/----"
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr.slice(0, 10)
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return dateStr.slice(0, 10)
  }
}

export function EmployeePortalView() {
  const { user } = useAuth()
  const employeeId = user?.employee?.id ?? ""
  const empName = user?.employee?.fullName ?? ""
  const empCode = user?.employee?.employeeCode ?? ""
  const deptName = user?.employee?.departmentName ?? ""
  const posTitle = user?.employee?.positionTitle ?? ""

  const nowDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(nowDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(nowDate.getFullYear())
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceRecord[]>([])
  const [timesheetLoading, setTimesheetLoading] = useState(false)

  const [leaveBalance, setLeaveBalance] = useState<{ remainingDays: number; totalDays: number } | null>(null)
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([])
  const [payslip, setPayslip] = useState<PayrollRecord | null>(null)
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null)
  const [onboarding, setOnboarding] = useState<{ completed: number; total: number; items: MyOnboardingItem[] } | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  // Vùng chấm công từ DB (Trang Cài Đặt cấu hình) — fallback env/mặc định nếu chưa tải được
  const [office, setOffice] = useState(OFFICE_FALLBACK)

  // GPS check-in
  const [gpsBusy, setGpsBusy] = useState(false)
  const [gpsMessage, setGpsMessage] = useState<string | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([PORTAL_GREETING])
  const [chatInput, setChatInput] = useState("")
  const [isChatting, setIsChatting] = useState(false)
  const [floatingChatOpen, setFloatingChatOpen] = useState(false)

  /** Q16(c) — commit chat vào store (sống qua điều hướng view) + state render */
  const commitChat = (updater: (prev: ChatEntry[]) => ChatEntry[]) => {
    setChatMessages((prev) => {
      const next = updater(prev)
      patchChat<ChatEntry>(PORTAL_CHAT_KEY, { messages: next })
      return next
    })
  }

  /** Q16(c) — rehydrate lịch sử HR_QA từ DB (lần đầu mở portal trong phiên) */
  useEffect(() => {
    const stored = getChat<ChatEntry>(PORTAL_CHAT_KEY)
    if (stored.hydrated) {
      setChatMessages(stored.messages.length > 0 ? [...(stored.messages as ChatEntry[])] : [PORTAL_GREETING])
      return
    }
    let cancelled = false
    agentsApi
      .getLatestSession("HR_QA")
      .then((session) => {
        if (cancelled) return
        const msgs: ChatEntry[] = (session?.messages ?? []).map((m: AgentHistoryMessage) => ({
          role: m.role === "user" ? ("user" as const) : ("bot" as const),
          text: m.content,
        }))
        patchChat<ChatEntry>(PORTAL_CHAT_KEY, {
          hydrated: true,
          sessionId: session?.id,
          messages: msgs,
        })
        setChatMessages(msgs.length > 0 ? msgs : [PORTAL_GREETING])
      })
      .catch(() => {
        if (!cancelled) patchChat<ChatEntry>(PORTAL_CHAT_KEY, { hydrated: true })
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Q19(i1) — "Phiên mới" cho trợ lý HR */
  const handlePortalNewSession = async () => {
    try {
      const session = await agentsApi.renewSession("HR_QA")
      patchChat<ChatEntry>(PORTAL_CHAT_KEY, {
        hydrated: true,
        sessionId: session.id,
        messages: [PORTAL_GREETING],
      })
      setChatMessages([PORTAL_GREETING])
    } catch (e) {
      console.error(e)
    }
  }

  // Leave form
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveType, setLeaveType] = useState<string>(LeaveTypeEnum.enum.ANNUAL)
  const [startDate, setStartDate] = useState(todayVN())
  const [endDate, setEndDate] = useState(todayVN())
  const [otHours, setOtHours] = useState<number | "">("")
  const [otDate, setOtDate] = useState<string>(todayVN())
  const [reason, setReason] = useState("")
  const [leaveErrors, setLeaveErrors] = useState<Record<string, string>>({})
  const [leaveSubmitting, setLeaveSubmitting] = useState(false)
  const [leaveSuccess, setLeaveSuccess] = useState<string | null>(null)
  const [showPayslipDetails, setShowPayslipDetails] = useState(false)

  const today = todayVN()

  const loadAll = useCallback(async (m = selectedMonth, y = selectedYear) => {
    if (!employeeId) return
    setDataLoading(true)
    setTimesheetLoading(true)
    // Vùng chấm công trong DB (HR_ADMIN cấu hình ở trang Cài Đặt)
    settingsApi
      .getGeofence()
      .then((g) => setOffice({ name: g.name, lat: g.lat, lng: g.lng, radiusM: g.radiusM }))
      .catch(() => {/* giữ fallback */})
    const [balanceRes, leavesRes, slipRes, attendanceRes, onboardingRes] = await Promise.allSettled([
      leaveApi.getBalance(employeeId, y),
      leaveApi.list({ employeeId }),
      payrollApi.getMyPayslip(m, y),
      attendanceApi.listByEmployee(employeeId, m, y),
      onboardingApi.getMy(),
    ])
    if (balanceRes.status === "fulfilled") {
      setLeaveBalance({ remainingDays: balanceRes.value.remainingDays, totalDays: balanceRes.value.totalDays })
    }
    if (leavesRes.status === "fulfilled") setLeaveHistory(leavesRes.value)
    if (slipRes.status === "fulfilled") {
      setPayslip(slipRes.value)
    } else {
      setPayslip(null)
    }
    if (attendanceRes.status === "fulfilled") {
      const records = attendanceRes.value
      setMonthlyAttendance(records)
      const record = records.find((r) => (r.date ?? "").slice(0, 10) === today) ?? null
      setTodayRecord(record)
    }
    if (onboardingRes.status === "fulfilled") {
      const items = onboardingRes.value.items
      setOnboarding({
        items,
        completed: items.filter((i) => i.isCompleted).length,
        total: items.length,
      })
    }
    setDataLoading(false)
    setTimesheetLoading(false)
  }, [employeeId, today, selectedMonth, selectedYear])

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
    loadAll(newMonth, newYear)
  }

  useEffect(() => {
    loadAll(selectedMonth, selectedYear)
  }, [loadAll, selectedMonth, selectedYear])

  // ── GPS Check-in / Check-out ────────────────────────────────────────────
  const getPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        reject(new Error("Thiết bị không hỗ trợ định vị GPS."))
        return
      }
      navigator.geolocation.getCurrentPosition(resolve, (err) => reject(new Error("Không lấy được vị trí GPS: " + err.message)), {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      })
    })

  const handleCheckIn = async () => {
    setGpsError(null)
    setGpsMessage(null)
    setGpsBusy(true)
    try {
      if (GEOFENCE_MOCK) {
        const pos = await getPosition().catch(() => null)
        await attendanceApi.checkIn(pos?.coords.latitude, pos?.coords.longitude)
        setGpsMessage("Check-in thành công!")
        await loadAll()
        return
      }
      const pos = await getPosition()
      const distance = Math.round(haversineMeters(pos.coords.latitude, pos.coords.longitude, office.lat, office.lng))
      if (distance > office.radiusM) {
        setGpsError(`Bạn đang cách ${office.name} khoảng ${distance}m (giới hạn ${office.radiusM}m). Vui lòng đến gần hơn để check-in.`)
        return
      }
      await attendanceApi.checkIn(pos.coords.latitude, pos.coords.longitude)
      setGpsMessage("Check-in thành công!")
      await loadAll()
    } catch (e: unknown) {
      const axiosMsg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setGpsError(axiosMsg ?? (e instanceof Error ? e.message : "Check-in thất bại."))
    } finally {
      setGpsBusy(false)
    }
  }

  const handleCheckOut = async () => {
    setGpsError(null)
    setGpsMessage(null)
    setGpsBusy(true)
    try {
      await attendanceApi.checkOut()
      setGpsMessage("Check-out thành công!")
      await loadAll()
    } catch (e: unknown) {
      const axiosMsg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setGpsError(axiosMsg ?? (e instanceof Error ? e.message : "Check-out thất bại."))
    } finally {
      setGpsBusy(false)
    }
  }

  // ── Chat qua NestJS (JWT) ───────────────────────────────────────────────
  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatting) return
    const msg = chatInput.trim()
    commitChat((prev) => [...prev, { role: "user", text: msg }])
    setChatInput("")
    setIsChatting(true)
    const startTime = Date.now()
    try {
      const stored = getChat<ChatEntry>(PORTAL_CHAT_KEY)
      const result = await agentsApi.chat(msg, { sessionId: stored.sessionId, sessionType: "HR_QA" })
      if (result.sessionId && result.sessionId !== stored.sessionId) {
        patchChat<ChatEntry>(PORTAL_CHAT_KEY, { sessionId: result.sessionId })
      }
      commitChat((prev) => [
        ...prev,
        { role: "bot", text: result.answer, latency: String(result.latencyMs || Date.now() - startTime) },
      ])
    } catch (e: unknown) {
      commitChat((prev) => [
        ...prev,
        { role: "bot", text: e instanceof Error ? e.message : "Xin lỗi, có lỗi kết nối AI." },
      ])
    } finally {
      setIsChatting(false)
    }
  }

  // ── Tạo đơn nghỉ phép (validate Zod + gọi API thật) ─────────────────────
  const handleLeaveSubmit = async () => {
    if (!employeeId) return
    setLeaveErrors({})
    setLeaveSuccess(null)
    const isOT = leaveType === LeaveTypeEnum.enum.OT
    const parsed = LeaveCreateSchema.safeParse({
      employeeId,
      type: leaveType,
      startDate: isOT ? (otDate || today) : startDate,
      endDate: isOT ? (otDate || today) : endDate,
      reason,
      overtimeHours: isOT && otHours !== "" ? Number(otHours) : undefined,
      overtimeDate: isOT ? (otDate || today) : undefined,
    })
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form")
        if (!errs[key]) errs[key] = issue.message
      }
      setLeaveErrors(errs)
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('#leave-form [aria-invalid="true"]')?.focus(),
      )
      return
    }
    setLeaveSubmitting(true)
    try {
      await leaveApi.create(parsed.data)
      setShowLeaveModal(false)
      setReason("")
      setLeaveSuccess(`Đã gửi đơn ${leaveTypeLabel(leaveType)}. Đơn đang chờ quản lý duyệt.`)
      await loadAll()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setLeaveErrors({ form: Array.isArray(msg) ? msg.join(", ") : msg ?? "Gửi đơn thất bại. Vui lòng thử lại." })
    } finally {
      setLeaveSubmitting(false)
    }
  }

  const gross = payslip ? payslip.baseSalary + payslip.allowances + payslip.overtimePay + payslip.bonus : 0

  // ── Hiển thị (chỉ phục vụ giao diện) ────────────────────────────────────
  const payslipRef = React.useRef<HTMLDivElement>(null)
  const shortName = empName.trim().split(/\s+/).filter(Boolean).pop() ?? ""
  const todayRaw = nowDate.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
  const todayLabel = todayRaw.charAt(0).toLocaleUpperCase("vi-VN") + todayRaw.slice(1)
  const usedDays = leaveBalance ? Math.max(0, leaveBalance.totalDays - leaveBalance.remainingDays) : 0
  const remainingPct = leaveBalance
    ? Math.min(100, (leaveBalance.remainingDays / Math.max(1, leaveBalance.totalDays)) * 100)
    : 0
  const requestedDays = (() => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
  })()
  const pendingCount = leaveHistory.filter((l) => l.status === "PENDING").length
  const onboardingPct = onboarding && onboarding.total > 0 ? Math.round((onboarding.completed / onboarding.total) * 100) : 0
  const payslipPeriod = payslip
    ? `${String(payslip.month).padStart(2, "0")}/${payslip.year}`
    : `${String(selectedMonth).padStart(2, "0")}/${selectedYear}`

  const openLeaveModal = () => { setShowLeaveModal(true); setLeaveErrors({}); setLeaveSuccess(null) }
  const openPayslipDetails = () => {
    setShowPayslipDetails(true)
    requestAnimationFrame(() => payslipRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return (
    <div className="relative flex flex-col gap-6 pb-28">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 font-semibold text-foreground">Xin chào, {shortName || "bạn"}</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {posTitle || "—"}
            {deptName ? ` • ${deptName.startsWith("Phòng") ? deptName : `Phòng ${deptName}`}` : ""}
            {" • "}
            <span className="font-mono text-body-sm">{empCode || "—"}</span>
          </p>
        </div>
        <Badge variant="ai" className="h-8 gap-1.5 px-3 text-body-sm">
          <span className="size-2 animate-pulse rounded-full bg-ai" />
          Trợ lý AI đang trực tuyến
        </Badge>
      </div>

      {leaveSuccess && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-success/20 bg-success-tint px-4 py-3 text-body-sm text-success">
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
          {leaveSuccess}
        </div>
      )}

      {/* Row 1: 3 thẻ thao tác nhanh */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">
        {/* Chấm công GPS — dữ liệu thật từ attendance API */}
        <Card className="flex flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-1 basis-44 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
                <MapPin className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-body font-semibold text-foreground">Chấm công GPS</h2>
                <p className="text-caption text-muted-foreground">{todayLabel}</p>
              </div>
            </div>
            {!todayRecord?.checkIn ? (
              <Badge variant="warning"><Clock />Chưa check-in</Badge>
            ) : !todayRecord.checkOut ? (
              <Badge variant="success"><CircleCheck />Đã check-in</Badge>
            ) : (
              <Badge variant="success"><CircleCheck />Hoàn tất ngày công</Badge>
            )}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border-subtle bg-sunken p-3">
              <dt className="text-caption text-muted-foreground">Giờ vào</dt>
              <dd className="mt-0.5 text-h2 font-semibold tabular text-foreground">{timeHM(todayRecord?.checkIn)}</dd>
            </div>
            <div className="rounded-md border border-border-subtle bg-sunken p-3">
              <dt className="text-caption text-muted-foreground">Giờ ra</dt>
              <dd className="mt-0.5 text-h2 font-semibold tabular text-foreground">{timeHM(todayRecord?.checkOut)}</dd>
            </div>
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-caption text-muted-foreground">
            <LocateFixed className="size-3.5 shrink-0" />
            Vùng hợp lệ: {office.name} · bán kính {office.radiusM} m
          </p>
          {gpsMessage && (
            <p role="status" className="mt-2 flex items-center gap-1.5 text-caption text-success">
              <CircleCheck className="size-3.5 shrink-0" /> {gpsMessage}
            </p>
          )}
          {gpsError && (
            <p role="alert" className="mt-2 flex items-start gap-1.5 text-caption text-danger">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {gpsError}
            </p>
          )}
          <div className="mt-auto pt-5">
            {!todayRecord?.checkIn ? (
              <Button size="lg" className="h-11 w-full" onClick={handleCheckIn} disabled={gpsBusy || !employeeId}>
                {gpsBusy ? <Loader2 className="animate-spin" /> : <LogIn />}
                {gpsBusy ? "Đang lấy vị trí GPS…" : "Check-in"}
              </Button>
            ) : !todayRecord.checkOut ? (
              <Button size="lg" variant="outline" className="h-11 w-full" onClick={handleCheckOut} disabled={gpsBusy}>
                {gpsBusy ? <Loader2 className="animate-spin" /> : <LogOut />}
                {gpsBusy ? "Đang check-out…" : "Check-out"}
              </Button>
            ) : (
              <Button size="lg" variant="outline" className="h-11 w-full" disabled>
                <Check />
                Đã hoàn tất hôm nay
                {typeof todayRecord.workHours === "number" ? ` · ${todayRecord.workHours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} h` : ""}
              </Button>
            )}
          </div>
        </Card>

        {/* Phép năm — số thật từ leave balance */}
        <Card className="flex flex-col p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success-tint text-success">
              <CalendarCheck className="size-[18px]" />
            </span>
            <div>
              <h2 className="text-body font-semibold text-foreground">Phép năm còn lại</h2>
              <p className="text-caption text-muted-foreground">Năm {selectedYear}</p>
            </div>
          </div>
          {dataLoading && !leaveBalance ? (
            <div className="mt-5 flex flex-col gap-3">
              <div className="skeleton h-9 w-32 rounded-md" />
              <div className="skeleton h-2 w-full rounded-full" />
            </div>
          ) : (
            <>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="text-display font-bold tabular text-foreground">
                  {leaveBalance ? leaveBalance.remainingDays.toLocaleString("vi-VN") : "--"}
                </span>
                <span className="text-body text-muted-foreground">/ {leaveBalance?.totalDays ?? "--"} ngày</span>
              </p>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={leaveBalance?.remainingDays ?? 0}
                aria-valuemin={0}
                aria-valuemax={leaveBalance?.totalDays ?? 0}
                aria-label={`Còn ${leaveBalance?.remainingDays ?? 0} trên ${leaveBalance?.totalDays ?? 0} ngày phép`}
              >
                <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${remainingPct}%` }} />
              </div>
              <p className="mt-2 text-caption text-muted-foreground">
                Đã dùng {usedDays.toLocaleString("vi-VN")} ngày
                {pendingCount > 0 ? ` · ${pendingCount} đơn đang chờ duyệt` : ""}
              </p>
            </>
          )}
          <div className="mt-auto pt-5">
            <Button size="lg" variant="outline" className="h-11 w-full" onClick={openLeaveModal}>
              <Plus />
              Tạo đơn mới
            </Button>
          </div>
        </Card>

        {/* Phiếu lương gần nhất — từ /payroll/me */}
        <Card className="flex flex-col p-4 sm:p-5 md:col-span-2 xl:col-span-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-1 basis-44 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
                <Wallet className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-body font-semibold text-foreground">Phiếu lương</h2>
                <p className="text-caption text-muted-foreground">Kỳ tháng {payslipPeriod}</p>
              </div>
            </div>
            {payslip && <PayrollStatusBadge status={payslip.status} />}
          </div>
          {payslip ? (
            <>
              <p className="mt-5 text-caption text-muted-foreground">Thực lĩnh</p>
              <p className="break-words text-display font-bold tabular text-foreground">{vndSuffix(payslip.netSalary)}</p>
              <p className="mt-1 text-caption text-muted-foreground">
                Gross {vndSuffix(gross)}
                {payslip.paidAt ? ` · chi trả ${formatDateVN(payslip.paidAt)}` : ""}
              </p>
              <div className="mt-auto pt-5">
                <Button
                  variant="ghost"
                  className="w-full text-primary hover:bg-primary-tint hover:text-primary"
                  onClick={openPayslipDetails}
                  aria-controls="payslip-details"
                >
                  Xem chi tiết
                  <ArrowRight />
                </Button>
              </div>
            </>
          ) : dataLoading ? (
            <div className="mt-5 flex flex-col gap-2">
              <div className="skeleton h-4 w-20 rounded-md" />
              <div className="skeleton h-9 w-48 rounded-md" />
            </div>
          ) : (
            <p className="mt-5 text-body-sm text-muted-foreground">
              Chưa có phiếu lương kỳ {payslipPeriod}. Phiếu xuất hiện sau khi HR tính lương.
            </p>
          )}
        </Card>
      </div>

      {/* Row 2: Bảng công (trái) + Đơn & Hội nhập (phải) */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[400px_1fr] lg:gap-6">
        <MonthlyTimesheetStrip
          employeeId={employeeId}
          month={selectedMonth}
          year={selectedYear}
          onMonthChange={handleMonthChange}
          attendanceRecords={monthlyAttendance}
          loading={timesheetLoading}
        />

        <div className="grid min-w-0 gap-4 lg:gap-6">
          {/* Đơn của tôi */}
          <Card>
            <div className="flex items-start justify-between gap-3 p-5 pb-4 sm:p-6 sm:pb-4">
              <div className="min-w-0">
                <h2 className="text-h3 font-semibold text-foreground">Đơn của tôi</h2>
                <p className="text-body-sm text-muted-foreground">Nghỉ phép, tăng ca, công tác và trạng thái duyệt</p>
              </div>
              <Button variant="outline" size="sm" onClick={openLeaveModal} aria-label="Tạo đơn mới">
                <Plus />
                <span className="hidden sm:inline">Tạo đơn</span>
              </Button>
            </div>
            {leaveHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-2 border-t border-border-subtle px-6 py-10 text-center">
                <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Inbox className="size-5" />
                </span>
                <p className="text-body font-semibold text-foreground">Bạn chưa gửi đơn nào</p>
                <p className="text-body-sm text-muted-foreground">Đơn nghỉ phép, tăng ca, công tác sẽ hiện ở đây.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                {leaveHistory.map((leave) => (
                  <li key={leave.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium text-foreground">{leaveTypeLabel(leave.type)}</p>
                      <p className="text-caption text-muted-foreground tabular">
                        {leave.startDate === leave.endDate
                          ? formatDateVN(leave.startDate)
                          : `${formatDateVN(leave.startDate)} → ${formatDateVN(leave.endDate)}`}
                        {" · "}
                        {requestDurationLabel(leave)}
                      </p>
                      {leave.reason && (
                        <p className="mt-0.5 line-clamp-2 break-words text-caption text-muted-foreground">{leave.reason}</p>
                      )}
                      {leave.rejectionReason && (
                        <p className="mt-1 break-words text-caption text-danger">Lý do từ chối: {leave.rejectionReason}</p>
                      )}
                    </div>
                    <LeaveStatusBadge status={leave.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Lộ trình hội nhập */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-h3 font-semibold text-foreground">Lộ trình hội nhập</h2>
                <p className="text-body-sm text-muted-foreground">
                  {onboarding && onboarding.total > 0
                    ? `${onboarding.completed}/${onboarding.total} hạng mục đã hoàn thành`
                    : "Tiến độ hội nhập sẽ hiển thị tại đây"}
                </p>
              </div>
              {onboarding && onboarding.total > 0 && (
                <span className="text-body-sm font-semibold tabular text-foreground">{onboardingPct}%</span>
              )}
            </div>
            {!onboarding || onboarding.items.length === 0 ? (
              dataLoading ? (
                <div className="mt-4 flex flex-col gap-3">
                  <div className="skeleton h-2 w-full rounded-full" />
                  <div className="skeleton h-5 w-3/4 rounded-md" />
                  <div className="skeleton h-5 w-2/3 rounded-md" />
                </div>
              ) : (
                <p className="mt-4 text-body-sm text-muted-foreground">Chưa có lộ trình hội nhập nào được gán cho bạn.</p>
              )
            ) : (
              <>
                <div
                  className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={onboardingPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Tiến độ hội nhập ${onboardingPct}%`}
                >
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${onboardingPct}%` }} />
                </div>
                <ol className="mt-4 grid">
                  {onboarding.items.map((item, idx) => (
                    <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {idx < onboarding.items.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={`absolute bottom-0 left-[11px] top-6 w-px ${item.isCompleted ? "bg-primary/30" : "bg-border"}`}
                        />
                      )}
                      <span
                        className={`relative flex size-6 shrink-0 items-center justify-center rounded-full ${
                          item.isCompleted ? "bg-primary text-primary-foreground" : "border-2 border-input bg-card"
                        }`}
                      >
                        {item.isCompleted && <Check className="size-3.5" />}
                        <span className="sr-only">{item.isCompleted ? "Đã hoàn thành" : "Chưa hoàn thành"}</span>
                      </span>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                          <p className={`text-body-sm ${item.isCompleted ? "text-secondary-foreground" : "font-medium text-foreground"}`}>
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="break-words text-caption text-muted-foreground">{item.description}</p>
                          )}
                        </div>
                        <Badge variant={item.isCompleted ? "success" : "secondary"}>
                          {item.isCompleted
                            ? `Hoàn thành${item.completedAt ? ` ${new Date(item.completedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}` : ""}`
                            : "Chờ xử lý"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Chi tiết phiếu lương (accordion) — số liệu thật */}
      {payslip && (
        <Card ref={payslipRef} className="scroll-mt-20">
          <button
            type="button"
            onClick={() => setShowPayslipDetails(!showPayslipDetails)}
            aria-expanded={showPayslipDetails}
            aria-controls="payslip-details"
            className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg p-5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/20 sm:p-6"
          >
            <div className="min-w-0">
              <h2 className="text-h3 font-semibold text-foreground">Chi tiết phiếu lương tháng {payslipPeriod}</h2>
              <p className="text-body-sm text-muted-foreground">Các khoản thu nhập và giảm trừ theo luật</p>
            </div>
            <ChevronDown
              className={`size-5 shrink-0 text-muted-foreground transition-transform ${showPayslipDetails ? "rotate-180" : ""}`}
            />
          </button>
          {showPayslipDetails && (
            <div id="payslip-details" className="overflow-x-auto px-5 pb-6 sm:px-6">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Khoản mục</TableHead>
                    <TableHead className="text-right">Thu nhập</TableHead>
                    <TableHead className="text-right">Giảm trừ</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="tabular">
                  <PayslipRow
                    label="Lương thực tế"
                    income={payslip.baseSalary}
                    note={`${payslip.actualWorkingDays}/${payslip.workingDays} ngày công`}
                  />
                  <PayslipRow
                    label="Làm thêm giờ"
                    income={payslip.overtimePay}
                    note={`${payslip.overtimeHours.toLocaleString("vi-VN")} giờ`}
                  />
                  <PayslipRow label="Phụ cấp + Thưởng" income={payslip.allowances + payslip.bonus} />
                  <PayslipRow label="Tổng gross" income={gross} strong />
                  <PayslipRow label="Bảo hiểm (BHXH/BHYT/BHTN)" deduction={payslip.deductions} />
                  <PayslipRow label="Thuế TNCN" deduction={payslip.tax} />
                  {(payslip.advance ?? 0) > 0 && <PayslipRow label="Tạm ứng" deduction={payslip.advance!} />}
                  {(payslip.bhxhBenefit ?? 0) > 0 && (
                    <PayslipRow
                      label="Trợ cấp BHXH"
                      income={payslip.bhxhBenefit!}
                      note="Cơ quan BHXH chi trả, không nằm trong lương công ty"
                    />
                  )}
                  <TableRow className="font-semibold hover:bg-transparent">
                    <TableCell>Thực lĩnh</TableCell>
                    <TableCell className="text-right text-primary" colSpan={2}>{vndSuffix(payslip.netSalary)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* Modal tạo đơn — form hoạt động thật */}
      <Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal} className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Tạo đơn mới</DialogTitle>
          <DialogDescription>Đơn sẽ được gửi tới quản lý trực tiếp để duyệt.</DialogDescription>
        </DialogHeader>
        <div id="leave-form" className="mt-5 grid gap-4">
          <div>
            <label htmlFor="lv-type" className={labelCls}>
              Loại đơn <span className="text-danger">*</span>
            </label>
            <select
              id="lv-type"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className={fieldCls}
            >
              {LEAVE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{leaveTypeLabel(t)}</option>
              ))}
            </select>
          </div>
          {leaveType === LeaveTypeEnum.enum.OT ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lv-ot-date" className={labelCls}>
                  Ngày tăng ca <span className="text-danger">*</span>
                </label>
                <input
                  id="lv-ot-date"
                  type="date"
                  value={otDate}
                  onChange={(e) => setOtDate(e.target.value)}
                  aria-invalid={!!leaveErrors.overtimeDate || undefined}
                  className={fieldCls}
                />
                <FieldError message={leaveErrors.overtimeDate} />
              </div>
              <div>
                <label htmlFor="lv-ot-hours" className={labelCls}>
                  Số giờ tăng ca <span className="text-danger">*</span>
                </label>
                <input
                  id="lv-ot-hours"
                  type="number"
                  min={0.5}
                  max={24}
                  step={0.5}
                  value={otHours}
                  placeholder="Ví dụ: 2"
                  onChange={(e) => setOtHours(e.target.value === "" ? "" : Number(e.target.value))}
                  aria-invalid={!!leaveErrors.overtimeHours || undefined}
                  className={fieldCls}
                />
                <FieldError message={leaveErrors.overtimeHours} />
              </div>
            </div>
          ) : (
            <fieldset>
              <legend className={labelCls}>
                {leaveType === LeaveTypeEnum.enum.BUSINESS_TRIP
                  ? "Thời gian công tác"
                  : leaveType === LeaveTypeEnum.enum.LATE_PERMISSION
                  ? "Ngày đến muộn / về sớm"
                  : "Thời gian nghỉ"}{" "}
                <span className="text-danger">*</span>
              </legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="lv-from" className="mb-1 block text-caption text-muted-foreground">Từ ngày</label>
                  <input
                    id="lv-from"
                    type="date"
                    lang="vi-VN"
                    value={startDate}
                    min={today}
                    onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value) }}
                    aria-invalid={!!leaveErrors.startDate || undefined}
                    className={fieldCls}
                  />
                  <FieldError message={leaveErrors.startDate} />
                </div>
                <div>
                  <label htmlFor="lv-to" className="mb-1 block text-caption text-muted-foreground">Đến ngày</label>
                  <input
                    id="lv-to"
                    type="date"
                    lang="vi-VN"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    aria-invalid={!!leaveErrors.endDate || undefined}
                    className={fieldCls}
                  />
                  <FieldError message={leaveErrors.endDate} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-sunken px-3 py-2 text-body-sm">
                <span className="text-secondary-foreground">
                  Đã chọn: <span className="font-medium text-foreground">{fmtVNDate(startDate)}</span>
                  {" → "}
                  <span className="font-medium text-foreground">{fmtVNDate(endDate)}</span>
                </span>
                <span className="text-secondary-foreground">
                  Số ngày theo lịch: <span className="font-semibold text-foreground tabular">{requestedDays}</span>
                  {leaveType === LeaveTypeEnum.enum.ANNUAL && leaveBalance && (
                    <span className="ml-2 text-caption text-muted-foreground">
                      · Phép còn lại sau khi gửi (ước tính):{" "}
                      <span className="font-medium text-foreground tabular">
                        {Math.max(0, leaveBalance.remainingDays - requestedDays)}
                      </span>
                      /{leaveBalance.totalDays}
                    </span>
                  )}
                </span>
              </div>
            </fieldset>
          )}
          <div>
            <label htmlFor="lv-reason" className={labelCls}>
              Lý do <span className="text-danger">*</span>
            </label>
            <textarea
              id="lv-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={leaveType === LeaveTypeEnum.enum.OT ? "Nội dung công việc làm thêm…" : "Ví dụ: Về quê dự đám cưới người thân"}
              rows={3}
              aria-invalid={!!leaveErrors.reason || undefined}
              aria-describedby="lv-reason-help"
              className={`${fieldCls} h-auto resize-none py-2.5`}
            />
            {leaveErrors.reason ? (
              <FieldError id="lv-reason-help" message={leaveErrors.reason} />
            ) : (
              <p id="lv-reason-help" className="mt-1 text-caption text-muted-foreground">Tối thiểu 10 ký tự.</p>
            )}
          </div>
          {leaveErrors.form && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint px-3 py-2.5 text-body-sm text-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              {leaveErrors.form}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setShowLeaveModal(false)}>Huỷ</Button>
          <Button size="lg" onClick={handleLeaveSubmit} disabled={leaveSubmitting}>
            {leaveSubmitting && <Loader2 className="animate-spin" />}
            Gửi đơn
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Nút Trợ lý HR AI nổi — chat thật qua NestJS */}
      <button
        type="button"
        onClick={() => setFloatingChatOpen(!floatingChatOpen)}
        aria-label={floatingChatOpen ? "Đóng trợ lý HR AI" : "Mở trợ lý HR AI"}
        aria-expanded={floatingChatOpen}
        aria-controls="portal-ai-panel"
        className="fixed bottom-4 right-4 z-20 flex size-14 cursor-pointer items-center justify-center rounded-full bg-ai text-white shadow-pop outline-none transition hover:brightness-110 focus-visible:ring-3 focus-visible:ring-ring/30 sm:bottom-6 sm:right-6"
      >
        {floatingChatOpen ? <X className="size-6" /> : <Sparkles className="size-6" />}
      </button>

      {floatingChatOpen && (
        <div
          aria-hidden="true"
          onClick={() => setFloatingChatOpen(false)}
          className="fixed inset-0 z-40 bg-[var(--overlay)] animate-in fade-in-0 duration-150 sm:hidden"
        />
      )}
      {floatingChatOpen && (
        <div
          id="portal-ai-panel"
          role="dialog"
          aria-label="Trợ lý HR AI"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[78dvh] flex-col rounded-t-xl border border-border bg-card shadow-modal animate-in fade-in-0 slide-in-from-bottom-2 duration-200 sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[560px] sm:w-[400px] sm:rounded-xl"
        >
          {/* Header */}
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ai-tint text-ai">
              <Sparkles className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold text-foreground">Trợ lý HR AI</p>
              <p className="truncate text-caption text-muted-foreground">Hỏi đáp lương, phép, chính sách</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePortalNewSession}
              disabled={isChatting}
              title="Đóng phiên hiện tại và bắt đầu phiên mới"
            >
              <RotateCcw />
              <span className="hidden sm:inline">Phiên mới</span>
              <span className="sr-only sm:hidden">Phiên mới</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setFloatingChatOpen(false)} aria-label="Đóng trợ lý">
              <X className="size-5" />
            </Button>
          </div>

          {/* Messages */}
          <div className="grid flex-1 content-start gap-3 overflow-y-auto p-4" aria-live="polite">
            {chatMessages.map((m, idx) => (
              <div
                key={idx}
                className={
                  m.role === "user"
                    ? "max-w-[85%] justify-self-end rounded-lg rounded-tr-sm bg-primary-tint px-3.5 py-2.5 text-body-sm text-accent-foreground"
                    : "max-w-[85%] justify-self-start rounded-lg rounded-tl-sm border border-border bg-card px-3.5 py-2.5 text-body-sm text-foreground"
                }
              >
                <RichText text={m.text} className="text-body-sm" />
              </div>
            ))}
            {isChatting && (
              <div
                className="flex max-w-[85%] items-center gap-1 justify-self-start rounded-lg rounded-tl-sm border border-border bg-card px-3.5 py-3"
                aria-label="Trợ lý đang trả lời"
                role="status"
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-border p-3">
            <label htmlFor="portal-ai-input" className="sr-only">Nhập câu hỏi</label>
            <div className="overflow-hidden rounded-md border border-input bg-card transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
              <textarea
                id="portal-ai-input"
                rows={2}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendChat()
                  }
                }}
                placeholder="Hỏi chính sách, ngày phép…"
                disabled={isChatting}
                className="min-h-[56px] w-full resize-none border-0 bg-transparent px-3 py-2.5 text-body text-foreground outline-none placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="flex justify-end border-t border-border-subtle px-2 py-1.5">
                <Button
                  size="icon"
                  className="size-8"
                  onClick={handleSendChat}
                  disabled={isChatting || !chatInput.trim()}
                  aria-label="Gửi"
                  title="Gửi tin nhắn (Enter)"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hỗ trợ hiển thị ───────────────────────────────────────────────────────
const labelCls = "mb-1.5 block text-body-sm font-medium text-foreground"
const fieldCls =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-body text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-subtle-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60"

/** Giữ helper cũ để các chỗ gọi không phải đổi: vnd() đã trả "28.500.000 ₫" */
function vndSuffix(amount: number): string {
  return vnd(amount)
}

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1 flex items-start gap-1 text-caption text-danger">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
      {message}
    </p>
  )
}

function LeaveStatusBadge({ status }: { status: LeaveRequest["status"] }) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="success" className="shrink-0"><CircleCheck />Đã duyệt</Badge>
    case "REJECTED":
      return <Badge variant="destructive" className="shrink-0"><CircleX />Từ chối</Badge>
    case "CANCELLED":
      return <Badge variant="secondary" className="shrink-0"><Ban />Đã huỷ</Badge>
    default:
      return <Badge variant="warning" className="shrink-0"><Hourglass />Chờ duyệt</Badge>
  }
}

function PayrollStatusBadge({ status }: { status: PayrollRecord["status"] }) {
  const label = payrollStatusLabel(status)
  switch (status) {
    case "PAID":
      return <Badge variant="success" className="shrink-0"><CircleCheck />{label}</Badge>
    case "APPROVED":
      return <Badge variant="info" className="shrink-0"><CircleCheck />{label}</Badge>
    case "CANCELLED":
      return <Badge variant="secondary" className="shrink-0"><Ban />{label}</Badge>
    default:
      return <Badge variant="warning" className="shrink-0"><Hourglass />{label}</Badge>
  }
}

function PayslipRow({
  label, income, deduction, note, strong,
}: {
  label: string; income?: number; deduction?: number; note?: string; strong?: boolean
}) {
  return (
    <TableRow className={strong ? "font-semibold" : undefined}>
      <TableCell className="h-12">{label}</TableCell>
      <TableCell className={`h-12 text-right ${income === undefined ? "text-muted-foreground" : ""}`}>
        {income === undefined ? "—" : vndSuffix(income)}
      </TableCell>
      <TableCell className={`h-12 text-right ${deduction === undefined ? "text-muted-foreground" : ""}`}>
        {deduction === undefined ? "—" : `-${vndSuffix(deduction)}`}
      </TableCell>
      <TableCell className="h-12 font-normal text-muted-foreground">{note ?? ""}</TableCell>
    </TableRow>
  )
}
