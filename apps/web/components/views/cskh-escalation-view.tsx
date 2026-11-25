"use client"

import * as React from "react"
import {
  ShieldAlert,
  UserCheck,
  Lock,
  CheckCircle2,
  Loader2,
  Inbox,
  AlertTriangle,
  Clock,
  MessagesSquare,
  Bot,
  ShieldCheck,
  Send,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RichText } from "@/components/ui/rich-text"
import { ESCALATION_EVENT } from "@/components/shell/escalation-alert"
import { cn, fmtVNTime, fmtVNDateTime, stripMarkdown } from "@/lib/utils"

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
      <span key={i} className="rounded-sm bg-ai-tint px-1 font-mono text-micro text-ai">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  )
}

/** Loại PII xuất hiện trong bản mask (vd. [MASKED_PHONE] → PHONE) — chỉ để hiển thị */
function maskedTypes(text: string | null): string[] {
  if (!text) return []
  const found = text.match(/\[MASKED_([A-Z_]+)\]/g) ?? []
  return Array.from(new Set(found.map((t) => t.slice(8, -1))))
}

/** Nhãn khách hiển thị thống nhất ở danh sách + khung chat */
function customerLabel(c: EscalationCase): string {
  return c.metadata?.customerName || `Khách ${c.externalId ? c.externalId.slice(0, 10) : "Zalo"}`
}

/** Diễn giải mã lỗi gửi tin (kỹ thuật) thành câu dễ hiểu cho chuyên viên */
function deliveryReasonLabel(reason?: string | null): string {
  if (!reason) return "không rõ nguyên nhân"
  if (reason.includes("NOT_CONFIGURED")) return "kênh gửi tin chưa được thiết lập"
  if (reason === "NO_EXTERNAL_ID" || reason === "NOT_A_SLACK_USER") return "không xác định được tài khoản nhận của khách"
  if (reason.includes("NETWORK_ERROR")) return "lỗi kết nối tới kênh gửi tin"
  return "kênh gửi tin báo lỗi"
}

function shortTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--"
}

export function CskhEscalationView() {
  const { user } = useAuth()
  const isAdmin = user ? isAdminRole(user.role) : false
  return <CskhEscalationPanel isAdmin={isAdmin} />
}

