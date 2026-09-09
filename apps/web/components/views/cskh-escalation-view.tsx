"use client"

import * as React from "react"
import {
  ShieldAlert,
  AlertTriangle,
  BellRing,
  Bot,
  UserCheck,
  Send,
  Lock,
  Eye,
  RefreshCw,
  CheckCircle2,
  Phone,
  Volume2,
  VolumeX,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface EscalatedCase {
  id: string
  customerName: string
  zaloId: string
  phone: string
  angerScore: number
  waitTime: string
  reason: string
  botActive: boolean
  lastMessage: string
}

const mockCases: EscalatedCase[] = [
  {
    id: "ESC-01",
    customerName: "Nguyễn Thị Thu (Khách VIP)",
    zaloId: "zalo_98412",
    phone: "0987***321",
    angerScore: 9.8,
    waitTime: "1 phút 15 giây",
    reason: "Hàng giao trễ 3 ngày hỏng sự kiện ra mắt, dọa kiện pháp lý",
    botActive: false,
    lastMessage: "Tôi yêu cầu nói chuyện trực tiếp với quản lý ngay bây giờ!",
  },
  {
    id: "ESC-02",
    customerName: "Trần Bảo Nam",
    zaloId: "zalo_11204",
    phone: "0903***554",
    angerScore: 8.6,
    waitTime: "4 phút 30 giây",
    reason: "Sản phẩm lỗi kỹ thuật chưa được đổi mới theo cam kết",
    botActive: false,
    lastMessage: "Đã nhắn tin từ sáng tới giờ chưa ai giải quyết đổi hàng!",
  },
]

const piiAuditData = [
  {
    time: "14:32:05",
    channel: "Zalo CSKH",
    raw: "Tôi là Hoàng Nam, CCCD 038095012345, SĐT 0912345678, cần hỗ trợ gấp đơn #8821.",
    masked: "Tôi là Hoàng Nam, CCCD [MASKED_ID], SĐT [MASKED_PHONE], cần hỗ trợ gấp đơn #8821.",
    status: "Đã khử định danh 100%",
  },
  {
    time: "14:28:40",
    channel: "HR Portal",
    raw: "Gửi hợp đồng qua email ca-nhan-nam@gmail.com và số tài khoản 19034567890.",
    masked: "Gửi hợp đồng qua email [MASKED_EMAIL] và số tài khoản [MASKED_ACCOUNT].",
    status: "Đã khử định danh 100%",
  },
]

export function CskhEscalationView() {
  const [cases, setCases] = React.useState<EscalatedCase[]>(mockCases)
  const [activeCaseId, setActiveCaseId] = React.useState("ESC-01")
  const [audioEnabled, setAudioEnabled] = React.useState(true)
  const [humanReply, setHumanReply] = React.useState("")
  const [chatLog, setChatLog] = React.useState<
    { sender: "customer" | "bot" | "human"; text: string; time: string }[]
  >([
    {
      sender: "customer",
      text: "Shop làm ăn kiểu gì vậy? Hàng giao trễ 3 ngày nay làm hỏng cả sự kiện khai trương của tôi!",
      time: "14:30",
    },
    {
      sender: "bot",
      text: "Dạ em rất xin lỗi vì sự cố chậm trễ này đã ảnh hưởng nghiêm trọng đến sự kiện của chị Thu ạ. Em đã ghi nhận đơn hàng #8821.",
      time: "14:30",
    },
    {
      sender: "customer",
      text: "Tôi không muốn nói chuyện với máy móc nữa! Cho tôi gặp trực tiếp quản lý ngay nếu không tôi sẽ báo hội bảo vệ người tiêu dùng!",
      time: "14:31",
    },
    {
      sender: "bot",
      text: "🚨 [Hệ thống tự động kích hoạt Escalate] Em đã chuyển trường hợp khẩn cấp này cho Trưởng ca CSKH tiếp quản ngay bây giờ ạ!",
      time: "14:31",
    },
  ])

  const activeCase = (cases.find((c) => c.id === activeCaseId) || cases[0] || mockCases[0])!

  const handleSendHuman = () => {
    if (!humanReply.trim()) return
    setChatLog((prev) => [
      ...prev,
      {
        sender: "human",
        text: humanReply.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ])
    setHumanReply("")
  }

  const handleReactivateBot = (caseId: string) => {
    setCases((prev) =>
      prev.map((c) => (c.id === caseId ? { ...c, botActive: true } : c))
    )
    setChatLog((prev) => [
      ...prev,
      {
        sender: "bot",
        text: "🤖 [Hệ thống thông báo]: Nhân viên quản trị đã bật lại AI Bot cho khách hàng này. Phiên chat tiếp tục được phục vụ bởi Gemini 3.5 Flash.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ])
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* KILLER FEATURE #2: EMERGENCY WEBSOCKET ESCALATION BANNER */}
      <div className="relative overflow-hidden rounded-xl border border-agent-coral/40 bg-gradient-to-r from-agent-coral/20 via-agent-coral/10 to-transparent p-4 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex size-10 items-center justify-center rounded-xl bg-agent-coral text-white shadow-md shadow-agent-coral/30 animate-pulse">
              <ShieldAlert className="size-6" />
              <span className="absolute -right-1 -top-1 flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-red-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">
                  CẢNH BÁO WEBSOCKET: PHÁT HIỆN KHIẾU NẠI KHẨN CẤP (HUMAN-IN-THE-LOOP)
                </h2>
                <Badge variant="coral">Chỉ số giận dữ: {activeCase.angerScore}/10</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                WF04 (CSKH Agent) đã tự động ngắt kết nối Bot (Mute) để nhường quyền can thiệp cho chuyên viên HR/Admin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="gap-1.5 border-agent-coral/30"
            >
              {audioEnabled ? <Volume2 className="size-3.5 text-agent-coral" /> : <VolumeX className="size-3.5" />}
              {audioEnabled ? "Chuông Báo Động: Bật" : "Chuông: Tắt"}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs: Takeover Console vs PII Masking Audit Trail */}
      <Tabs defaultValue="console" className="w-full">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <TabsList>
            <TabsTrigger value="console" className="gap-1.5">
              <UserCheck className="size-3.5" /> Bàn Tiếp Quản Khách Hàng
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <Lock className="size-3.5" /> Nhật Ký PII Masking (Bảo Mật)
            </TabsTrigger>
          </TabsList>
          <Badge variant="outline" className="text-[11px]">
            Cơ chế Reset phiên On-demand: Sau 00:00 VN tự động hồi sinh Bot
          </Badge>
        </div>

        {/* Tab 1: Live Takeover Console */}
        <TabsContent value="console" className="mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column: List of Escalated Cases */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  Hàng Đợi Khẩn Cấp ({cases.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5 p-4 pt-0">
                {cases.map((c) => {
                  const isSelected = c.id === activeCaseId
                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveCaseId(c.id)}
                      className={`flex flex-col gap-2 rounded-xl border p-3 cursor-pointer transition-all ${
                        isSelected
                          ? "border-agent-coral bg-agent-coral/10 shadow-sm"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{c.customerName}</span>
                        <Badge variant={c.botActive ? "teal" : "coral"} className="text-[10px] py-0">
                          {c.botActive ? "Bot Đang Bật" : "Bot Đã Tắt (Mute)"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-agent-coral font-medium">⚠️ {c.reason}</p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-2 mt-1">
                        <span>Chờ phản hồi: {c.waitTime}</span>
                        <span>{c.zaloId}</span>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Right Column: Split Screen Live Chat Room */}
            <Card className="lg:col-span-2 flex flex-col h-[520px]">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <Avatar initials="KH" className="bg-agent-coral/20 text-agent-coral border border-agent-coral/30" />
                  <div>
                    <h3 className="text-xs font-bold text-foreground">{activeCase.customerName}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Kênh: Zalo OA • Mã khách: {activeCase.zaloId} • SĐT: {activeCase.phone}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!activeCase.botActive ? (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleReactivateBot(activeCase.id)}
                      className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-1"
                    >
                      <Bot className="size-3.5" /> 🤖 Bật Lại Bot AI Ngay
                    </Button>
                  ) : (
                    <Badge variant="teal">Bot Đã Hoạt Động Trở Lại</Badge>
                  )}
                </div>
              </CardHeader>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {chatLog.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-[80%] rounded-xl p-3 text-xs leading-relaxed ${
                      item.sender === "customer"
                        ? "self-start bg-muted/60 text-foreground border border-border"
                        : item.sender === "bot"
                        ? "self-end bg-agent-coral/15 text-foreground border border-agent-coral/30"
                        : "self-end bg-primary text-primary-foreground shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-[10px] opacity-75 mb-1">
                      <span className="font-semibold">
                        {item.sender === "customer"
                          ? activeCase.customerName
                          : item.sender === "bot"
                          ? "WF04 CSKH AI Bot"
                          : "HR Admin (Bạn)"}
                      </span>
                      <span>{item.time}</span>
                    </div>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>

              {/* Chat Input Bar */}
              <div className="border-t border-border p-3 bg-composer">
                <div className="flex items-center gap-2">
                  <input
                    value={humanReply}
                    onChange={(e) => setHumanReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendHuman()}
                    placeholder="Nhập nội dung tiếp quản với tư cách Chuyên viên HR/Admin..."
                    className="flex-1 rounded-lg border border-border bg-input/40 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                  />
                  <Button size="sm" onClick={handleSendHuman} className="gap-1 bg-primary text-primary-foreground">
                    <Send className="size-3.5" /> Gửi
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: PII Masking Audit Trail */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lock className="size-4 text-emerald-400" />
                Kiểm Toán Mã Hóa Dữ Liệu Riêng Tư (PII Masking Audit Trail)
              </CardTitle>
              <CardDescription>
                Chứng minh toàn bộ CCCD, Số điện thoại và Email đều bị che trước khi chuyển đến Google Gemini Cloud
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {piiAuditData.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-border p-4 bg-muted/20">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
                      <span className="text-xs font-mono text-muted-foreground">{item.time} • Kênh {item.channel}</span>
                      <Badge variant="success">{item.status}</Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-xs">
                      <div className="rounded-lg bg-card p-3 border border-border">
                        <p className="text-[10px] font-semibold uppercase text-agent-coral mb-1">
                          Nội dung gốc trong nội bộ (Database)
                        </p>
                        <p className="text-muted-foreground">{item.raw}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-500/10 p-3 border border-emerald-500/20">
                        <p className="text-[10px] font-semibold uppercase text-emerald-400 mb-1">
                          Chuỗi dữ liệu an toàn gửi lên Gemini AI
                        </p>
                        <p className="text-foreground font-mono">{item.masked}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
