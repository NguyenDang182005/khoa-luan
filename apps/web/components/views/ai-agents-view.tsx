"use client"

import * as React from "react"
import {
  Bot,
  MessageSquare,
  Activity,
  ShieldAlert,
  Send,
  Sparkles,
  Zap,
  Cpu,
  BarChart3,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from 'react'
import { agentsApi } from '@/lib/api/agents.api'
import { escalationApi } from '@/lib/api/escalation.api'
import type { ConversationItem, ChatHistoryMessage } from '@/lib/api/escalation.api'
import type { AllAgentsPerf, IntentStats } from '@/lib/schemas/agent.schema'
import type { LucideIcon } from "lucide-react"

interface AgentItem {
  id: string
  name: string
  workflow: string
  detail: string
  tone: string
  badgeVariant: "teal" | "blue" | "amber" | "coral"
  icon: LucideIcon
  unread: boolean
  model: string
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
    model: "gemini-2.5-flash",
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
    model: "gemini-2.5-flash",
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
    model: "gemini-2.5-flash",
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
    model: "gemini-2.5-flash",
    sources: 8,
  },
]

const INTENT_META: Array<{ key: "HR_QA" | "CSKH" | "TRAINING" | "OTHER"; label: string; tone: string }> = [
  { key: "HR_QA", label: "HR_QA → WF02 (Hỏi đáp nội bộ)", tone: "bg-agent-blue" },
  { key: "CSKH", label: "CSKH → WF04 (Khách hàng)", tone: "bg-agent-coral" },
  { key: "TRAINING", label: "TRAINING → WF03 (Đào tạo)", tone: "bg-agent-amber" },
  { key: "OTHER", label: "OTHER → WF01 trả lời trực tiếp", tone: "bg-muted-foreground" },
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

const WF04_ROLE_LABEL: Record<string, string> = {
  user: "Khách hàng",
  assistant: "AI CSKH",
  human: "Nhân viên",
  staff: "Nhân viên",
}

const fmtDateTime = (iso: string | null) => {
  if (!iso) return "--"
  try { return new Date(iso).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) } catch { return iso }
}

