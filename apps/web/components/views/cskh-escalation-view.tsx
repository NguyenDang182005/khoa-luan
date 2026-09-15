"use client"

import * as React from "react"
import {
  ShieldAlert,
  Bot,
  UserCheck,
  Send,
  Lock,
  CheckCircle2,
  Loader2,
  Inbox,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  escalationApi,
  type EscalationCase,
  type ConversationItem,
  type ChatHistoryMessage,
  type PiiAuditItem,
  type ReplyDelivery,
} from '@/lib/api/escalation.api'

const CHAT_TYPE_LABEL: Record<string, string> = {
  HR_QA: "HR Q&A (nội bộ)",
  CSKH: "CSKH Zalo",
  TRAINING: "Đào tạo",
  OTHER: "Khác",
}

export function CskhEscalationView() {
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
  const [showAll, setShowAll] = useState(false)
  const [deliveryNote, setDeliveryNote] = useState<ReplyDelivery | null>(null)

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
  }, [])

  useEffect(() => { fetchQueues() }, [fetchQueues])

  useEffect(() => {
    const interval = setInterval(fetchQueues, 10000)
    return () => clearInterval(interval)
  }, [fetchQueues])

  // "Tất cả hội thoại": chuẩn hóa escalated vào metadata để dùng chung UI
  const displayList = useMemo<EscalationCase[]>(
    () =>
      showAll
        ? allConversations.map((c) => ({
            ...c,
            metadata: { ...(c.metadata ?? {}), escalated: c.escalated },
          }))
        : escalationQueue,
    [showAll, allConversations, escalationQueue],
  )

  // Giữ selection hợp lệ khi đổi tab hoặc danh sách thay đổi
  useEffect(() => {
    setActiveCaseId((prev) => {
      if (prev && displayList.some((c) => c.id === prev)) return prev
      return displayList[0]?.id ?? null
    })
  }, [displayList])

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

  const activeCase = displayList.find((c) => c.id === activeCaseId) ?? displayList[0] ?? null
  const meta = activeCase?.metadata ?? {}

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

  const handleReactivateBot = async () => {
    if (!activeCaseId) return
    setReplyBusy(true)
    try {
      await escalationApi.reactivateBot(activeCaseId)
      await fetchQueues()
    } catch (e) {
      console.error(e)
    } finally {
      setReplyBusy(false)
    }
  }

  if (queueLoading && escalationQueue.length === 0) {
    return (
      <div className="flex p-8 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Đang tải dữ liệu...
      </div>
    )
  }

  if (!activeCase) {
    // Phân biệt rõ: lỗi quyền/mạng ≠ hết hội thoại
    if (queueError) {
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

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* BANNER TRẠNG THÁI — poll 10s từ backend */}
      {meta.escalated === true ? (
        <div className="relative overflow-hidden rounded-xl border border-agent-coral/40 bg-gradient-to-r from-agent-coral/20 via-agent-coral/10 to-transparent p-4 shadow-lg">
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
                  CẢNH BÁO ESCALATION: PHIÊN CẦN CHUYÊN VIÊN TIẾP QUẢN (HUMAN-IN-THE-LOOP)
                </h2>
                <Badge variant="coral">
                  {meta.escalated ? "Bot tạm dừng" : "Bot đang hoạt động"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {meta.escalateReason
                  ? `WF04 CSKH Agent ghi nhận: ${meta.escalateReason}.`
                  : "WF04 (CSKH Agent) đã chuyển phiên cho chuyên viên."}{" "}
                Tin nhắn gần nhất: {activeCase.lastMessage ? `“${activeCase.lastMessage}”` : "--"} • Cập nhật hàng đợi mỗi 10 giây.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-agent-teal/40 bg-gradient-to-r from-agent-teal/20 via-agent-teal/10 to-transparent p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-agent-teal text-white shadow-md shadow-agent-teal/30">
              <Inbox className="size-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                HỘP THƯ AI — Bot đang chủ động phục vụ khách qua kênh Zalo (Slack transport)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tin nhắn khách và câu trả lời AI được ghi nhận đầy đủ tại đây. Khi AI phát hiện rủi ro vượt thẩm quyền, phiên tự escalate sang hàng đợi khẩn cấp. Cập nhật mỗi 10 giây.
              </p>
            </div>
          </div>
        </div>
      )}

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
                  {showAll ? `Tất Cả Hội Thoại (${displayList.length})` : `Hàng Đợi Khẩn Cấp (${displayList.length})`}
                </CardTitle>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setShowAll(false)}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                      !showAll
                        ? "border-agent-coral/50 bg-agent-coral/10 text-agent-coral"
                        : "border-border text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    Chờ xử lý ({escalationQueue.length})
                  </button>
                  <button
                    onClick={() => setShowAll(true)}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                      showAll
                        ? "border-agent-teal/50 bg-agent-teal/10 text-agent-teal"
                        : "border-border text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    Tất cả hội thoại ({allConversations.length})
                  </button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5 p-4 pt-0">
                {displayList.map((c) => {
                  const isSelected = c.id === activeCaseId
                  const caseMeta = c.metadata ?? {}
                  const botPaused = caseMeta.escalated === true
                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveCaseId(c.id)}
                      className={`flex flex-col gap-2 rounded-xl border p-3 cursor-pointer transition-all ${
                        isSelected
                          ? botPaused
                            ? "border-agent-coral bg-agent-coral/10 shadow-sm"
                            : "border-agent-teal bg-agent-teal/10 shadow-sm"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {caseMeta.customerName || `Khách ${c.externalId ? c.externalId.slice(0, 10) : "Zalo"}`}
                        </span>
                        <Badge variant={botPaused ? "coral" : "teal"} className="text-[10px] py-0">
                          {botPaused ? "Bot Tạm Dừng" : "Bot Đang Bật"}
                        </Badge>
                      </div>
                      <p className={`text-[11px] font-medium line-clamp-2 ${botPaused ? "text-agent-coral" : "text-muted-foreground"}`}>
                        {botPaused
                          ? `⚠️ ${caseMeta.escalateReason ?? c.lastMessage ?? "Không rõ lý do"}`
                          : c.lastMessage ?? "--"}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-2 mt-1">
                        <span>{c.messageCount} tin nhắn</span>
                        <span>
                          {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--"}
                        </span>
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
                    <h3 className="text-xs font-bold text-foreground">
                      {meta.customerName || `Khách hàng Zalo`}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Kênh: Zalo OA • Mã khách: {activeCase.externalId || "--"} • {activeCase.messageCount} tin nhắn
                      {meta.model ? ` • Model bot: ${meta.model}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {meta.escalated === true ? (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={replyBusy}
                      onClick={() => handleReactivateBot()}
                      className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-1"
                    >
                      {replyBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />} 🤖 Bật Lại Bot AI Ngay
                    </Button>
                  ) : (
                    <Badge variant="teal">Bot Đang Hoạt Động</Badge>
                  )}
                </div>
              </CardHeader>

              {/* Chat Messages — lịch sử thật từ backend */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {historyLoading ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground gap-2">
                    <Loader2 className="size-3.5 animate-spin" /> Đang tải lịch sử hội thoại...
                  </div>
                ) : chatLog.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Chưa có tin nhắn trong phiên này.
                  </div>
                ) : (
                  chatLog.map((item) => (
                    <div
                      key={item.id}
                      className={`flex flex-col max-w-[80%] rounded-xl p-3 text-xs leading-relaxed ${
                        item.role === "user"
                          ? "self-start bg-muted/60 text-foreground border border-border"
                          : "self-end bg-primary text-primary-foreground shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 text-[10px] opacity-75 mb-1">
                        <span className="font-semibold">
                          {item.role === "user"
                            ? (meta.customerName || "Khách hàng Zalo")
                            : item.metadata && (item.metadata as Record<string, unknown>).sender === 'human'
                              ? "HR Admin (Bạn)"
                              : "AI Bot"}
                        </span>
                        <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{item.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="border-t border-border p-3 bg-composer">
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
                  <Button size="sm" onClick={handleSendHuman} disabled={replyBusy || !humanReply.trim()} className="gap-1 bg-primary text-primary-foreground">
                    {replyBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Gửi
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Phản hồi được NestJS lưu vào phiên và forward thẳng tới Slack DM của khách (transport demo của kênh Zalo) — không cần bật lại Bot.
                </p>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: PII Audit — dữ liệu thật từ AiChatMessage */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lock className="size-4 text-emerald-400" />
                Nhật Ký Dữ Liệu Đã Khử Định Danh (PII Audit Trail)
              </CardTitle>
              <CardDescription>
                Các tin nhắn thực tế được lưu vào hệ thống — đã qua bước PII Masking của WF01 trước khi gửi tới Google Gemini
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
                  {auditItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border p-4 bg-muted/20">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
                        <span className="text-xs font-mono text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString("vi-VN")} •{" "}
                          {CHAT_TYPE_LABEL[item.session?.type ?? ''] ?? item.session?.type ?? "Không rõ kênh"}
                          {item.session?.externalId ? ` • ${item.session.externalId}` : ""}
                        </span>
                        <Badge variant="success">Đã lưu sau masking</Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 text-xs">
                        <div className="rounded-lg bg-card p-3 border border-border">
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Vai trò</p>
                          <p className="text-foreground">{item.role === 'user' ? 'Người dùng' : 'AI / Bot'}</p>
                        </div>
                        <div className="rounded-lg bg-card p-3 border border-border md:col-span-2">
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Nội dung đã lưu</p>
                          <p className="text-foreground whitespace-pre-wrap">{item.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
