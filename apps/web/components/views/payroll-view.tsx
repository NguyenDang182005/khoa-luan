"use client"

import * as React from "react"
import {
  Coins,
  Calculator,
  Download,
  Settings,
  ShieldAlert,
  Check,
  RefreshCw,
  Eye,
  FileCheck2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

interface PayrollRecord {
  code: string
  name: string
  baseSalary: number
  workDays: number
  standardDays: number
  otHours: number
  otPay: number
  allowance: number
  gross: number
  insurance: number // 10.5% (BHXH 8%, BHYT 1.5%, BHTN 1%)
  pitTax: number
  net: number
  status: "Đã duyệt" | "Chờ duyệt"
}

const initialPayroll: PayrollRecord[] = [
  {
    code: "EMP-001",
    name: "Nguyễn Văn Đạt",
    baseSalary: 28000000,
    workDays: 22,
    standardDays: 22,
    otHours: 12,
    otPay: 2863636,
    allowance: 1500000,
    gross: 32363636,
    insurance: 2940000,
    pitTax: 1250000,
    net: 28173636,
    status: "Đã duyệt",
  },
  {
    code: "EMP-002",
    name: "Trần Thị Mai",
    baseSalary: 24000000,
    workDays: 21,
    standardDays: 22,
    otHours: 0,
    otPay: 0,
    allowance: 1500000,
    gross: 24409090,
    insurance: 2520000,
    pitTax: 620000,
    net: 21269090,
    status: "Đã duyệt",
  },
  {
    code: "EMP-003",
    name: "Lê Hoàng Quân",
    baseSalary: 32000000,
    workDays: 22,
    standardDays: 22,
    otHours: 18,
    otPay: 5236363,
    allowance: 2000000,
    gross: 39236363,
    insurance: 3360000,
    pitTax: 2150000,
    net: 33726363,
    status: "Chờ duyệt",
  },
  {
    code: "EMP-004",
    name: "Phạm Thùy Linh",
    baseSalary: 14000000,
    workDays: 22,
    standardDays: 22,
    otHours: 4,
    otPay: 477272,
    allowance: 1000000,
    gross: 15477272,
    insurance: 1470000,
    pitTax: 0,
    net: 14007272,
    status: "Chờ duyệt",
  },
  {
    code: "EMP-005",
    name: "Vũ Tuấn Anh",
    baseSalary: 26000000,
    workDays: 22,
    standardDays: 22,
    otHours: 6,
    otPay: 1063636,
    allowance: 1500000,
    gross: 28563636,
    insurance: 2730000,
    pitTax: 890000,
    net: 24943636,
    status: "Đã duyệt",
  },
]

export function PayrollView() {
  const [payrollData, setPayrollData] = React.useState(initialPayroll)
  const [isCalculating, setIsCalculating] = React.useState(false)
  const [showConfig, setShowConfig] = React.useState(false)

  // Quick sums
  const totalGross = payrollData.reduce((acc, p) => acc + p.gross, 0)
  const totalInsurance = payrollData.reduce((acc, p) => acc + p.insurance, 0)
  const totalTax = payrollData.reduce((acc, p) => acc + p.pitTax, 0)
  const totalNet = payrollData.reduce((acc, p) => acc + p.net, 0)

  const handleRunRuleEngine = () => {
    setIsCalculating(true)
    setTimeout(() => {
      setIsCalculating(false)
      // Mark all as approved
      setPayrollData((prev) =>
        prev.map((item) => ({ ...item, status: "Đã duyệt" }))
      )
    }, 1200)
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
            <Badge variant="warning">Kỳ Tháng 09/2026</Badge>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Tính toán tự động theo Luật Lao động Việt Nam: BHXH 8%, BHYT 1.5%, BHTN 1%, Thuế TNCN 7 bậc
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfig(true)} className="gap-1.5">
            <Settings className="size-4" /> Cài Đặt Quy Chế
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="size-4" /> Xuất Excel
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Tổng Quỹ Lương Gross
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-foreground">
              ₫{Math.round(totalGross).toLocaleString("vi-VN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Bao gồm lương cơ bản + OT + Phụ cấp</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Khấu Trừ Bảo Hiểm (10.5%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-agent-amber">
              ₫{Math.round(totalInsurance).toLocaleString("vi-VN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">BHXH (8%), BHYT (1.5%), BHTN (1%)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Thuế Thu Nhập Cá Nhân
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-agent-coral">
              ₫{Math.round(totalTax).toLocaleString("vi-VN")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Áp dụng giảm trừ gia cảnh 11tr & biểu 7 bậc</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-emerald-400">
              Tổng Thực Lĩnh (Net Payout)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-emerald-400">
              ₫{Math.round(totalNet).toLocaleString("vi-VN")}
            </div>
            <p className="text-xs text-emerald-500/80 mt-1">Sẵn sàng lập lệnh chi chuyển khoản ngân hàng</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Payroll Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã NV</TableHead>
              <TableHead>Họ Tên</TableHead>
              <TableHead className="text-right">Lương Cơ Bản</TableHead>
              <TableHead className="text-center">Ngày Công</TableHead>
              <TableHead className="text-right">Làm Thêm (OT)</TableHead>
              <TableHead className="text-right">Tổng Gross</TableHead>
              <TableHead className="text-right">BH Bắt Buộc</TableHead>
              <TableHead className="text-right">Thuế TNCN</TableHead>
              <TableHead className="text-right font-bold text-primary">Thực Nhận (Net)</TableHead>
              <TableHead className="text-center">Trạng Thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollData.map((item) => (
              <TableRow key={item.code}>
                <TableCell className="font-mono text-xs font-semibold text-primary">{item.code}</TableCell>
                <TableCell className="font-medium text-xs text-foreground">{item.name}</TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  ₫{item.baseSalary.toLocaleString("vi-VN")}
                </TableCell>
                <TableCell className="text-center font-mono text-xs">
                  {item.workDays}/{item.standardDays}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {item.otHours > 0 ? (
                    <div>
                      <span>+{item.otHours}h</span>
                      <p className="text-[10px] text-emerald-400">+₫{Math.round(item.otPay).toLocaleString("vi-VN")}</p>
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                  ₫{Math.round(item.gross).toLocaleString("vi-VN")}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-agent-amber">
                  -₫{Math.round(item.insurance).toLocaleString("vi-VN")}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-agent-coral">
                  {item.pitTax > 0 ? `-₫${Math.round(item.pitTax).toLocaleString("vi-VN")}` : "0 ₫"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs font-bold text-emerald-400">
                  ₫{Math.round(item.net).toLocaleString("vi-VN")}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={item.status === "Đã duyệt" ? "success" : "warning"}>
                    {item.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Salary Config Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogHeader>
          <DialogTitle>Cấu Hình Hằng Số Tính Lương (SalaryConfig)</DialogTitle>
          <DialogDescription>
            Quy định các tham số tính toán của Rule Engine theo pháp luật hiện hành
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4 text-xs">
          <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3">
            <div>
              <p className="font-semibold text-foreground">Ngày công chuẩn trong tháng</p>
              <p className="text-muted-foreground text-[11px]">Dùng để quy đổi lương ngày và lương giờ</p>
            </div>
            <span className="font-mono font-bold text-primary">22 ngày</span>
          </div>

          <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3">
            <div>
              <p className="font-semibold text-foreground">Tỷ lệ đóng Bảo hiểm (Người lao động)</p>
              <p className="text-muted-foreground text-[11px]">BHXH (8%) + BHYT (1.5%) + BHTN (1%)</p>
            </div>
            <span className="font-mono font-bold text-agent-amber">10.5%</span>
          </div>

          <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3">
            <div>
              <p className="font-semibold text-foreground">Mức giảm trừ gia cảnh</p>
              <p className="text-muted-foreground text-[11px]">Bản thân: 11,000,000 ₫ • Phụ thuộc: 4,400,000 ₫/người</p>
            </div>
            <span className="font-mono font-bold text-foreground">11,000,000 ₫</span>
          </div>

          <div className="flex justify-between items-center rounded-lg bg-muted/40 p-3">
            <div>
              <p className="font-semibold text-foreground">Hệ số làm thêm giờ (Overtime)</p>
              <p className="text-muted-foreground text-[11px]">Ngày thường: 150% • Cuối tuần: 200% • Ngày lễ: 300%</p>
            </div>
            <span className="font-mono font-bold text-agent-teal">150% / 200% / 300%</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="default" onClick={() => setShowConfig(false)}>
            Lưu Cấu Hình
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
