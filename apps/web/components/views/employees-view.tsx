"use client"

import * as React from "react"
import {
  Search,
  Plus,
  FileSpreadsheet,
  MoreHorizontal,
  Mail,
  Building,
  ShieldCheck,
  UserCheck,
  Calendar,
  CreditCard,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Employee {
  id: string
  code: string
  fullName: string
  email: string
  dept: string
  position: string
  contractType: string
  remainingLeaves: number
  totalLeaves: number
  status: "Chính thức" | "Thử việc" | "Đang nghỉ"
  baseSalary: number
  joinDate: string
  avatar: string
}

const mockEmployees: Employee[] = [
  {
    id: "1",
    code: "EMP-001",
    fullName: "Nguyễn Văn Đạt",
    email: "dat.nguyen@company.com",
    dept: "Kỹ thuật & AI",
    position: "Senior Frontend Lead",
    contractType: "Không thời hạn",
    remainingLeaves: 9.5,
    totalLeaves: 12,
    status: "Chính thức",
    baseSalary: 28000000,
    joinDate: "01/03/2024",
    avatar: "NĐ",
  },
  {
    id: "2",
    code: "EMP-002",
    fullName: "Trần Thị Mai",
    email: "mai.tran@company.com",
    dept: "Hành chính & Nhân sự",
    position: "HR Operations Lead",
    contractType: "Không thời hạn",
    remainingLeaves: 11,
    totalLeaves: 12,
    status: "Chính thức",
    baseSalary: 24000000,
    joinDate: "15/05/2024",
    avatar: "TM",
  },
  {
    id: "3",
    code: "EMP-003",
    fullName: "Lê Hoàng Quân",
    email: "quan.le@company.com",
    dept: "Kỹ thuật & AI",
    position: "AI Multi-Agent Specialist",
    contractType: "Có thời hạn 1 năm",
    remainingLeaves: 8,
    totalLeaves: 12,
    status: "Chính thức",
    baseSalary: 32000000,
    joinDate: "10/01/2025",
    avatar: "HQ",
  },
  {
    id: "4",
    code: "EMP-004",
    fullName: "Phạm Thùy Linh",
    email: "linh.pham@company.com",
    dept: "Kinh doanh & CSKH",
    position: "Customer Support Executive",
    contractType: "Thử việc 2 tháng",
    remainingLeaves: 2,
    totalLeaves: 2,
    status: "Thử việc",
    baseSalary: 14000000,
    joinDate: "01/08/2026",
    avatar: "TL",
  },
  {
    id: "5",
    code: "EMP-005",
    fullName: "Vũ Tuấn Anh",
    email: "anh.vu@company.com",
    dept: "Sản phẩm & UI/UX",
    position: "Product Designer",
    contractType: "Không thời hạn",
    remainingLeaves: 6.5,
    totalLeaves: 12,
    status: "Chính thức",
    baseSalary: 26000000,
    joinDate: "20/09/2024",
    avatar: "TA",
  },
]

export function EmployeesView() {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedDept, setSelectedDept] = React.useState("Tất cả")
  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null)

  const departments = ["Tất cả", "Kỹ thuật & AI", "Hành chính & Nhân sự", "Kinh doanh & CSKH", "Sản phẩm & UI/UX"]

  const filtered = mockEmployees.filter((emp) => {
    const matchName =
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchDept = selectedDept === "Tất cả" || emp.dept === selectedDept
    return matchName && matchDept
  })

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
          <Button variant="outline" size="sm" className="gap-2">
            <FileSpreadsheet className="size-4" /> Xuất Excel
          </Button>
          <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground">
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
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedDept === dept
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Mã NV</TableHead>
              <TableHead>Nhân Viên</TableHead>
              <TableHead>Phòng Ban & Chức Vụ</TableHead>
              <TableHead>Loại Hợp Đồng</TableHead>
              <TableHead>Phép Năm Còn Lại</TableHead>
              <TableHead>Trạng Thái</TableHead>
              <TableHead className="text-right">Hành Động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((emp) => (
              <TableRow key={emp.id} className="cursor-pointer" onClick={() => setSelectedEmployee(emp)}>
                <TableCell className="font-mono text-xs font-semibold text-primary">{emp.code}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar initials={emp.avatar} className="bg-primary/15 text-primary border border-primary/20" />
                    <div>
                      <p className="font-medium text-foreground text-xs">{emp.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">{emp.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-xs font-medium text-foreground">{emp.position}</p>
                    <p className="text-[11px] text-muted-foreground">{emp.dept}</p>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{emp.contractType}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-agent-teal rounded-full"
                        style={{ width: `${(emp.remainingLeaves / emp.totalLeaves) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-foreground font-medium">
                      {emp.remainingLeaves}/{emp.totalLeaves}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={emp.status === "Chính thức" ? "success" : "warning"}>
                    {emp.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedEmployee(emp)
                    }}
                  >
                    Xem Hồ Sơ
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Slide-over Profile Drawer */}
      {selectedEmployee && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card p-6 shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <Avatar initials={selectedEmployee.avatar} className="size-10 bg-primary/20 text-primary font-bold text-sm" />
              <div>
                <h3 className="font-bold text-base text-foreground">{selectedEmployee.fullName}</h3>
                <p className="text-xs text-muted-foreground">{selectedEmployee.code} • {selectedEmployee.dept}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedEmployee(null)}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-5 py-6 overflow-y-auto">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Thông Tin Hợp Đồng & Nhân Sự
              </p>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between rounded-lg bg-muted/40 p-2.5">
                  <span className="text-muted-foreground">Vị trí chức danh</span>
                  <span className="font-medium text-foreground">{selectedEmployee.position}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-muted/40 p-2.5">
                  <span className="text-muted-foreground">Loại hợp đồng</span>
                  <span className="font-medium text-foreground">{selectedEmployee.contractType}</span>
                </div>
                <div className="flex justify-between rounded-lg bg-muted/40 p-2.5">
                  <span className="text-muted-foreground">Ngày vào làm việc</span>
                  <span className="font-medium text-foreground">{selectedEmployee.joinDate}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Lương Thỏa Thuận & Chế Độ
              </p>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between rounded-lg bg-muted/40 p-2.5">
                  <span className="text-muted-foreground">Lương cơ bản đóng BH</span>
                  <span className="font-mono font-bold text-primary">
                    ₫{selectedEmployee.baseSalary.toLocaleString("vi-VN")}
                  </span>
                </div>
                <div className="flex justify-between rounded-lg bg-muted/40 p-2.5">
                  <span className="text-muted-foreground">Bảo hiểm bắt buộc (10.5%)</span>
                  <span className="font-mono text-muted-foreground">
                    ₫{(selectedEmployee.baseSalary * 0.105).toLocaleString("vi-VN")}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Tích Hợp AI Context (WF01 & WF02)
              </p>
              <div className="rounded-xl border border-agent-teal/30 bg-agent-teal/5 p-3 text-xs text-agent-teal">
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <ShieldCheck className="size-4" /> Ngữ Cảnh Tự Động Nạp Cho Chatbot
                </div>
                <p className="text-[11px] leading-relaxed text-foreground/80">
                  Khi nhân viên này nhắn tin với n8n HR Q&A, bot sẽ tự động nhận diện số ngày phép còn lại ({selectedEmployee.remainingLeaves} ngày) và chức vụ để trả lời chính xác mà không cần hỏi lại.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-auto border-t border-border pt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedEmployee(null)}>
              Đóng
            </Button>
            <Button variant="default" className="flex-1">
              Chỉnh Sửa Hồ Sơ
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
