"use client"

import * as React from "react"
import {
  Coins,
  CheckCheck,
  RefreshCw,
  AlertTriangle,
  Calendar,
  ChevronDown,
  Wallet,
  ShieldCheck,
  Receipt,
  Banknote,
  CircleCheck,
  BadgeCheck,
  Hourglass,
  BookOpen,
  Download,
  Calculator,
  Check,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

import { payrollApi, exportPayrollCsv } from "@/lib/api/payroll.api"
import { apiClient } from "@/lib/api/client"
import { SalaryConfigSchema, type PayrollRecord, type SalaryConfig } from "@/lib/schemas/payroll.schema"
import { currentMonthYearVN, payrollStatusLabel, vnd } from "@/lib/utils"

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

type BulkAction = "approveAll" | "paidAll" | "approveSelected" | "paidSelected"

export function PayrollView() {
  const now = currentMonthYearVN()
  const [month, setMonth] = React.useState(now.month)
  const [year, setYear] = React.useState(now.year)

  const [payrollData, setPayrollData] = React.useState<PayrollRecord[]>([])
  const [salaryConfig, setSalaryConfig] = React.useState<SalaryConfig | null>(null)
  const [configLoadError, setConfigLoadError] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isCalculating, setIsCalculating] = React.useState(false)
  const [engineResult, setEngineResult] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [showConfig, setShowConfig] = React.useState(false)
  const [showCalculateConfirm, setShowCalculateConfirm] = React.useState(false)
  const [pendingAction, setPendingAction] = React.useState<string | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [bulkAction, setBulkAction] = React.useState<BulkAction | null>(null)
  const [isBulkRunning, setIsBulkRunning] = React.useState(false)

  const loadPayroll = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await payrollApi.list(month, year)
      setPayrollData(list)
      setSelectedIds([])
    } catch (e) {
      console.error(e)
      setError("Không tải được bảng lương. Kiểm tra API server hoặc chưa có dữ liệu kỳ này.")
    } finally {
      setLoading(false)
    }
  }, [month, year])

  React.useEffect(() => {
    loadPayroll()
  }, [loadPayroll])

  // Quy chế lương theo đúng năm đang chọn (backend tính lương cũng lấy theo năm, không có thì dùng mặc định theo luật)
  React.useEffect(() => {
    let cancelled = false
    setConfigLoadError(false)
    apiClient
      .get("/salary-config")
      .then(({ data }) => {
        if (cancelled) return
        const list = SalaryConfigSchema.array().parse(data)
        setSalaryConfig(list.find((c) => c.year === year) ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setSalaryConfig(null)
        setConfigLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [year])

  const grossOf = (p: PayrollRecord) => p.baseSalary + p.allowances + p.overtimePay + p.bonus

  const totalGross = payrollData.reduce((acc, p) => acc + grossOf(p), 0)
  const totalDeductions = payrollData.reduce((acc, p) => acc + p.deductions, 0)
  const totalTax = payrollData.reduce((acc, p) => acc + p.tax, 0)
  const totalNet = payrollData.reduce((acc, p) => acc + p.netSalary, 0)

  /** Tính lương cho toàn bộ nhân viên đang làm việc trong kỳ */
  const handleRunRuleEngine = async () => {
    setIsCalculating(true)
    setEngineResult(null)
    setActionError(null)
    try {
      const result = await payrollApi.generateBulk(month, year)
      // Gom lý do lỗi thật từ backend (vd. bảng lương đã duyệt, chưa có hợp đồng hiệu lực)
      const errors = (result as { errors?: string[] }).errors ?? []
      const reasonCounts = new Map<string, number>()
      for (const m of errors) reasonCounts.set(m, (reasonCounts.get(m) ?? 0) + 1)
      const reasons = Array.from(reasonCounts, ([m, n]) => (n > 1 ? `${m} (${n} nhân viên)` : m)).join("; ")
      setEngineResult(
        `Đã tính xong ${result.succeeded}/${result.total} nhân viên` +
          (result.failed > 0
            ? ` — ${result.failed} nhân viên bị bỏ qua${reasons ? `: ${reasons}` : "."}`
            : "."),
      )
      await loadPayroll()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setActionError(msg ?? "Không tính được lương. Vui lòng thử lại sau.")
    } finally {
      setIsCalculating(false)
    }
  }

  const handleApprove = async (id: string) => {
    setPendingAction(id)
    setActionError(null)
    try {
      await payrollApi.approve(id)
      await loadPayroll()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setActionError(msg ?? "Duyệt bảng lương thất bại.")
    } finally {
      setPendingAction(null)
    }
  }

  const handleMarkPaid = async (id: string) => {
    setPendingAction(id)
    setActionError(null)
    try {
      await payrollApi.markPaid(id)
      await loadPayroll()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setActionError(msg ?? "Đánh dấu chi trả thất bại.")
    } finally {
      setPendingAction(null)
    }
  }

  const insurancePercent = salaryConfig
    ? (salaryConfig.bhxhRate + salaryConfig.bhytRate + salaryConfig.bhtnRate) * 100
    : null

  // ── Duyệt / chi trả hàng loạt ───────────────────────────────────────────
  const draftCount = payrollData.filter((p) => p.status === "DRAFT").length
  const approvedCount = payrollData.filter((p) => p.status === "APPROVED").length
  const selectedDraftCount = payrollData.filter((p) => selectedIds.includes(p.id) && p.status === "DRAFT").length
  const selectedApprovedCount = payrollData.filter((p) => selectedIds.includes(p.id) && p.status === "APPROVED").length
  const selectableIds = payrollData
    .filter((p) => p.status === "DRAFT" || p.status === "APPROVED")
    .map((p) => p.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))
  // Số dòng không thể chọn (đã chi trả) — hiển thị giải thích để tránh hiểu nhầm "checkbox bị hỏng"
  const lockedCount = payrollData.length - selectableIds.length

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const bulkMeta: Record<Exclude<BulkAction, null>, { title: string; desc: string; confirm: string }> = {
    approveAll: {
      title: "Duyệt toàn bộ kỳ lương?",
      desc: `Tất cả ${draftCount} bản ghi DRAFT của kỳ ${String(month).padStart(2, "0")}/${year} sẽ chuyển sang APPROVED. Các bản ghi đã duyệt/đã chi trả không bị ảnh hưởng.`,
      confirm: "Duyệt tất cả",
    },
    paidAll: {
      title: "Chi trả toàn bộ bản ghi đã duyệt?",
      desc: `${approvedCount} bản ghi APPROVED của kỳ ${String(month).padStart(2, "0")}/${year} sẽ chuyển sang PAID.`,
      confirm: "Chi trả tất cả",
    },
    approveSelected: {
      title: "Duyệt các mục đã chọn?",
      desc: `${selectedDraftCount} bản ghi chờ duyệt (DRAFT) trong số đã chọn sẽ được duyệt (APPROVED).`,
      confirm: "Duyệt mục đã chọn",
    },
    paidSelected: {
      title: "Chi trả các mục đã chọn?",
      desc: `${selectedApprovedCount} bản ghi đã duyệt (APPROVED) trong số đã chọn sẽ chuyển sang PAID.`,
      confirm: "Chi trả mục đã chọn",
    },
  }

  const confirmBulk = async () => {
    if (!bulkAction) return
    setIsBulkRunning(true)
    setActionError(null)
    try {
      if (bulkAction === "approveAll") {
        const r = await payrollApi.approveBulk({ month, year })
        setEngineResult(`Đã duyệt hàng loạt ${r.approved} bản ghi lương kỳ ${String(month).padStart(2, "0")}/${year}.`)
      } else if (bulkAction === "paidAll") {
        const r = await payrollApi.markPaidBulk({ month, year })
        setEngineResult(`Đã chi trả ${r.paid} bản ghi đã duyệt kỳ ${String(month).padStart(2, "0")}/${year}.`)
      } else if (bulkAction === "approveSelected") {
        const r = await payrollApi.approveBulk({ ids: selectedIds })
        setEngineResult(`Đã duyệt ${r.approved}/${selectedIds.length} mục đã chọn.`)
      } else {
        const r = await payrollApi.markPaidBulk({ ids: selectedIds })
        setEngineResult(`Đã chi trả ${r.paid}/${selectedIds.length} mục đã chọn.`)
      }
      setBulkAction(null)
      setSelectedIds([])
      await loadPayroll()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setActionError(msg ?? "Thao tác hàng loạt thất bại.")
    } finally {
      setIsBulkRunning(false)
    }
  }

  const periodLabel = `${String(month).padStart(2, "0")}/${year}`
  const selectClass =
    "h-8 cursor-pointer appearance-none rounded-md border border-input bg-card pl-2.5 pr-8 text-xs text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"

  const statusBadge = (status: PayrollRecord["status"]) => {
    if (status === "PAID")
      return (
        <Badge variant="success">
          <CircleCheck /> {payrollStatusLabel(status)}
        </Badge>
      )
    if (status === "APPROVED")
      return (
        <Badge variant="info">
          <BadgeCheck /> {payrollStatusLabel(status)}
        </Badge>
      )
    return (
      <Badge variant="warning">
        <Hourglass /> {payrollStatusLabel(status)}
      </Badge>
    )
  }

  const summaryTiles = [
    {
      label: "Tổng gross",
      value: totalGross,
      sub: "Lương thực tế + OT + phụ cấp + thưởng",
      icon: Wallet,
      tint: "bg-primary-tint text-primary",
    },
    {
      label: "Khấu trừ",
      value: totalDeductions,
      sub:
        insurancePercent != null
          ? `BHXH + BHYT + BHTN ${insurancePercent.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% trên lương BH`
          : "Bảo hiểm theo quy chế lương",
      icon: ShieldCheck,
      tint: "bg-warning-tint text-warning",
    },
    {
      label: "Thuế TNCN",
      value: totalTax,
      sub: "Biểu thuế 5 bậc (từ 01/7/2026)",
      icon: Receipt,
      tint: "bg-danger-tint text-danger",
    },
    {
      label: "Thực lĩnh",
      value: totalNet,
      sub: `${payrollData.length} bản ghi lương trong kỳ`,
      icon: Banknote,
      tint: "bg-success-tint text-success",
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-semibold text-foreground">Bảng lương & thuế</h1>
          <p className="mt-1 text-body text-muted-foreground">
            Tính từ hợp đồng và dữ liệu chấm công, theo Luật Lao động Việt Nam
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setShowConfig(true)}>
            <BookOpen /> Xem quy chế lương
          </Button>
          <Button
            variant="outline"
            disabled={payrollData.length === 0}
            onClick={() => exportPayrollCsv(payrollData, month, year)}
          >
            <Download /> Xuất Excel (CSV)
          </Button>
          <Button onClick={() => setShowCalculateConfirm(true)} disabled={isCalculating}>
            {isCalculating ? (
              <>
                <RefreshCw className="animate-spin" /> Đang tính lương...
              </>
            ) : (
              <>
                <Calculator /> Tính lương
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Toolbar: kỳ lương & thao tác hàng loạt — gọn 1 dòng ở desktop */}
      <Card className="flex flex-col gap-3 p-3 min-[1180px]:flex-row min-[1180px]:items-center min-[1180px]:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-[1180px]:flex-nowrap">
          <div className="flex items-center gap-1.5 text-xs font-medium text-secondary-foreground">
            <Calendar className="size-3.5 text-muted-foreground" />
            <span className="whitespace-nowrap">Kỳ lương</span>
          </div>

          <div className="relative">
            <select
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value))
                setEngineResult(null)
              }}
              className={selectClass}
              aria-label="Chọn tháng"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          <div className="relative">
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value))
                setEngineResult(null)
              }}
              className={selectClass}
              aria-label="Chọn năm"
            >
              {[now.year - 1, now.year, now.year + 1].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          <Badge variant="outline" className="tabular h-7 whitespace-nowrap px-2 text-[11px] font-medium">
            <span className="size-1.5 rounded-full bg-success" />
            Kỳ {periodLabel} · {payrollData.length} phiếu
          </Badge>
        </div>

        {payrollData.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-2 min-[1180px]:flex-nowrap">
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              Đã chọn{" "}
              <strong className="font-semibold text-foreground tabular">{selectedIds.length}</strong>/
              <span className="tabular">{selectableIds.length}</span>
              {lockedCount > 0 && (
                <span className="hidden xl:inline" title="Các dòng đã chi trả không thể thay đổi trạng thái">
                  {" "}
                  · {lockedCount} đã chi trả
                </span>
              )}
            </span>
            {selectedIds.length === 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={draftCount === 0 || isBulkRunning}
                  onClick={() => setBulkAction("approveAll")}
                  className="h-7 gap-1 px-2 text-[11px]"
                  title={`Duyệt toàn bộ ${draftCount} bản ghi đang chờ duyệt trong kỳ`}
                >
                  <CheckCheck className="size-3.5" /> Duyệt ({draftCount})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={approvedCount === 0 || isBulkRunning}
                  onClick={() => setBulkAction("paidAll")}
                  className="h-7 gap-1 px-2 text-[11px]"
                  title={`Chi trả toàn bộ ${approvedCount} bản ghi đã duyệt trong kỳ`}
                >
                  <Banknote className="size-3.5" /> Chi trả ({approvedCount})
                </Button>
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Chưa có bảng lương kỳ này — nhấn &ldquo;Tính lương&rdquo; để khởi tạo.
          </p>
        )}
      </Card>

      {engineResult && (
        <div className="flex items-start gap-2 rounded-lg border border-success/20 bg-success-tint px-4 py-3 text-body-sm text-success">
          <CircleCheck className="mt-0.5 size-4 shrink-0" /> <span>{engineResult}</span>
        </div>
      )}
      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint px-4 py-3 text-body-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <span>{actionError}</span>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {summaryTiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="flex items-start justify-between gap-3 pt-4 sm:pt-5">
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-muted-foreground">{t.label}</p>
                <p className="mt-1.5 whitespace-nowrap text-[22px] font-semibold leading-7 text-foreground tabular">{vnd(t.value)}</p>
                <p className="mt-1 text-caption text-muted-foreground">{t.sub}</p>
              </div>
              <div className={`flex size-8 shrink-0 items-center justify-center rounded-md ${t.tint}`}>
                <t.icon className="size-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main payroll table */}
      <Card className="overflow-hidden p-0">
        <p className="border-b border-border-subtle px-4 py-2 text-caption text-muted-foreground xl:hidden">
          Kéo ngang bảng để xem đủ các cột lương.
        </p>
        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton h-10 w-full rounded-md" />
            ))}
            <span className="sr-only">Đang tải bảng lương...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="flex size-10 items-center justify-center rounded-md bg-warning-tint text-warning">
              <AlertTriangle className="size-5" />
            </div>
            <p className="text-body-sm text-muted-foreground">{error}</p>
          </div>
        ) : payrollData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Coins className="size-5" />
            </div>
            <p className="text-body font-semibold text-foreground">Chưa có bảng lương kỳ {periodLabel}</p>
            <p className="text-body-sm text-muted-foreground">
              Nhấn &ldquo;Tính lương&rdquo; để tính từ dữ liệu chấm công thật.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1180px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-primary"
                      aria-label="Chọn tất cả dòng có thể duyệt"
                      title="Chọn tất cả các dòng Chờ duyệt / Đã duyệt"
                      disabled={selectableIds.length === 0}
                      checked={allSelected}
                      onChange={() => setSelectedIds(allSelected ? [] : selectableIds)}
                    />
                  </TableHead>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead className="text-right">Lương thực tế</TableHead>
                  <TableHead className="text-center">Ngày công</TableHead>
                  <TableHead className="text-right">Làm thêm (OT)</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Khấu trừ</TableHead>
                  <TableHead className="text-right">Thuế</TableHead>
                  <TableHead className="text-right">Thực lĩnh</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData.map((item) => {
                  const selected = selectedIds.includes(item.id)
                  return (
                    <TableRow key={item.id} data-state={selected ? "selected" : undefined}>
                      <TableCell className="w-12 text-center">
                        <input
                          type="checkbox"
                          className={`size-4 accent-primary ${
                            item.status === "DRAFT" || item.status === "APPROVED"
                              ? "cursor-pointer"
                              : "cursor-not-allowed opacity-40"
                          }`}
                          aria-label={`Chọn bảng lương ${item.employee?.employeeCode ?? ''}`}
                          disabled={item.status !== "DRAFT" && item.status !== "APPROVED"}
                          title={
                            item.status === "PAID"
                              ? "Đã chi trả — dòng này không thể chọn để duyệt/chi trả"
                              : item.status === "APPROVED"
                                ? "Đã duyệt — có thể chọn để chi trả"
                                : item.status === "DRAFT"
                                  ? "Chờ duyệt — có thể chọn để duyệt"
                                  : "Không thể chọn"
                          }
                          checked={selected}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{item.employee?.fullName ?? '--'}</p>
                        <p className="text-caption text-muted-foreground">
                          <span className="font-mono">{item.employee?.employeeCode ?? '--'}</span>
                          {item.employee?.department?.name ? ` · ${item.employee.department.name}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-right text-secondary-foreground tabular">
                        {vnd(item.baseSalary)}
                      </TableCell>
                      <TableCell className="text-center text-secondary-foreground tabular">
                        {item.actualWorkingDays}/{item.workingDays}
                      </TableCell>
                      <TableCell className="text-right text-secondary-foreground tabular">
                        {item.overtimeHours > 0 ? (
                          <div>
                            <span>+{item.overtimeHours}h</span>
                            <p className="text-caption text-success">+{vnd(item.overtimePay)}</p>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right text-foreground tabular">
                        {vnd(grossOf(item))}
                      </TableCell>
                      <TableCell className="text-right text-secondary-foreground tabular">
                        -{vnd(item.deductions)}
                        {(item.advance ?? 0) > 0 && (
                          <p className="text-caption text-muted-foreground">- ứng {vnd(item.advance!)}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-secondary-foreground tabular">
                        {item.tax > 0 ? `-${vnd(item.tax)}` : "0 ₫"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground tabular">
                        {vnd(item.netSalary)}
                      </TableCell>
                      <TableCell>{statusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        {item.status === "DRAFT" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingAction === item.id}
                            onClick={() => handleApprove(item.id)}
                          >
                            <Check /> Duyệt
                          </Button>
                        )}
                        {item.status === "APPROVED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingAction === item.id}
                            onClick={() => {
                              if (confirm(`Xác nhận đã chi trả lương cho ${item.employee?.fullName ?? "nhân viên này"}? Thao tác này không thể hoàn tác.`)) {
                                handleMarkPaid(item.id)
                              }
                            }}
                          >
                            <Banknote /> Đánh dấu đã chi trả
                          </Button>
                        )}
                        {item.status === "PAID" && <span className="text-body-sm text-subtle-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell />
                  <TableCell colSpan={4} className="text-foreground">
                    Tổng cộng ({payrollData.length} phiếu)
                  </TableCell>
                  <TableCell className="text-right text-foreground">{vnd(totalGross)}</TableCell>
                  <TableCell className="text-right text-foreground">-{vnd(totalDeductions)}</TableCell>
                  <TableCell className="text-right text-foreground">
                    {totalTax > 0 ? `-${vnd(totalTax)}` : "0 ₫"}
                  </TableCell>
                  <TableCell className="text-right text-foreground">{vnd(totalNet)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </Card>

      {/* Thanh thao tác nổi khi có dòng được chọn */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-max -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-pop">
          <span className="mr-2 text-body-sm font-medium text-foreground">
            Đã chọn <span className="tabular">{selectedIds.length}</span> phiếu
          </span>
          <Button
            size="sm"
            disabled={selectedDraftCount === 0 || isBulkRunning}
            onClick={() => setBulkAction("approveSelected")}
          >
            <CheckCheck /> Duyệt ({selectedDraftCount})
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedApprovedCount === 0 || isBulkRunning}
            onClick={() => setBulkAction("paidSelected")}
          >
            <Banknote /> Chi trả ({selectedApprovedCount})
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            Bỏ chọn
          </Button>
        </div>
      )}

      {/* Dialog xem quy chế lương (chỉ đọc) theo năm đang chọn */}
      <Dialog open={showConfig} onOpenChange={setShowConfig} className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Quy chế tính lương</DialogTitle>
          <DialogDescription>
            Các tham số đang áp dụng khi tính lương năm {year}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {salaryConfig ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-sunken p-4">
                <p className="text-body-sm font-medium text-foreground">Giờ làm chuẩn / ngày</p>
                <p className="text-h3 font-semibold text-foreground tabular">{salaryConfig.standardWorkHours} giờ</p>
                <p className="text-caption text-muted-foreground">Dùng để quy đổi lương giờ và tính OT</p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-sunken p-4">
                <p className="text-body-sm font-medium text-foreground">Tỷ lệ đóng bảo hiểm (người lao động)</p>
                <p className="text-h3 font-semibold text-foreground tabular">
                  {((salaryConfig.bhxhRate + salaryConfig.bhytRate + salaryConfig.bhtnRate) * 100).toFixed(1).replace(".", ",")}%
                </p>
                <p className="text-caption text-muted-foreground tabular">
                  BHXH ({(salaryConfig.bhxhRate * 100).toFixed(1).replace(".", ",")}%) + BHYT ({(salaryConfig.bhytRate * 100).toFixed(1).replace(".", ",")}%) + BHTN ({(salaryConfig.bhtnRate * 100).toFixed(1).replace(".", ",")}%)
                </p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-sunken p-4">
                <p className="text-body-sm font-medium text-foreground">Giảm trừ bản thân</p>
                <p className="text-h3 font-semibold text-foreground tabular">{vnd(salaryConfig.pitFreeAmount)}</p>
                <p className="text-caption text-muted-foreground">Áp dụng trước khi tính thuế lũy tiến</p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-sunken p-4">
                <p className="text-body-sm font-medium text-foreground">Hệ số làm thêm giờ</p>
                <p className="text-h3 font-semibold text-foreground tabular">
                  {salaryConfig.overtimeRate * 100}% / {salaryConfig.otWeekendRate * 100}% / {salaryConfig.otHolidayRate * 100}%
                </p>
                <p className="text-caption text-muted-foreground">Ngày thường / cuối tuần / ngày lễ</p>
              </div>
            </div>
          ) : configLoadError ? (
            <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint px-4 py-3 text-body-sm text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Không tải được quy chế lương. Vui lòng thử lại sau.
            </div>
          ) : (
            <p className="text-body-sm text-muted-foreground">
              Chưa thiết lập quy chế riêng cho năm {year} — hệ thống đang dùng mức mặc định theo luật (bảo hiểm 8% + 1.5% + 1%, giảm trừ gia cảnh và hệ số làm thêm giờ theo quy định hiện hành).
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowConfig(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Confirm dialog trước khi chạy Rule Engine (thao tác ghi dữ liệu) */}
      <Dialog open={showCalculateConfirm} onOpenChange={setShowCalculateConfirm}>
        <DialogHeader>
          <DialogTitle>Tính lương kỳ {periodLabel}?</DialogTitle>
          <DialogDescription>
            Hệ thống sẽ tính lại bảng lương cho nhân sự đang làm việc từ hợp đồng và dữ liệu chấm công.
            Các bản ghi đã duyệt hoặc đã chi trả sẽ được giữ nguyên.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCalculateConfirm(false)}>Hủy</Button>
          <Button
            onClick={() => {
              setShowCalculateConfirm(false)
              void handleRunRuleEngine()
            }}
          >
            <Calculator /> Bắt đầu tính
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Confirm dialog cho thao tác duyệt/chi trả hàng loạt */}
      <Dialog open={bulkAction !== null} onOpenChange={(open) => { if (!open) setBulkAction(null) }}>
        <DialogHeader>
          <DialogTitle>{bulkAction ? bulkMeta[bulkAction].title : ""}</DialogTitle>
          <DialogDescription>{bulkAction ? bulkMeta[bulkAction].desc : ""}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isBulkRunning} onClick={() => setBulkAction(null)}>
            Hủy
          </Button>
          <Button disabled={isBulkRunning} onClick={confirmBulk}>
            {isBulkRunning && <RefreshCw className="animate-spin" />}
            {bulkAction ? bulkMeta[bulkAction].confirm : "Xác nhận"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
