"use client"

import { useState, useEffect, useCallback } from "react"
import { employeesApi } from "@/lib/api/employees.api"
import type { CreateEmployeeInput, UpdateAccountInput, EmployeeDetail } from "@/lib/api/employees.api"
import { leaveApi } from "@/lib/api/leave.api"
import { attendanceApi } from "@/lib/api/attendance.api"
import { payrollApi } from "@/lib/api/payroll.api"
import type { Employee, Department } from "@/lib/schemas/employee.schema"
import type { Position } from "@/lib/api/employees.api"
import * as React from "react"
import { useAuth } from "@/lib/auth-context"
import {
  Search,
  Plus,
  FileSpreadsheet,
  ShieldCheck,
  X,
  Loader2,
  AlertTriangle,
  Pencil,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { employeeStatusLabel, leaveTypeLabel, payrollStatusLabel, currentMonthYearVN, todayVN, vnd } from "@/lib/utils"

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: "Chính thức (Toàn thời gian)",
  PART_TIME: "Bán thời gian",
  PROBATION: "Thử việc",
  FREELANCE: "Freelance",
  INTERNSHIP: "Thực tập",
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

export function EmployeesView() {
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

  const exportCsv = () => {
    const header = ["Ma NV", "Ho ten", "Email", "Phong ban", "Chuc vu", "Ngay vao lam", "Trang thai"]
    const rows = employees.map((e) => [
      e.employeeCode, e.fullName, e.email, e.department.name, e.position.title, e.joinDate, employeeStatusLabel(e.status),
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
    <div className="relative flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Quản Lý Nhân Sự & Hợp Đồng Lao Động
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Quản lý danh bạ hồ sơ, chính sách hợp đồng và liên kết ngữ cảnh AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={employees.length === 0}>
            <FileSpreadsheet className="size-4" /> Xuất Excel (CSV)
          </Button>
          <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground" onClick={() => setShowAdd(true)}>
            <Plus className="size-4" /> Thêm Nhân Viên
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, mã NV hoặc email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => { setSelectedDeptId(null); setPage(1) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedDeptId === null
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            Tất cả
          </button>
          {departments.map((dept) => (
            <button
              key={dept.id}
              onClick={() => { setSelectedDeptId(dept.id); setPage(1) }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedDeptId === dept.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {dept.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="size-3.5" /> {error}
        </div>
      )}

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Đang tải danh sách...
          </div>
        ) : employees.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
            Không tìm thấy nhân sự nào phù hợp bộ lọc.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Mã NV</TableHead>
                <TableHead>Nhân Viên</TableHead>
                <TableHead>Phòng Ban & Chức Vụ</TableHead>
                <TableHead>Ngày Vào Làm</TableHead>
                <TableHead>Trạng Thái</TableHead>
                <TableHead className="text-right">Hành Động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id} className="cursor-pointer" onClick={() => openDrawer(emp)}>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{emp.employeeCode}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar initials={initialsOf(emp.fullName)} className="bg-primary/15 text-primary border border-primary/20" />
                      <div>
                        <p className="font-medium text-foreground text-xs">{emp.fullName}</p>
                        <p className="text-[11px] text-muted-foreground">{emp.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-xs font-medium text-foreground">{emp.position.title}</p>
                      <p className="text-[11px] text-muted-foreground">{emp.department.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{emp.joinDate.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Badge variant={emp.status === "ACTIVE" ? "success" : emp.status === "PROBATION" ? "warning" : "secondary"}>
                      {employeeStatusLabel(emp.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDrawer(emp)
                      }}
                    >
                      Xem Hồ Sơ
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {loading ? "..." : `Tổng ${total} nhân sự • Trang ${page}/${totalPages}`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Trang trước
          </Button>
          <Button variant="outline" size="xs" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Trang sau
          </Button>
        </div>
      </div>

      {/* Slide-over Profile Drawer — dữ liệu thật, 5 nhóm thông tin */}
      {selectedEmployee && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card p-6 shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <Avatar initials={initialsOf(selectedEmployee.fullName)} className="size-10 bg-primary/20 text-primary font-bold text-sm" />
              <div>
                <h3 className="font-bold text-base text-foreground">{selectedEmployee.fullName}</h3>
                <p className="text-xs text-muted-foreground">{selectedEmployee.employeeCode} • {selectedEmployee.position.title}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedEmployee(null)} aria-label="Đóng hồ sơ">
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-5 py-5 overflow-y-auto text-xs">
            {editError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
                <AlertTriangle className="size-3.5" /> {editError}
              </div>
            )}

            {/* 1. Hồ sơ cá nhân */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">1. Hồ Sơ Cá Nhân</p>
                <Button size="xs" variant="outline" className="gap-1 text-[10px]" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3" /> Sửa hồ sơ
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Row label="Ngày sinh" value={fmtDate(drawerDetail?.dateOfBirth)} />
                <Row label="Giới tính" value={genderLabel(drawerDetail?.gender)} />
                <Row label="Số CCCD" value={drawerDetail?.nationalId || "--"} mono />
                <Row label="Số điện thoại" value={drawerDetail?.phone || "--"} mono />
                <Row label="Địa chỉ" value={drawerDetail?.address || "--"} />
              </div>
            </section>

            {/* 2. Nghề vụ & hợp đồng */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">2. Nghề Vụ & Hợp Đồng Lao Động</p>
              <div className="flex flex-col gap-2">
                <Row label="Phòng ban" value={selectedEmployee.department.name} />
                <Row label="Chức danh" value={selectedEmployee.position.title} />
                <Row
                  label="Quản lý trực tiếp"
                  value={
                    drawerDetail === undefined ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      drawerDetail?.manager
                        ? `${drawerDetail.manager.fullName} (${drawerDetail.manager.employeeCode})`
                        : "—"
                    )
                  }
                />
                <Row label="Ngày vào làm việc" value={selectedEmployee.joinDate.slice(0, 10)} />
                <Row
                  label="Loại hợp đồng (active)"
                  value={
                    !drawerDetail ? (
                      drawerDetail === null ? (
                        "—"
                      ) : (
                        <Loader2 className="size-3.5 animate-spin" />
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
                  mono
                />
                <Row
                  label="Phụ cấp"
                  value={drawerDetail?.contracts?.length ? vnd(drawerDetail.contracts[0]!.allowances) : "--"}
                  mono
                />
              </div>
            </section>

            {/* 3. Công & phép */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">3. Công & Phép</p>
              <div className="flex flex-col gap-2">
                <Row
                  label="Phép năm còn lại / tổng"
                  value={drawerLeave ? `${drawerLeave.remainingDays}/${drawerLeave.totalDays} ngày` : "--"}
                  mono
                />
              </div>
              <AttendanceSummaryMini employeeId={selectedEmployee.id} />
            </section>

            {/* 4. Lịch sử lương */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">4. Lịch Sử Lương</p>
              <PayrollHistoryMini employeeId={selectedEmployee.id} />
            </section>

            {/* 5. Trạng thái & tài khoản */}
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">5. Trạng Thái & Tài Khoản</p>
              <div className="flex flex-col gap-2">
                {/* Email + OAuth provider icons */}
                <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5 gap-2">
                  <span className="text-[11px] text-muted-foreground shrink-0">Email đăng nhập</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-mono text-foreground truncate">{drawerDetail?.user?.email ?? selectedEmployee.email}</span>
                    {/* Google icon */}
                    {(drawerDetail?.user as any)?.googleId && (
                      <span title="Đã liên kết Google" className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm">
                        <svg viewBox="0 0 24 24" className="size-3"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      </span>
                    )}
                    {/* Facebook icon */}
                    {(drawerDetail?.user as any)?.facebookId && (
                      <span title="Đã liên kết Facebook" className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-[#1877F2]">
                        <svg viewBox="0 0 24 24" fill="white" className="size-3"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </span>
                    )}
                  </div>
                </div>
                {/* Role badge */}
                <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2.5">
                  <span className="text-[11px] text-muted-foreground">Role tài khoản</span>
                  <Badge variant={(drawerDetail?.user as any)?.role === "ADMIN" ? "default" : "secondary"} className="text-[10px]">
                    {(drawerDetail?.user as any)?.role ?? "EMPLOYEE"}
                  </Badge>
                </div>
                <Row
                  label="Trạng thái làm việc"
                  value={
                    <Badge variant={(drawerDetail?.status ?? selectedEmployee.status) === "ACTIVE" ? "success" : (drawerDetail?.status ?? selectedEmployee.status) === "PROBATION" ? "warning" : "secondary"}>
                      {employeeStatusLabel(drawerDetail?.status ?? selectedEmployee.status)}
                    </Badge>
                  }
                />
                <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-2.5">
                  <span className="text-muted-foreground">Đổi trạng thái</span>
                  <select
                    value={drawerDetail?.status ?? selectedEmployee.status}
                    disabled={statusBusy || drawerDetail === undefined}
                    onChange={(e) => handleChangeStatus(e.target.value)}
                    className="rounded-lg border border-border bg-input/40 px-2 py-1 text-[11px] text-foreground"
                    aria-label="Đổi trạng thái làm việc"
                  >
                    <option value="ACTIVE">Đang làm</option>
                    <option value="PROBATION">Thử việc</option>
                    <option value="ON_LEAVE">Nghỉ dài hạn</option>
                    <option value="TERMINATED">Nghỉ việc</option>
                  </select>
                </div>
                {/* Edit Account button — chỉ ADMIN */}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 gap-1.5 text-xs"
                    onClick={() => {
                      setEditAccountForm({
                        email: drawerDetail?.user?.email ?? "",
                        role: ((drawerDetail?.user as any)?.role ?? "EMPLOYEE") as "ADMIN" | "EMPLOYEE",
                      })
                      setEditAccountError(null)
                      setEditAccountOpen(true)
                    }}
                  >
                    <Settings className="size-3" /> Sửa Email & Role
                  </Button>
                )}
              </div>
            </section>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Tích Hợp AI Context (WF01 & WF02)
              </p>
              <div className="rounded-xl border border-agent-teal/30 bg-agent-teal/5 p-3 text-xs text-agent-teal">
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <ShieldCheck className="size-4" /> Ngữ Cảnh Tự Động Nạp Cho Chatbot
                </div>
                <p className="text-[11px] leading-relaxed text-foreground/80">
                  Khi nhân viên này nhắn tin với n8n HR Q&A, bot sẽ tự động truy vấn chức vụ, hợp đồng
                  {drawerLeave ? ` và số ngày phép còn lại (${drawerLeave.remainingDays} ngày)` : ""} để trả lời chính xác mà không cần hỏi lại.
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Đơn Nghỉ Phép Gần Đây
              </p>
              <EmployeeLeavesMini employeeId={selectedEmployee.id} />
            </div>
          </div>

          <div className="mt-auto border-t border-border pt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedEmployee(null)}>
              Đóng
            </Button>
          </div>
        </div>
      )}

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogHeader>
          <DialogTitle>Chỉnh Sửa Hồ Sơ — {selectedEmployee?.fullName}</DialogTitle>
          <DialogDescription>
            Chỉ hồ sơ cá nhân được sửa tại đây. Hợp đồng & lương thay đổi thông qua hợp đồng mới.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-3 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Số điện thoại</label>
            <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="mt-1 h-8 text-xs" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Địa chỉ</label>
            <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="mt-1 h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Ngày sinh</label>
              <input
                type="date"
                value={editForm.dateOfBirth}
                onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-input/40 p-2 text-foreground text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Số CCCD</label>
              <Input value={editForm.nationalId} onChange={(e) => setEditForm({ ...editForm, nationalId: e.target.value })} className="mt-1 h-8 text-xs" />
            </div>
          </div>
          {editError && <p className="text-agent-coral">{editError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editBusy}>Hủy</Button>
          <Button variant="default" onClick={handleSaveEdit} disabled={editBusy} className="gap-1.5">
            {editBusy && <Loader2 className="size-3.5 animate-spin" />} Lưu Thay Đổi
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Add Employee Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogHeader>
          <DialogTitle>Thêm Nhân Viên Mới</DialogTitle>
          <DialogDescription>
            Hệ thống tự sinh mã NV và gán lộ trình onboarding. Mã NV trùng hoặc email trùng sẽ bị từ chối.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-3 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Họ tên</label>
            <Input value={addForm.fullName} onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })} className="mt-1 h-8 text-xs" />
            {addErrors.fullName && <p className="mt-1 text-agent-coral">{addErrors.fullName}</p>}
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Email</label>
            <Input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} className="mt-1 h-8 text-xs" />
            {addErrors.email && <p className="mt-1 text-agent-coral">{addErrors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Phòng ban</label>
              <select
                value={addForm.departmentId}
                onChange={(e) => setAddForm({ ...addForm, departmentId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-input/40 p-2 text-foreground"
              >
                <option value="">— Chọn —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {addErrors.departmentId && <p className="mt-1 text-agent-coral">{addErrors.departmentId}</p>}
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Chức vụ</label>
              <select
                value={addForm.positionId}
                onChange={(e) => setAddForm({ ...addForm, positionId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-input/40 p-2 text-foreground"
              >
                <option value="">— Chọn —</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              {addErrors.positionId && <p className="mt-1 text-agent-coral">{addErrors.positionId}</p>}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Ngày vào làm</label>
            <input
              type="date"
              value={addForm.joinDate}
              onChange={(e) => setAddForm({ ...addForm, joinDate: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-input/40 p-2 text-foreground text-xs"
            />
            {addErrors.joinDate && <p className="mt-1 text-agent-coral">{addErrors.joinDate}</p>}
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Role tài khoản</label>
            <select
              value={addForm.role ?? "EMPLOYEE"}
              onChange={(e) => setAddForm({ ...addForm, role: e.target.value as "ADMIN" | "EMPLOYEE" })}
              className="mt-1 w-full rounded-lg border border-border bg-input/40 p-2 text-foreground text-xs"
            >
              <option value="EMPLOYEE">Nhân viên (Employee)</option>
              <option value="ADMIN">Quản trị (Admin)</option>
            </select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Email này sẽ được kích hoạt làm whitelist đăng nhập (Email/Google/Facebook).
            </p>
          </div>
          {addErrors.form && <p className="text-agent-coral">{addErrors.form}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAdd(false)}>Hủy</Button>
          <Button variant="default" onClick={handleCreateEmployee} disabled={addBusy} className="gap-1.5">
            {addBusy && <Loader2 className="size-3.5 animate-spin" />} Tạo Nhân Viên
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={editAccountOpen} onOpenChange={setEditAccountOpen}>
        <DialogHeader>
          <DialogTitle>Sửa Email & Role — {selectedEmployee?.fullName}</DialogTitle>
          <DialogDescription>
            Thay đổi email đăng nhập hoặc role tài khoản. Email mới sẽ được dùng để đăng nhập bằng Google/Facebook.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-3 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Email đăng nhập mới</label>
            <Input
              type="email"
              value={editAccountForm.email ?? ""}
              onChange={(e) => setEditAccountForm({ ...editAccountForm, email: e.target.value })}
              placeholder="email@gmail.com hoặc email@facebook.com"
              className="mt-1 h-8 text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Role tài khoản</label>
            <select
              value={editAccountForm.role ?? "EMPLOYEE"}
              onChange={(e) => setEditAccountForm({ ...editAccountForm, role: e.target.value as "ADMIN" | "EMPLOYEE" })}
              className="mt-1 w-full rounded-lg border border-border bg-input/40 p-2 text-foreground text-xs"
            >
              <option value="EMPLOYEE">Nhân viên (Employee)</option>
              <option value="ADMIN">Quản trị (Admin)</option>
            </select>
          </div>
          {editAccountError && <p className="text-agent-coral">{editAccountError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditAccountOpen(false)} disabled={editAccountBusy}>Hủy</Button>
          <Button variant="default" onClick={handleSaveAccount} disabled={editAccountBusy} className="gap-1.5">
            {editAccountBusy && <Loader2 className="size-3.5 animate-spin" />} Lưu Tài Khoản
          </Button>
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

  if (error) return <p className="text-[11px] text-muted-foreground">Không tải được đơn nghỉ phép.</p>
  if (!leaves) return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
  if (leaves.length === 0) return <p className="text-[11px] text-muted-foreground">Chưa có đơn nghỉ phép nào.</p>

  return (
    <div className="flex flex-col gap-1.5 text-[11px]">
      {leaves.map((leave) => (
        <div key={leave.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
          <span className="text-foreground">
            {leaveTypeLabel(leave.type)} • {leave.startDate.slice(0, 10)} → {leave.endDate.slice(0, 10)}
          </span>
          <Badge variant={leave.status === "APPROVED" ? "success" : leave.status === "REJECTED" ? "destructive" : "warning"}>
            {leave.status === "APPROVED" ? "Đã duyệt" : leave.status === "REJECTED" ? "Từ chối" : leave.status === "CANCELLED" ? "Đã hủy" : "Chờ duyệt"}
          </Badge>
        </div>
      ))}
    </div>
  )
}

/** Dòng thông tin label — value trong drawer */
function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg bg-muted/40 p-2.5">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={`text-right font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}

function fmtDate(v?: string | null): string {
  return v ? v.slice(0, 10) : "--"
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

  if (failed) return <p className="mt-2 text-[11px] text-muted-foreground">Không tải được chấm công tháng này.</p>
  if (!summary) return <Loader2 className="mt-2 size-3.5 animate-spin text-muted-foreground" />
  return (
    <div className="mt-2">
      <p className="text-[10px] text-muted-foreground mb-1">
        Chấm công tháng hiện tại ({summary.total} bản ghi)
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        <Stat label="Ngày công" value={String(summary.present + summary.late + summary.remote)} />
        <Stat label="Đi muộn" value={String(summary.late)} tone={summary.late > 0 ? "amber" : undefined} />
        <Stat label="Remote" value={String(summary.remote)} />
        <Stat label="Vắng" value={String(summary.absent)} tone={summary.absent > 0 ? "coral" : undefined} />
        <Stat label="Giờ OT" value={String(summary.otHours)} tone="teal" />
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" | "coral" | "teal" }) {
  const toneClass =
    tone === "amber" ? "text-agent-amber" : tone === "coral" ? "text-agent-coral" : tone === "teal" ? "text-agent-teal" : "text-foreground"
  return (
    <div className="rounded-lg bg-muted/40 p-2 text-center">
      <p className={`font-mono text-sm font-bold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p>
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

  if (failed) return <p className="text-[11px] text-muted-foreground">Không tải được lịch sử lương.</p>
  if (!rows) return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
  if (rows.length === 0) return <p className="text-[11px] text-muted-foreground">Chưa có bảng lương nào.</p>

  return (
    <div className="flex flex-col gap-1.5 text-[11px]">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
          <span className="text-foreground">Kỳ {String(r.month).padStart(2, "0")}/{r.year}</span>
          <span className="font-mono font-semibold text-emerald-400">{vnd(r.netSalary)}</span>
          <Badge variant={r.status === "PAID" ? "success" : r.status === "APPROVED" ? "teal" : "warning"}>
            {payrollStatusLabel(r.status)}
          </Badge>
        </div>
      ))}
    </div>
  )
}
