"use client"

import * as React from "react"
import {
  Coins,
  Calculator,
  Download,
  Settings,
  Check,
  CheckCheck,
  RefreshCw,
  Banknote,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

import { payrollApi, exportPayrollCsv } from "@/lib/api/payroll.api"
import type { PayrollRecord, SalaryConfig } from "@/lib/schemas/payroll.schema"
import { currentMonthYearVN, payrollStatusLabel, vnd } from "@/lib/utils"

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

type BulkAction = "approveAll" | "paidAll" | "approveSelected" | "paidSelected"

export function PayrollView() {
  const now = currentMonthYearVN()
  const [month, setMonth] = React.useState(now.month)
  const [year, setYear] = React.useState(now.year)

  const [payrollData, setPayrollData] = React.useState<PayrollRecord[]>([])
  const [salaryConfig, setSalaryConfig] = React.useState<SalaryConfig | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isCalculating, setIsCalculating] = React.useState(false)
  const [engineResult, setEngineResult] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [showConfig, setShowConfig] = React.useState(false)
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

  React.useEffect(() => {
    payrollApi.getSalaryConfig().then(setSalaryConfig).catch(() => setSalaryConfig(null))
  }, [])

  const grossOf = (p: PayrollRecord) => p.baseSalary + p.allowances + p.overtimePay + p.bonus

  const totalGross = payrollData.reduce((acc, p) => acc + grossOf(p), 0)
  const totalDeductions = payrollData.reduce((acc, p) => acc + p.deductions, 0)
  const totalTax = payrollData.reduce((acc, p) => acc + p.tax, 0)
  const totalNet = payrollData.reduce((acc, p) => acc + p.netSalary, 0)

  /** Chạy Rule Engine thật: backend tính lương cho toàn bộ nhân viên active */
  const handleRunRuleEngine = async () => {
    setIsCalculating(true)
    setEngineResult(null)
    setActionError(null)
    try {
      const result = await payrollApi.generateBulk(month, year)
      setEngineResult(
        `Đã tính xong ${result.succeeded}/${result.total} nhân viên` +
          (result.failed > 0 ? ` — ${result.failed} nhân viên bị bỏ qua (thường do chưa có hợp đồng active).` : "."),
      )
      await loadPayroll()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setActionError(msg ?? "Không chạy được Rule Engine. Kiểm tra API server.")
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
  const selectableIds = payrollData
    .filter((p) => p.status === "DRAFT" || p.status === "APPROVED")
    .map((p) => p.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))

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
      desc: `${selectedIds.length} bản ghi đã chọn sẽ được duyệt (APPROVED).`,
      confirm: "Duyệt mục đã chọn",
    },
    paidSelected: {
      title: "Chi trả các mục đã chọn?",
      desc: `${selectedIds.length} bản ghi đã chọn sẽ chuyển sang PAID.`,
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
        setEngineResult(`✅ Đã duyệt hàng loạt ${r.approved} bản ghi lương kỳ ${String(month).padStart(2, "0")}/${year}.`)
      } else if (bulkAction === "paidAll") {
        const r = await payrollApi.markPaidBulk({ month, year })
        setEngineResult(`✅ Đã chi trả ${r.paid} bản ghi đã duyệt kỳ ${String(month).padStart(2, "0")}/${year}.`)
      } else if (bulkAction === "approveSelected") {
        const r = await payrollApi.approveBulk({ ids: selectedIds })
        setEngineResult(`✅ Đã duyệt ${r.approved}/${selectedIds.length} mục đã chọn.`)
      } else {
        const r = await payrollApi.markPaidBulk({ ids: selectedIds })
        setEngineResult(`✅ Đã chi trả ${r.paid}/${selectedIds.length} mục đã chọn.`)
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

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Bảng Lương & Rule Engine Tính Lương Tự Động
            </h1>
            <Badge variant="warning">Kỳ Tháng {String(month).padStart(2, "0")}/{year}</Badge>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Tính toán thật từ hợp đồng + chấm công trong database, theo Luật Lao động Việt Nam
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={month}
            onChange={(e) => { setMonth(Number(e.target.value)); setEngineResult(null) }}
            className="h-8 rounded-lg border border-border bg-muted/40 px-2 text-xs text-foreground"
            aria-label="Chọn tháng"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setEngineResult(null) }}
            className="h-8 rounded-lg border border-border bg-muted/40 px-2 text-xs text-foreground"
            aria-label="Chọn năm"
          >
            {[now.year - 1, now.year, now.year + 1].map((y) => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => setShowConfig(true)} className="gap-1.5">
            <Settings className="size-4" /> Cài Đặt Quy Chế
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={payrollData.length === 0}
            onClick={() => exportPayrollCsv(payrollData, month, year)}
          >
            <Download className="size-4" /> Xuất Excel (CSV)
          </Button>
          <Button
            size="sm"
            onClick={handleRunRuleEngine}
            disabled={isCalculating}
            className="gap-1.5 bg-primary text-primary-foreground"
          >
            {isCalculating ? (
              <>
                <RefreshCw className="size-4 animate-spin" /> Đang Chạy Engine...
              </>
            ) : (
              <>
                <Calculator className="size-4" /> Chạy Rule Engine Tính Lương
              </>
            )}
          </Button>
        </div>
      </div>

      {engineResult && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
          {engineResult}
        </div>
      )}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="size-3.5" /> {actionError}
        </div>
      )}

      {/* Bulk approval bar — duyệt/chi trả toàn bộ kỳ hoặc theo lựa chọn */}
      {payrollData.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <CheckCheck className="size-4 text-primary" />
          <span className="text-xs text-muted-foreground">
            Đã chọn <span className="font-semibold text-foreground">{selectedIds.length}</span>/{selectableIds.length} dòng có thể thao tác
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              className="gap-1 border-emerald-500/40 text-[11px] text-emerald-400 hover:bg-emerald-500/10"
              disabled={draftCount === 0 || isBulkRunning}
              onClick={() => setBulkAction("approveAll")}
            >
              <CheckCheck className="size-3.5" /> Duyệt Tất Cả ({draftCount} chờ duyệt)
            </Button>
            <Button
              size="xs"
              variant="outline"
              className="gap-1 border-agent-teal/40 text-[11px] text-agent-teal hover:bg-agent-teal/10"
              disabled={approvedCount === 0 || isBulkRunning}
              onClick={() => setBulkAction("paidAll")}
            >
              <Banknote className="size-3.5" /> Chi Trả Tất Cả Đã Duyệt ({approvedCount})
            </Button>
            {selectedIds.length > 0 && (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  className="text-[11px]"
                  disabled={isBulkRunning}
                  onClick={() => setBulkAction("approveSelected")}
                >
                  Duyệt Mục Đã Chọn
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  className="text-[11px]"
                  disabled={isBulkRunning}
                  onClick={() => setBulkAction("paidSelected")}
                >
                  Chi Trả Mục Đã Chọn
                </Button>
                <Button size="xs" variant="ghost" className="text-[11px]" onClick={() => setSelectedIds([])}>
                  Bỏ chọn
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Tổng Quỹ Lương Gross
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-foreground">{vnd(totalGross)}</div>
            <p className="text-xs text-muted-foreground mt-1">Lương thực tế + OT + Phụ cấp + Thưởng</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Khấu Trừ (BH + Thuế)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-agent-amber">{vnd(totalDeductions)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {insurancePercent != null ? `BHXH+BHYT+BHTN ${insurancePercent}% trên lương BH` : "Theo SalaryConfig"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Thuế Thu Nhập Cá Nhân
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-agent-coral">{vnd(totalTax)}</div>
            <p className="text-xs text-muted-foreground mt-1">Biểu thuế 7 bậc lũy tiến</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-emerald-400">
              Tổng Thực Lĩnh (Net Payout)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-emerald-400">{vnd(totalNet)}</div>
            <p className="text-xs text-emerald-500/80 mt-1">{payrollData.length} bản ghi lương trong kỳ</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Payroll Table */}
      <Card>
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <RefreshCw className="mr-2 size-4 animate-spin" /> Đang tải bảng lương...
          </div>
        ) : error ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertTriangle className="size-6 text-agent-amber" />
            <p className="text-xs">{error}</p>
          </div>
        ) : payrollData.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Coins className="size-6" />
            <p className="text-xs">
              Chưa có bảng lương cho kỳ {String(month).padStart(2, "0")}/{year}. Nhấn &ldquo;Chạy Rule Engine&rdquo; để tính từ dữ liệu chấm công thật.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">
                  <input
                    type="checkbox"
                    className="size-3.5 cursor-pointer accent-emerald-500"
                    aria-label="Chọn tất cả dòng có thể duyệt"
                    disabled={selectableIds.length === 0}
                    checked={allSelected}
                    onChange={() => setSelectedIds(allSelected ? [] : selectableIds)}
                  />
                </TableHead>
                <TableHead>Mã NV</TableHead>
                <TableHead>Họ Tên</TableHead>
                <TableHead className="text-right">Lương Thực Tế</TableHead>
                <TableHead className="text-center">Ngày Công</TableHead>
                <TableHead className="text-right">Làm Thêm (OT)</TableHead>
                <TableHead className="text-right">Tổng Gross</TableHead>
                <TableHead className="text-right">Khấu Trừ</TableHead>
                <TableHead className="text-right">Thuế TNCN</TableHead>
                <TableHead className="text-right font-bold text-primary">Thực Nhận (Net)</TableHead>
                <TableHead className="text-center">Trạng Thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payrollData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="w-10 text-center">
                    <input
                      type="checkbox"
                      className="size-3.5 cursor-pointer accent-emerald-500"
                      aria-label={`Chọn bảng lương ${item.employee.employeeCode}`}
                      disabled={item.status !== "DRAFT" && item.status !== "APPROVED"}
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{item.employee.employeeCode}</TableCell>
                  <TableCell className="font-medium text-xs text-foreground">
                    {item.employee.fullName}
                    <p className="text-[10px] text-muted-foreground">{item.employee.department.name}</p>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {vnd(item.baseSalary)}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {item.actualWorkingDays}/{item.workingDays}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {item.overtimeHours > 0 ? (
                      <div>
                        <span>+{item.overtimeHours}h</span>
                        <p className="text-[10px] text-emerald-400">+{vnd(item.overtimePay)}</p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                    {vnd(grossOf(item))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-agent-amber">
                    -{vnd(item.deductions)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-agent-coral">
                    {item.tax > 0 ? `-${vnd(item.tax)}` : "0 ₫"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-emerald-400">
                    {vnd(item.netSalary)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <Badge variant={item.status === "PAID" ? "success" : item.status === "APPROVED" ? "teal" : "warning"}>
                        {payrollStatusLabel(item.status)}
                      </Badge>
                      {item.status === "DRAFT" && (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={pendingAction === item.id}
                          onClick={() => handleApprove(item.id)}
                          className="h-6 gap-1 border-emerald-500/40 text-[10px] text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <Check className="size-3" /> Duyệt
                        </Button>
                      )}
                      {item.status === "APPROVED" && (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={pendingAction === item.id}
                          onClick={() => handleMarkPaid(item.id)}
                          className="h-6 gap-1 border-agent-teal/40 text-[10px] text-agent-teal hover:bg-agent-teal/10"
                        >
                          <Banknote className="size-3" /> Đã chi trả
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Salary Config Dialog — giá trị thật từ SalaryConfig */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogHeader>
          <DialogTitle>Cấu Hình Hằng Số Tính Lương (SalaryConfig)</DialogTitle>
          <DialogDescription>
            Tham số Rule Engine đang áp dụng{salaryConfig ? ` cho năm ${salaryConfig.year}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4 text-xs">
          {salaryConfig ? (
            <>
              <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3">
                <div>
                  <p className="font-semibold text-foreground">Giờ làm chuẩn / ngày</p>
                  <p className="text-muted-foreground text-[11px]">Dùng để quy đổi lương giờ và tính OT</p>
                </div>
                <span className="font-mono font-bold text-primary">{salaryConfig.standardWorkHours} giờ</span>
              </div>
              <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3">
                <div>
                  <p className="font-semibold text-foreground">Tỷ lệ đóng Bảo hiểm (Người lao động)</p>
                  <p className="text-muted-foreground text-[11px]">
                    BHXH ({(salaryConfig.bhxhRate * 100).toFixed(1)}%) + BHYT ({(salaryConfig.bhytRate * 100).toFixed(1)}%) + BHTN ({(salaryConfig.bhtnRate * 100).toFixed(1)}%)
                  </p>
                </div>
                <span className="font-mono font-bold text-agent-amber">
                  {((salaryConfig.bhxhRate + salaryConfig.bhytRate + salaryConfig.bhtnRate) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3">
                <div>
                  <p className="font-semibold text-foreground">Mức giảm trừ gia cảnh</p>
                  <p className="text-muted-foreground text-[11px]">Áp dụng trước khi tính thuế lũy tiến</p>
                </div>
                <span className="font-mono font-bold text-foreground">{vnd(salaryConfig.pitFreeAmount)}</span>
              </div>
              <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3">
                <div>
                  <p className="font-semibold text-foreground">Hệ số làm thêm giờ (Overtime)</p>
                  <p className="text-muted-foreground text-[11px]">Ngày thường / Cuối tuần / Ngày lễ</p>
                </div>
                <span className="font-mono font-bold text-agent-teal">
                  {salaryConfig.overtimeRate * 100}% / {salaryConfig.otWeekendRate * 100}% / {salaryConfig.otHolidayRate * 100}%
                </span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              Chưa cấu hình SalaryConfig cho kỳ này — Rule Engine đang dùng hằng số mặc định theo luật (8% + 1.5% + 1%, giảm trừ 11tr, OT 150/200/300%).
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="default" onClick={() => setShowConfig(false)}>
            Đóng
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
          <Button disabled={isBulkRunning} onClick={confirmBulk} className="gap-1.5">
            {isBulkRunning ? <RefreshCw className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
            {bulkAction ? bulkMeta[bulkAction].confirm : "Xác nhận"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