export function AiAgentsView() {
  const [activeAgentId, setActiveAgentId] = useState("wf01")
  const [inputMessage, setInputMessage] = useState("")
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPinging, setIsPinging] = useState(false)
  const [pingError, setPingError] = useState<string | null>(null)

  const [agentPerf, setAgentPerf] = useState<AllAgentsPerf | null>(null)
  const [intentStats, setIntentStats] = useState<IntentStats | null>(null)
  const [liveLatency, setLiveLatency] = useState<number | null>(null)

  // WF04 — bảng thông báo CSKH (chỉ đọc): hội thoại + dữ liệu khách từ Slack
  const [cskhConversations, setCskhConversations] = useState<ConversationItem[]>([])
  const [cskhSelectedId, setCskhSelectedId] = useState<string | null>(null)
  const [cskhHistory, setCskhHistory] = useState<ChatHistoryMessage[]>([])
  const [cskhLoading, setCskhLoading] = useState(false)

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const perf = await agentsApi.getPerformance()
        setAgentPerf(perf)
      } catch (e) { console.error(e) }
      try {
        const stats = await agentsApi.getIntentStats()
        setIntentStats(stats)
      } catch (e) { console.error(e) }
    }
    fetchLive()
    const interval = setInterval(fetchLive, 30000)
    return () => clearInterval(interval)
  }, [])

  // WF04: tải danh sách hội thoại CSKH khi mở tab (poll 30s)
  useEffect(() => {
    if (activeAgentId !== 'wf04') return
    let alive = true
    const load = async () => {
      try {
        const list = await escalationApi.getAllConversations()
        if (!alive) return
        setCskhConversations(list)
        setCskhSelectedId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0]?.id ?? null))
      } catch (e) { console.error(e) }
    }
    load()
    const iv = setInterval(load, 30000)
    return () => { alive = false; clearInterval(iv) }
  }, [activeAgentId])

  // WF04: lịch sử hội thoại của phiên đang chọn (chỉ đọc)
  useEffect(() => {
    if (activeAgentId !== 'wf04' || !cskhSelectedId) { setCskhHistory([]); return }
    setCskhLoading(true)
    escalationApi
      .getChatHistory(cskhSelectedId)
      .then((h) => setCskhHistory(h.messages))
      .catch(() => setCskhHistory([]))
      .finally(() => setCskhLoading(false))
  }, [activeAgentId, cskhSelectedId])

  const activeAgent = (agentList.find((a) => a.id === activeAgentId) || agentList[0])!
  const currentMessages = messages[activeAgentId] || []
  const isRouter = activeAgentId === "wf01"
  const isCskhNotify = activeAgentId === "wf04"
  const cskhSelected = cskhConversations.find((c) => c.id === cskhSelectedId) ?? null

  const currentAgentPerf = agentPerf?.[activeAgentId as keyof AllAgentsPerf]
  const currentLastLatency = liveLatency ?? (currentAgentPerf?.lastLatency ?? '--')
  const currentAccuracy = currentAgentPerf?.successRate != null ? `${currentAgentPerf.successRate}%` : '--'
  const currentCallCount = currentAgentPerf?.callCount ?? 0

  /** Ping AI thật: gửi 1 lượt chat qua NestJS → WF01 → Gemini, lấy latencyMs server-side đo */
  const handlePingTest = async () => {
    setIsPinging(true)
    setPingError(null)
    try {
      const result = await agentsApi.chat("Ping kiểm tra độ trễ hệ thống — vui lòng trả lời ngắn gọn.")
      setLiveLatency(result.latencyMs || null)
    } catch (e) {
      setLiveLatency(null)
      setPingError(e instanceof Error ? e.message : "Không gọi được AI Agent.")
    } finally {
      setIsPinging(false)
    }
  }

  const handleSendMessage = async () => {
    const text = inputMessage.trim()
    if (!text || isProcessing) return

    const userMsg: ChatMessage = {
      author: "Admin / Tester",
      role: "System Operator",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      initials: "AD",
      avatarColor: "bg-primary/20 text-primary",
      text: text,
    }

    setMessages((prev) => ({ ...prev, [activeAgentId]: [...(prev[activeAgentId] || []), userMsg] }))
    setInputMessage("")
    setIsProcessing(true)

    const startTime = Date.now()
    try {
      const result = await agentsApi.chat(text)
      const latencyMs = result.latencyMs || Date.now() - startTime
      setLiveLatency(latencyMs)

      const assistantMsg: ChatMessage = {
        author: activeAgent.workflow,
        role: `AI Engine (${activeAgent.model})`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        initials: "AI",
        avatarColor: activeAgent.tone,
        bot: true,
        text: result.answer,
        insight: `⚡ Độ trễ E2E: ${latencyMs}ms • Qua NestJS → WF01 Router → ${activeAgent.workflow.split(" - ")[0]}`,
      }
      setMessages((prev) => ({ ...prev, [activeAgentId]: [...(prev[activeAgentId] || []), assistantMsg] }))
    } catch (e) {
      const errMsg: ChatMessage = {
        author: "System",
        role: "Error",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        initials: "ERR",
        avatarColor: "bg-red-500/20 text-red-500",
        bot: true,
        text: e instanceof Error ? e.message : "⚠️ Không gọi được AI Agent. Kiểm tra kết nối API.",
      }
      setMessages((prev) => ({ ...prev, [activeAgentId]: [...(prev[activeAgentId] || []), errMsg] }))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-w-0 overflow-hidden bg-background">
      {/* Sub-sidebar for Agents — danh sách WF + hoạt động */}
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
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="truncate text-[11px] text-muted-foreground">
                      {agent.detail}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] font-mono text-agent-teal">
                      ⚡ {agentPerf?.[agent.id as keyof AllAgentsPerf]?.lastLatency ?? '--'}ms
                    </p>
                    {agent.id === "wf01" && (
                      <p className="text-[9px] font-mono text-muted-foreground" title="Số tin nhắn Router đã định tuyến">
                        🔀 {intentStats?.total ?? 0} routed
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="border-t border-border p-3">
          <div className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">Giám Sát Trực Tiếp</p>
            <p className="mt-1">Số liệu làm mới tự động mỗi 30 giây từ NestJS → n8n.</p>
          </div>
        </div>
      </aside>

      {/* ── WF01: Dashboard giám sát Router (không chat — WF01 là router) ── */}
      {isRouter ? (
        <section className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5 bg-card/40 backdrop-blur-sm">
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
                  Model: {activeAgent.model} • n8n :5678 • {activeAgent.detail}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden text-[11px] text-emerald-400 items-center gap-1.5 sm:flex">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Hoạt động ổn định
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePingTest}
                disabled={isPinging}
                className="text-xs h-8 gap-1.5 border-border bg-card/60"
                title="Gửi 1 lượt chat thật qua WF01 → Gemini và đo độ trễ end-to-end"
              >
                <Zap className={`size-3.5 text-agent-teal ${isPinging ? "animate-spin" : ""}`} />
                {isPinging ? "Đang gọi AI…" : `Ping AI (E2E) ${currentLastLatency !== '--' ? `• ${currentLastLatency}ms` : ""}`}
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-4 p-5">
            {/* Stat tiles — số liệu thật từ DB (metadata latency_ms/error của aiChatMessage) */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Độ chính xác</p>
                <p className="mt-1 font-mono text-xl font-bold text-foreground">{currentAccuracy}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Độ trễ gần nhất</p>
                <p className="mt-1 font-mono text-xl font-bold text-agent-teal">⚡ {currentLastLatency}ms</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cuộc gọi</p>
                <p className="mt-1 font-mono text-xl font-bold text-primary">{currentCallCount}</p>
              </div>
            </div>

            {pingError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-[11px] text-red-500">
                ⚠️ Ping AI thất bại: {pingError}
                <span className="ml-1 text-muted-foreground">(Ping AI cần tài khoản được liên kết hồ sơ nhân viên — thử đăng nhập admin@hr-system.com)</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {/* Intent routing chart — WF01 */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="size-4 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Định Tuyến Intent (Router WF01)
                    </p>
                  </div>
                  <Badge variant="teal" className="text-[10px] py-0">Live</Badge>
                </div>

                <div className="mt-4">
                  {intentStats ? (
                    <>
                      <div className="flex flex-col gap-3">
                        {INTENT_META.map(({ key, label, tone }) => {
                          const value = intentStats.byIntent[key] ?? 0
                          const pct = intentStats.total > 0 ? Math.round((value / intentStats.total) * 100) : 0
                          return (
                            <div key={key}>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-mono font-bold text-foreground">{value} ({pct}%)</span>
                              </div>
                              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
                        <div className="rounded-lg bg-muted/40 p-3">
                          <p className="text-[10px] text-muted-foreground">Tổng đã định tuyến</p>
                          <p className="font-mono text-lg font-bold text-primary">{intentStats.total}</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-3">
                          <p className="text-[10px] text-muted-foreground">Escalation chuyển người</p>
                          <p className="font-mono text-lg font-bold text-agent-coral">{intentStats.escalations}</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Đang tải thống kê intent…</p>
                  )}
                </div>
              </div>

              {/* Quy tắc quản trị & bảo mật */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Quy Tắc Quản Trị & Bảo Mật
                </p>
                <div className="mt-3 flex flex-col gap-2 text-xs">
                  <div className="flex justify-between items-center rounded-lg bg-muted/40 p-2.5 text-[11px]">
                    <span className="text-muted-foreground">Mã hóa PII (Regex)</span>
                    <span className="font-semibold text-emerald-400">BẬT (WF01)</span>
                  </div>
                  <div className="flex justify-between items-center rounded-lg bg-muted/40 p-2.5 text-[11px]">
                    <span className="text-muted-foreground">Xác thực NestJS</span>
                    <span className="font-mono text-[10px] text-muted-foreground">x-api-key</span>
                  </div>
                  <div className="flex justify-between items-center rounded-lg bg-muted/40 p-2.5 text-[11px]">
                    <span className="text-muted-foreground">Escalation CSKH</span>
                    <span className="font-semibold text-agent-coral">Tự động (WF04)</span>
                  </div>
                  <div className="flex justify-between items-center rounded-lg bg-muted/40 p-2.5 text-[11px]">
                    <span className="text-muted-foreground">Kiến trúc điều phối</span>
                    <span className="font-mono text-[10px] text-muted-foreground">Portal → NestJS → WF01 → WF02/03/04</span>
                  </div>
                </div>
                <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                  WF01 là Router — mọi chat từ khung chat WF02/03/04 đều đi qua WF01 để phân loại intent và mask PII.
                  Chọn một agent ở bên trái để trò chuyện thử.
                </p>
              </div>
            </div>

            <span className="hidden text-[11px] text-muted-foreground items-center gap-1.5 md:flex">
              <ShieldAlert className="size-3.5 text-agent-coral" />
              Bảng thông báo — không chat trực tiếp
            </span>
          </div>

          {/* Nội dung: danh sách hội thoại + tóm tắt + dữ liệu khách */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4 p-5 pt-4 overflow-y-auto">
            {/* Danh sách phiên hội thoại */}
            <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-1.5 max-h-[calc(100vh-13rem)] overflow-y-auto shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground px-1 pb-1">
                Hội Thoại ({cskhConversations.length})
              </p>
              {cskhConversations.length === 0 && (
                <p className="text-[11px] text-muted-foreground p-2">
                  Chưa có hội thoại — khi khách DM bot qua Slack (transport Zalo), phiên sẽ xuất hiện tại đây.
                </p>
              )}
              {cskhConversations.map((c) => {
                const selected = c.id === cskhSelectedId
                return (
                  <button
                    key={c.id}
                    onClick={() => setCskhSelectedId(c.id)}
                    className={`rounded-lg p-2.5 text-left transition-all border ${
                      selected
                        ? "bg-sidebar-accent border-primary/30 shadow-sm"
                        : "hover:bg-muted/40 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-foreground font-mono">
                        {c.externalId ?? "(khách ẩn danh)"}
                      </span>
                      <Badge variant={c.escalated ? "coral" : "teal"} className="text-[9px] py-0 shrink-0">
                        {c.escalated ? "Đã escalate" : "Bot phục vụ"}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {c.lastMessage ?? "--"}
                    </p>
                    <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/70">
                      {c.messageCount} tin • {fmtDateTime(c.lastMessageAt)}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Chi tiết: dữ liệu khách + tóm tắt hội thoại */}
            <div className="flex flex-col gap-4 min-w-0">
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Dữ Liệu Khách Hàng (từ Slack)
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-[10px] text-muted-foreground">Customer ID</p>
                    <p className="font-mono text-xs font-bold text-foreground truncate">{cskhSelected?.externalId ?? "--"}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-[10px] text-muted-foreground">Số tin nhắn</p>
                    <p className="font-mono text-xs font-bold text-primary">{cskhSelected?.messageCount ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-[10px] text-muted-foreground">Trạng thái</p>
                    <p className={`text-xs font-bold ${cskhSelected?.escalated ? "text-agent-coral" : "text-emerald-400"}`}>
                      {cskhSelected ? (cskhSelected.escalated ? "Chờ nhân viên" : "Bot đang phục vụ") : "--"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-[10px] text-muted-foreground">Hoạt động cuối</p>
                    <p className="font-mono text-xs font-bold text-foreground">{fmtDateTime(cskhSelected?.lastMessageAt ?? null)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex-1 min-h-[12rem]">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Tóm Tắt Cuộc Hội Thoại (chỉ đọc)
                </p>
                <div className="mt-3 flex flex-col gap-2.5 max-h-[calc(100vh-30rem)] overflow-y-auto pr-1">
                  {cskhLoading ? (
                    <p className="text-[11px] text-muted-foreground">Đang tải hội thoại…</p>
                  ) : cskhHistory.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Chọn một phiên ở bên trái để xem nội dung.</p>
                  ) : (
                    cskhHistory.map((m) => (
                      <div key={m.id} className="rounded-lg border border-border bg-background/60 p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wide ${
                            m.role === "user" ? "text-agent-blue" : m.role === "human" ? "text-agent-amber" : "text-agent-teal"
                          }`}>
                            {WF04_ROLE_LABEL[m.role] ?? m.role}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70">{fmtDateTime(m.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-foreground whitespace-pre-wrap line-clamp-6">{m.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <p className="mt-3 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                  WF04 là agent phục vụ khách — admin không chat tại đây. Để <span className="font-semibold text-foreground">trả lời khách (human takeover)</span> hoặc bật lại bot, mở trang <span className="font-semibold text-foreground">Cảnh Báo CSKH</span>.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* ── WF02/03: Chat workspace ── */
        <section className="flex min-w-0 flex-1 flex-col bg-chat">
          {/* Chat Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5 bg-card/40 backdrop-blur-sm">
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
                  Model: {activeAgent.model} • n8n :5678 • Chat đi qua WF01 Router (PII mask + phân loại intent)
                </p>
              </div>
            </div>
          </div>

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {currentMessages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-sm rounded-xl border border-border bg-card/60 p-4 text-center text-[11px] text-muted-foreground">
                  Chưa có tin nhắn nào trong phiên này. Gửi câu hỏi để test <span className="font-semibold text-foreground">{activeAgent.name}</span> —
                  tin nhắn đi qua NestJS → WF01 Router → agent, số liệu latency sẽ cập nhật ở sidebar.
                </div>
              </div>
            )}
            {currentMessages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 max-w-[85%] ${
                  msg.bot ? "mr-auto" : "ml-auto flex-row-reverse"
                }`}
              >
                <Avatar
                  initials={msg.initials}
                  className={`size-8 shrink-0 ${msg.avatarColor} border border-border/50 text-xs font-bold`}
                />

                <div className="flex flex-col gap-1.5">
                  <div
                    className={`flex items-baseline gap-2 text-xs ${
                      msg.bot ? "justify-start" : "justify-end"
                    }`}
                  >
                    <span className="font-semibold text-foreground">{msg.author}</span>
                    <span className="text-[10px] text-muted-foreground">{msg.role}</span>
                    <span className="text-[10px] text-muted-foreground/60">{msg.time}</span>
                  </div>

                  <div
                    className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                      msg.bot
                        ? "bg-card border border-border text-foreground rounded-tl-sm"
                        : "bg-primary text-primary-foreground rounded-tr-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {msg.tags && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {msg.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {msg.insight && (
                      <div className="mt-2.5 border-t border-border/60 pt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3 text-agent-teal" />
                        <span>{msg.insight}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex gap-3 mr-auto items-center">
                <Avatar initials="AI" className={`size-8 shrink-0 ${activeAgent.tone} text-xs font-bold animate-pulse`} />
                <div className="rounded-2xl bg-card border border-border px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
                  <span className="size-2 rounded-full bg-agent-teal animate-ping" />
                  <span>Mô hình {activeAgent.model} đang phân tích và tính toán phản hồi...</span>
                </div>
              </div>
            )}
          </div>

          {/* Message Composer */}
          <div className="border-t border-border p-4 bg-composer">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSendMessage()
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Gửi câu hỏi hoặc tình huống tới ${activeAgent.name}...`}
                className="h-10 bg-background/80 border-border text-xs focus-visible:ring-primary"
                disabled={isProcessing}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputMessage.trim() || isProcessing}
                className="h-10 px-4 bg-primary text-primary-foreground font-semibold"
              >
                <Send className="size-3.5" />
              </Button>
            </form>
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              Dữ liệu tin nhắn được bảo vệ bởi bộ lọc PII tự động trước khi gửi tới Gemini 2.5 Flash
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
