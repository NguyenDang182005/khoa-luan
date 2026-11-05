"use client"

import * as React from "react"
import {
  Users,
  CheckCircle2,
  FileText,
  Laptop,
  GraduationCap,
  Sparkles,
  Loader2,
  UserCheck,
  Plus,
  X,
  AlertTriangle,
  Clock,
  Circle,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { onboardingApi } from "@/lib/api/onboarding.api"
import { employeesApi } from "@/lib/api/employees.api"
import type { OnboardingTask, OnboardingProgressItem } from "@/lib/schemas/onboarding.schema"
import type { Employee } from "@/lib/schemas/employee.schema"
import { fmtVNDate } from "@/lib/utils"

interface EmployeeProgressGroup {
  employeeId: string
  fullName: string
  employeeCode: string
  joinDate?: string
  departmentName?: string
  total: number
  completed: number
  percentage: number
  items: OnboardingProgressItem[]
}

const DEFAULT_CATEGORY = { label: "Hồ sơ & Giấy tờ", icon: FileText, color: "bg-info-tint text-info" }

const CATEGORY_MAP: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  paperwork: DEFAULT_CATEGORY,
  equipment: { label: "Thiết bị & Tài khoản", icon: Laptop, color: "bg-muted text-secondary-foreground" },
  training: { label: "Đào tạo & Quy định", icon: GraduationCap, color: "bg-success-tint text-success" },
  introduction: { label: "Hội nhập & Làm quen", icon: Sparkles, color: "bg-warning-tint text-warning" },
}

/** Ô nhập native (select/textarea) trông giống Input primitive */
const FIELD_CLASS =
  "w-full rounded-md border border-input bg-card px-3 text-body text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-subtle-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"

/** Lấy thông báo lỗi từ backend (message có thể là string hoặc string[]) */
function apiErrorMessage(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
  if (Array.isArray(msg)) return msg.join("; ") || fallback
  return msg || fallback
}

/** Nhân viên mới: đang thử việc hoặc vào làm trong 90 ngày gần nhất, chưa nghỉ việc */
const NEW_HIRE_WINDOW_DAYS = 90
function isNewHire(emp: Employee): boolean {
  if (emp.status === "TERMINATED") return false
  if (emp.status === "PROBATION") return true
  const joined = new Date(emp.joinDate).getTime()
  return !Number.isNaN(joined) && Date.now() - joined <= NEW_HIRE_WINDOW_DAYS * 24 * 60 * 60 * 1000
}

