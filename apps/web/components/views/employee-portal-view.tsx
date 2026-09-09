"use client"

import * as React from "react"
import {
  Clock,
  Calendar,
  FileText,
  MapPin,
  CheckCircle2,
  Download,
  Send,
  Plus,
  Bot,
  Sparkles,
  X,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

export function EmployeePortalView() {
  const [showLeaveModal, setShowLeaveModal] = React.useState(false)
  const [showPayslipDetails, setShowPayslipDetails] = React.useState(false)
  const [floatingChatOpen, setFloatingChatOpen] = React.useState(false)
  const [chatInput, setChatInput] = React.useState("")
  const [chatMessages, setChatMessages] = React.useState<{ role: "user" | "bot"; text: string }[]>([
    {
      role: "bot",
      text: "Xin chào anh Đạt! Em là Trợ lý HR AI (WF02). Anh cần hỗ trợ tra cứu chế độ thai sản, công tác phí hay thủ tục xin nghỉ phép ạ?",
    },
  ])

  const [leaveDays, setLeaveDays] = React.useState(9.5)
  const [checkOutDone, setCheckOutDone] = React.useState(false)

  const handleSendChat = () => {
    if (!chatInput.trim()) return
    const text = chatInput.trim()
    setChatMessages((prev) => [...prev, { role: "user", text }])
    setChatInput("")

    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: `[HR AI]: Dạ em đã tra cứu thông tin liên quan đến "${text}". Dữ liệu hợp đồng của anh Đạt tại Công nghệ & AI cho thấy anh được hưởng chế độ phụ cấp ăn trưa 1.5tr và còn ${leaveDays} ngày phép năm ạ!`,
        },
      ])
    }, 500)
  }

  return (
    <div className="relative flex flex-col gap-6 p-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Bàn Làm Việc Cá Nhân (Employee Portal)
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Xin chào, Nguyễn Văn Đạt (Senior Frontend Lead • Mã NV: EMP-001)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="teal" className="gap-1 px-3 py-1">
            <span className="size-2 rounded-full bg-agent-teal animate-pulse" />
            Trợ lý AI Đang Trực Tuyến
          </Badge>
        </div>
      </div>

      {/* Row 1: 3 Quick Action Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* GPS Geofencing Attendance Card */}
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Chấm Công Định Vị GPS Hôm Nay
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">08:28 AM</span>
              <Badge variant="success" className="text-[10px]">Đúng Giờ</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="size-3 text-emerald-400" /> Tòa nhà Innovation Hub (Cách 42m - Hợp lệ)
            </p>
            <div className="mt-3">
              {!checkOutDone ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1 border-agent-amber/40 hover:bg-agent-amber/10 text-agent-amber"
                  onClick={() => setCheckOutDone(true)}
                >
                  Chấm Công Ra (Check-out)
                </Button>
              ) : (
                <div className="rounded-lg bg-emerald-500/10 p-2 text-center text-xs font-semibold text-emerald-400">
                  ✓ Đã check-out lúc 17:35
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Annual Leaves Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Phép Năm Còn Lại
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-agent-teal/10 text-agent-teal">
              <Calendar className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-agent-teal">
              {leaveDays} <span className="text-xs font-normal text-muted-foreground">/ 12 ngày</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted mt-2 overflow-hidden">
              <div className="h-full bg-agent-teal rounded-full" style={{ width: `${(leaveDays / 12) * 100}%` }} />
            </div>
            <div className="mt-3">
              <Button
                size="sm"
                className="w-full text-xs gap-1 bg-primary text-primary-foreground"
                onClick={() => setShowLeaveModal(true)}
              >
                <Plus className="size-3.5" /> Tạo Đơn Nghỉ Phép
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Latest Payslip Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Phiếu Lương Tháng 08/2026
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <CreditCard className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              ₫28,173,636
            </div>
            <p className="text-xs text-muted-foreground mt-1">Đã chuyển khoản vào tài khoản Techcombank</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs gap-1"
                onClick={() => setShowPayslipDetails(!showPayslipDetails)}
              >
                {showPayslipDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                {showPayslipDetails ? "Ẩn Chi Tiết" : "Xem Chi Tiết"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expandable Payslip Breakdown */}
      {showPayslipDetails && (
        <Card className="border-border/80 animate-in fade-in duration-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-semibold">Chi Tiết Phiếu Lương Điện Tử (Kỳ 08/2026)</CardTitle>
              <CardDescription>Bảng phân rã các khoản thu nhập và giảm trừ theo luật</CardDescription>
            </div>
            <Button size="xs" variant="outline" className="gap-1">
              <Download className="size-3.5" /> Tải PDF
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4 pt-2">
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Lương cơ bản</span>
                <p className="font-mono font-bold text-foreground mt-1">₫28,000,000</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Làm thêm giờ (12h OT)</span>
                <p className="font-mono font-bold text-emerald-400 mt-1">+₫2,863,636</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Bảo hiểm bắt buộc (10.5%)</span>
                <p className="font-mono font-bold text-agent-amber mt-1">-₫2,940,000</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <span className="text-muted-foreground">Thuế TNCN (Biểu 7 bậc)</span>
                <p className="font-mono font-bold text-agent-coral mt-1">-₫1,250,000</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 2: Onboarding Roadmap Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            Lộ Trình Hội Nhập Của Bạn (Onboarding Journey)
          </CardTitle>
          <CardDescription>Hoàn thành các mốc quan trọng để nhận chứng chỉ chính thức</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-emerald-400" />
                <div>
                  <p className="font-semibold text-foreground">1. Ký hợp đồng lao động điện tử & nạp CCCD</p>
                  <p className="text-[11px] text-muted-foreground">Đã hoàn thành ngày 01/03/2024</p>
                </div>
              </div>
              <Badge variant="success">Hoàn thành</Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-emerald-400" />
                <div>
                  <p className="font-semibold text-foreground">2. Bài kiểm tra Nội quy Công ty (5 câu trắc nghiệm)</p>
                  <p className="text-[11px] text-muted-foreground">Đạt 5/5 điểm tuyệt đối</p>
                </div>
              </div>
              <Badge variant="success">Đạt 100%</Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-emerald-400" />
                <div>
                  <p className="font-semibold text-foreground">3. Đánh giá Xử lý Tình huống AI (WF03 Training Agent)</p>
                  <p className="text-[11px] text-muted-foreground">Đạt 8.8/10 điểm trên 4 tiêu chí mềm</p>
                </div>
              </div>
              <Badge variant="amber">8.8 / 10 điểm</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leave Application Modal */}
      <Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal}>
        <DialogHeader>
          <DialogTitle>Tạo Đơn Xin Nghỉ Phép</DialogTitle>
          <DialogDescription>
            Đơn của bạn sẽ được gửi tới Quản lý trực tiếp và nạp vào ngữ cảnh AI
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-3 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Loại nghỉ phép</label>
            <select className="w-full mt-1 rounded-lg border border-border bg-input/40 p-2 text-foreground outline-none">
              <option>Nghỉ phép năm có hưởng lương</option>
              <option>Nghỉ ốm đau / bảo hiểm y tế</option>
              <option>Nghỉ việc riêng không hưởng lương</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Thời gian nghỉ</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input type="date" defaultValue="2026-09-12" className="rounded-lg border border-border bg-input/40 p-2 text-foreground text-xs" />
              <input type="date" defaultValue="2026-09-13" className="rounded-lg border border-border bg-input/40 p-2 text-foreground text-xs" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Lý do nghỉ phép</label>
            <textarea placeholder="Nhập lý do nghỉ phép..." rows={2} className="w-full mt-1 rounded-lg border border-border bg-input/40 p-2 text-foreground text-xs outline-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowLeaveModal(false)}>Hủy</Button>
          <Button
            variant="default"
            onClick={() => {
              setShowLeaveModal(false)
              setLeaveDays((prev) => prev - 1)
            }}
          >
            Gửi Đơn Xin Phép
          </Button>
        </DialogFooter>
      </Dialog>

      {/* FLOATING HR AI ASSISTANT WIDGET */}
      <div className="fixed bottom-6 right-6 z-50">
        {!floatingChatOpen ? (
          <Button
            onClick={() => setFloatingChatOpen(true)}
            className="size-14 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 p-0 shadow-2xl hover:scale-105 transition-transform"
          >
            <Bot className="size-7 text-white" />
          </Button>
        ) : (
          <div className="flex h-[450px] w-80 flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Widget Header */}
            <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 p-3 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Trợ Lý HR AI (WF02)</h4>
                  <p className="text-[10px] text-muted-foreground">Sẵn sàng 24/7 • Gemini 3.5</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setFloatingChatOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 text-xs">
              {chatMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl p-2.5 leading-relaxed max-w-[85%] ${
                    m.role === "user"
                      ? "self-end bg-primary text-primary-foreground"
                      : "self-start bg-muted/60 text-foreground border border-border"
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="border-t border-border p-2.5 bg-composer rounded-b-2xl">
              <div className="flex items-center gap-1.5">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                  placeholder="Hỏi chính sách, ngày phép..."
                  className="flex-1 rounded-lg border border-border bg-input/40 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                />
                <Button size="icon" className="size-7 bg-primary text-primary-foreground" onClick={handleSendChat}>
                  <Send className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
