"use client"

import * as React from "react"
import {
  Users,
  CheckCircle2,
  Clock,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  FileText,
  Laptop,
  GraduationCap,
  Sparkles,
  Loader2,
  ChevronRight,
  ShieldCheck,
  UserCheck,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import type { OnboardingTask } from "@/lib/schemas/onboarding.schema"

interface EmployeeProgressGroup {
  employeeId: string
  fullName: string
  employeeCode: string
  joinDate?: string
  departmentName?: string
  total: number
  completed: number
  percentage: number
  items: any[]
}

const DEFAULT_CATEGORY = { label: "Hồ sơ & Giấy tờ", icon: FileText, color: "text-blue-400 bg-blue-500/10 border-blue-500/30" }

const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string }> = {
  paperwork: DEFAULT_CATEGORY,
  equipment: { label: "Thiết bị & Tài khoản", icon: Laptop, color: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
  training: { label: "Đào tạo & Quy định", icon: GraduationCap, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  introduction: { label: "Hội nhập & Làm quen", icon: Sparkles, color: "text-agent-teal bg-agent-teal/10 border-agent-teal/30" },
}

export function OnboardingManagementTab() {
  const [tasks, setTasks] = React.useState<OnboardingTask[]>([])
  const [progressList, setProgressList] = React.useState<any[]>([])
  const [allEmployees, setAllEmployees] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể tải dữ liệu onboarding.")
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

    // Điền toàn bộ nhân viên thử việc / mới vào map
    for (const emp of allEmployees) {
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
    try {
      await onboardingApi.assignTasksToEmployee(employeeId)
      setSuccessMsg("Đã gán lộ trình hội nhập mẫu thành công cho nhân viên!")
      await fetchData()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Gán lộ trình thất bại.")
    } finally {
      setAssigningId(null)
    }
  }

  // Cập nhật trạng thái task trong modal chi tiết
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!selectedEmpProgress) return
    const newStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED"
    setUpdatingTaskId(taskId)
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
      alert(e instanceof Error ? e.message : "Cập nhật thất bại.")
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
    setTaskModalOpen(true)
  }

  // Lưu task template
  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) {
      alert("Vui lòng nhập tiêu đề nhiệm vụ.")
      return
    }
    setTaskBusy(true)
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
      alert(e instanceof Error ? e.message : "Lưu nhiệm vụ thất bại.")
    } finally {
      setTaskBusy(false)
    }
  }

  // Xóa task template
  const handleDeleteTask = async (id: string, title: string) => {
    if (!confirm(`Bạn có chắc muốn xóa nhiệm vụ mẫu "${title}"?`)) return
    try {
      await onboardingApi.deleteTask(id)
      setSuccessMsg("Đã xóa nhiệm vụ mẫu.")
      await fetchData()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Xóa thất bại.")
    }
  }

  return (
    <div className="flex flex-col gap-5 pt-2">
      {/* Sub navigation & Action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
          <button
            onClick={() => setActiveSubTab("progress")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeSubTab === "progress"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserCheck className="size-3.5 text-emerald-400" /> Tiến Độ Nhân Viên Mới ({employeeGroups.length})
          </button>
          <button
            onClick={() => setActiveSubTab("tasks")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeSubTab === "tasks"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-3.5 text-primary" /> Danh Mục Đầu Việc Mẫu ({tasks.length})
          </button>
        </div>

        {activeSubTab === "tasks" && (
          <Button size="sm" className="text-xs gap-1 bg-primary text-primary-foreground" onClick={handleOpenCreateTask}>
            <Plus className="size-3.5" /> Thêm Nhiệm Vụ Mẫu
          </Button>
        )}
      </div>

      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-400 flex items-center justify-between animate-in fade-in">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>
      )}

      {/* SUBTAB 1: TIẾN ĐỘ NHÂN VIÊN MỚI */}
      {activeSubTab === "progress" && (
        <Card className="border-border overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-border bg-muted/10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="size-4 text-emerald-400" />
              Theo Dõi Tiến Độ Hội Nhập (Onboarding Progress Matrix)
            </CardTitle>
            <CardDescription className="text-xs">
              Theo dõi tỷ lệ hoàn thành các đầu việc hội nhập của nhân viên mới và gán quy trình chuẩn
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-48 flex-col items-center justify-center text-xs text-muted-foreground">
                <Loader2 className="size-6 animate-spin mb-2 text-primary" />
                Đang tải dữ liệu tiến độ...
              </div>
            ) : employeeGroups.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-xs text-muted-foreground">
                <Users className="size-8 text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground">Chưa có nhân viên nào</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">Nhân Viên</TableHead>
                      <TableHead className="text-xs">Phòng Ban</TableHead>
                      <TableHead className="text-xs">Ngày Vào Làm</TableHead>
                      <TableHead className="text-xs">Tiến Độ Hoàn Thành</TableHead>
                      <TableHead className="text-xs">Tỷ Lệ (%)</TableHead>
                      <TableHead className="text-xs text-right">Hành Động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeGroups.map((group) => {
                      const hasTasks = group.total > 0
                      const isComplete = hasTasks && group.completed === group.total

                      return (
                        <TableRow key={group.employeeId} className="text-xs hover:bg-muted/20 transition-colors">
                          {/* Nhân viên */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                initials={group.fullName
                                  .split(" ")
                                  .slice(-2)
                                  .map((w) => w[0])
                                  .join("")
                                  .toUpperCase()}
                                className="size-7 bg-primary/20 text-primary border border-primary/30"
                              />
                              <div>
                                <p className="font-semibold text-foreground">{group.fullName}</p>
                                <p className="text-[10px] text-muted-foreground">{group.employeeCode}</p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Phòng ban */}
                          <TableCell className="text-muted-foreground">{group.departmentName || "—"}</TableCell>

                          {/* Ngày vào */}
                          <TableCell className="text-muted-foreground">
                            {group.joinDate ? group.joinDate.slice(0, 10) : "—"}
                          </TableCell>

                          {/* Thanh tiến độ */}
                          <TableCell className="min-w-[140px]">
                            {hasTasks ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-muted-foreground">
                                    {group.completed}/{group.total} nhiệm vụ
                                  </span>
                                  {isComplete && (
                                    <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                      <CheckCircle2 className="size-3" /> Đạt
                                    </span>
                                  )}
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isComplete
                                        ? "bg-emerald-500"
                                        : group.percentage >= 50
                                        ? "bg-agent-teal"
                                        : "bg-amber-500"
                                    }`}
                                    style={{ width: `${group.percentage}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">Chưa gán lộ trình</span>
                            )}
                          </TableCell>

                          {/* Tỷ lệ % */}
                          <TableCell>
                            {hasTasks ? (
                              <span
                                className={`font-bold font-mono text-xs ${
                                  isComplete
                                    ? "text-emerald-400"
                                    : group.percentage >= 50
                                    ? "text-agent-teal"
                                    : "text-amber-400"
                                }`}
                              >
                                {group.percentage}%
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">0%</span>
                            )}
                          </TableCell>

                          {/* Hành động */}
                          <TableCell className="text-right">
                            {hasTasks ? (
                              <Button
                                size="xs"
                                variant="outline"
                                className="text-xs gap-1"
                                onClick={() => setSelectedEmpProgress(group)}
                              >
                                Xem Chi Tiết <ChevronRight className="size-3" />
                              </Button>
                            ) : (
                              <Button
                                size="xs"
                                className="text-xs gap-1 bg-primary text-primary-foreground"
                                onClick={() => handleAssignTasks(group.employeeId)}
                                disabled={assigningId === group.employeeId}
                              >
                                {assigningId === group.employeeId ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Plus className="size-3" />
                                )}
                                Gán Lộ Trình Mẫu
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

      {/* SUBTAB 2: QUẢN LÝ NHIỆM VỤ MẪU (TASK TEMPLATES) */}
      {activeSubTab === "tasks" && (
        <Card className="border-border overflow-hidden">
          <CardHeader className="p-4 pb-2 border-b border-border bg-muted/10">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Danh Mục Đầu Việc Chuẩn Hóa (Onboarding Task Templates)
            </CardTitle>
            <CardDescription className="text-xs">
              Các đầu việc này sẽ được gán tự động cho nhân viên mới để hoàn thành trong tuần đầu tiên
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-48 flex-col items-center justify-center text-xs text-muted-foreground">
                <Loader2 className="size-6 animate-spin mb-2 text-primary" />
                Đang tải danh mục nhiệm vụ...
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-xs text-muted-foreground">
                <FileText className="size-8 text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground">Chưa có nhiệm vụ mẫu nào</p>
                <Button size="xs" className="mt-2 text-xs" onClick={handleOpenCreateTask}>
                  + Thêm nhiệm vụ đầu tiên
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-12 text-center text-xs">STT</TableHead>
                      <TableHead className="text-xs">Tiêu Đề Nhiệm Vụ</TableHead>
                      <TableHead className="text-xs">Phân Loại</TableHead>
                      <TableHead className="text-xs">Hạn Hoàn Thành</TableHead>
                      <TableHead className="text-xs">Bắt Buộc</TableHead>
                      <TableHead className="text-xs text-right">Thao Tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task, idx) => {
                      const catInfo = (task.category ? CATEGORY_MAP[task.category] : undefined) ?? DEFAULT_CATEGORY
                      const CatIcon = catInfo.icon

                      return (
                        <TableRow key={task.id} className="text-xs hover:bg-muted/20 transition-colors">
                          <TableCell className="text-center font-mono text-muted-foreground">
                            {task.order || idx + 1}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-foreground">{task.title}</p>
                              {task.description && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">{task.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] gap-1 border ${catInfo.color}`}>
                              <CatIcon className="size-3" /> {catInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {task.dueAfterDays ? `${task.dueAfterDays} ngày sau khi vào` : "Không giới hạn"}
                          </TableCell>
                          <TableCell>
                            {task.isRequired ? (
                              <Badge variant="teal" className="text-[10px]">
                                Bắt buộc
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Tùy chọn</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => handleOpenEditTask(task)}
                                title="Chỉnh sửa nhiệm vụ"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteTask(task.id, task.title)}
                                title="Xóa nhiệm vụ"
                              >
                                <Trash2 className="size-3.5" />
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
          </CardContent>
        </Card>
      )}

      {/* MODAL 1: CHI TIẾT TIẾN ĐỘ NHÂN VIÊN */}
      {selectedEmpProgress && (
        <Dialog open={true} onOpenChange={(open) => !open && setSelectedEmpProgress(null)}>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedEmpProgress(null)}
            />
            <div className="relative z-50 w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center justify-between">
                  <span>Tiến Độ: {selectedEmpProgress.fullName}</span>
                  <Badge variant="outline" className="text-xs">
                    {selectedEmpProgress.completed}/{selectedEmpProgress.total} hoàn thành ({selectedEmpProgress.percentage}%)
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Mã NV: {selectedEmpProgress.employeeCode} • Phòng ban: {selectedEmpProgress.departmentName || "—"}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 text-xs">
                {selectedEmpProgress.items.map((item) => {
                  const isDone = item.status === "COMPLETED"
                  const t = item.task
                  const cat = (t?.category ? CATEGORY_MAP[t.category] : undefined) ?? DEFAULT_CATEGORY

                  return (
                    <div
                      key={item.id}
                      className={`flex items-start justify-between rounded-xl border p-3 transition-colors ${
                        isDone ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-muted/10"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => handleToggleTaskStatus(item.taskId, item.status)}
                          disabled={updatingTaskId === item.taskId}
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                            isDone
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-border hover:border-primary text-transparent"
                          }`}
                        >
                          <CheckCircle2 className="size-3.5" />
                        </button>
                        <div>
                          <p className={`font-semibold ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {t?.title || "Nhiệm vụ"}
                          </p>
                          {t?.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              {cat.label}
                            </Badge>
                            {isDone && item.completedAt && (
                              <span className="text-[10px] text-emerald-400">
                                Xong lúc: {new Date(item.completedAt).toLocaleDateString("vi-VN")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        size="xs"
                        variant={isDone ? "outline" : "default"}
                        className={`text-[11px] h-7 ${isDone ? "text-muted-foreground" : "bg-primary text-primary-foreground"}`}
                        onClick={() => handleToggleTaskStatus(item.taskId, item.status)}
                        disabled={updatingTaskId === item.taskId}
                      >
                        {updatingTaskId === item.taskId ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : isDone ? (
                          "Đánh dấu chưa xong"
                        ) : (
                          "Hoàn thành"
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>

              <DialogFooter className="mt-4 pt-3 border-t border-border">
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setSelectedEmpProgress(null)}>
                  Đóng
                </Button>
              </DialogFooter>
            </div>
          </div>
        </Dialog>
      )}

      {/* MODAL 2: TẠO / SỬA NHIỆM VỤ MẪU */}
      {taskModalOpen && (
        <Dialog open={true} onOpenChange={(open) => !open && setTaskModalOpen(false)}>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setTaskModalOpen(false)}
            />
            <div className="relative z-50 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">
                  {editingTask ? "Chỉnh Sửa Nhiệm Vụ Mẫu" : "Thêm Nhiệm Vụ Mẫu Mới"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Nhiệm vụ chuẩn hóa để gán vào quy trình hội nhập cho nhân viên mới
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 flex flex-col gap-3 text-xs">
                <div>
                  <label className="font-semibold text-foreground">
                    Tiêu đề nhiệm vụ <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="VD: Nộp sơ yếu lý lịch & bằng cấp công chứng"
                    className="mt-1 text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-foreground">Mô tả chi tiết</label>
                  <textarea
                    rows={2}
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    placeholder="Hướng dẫn cách thực hiện hoặc nộp cho ai..."
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-foreground">Phân loại</label>
                    <select
                      value={taskForm.category}
                      onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="paperwork">Hồ sơ & Giấy tờ</option>
                      <option value="equipment">Thiết bị & Tài khoản</option>
                      <option value="training">Đào tạo & Quy định</option>
                      <option value="introduction">Hội nhập & Làm quen</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground">Thời hạn (ngày)</label>
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={taskForm.dueAfterDays}
                      onChange={(e) => setTaskForm({ ...taskForm, dueAfterDays: Number(e.target.value) || 7 })}
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isRequired"
                    checked={taskForm.isRequired}
                    onChange={(e) => setTaskForm({ ...taskForm, isRequired: e.target.checked })}
                    className="size-4 rounded border-border"
                  />
                  <label htmlFor="isRequired" className="font-semibold text-foreground cursor-pointer">
                    Nhiệm vụ bắt buộc hoàn thành
                  </label>
                </div>
              </div>

              <DialogFooter className="mt-6 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs flex-1"
                  onClick={() => setTaskModalOpen(false)}
                  disabled={taskBusy}
                >
                  Hủy
                </Button>
                <Button
                  size="sm"
                  className="text-xs flex-1 bg-primary text-primary-foreground gap-1"
                  onClick={handleSaveTask}
                  disabled={taskBusy || !taskForm.title.trim()}
                >
                  {taskBusy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                  {editingTask ? "Cập Nhật" : "Tạo Mới"}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
