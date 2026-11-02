"use client"

import * as React from "react"
import {
  ShieldAlert,
  UserCheck,
  Lock,
  CheckCircle2,
  Loader2,
  Inbox,
  Radio,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useAuth } from "@/lib/auth-context"
import { isAdminRole } from "@repo/shared-types"
import {
  escalationApi,
  type EscalationCase,
  type ConversationItem,
  type ChatHistoryMessage,
  type PiiAuditItem,
  type ReplyDelivery,
} from "@/lib/api/escalation.api"

const CHAT_TYPE_LABEL: Record<string, string> = {
  HR_QA: "HR Q&A (nội bộ)",
  CSKH: "CSKH Zalo",
  TRAINING: "Đào tạo",
  OTHER: "Khác",
}

type CaseFilter = "pending" | "all"

/** Bản mask lưu trong metadata của message (nếu có) — là những gì AI thực sự nhìn thấy */
function auditMasked(item: PiiAuditItem): string | null {
  const meta = item.metadata as { maskedMessage?: unknown } | null
  return typeof meta?.maskedMessage === "string" && meta.maskedMessage.length > 0 ? meta.maskedMessage : null
}

/** Tô sáng các token [MASKED_*] trong bản mask để dễ đối chiếu */
function renderMaskedTokens(text: string): React.ReactNode[] {
  return text.split(/(\[MASKED_[A-Z_]+\])/g).map((part, i) =>
    part.startsWith("[MASKED_") ? (
      <span key={i} className="rounded bg-agent-teal/15 px-1 font-mono text-[10px] text-agent-teal">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  )
}

/** Nhãn khách hiển thị thống nhất ở danh sách + khung chat */
function customerLabel(c: EscalationCase): string {
  return c.metadata?.customerName || `Khách ${c.externalId ? c.externalId.slice(0, 10) : "Zalo"}`
}

function shortTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--"
}

export function CskhEscalationView() {
  const { user } = useAuth()
  const isAdmin = user ? isAdminRole(user.role) : false

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <ShieldAlert className="mb-3 size-12 text-agent-coral" />
        <h2 className="text-lg font-semibold text-foreground">Bạn không có quyền xem trang này</h2>
        <p className="mt-1 text-muted-foreground">
          Trang &ldquo;Tiếp Quản CSKH &amp; PII&rdquo; chỉ dành cho Admin.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Vui lòng dùng các trang trong mục Cổng Nhân Viên (ESS): Hồ sơ, Đào tạo, AI Multi-Agents Sandbox.
        </p>
      </div>
    )
  }

  return <CskhEscalationPanel />
}

