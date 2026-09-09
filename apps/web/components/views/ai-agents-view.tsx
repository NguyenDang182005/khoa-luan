"use client"

import * as React from "react"
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  Command,
  FileText,
  Hash,
  Inbox,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Zap,
  MessageSquare,
  RefreshCw,
  Cpu,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"

interface AgentItem {
  id: string
  name: string
  workflow: string
  detail: string
  tone: string
  badgeVariant: "teal" | "blue" | "amber" | "coral"
  icon: any
  unread: boolean
  model: string
  latency: string
  accuracy: string
  sources: number
}

const agentList: AgentItem[] = [
  {
    id: "wf01",
    name: "Router & Privacy Agent",
    workflow: "WF01 - Router Agent",
    detail: "Phân loại ý định & PII Masking",
    tone: "bg-agent-teal/20 text-agent-teal border-agent-teal/30",
    badgeVariant: "teal",
    icon: Bot,
    unread: false,
    model: "gemini-3.5-flash",
    latency: "180ms",
    accuracy: "99.1%",
    sources: 4,
  },
  {
    id: "wf02",
    name: "HR Policy Q&A Agent",
    workflow: "WF02 - HR Q&A Agent",
    detail: "Hỏi đáp ngày phép, bảo hiểm, lương",
    tone: "bg-agent-blue/20 text-agent-blue border-agent-blue/30",
    badgeVariant: "blue",
    icon: MessageSquare,
    unread: true,
    model: "gemini-3.5-flash",
    latency: "310ms",
    accuracy: "98.5%",
    sources: 12,
  },
  {
    id: "wf03",
    name: "Training & Onboarding Agent",
    workflow: "WF03 - Training Agent",
    detail: "Luyện tập 2 chiều & chấm điểm tự luận",
    tone: "bg-agent-amber/20 text-agent-amber border-agent-amber/30",
    badgeVariant: "amber",
    icon: Activity,
    unread: true,
    model: "gemini-3.5-flash",
    latency: "620ms",
    accuracy: "96.8%",
    sources: 6,
  },
  {
    id: "wf04",
    name: "Zalo CSKH & Escalation Agent",
    workflow: "WF04 - Zalo CSKH",
    detail: "Tương tác khách hàng & phát hiện giận dữ",
    tone: "bg-agent-coral/20 text-agent-coral border-agent-coral/30",
    badgeVariant: "coral",
    icon: ShieldAlert,
    unread: false,
    model: "gemini-3.5-flash",
    latency: "420ms",
    accuracy: "97.4%",
    sources: 8,
  },
]

interface ChatMessage {
  author: string
  role: string
  time: string
  initials: string
  avatarColor: string
  bot?: boolean
  text: string
  tags?: string[]
  insight?: string
}