export function OnboardingManagementTab() {
  const [tasks, setTasks] = React.useState<OnboardingTask[]>([])
  const [progressList, setProgressList] = React.useState<OnboardingProgressItem[]>([])
  const [allEmployees, setAllEmployees] = React.useState<Employee[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)
  // Lỗi hiển thị bên trong dialog đang mở (banner trang bị dialog che mất)
  const [dialogError, setDialogError] = React.useState<string | null>(null)

  // Sub-tab view: 'progress' vs 'tasks'
  const [activeSubTab, setActiveSubTab] = React.useState<"progress" | "tasks">("progress")

  // Task Template Modal state
  const [taskModalOpen, setTaskModalOpen] = React.useState(false)
  const [editingTask, setEditingTask] = React.useState<OnboardingTask | null>(null)
  const [taskForm, setTaskForm] = React.useState({
    title: "",
    description: "",
    category: "paperwork",
    dueAfterDays: 7,
    isRequired: true,
    order: 0,
  })
  const [taskBusy, setTaskBusy] = React.useState(false)

  // Employee Task Detail Modal state
  const [selectedEmpProgress, setSelectedEmpProgress] = React.useState<EmployeeProgressGroup | null>(null)
  const [updatingTaskId, setUpdatingTaskId] = React.useState<string | null>(null)

  // 1-Click assign
  const [assigningId, setAssigningId] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tasksRes, progressRes, empRes] = await Promise.allSettled([
        onboardingApi.findAllTasks(),
        onboardingApi.getAllProgress(),
        employeesApi.list({ page: 1, limit: 100 }),
      ])

      if (tasksRes.status === "fulfilled") setTasks(tasksRes.value)
      if (progressRes.status === "fulfilled") setProgressList(progressRes.value)
      if (empRes.status === "fulfilled") setAllEmployees(empRes.value.data ?? [])

      // allSettled không bao giờ throw → tự báo lỗi để không hiện nhầm trạng thái "trống"
      const failed = [
        tasksRes.status === "rejected" && "danh mục đầu việc mẫu",
        progressRes.status === "rejected" && "tiến độ hội nhập",
        empRes.status === "rejected" && "danh sách nhân viên",
      ].filter(Boolean)
      if (failed.length > 0) {
        const firstRejected = [tasksRes, progressRes, empRes].find(
          (r): r is PromiseRejectedResult => r.status === "rejected",
        )
        setError(
          `Không tải được ${failed.join(", ")}: ${apiErrorMessage(firstRejected?.reason, "lỗi kết nối máy chủ")}`,
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Gom nhóm tiến độ theo từng nhân viên
  const employeeGroups = React.useMemo<EmployeeProgressGroup[]>(() => {
    const map = new Map<string, EmployeeProgressGroup>()

    // Chỉ điền nhân viên mới (thử việc / vào làm ≤ 90 ngày), bỏ người đã nghỉ việc
    const terminatedIds = new Set(allEmployees.filter((e) => e.status === "TERMINATED").map((e) => e.id))
    for (const emp of allEmployees) {
      if (!isNewHire(emp)) continue
      map.set(emp.id, {
        employeeId: emp.id,
        fullName: emp.fullName,
        employeeCode: emp.employeeCode,
        joinDate: emp.joinDate,
        departmentName: emp.department?.name,
        total: 0,
        completed: 0,
        percentage: 0,
        items: [],
      })
    }

    // Nối tiến độ đã có
    for (const p of progressList) {
      const empId = p.employeeId
      // Nhân viên đã có lộ trình vẫn hiện để theo dõi tiếp, trừ người đã nghỉ việc
      if (terminatedIds.has(empId)) continue
      let group = map.get(empId)
      if (!group && p.employee) {
        group = {
          employeeId: empId,
          fullName: p.employee.fullName,
          employeeCode: p.employee.employeeCode,
          joinDate: p.employee.joinDate,
          departmentName: p.employee.department?.name,
          total: 0,
          completed: 0,
          percentage: 0,
          items: [],
        }
        map.set(empId, group)
      }

      if (group) {
        group.items.push(p)
        group.total++
        if (p.status === "COMPLETED") group.completed++
      }
    }

    // Tính percentage
    const list = Array.from(map.values())
    for (const g of list) {
      g.percentage = g.total > 0 ? Math.round((g.completed / g.total) * 100) : 0
    }

    // Ưu tiên nhân viên có task hoặc vào làm gần đây
    return list.sort((a, b) => b.total - a.total || (b.joinDate ?? "").localeCompare(a.joinDate ?? ""))
  }, [allEmployees, progressList])

  // Gán lộ trình tự động
  const handleAssignTasks = async (employeeId: string) => {
    setAssigningId(employeeId)
    setSuccessMsg(null)
    setError(null)
    try {
      await onboardingApi.assignTasksToEmployee(employeeId)
      setSuccessMsg("Đã gán lộ trình hội nhập mẫu thành công cho nhân viên!")
      await fetchData()
    } catch (e: unknown) {
      setError(apiErrorMessage(e, "Gán lộ trình thất bại."))
    } finally {
      setAssigningId(null)
    }
  }

  // Cập nhật trạng thái task trong modal chi tiết
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!selectedEmpProgress) return
    const newStatus: OnboardingProgressItem["status"] = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED"
    setUpdatingTaskId(taskId)
    setDialogError(null)
    try {
      await onboardingApi.updateProgress(selectedEmpProgress.employeeId, taskId, { status: newStatus })
      // Cập nhật state nội bộ modal
      setSelectedEmpProgress((prev) => {
        if (!prev) return null
        const nextItems = prev.items.map((i) =>
          i.taskId === taskId ? { ...i, status: newStatus, completedAt: newStatus === "COMPLETED" ? new Date().toISOString() : null } : i
        )
        const completed = nextItems.filter((i) => i.status === "COMPLETED").length
        const total = nextItems.length
        return {
          ...prev,
          items: nextItems,
          completed,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        }
      })
      await fetchData()
    } catch (e: unknown) {
      setDialogError(apiErrorMessage(e, "Cập nhật thất bại."))
    } finally {
      setUpdatingTaskId(null)
    }
  }

  // Mở modal tạo mới task template
  const handleOpenCreateTask = () => {
    setEditingTask(null)
    setTaskForm({
      title: "",
      description: "",
      category: "paperwork",
      dueAfterDays: 7,
      isRequired: true,
      order: tasks.length + 1,
    })
    setDialogError(null)
    setTaskModalOpen(true)
  }

  // Mở modal sửa task template
  const handleOpenEditTask = (task: OnboardingTask) => {
    setEditingTask(task)
    setTaskForm({
      title: task.title,
      description: task.description || "",
      category: task.category || "paperwork",
      dueAfterDays: task.dueAfterDays || 7,
      isRequired: task.isRequired ?? true,
      order: task.order ?? 0,
    })
    setDialogError(null)
    setTaskModalOpen(true)
  }

  // Lưu task template
  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) {
      setDialogError("Vui lòng nhập tiêu đề nhiệm vụ.")
      return
    }
    setTaskBusy(true)
    setDialogError(null)
    try {
      if (editingTask) {
        await onboardingApi.updateTask(editingTask.id, taskForm)
        setSuccessMsg("Cập nhật nhiệm vụ mẫu thành công!")
      } else {
        await onboardingApi.createTask(taskForm)
        setSuccessMsg("Tạo nhiệm vụ mẫu mới thành công!")
      }
      setTaskModalOpen(false)
      await fetchData()
    } catch (e: unknown) {
      setDialogError(apiErrorMessage(e, "Lưu nhiệm vụ thất bại."))
    } finally {
      setTaskBusy(false)
    }
  }

  // Xóa task template
  const handleDeleteTask = async (id: string, title: string) => {
    if (!confirm(`Bạn có chắc muốn xóa nhiệm vụ mẫu "${title}"?`)) return
    setError(null)
    try {
      await onboardingApi.deleteTask(id)
      setSuccessMsg("Đã xóa nhiệm vụ mẫu.")
      await fetchData()
    } catch (e: unknown) {
      setError(apiErrorMessage(e, "Xóa thất bại."))
    }
  }

  // Tổng hợp hiển thị: tỷ lệ hoàn thành chung của các lộ trình đã gán
  const overallTotal = employeeGroups.reduce((s, g) => s + g.total, 0)
  const overallCompleted = employeeGroups.reduce((s, g) => s + g.completed, 0)
  const overallPct = overallTotal > 0 ? Math.round((overallCompleted / overallTotal) * 100) : 0

  const segClass = (active: boolean) =>
    `rounded-sm px-3 py-1 text-body-sm font-medium transition-colors duration-150 ${
      active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
    }`

  const barTone = (pct: number, complete: boolean) =>
    complete ? "bg-success" : pct >= 50 ? "bg-primary" : "bg-warning"

  return (
    <div className="flex flex-col gap-4">
      {/* Sub navigation & Action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-0.5 self-start rounded-md bg-muted p-0.5">
          <button onClick={() => setActiveSubTab("progress")} className={segClass(activeSubTab === "progress")}>
            Tiến độ nhân viên mới <span className="tabular">({employeeGroups.length})</span>
          </button>
          <button onClick={() => setActiveSubTab("tasks")} className={segClass(activeSubTab === "tasks")}>
            Danh mục đầu việc mẫu <span className="tabular">({tasks.length})</span>
          </button>
        </div>

        {activeSubTab === "tasks" && (
          <Button onClick={handleOpenCreateTask}>
            <Plus className="size-4" /> Thêm nhiệm vụ mẫu
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint px-4 py-2.5 text-body-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-success/20 bg-success-tint px-4 py-2.5 text-body-sm text-success animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" /> {successMsg}
          </span>
          <Button size="icon-xs" variant="ghost" onClick={() => setSuccessMsg(null)} aria-label="Đóng thông báo" className="text-success hover:bg-card/60 hover:text-success">
            <X />
          </Button>
        </div>
      )}

      {/* SUBTAB 1: TIẾN ĐỘ NHÂN VIÊN MỚI */}
      {activeSubTab === "progress" && (
        <>
          {/* Tiến độ chung */}
          {!loading && overallTotal > 0 && (
            <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
                  <UserCheck className="size-4" />
                </div>
                <div>
                  <p className="text-body-sm text-muted-foreground">Tiến độ hội nhập chung</p>
                  <p className="tabular text-h2 font-semibold text-foreground">{overallPct}%</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${barTone(overallPct, overallPct === 100)}`}
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
                <p className="tabular text-caption text-muted-foreground">
                  {overallCompleted}/{overallTotal} nhiệm vụ đã hoàn thành
                </p>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="size-4 text-primary" />
                Theo dõi tiến độ hội nhập
              </CardTitle>
              <CardDescription>
                Nhân viên đang thử việc hoặc vào làm trong {NEW_HIRE_WINDOW_DAYS} ngày gần nhất — theo dõi tỷ lệ hoàn thành đầu việc hội nhập và gán quy trình chuẩn
              </CardDescription>
            </CardHeader>
            {loading ? (
              <div className="flex flex-col gap-3 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-10 rounded-md" />
                ))}
              </div>
            ) : employeeGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Users className="size-5" />
                </div>
                <p className="text-body font-semibold text-foreground">Chưa có nhân viên mới nào</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nhân viên</TableHead>
                      <TableHead>Phòng ban</TableHead>
                      <TableHead>Ngày vào làm</TableHead>
                      <TableHead>Tiến độ hoàn thành</TableHead>
                      <TableHead className="text-right">Tỷ lệ</TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeGroups.map((group) => {
                      const hasTasks = group.total > 0
                      const isComplete = hasTasks && group.completed === group.total

                      return (
                        <TableRow key={group.employeeId}>
                          {/* Nhân viên */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar
                                initials={group.fullName
                                  .split(" ")
                                  .slice(-2)
                                  .map((w) => w[0])
                                  .join("")
                                  .toUpperCase()}
                                className="size-8 bg-primary-tint text-accent-foreground"
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{group.fullName}</p>
                                <p className="font-mono text-caption text-muted-foreground">{group.employeeCode}</p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Phòng ban */}
                          <TableCell className="text-secondary-foreground">{group.departmentName || "—"}</TableCell>

                          {/* Ngày vào */}
                          <TableCell className="tabular text-secondary-foreground">
                            {group.joinDate ? fmtVNDate(group.joinDate) : "—"}
                          </TableCell>

                          {/* Thanh tiến độ */}
                          <TableCell className="min-w-[180px]">
                            {hasTasks ? (
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-caption">
                                  <span className="tabular text-muted-foreground">
                                    {group.completed}/{group.total} nhiệm vụ
                                  </span>
                                  {isComplete && (
                                    <span className="flex items-center gap-1 font-medium text-success">
                                      <CheckCircle2 className="size-3.5" /> Đạt
                                    </span>
                                  )}
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={`h-full rounded-full transition-all ${barTone(group.percentage, isComplete)}`}
                                    style={{ width: `${group.percentage}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-caption text-muted-foreground">Chưa gán lộ trình</span>
                            )}
                          </TableCell>

                          {/* Tỷ lệ % */}
                          <TableCell className="text-right">
                            {hasTasks ? (
                              <span
                                className={`tabular font-semibold ${
                                  isComplete ? "text-success" : group.percentage >= 50 ? "text-primary" : "text-warning"
                                }`}
                              >
                                {group.percentage}%
                              </span>
                            ) : (
                              <span className="tabular text-subtle-foreground">0%</span>
                            )}
                          </TableCell>

                          {/* Hành động */}
                          <TableCell className="text-right">
                            {hasTasks ? (
                              <Button size="sm" variant="outline" onClick={() => setSelectedEmpProgress(group)}>
                                Xem chi tiết
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAssignTasks(group.employeeId)}
                                disabled={assigningId === group.employeeId}
                              >
                                {assigningId === group.employeeId && <Loader2 className="size-3.5 animate-spin" />}
                                Gán lộ trình mẫu
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
        </>
      )}

      {/* SUBTAB 2: QUẢN LÝ NHIỆM VỤ MẪU (TASK TEMPLATES) */}
      {activeSubTab === "tasks" && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Danh mục đầu việc chuẩn hóa
            </CardTitle>
            <CardDescription>
              Các đầu việc này sẽ được gán tự động cho nhân viên mới để hoàn thành trong tuần đầu tiên
            </CardDescription>
          </CardHeader>
          {loading ? (
            <div className="flex flex-col gap-3 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-10 rounded-md" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="size-5" />
              </div>
              <p className="text-body font-semibold text-foreground">Chưa có nhiệm vụ mẫu nào</p>
              <Button size="sm" variant="outline" className="mt-1" onClick={handleOpenCreateTask}>
                <Plus className="size-4" /> Thêm nhiệm vụ đầu tiên
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[820px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-center">STT</TableHead>
                    <TableHead>Tiêu đề nhiệm vụ</TableHead>
                    <TableHead>Phân loại</TableHead>
                    <TableHead>Hạn hoàn thành</TableHead>
                    <TableHead>Bắt buộc</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task, idx) => {
                    const catInfo = (task.category ? CATEGORY_MAP[task.category] : undefined) ?? DEFAULT_CATEGORY
                    const CatIcon = catInfo.icon

                    return (
                      <TableRow key={task.id}>
                        <TableCell className="tabular text-center text-muted-foreground">
                          {task.order || idx + 1}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{task.title}</p>
                            {task.description && (
                              <p className="mt-0.5 text-caption text-muted-foreground">{task.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={catInfo.color}>
                            <CatIcon /> {catInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-secondary-foreground">
                          {task.dueAfterDays ? `${task.dueAfterDays} ngày sau khi vào` : "Không giới hạn"}
                        </TableCell>
                        <TableCell>
                          {task.isRequired ? (
                            <Badge variant="warning">Bắt buộc</Badge>
                          ) : (
                            <span className="text-caption text-muted-foreground">Tùy chọn</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleOpenEditTask(task)}>
                              Sửa
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger hover:bg-danger-tint hover:text-danger"
                              onClick={() => handleDeleteTask(task.id, task.title)}
                            >
                              Xóa
                            </Button>
                          </div>
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

      {/* MODAL 1: CHI TIẾT TIẾN ĐỘ NHÂN VIÊN */}
      <Dialog
        open={selectedEmpProgress !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEmpProgress(null)
            setDialogError(null)
          }
        }}
        className="flex max-h-[85vh] max-w-[560px] flex-col"
      >
        {selectedEmpProgress && (
          <>
            <DialogHeader>
              <DialogTitle>Tiến độ: {selectedEmpProgress.fullName}</DialogTitle>
              <DialogDescription>
                Mã NV: <span className="font-mono">{selectedEmpProgress.employeeCode}</span> • Phòng ban: {selectedEmpProgress.departmentName || "—"}
              </DialogDescription>
            </DialogHeader>

            {/* Thanh tiến độ tổng của nhân viên */}
            <div className="mt-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-body-sm">
                <span className="text-muted-foreground">Hoàn thành</span>
                <span className="tabular font-semibold text-foreground">
                  {selectedEmpProgress.completed}/{selectedEmpProgress.total} ({selectedEmpProgress.percentage}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${barTone(
                    selectedEmpProgress.percentage,
                    selectedEmpProgress.total > 0 && selectedEmpProgress.completed === selectedEmpProgress.total,
                  )}`}
                  style={{ width: `${selectedEmpProgress.percentage}%` }}
                />
              </div>
            </div>

            {dialogError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint px-3 py-2 text-body-sm text-danger">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {dialogError}
              </div>
            )}

            {/* Checklist dạng timeline */}
            <ol className="mt-5 flex-1 overflow-y-auto pr-1 text-body-sm">
              {selectedEmpProgress.items.map((item, idx) => {
                const isDone = item.status === "COMPLETED"
                const t = item.task
                const cat = (t?.category ? CATEGORY_MAP[t.category] : undefined) ?? DEFAULT_CATEGORY
                const isLast = idx === selectedEmpProgress.items.length - 1

                return (
                  <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {!isLast && (
                      <span className="absolute left-[11px] top-7 bottom-0 w-px bg-border" aria-hidden />
                    )}
                    <span
                      className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border ${
                        isDone ? "border-success bg-success-tint text-success" : "border-border bg-card text-subtle-foreground"
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-2.5" />}
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className={`font-medium ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {t?.title || "Nhiệm vụ"}
                        </p>
                        {t?.description && (
                          <p className="mt-0.5 text-caption text-muted-foreground">{t.description}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {isDone ? (
                            <Badge variant="success"><CheckCircle2 /> Đã xong</Badge>
                          ) : (
                            <Badge variant="warning"><Clock /> Chưa xong</Badge>
                          )}
                          <Badge variant="outline">{cat.label}</Badge>
                          {isDone && item.completedAt && (
                            <span className="tabular text-caption text-muted-foreground">
                              Xong lúc: {fmtVNDate(item.completedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isDone ? "ghost" : "outline"}
                        className="shrink-0 self-start"
                        onClick={() => handleToggleTaskStatus(item.taskId, item.status)}
                        disabled={updatingTaskId === item.taskId}
                      >
                        {updatingTaskId === item.taskId ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : isDone ? (
                          "Đánh dấu chưa xong"
                        ) : (
                          "Hoàn thành"
                        )}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ol>

            <DialogFooter className="border-t border-border pt-4">
              <Button variant="outline" onClick={() => setSelectedEmpProgress(null)}>
                Đóng
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      {/* MODAL 2: TẠO / SỬA NHIỆM VỤ MẪU */}
      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogHeader>
          <DialogTitle>
            {editingTask ? "Chỉnh sửa nhiệm vụ mẫu" : "Thêm nhiệm vụ mẫu mới"}
          </DialogTitle>
          <DialogDescription>
            Nhiệm vụ chuẩn hóa để gán vào quy trình hội nhập cho nhân viên mới
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 flex flex-col gap-4 text-body-sm">
          {dialogError && (
            <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint px-3 py-2 text-body-sm text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {dialogError}
            </div>
          )}
          <div>
            <label htmlFor="task-title" className="font-medium text-foreground">
              Tiêu đề nhiệm vụ <span className="text-danger">*</span>
            </label>
            <Input
              id="task-title"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              placeholder="VD: Nộp sơ yếu lý lịch & bằng cấp công chứng"
              className="mt-1.5 h-9"
            />
          </div>

          <div>
            <label htmlFor="task-desc" className="font-medium text-foreground">Mô tả chi tiết</label>
            <textarea
              id="task-desc"
              rows={3}
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              placeholder="Hướng dẫn cách thực hiện hoặc nộp cho ai..."
              className={`mt-1.5 py-2 ${FIELD_CLASS}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="task-category" className="font-medium text-foreground">Phân loại</label>
              <select
                id="task-category"
                value={taskForm.category}
                onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                className={`mt-1.5 h-9 ${FIELD_CLASS}`}
              >
                <option value="paperwork">Hồ sơ & Giấy tờ</option>
                <option value="equipment">Thiết bị & Tài khoản</option>
                <option value="training">Đào tạo & Quy định</option>
                <option value="introduction">Hội nhập & Làm quen</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-due" className="font-medium text-foreground">Thời hạn (ngày)</label>
              <Input
                id="task-due"
                type="number"
                min={1}
                max={90}
                value={taskForm.dueAfterDays}
                onChange={(e) => setTaskForm({ ...taskForm, dueAfterDays: Number(e.target.value) || 7 })}
                className="tabular mt-1.5 h-9"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRequired"
              checked={taskForm.isRequired}
              onChange={(e) => setTaskForm({ ...taskForm, isRequired: e.target.checked })}
              className="size-4 rounded-sm border-input accent-primary"
            />
            <label htmlFor="isRequired" className="cursor-pointer font-medium text-foreground">
              Nhiệm vụ bắt buộc hoàn thành
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setTaskModalOpen(false)} disabled={taskBusy}>
            Hủy
          </Button>
          <Button onClick={handleSaveTask} disabled={taskBusy || !taskForm.title.trim()}>
            {taskBusy && <Loader2 className="size-4 animate-spin" />}
            {editingTask ? "Cập nhật" : "Tạo mới"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
