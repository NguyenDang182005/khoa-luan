"use client"

import { useState, useEffect, useCallback } from "react"
import { employeesApi } from "@/lib/api/employees.api"
import type { CreateEmployeeInput, UpdateAccountInput, EmployeeDetail } from "@/lib/api/employees.api"
import { leaveApi } from "@/lib/api/leave.api"
import { attendanceApi } from "@/lib/api/attendance.api"
import { payrollApi } from "@/lib/api/payroll.api"
import type { Employee, Department } from "@/lib/schemas/employee.schema"
import type { Position } from "@/lib/api/employees.api"
import type { ResetPasswordResult } from "@/lib/schemas/employee.schema"
import * as React from "react"
import { useAuth } from "@/lib/auth-context"
import {
  Search,
  X,
  Loader2,
  AlertTriangle,
  Download,
  Plus,
  Users,
  ChevronRight,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LeaveApprovalsTab } from "@/components/employees/leave-approvals-tab"
import { OnboardingManagementTab } from "@/components/employees/onboarding-management-tab"
import { employeeStatusLabel, leaveTypeLabel, payrollStatusLabel, currentMonthYearVN, todayVN, vnd, fmtVNDate } from "@/lib/utils"

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: "Chính thức (Toàn thời gian)",
  PART_TIME: "Bán thời gian",
  PROBATION: "Thử việc",
  FREELANCE: "Freelance",
  INTERNSHIP: "Thực tập",
}

/** Native <select> trông giống Input primitive */
const SELECT_CLASS =
  "w-full rounded-md border border-input bg-card px-3 text-body text-foreground transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60"

function statusVariant(status: string): "success" | "warning" | "secondary" | "destructive" {
  return status === "ACTIVE" ? "success" : status === "PROBATION" ? "warning" : status === "TERMINATED" ? "destructive" : "secondary"
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 text-body font-semibold text-foreground">{children}</h4>
}

function initialsOf(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .slice(-2)
      .join("")
      .toUpperCase() || "?"
  )
}

interface EmployeesViewProps {
  /** Từ khóa được đẩy từ global search (vd. chọn một nhân viên) */
  initialSearch?: string
  onInitialSearchApplied?: () => void
}