const defaultConversations: Record<string, ChatMessage[]> = {
  wf01: [
    {
      author: "Nguyễn Văn Đạt",
      role: "Nhân viên (EMP-001)",
      time: "14:10",
      initials: "NĐ",
      avatarColor: "bg-primary/20 text-primary",
      text: "Xin chào, số CCCD của tôi là 038095012345, tôi muốn hỏi tôi còn bao nhiêu ngày phép năm?",
    },
    {
      author: "WF01 Router Agent",
      role: "Security & Intent Gateway",
      time: "14:10",
      initials: "R1",
      avatarColor: "bg-agent-teal/20 text-agent-teal",
      bot: true,
      text: "Đã phân tích yêu cầu. Tin nhắn đã được làm sạch PII: 'Số CCCD của tôi là [MASKED_ID], tôi muốn hỏi ngày phép'. Ý định phát hiện: `HR_LEAVE_INQUIRY`. Đang điều hướng sang WF02 - HR Q&A Agent.",
      insight: "Intent: HR_LEAVE • Confidence: 99.4% • PII Masked: 1 item",
    },
  ],
  wf02: [
    {
      author: "Nguyễn Văn Đạt",
      role: "Nhân viên (EMP-001)",
      time: "14:11",
      initials: "NĐ",
      avatarColor: "bg-primary/20 text-primary",
      text: "Tôi còn bao nhiêu ngày phép trong năm 2026?",
    },
    {
      author: "WF02 HR Q&A Agent",
      role: "HR Assistant (Gemini 3.5 Flash)",
      time: "14:11",
      initials: "QA",
      avatarColor: "bg-agent-blue/20 text-agent-blue",
      bot: true,
      text: "Chào anh Đạt (EMP-001)! Dựa trên dữ liệu hồ sơ nhân sự của anh từ hệ thống NestJS, tổng quỹ phép năm 2026 của anh là 12 ngày. Anh đã sử dụng 2.5 ngày và hiện còn 9.5 ngày phép hợp lệ.",
      tags: ["ngày-phép", "emp-001", "chính-sách-2026"],
      insight: "Trích xuất trực tiếp từ database NestJS /api/v1/employees/EMP-001 • Độ trễ: 280ms",
    },
  ],
  wf03: [
    {
      author: "Trần Thị Mai",
      role: "Học viên Onboarding",
      time: "10:30",
      initials: "TM",
      avatarColor: "bg-primary/20 text-primary",
      text: "Tình huống 1: Khách hàng gọi đến tức giận vì đơn hàng giao trễ. Tôi sẽ lắng nghe chân thành, xin lỗi vì sự bất tiện, chủ động kiểm tra định vị bưu kiện và đền bù cho khách voucher giảm giá 15% cho đơn tiếp theo.",
    },
    {
      author: "WF03 Training Evaluator",
      role: "AI Soft-Skill Coach",
      time: "10:31",
      initials: "TR",
      avatarColor: "bg-agent-amber/20 text-agent-amber",
      bot: true,
      text: "Đánh giá bài làm tình huống: Điểm tổng hợp: 8.8 / 10 điểm.\n• Chuyên nghiệp: 9/10 (Thái độ chuẩn mực, đúng quy trình)\n• Thấu cảm: 9/10 (Lắng nghe và nhận trách nhiệm tốt)\n• Giải pháp: 8.5/10 (Đã có giải pháp kiểm tra và đền bù voucher)\n• Rõ ràng: 8.7/10 (Diễn đạt súc tích).",
      tags: ["kỹ-năng-cskh", "đào-tạo-2026"],
      insight: "AI Scoring: 4 Soft Criteria • Tự động gửi điểm về NestJS Training Analytics",
    },
  ],
  wf04: [
    {
      author: "Khách Hàng Zalo (0912***789)",
      role: "Zalo User External",
      time: "13:20",
      initials: "KH",
      avatarColor: "bg-agent-coral/20 text-agent-coral",
      text: "Shop làm ăn tắc trách quá! Giao trễ 3 ngày nay làm hỏng cả sự kiện của tôi. Tôi sẽ kiện lên hội bảo vệ người tiêu dùng nếu không giải quyết ngay!",
    },
    {
      author: "WF04 Zalo CSKH Agent",
      role: "AI Bot Escalation Guard",
      time: "13:20",
      initials: "CS",
      avatarColor: "bg-agent-coral/20 text-agent-coral",
      bot: true,
      text: "Dạ em thành thật xin lỗi vì trải nghiệm rất không tốt của mình ạ. Sự việc này đã được chuyển ngay cho Quản lý Chăm sóc Khách hàng cấp cao của chúng em để gọi điện xử lý đền bù trực tiếp cho anh/chị trong 5 phút tới ạ!",
      insight: "🚨 Tag [CAN_ESCALATE] kích hoạt • Đã gửi Webhook và âm thanh cảnh báo tới Web Admin",
    },
  ],
}