/** Tách khỏi phần kiểm tra quyền để hook luôn được gọi cùng thứ tự (rules-of-hooks). */
function CskhEscalationPanel() {
  const [escalationQueue, setEscalationQueue] = useState<EscalationCase[]>([])
  const [queueError, setQueueError] = useState<string | null>(null)
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [chatLog, setChatLog] = useState<ChatHistoryMessage[]>([])
  const [queueLoading, setQueueLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [replyBusy, setReplyBusy] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)

  const [auditItems, setAuditItems] = useState<PiiAuditItem[]>([])
  const [auditLoading, setAuditLoading] = useState(true)

  const [humanReply, setHumanReply] = useState("")
  const [allConversations, setAllConversations] = useState<ConversationItem[]>([])
  const [filter, setFilter] = useState<CaseFilter>("pending")
  const [deliveryNote, setDeliveryNote] = useState<ReplyDelivery | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  // Hàng đợi escalate + toàn bộ hội thoại CSKH — poll 10s từ backend (JWT)
  const fetchQueues = useCallback(async () => {
    try {
      const queue = await escalationApi.getQueue()
      setEscalationQueue(queue)
      setQueueError(null)
    } catch (e) {
      console.error(e)
      const status = (e as { response?: { status?: number } })?.response?.status
      setQueueError(
        status === 403
          ? "Tài khoản của bạn không có quyền xem hội thoại CSKH (yêu cầu Admin / HR Manager / HR Admin)."
          : "Không tải được dữ liệu hội thoại từ máy chủ.",
      )
    } finally {
      setQueueLoading(false)
    }
    try {
      setAllConversations(await escalationApi.getAllConversations())
    } catch (e) {
      console.error(e)
    }
    setLastSyncedAt(new Date())
  }, [])

  useEffect(() => { fetchQueues() }, [fetchQueues])

  useEffect(() => {
    const interval = setInterval(fetchQueues, 10000)
    return () => clearInterval(interval)
  }, [fetchQueues])

  // Lookup hợp nhất (hàng đợi + tất cả hội thoại): khung chat luôn giữ đúng phiên
  // đang mở kể cả khi phiên vừa rời khỏi bộ lọc "Chờ tiếp quản" sau khi bật lại bot.
  //
  // ⚠️ Nguồn sự thật của `escalated`:
  //  - GET /agents/conversations trả `escalated: !isActive` từ DB — luôn thắng.
  //  - Item hàng đợi được lọc bởi `isActive: false` → escalated=true theo định nghĩa.
  //  - KHÔNG dùng `metadata.escalated` của tin nhắn: đó là snapshot WF04 ghi lúc gửi
  //    tin, không bao giờ cập nhật khi admin toggle sau đó → khiến toggle "lỡ" trạng thái.
  const caseLookup = useMemo(() => {
    const map = new Map<string, EscalationCase>()
    for (const item of escalationQueue) {
      map.set(item.id, { ...item, metadata: { ...(item.metadata ?? {}), escalated: true } })
    }
    for (const conv of allConversations) {
      map.set(conv.id, { ...conv, metadata: { ...(conv.metadata ?? {}), escalated: conv.escalated } })
    }
    return map
  }, [escalationQueue, allConversations])

  const displayList = useMemo<EscalationCase[]>(
    () =>
      filter === "all"
        ? allConversations.map((c) => ({
            ...c,
            metadata: { ...(c.metadata ?? {}), escalated: c.escalated },
          }))
        : escalationQueue.map((c) => ({
            ...c,
            metadata: { ...(c.metadata ?? {}), escalated: true },
          })),
    [filter, allConversations, escalationQueue],
  )

  // Chỉ tự chọn hội thoại khác khi phiên hiện tại biến mất khỏi CẢ HAI nguồn dữ liệu
  useEffect(() => {
    if (activeCaseId && caseLookup.has(activeCaseId)) return
    setActiveCaseId(displayList[0]?.id ?? allConversations[0]?.id ?? escalationQueue[0]?.id ?? null)
  }, [activeCaseId, caseLookup, displayList, allConversations, escalationQueue])

  // Nhật ký PII thật từ database
  useEffect(() => {
    escalationApi
      .getPiiAudit(20)
      .then(setAuditItems)
      .catch((e) => console.error(e))
      .finally(() => setAuditLoading(false))
  }, [])

  const fetchChatHistory = useCallback(async (sessionId: string) => {
    setHistoryLoading(true)
    try {
      const history = await escalationApi.getChatHistory(sessionId)
      setChatLog(history.messages)
    } catch (e) {
      console.error(e)
      setChatLog([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeCaseId) fetchChatHistory(activeCaseId)
  }, [activeCaseId, fetchChatHistory])

  const activeCase = activeCaseId ? caseLookup.get(activeCaseId) ?? null : null
  const meta = activeCase?.metadata ?? {}
  const botPaused = meta.escalated === true

  // Tự cuộn xuống tin nhắn mới nhất
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatLog, activeCaseId, historyLoading])

  /** Gửi phản hồi tiếp quản — lưu vào phiên qua backend (JWT) */
  const handleSendHuman = async () => {
    const content = humanReply.trim()
    if (!content || !activeCaseId || replyBusy) return
    setReplyBusy(true)
    setReplyError(null)
    try {
      const { message: saved, delivery } = await escalationApi.sendHumanReply(activeCaseId, content)
      setChatLog((prev) => [...prev, saved])
      setHumanReply("")
      setDeliveryNote(delivery)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setReplyError(msg ?? "Không gửi được phản hồi. Vui lòng thử lại.")
    } finally {
      setReplyBusy(false)
    }
  }

  // Cập nhật trạng thái escalated ngay tại chỗ (optimistic) để UI không giật/vị trí không nhảy
  const setCaseEscalatedLocal = useCallback((sessionId: string, escalated: boolean) => {
    setEscalationQueue((prev) =>
      prev.map((c) => (c.id === sessionId ? { ...c, metadata: { ...(c.metadata ?? {}), escalated } } : c)),
    )
    setAllConversations((prev) =>
      prev.map((c) => (c.id === sessionId ? { ...c, escalated } : c)),
    )
  }, [])

  /**
   * ĐIỂM ĐIỀU KHIỂN DUY NHẤT của trạng thái bot (tắt / bật lại).
   * Optimistic update + rollback nếu lỗi; fetchQueues chỉ để đối chiếu lại nền.
   */
  const handleToggleBot = useCallback(
    async (sessionId: string, reactivate: boolean) => {
      setTogglingIds((prev) => new Set(prev).add(sessionId))
      setCaseEscalatedLocal(sessionId, !reactivate)
      try {
        if (reactivate) await escalationApi.reactivateBot(sessionId)
        else await escalationApi.deactivateBot(sessionId)
        setLastSyncedAt(new Date())
      } catch (err) {
        console.error("[Toggle Bot]", err)
        setCaseEscalatedLocal(sessionId, reactivate) // rollback về trạng thái cũ
      } finally {
        setTogglingIds((prev) => {
          const s = new Set(prev)
          s.delete(sessionId)
          return s
        })
        void fetchQueues()
      }
    },
    [fetchQueues, setCaseEscalatedLocal],
  )

  if (queueLoading && escalationQueue.length === 0 && allConversations.length === 0) {
    return (
      <div className="flex p-8 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Đang tải dữ liệu...
      </div>
    )
  }

  if (!activeCase && queueError) {
    // Phân biệt rõ: lỗi quyền/mạng ≠ hết hội thoại
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 text-center p-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-red-500/10">
          <ShieldAlert className="size-8 text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Không tải được hội thoại</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">{queueError}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Đang đăng nhập với quyền hạn chế — hãy dùng tài khoản Admin (VD: admin@hr-system.com) để xem bàn tiếp quản CSKH.
          </p>
        </div>
      </div>
    )
  }

  if (!activeCase) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <CheckCircle2 className="size-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Chưa có hội thoại CSKH nào</h2>
          <p className="text-sm text-muted-foreground">
            Khi khách nhắn tin vào kênh (Slack transport của Zalo), hội thoại sẽ xuất hiện tại đây.
          </p>
        </div>
      </div>
    )
  }

  const botToggling = togglingIds.has(activeCase.id)

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* ── HEADER TĨNH CỦA TRANG — không bao giờ đổi theo hội thoại đang chọn ── */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <UserCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">Bàn Tiếp Quản CSKH</h1>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Human-in-the-loop: Bot AI trả lời khách qua kênh Zalo. Khi AI phát hiện rủi ro vượt thẩm quyền,
                phiên tự chuyển xuống hàng đợi cho chuyên viên — bạn vẫn trả lời được mọi lúc mà không cần tắt bot.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[11px]">
            Reset phiên on-demand: sau 00:00 VN bot tự hồi sinh
          </Badge>
        </div>

        {/* Dải chỉ số sống — cập nhật cùng chu kỳ poll 10s */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${escalationQueue.length > 0 ? "animate-pulse bg-agent-coral" : "bg-muted-foreground/40"}`} />
            <b className="text-foreground">{escalationQueue.length}</b>
            <span className="text-muted-foreground">phiên chờ tiếp quản</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-agent-teal" />
            <b className="text-foreground">{allConversations.length}</b>
            <span className="text-muted-foreground">tổng hội thoại</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Radio className="size-3 animate-pulse text-agent-teal" />
            {lastSyncedAt
              ? `Đồng bộ lúc ${lastSyncedAt.toLocaleTimeString("vi-VN")}`
              : "Đang đồng bộ..."}
            <span className="text-muted-foreground/70">• chu kỳ 10s</span>
          </span>
        </div>
      </section>

      {/* Tabs: Live Console vs PII Masking Audit Trail */}
      <Tabs defaultValue="console" className="w-full">
        <TabsList>
          <TabsTrigger value="console">
            Hội thoại trực tiếp
          </TabsTrigger>
          <TabsTrigger value="audit">
            Nhật ký PII Masking
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Live Takeover Console ── */}
        <TabsContent value="console" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,360px)_1fr]">
            {/* Cột trái: danh sách hội thoại — CHỈ XEM, không có nút bật/tắt tại đây */}
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="gap-2 border-b border-border p-4">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  Hội thoại
                </CardTitle>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => setFilter("pending")}
                    aria-pressed={filter === "pending"}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                      filter === "pending"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Chờ tiếp quản
                    <span className="rounded-full bg-agent-coral/15 px-1.5 text-[9px] font-bold text-agent-coral">
                      {escalationQueue.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    aria-pressed={filter === "all"}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                      filter === "all"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Tất cả
                    <span className="rounded-full bg-muted px-1.5 text-[9px] font-bold text-muted-foreground">
                      {allConversations.length}
                    </span>
                  </button>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-3">
                <div className="flex flex-col gap-2">
                  {displayList.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center">
                      {filter === "pending" ? (
                        <>
                          <CheckCircle2 className="size-6 text-emerald-400" />
                          <p className="text-xs font-medium text-foreground">Không có phiên nào chờ tiếp quản</p>
                          <Button size="xs" variant="outline" onClick={() => setFilter("all")}>
                            Xem tất cả hội thoại ({allConversations.length})
                          </Button>
                        </>
                      ) : (
                        <>
                          <Inbox className="size-6 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Chưa có hội thoại nào được ghi nhận.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    displayList.map((c) => {
                      const isSelected = c.id === activeCaseId
                      const itemPaused = c.metadata?.escalated === true
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setActiveCaseId(c.id)}
                          aria-pressed={isSelected}
                          className={`w-full rounded-xl border p-3 text-left transition-colors ${
                            isSelected
                              ? "border-primary/60 bg-primary/5"
                              : "border-border bg-card hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              initials={(c.metadata?.customerName ?? "K").slice(0, 2).toUpperCase()}
                              className={`size-8 border text-[10px] ${
                                itemPaused
                                  ? "border-agent-coral/30 bg-agent-coral/15 text-agent-coral"
                                  : "border-agent-teal/30 bg-agent-teal/15 text-agent-teal"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-foreground">
                                {customerLabel(c)}
                              </span>
                              <p className="line-clamp-1 text-[11px] text-muted-foreground">
                                {c.lastMessage ?? "--"}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                  itemPaused
                                    ? "border-agent-coral/30 bg-agent-coral/10 text-agent-coral"
                                    : "border-agent-teal/30 bg-agent-teal/10 text-agent-teal"
                                }`}
                              >
                                <span
                                  className={`size-1.5 rounded-full ${
                                    itemPaused ? "animate-pulse bg-agent-coral" : "bg-agent-teal"
                                  }`}
                                />
                                {itemPaused ? "Tiếp quản" : "Bot"}
                              </span>
                              <span className="text-[9px] text-muted-foreground">{shortTime(c.lastMessageAt)}</span>
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cột phải: khung hội thoại — chiều cao cố định, duy nhất MỘT cụm điều khiển bot */}
            <Card className="flex h-[560px] flex-col overflow-hidden">
              <CardHeader className="flex-row items-center gap-3 border-b border-border p-4">
                <Avatar
                  initials={(meta.customerName ?? "K").slice(0, 2).toUpperCase()}
                  className={`border ${
                    botPaused
                      ? "border-agent-coral/30 bg-agent-coral/15 text-agent-coral"
                      : "border-agent-teal/30 bg-agent-teal/15 text-agent-teal"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-foreground">
                    {meta.customerName || "Khách hàng Zalo"}
                  </h3>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Kênh: Zalo OA • Mã khách: {activeCase.externalId || "--"} • {activeCase.messageCount} tin nhắn
                    {meta.model ? ` • Model bot: ${meta.model}` : ""}
                  </p>
                </div>

                {/* BỘ ĐIỀU KHIỂN DUY NHẤT: Bot AI ↔ Chuyên viên */}
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">Chế độ phục vụ</span>
                  <div
                    role="group"
                    aria-label="Chế độ phục vụ: Bot AI hoặc Chuyên viên"
                    className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5"
                  >
                    <button
                      type="button"
                      disabled={botToggling}
                      onClick={() => handleToggleBot(activeCase.id, true)}
                      aria-pressed={!botPaused}
                      title={botPaused ? "Bật lại Bot AI cho phiên này" : "Bot AI đang tự trả lời khách"}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-70 ${
                        !botPaused
                          ? "bg-agent-teal/20 text-agent-teal shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {botToggling && botPaused && <Loader2 className="size-3 animate-spin" />}
                      Bot AI
                    </button>
                    <button
                      type="button"
                      disabled={botToggling}
                      onClick={() => handleToggleBot(activeCase.id, false)}
                      aria-pressed={botPaused}
                      title={botPaused ? "Chuyên viên đang tiếp quản phiên này" : "Tạm dừng bot, chuyển cho chuyên viên"}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-70 ${
                        botPaused
                          ? "bg-agent-coral/20 text-agent-coral shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {botToggling && !botPaused && <Loader2 className="size-3 animate-spin" />}
                      Chuyên viên
                    </button>
                  </div>
                </div>
              </CardHeader>

              {/* Dải lý do escalate — nằm BÊN TRONG khung chat, không đè lên toàn trang */}
              {botPaused && (
                <div className="flex items-start gap-2.5 border-b border-agent-coral/25 bg-agent-coral/10 px-4 py-2.5">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-agent-coral" />
                  <p className="text-[11px] leading-relaxed">
                    <span className="font-semibold text-agent-coral">
                      Bot tạm dừng — phiên đang do chuyên viên phụ trách.
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {meta.escalateReason
                        ? `Lý do (WF04 CSKH Agent): ${meta.escalateReason}`
                        : "WF04 (CSKH Agent) đã chuyển phiên cho chuyên viên."}
                    </span>
                  </p>
                </div>
              )}

              {/* Chat Messages — lịch sử thật từ backend */}
              <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                {historyLoading ? (
                  <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Đang tải lịch sử hội thoại...
                  </div>
                ) : chatLog.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Chưa có tin nhắn trong phiên này.
                  </div>
                ) : (
                  chatLog.map((item) => {
                    const isCustomer = item.role === "user"
                    const isHuman =
                      !isCustomer && (item.metadata as { sender?: string } | null)?.sender === "human"
                    return (
                      <div
                        key={item.id}
                        className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                          isCustomer
                            ? "self-start rounded-bl-sm border border-border bg-muted/60 text-foreground"
                            : isHuman
                              ? "self-end rounded-br-sm border border-agent-teal/40 bg-agent-teal/15 text-foreground"
                              : "self-end rounded-br-sm bg-primary text-primary-foreground shadow-sm"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-4 text-[10px] opacity-75">
                          <span className="font-semibold">
                            {isCustomer
                              ? (meta.customerName || "Khách hàng Zalo")
                              : isHuman
                                ? "Bạn (Chuyên viên)"
                                : "AI Bot"}
                          </span>
                          <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{item.content}</p>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="border-t border-border bg-composer p-3">
                {replyError && <p className="mb-2 text-[11px] text-agent-coral">{replyError}</p>}
                {deliveryNote && (
                  <p className={`mb-2 text-[11px] ${deliveryNote.delivered ? "text-emerald-400" : "text-agent-amber"}`}>
                    {deliveryNote.delivered
                      ? `✅ Đã lưu phiên và forward tới Slack DM khách hàng${deliveryNote.ts ? ` (ts ${deliveryNote.ts})` : ""}.`
                      : `⚠️ Đã lưu vào phiên nhưng CHƯA gửi tới Slack (${deliveryNote.reason ?? "không rõ"}). Kiểm tra SLACK_BOT_TOKEN / externalId.`}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={humanReply}
                    onChange={(e) => setHumanReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendHuman()}
                    placeholder="Nhập nội dung tiếp quản với tư cách Chuyên viên HR/Admin..."
                    className="flex-1 rounded-lg border border-border bg-input/40 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                    disabled={replyBusy}
                  />
                  <Button size="sm" onClick={handleSendHuman} disabled={replyBusy || !humanReply.trim()} className="gap-1.5 bg-primary text-primary-foreground">
                    {replyBusy && <Loader2 className="size-3.5 animate-spin" />} Gửi
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Phản hồi được NestJS lưu vào phiên và forward thẳng tới Slack DM của khách (transport demo của kênh Zalo) — không cần tắt Bot.
                </p>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: PII Audit — dữ liệu thật từ AiChatMessage, đối chiếu original ↔ masked */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lock className="size-4 text-emerald-400" />
                Nhật Ký PII Masking (Bảo Mật) — Đối Chiếu Song Song
              </CardTitle>
              <CardDescription>
                Đối chiếu bản gốc (lưu DB) với bản đã mask mà AI nhìn thấy trước khi gửi Google Gemini.
                Masking chạy tại WF01 (HR Q&amp;A / Training) và WF04 (CSKH — từ 17/09).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="flex h-32 items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Đang tải nhật ký...
                </div>
              ) : auditItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">Chưa có tin nhắn nào được ghi nhận.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {auditItems.map((item) => {
                    const maskedMessage = auditMasked(item)
                    const hasRealMask = maskedMessage !== null && maskedMessage !== item.content
                    return (
                      <div key={item.id} className="rounded-xl border border-border bg-muted/20 p-4">
                        <div className="mb-3 flex items-center justify-between border-b border-border/60 pb-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleString("vi-VN")} •{" "}
                            {CHAT_TYPE_LABEL[item.session?.type ?? ""] ?? item.session?.type ?? "Không rõ kênh"}
                            {item.session?.externalId ? ` • ${item.session.externalId}` : ""}
                          </span>
                          <Badge variant={hasRealMask ? "success" : "warning"}>
                            {hasRealMask ? "Đã lưu sau masking" : "Gốc chưa mask (bản ghi cũ)"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
                          <div className="rounded-lg border border-border bg-card p-3">
                            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Vai trò</p>
                            <p className="text-foreground">{item.role === "user" ? "Người dùng" : "AI / Bot"}</p>
                          </div>
                          <div className="rounded-lg border border-border bg-card p-3">
                            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Bản gốc (lưu DB)</p>
                            <p className="whitespace-pre-wrap text-foreground">{item.content}</p>
                          </div>
                          <div className="rounded-lg border border-agent-teal/30 bg-card p-3">
                            <p className="mb-1 text-[10px] font-semibold uppercase text-agent-teal">Bản mask AI nhìn thấy</p>
                            {maskedMessage ? (
                              <p className="whitespace-pre-wrap text-foreground">{renderMaskedTokens(maskedMessage)}</p>
                            ) : (
                              <p className="italic text-muted-foreground">Không có bản mask trong metadata (tin này chưa từng qua node mask).</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
