"use client"

import * as React from "react"
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar as CalendarIcon,
  CheckSquare,
  Square,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { leaveApi } from "@/lib/api/leave.api"
import type { LeaveRequest } from "@/lib/schemas/leave.schema"
import { apiErrorMessage, fmtVNDate, leaveTypeLabel, requestDurationLabel, todayVN } from "@/lib/utils"
import { LeaveDetailModal } from "@/components/employees/leave-detail-modal"

interface DepartmentOption {
  id: string
  name: string
}

interface LeaveApprovalsTabProps {
  departments?: DepartmentOption[]
}

const DAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

export function LeaveApprovalsTab({ departments = [] }: LeaveApprovalsTabProps) {

  const [leaves, setLeaves] = React.useState<LeaveRequest[]>([])
  const [loading, setLoading] = React.useState(true)
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
  const [deptFilter, setDeptFilter] = React.useState<string>("ALL")
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  const [viewMode, setViewMode] = React.useState<"table" | "calendar">("table")

  // Calendar state
  const [calMonth, setCalMonth] = React.useState<number>(new Date().getMonth() + 1)
  const [calYear, setCalYear] = React.useState<number>(new Date().getFullYear())

  // Bulk selection
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [isBulkProcessing, setIsBulkProcessing] = React.useState(false)

  // Detail modal
  const [detailTarget, setDetailTarget] = React.useState<LeaveRequest | null>(null)

  const fetchLeaves = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await leaveApi.list()
      setLeaves(data)
    } catch (e: unknown) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchLeaves()
  }, [fetchLeaves])

  // Lọc dữ liệu
  const filteredLeaves = React.useMemo(() => {
    return leaves.filter((item) => {
      // Lọc trạng thái
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false

      // Lọc phòng ban
      if (deptFilter !== "ALL") {
        const deptName = item.employee?.department?.name ?? ""
        if (deptName !== deptFilter) return false
      }

      // Lọc tìm kiếm theo tên hoặc mã NV
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const name = (item.employee?.fullName ?? "").toLowerCase()
        const code = (item.employee?.employeeCode ?? "").toLowerCase()
        const reason = (item.reason ?? "").toLowerCase()
        if (!name.includes(q) && !code.includes(q) && !reason.includes(q)) return false
      }

      return true
    })
  }, [leaves, statusFilter, deptFilter, searchQuery])

  // KPIs
  const kpis = React.useMemo(() => {
    const pending = leaves.filter((l) => l.status === "PENDING").length
    const approved = leaves.filter((l) => l.status === "APPROVED").length
    const rejected = leaves.filter((l) => l.status === "REJECTED").length
    // Chỉ cộng đơn vắng mặt thật — OT, đến muộn/về sớm, công tác không phải ngày nghỉ
    const NOT_ABSENCE = ["OT", "LATE_PERMISSION", "BUSINESS_TRIP"]
    const totalDays = leaves
      .filter((l) => l.status === "APPROVED" && !NOT_ABSENCE.includes(l.type))
      .reduce((sum, l) => sum + (l.totalDays ?? 0), 0)
    return { pending, approved, rejected, totalDays }
  }, [leaves])

  // Danh sách phòng ban có trong dữ liệu nếu departments rỗng
  const availableDepts = React.useMemo(() => {
    if (departments.length > 0) return departments.map((d) => d.name)
    const set = new Set<string>()
    for (const l of leaves) {
      if (l.employee?.department?.name) set.add(l.employee.department.name)
    }
    return Array.from(set)
  }, [departments, leaves])

  // Thao tác duyệt đơn đơn lẻ
  // Lỗi được ném lên để LeaveDetailModal hiển thị (người duyệt lấy từ JWT phía backend)
  const handleApprove = async (id: string) => {
    setActionSuccess(null)
    await leaveApi.approve(id)
    setActionSuccess("Đã phê duyệt đơn thành công!")
    setSelectedIds((prev) => prev.filter((i) => i !== id))
    await fetchLeaves()
  }

  // Từ chối từ trong LeaveDetailModal (nút "Xem & Duyệt")
  const handleModalReject = async (id: string, reason: string) => {
    await leaveApi.reject(id, reason)
    setActionSuccess("Đã từ chối đơn.")
    setSelectedIds((prev) => prev.filter((i) => i !== id))
    await fetchLeaves()
  }

  // Thao tác duyệt hàng loạt
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`Bạn có chắc chắn muốn duyệt đồng loạt ${selectedIds.length} đơn đã chọn?`)) return
    setIsBulkProcessing(true)
    setActionSuccess(null)
    try {
      await leaveApi.approveBulk(selectedIds)
      setActionSuccess(`Đã phê duyệt thành công ${selectedIds.length} đơn!`)
      setSelectedIds([])
      await fetchLeaves()
    } catch (e: unknown) {
      alert(apiErrorMessage(e, "Xử lý hàng loạt thất bại."))
    } finally {
      setIsBulkProcessing(false)
    }
  }

  // Toggle chọn tất cả đơn PENDING
  const pendingLeaves = React.useMemo(
    () => filteredLeaves.filter((l) => l.status === "PENDING"),
    [filteredLeaves]
  )

  const isAllPendingSelected =
    pendingLeaves.length > 0 && pendingLeaves.every((l) => selectedIds.includes(l.id))

  const handleToggleSelectAll = () => {
    if (isAllPendingSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(pendingLeaves.map((l) => l.id))
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // ── Tính toán Lịch (Calendar View) ──────────────────────────────────────────
  const daysInCalMonth = new Date(calYear, calMonth, 0).getDate()
  const firstDayOfWeek = (new Date(calYear, calMonth - 1, 1).getDay() + 6) % 7 // T2=0, CN=6

  const calDays = React.useMemo(() => {
    const days: { day: number; dateStr: string; leaves: LeaveRequest[] }[] = []
    for (let d = 1; d <= daysInCalMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      // Tìm các đơn bao trùm ngày này
      const activeLeaves = leaves.filter((l) => {
        if (l.status !== "APPROVED" && l.status !== "PENDING") return false
        const s = (l.startDate ?? "").slice(0, 10)
        const e = (l.endDate ?? "").slice(0, 10)
        return dateStr >= s && dateStr <= e
      })
      days.push({ day: d, dateStr, leaves: activeLeaves })
    }
    return days
  }, [calYear, calMonth, daysInCalMonth, leaves])

  const segClass = (active: boolean) =>
    `rounded-sm px-3 py-1 text-body-sm font-medium transition-colors duration-150 ${
      active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
    }`

  return (
    <div className="flex flex-col gap-4">
      {/* Tóm tắt trạng thái đơn */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryChip
          icon={<Clock className="size-4" />}
          tone="bg-warning-tint text-warning"
          label="Chờ duyệt"
          value={kpis.pending}
          hint="Cần xử lý ngay"
        />
        <SummaryChip
          icon={<CheckCircle2 className="size-4" />}
          tone="bg-success-tint text-success"
          label="Đã duyệt"
          value={kpis.approved}
          hint="Đã chốt công phép"
        />
        <SummaryChip
          icon={<XCircle className="size-4" />}
          tone="bg-danger-tint text-danger"
          label="Từ chối"
          value={kpis.rejected}
          hint="Không được phê duyệt"
        />
        <SummaryChip
          icon={<CalendarIcon className="size-4" />}
          tone="bg-primary-tint text-primary"
          label="Tổng ngày nghỉ đã duyệt"
          value={kpis.totalDays}
          hint="Toàn công ty"
        />
      </div>

      {actionSuccess && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-success/20 bg-success-tint px-4 py-2.5 text-body-sm text-success animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            {actionSuccess}
          </span>
          <Button size="icon-xs" variant="ghost" onClick={() => setActionSuccess(null)} aria-label="Đóng thông báo" className="text-success hover:bg-card/60 hover:text-success">
            <XCircle className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Thanh bộ lọc & điều hướng view */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nhân viên, mã NV, lý do..."
                className="h-9 pl-9"
                aria-label="Tìm đơn"
              />
            </div>

            {/* Status Filter */}
            <div className="flex flex-wrap items-center gap-0.5 rounded-md bg-muted p-0.5">
              {[
                { key: "ALL", label: "Tất cả" },
                { key: "PENDING", label: `Chờ duyệt (${kpis.pending})` },
                { key: "APPROVED", label: "Đã duyệt" },
                { key: "REJECTED", label: "Từ chối" },
              ].map((s) => (
                <button key={s.key} onClick={() => setStatusFilter(s.key)} className={segClass(statusFilter === s.key)}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Department Select */}
            {availableDepts.length > 0 && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-card px-3 text-body text-foreground transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 sm:w-56"
                aria-label="Lọc theo phòng ban"
              >
                <option value="ALL">Mọi phòng ban</option>
                {availableDepts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Switch View Mode: Table / Calendar */}
          <div className="flex items-center gap-0.5 self-start rounded-md bg-muted p-0.5 lg:self-auto">
            <button onClick={() => setViewMode("table")} className={segClass(viewMode === "table")}>
              Bảng
            </button>
            <button onClick={() => setViewMode("calendar")} className={segClass(viewMode === "calendar")}>
              Lịch nghỉ
            </button>
          </div>
        </div>

        {/* Thanh tác vụ hàng loạt khi có checkbox được chọn */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary-tint px-4 py-2.5 animate-in fade-in">
            <div className="flex items-center gap-2 text-body-sm font-semibold text-accent-foreground">
              <CheckCircle2 className="size-4" />
              <span>Đang chọn {selectedIds.length} đơn</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleBulkApprove} disabled={isBulkProcessing}>
                {isBulkProcessing && <Loader2 className="size-3.5 animate-spin" />}
                Duyệt các mục đã chọn ({selectedIds.length})
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>
                Bỏ chọn
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* VIEW 1: TABLE VIEW */}
      {viewMode === "table" && (
        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex flex-col gap-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-10 rounded-md" />
              ))}
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="size-5" />
              </div>
              <p className="text-body font-semibold text-foreground">Không tìm thấy đơn nào</p>
              <p className="text-body-sm text-muted-foreground">Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1080px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      <button
                        onClick={handleToggleSelectAll}
                        title="Chọn tất cả đơn chờ duyệt"
                        aria-label="Chọn tất cả đơn chờ duyệt"
                        className="flex items-center justify-center"
                      >
                        {isAllPendingSelected ? (
                          <CheckSquare className="size-4 text-primary" />
                        ) : (
                          <Square className="size-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>Nhân viên</TableHead>
                    <TableHead>Phòng ban</TableHead>
                    <TableHead>Loại đơn</TableHead>
                    <TableHead>Thời gian nghỉ</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Người duyệt</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeaves.map((leave) => {
                    const isPending = leave.status === "PENDING"
                    const isSelected = selectedIds.includes(leave.id)

                    return (
                      <TableRow
                        key={leave.id}
                        onClick={() => setDetailTarget(leave)}
                        data-state={isSelected ? "selected" : undefined}
                        className="cursor-pointer"
                      >
                        {/* Checkbox */}
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          {isPending ? (
                            <button
                              onClick={() => handleToggleSelectOne(leave.id)}
                              aria-label="Chọn đơn"
                              className="flex items-center justify-center"
                            >
                              {isSelected ? (
                                <CheckSquare className="size-4 text-primary" />
                              ) : (
                                <Square className="size-4 text-muted-foreground" />
                              )}
                            </button>
                          ) : (
                            <span className="text-subtle-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Nhân viên */}
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar
                              initials={(leave.employee?.fullName ?? "NV")
                                .split(" ")
                                .slice(-2)
                                .map((w) => w[0])
                                .join("")
                                .toUpperCase()}
                              className="size-8 bg-primary-tint text-accent-foreground"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">
                                {leave.employee?.fullName ?? "Nhân viên"}
                              </p>
                              <p className="font-mono text-caption text-muted-foreground">
                                {leave.employee?.employeeCode ?? "—"}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Phòng ban */}
                        <TableCell className="text-secondary-foreground">
                          {leave.employee?.department?.name ?? "—"}
                        </TableCell>

                        {/* Loại phép */}
                        <TableCell>
                          <Badge variant="outline">{leaveTypeLabel(leave.type)}</Badge>
                        </TableCell>

                        {/* Thời gian */}
                        <TableCell>
                          <div>
                            <span className="tabular font-medium text-foreground">
                              {requestDurationLabel(leave)}
                            </span>
                            <p className="tabular text-caption text-muted-foreground">
                              {fmtVNDate(leave.startDate)} → {fmtVNDate(leave.endDate)}
                            </p>
                          </div>
                        </TableCell>

                        {/* Lý do */}
                        <TableCell className="max-w-xs truncate text-secondary-foreground" title={leave.reason}>
                          {leave.reason}
                        </TableCell>

                        {/* Trạng thái */}
                        <TableCell className="whitespace-nowrap">
                          {leave.status === "PENDING" && (
                            <Badge variant="warning">
                              <Clock /> Chờ duyệt
                            </Badge>
                          )}
                          {leave.status === "APPROVED" && (
                            <Badge variant="success">
                              <CheckCircle2 /> Đã duyệt
                            </Badge>
                          )}
                          {leave.status === "REJECTED" && (
                            <Badge variant="destructive">
                              <XCircle /> Từ chối
                            </Badge>
                          )}
                          {leave.status === "CANCELLED" && (
                            <Badge variant="secondary">
                              <span className="size-1.5 rounded-full bg-current" aria-hidden /> Đã hủy
                            </Badge>
                          )}
                        </TableCell>

                        {/* Người duyệt */}
                        <TableCell className="max-w-[200px] truncate text-secondary-foreground">
                          {leave.approvedBy ? (
                            <span>{leave.approvedBy.fullName}</span>
                          ) : leave.rejectionReason ? (
                            <span className="text-danger" title={leave.rejectionReason}>
                              Lý do: {leave.rejectionReason}
                            </span>
                          ) : (
                            <span className="text-subtle-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Thao tác */}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {isPending ? (
                            <Button size="sm" variant="outline" onClick={() => setDetailTarget(leave)}>
                              Xem & duyệt
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setDetailTarget(leave)}>
                              Xem chi tiết
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {/* VIEW 2: CALENDAR VIEW */}
      {viewMode === "calendar" && (
        <Card className="p-5 sm:p-6">
          {/* Điều khiển tháng lịch */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <span className="tabular text-h3 font-semibold text-foreground">
                Lịch đơn tháng {String(calMonth).padStart(2, "0")}/{calYear}
              </span>
              <div className="flex items-center gap-0.5">
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Tháng trước"
                  onClick={() => {
                    if (calMonth === 1) {
                      setCalMonth(12)
                      setCalYear(calYear - 1)
                    } else {
                      setCalMonth(calMonth - 1)
                    }
                  }}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="Tháng sau"
                  onClick={() => {
                    if (calMonth === 12) {
                      setCalMonth(1)
                      setCalYear(calYear + 1)
                    } else {
                      setCalMonth(calMonth + 1)
                    }
                  }}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-caption text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-success" /> Đã duyệt
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-warning" /> Chờ duyệt
              </div>
            </div>
          </div>

          {/* Grid 7 cột */}
          <div className="overflow-x-auto">
            <div className="mt-4 grid min-w-[640px] grid-cols-7 gap-2">
              {/* Header Thứ 2 -> CN */}
              {DAY_NAMES.map((d) => (
                <div
                  key={d}
                  className="rounded-md bg-sunken py-1 text-center text-caption font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}

              {/* Ô trống đầu tháng */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[88px] rounded-md border border-dashed border-border-subtle bg-sunken" />
              ))}

              {/* Các ngày trong tháng */}
              {calDays.map(({ day, dateStr, leaves: dayLeaves }) => {
                const isToday = dateStr === todayVN()

                return (
                  <div
                    key={day}
                    className={`flex min-h-[88px] flex-col justify-between rounded-md border p-1.5 transition-colors ${
                      isToday ? "border-primary bg-primary-tint" : "border-border bg-card hover:bg-sunken"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`tabular text-caption font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                        {day}
                      </span>
                      {dayLeaves.length > 0 && (
                        <span className="tabular text-micro text-muted-foreground">{dayLeaves.length} NV</span>
                      )}
                    </div>

                    {/* Danh sách người nghỉ trong ngày */}
                    <div className="mt-1 flex max-h-[60px] flex-col gap-1 overflow-y-auto">
                      {dayLeaves.map((l) => (
                        <div
                          key={l.id}
                          className={`truncate rounded-sm px-1 py-0.5 text-micro font-medium ${
                            l.status === "APPROVED" ? "bg-success-tint text-success" : "bg-warning-tint text-warning"
                          }`}
                          title={`${l.employee?.fullName} (${leaveTypeLabel(l.type)}): ${l.reason}`}
                        >
                          {l.employee?.fullName}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Modal chi tiết & phê duyệt — nút "Xem & Duyệt" (trước đây thiếu render nên bấm không có tác dụng) */}
      <LeaveDetailModal
        leave={
          detailTarget
            ? {
                id: detailTarget.id,
                type: detailTarget.type,
                startDate: detailTarget.startDate,
                endDate: detailTarget.endDate,
                totalDays: detailTarget.totalDays,
                overtimeHours: detailTarget.overtimeHours,
                reason: detailTarget.reason,
                status: detailTarget.status,
                rejectionReason: detailTarget.rejectionReason,
                approvedBy: detailTarget.approvedBy,
                createdAt: detailTarget.createdAt,
                employee: {
                  id: detailTarget.employee?.id,
                  fullName: detailTarget.employee?.fullName ?? "Nhân viên",
                  employeeCode: detailTarget.employee?.employeeCode ?? "--",
                  department: detailTarget.employee?.department ?? null,
                },
              }
            : null
        }
        isOpen={detailTarget !== null}
        onClose={() => setDetailTarget(null)}
        onApprove={handleApprove}
        onReject={handleModalReject}
      />
    </div>
  )
}

function SummaryChip({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  tone: string
  label: string
  value: number
  hint: string
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-md ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-body-sm text-muted-foreground">{label}</p>
        <p className="tabular text-h2 font-semibold text-foreground">{value}</p>
        <p className="truncate text-caption text-muted-foreground">{hint}</p>
      </div>
    </Card>
  )
}