export function AiAgentsView() {
  const [activeAgentId, setActiveAgentId] = React.useState("wf01")
  const [inputMessage, setInputMessage] = React.useState("")
  const [messages, setMessages] = React.useState(defaultConversations)
  const [showInspector, setShowInspector] = React.useState(true)

  const activeAgent = (agentList.find((a) => a.id === activeAgentId) || agentList[0])!
  const currentMessages = messages[activeAgentId] || []

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return

    const userMsg: ChatMessage = {
      author: "Admin / Tester",
      role: "System Operator",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      initials: "AD",
      avatarColor: "bg-primary/20 text-primary",
      text: inputMessage.trim(),
    }

    const updated = [...currentMessages, userMsg]
    setMessages((prev) => ({ ...prev, [activeAgentId]: updated }))
    setInputMessage("")

    // Simulate AI Agent replying after 500ms
    setTimeout(() => {
      const botReply: ChatMessage = {
        author: activeAgent.workflow,
        role: `AI Engine (${activeAgent.model})`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        initials: "AI",
        avatarColor: activeAgent.tone,
        bot: true,
        text: `[Mô phỏng n8n Execution]: Đã nhận được truy vấn "${userMsg.text}". Xử lý hoàn tất với model ${activeAgent.model} trong 240ms.`,
        insight: `Độ tin cậy: 99.2% • Workflow ID: ${activeAgent.id.toUpperCase()}`,
      }
      setMessages((prev) => ({
        ...prev,
        [activeAgentId]: [...(prev[activeAgentId] || []), botReply],
      }))
    }, 600)
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-w-0 overflow-hidden bg-chat">
      {/* Sub-sidebar for Agents */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              AI Multi-Agents
            </span>
          </div>
          <Badge variant="teal" className="text-[10px] py-0">n8n Live</Badge>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5">
          {agentList.map((agent) => {
            const Icon = agent.icon
            const isSelected = agent.id === activeAgentId
            return (
              <button
                key={agent.id}
                onClick={() => setActiveAgentId(agent.id)}
                className={`flex items-start gap-3 rounded-xl p-2.5 text-left transition-all ${
                  isSelected
                    ? "bg-sidebar-accent border border-primary/30 shadow-sm"
                    : "hover:bg-sidebar-accent/50 border border-transparent"
                }`}
              >
                <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border ${agent.tone}`}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-xs font-semibold text-foreground">
                      {agent.name}
                    </span>
                    {agent.unread && <span className="size-2 rounded-full bg-agent-coral" />}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                    {agent.detail}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="border-t border-border p-3">
          <div className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">Cơ Chế On-Demand Reset</p>
            <p className="mt-1">Tự động khởi tạo phiên chat mới sau 00:00 VN hàng ngày.</p>
          </div>
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <section className="flex min-w-0 flex-1 flex-col bg-chat">
        {/* Chat Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-5 bg-card/40 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className={`flex size-8 items-center justify-center rounded-lg border ${activeAgent.tone}`}>
              <activeAgent.icon className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">{activeAgent.name}</h2>
                <Badge variant={activeAgent.badgeVariant} className="text-[10px] py-0">
                  {activeAgent.workflow}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Model: {activeAgent.model} • Cổng kết nối n8n: 5678 • Độ trễ TB: {activeAgent.latency}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInspector(!showInspector)}
              className="text-xs"
            >
              <FileText className="size-3.5 mr-1" /> Chi Tiết Agent
            </Button>
          </div>
        </div>

        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {currentMessages.map((msg, index) => (
              <article key={index} className="flex gap-3">
                <Avatar initials={msg.initials} className={msg.avatarColor} bot={msg.bot} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-foreground">{msg.author}</span>
                    {msg.bot && (
                      <span className="rounded bg-agent-teal/15 px-1.5 py-0.5 text-[9px] font-bold text-agent-teal">
                        AI WORKFLOW
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {msg.role} • {msg.time}
                    </span>
                  </div>
                  <div className="mt-1.5 rounded-xl border border-border/60 bg-card/70 p-3 text-xs leading-relaxed text-foreground shadow-sm">
                    {msg.text.split("\n").map((line, lIdx) => (
                      <p key={lIdx} className={lIdx > 0 ? "mt-1.5" : ""}>
                        {line}
                      </p>
                    ))}
                  </div>
                  {msg.tags && (
                    <div className="mt-2 flex gap-1.5">
                      {msg.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground font-mono"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {msg.insight && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-agent-teal/30 bg-agent-teal/5 px-3 py-1.5 text-[11px] text-agent-teal">
                      <Zap className="size-3 shrink-0" />
                      <span>{msg.insight}</span>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Chat Composer */}
        <div className="border-t border-border bg-chat p-4">
          <div className="mx-auto max-w-3xl rounded-xl border border-border bg-composer shadow-sm">
            <div className="flex items-end gap-2 p-3">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder={`Nhập câu hỏi để thử nghiệm trực tiếp với ${activeAgent.name}...`}
                rows={1}
                className="max-h-28 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-xs outline-none placeholder:text-muted-foreground"
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
                className="size-8 p-0 shrink-0 bg-primary text-primary-foreground"
              >
                <Send className="size-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
              <span>Nhấn Enter để gửi • Shift+Enter để xuống dòng</span>
              <span className="flex items-center gap-1 text-agent-teal">
                <Sparkles className="size-3" /> Bảo vệ dữ liệu PII được bật tự động
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Right Inspector Drawer */}
      {showInspector && (
        <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-sidebar xl:flex">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Agent Inspector
              </h3>
              <Badge variant="outline" className="text-[10px]">v1.7</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Thông số kỹ thuật & context n8n</p>
          </div>

          <div className="flex flex-col gap-5 p-4 overflow-y-auto">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Trạng Thái Thực Thi
              </p>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className={`flex size-8 items-center justify-center rounded-lg border ${activeAgent.tone}`}>
                    <activeAgent.icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{activeAgent.name}</p>
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Hoạt động ổn định
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground text-[10px]">Độ chính xác</span>
                    <p className="font-mono font-bold text-foreground">{activeAgent.accuracy}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Độ trễ TB</span>
                    <p className="font-mono font-bold text-agent-teal">{activeAgent.latency}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Nguồn trích xuất</span>
                    <p className="font-mono font-bold text-foreground">{activeAgent.sources} tables</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px]">Model LLM</span>
                    <p className="font-mono font-bold text-primary">Gemini 3.5</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Quy Tắc Quản Trị & Bảo Mật
              </p>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex justify-between items-center rounded-lg bg-muted/40 p-2 text-[11px]">
                  <span className="text-muted-foreground">Mã hóa PII (Regex)</span>
                  <span className="font-semibold text-emerald-400">BẬT (100%)</span>
                </div>
                <div className="flex justify-between items-center rounded-lg bg-muted/40 p-2 text-[11px]">
                  <span className="text-muted-foreground">Cơ chế Reset phiên</span>
                  <span className="font-semibold text-agent-amber">Sau 00:00 VN</span>
                </div>
                <div className="flex justify-between items-center rounded-lg bg-muted/40 p-2 text-[11px]">
                  <span className="text-muted-foreground">Xác thực NestJS</span>
                  <span className="font-mono text-[10px] text-muted-foreground">x-api-key</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
