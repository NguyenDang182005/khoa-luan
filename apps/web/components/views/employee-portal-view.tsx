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
  Calendar,
  MapPin,
  CheckCircle2,
  Send,
  Plus,
  Bot,
  Sparkles,
  X,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { todayVN, leaveTypeLabel, payrollStatusLabel, vnd } from "@/lib/utils"
import { settingsApi } from "@/lib/api/settings.api"
import type { Geofence } from "@/lib/schemas/settings.schema"

// Tọa độ văn phòng: ưu tiên cấu hình trong DB (Trang Cài Đặt → Geofence),
// fallback qua biến env NEXT_PUBLIC_OFFICE_* rồi mới đến mặc định.
const OFFICE_FALLBACK = {
  name: process.env.NEXT_PUBLIC_OFFICE_NAME ?? "Văn phòng công ty",
  lat: Number(process.env.NEXT_PUBLIC_OFFICE_LAT ?? 10.7951),
  lng: Number(process.env.NEXT_PUBLIC_OFFICE_LNG ?? 106.7218),
  radiusM: Number(process.env.NEXT_PUBLIC_OFFICE_RADIUS_M ?? 200),
}

const LEAVE_TYPE_OPTIONS = [
  LeaveTypeEnum.enum.ANNUAL,
  LeaveTypeEnum.enum.SICK,
  LeaveTypeEnum.enum.UNPAID,
  LeaveTypeEnum.enum.EMERGENCY,
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

export function EmployeePortalView() {
  const { user } = useAuth()
  const employeeId = user?.employee?.id ?? ""
  const empName = user?.employee?.fullName ?? ""
  const empCode = user?.employee?.employeeCode ?? ""
  const deptName = user?.employee?.departmentName ?? ""
  const posTitle = user?.employee?.positionTitle ?? ""

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
  const [reason, setReason] = useState("")
  const [leaveErrors, setLeaveErrors] = useState<Record<string, string>>({})
  const [leaveSubmitting, setLeaveSubmitting] = useState(false)
  const [leaveSuccess, setLeaveSuccess] = useState<string | null>(null)
  const [showPayslipDetails, setShowPayslipDetails] = useState(false)

  const today = todayVN()

  const loadAll = useCallback(async () => {
    if (!employeeId) return
    setDataLoading(true)
    const nowDate = new Date()
    const month = nowDate.getMonth() + 1
    const year = nowDate.getFullYear()
    // Vùng chấm công trong DB (HR_ADMIN cấu hình ở trang Cài Đặt)
    settingsApi
      .getGeofence()
      .then((g) => setOffice({ name: g.name, lat: g.lat, lng: g.lng, radiusM: g.radiusM }))
      .catch(() => {/* giữ fallback */})
    const [balanceRes, leavesRes, slipRes, attendanceRes, onboardingRes] = await Promise.allSettled([
      leaveApi.getBalance(employeeId, year),
      leaveApi.list({ employeeId }),
      payrollApi.getMyPayslip(month, year),
      attendanceApi.listByEmployee(employeeId, month, year),
      onboardingApi.getMy(),
    ])
    if (balanceRes.status === "fulfilled") {
      setLeaveBalance({ remainingDays: balanceRes.value.remainingDays, totalDays: balanceRes.value.totalDays })
    }
    if (leavesRes.status === "fulfilled") setLeaveHistory(leavesRes.value)
    if (slipRes.status === "fulfilled") setPayslip(slipRes.value)
    if (attendanceRes.status === "fulfilled") {
      const records = attendanceRes.value
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
  }, [employeeId, today])

  useEffect(() => {
    loadAll()
  }, [loadAll])

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
      const pos = await getPosition()
      const distance = Math.round(haversineMeters(pos.coords.latitude, pos.coords.longitude, office.lat, office.lng))
      if (distance > office.radiusM) {
        setGpsError(`Bạn đang cách ${office.name} khoảng ${distance}m (giới hạn ${office.radiusM}m). Vui lòng đến gần hơn để check-in.`)
        return
      }
      await attendanceApi.checkIn(employeeId, `GPS ${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)} (${distance}m)`)
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
      await attendanceApi.checkOut(employeeId)
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
    const parsed = LeaveCreateSchema.safeParse({ employeeId, type: leaveType, startDate, endDate, reason })
    if (!parsed.success) {
      const errs: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form")
        if (!errs[key]) errs[key] = issue.message
      }
      setLeaveErrors(errs)
      return
    }
    setLeaveSubmitting(true)
    try {
      await leaveApi.create(parsed.data)
      setShowLeaveModal(false)
      setReason("")
      setLeaveSuccess("Đã gửi đơn nghỉ phép. Đơn đang chờ quản lý duyệt.")
      await loadAll()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setLeaveErrors({ form: Array.isArray(msg) ? msg.join(", ") : msg ?? "Gửi đơn thất bại. Vui lòng thử lại." })
    } finally {
      setLeaveSubmitting(false)
    }
  }

  const gross = payslip ? payslip.baseSalary + payslip.allowances + payslip.overtimePay + payslip.bonus : 0

  return (
    <div className="relative flex flex-col gap-6 p-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Bàn Làm Việc Cá Nhân (Employee Portal)
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Xin chào, {empName || "bạn"} ({posTitle || "—"} • Mã NV: {empCode || "—"}{deptName ? ` • ${deptName}` : ""})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="teal" className="gap-1 px-3 py-1">
            <span className="size-2 rounded-full bg-agent-teal animate-pulse" />
            Trợ lý AI Đang Trực Tuyến
          </Badge>
        </div>
      </div>

      {leaveSuccess && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          {leaveSuccess}
        </div>
      )}

      {/* Row 1: 3 Quick Action Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* GPS Geofencing Attendance Card — dữ liệu thật từ attendance API */}
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Chấm Công Định Vị GPS Hôm Nay
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            {todayRecord?.checkIn ? (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{timeHM(todayRecord.checkIn)}</span>
                <Badge variant="success" className="text-[10px]">Đã Check-in</Badge>
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-muted-foreground">--:--</span>
                <Badge variant="warning" className="text-[10px]">Chưa Check-in</Badge>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="size-3 text-emerald-400" /> {office.name} (bán kính {office.radiusM}m)
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {!todayRecord?.checkIn ? (
                <Button size="sm" className="w-full text-xs gap-1 bg-primary text-primary-foreground" onClick={handleCheckIn} disabled={gpsBusy || !employeeId}>
                  {gpsBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />} Check-in (GPS)
                </Button>
              ) : !todayRecord?.checkOut ? (
                <Button size="sm" variant="outline" className="w-full text-xs gap-1 border-agent-amber/40 text-agent-amber hover:bg-agent-amber/10" onClick={handleCheckOut} disabled={gpsBusy}>
                  {gpsBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />} Chấm Công Ra (Check-out)
                </Button>
              ) : (
                <div className="rounded-lg bg-emerald-500/10 p-2 text-center text-xs font-semibold text-emerald-400">
                  ✓ Đã check-out lúc {timeHM(todayRecord.checkOut)}
                  {typeof todayRecord.workHours === "number" ? ` • ${todayRecord.workHours.toFixed(1)}h` : ""}
                </div>
              )}
              {gpsMessage && <p className="text-[11px] text-emerald-400">{gpsMessage}</p>}
              {gpsError && (
                <p className="flex items-start gap-1 text-[11px] text-agent-coral">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" /> {gpsError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Annual Leaves Card — số thật từ leave balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Phép Năm Còn Lại
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-agent-teal/10 text-agent-teal">
              <Calendar className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-agent-teal">
              {dataLoading ? "..." : (leaveBalance?.remainingDays ?? "--")}{" "}
              <span className="text-xs font-normal text-muted-foreground">/ {leaveBalance?.totalDays ?? "--"} ngày</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted mt-2 overflow-hidden">
              <div
                className="h-full bg-agent-teal rounded-full transition-all"
                style={{ width: `${leaveBalance ? Math.min(100, (leaveBalance.remainingDays / Math.max(1, leaveBalance.totalDays)) * 100) : 0}%` }}
              />
            </div>
            <div className="mt-3">
              <Button
                size="sm"
                className="w-full text-xs gap-1 bg-primary text-primary-foreground"
                onClick={() => { setShowLeaveModal(true); setLeaveErrors({}); setLeaveSuccess(null) }}
              >
                <Plus className="size-3.5" /> Tạo Đơn Nghỉ Phép
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Latest Payslip — phiếu lương thật từ /payroll/me */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              {payslip ? `Phiếu Lương Tháng ${String(payslip.month).padStart(2, "0")}/${payslip.year}` : "Phiếu Lương"}
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <CreditCard className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            {payslip ? (
              <>
                <div className="text-2xl font-bold font-mono text-emerald-400">{vnd(payslip.netSalary)}</div>
                <p className="text-xs text-muted-foreground mt-1">Trạng thái: {payrollStatusLabel(payslip.status)}</p>
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs gap-1"
                    onClick={() => setShowPayslipDetails(!showPayslipDetails)}
                  >
                    {showPayslipDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    {showPayslipDetails ? "Ẩn Chi Tiết" : "Xem Chi Tiết"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {dataLoading ? "Đang tải phiếu lương..." : "Chưa có phiếu lương trong kỳ này. Phiếu xuất hiện sau khi HR chạy Rule Engine."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expandable Payslip Breakdown — số liệu thật */}
      {showPayslipDetails && payslip && (
        <Card className="border-border/80 animate-in fade-in duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">
                Chi Tiết Phiếu Lương Điện Tử (Kỳ {String(payslip.month).padStart(2, "0")}/{payslip.year})
              </CardTitle>
              <CardDescription>Bảng phân rã các khoản thu nhập và giảm trừ theo luật</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-5 pt-2">
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Lương thực tế</span>
                <p className="font-mono font-bold text-foreground mt-1">{vnd(payslip.baseSalary)}</p>
                <p className="text-[10px] text-muted-foreground">{payslip.actualWorkingDays}/{payslip.workingDays} ngày công</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Làm thêm giờ ({payslip.overtimeHours}h)</span>
                <p className="font-mono font-bold text-emerald-400 mt-1">+{vnd(payslip.overtimePay)}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Phụ cấp + Thưởng</span>
                <p className="font-mono font-bold text-foreground mt-1">+{vnd(payslip.allowances + payslip.bonus)}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Tổng Gross</span>
                <p className="font-mono font-bold text-foreground mt-1">{vnd(gross)}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Khấu trừ (BH + Thuế TNCN)</span>
                <p className="font-mono font-bold text-agent-coral mt-1">-{vnd(payslip.deductions)}</p>
                <p className="text-[10px] text-muted-foreground">Trong đó thuế: {vnd(payslip.tax)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Đơn nghỉ phép của tôi — dữ liệu thật */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="size-4 text-agent-teal" />
            Đơn Nghỉ Phép Của Tôi
          </CardTitle>
          <CardDescription>Lịch sử các đơn đã gửi và trạng thái duyệt</CardDescription>
        </CardHeader>
        <CardContent>
          {leaveHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground">Bạn chưa gửi đơn nghỉ phép nào.</p>
          ) : (
            <div className="flex flex-col gap-2 text-xs">
              {leaveHistory.map((leave) => (
                <div key={leave.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {leaveTypeLabel(leave.type)} • {leave.startDate} → {leave.endDate} ({leave.totalDays} ngày)
                    </p>
                    <p className="text-[11px] text-muted-foreground italic">&ldquo;{leave.reason}&rdquo;</p>
                  </div>
                  <Badge variant={leave.status === "APPROVED" ? "success" : leave.status === "REJECTED" ? "destructive" : "warning"}>
                    {leave.status === "APPROVED" ? "Đã duyệt" : leave.status === "REJECTED" ? "Từ chối" : leave.status === "CANCELLED" ? "Đã hủy" : "Chờ duyệt"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lộ Trình Hội Nhập — dữ liệu thật từ Onboarding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            Lộ Trình Hội Nhập Của Bạn (Onboarding Journey)
          </CardTitle>
          <CardDescription>
            {onboarding
              ? `Hoàn thành ${onboarding.completed}/${onboarding.total} hạng mục`
              : "Tiến độ hội nhập sẽ hiển thị tại đây"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!onboarding || onboarding.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {dataLoading ? "Đang tải lộ trình..." : "Chưa có lộ trình hội nhập nào được gán cho bạn."}
            </p>
          ) : (
            <div className="flex flex-col gap-3 text-xs">
              {onboarding.items.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className={`size-5 ${item.isCompleted ? "text-emerald-400" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-semibold text-foreground">
                        {idx + 1}. {item.title}
                      </p>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={item.isCompleted ? "success" : "secondary"}>
                    {item.isCompleted
                      ? `Hoàn thành${item.completedAt ? ` ${new Date(item.completedAt).toLocaleDateString("vi-VN")}` : ""}`
                      : "Chờ xử lý"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leave Application Modal — form hoạt động thật */}
      <Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal}>
        <DialogHeader>
          <DialogTitle>Tạo Đơn Xin Nghỉ Phép</DialogTitle>
          <DialogDescription>
            Đơn của bạn sẽ được gửi tới Quản lý trực tiếp và nạp vào ngữ cảnh AI
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-3 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Loại nghỉ phép</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="w-full mt-1 rounded-lg border border-border bg-input/40 p-2 text-foreground outline-none"
            >
              {LEAVE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{leaveTypeLabel(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Thời gian nghỉ</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value) }}
                className="rounded-lg border border-border bg-input/40 p-2 text-foreground text-xs"
              />
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-border bg-input/40 p-2 text-foreground text-xs"
              />
            </div>
            {leaveErrors.startDate && <p className="mt-1 text-agent-coral">{leaveErrors.startDate}</p>}
            {leaveErrors.endDate && <p className="mt-1 text-agent-coral">{leaveErrors.endDate}</p>}
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Lý do nghỉ phép (tối thiểu 10 ký tự)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do nghỉ phép..."
              rows={2}
              className="w-full mt-1 rounded-lg border border-border bg-input/40 p-2 text-foreground text-xs outline-none"
            />
            {leaveErrors.reason && <p className="mt-1 text-agent-coral">{leaveErrors.reason}</p>}
          </div>
          {leaveErrors.form && <p className="text-agent-coral">{leaveErrors.form}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowLeaveModal(false)}>Hủy</Button>
          <Button variant="default" onClick={handleLeaveSubmit} disabled={leaveSubmitting} className="gap-1.5">
            {leaveSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            Gửi Đơn Xin Phép
          </Button>
        </DialogFooter>
      </Dialog>

      {/* FLOATING HR AI ASSISTANT WIDGET — chat thật qua NestJS */}
      <div className="fixed bottom-6 right-6 z-50">
        {!floatingChatOpen ? (
          <Button
            onClick={() => setFloatingChatOpen(true)}
            className="size-14 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 p-0 shadow-2xl hover:scale-105 transition-transform"
            aria-label="Mở trợ lý HR AI"
          >
            <Bot className="size-7 text-white" />
          </Button>
        ) : (
          <div className="flex h-[450px] w-80 flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Widget Header */}
            <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 p-3 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Trợ Lý HR AI (WF02)</h4>
                  <p className="text-[10px] text-muted-foreground">Sẵn sàng 24/7 • Gemini 3.1 Flash Lite</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-muted-foreground" onClick={handlePortalNewSession} disabled={isChatting} title="Đóng phiên hiện tại và bắt đầu phiên mới">
                Phiên mới
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setFloatingChatOpen(false)} aria-label="Đóng chat">
                <X className="size-4" />
              </Button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 text-xs">
              {chatMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl p-2.5 leading-relaxed max-w-[85%] ${
                    m.role === "user"
                      ? "self-end bg-primary text-primary-foreground"
                      : "self-start bg-muted/60 text-foreground border border-border"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.latency && <p className="mt-1 text-[9px] opacity-60">⚡ {m.latency}ms</p>}
                </div>
              ))}
              {isChatting && (
                <div className="self-start rounded-xl bg-muted/60 border border-border p-2.5 text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin" /> Đang phân tích câu hỏi...
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="border-t border-border p-2.5 bg-composer rounded-b-2xl">
              <div className="flex items-center gap-1.5">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Hỏi chính sách, ngày phép..."
                  className="flex-1 rounded-lg border border-border bg-input/40 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  disabled={isChatting}
                />
                <Button size="icon" className="size-7 bg-primary text-primary-foreground" onClick={handleSendChat} disabled={isChatting || !chatInput.trim()}>
                  <Send className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