/** Nhân viên dùng bàn tiếp quản; tab Nhật ký PII (nội dung gốc chưa che) chỉ admin xem. */
function CskhEscalationPanel({ isAdmin }: { isAdmin: boolean }) {
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
  const [toggleError, setToggleError] = useState<string | null>(null)

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
          ? "Tài khoản của bạn chưa được cấp quyền xem hội thoại CSKH."
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
    if (!isAdmin) {
      setAuditLoading(false)
      return
    }
    escalationApi
      .getPiiAudit(20)
      .then(setAuditItems)
      .catch((e) => console.error(e))
      .finally(() => setAuditLoading(false))
  }, [isAdmin])

  // Ref giữ phiên đang mở — để bỏ kết quả trả về muộn của phiên cũ
  const activeCaseIdRef = useRef<string | null>(activeCaseId)
  useEffect(() => {
    activeCaseIdRef.current = activeCaseId
  }, [activeCaseId])
  const silentFetchInFlight = useRef(false)

  /** silent = làm mới nền theo chu kỳ poll: không hiện spinner, không chồng request */
  const fetchChatHistory = useCallback(async (sessionId: string, silent = false) => {
    if (silent) {
      if (silentFetchInFlight.current) return
      silentFetchInFlight.current = true
    } else {
      setHistoryLoading(true)
    }
    try {
      const history = await escalationApi.getChatHistory(sessionId)
      if (activeCaseIdRef.current !== sessionId) return
      // Chỉ cập nhật khi có tin mới để không tự cuộn xuống mỗi 10s
      setChatLog((prev) => {
        const next = history.messages
        const same =
          prev.length === next.length && prev[prev.length - 1]?.id === next[next.length - 1]?.id
        return same ? prev : next
      })
    } catch (e) {
      console.error(e)
      if (!silent && activeCaseIdRef.current === sessionId) setChatLog([])
    } finally {
      if (silent) silentFetchInFlight.current = false
      else if (activeCaseIdRef.current === sessionId) setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeCaseId) fetchChatHistory(activeCaseId)
  }, [activeCaseId, fetchChatHistory])

  // Có leo thang mới qua WebSocket (EscalationAlert phát) → tải lại hàng đợi ngay
  useEffect(() => {
    const onEscalation = () => void fetchQueues()
    window.addEventListener(ESCALATION_EVENT, onEscalation)
    return () => window.removeEventListener(ESCALATION_EVENT, onEscalation)
  }, [fetchQueues])

  // Poll 10s (dự phòng khi mất kết nối socket): làm mới danh sách + khung chat của phiên đang mở
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchQueues()
      const id = activeCaseIdRef.current
      if (id) void fetchChatHistory(id, true)
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchQueues, fetchChatHistory])

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
      setToggleError(null)
      setCaseEscalatedLocal(sessionId, !reactivate)
      try {
        if (reactivate) await escalationApi.reactivateBot(sessionId)
        else await escalationApi.deactivateBot(sessionId)
        setLastSyncedAt(new Date())
      } catch (err) {
        console.error("[Toggle Bot]", err)
        setCaseEscalatedLocal(sessionId, reactivate) // rollback về trạng thái cũ
        const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
        setToggleError(
          (Array.isArray(msg) ? msg.join("; ") : msg) ??
            (reactivate
              ? "Không bật lại được Bot AI. Vui lòng thử lại."
              : "Không chuyển được phiên cho chuyên viên. Vui lòng thử lại."),
        )
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
      <div className="flex items-center justify-center gap-2 py-12 text-body-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Đang tải dữ liệu...
      </div>
    )
  }

  if (!activeCase && queueError) {
    // Phân biệt rõ: lỗi quyền/mạng ≠ hết hội thoại
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-10 items-center justify-center rounded-md bg-danger-tint text-danger">
          <ShieldAlert className="size-5" />
        </div>
        <div>
          <h2 className="text-body font-semibold text-foreground">Không tải được hội thoại</h2>
          <p className="mt-1 max-w-md text-body-sm text-muted-foreground">{queueError}</p>
        </div>
      </div>
    )
  }

  if (!activeCase) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <CheckCircle2 className="size-5" />
        </div>
        <div>
          <h2 className="text-body font-semibold text-foreground">Chưa có hội thoại CSKH nào</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            Khi khách nhắn tin vào kênh CSKH, hội thoại sẽ xuất hiện tại đây.
          </p>
        </div>
      </div>
    )
  }

  const botToggling = togglingIds.has(activeCase.id)

  const filterBtn = (active: boolean) =>
    cn(
      "inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-sm px-2.5 text-caption font-medium transition-colors",
      active ? "bg-primary-tint text-accent-foreground" : "text-muted-foreground hover:text-foreground",
    )

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER TĨNH CỦA TRANG — không bao giờ đổi theo hội thoại đang chọn ── */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-xs md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
              <UserCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-h1 font-semibold text-foreground">Bàn tiếp quản CSKH</h1>
              <p className="mt-1 max-w-2xl text-body text-muted-foreground">
                Bot AI trả lời khách qua kênh Zalo. Khi AI phát hiện rủi ro vượt thẩm quyền,
                phiên tự chuyển xuống hàng đợi cho chuyên viên — bạn vẫn trả lời được mọi lúc mà không cần tắt bot.
              </p>
            </div>
          </div>
          <Badge variant="info">
            <Clock />
            Bot tự bật lại sau 00:00 mỗi ngày
          </Badge>
        </div>

        {/* Dải chỉ số sống — cập nhật cùng chu kỳ poll 10s */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border-subtle pt-4 text-body-sm">
          <span className="inline-flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-danger-tint text-danger">
              <AlertTriangle className="size-4" />
            </span>
            <b className="tabular font-semibold text-danger">{escalationQueue.length}</b>
            <span className="text-muted-foreground">phiên chờ tiếp quản</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-muted text-secondary-foreground">
              <MessagesSquare className="size-4" />
            </span>
            <b className="tabular font-semibold text-foreground">{allConversations.length}</b>
            <span className="text-muted-foreground">tổng hội thoại</span>
          </span>
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-success" />
            <span className="tabular">
              {lastSyncedAt
                ? `Đồng bộ lúc ${lastSyncedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
                : "Đang đồng bộ..."}
              {" · chu kỳ 10s"}
            </span>
          </span>
        </div>
      </section>

      {/* Tabs: Live Console vs PII Masking Audit Trail */}
      <Tabs defaultValue="console" className="w-full">
        <TabsList>
          <TabsTrigger value="console">
            Hội thoại trực tiếp
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="audit">
              Nhật ký PII Masking
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Tab 1: Live Takeover Console ── */}
        <TabsContent value="console" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6">
            {/* Cột trái: danh sách hội thoại — CHỈ XEM, không có nút bật/tắt tại đây */}
            <div className="flex max-h-[360px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs lg:h-[640px] lg:max-h-none">
              <div className="flex flex-col gap-3 border-b border-border p-4">
                <h2 className="text-h3 font-semibold text-foreground">Hội thoại</h2>
                <div className="inline-flex rounded-md border border-border bg-card p-0.5">
                  <button
                    type="button"
                    onClick={() => setFilter("pending")}
                    aria-pressed={filter === "pending"}
                    className={filterBtn(filter === "pending")}
                  >
                    Chờ tiếp quản
                    <span className="tabular rounded-full bg-danger-tint px-1.5 text-micro font-semibold text-danger">
                      {escalationQueue.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    aria-pressed={filter === "all"}
                    className={filterBtn(filter === "all")}
                  >
                    Tất cả
                    <span className="tabular rounded-full bg-muted px-1.5 text-micro font-semibold text-muted-foreground">
                      {allConversations.length}
                    </span>
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <div className="flex flex-col gap-1">
                  {displayList.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                      {filter === "pending" ? (
                        <>
                          <div className="flex size-10 items-center justify-center rounded-md bg-success-tint text-success">
                            <CheckCircle2 className="size-5" />
                          </div>
                          <p className="text-body font-semibold text-foreground">Không có phiên nào chờ tiếp quản</p>
                          <Button size="xs" variant="outline" onClick={() => setFilter("all")}>
                            Xem tất cả hội thoại ({allConversations.length})
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Inbox className="size-5" />
                          </div>
                          <p className="text-body-sm text-muted-foreground">Chưa có hội thoại nào được ghi nhận.</p>
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
                          className={cn(
                            "w-full rounded-md px-3 py-2.5 text-left transition-colors",
                            isSelected ? "bg-primary-tint" : "hover:bg-sunken",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar
                              initials={(c.metadata?.customerName ?? "K").slice(0, 2).toUpperCase()}
                              className={cn(
                                "size-9",
                                itemPaused ? "bg-danger-tint text-danger" : "bg-muted text-secondary-foreground",
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-body-sm font-semibold text-foreground">
                                  {customerLabel(c)}
                                </span>
                                <span className="tabular shrink-0 text-caption text-muted-foreground">
                                  {shortTime(c.lastMessageAt)}
                                </span>
                              </div>
                              <p className="truncate text-caption text-muted-foreground">
                                {stripMarkdown(c.lastMessage) || "--"}
                              </p>
                              <div className="mt-1.5">
                                {itemPaused ? (
                                  <Badge variant="destructive">
                                    <span className="size-1.5 animate-pulse rounded-full bg-danger" />
                                    Chờ tiếp quản
                                  </Badge>
                                ) : (
                                  <Badge variant="ai">
                                    <span className="size-1.5 rounded-full bg-ai" />
                                    Bot
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Cột phải: khung hội thoại — chiều cao cố định, duy nhất MỘT cụm điều khiển bot */}
            <div className="flex h-[560px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs lg:h-[640px]">
              <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
                <Avatar
                  initials={(meta.customerName ?? "K").slice(0, 2).toUpperCase()}
                  className={cn(
                    "size-9",
                    botPaused ? "bg-danger-tint text-danger" : "bg-muted text-secondary-foreground",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-h3 font-semibold text-foreground">
                    {meta.customerName || "Khách hàng Zalo"}
                  </h3>
                  <p className="truncate text-caption text-muted-foreground">
                    Kênh: Zalo OA · Mã khách: <span className="font-mono">{activeCase.externalId || "--"}</span> ·{" "}
                    <span className="tabular">{activeCase.messageCount}</span> tin nhắn
                    {meta.model ? <> · Model bot: <span className="font-mono">{meta.model}</span></> : ""}
                  </p>
                </div>

                {/* BỘ ĐIỀU KHIỂN DUY NHẤT: Bot AI ↔ Chuyên viên */}
                <div
                  role="group"
                  aria-label="Chế độ phục vụ: Bot AI hoặc Chuyên viên"
                  className="flex shrink-0 items-center gap-2"
                >
                  {botPaused ? (
                    <Badge variant="destructive">
                      <span className="size-1.5 rounded-full bg-danger" />
                      Chuyên viên phụ trách
                    </Badge>
                  ) : (
                    <Badge variant="ai">
                      <span className="size-1.5 animate-pulse rounded-full bg-ai" />
                      Bot AI đang trả lời
                    </Badge>
                  )}
                  {botPaused ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={botToggling}
                      onClick={() => handleToggleBot(activeCase.id, true)}
                      title="Bật lại Bot AI cho phiên này"
                    >
                      {botToggling ? <Loader2 className="animate-spin" /> : <Bot />}
                      Trả lại bot
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={botToggling}
                      onClick={() => handleToggleBot(activeCase.id, false)}
                      title="Tạm dừng bot, chuyển cho chuyên viên"
                    >
                      {botToggling ? <Loader2 className="animate-spin" /> : <UserCheck />}
                      Tiếp quản
                    </Button>
                  )}
                </div>
              </div>

              {toggleError && (
                <p className="border-b border-border-subtle bg-danger-tint px-4 py-2 text-caption text-danger">
                  {toggleError}
                </p>
              )}

              {/* Dải lý do escalate — nằm BÊN TRONG khung chat, không đè lên toàn trang */}
              {botPaused && (
                <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-lg border border-warning/20 bg-warning-tint px-3 py-2.5 text-warning">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p className="text-body-sm">
                    <span className="font-semibold">Bot tạm dừng — phiên đang do chuyên viên phụ trách.</span>{" "}
                    <span className="text-secondary-foreground">
                      {meta.escalateReason
                        ? `Lý do: ${meta.escalateReason}`
                        : "Bot AI đã tự chuyển phiên cho chuyên viên."}
                    </span>
                  </p>
                </div>
              )}

              {/* Chat Messages — lịch sử thật từ backend */}
              <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-sunken p-4">
                {historyLoading ? (
                  <div className="flex h-full items-center justify-center gap-2 text-body-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Đang tải lịch sử hội thoại...
                  </div>
                ) : chatLog.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-body-sm text-muted-foreground">
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
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-body-sm",
                          isCustomer
                            ? "self-start rounded-bl-sm border border-border bg-card text-foreground"
                            : isHuman
                              ? "self-end rounded-br-sm bg-primary-tint text-accent-foreground"
                              : "self-end rounded-br-sm bg-ai-tint text-foreground",
                        )}
                      >
                        <div className="mb-0.5 flex items-center justify-between gap-4 text-micro">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 font-semibold",
                              isCustomer ? "text-secondary-foreground" : isHuman ? "text-accent-foreground" : "text-ai",
                            )}
                          >
                            {!isCustomer && !isHuman && <Bot className="size-3" />}
                            {isCustomer
                              ? (meta.customerName || "Khách hàng Zalo")
                              : isHuman
                                ? "Bạn (Chuyên viên)"
                                : "AI Bot"}
                          </span>
                          <span className="tabular text-muted-foreground">
                            {fmtVNTime(item.createdAt)}
                          </span>
                        </div>
                        <RichText text={item.content} />
                      </div>
                    )
                  })
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="border-t border-border bg-card p-3">
                {replyError && <p className="mb-2 text-caption text-danger">{replyError}</p>}
                {deliveryNote && (
                  <p
                    className={cn(
                      "mb-2 flex items-start gap-1.5 text-caption",
                      deliveryNote.delivered ? "text-success" : "text-warning",
                    )}
                  >
                    {deliveryNote.delivered ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    )}
                    <span>
                      {deliveryNote.delivered
                        ? "Đã lưu và gửi phản hồi tới khách hàng."
                        : `Đã lưu vào phiên nhưng CHƯA gửi được tới khách (${deliveryReasonLabel(deliveryNote.reason)}). Vui lòng liên hệ quản trị hệ thống.`}
                    </span>
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    value={humanReply}
                    onChange={(e) => setHumanReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendHuman()}
                    placeholder="Nhập nội dung trả lời khách hàng..."
                    className="h-9 flex-1 text-body-sm"
                    disabled={replyBusy}
                  />
                  <Button onClick={handleSendHuman} disabled={replyBusy || !humanReply.trim()}>
                    {replyBusy ? <Loader2 className="animate-spin" /> : <Send />} Gửi
                  </Button>
                </div>
                <p className="mt-1.5 text-caption text-muted-foreground">
                  Phản hồi được lưu vào phiên và gửi thẳng tới khách — không cần tắt Bot.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: PII Audit — dữ liệu thật từ AiChatMessage, đối chiếu original ↔ masked */}
        {isAdmin && (
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-md bg-success-tint text-success">
                  <Lock className="size-4" />
                </span>
                Nhật ký PII masking (bảo mật) — đối chiếu song song
              </CardTitle>
              <CardDescription>
                Đối chiếu bản gốc với bản đã che thông tin cá nhân mà AI nhìn thấy trước khi xử lý.
                Áp dụng cho Hỏi đáp nhân sự, Đào tạo và CSKH (từ 17/09).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="flex h-32 items-center justify-center gap-2 text-body-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Đang tải nhật ký...
                </div>
              ) : auditItems.length === 0 ? (
                <p className="text-body-sm text-muted-foreground">Chưa có tin nhắn nào được ghi nhận.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table className="min-w-[1040px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Thời gian</TableHead>
                        <TableHead>Kênh</TableHead>
                        <TableHead>Vai trò</TableHead>
                        <TableHead>Loại PII</TableHead>
                        <TableHead>Bản gốc (lưu DB)</TableHead>
                        <TableHead>Bản mask AI nhìn thấy</TableHead>
                        <TableHead>Trạng thái mask</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditItems.map((item) => {
                        const maskedMessage = auditMasked(item)
                        const hasMaskMetadata = maskedMessage !== null
                        const piiTypes = maskedTypes(maskedMessage)
                        const hasRealMask = hasMaskMetadata && (maskedMessage !== item.content || piiTypes.length > 0)
                        return (
                          <TableRow key={item.id} className="align-top">
                            <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                              {fmtVNDateTime(item.createdAt)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="text-foreground">
                                {CHAT_TYPE_LABEL[item.session?.type ?? ""] ?? item.session?.type ?? "Không rõ kênh"}
                              </div>
                              {item.session?.externalId && (
                                <div className="font-mono text-caption text-muted-foreground">
                                  {item.session.externalId}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-secondary-foreground">
                              {item.role === "user" ? "Người dùng" : "AI / Bot"}
                            </TableCell>
                            <TableCell>
                              {piiTypes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {piiTypes.map((t) => (
                                    <Badge key={t} variant="outline" className="font-mono text-micro">
                                      {t}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">--</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[280px] py-3 align-top">
                              <p className="line-clamp-4 whitespace-pre-wrap break-words text-foreground" title={item.content}>
                                {item.content}
                              </p>
                            </TableCell>
                            <TableCell className="max-w-[280px] py-3 align-top">
                              {maskedMessage ? (
                                <p className="line-clamp-4 whitespace-pre-wrap break-words text-foreground" title={maskedMessage}>
                                  {renderMaskedTokens(maskedMessage)}
                                </p>
                              ) : (
                                <p className="italic text-muted-foreground">
                                  Không có bản mask trong metadata (tin này chưa được che thông tin).
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {hasRealMask ? (
                                <Badge
                                  variant="success"
                                  title="Tin nhắn chứa thông tin nhạy cảm và đã được che trước khi gửi tới AI"
                                >
                                  <ShieldCheck />
                                  Đã che PII
                                </Badge>
                              ) : hasMaskMetadata ? (
                                <Badge
                                  variant="info"
                                  title="Tin nhắn đã đi qua bộ lọc PII Masking và không chứa thông tin nhạy cảm"
                                >
                                  <ShieldCheck />
                                  An toàn (Không PII)
                                </Badge>
                              ) : (
                                <Badge
                                  variant="warning"
                                  title="Bản ghi cũ chưa có dữ liệu mask trong metadata"
                                >
                                  <AlertTriangle />
                                  Chưa qua bộ lọc
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
