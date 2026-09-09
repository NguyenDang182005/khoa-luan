"use client"

import * as React from "react"
import {
  Users,
  Clock,
  Coins,
  Bot,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

const attendanceData = [
  { day: "01/09", onTime: 235, late: 10, leave: 3 },
  { day: "02/09", onTime: 240, late: 5, leave: 3 },
  { day: "03/09", onTime: 238, late: 7, leave: 3 },
  { day: "04/09", onTime: 232, late: 12, leave: 4 },
  { day: "05/09", onTime: 242, late: 4, leave: 2 },
  { day: "06/09", onTime: 244, late: 3, leave: 1 },
  { day: "07/09", onTime: 240, late: 6, leave: 2 },
  { day: "08/09", onTime: 245, late: 2, leave: 1 },
  { day: "09/09", onTime: 241, late: 5, leave: 2 },
]

const departmentData = [
  { name: "Kỹ thuật & AI", value: 110, color: "oklch(0.68 0.18 260)" },
  { name: "Kinh doanh & CSKH", value: 65, color: "oklch(0.75 0.14 180)" },
  { name: "Sản phẩm & UI/UX", value: 45, color: "oklch(0.78 0.15 82)" },
  { name: "Hành chính & Nhân sự", value: 28, color: "oklch(0.70 0.18 28)" },
]

const initialPendingLeaves = [
  { id: "LV-101", name: "Nguyễn Văn Đạt", role: "Frontend Lead", date: "10/09 - 12/09 (3 ngày)", reason: "Nghỉ phép gia đình", avatar: "NĐ" },
  { id: "LV-102", name: "Trần Thị Mai", role: "HR Specialist", date: "15/09 (1 ngày)", reason: "Khám sức khỏe định kỳ", avatar: "TM" },
  { id: "LV-103", name: "Lê Hoàng Quân", role: "AI Engineer", date: "11/09 (1 ngày)", reason: "Nghỉ việc cá nhân", avatar: "HQ" },
]

const aiActivities = [
  { time: "14:35", agent: "WF01 - Router", query: "Phân loại ý định hỏi ngày phép", status: "Chuyển WF02", latency: "180ms", color: "teal" },
  { time: "14:32", agent: "WF04 - Zalo CSKH", query: "Phát hiện khiếu nại giao hàng gay gắt", status: "Escalate Admin", latency: "340ms", color: "coral" },
  { time: "14:28", agent: "WF03 - Training", query: "Chấm điểm tự luận tình huống KH", status: "8.5 / 10 điểm", latency: "620ms", color: "amber" },
  { time: "14:20", agent: "WF02 - HR Q&A", query: "Trả lời công thức tính lương OT", status: "Đã phản hồi", latency: "250ms", color: "blue" },
]

export function DashboardView() {
  const [pendingLeaves, setPendingLeaves] = React.useState(initialPendingLeaves)

  const handleAction = (id: string) => {
    setPendingLeaves((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top Header Banner */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Bảng Điều Hành Nhân Sự & AI Multi-Agent
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Theo dõi tổng quan quân số, chấm công, quỹ lương và hiệu năng điều phối của 4 AI Agent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="teal" className="gap-1 px-3 py-1">
            <span className="size-2 rounded-full bg-agent-teal animate-pulse" />
            4 Workflows n8n Đang Hoạt Động
          </Badge>
        </div>
      </div>

      {/* Row 1: 4 Key Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tổng Quân Số
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">248 <span className="text-xs font-normal text-muted-foreground">nhân sự</span></div>
            <p className="mt-1 flex items-center text-xs text-emerald-400">
              <TrendingUp className="mr-1 size-3" /> +5.2% so với tháng trước
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-agent-teal/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tỷ Lệ Đi Làm Hôm Nay
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-agent-teal/10 text-agent-teal">
              <Clock className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-agent-teal">94.2%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              241 đúng giờ • 5 đi muộn • 2 nghỉ phép
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-agent-amber/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Quỹ Lương Tháng 09
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-agent-amber/10 text-agent-amber">
              <Coins className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₫3.25 Tỷ</div>
            <p className="mt-1 flex items-center text-xs text-muted-foreground">
              <ArrowUpRight className="mr-1 size-3 text-agent-amber" /> Đã chốt dự thảo sơ bộ
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-agent-coral/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              AI Multi-Agent Resolution
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-agent-coral/10 text-agent-coral">
              <Bot className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-agent-coral">98.4%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              1,420 câu hỏi • 3 ca Escalate con người
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Charts (Recharts Area & Pie) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Xu Hướng Chấm Công 9 Ngày Đầu Tháng</CardTitle>
            <CardDescription>Số lượng nhân sự đúng giờ, đi muộn và nghỉ phép thực tế</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="onTimeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.68 0.18 260)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="oklch(0.68 0.18 260)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.78 0.15 82)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="oklch(0.78 0.15 82)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.028 250)" />
                  <XAxis dataKey="day" stroke="oklch(0.65 0.025 240)" fontSize={12} />
                  <YAxis stroke="oklch(0.65 0.025 240)" fontSize={12} domain={[200, 260]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.18 0.025 248)",
                      borderColor: "oklch(0.26 0.028 250)",
                      borderRadius: "8px",
                      color: "oklch(0.94 0.015 235)",
                    }}
                  />
                  <Area type="monotone" dataKey="onTime" name="Đúng giờ" stroke="oklch(0.68 0.18 260)" fillOpacity={1} fill="url(#onTimeGrad)" />
                  <Area type="monotone" dataKey="late" name="Đi muộn" stroke="oklch(0.78 0.15 82)" fillOpacity={1} fill="url(#lateGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Phân Bổ Nhân Lực</CardTitle>
            <CardDescription>Tỷ trọng cơ cấu theo từng khối phòng ban</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.18 0.025 248)",
                      borderColor: "oklch(0.26 0.028 250)",
                      borderRadius: "8px",
                      color: "oklch(0.94 0.015 235)",
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Actionable Lists (Pending Approvals & AI Activity Feed) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Duyệt Đơn Nghỉ Phép Chờ Xử Lý</CardTitle>
              <CardDescription>Cần HR Admin hoặc Quản lý trực tiếp phê duyệt</CardDescription>
            </div>
            <Badge variant="secondary">{pendingLeaves.length} đơn mới</Badge>
          </CardHeader>
          <CardContent>
            {pendingLeaves.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-muted-foreground">
                <CheckCircle2 className="size-8 text-emerald-400 mb-2" />
                <p className="text-xs">Đã xử lý hết toàn bộ đơn nghỉ phép!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar initials={leave.avatar} className="bg-primary/20 text-primary border border-primary/30" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{leave.name}</p>
                        <p className="text-[11px] text-muted-foreground">{leave.role} • {leave.date}</p>
                        <p className="text-[11px] text-muted-foreground italic">"{leave.reason}"</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="xs" variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAction(leave.id)}>
                        <CheckCircle2 className="size-3 mr-1" /> Duyệt
                      </Button>
                      <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleAction(leave.id)}>
                        <XCircle className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="size-4 text-agent-teal" />
                Nhật Ký Tác Vụ AI Multi-Agent (n8n Stream)
              </CardTitle>
              <CardDescription>Giao dịch phân luồng ý định & xử lý thời gian thực</CardDescription>
            </div>
            <Badge variant="teal">Trực tuyến</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {aiActivities.map((act, index) => (
                <div key={index} className="flex items-start justify-between rounded-lg border border-border/70 bg-card p-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex size-6 items-center justify-center rounded bg-agent-teal/15 text-agent-teal">
                      <Zap className="size-3" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{act.agent}</span>
                        <span className="text-[10px] text-muted-foreground">{act.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{act.query}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={act.color as any} className="text-[10px] px-1.5 py-0">
                      {act.status}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">{act.latency}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
