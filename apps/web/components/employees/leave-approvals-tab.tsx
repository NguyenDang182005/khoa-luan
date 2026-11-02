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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useAuth } from "@/lib/auth-context"
import { leaveApi } from "@/lib/api/leave.api"
import type { LeaveRequest } from "@/lib/schemas/leave.schema"
import { leaveTypeLabel, todayVN } from "@/lib/utils"
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
  const { user } = useAuth()
  const approverId = user?.employee?.id ?? ""

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
    const totalDays = leaves
      .filter((l) => l.status === "APPROVED")
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
  const handleApprove = async (id: string) => {
    if (!approverId) return
    setActionSuccess(null)
    try {
      await leaveApi.approve(id)
      setActionSuccess("Đã phê duyệt đơn nghỉ phép thành công!")
      setSelectedIds((prev) => prev.filter((i) => i !== id))
      await fetchLeaves()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Phê duyệt thất bại.")
    }
  }

  // Từ chối từ trong LeaveDetailModal (nút "Xem & Duyệt")
  const handleModalReject = async (id: string, reason: string) => {
    if (!approverId) return
    try {
      await leaveApi.reject(id, reason)
      setActionSuccess("Đã từ chối đơn nghỉ phép.")
      setSelectedIds((prev) => prev.filter((i) => i !== id))
      await fetchLeaves()
    } catch (e: unknown) {
      console.error(e)
      alert(e instanceof Error ? e.message : "Từ chối thất bại.")
    }
  }

  // Thao tác duyệt hàng loạt
  const handleBulkApprove = async () => {
    if (!approverId || selectedIds.length === 0) return
    if (!confirm(`Bạn có chắc chắn muốn duyệt đồng loạt ${selectedIds.length} đơn nghỉ phép đã chọn?`)) return
    setIsBulkProcessing(true)
    setActionSuccess(null)
    try {
      await leaveApi.approveBulk(selectedIds)
      setActionSuccess(`Đã phê duyệt thành công ${selectedIds.length} đơn nghỉ phép!`)
      setSelectedIds([])
      await fetchLeaves()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Xử lý hàng loạt thất bại.")
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

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* 4 Thẻ KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Đơn Chờ Duyệt</span>
              <Clock className="size-4 text-amber-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-2xl font-bold text-amber-400">{kpis.pending}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Cần xử lý ngay</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Đã Phê Duyệt</span>
              <CheckCircle2 className="size-4 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-2xl font-bold text-emerald-400">{kpis.approved}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Đã chốt công phép</p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Đã Từ Chối</span>
              <XCircle className="size-4 text-rose-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-2xl font-bold text-rose-400">{kpis.rejected}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Không được phê duyệt</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-1">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Tổng Ngày Nghỉ</span>
              <CalendarIcon className="size-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-2xl font-bold text-foreground">{kpis.totalDays}</span>
            <span className="text-xs text-muted-foreground font-normal ml-1">ngày đã duyệt</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Toàn công ty</p>
          </CardContent>
        </Card>
      </div>

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-400 flex items-center justify-between animate-in fade-in">
          <span>{actionSuccess}</span>
          <Button size="icon-xs" variant="ghost" onClick={() => setActionSuccess(null)}>
            <XCircle className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Thanh Bộ Lọc & Điều Hướng View */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search & Department Filter */}
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm nhân viên, mã NV, lý do..."
                  className="pl-8 text-xs h-9"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
                {[
                  { key: "ALL", label: "Tất Cả" },
                  { key: "PENDING", label: `Chờ Duyệt (${kpis.pending})` },
                  { key: "APPROVED", label: "Đã Duyệt" },
                  { key: "REJECTED", label: "Từ Chối" },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setStatusFilter(s.key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      statusFilter === s.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Department Select */}
              {availableDepts.length > 0 && (
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary h-9"
                >
                  <option value="ALL">Mọi Phòng Ban</option>
                  {availableDepts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Switch View Mode: Table / Calendar */}
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
                <button
                  onClick={() => setViewMode("table")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    viewMode === "table"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Bảng
                </button>
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    viewMode === "calendar"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Lịch Nghỉ
                </button>
              </div>
            </div>
          </div>

          {/* Thanh tác vụ hàng loạt khi có checkbox được chọn */}
          {selectedIds.length > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <CheckCircle2 className="size-4" />
                <span>Đang chọn {selectedIds.length} đơn nghỉ phép</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleBulkApprove}
                  disabled={isBulkProcessing}
                >
                  {isBulkProcessing && <Loader2 className="size-3.5 animate-spin" />}
                  Duyệt Các Mục Đã Chọn ({selectedIds.length})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setSelectedIds([])}
                >
                  Bỏ chọn
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* VIEW 1: TABLE VIEW */}
      {viewMode === "table" && (
        <Card className="border-border overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-48 flex-col items-center justify-center text-xs text-muted-foreground">
                <Loader2 className="size-6 animate-spin mb-2 text-primary" />
                Đang tải danh sách đơn nghỉ phép...
              </div>
            ) : filteredLeaves.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-xs text-muted-foreground">
                <FileText className="size-8 text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground">Không tìm thấy đơn nghỉ phép nào</p>
                <p className="text-[11px]">Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-10 text-center">
                        <button
                          onClick={handleToggleSelectAll}
                          title="Chọn tất cả đơn chờ duyệt"
                          className="flex items-center justify-center"
                        >
                          {isAllPendingSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4 text-muted-foreground" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="text-xs">Nhân Viên</TableHead>
                      <TableHead className="text-xs">Phòng Ban</TableHead>
                      <TableHead className="text-xs">Loại Nghỉ Phép</TableHead>
                      <TableHead className="text-xs">Thời Gian Nghỉ</TableHead>
                      <TableHead className="text-xs">Lý Do</TableHead>
                      <TableHead className="text-xs">Trạng Thái</TableHead>
                      <TableHead className="text-xs">Người Duyệt</TableHead>
                      <TableHead className="text-xs text-right">Thao Tác</TableHead>
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
                          className={`text-xs hover:bg-muted/20 transition-colors cursor-pointer ${
                            isSelected ? "bg-primary/5" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            {isPending ? (
                              <button
                                onClick={() => handleToggleSelectOne(leave.id)}
                                className="flex items-center justify-center"
                              >
                                {isSelected ? (
                                  <CheckSquare className="size-4 text-primary" />
                                ) : (
                                  <Square className="size-4 text-muted-foreground" />
                                )}
                              </button>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </TableCell>

                          {/* Nhân viên */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                initials={(leave.employee?.fullName ?? "NV")
                                  .split(" ")
                                  .slice(-2)
                                  .map((w) => w[0])
                                  .join("")
                                  .toUpperCase()}
                                className="size-7 bg-primary/20 text-primary border border-primary/30"
                              />
                              <div>
                                <p className="font-semibold text-foreground">
                                  {leave.employee?.fullName ?? "Nhân viên"}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {leave.employee?.employeeCode ?? "—"}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Phòng ban */}
                          <TableCell className="text-muted-foreground">
                            {leave.employee?.department?.name ?? "—"}
                          </TableCell>

                          {/* Loại phép */}
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-medium border-border">
                              {leaveTypeLabel(leave.type)}
                            </Badge>
                          </TableCell>

                          {/* Thời gian */}
                          <TableCell>
                            <div>
                              <span className="font-semibold text-foreground">
                                {leave.totalDays} ngày
                              </span>
                              <p className="text-[10px] text-muted-foreground">
                                {leave.startDate.slice(0, 10)} → {leave.endDate.slice(0, 10)}
                              </p>
                            </div>
                          </TableCell>

                          {/* Lý do */}
                          <TableCell className="max-w-xs truncate text-muted-foreground italic" title={leave.reason}>
                            &ldquo;{leave.reason}&rdquo;
                          </TableCell>

                          {/* Trạng thái */}
                          <TableCell className="whitespace-nowrap">
                            {leave.status === "PENDING" && (
                              <Badge variant="warning" className="text-[10px] gap-1 whitespace-nowrap">
                                <Clock className="size-3" /> Chờ duyệt
                              </Badge>
                            )}
                            {leave.status === "APPROVED" && (
                              <Badge variant="success" className="text-[10px] gap-1 whitespace-nowrap">
                                <CheckCircle2 className="size-3" /> Đã duyệt
                              </Badge>
                            )}
                            {leave.status === "REJECTED" && (
                              <Badge variant="destructive" className="text-[10px] gap-1 whitespace-nowrap">
                                <XCircle className="size-3" /> Từ chối
                              </Badge>
                            )}
                            {leave.status === "CANCELLED" && (
                              <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                                Đã hủy
                              </Badge>
                            )}
                          </TableCell>

                          {/* Người duyệt */}
                          <TableCell className="text-[11px] text-muted-foreground">
                            {leave.approvedBy ? (
                              <span>{leave.approvedBy.fullName}</span>
                            ) : leave.rejectionReason ? (
                              <span className="text-rose-400" title={leave.rejectionReason}>
                                Lý do: {leave.rejectionReason}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </TableCell>

                          {/* Thao tác */}
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="xs"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => setDetailTarget(leave)}
                                >
                                  Xem & Duyệt
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="xs"
                                variant="ghost"
                                className="text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setDetailTarget(leave)}
                              >
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
          </CardContent>
        </Card>
      )}

      {/* VIEW 2: CALENDAR VIEW */}
      {viewMode === "calendar" && (
        <Card className="border-border p-4">
          {/* Điều khiển tháng lịch */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-foreground">
                Lịch Nghỉ Phép Tháng {String(calMonth).padStart(2, "0")}/{calYear}
              </span>
              <div className="flex items-center rounded-lg border border-border bg-background">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => {
                    if (calMonth === 1) {
                      setCalMonth(12)
                      setCalYear(calYear - 1)
                    } else {
                      setCalMonth(calMonth - 1)
                    }
                  }}
                  className="size-6 text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => {
                    if (calMonth === 12) {
                      setCalMonth(1)
                      setCalYear(calYear + 1)
                    } else {
                      setCalMonth(calMonth + 1)
                    }
                  }}
                  className="size-6 text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" /> Đã duyệt
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" /> Chờ duyệt
              </div>
            </div>
          </div>

          {/* Grid 7 cột */}
          <div className="mt-4 grid grid-cols-7 gap-2">
            {/* Header Thứ 2 -> CN */}
            {DAY_NAMES.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-xs font-semibold uppercase text-muted-foreground bg-muted/20 rounded-md"
              >
                {d}
              </div>
            ))}

            {/* Ô trống đầu tháng */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] rounded-lg border border-dashed border-border/30 bg-muted/5 opacity-40" />
            ))}

            {/* Các ngày trong tháng */}
            {calDays.map(({ day, dateStr, leaves: dayLeaves }) => {
              const isToday = dateStr === todayVN()

              return (
                <div
                  key={day}
                  className={`min-h-[80px] rounded-lg border p-1.5 flex flex-col justify-between transition-colors ${
                    isToday
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card/50 hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {day}
                    </span>
                    {dayLeaves.length > 0 && (
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {dayLeaves.length} NV
                      </span>
                    )}
                  </div>

                  {/* Danh sách người nghỉ trong ngày */}
                  <div className="mt-1 flex flex-col gap-1 overflow-y-auto max-h-[60px]">
                    {dayLeaves.map((l) => (
                      <div
                        key={l.id}
                        className={`truncate rounded px-1 py-0.5 text-[9px] font-medium ${
                          l.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
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