export function EmployeesView({ initialSearch, onInitialSearchApplied }: EmployeesViewProps = {}) {
  const { user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === "ADMIN"
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const LIMIT = 10

  // Drawer data — thật
  const [drawerDetail, setDrawerDetail] = useState<EmployeeDetail | null | undefined>(undefined)
  const [drawerLeave, setDrawerLeave] = useState<{ remainingDays: number; totalDays: number } | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<{ phone: string; address: string; dateOfBirth: string; nationalId: string }>({
    phone: "",
    address: "",
    dateOfBirth: "",
    nationalId: "",
  })
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  // Edit Account dialog
  const [editAccountOpen, setEditAccountOpen] = useState(false)
  const [editAccountForm, setEditAccountForm] = useState<UpdateAccountInput>({ email: "", role: "EMPLOYEE" })
  const [editAccountBusy, setEditAccountBusy] = useState(false)
  const [editAccountError, setEditAccountError] = useState<string | null>(null)

  // Reset Password dialog — admin đặt lại mật khẩu cho nhân viên
  const [resetOpen, setResetOpen] = useState(false)
  const [resetAuto, setResetAuto] = useState(true) // true = server tự sinh mật khẩu
  const [resetPasswordInput, setResetPasswordInput] = useState("")
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetResult, setResetResult] = useState<ResetPasswordResult | null>(null)
  const [copied, setCopied] = useState(false)

  // Add dialog
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<CreateEmployeeInput>({ fullName: "", email: "", joinDate: todayVN(), departmentId: "", positionId: "", role: "EMPLOYEE" })
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})
  const [addBusy, setAddBusy] = useState(false)

  // Debounce search 300ms — không fetch mỗi keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Global search chọn nhân viên → nạp từ khóa vào trang này
  useEffect(() => {
    if (!initialSearch) return
    setSearchInput(initialSearch)
    setSearchQuery(initialSearch)
    setPage(1)
    onInitialSearchApplied?.()
  }, [initialSearch, onInitialSearchApplied])

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await employeesApi.list({ search: searchQuery || undefined, departmentId: selectedDeptId ?? undefined, page, limit: LIMIT })
      setEmployees(result.data)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (e) {
      console.error(e)
      setError("Không tải được danh sách nhân sự. Kiểm tra API server.")
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedDeptId, page])

  useEffect(() => {
    employeesApi.getDepartments().then(setDepartments).catch(console.error)
    employeesApi.getPositions().then(setPositions).catch(() => setPositions([]))
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  // Mở drawer → fetch chi tiết đầy đủ (hồ sơ + hợp đồng + quản lý) + phép năm thật
  const openDrawer = useCallback(async (emp: Employee) => {
    setSelectedEmployee(emp)
    setDrawerDetail(undefined)
    setDrawerLeave(null)
    setEditOpen(false)
    setEditError(null)
    const [detailRes, leaveRes] = await Promise.allSettled([
      employeesApi.getById(emp.id),
      leaveApi.getBalance(emp.id),
    ])
    if (detailRes.status === "fulfilled") {
      const d = detailRes.value
      setDrawerDetail(d)
      setEditForm({
        phone: d.phone ?? "",
        address: d.address ?? "",
        dateOfBirth: d.dateOfBirth ? d.dateOfBirth.slice(0, 10) : "",
        nationalId: d.nationalId ?? "",
      })
    } else {
      setDrawerDetail(null)
    }
    if (leaveRes.status === "fulfilled") {
      setDrawerLeave({ remainingDays: leaveRes.value.remainingDays, totalDays: leaveRes.value.totalDays })
    }
  }, [])

  const handleCreateEmployee = async () => {
    setAddErrors({})
    const errs: Record<string, string> = {}
    if (addForm.fullName.trim().length < 2) errs.fullName = "Họ tên tối thiểu 2 ký tự"
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addForm.email)) errs.email = "Email không hợp lệ"
    if (!addForm.departmentId) errs.departmentId = "Vui lòng chọn phòng ban"
    if (!addForm.positionId) errs.positionId = "Vui lòng chọn chức vụ"
    if (!addForm.joinDate) errs.joinDate = "Vui lòng chọn ngày vào làm"
    if (Object.keys(errs).length > 0) {
      setAddErrors(errs)
      return
    }
    setAddBusy(true)
    try {
      await employeesApi.create({ ...addForm, fullName: addForm.fullName.trim() })
      setShowAdd(false)
      setAddForm({ fullName: "", email: "", joinDate: todayVN(), departmentId: "", positionId: "" })
      setPage(1)
      await fetchEmployees()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setAddErrors({ form: Array.isArray(msg) ? msg.join(", ") : msg ?? "Tạo nhân viên thất bại." })
    } finally {
      setAddBusy(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedEmployee) return
    setEditBusy(true)
    setEditError(null)
    try {
      const updated = await employeesApi.update(selectedEmployee.id, {
        phone: editForm.phone.trim() || undefined,
        address: editForm.address.trim() || undefined,
        dateOfBirth: editForm.dateOfBirth || undefined,
        nationalId: editForm.nationalId.trim() || undefined,
      })
      setDrawerDetail(updated)
      setEditOpen(false)
      fetchEmployees()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setEditError(Array.isArray(msg) ? msg.join(", ") : msg ?? "Cập nhật hồ sơ thất bại.")
    } finally {
      setEditBusy(false)
    }
  }

  const handleSaveAccount = async () => {
    if (!selectedEmployee) return
    setEditAccountBusy(true)
    setEditAccountError(null)
    try {
      const payload: UpdateAccountInput = {}
      if (editAccountForm.email?.trim()) payload.email = editAccountForm.email.trim()
      if (editAccountForm.role) payload.role = editAccountForm.role
      if (!payload.email && !payload.role) {
        setEditAccountError("Vui lòng nhập email mới hoặc chọn role.")
        setEditAccountBusy(false)
        return
      }
      // Email là whitelist OAuth (Google/Facebook): POST /auth/firebase tra User theo email,
      // nên phải chặn định dạng sai ngay ở client trước khi gửi API.
      if (payload.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) {
        setEditAccountError("Email không hợp lệ — cần dạng ten@domain.com. Email này chính là tài khoản Google/Facebook nhân viên dùng để đăng nhập.")
        setEditAccountBusy(false)
        return
      }
      await employeesApi.updateAccount(selectedEmployee.id, payload)
      const updated = await employeesApi.getById(selectedEmployee.id)
      setDrawerDetail(updated)
      setEditAccountOpen(false)
      fetchEmployees()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setEditAccountError(Array.isArray(msg) ? msg.join(", ") : msg ?? "Cập nhật tài khoản thất bại.")
    } finally {
      setEditAccountBusy(false)
    }
  }

  /** Mở dialog đặt lại mật khẩu — trạng thái sạch mỗi lần mở */
  const openResetPassword = () => {
    setResetAuto(true)
    setResetPasswordInput("")
    setResetError(null)
    setResetResult(null)
    setCopied(false)
    setResetOpen(true)
  }

  const handleResetPassword = async () => {
    if (!selectedEmployee) return
    if (!resetAuto && resetPasswordInput.trim().length === 0) {
      setResetError("Vui lòng nhập mật khẩu mới hoặc bật chế độ tự sinh.")
      return
    }
    setResetBusy(true)
    setResetError(null)
    try {
      const res = await employeesApi.resetPassword(
        selectedEmployee.id,
        resetAuto
          ? { mode: "GENERATE" }
          : { mode: "MANUAL", newPassword: resetPasswordInput.trim() },
      )
      setResetResult(res)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setResetError(Array.isArray(msg) ? msg.join(", ") : msg ?? "Đặt lại mật khẩu thất bại.")
    } finally {
      setResetBusy(false)
    }
  }

  const copyGeneratedPassword = async () => {
    if (!resetResult?.generatedPassword) return
    try {
      await navigator.clipboard.writeText(resetResult.generatedPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API có thể bị trình duyệt chặn — admin vẫn quét chọn/copy tay được
    }
  }

  const handleChangeStatus = async (status: string) => {
    if (!selectedEmployee || !drawerDetail || status === drawerDetail.status) return
    if (status === "TERMINATED" && !window.confirm("Xác nhận đánh dấu nhân viên này NGHỈ VIỆC?")) return
    setStatusBusy(true)
    setEditError(null)
    try {
      const updated = await employeesApi.updateStatus(selectedEmployee.id, status)
      setDrawerDetail(updated)
      setSelectedEmployee({ ...selectedEmployee, status: updated.status })
      fetchEmployees()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setEditError(Array.isArray(msg) ? msg.join(", ") : msg ?? "Đổi trạng thái thất bại.")
    } finally {
      setStatusBusy(false)
    }
  }

  // Xuất TOÀN BỘ kết quả theo bộ lọc hiện tại (API giới hạn 100 dòng/trang → lặp đủ số trang)
  const [exporting, setExporting] = useState(false)
  const exportCsv = async () => {
    setExporting(true)
    let all: typeof employees = []
    try {
      const filter = { search: searchQuery || undefined, departmentId: selectedDeptId ?? undefined, limit: 100 }
      let p = 1, pages = 1
      do {
        const res = await employeesApi.list({ ...filter, page: p })
        all = all.concat(res.data)
        pages = res.totalPages
        p++
      } while (p <= pages)
    } catch {
      setError("Không xuất được danh sách. Vui lòng thử lại.")
      setExporting(false)
      return
    }
    setExporting(false)
    const header = ["Mã NV", "Họ tên", "Email", "Phòng ban", "Chức vụ", "Ngày vào làm", "Trạng thái"]
    const rows = all.map((e) => [
      e.employeeCode, e.fullName, e.email, e.department.name, e.position.title, fmtVNDate(e.joinDate), employeeStatusLabel(e.status),
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `danh-ba-nhan-su-trang-${page}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="relative flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-semibold text-foreground">Hồ sơ nhân sự</h1>
          <p className="mt-1 text-body text-muted-foreground">
            Quản lý hồ sơ nhân viên, duyệt đơn và theo dõi tiến độ hội nhập
          </p>
        </div>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">
            <span className="sm:hidden">Nhân sự</span>
            <span className="hidden sm:inline">Danh sách nhân sự</span>{" "}
            <span className="tabular text-muted-foreground">({total})</span>
          </TabsTrigger>
          <TabsTrigger value="leave-approvals">Duyệt đơn</TabsTrigger>
          <TabsTrigger value="onboarding">Lộ trình hội nhập</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6 flex flex-col gap-4">
          {/* Toolbar: tìm kiếm, lọc phòng ban, hành động */}
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tên, mã NV hoặc email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 pl-9"
                  aria-label="Tìm nhân viên"
                />
              </div>
              <select
                value={selectedDeptId ?? ""}
                onChange={(e) => { setSelectedDeptId(e.target.value || null); setPage(1) }}
                className={`${SELECT_CLASS} h-9 sm:w-56`}
                aria-label="Lọc theo phòng ban"
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              <span className="whitespace-nowrap text-body-sm text-muted-foreground">
                <span className="tabular font-medium text-foreground">{total}</span> hồ sơ
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={exportCsv} disabled={total === 0 || exporting}>
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {exporting ? "Đang xuất..." : "Xuất Excel"}
              </Button>
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="size-4" /> Thêm nhân viên
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-tint px-3 py-2 text-body-sm text-danger">
              <AlertTriangle className="size-4 shrink-0" /> {error}
            </div>
          )}

          {/* Table */}
          <Card className="gap-0 overflow-hidden p-0">
            {loading ? (
              <div className="flex flex-col gap-3 p-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-10 rounded-md" />
                ))}
              </div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Users className="size-5" />
                </div>
                <p className="text-body font-semibold text-foreground">Không tìm thấy nhân sự phù hợp</p>
                {searchQuery && <p className="text-body-sm text-muted-foreground">Từ khóa: &quot;{searchQuery}&quot;</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[360px] md:min-w-[560px] xl:min-w-[880px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead className="hidden xl:table-cell">Email</TableHead>
                      <TableHead className="hidden md:table-cell">Phòng ban</TableHead>
                      <TableHead className="hidden xl:table-cell">Chức danh</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="hidden lg:table-cell">Ngày vào</TableHead>
                      <TableHead className="hidden w-12 sm:table-cell"><span className="sr-only">Thao tác</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow
                        key={emp.id}
                        onClick={() => openDrawer(emp)}
                        data-state={selectedEmployee?.id === emp.id ? "selected" : undefined}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar initials={initialsOf(emp.fullName)} className="size-8 bg-primary-tint text-accent-foreground" />
                            <div className="min-w-0">
                              <p className="truncate text-body-sm font-medium text-foreground">{emp.fullName}</p>
                              <p className="font-mono text-caption text-muted-foreground">{emp.employeeCode}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-secondary-foreground xl:table-cell">{emp.email}</TableCell>
                        <TableCell className="hidden text-foreground md:table-cell">{emp.department.name}</TableCell>
                        <TableCell className="hidden text-secondary-foreground xl:table-cell">{emp.position.title}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(emp.status)}>
                            <span className="size-1.5 rounded-full bg-current" aria-hidden />
                            {employeeStatusLabel(emp.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular hidden text-secondary-foreground lg:table-cell">{fmtVNDate(emp.joinDate)}</TableCell>
                        <TableCell className="hidden text-right sm:table-cell">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Xem hồ sơ ${emp.fullName}`}
                            onClick={(e) => { e.stopPropagation(); openDrawer(emp) }}
                          >
                            <ChevronRight className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-body-sm text-muted-foreground">
            <span className="tabular">
              {loading ? "..." : `Tổng ${total} hồ sơ • Trang ${page}/${totalPages}`}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Trang trước
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Trang sau
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leave-approvals" className="mt-6">
          <LeaveApprovalsTab departments={departments} />
        </TabsContent>

        <TabsContent value="onboarding" className="mt-6">
          <OnboardingManagementTab />
        </TabsContent>
      </Tabs>

      {/* Slide-over Profile Drawer — dữ liệu thật, 5 nhóm thông tin */}
      {selectedEmployee && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[var(--overlay)] animate-in fade-in-0 duration-150"
            onClick={() => setSelectedEmployee(null)}
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-border bg-card shadow-modal animate-in slide-in-from-right duration-200">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar initials={initialsOf(selectedEmployee.fullName)} className="size-10 bg-primary-tint text-body-sm text-accent-foreground" />
                <div className="min-w-0">
                  <h3 className="truncate text-h3 font-semibold text-foreground">{selectedEmployee.fullName}</h3>
                  <p className="truncate text-caption text-muted-foreground">
                    <span className="font-mono">{selectedEmployee.employeeCode}</span> • {selectedEmployee.position.title}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedEmployee(null)} aria-label="Đóng hồ sơ">
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5 text-body-sm">
              {editError && (
                <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-tint px-3 py-2 text-body-sm text-danger">
                  <AlertTriangle className="size-4 shrink-0" /> {editError}
                </div>
              )}

              {/* 1. Hồ sơ cá nhân */}
              <section>
                <SectionTitle>Hồ sơ cá nhân</SectionTitle>
                <div className="flex flex-col">
                  <Row label="Ngày sinh" value={fmtDate(drawerDetail?.dateOfBirth)} />
                  <Row label="Giới tính" value={genderLabel(drawerDetail?.gender)} />
                  <Row label="Số CCCD" value={drawerDetail?.nationalId || "--"} mono />
                  <Row label="Số điện thoại" value={drawerDetail?.phone || "--"} mono />
                  <Row label="Địa chỉ" value={drawerDetail?.address || "--"} />
                </div>
              </section>

              {/* 2. Nghề vụ & hợp đồng */}
              <section>
                <SectionTitle>Nghề vụ & HĐLĐ</SectionTitle>
                <div className="flex flex-col">
                  <Row label="Phòng ban" value={selectedEmployee.department.name} />
                  <Row label="Chức danh" value={selectedEmployee.position.title} />
                  <Row
                    label="Quản lý trực tiếp"
                    value={
                      drawerDetail === undefined ? (
                        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        drawerDetail?.manager
                          ? `${drawerDetail.manager.fullName} (${drawerDetail.manager.employeeCode})`
                          : "—"
                      )
                    }
                  />
                  <Row label="Ngày vào làm việc" value={fmtVNDate(selectedEmployee.joinDate)} tabular />
                  <Row
                    label="Loại hợp đồng (active)"
                    value={
                      !drawerDetail ? (
                        drawerDetail === null ? (
                          "—"
                        ) : (
                          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                        )
                      ) : drawerDetail.contracts && drawerDetail.contracts.length > 0 ? (
                        CONTRACT_TYPE_LABEL[drawerDetail.contracts[0]!.type] ?? drawerDetail.contracts[0]!.type
                      ) : (
                        "Chưa có hợp đồng active"
                      )
                    }
                  />
                  {drawerDetail?.contracts && drawerDetail.contracts.length > 0 && (
                    <Row label="Số hợp đồng" value={drawerDetail.contracts[0]!.contractNumber} mono />
                  )}
                  <Row
                    label="Lương cơ bản (hợp đồng)"
                    value={drawerDetail?.contracts?.length ? vnd(drawerDetail.contracts[0]!.baseSalary) : "--"}
                    tabular
                  />
                  <Row
                    label="Phụ cấp"
                    value={drawerDetail?.contracts?.length ? vnd(drawerDetail.contracts[0]!.allowances) : "--"}
                    tabular
                  />
                </div>
              </section>

              {/* 3. Công & phép */}
              <section>
                <SectionTitle>Công & phép</SectionTitle>
                <div className="flex flex-col">
                  <Row
                    label="Phép năm còn lại / tổng"
                    value={drawerLeave ? `${drawerLeave.remainingDays}/${drawerLeave.totalDays} ngày` : "--"}
                    tabular
                  />
                </div>
                <AttendanceSummaryMini employeeId={selectedEmployee.id} />
              </section>

              {/* 4. Lịch sử lương */}
              <section>
                <SectionTitle>Lịch sử lương</SectionTitle>
                <PayrollHistoryMini employeeId={selectedEmployee.id} />
              </section>

              {/* 5. Trạng thái & tài khoản */}
              <section>
                <SectionTitle>Trạng thái & tài khoản</SectionTitle>
                <div className="flex flex-col">
                  {/* Email + OAuth provider đã liên kết */}
                  <div className="flex items-center justify-between gap-3 border-b border-border-subtle py-2.5">
                    <span className="shrink-0 text-muted-foreground">Email đăng nhập</span>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-foreground">{drawerDetail?.user?.email ?? selectedEmployee.email}</span>
                      {drawerDetail?.user?.googleId && (
                        <Badge variant="outline" title="Đã liên kết Google" className="h-5 px-1.5 text-micro">Google</Badge>
                      )}
                      {drawerDetail?.user?.facebookId && (
                        <Badge variant="outline" title="Đã liên kết Facebook" className="h-5 px-1.5 text-micro">Facebook</Badge>
                      )}
                    </div>
                  </div>
                  <Row
                    label="Role tài khoản"
                    value={
                      <Badge variant={drawerDetail?.user?.role === "ADMIN" ? "default" : "secondary"}>
                        {drawerDetail?.user?.role ?? "EMPLOYEE"}
                      </Badge>
                    }
                  />
                  <Row
                    label="Trạng thái làm việc"
                    value={
                      <Badge variant={statusVariant(drawerDetail?.status ?? selectedEmployee.status)}>
                        <span className="size-1.5 rounded-full bg-current" aria-hidden />
                        {employeeStatusLabel(drawerDetail?.status ?? selectedEmployee.status)}
                      </Badge>
                    }
                  />
                  <div className="flex items-center justify-between gap-3 border-b border-border-subtle py-2.5">
                    <span className="text-muted-foreground">Đổi trạng thái</span>
                    <select
                      value={drawerDetail?.status ?? selectedEmployee.status}
                      disabled={statusBusy || drawerDetail === undefined}
                      onChange={(e) => handleChangeStatus(e.target.value)}
                      className={`${SELECT_CLASS} h-8 w-auto text-body-sm`}
                      aria-label="Đổi trạng thái làm việc"
                    >
                      <option value="ACTIVE">Đang làm</option>
                      <option value="PROBATION">Thử việc</option>
                      <option value="ON_LEAVE">Nghỉ dài hạn</option>
                      <option value="TERMINATED">Nghỉ việc</option>
                    </select>
                  </div>
                  {/* Account actions — chỉ ADMIN */}
                  {isAdmin && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditAccountForm({
                            email: drawerDetail?.user?.email ?? "",
                            role: (drawerDetail?.user?.role ?? "EMPLOYEE") as "ADMIN" | "EMPLOYEE",
                          })
                          setEditAccountError(null)
                          setEditAccountOpen(true)
                        }}
                      >
                        Sửa email & role
                      </Button>
                      <Button variant="outline" size="sm" onClick={openResetPassword}>
                        Đặt lại mật khẩu
                      </Button>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <SectionTitle>Đơn gần đây</SectionTitle>
                <EmployeeLeavesMini employeeId={selectedEmployee.id} />
              </section>
            </div>

            {/* Footer cố định — sửa hồ sơ mở dialog chỉnh sửa sẵn có */}
            <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-card px-6 py-4">
              <Button variant="outline" onClick={() => setSelectedEmployee(null)}>Đóng</Button>
              <Button onClick={() => setEditOpen(true)}>Sửa hồ sơ</Button>
            </div>
          </div>
        </>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa hồ sơ — {selectedEmployee?.fullName}</DialogTitle>
          <DialogDescription>
            Chỉ hồ sơ cá nhân được sửa tại đây. Hợp đồng & lương thay đổi thông qua hợp đồng mới.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2 text-body-sm">
          <Field label="Số điện thoại">
            <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="mt-1.5 h-9" />
          </Field>
          <Field label="Địa chỉ">
            <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="mt-1.5 h-9" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Ngày sinh">
              <input
                type="date"
                value={editForm.dateOfBirth}
                onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                className={`mt-1.5 h-9 ${SELECT_CLASS}`}
              />
            </Field>
            <Field label="Số CCCD">
              <Input value={editForm.nationalId} onChange={(e) => setEditForm({ ...editForm, nationalId: e.target.value })} className="mt-1.5 h-9" />
            </Field>
          </div>
          {editError && <p className="text-body-sm text-danger">{editError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editBusy}>Hủy</Button>
          <Button variant="default" onClick={handleSaveEdit} disabled={editBusy}>
            {editBusy && <Loader2 className="size-3.5 animate-spin" />} Lưu thay đổi
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Add Employee Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogHeader>
          <DialogTitle>Thêm nhân viên mới</DialogTitle>
          <DialogDescription>
            Hệ thống tự sinh mã NV và gán lộ trình onboarding. Mã NV trùng hoặc email trùng sẽ bị từ chối.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2 text-body-sm">
          <Field label="Họ tên" error={addErrors.fullName}>
            <Input value={addForm.fullName} onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })} className="mt-1.5 h-9" />
          </Field>
          <Field label="Email" error={addErrors.email}>
            <Input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className="mt-1.5 h-9" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phòng ban" error={addErrors.departmentId}>
              <select
                value={addForm.departmentId}
                onChange={(e) => setAddForm({ ...addForm, departmentId: e.target.value })}
                className={`mt-1.5 h-9 ${SELECT_CLASS}`}
              >
                <option value="">— Chọn —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Chức vụ" error={addErrors.positionId}>
              <select
                value={addForm.positionId}
                onChange={(e) => setAddForm({ ...addForm, positionId: e.target.value })}
                className={`mt-1.5 h-9 ${SELECT_CLASS}`}
              >
                <option value="">— Chọn —</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Ngày vào làm" error={addErrors.joinDate}>
            <input
              type="date"
              value={addForm.joinDate}
              onChange={(e) => setAddForm({ ...addForm, joinDate: e.target.value })}
              className={`mt-1.5 h-9 ${SELECT_CLASS}`}
            />
          </Field>
          <Field label="Role tài khoản">
            <select
              value={addForm.role ?? "EMPLOYEE"}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value as "ADMIN" | "EMPLOYEE" })}
              className={`mt-1.5 h-9 ${SELECT_CLASS}`}
            >
              <option value="EMPLOYEE">Nhân viên</option>
              <option value="ADMIN">Quản trị</option>
            </select>
            <p className="mt-1.5 text-caption text-muted-foreground">
              Email này sẽ được kích hoạt làm whitelist đăng nhập (Email/Google/Facebook).
            </p>
          </Field>
          {addErrors.form && <p className="text-body-sm text-danger">{addErrors.form}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAdd(false)}>Hủy</Button>
          <Button variant="default" onClick={handleCreateEmployee} disabled={addBusy}>
            {addBusy && <Loader2 className="size-3.5 animate-spin" />} Tạo nhân viên
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={editAccountOpen} onOpenChange={setEditAccountOpen}>
        <DialogHeader>
          <DialogTitle>Sửa email & role — {selectedEmployee?.fullName}</DialogTitle>
          <DialogDescription>
            Thay đổi email đăng nhập hoặc role tài khoản. Email mới sẽ được dùng để đăng nhập bằng Google/Facebook.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2 text-body-sm">
          <Field label="Email đăng nhập mới">
            <Input
              type="email"
              value={editAccountForm.email ?? ""}
              onChange={(e) => setEditAccountForm({ ...editAccountForm, email: e.target.value })}
              placeholder="email@gmail.com hoặc email@facebook.com"
              className="mt-1.5 h-9"
            />
          </Field>
          <Field label="Role tài khoản">
            <select
              value={editAccountForm.role ?? "EMPLOYEE"}
              onChange={(e) => setEditAccountForm({ ...editAccountForm, role: e.target.value as "ADMIN" | "EMPLOYEE" })}
              className={`mt-1.5 h-9 ${SELECT_CLASS}`}
            >
              <option value="EMPLOYEE">Nhân viên</option>
              <option value="ADMIN">Quản trị</option>
            </select>
          </Field>
          {editAccountError && <p className="text-body-sm text-danger">{editAccountError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditAccountOpen(false)} disabled={editAccountBusy}>Hủy</Button>
          <Button variant="default" onClick={handleSaveAccount} disabled={editAccountBusy}>
            {editAccountBusy && <Loader2 className="size-3.5 animate-spin" />} Lưu tài khoản
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Reset Password Dialog — admin đặt lại mật khẩu cho nhân viên (mật khẩu tự sinh chỉ hiện 1 lần) */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogHeader>
          <DialogTitle>Đặt lại mật khẩu — {selectedEmployee?.fullName}</DialogTitle>
          <DialogDescription>
            Mật khẩu mới dùng cho đăng nhập bằng Email. Mọi phiên đăng nhập hiện có của nhân viên sẽ bị đăng xuất. Hệ thống không có email — hãy chuyển mật khẩu cho nhân viên trực tiếp.
          </DialogDescription>
        </DialogHeader>
        {resetResult ? (
          <div className="flex flex-col gap-4 py-2 text-body-sm">
            <p className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="size-4 shrink-0" />{resetResult.message}</p>
            {resetResult.generatedPassword && (
              <div className="rounded-lg border border-warning/20 bg-warning-tint p-3">
                <p className="mb-2 text-caption font-semibold text-warning">
                  Mật khẩu mới — chỉ hiển thị MỘT LẦN:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 select-all rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-body text-foreground">
                    {resetResult.generatedPassword}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyGeneratedPassword}>
                    {copied ? "Đã chép" : "Sao chép"}
                  </Button>
                </div>
                <p className="mt-2 text-caption text-muted-foreground">
                  Gửi cho nhân viên qua email {resetResult.email}. Sau khi đóng dialog sẽ không xem lại được.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2 text-body-sm">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-sunken p-3">
              <div>
                <p className="font-medium text-foreground">Tự sinh mật khẩu ngẫu nhiên</p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  Bỏ chọn nếu muốn tự nhập mật khẩu dễ nhớ — server vẫn kiểm tra theo chính sách bảo mật
                </p>
              </div>
              <Switch checked={resetAuto} onCheckedChange={(v) => setResetAuto(v)} />
            </div>
            {!resetAuto && (
              <Field label="Mật khẩu mới">
                <Input
                  type="text"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu mới cho nhân viên"
                  autoComplete="off"
                  className="mt-1.5 h-9 font-mono"
                />
              </Field>
            )}
            {resetError && <p className="text-body-sm text-danger">{resetError}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetBusy}>
            {resetResult ? "Đóng" : "Hủy"}
          </Button>
          {!resetResult && (
            <Button variant="default" onClick={handleResetPassword} disabled={resetBusy}>
              {resetBusy && <Loader2 className="size-3.5 animate-spin" />} Đặt lại mật khẩu
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </div>
  )
}

/** Danh sách đơn nghỉ phép gần đây của 1 nhân viên (fetch riêng trong drawer) */
function EmployeeLeavesMini({ employeeId }: { employeeId: string }) {
  const [leaves, setLeaves] = useState<Awaited<ReturnType<typeof leaveApi.list>> | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    leaveApi
      .list({ employeeId })
      .then((data) => { if (!cancelled) setLeaves(data.slice(0, 3)) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [employeeId])

  if (error) return <p className="text-body-sm text-muted-foreground">Không tải được danh sách đơn.</p>
  if (!leaves) return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
  if (leaves.length === 0) return <p className="text-body-sm text-muted-foreground">Chưa có đơn nào.</p>

  return (
    <div className="flex flex-col text-body-sm">
      {leaves.map((leave) => (
        <div key={leave.id} className="flex items-center justify-between gap-3 border-b border-border-subtle py-2.5 last:border-0">
          <span className="tabular text-foreground">
            {leaveTypeLabel(leave.type)} • {fmtVNDate(leave.startDate)} → {fmtVNDate(leave.endDate)}
          </span>
          <Badge variant={leave.status === "APPROVED" ? "success" : leave.status === "REJECTED" ? "destructive" : "warning"}>
            {leave.status === "APPROVED" ? "Đã duyệt" : leave.status === "REJECTED" ? "Từ chối" : leave.status === "CANCELLED" ? "Đã hủy" : "Chờ duyệt"}
          </Badge>
        </div>
      ))}
    </div>
  )
}

/** Ô nhập chuẩn trong dialog: label + control + lỗi (nếu có) — ép mọi dialog dùng chung một kiểu */
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-body-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="mt-1.5 text-caption text-danger">{error}</p>}
    </div>
  )
}

/** Dòng thông tin label — value trong drawer */
function Row({ label, value, mono, tabular }: { label: string; value: React.ReactNode; mono?: boolean; tabular?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-subtle py-2.5 last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`text-right font-medium text-foreground ${mono ? "font-mono" : ""} ${tabular ? "tabular" : ""}`}>{value}</span>
    </div>
  )
}

function fmtDate(v?: string | null): string {
  return v ? fmtVNDate(v) : "--"
}

function genderLabel(g?: string | null): string {
  if (!g) return "--"
  return g === "MALE" ? "Nam" : g === "FEMALE" ? "Nữ" : "Khác"
}

/** Tổng hợp công tháng hiện tại của 1 nhân viên (chấm công thật từ API) */
function AttendanceSummaryMini({ employeeId }: { employeeId: string }) {
  const [summary, setSummary] = useState<{
    present: number; late: number; remote: number; absent: number; otHours: number; total: number
  } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const { month, year } = currentMonthYearVN()
    attendanceApi
      .listByEmployee(employeeId, month, year)
      .then((rows) => {
        if (cancelled) return
        const s = { present: 0, late: 0, remote: 0, absent: 0, otHours: 0, total: rows.length }
        for (const r of rows) {
          if (r.status === "LATE") s.late++
          else if (r.status === "REMOTE") s.remote++
          else if (r.status === "ABSENT") s.absent++
          else s.present++
          s.otHours += r.overtime ?? 0
        }
        setSummary(s)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [employeeId])

  if (failed) return <p className="mt-3 text-body-sm text-muted-foreground">Không tải được chấm công tháng này.</p>
  if (!summary) return <Loader2 className="mt-3 size-4 animate-spin text-muted-foreground" />
  return (
    <div className="mt-3">
      <p className="mb-2 text-caption text-muted-foreground">
        Chấm công tháng hiện tại ({summary.total} bản ghi)
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Stat label="Ngày công" value={String(summary.present + summary.late + summary.remote)} />
        <Stat label="Đi muộn" value={String(summary.late)} tone={summary.late > 0 ? "warning" : undefined} />
        <Stat label="Remote" value={String(summary.remote)} />
        <Stat label="Vắng" value={String(summary.absent)} tone={summary.absent > 0 ? "danger" : undefined} />
        <Stat label="Giờ OT" value={String(summary.otHours)} tone="info" />
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" | "danger" | "info" }) {
  const toneClass =
    tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : tone === "info" ? "text-info" : "text-foreground"
  return (
    <div className="rounded-lg border border-border bg-sunken p-2.5 text-center">
      <p className={`tabular text-h3 font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-micro text-muted-foreground">{label}</p>
    </div>
  )
}

/** Lịch sử lương 4 kỳ gần nhất của 1 nhân viên (từ API thật) */
function PayrollHistoryMini({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof payrollApi.getEmployeeHistory>> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    payrollApi
      .getEmployeeHistory(employeeId)
      .then((d) => { if (!cancelled) setRows(d.slice(0, 4)) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [employeeId])

  if (failed) return <p className="text-body-sm text-muted-foreground">Không tải được lịch sử lương.</p>
  if (!rows) return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
  if (rows.length === 0) return <p className="text-body-sm text-muted-foreground">Chưa có bảng lương nào.</p>

  return (
    <div className="flex flex-col text-body-sm">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 border-b border-border-subtle py-2.5 last:border-0">
          <span className="tabular text-foreground">Kỳ {String(r.month).padStart(2, "0")}/{r.year}</span>
          <span className="tabular ml-auto font-semibold text-foreground">{vnd(r.netSalary)}</span>
          <Badge variant={r.status === "PAID" ? "success" : r.status === "APPROVED" ? "info" : "warning"}>
            {payrollStatusLabel(r.status)}
          </Badge>
        </div>
      ))}
    </div>
  )
}
