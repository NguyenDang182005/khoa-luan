"use client"

import * as React from "react"
import {
  Bot,
  MessageSquare,
  Activity,
  ShieldAlert,
  Sparkles,
  Zap,
  Cpu,
  BarChart3,
  Loader2,
  ListChecks,
  PenLine,
  ShieldCheck,
  Lock,
  Play,
  Headphones,
  Send,
  CircleCheck,
  CircleX,
  CircleAlert,
  Shuffle,
} from "lucide-react"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { RichText } from "@/components/ui/rich-text"
import { cn, fmtVNTime, fmtVNShortDateTime, stripMarkdown } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useEffect, useState } from 'react'
import { agentsApi } from '@/lib/api/agents.api'
import type { QuizQuestion, QuizSubmitResult, ChatHistoryMessage as AgentHistoryMessage } from '@/lib/api/agents.api'
import { getChat, patchChat } from '@/lib/chat/chat-store'
import { escalationApi } from '@/lib/api/escalation.api'
import { settingsApi } from '@/lib/api/settings.api'
import { useAuth } from '@/lib/auth-context'
import type { ConversationItem, ChatHistoryMessage, PiiAuditItem } from '@/lib/api/escalation.api'
import type { AllAgentsPerf, IntentStats } from '@/lib/schemas/agent.schema'
import type { LucideIcon } from "lucide-react"

interface AgentItem {
  id: string
  name: string
  workflow: string
  /** Tên ngắn hiển thị cho người dùng */
  shortName: string
  detail: string
  tone: string
  badgeVariant: "teal" | "blue" | "amber" | "coral"
  icon: LucideIcon
  unread: boolean
  /** null = WF01 rule-based, không dùng LLM */
  model: string | null
  sources: number
}

const agentList: AgentItem[] = [
  {
    id: "wf01",
    name: "Router & Privacy Agent",
    workflow: "WF01",
    shortName: "Router",
    detail: "Phân loại ý định & PII Masking",
    tone: "bg-agent-wf01-tint text-agent-wf01",
    badgeVariant: "teal",
    icon: Bot,
    unread: false,
    model: null,
    sources: 4,
  },
  {
    id: "wf02",
    name: "HR Policy Q&A Agent",
    workflow: "WF02",
    shortName: "HR Q&A",
    detail: "Hỏi đáp ngày phép, bảo hiểm, lương",
    tone: "bg-agent-wf02-tint text-agent-wf02",
    badgeVariant: "blue",
    icon: MessageSquare,
    unread: true,
    model: "deepseek-flash",
    sources: 12,
  },
  {
    id: "wf03",
    name: "Training & Onboarding Agent",
    workflow: "WF03",
    shortName: "Đào tạo",
    detail: "Luyện tập 2 chiều & chấm điểm tự luận",
    tone: "bg-agent-wf03-tint text-agent-wf03",
    badgeVariant: "amber",
    icon: Activity,
    unread: true,
    model: "deepseek-flash",
    sources: 6,
  },
  {
    id: "wf04",
    name: "Zalo CSKH & Escalation Agent",
    workflow: "WF04",
    shortName: "CSKH",
    detail: "Khách hàng Slack/Zalo & Tiếp quản",
    tone: "bg-agent-wf04-tint text-agent-wf04",
    badgeVariant: "coral",
    icon: Headphones,
    unread: false,
    model: "deepseek-flash",
    sources: 8,
  },
]

const modelLabel = (agent: AgentItem) => agent.model ?? "Rule-based, không dùng LLM"

/** Tên agent thực sự xử lý theo intent server trả về */
const INTENT_AGENT_NAME: Record<string, string> = {
  OTHER: "Router (trả lời trực tiếp)",
  HR_QA: "HR Q&A",
  TRAINING: "Đào tạo",
  CSKH: "CSKH",
}

/** Nhân viên chỉ dùng được HR Q&A và Đào tạo (các route giám sát chỉ dành cho admin) */
const EMPLOYEE_AGENT_IDS = ["wf02", "wf03"]

const INTENT_META: Array<{ key: "HR_QA" | "CSKH" | "TRAINING" | "OTHER"; label: string; tone: string }> = [
  { key: "HR_QA", label: "HR_QA → WF02 (Hỏi đáp nội bộ)", tone: "bg-agent-wf02" },
  { key: "CSKH", label: "CSKH → WF04 (Khách hàng)", tone: "bg-agent-wf04" },
  { key: "TRAINING", label: "TRAINING → WF03 (Đào tạo)", tone: "bg-agent-wf03" },
  { key: "OTHER", label: "OTHER → WF01 trả lời trực tiếp", tone: "bg-agent-wf01" },
]

/** Kịch bản mẫu cho Sandbox thử nghiệm WF01 */
const PRESET_SCENARIOS = [
  {
    badge: "[HR_QA]",
    label: "Nghỉ phép & BHXH",
    text: "Nhân viên Nguyễn Văn A CCCD 001200000001, sđt 0912345678 cần hỏi về chế độ nghỉ phép năm và đóng BHXH.",
  },
  {
    badge: "[TRAINING]",
    label: "Test Onboarding",
    text: "Tôi là nhân viên mới muốn làm bài test trắc nghiệm onboarding kiểm tra kiến thức hội nhập.",
  },
  {
    badge: "[CSKH]",
    label: "Khiếu nại dịch vụ",
    text: "Khách hàng hotline 0988776655 và email khach@gmail.com khiếu nại đơn hàng giao trễ.",
  },
  {
    badge: "[OTHER]",
    label: "Chào hỏi chung",
    text: "Xin chào trợ lý ảo, bạn có thể hướng dẫn tổng quan quy chế công ty không?",
  },
]

interface PiiMaskResult {
  maskedText: string
  idCount: number
  phoneCount: number
  emailCount: number
  totalPii: number
}

/** Mô phỏng thuật toán Regex Masking chuẩn của WF01 node 'PII Masking' */
function clientMaskPii(text: string): PiiMaskResult {
  let idCount = 0
  let phoneCount = 0
  let emailCount = 0

  // 1. Email: [\w.-]+@[\w.-]+\.\w+
  let masked = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, () => {
    emailCount++
    return '[MASKED_EMAIL]'
  })

  // 2. SĐT VN: \b(0[35789]\d{8})\b hoặc \b(0\d{9})\b
  masked = masked.replace(/\b(0[35789]\d{8}|0\d{9})\b/g, () => {
    phoneCount++
    return '[MASKED_PHONE]'
  })

  // 3. ID 9 hoặc 12 số: \b(\d{9}|\d{12})\b
  masked = masked.replace(/\b(\d{9}|\d{12})\b/g, () => {
    idCount++
    return '[MASKED_ID]'
  })

  return {
    maskedText: masked,
    idCount,
    phoneCount,
    emailCount,
    totalPii: idCount + phoneCount + emailCount,
  }
}

interface SimulatedIntentResult {
  intent: "HR_QA" | "TRAINING" | "CSKH" | "OTHER"
  targetAgent: string
  action: string | null
  matchedRule: string
  badgeVariant: "blue" | "amber" | "coral" | "teal"
}

/** Mô phỏng thuật toán Parse Intent chuẩn của WF01 node 'Parse Intent' */
function clientParseIntent(maskedMessage: string): SimulatedIntentResult {
  const msg = maskedMessage.toLowerCase()

  const isHR =
    /lương|phép|nghỉ|ngày nghỉ|xin nghỉ|nghỉ phép|nghỉ ốm|nghỉ việc|nghỉ bù|nghỉ lễ|nghỉ chế độ|nghỉ không lương|nghỉ thai sản|hợp đồng|bhxh|bhyt|bhtn|chấm công|bảo hiểm|thuế|tncn|overtime|tăng lương|giảm trừ|bậc lương|hệ số|đăng ký phép|thai sản|phúc lợi|thưởng|bonus|thu nhập|khấu trừ|công số|bảng lương|ngày công|phụ cấp|ký hợp đồng|lịch làm việc|quy định|chính sách|nội quy|thử việc|đi muộn|về sớm|chế độ|trợ cấp|thôi việc|đồng phục|công tác|nghỉ mát|khám sức khỏe|sa thải|đuổi việc|bồi thường/.test(
      msg,
    ) ||
    /(?:^|[^\p{L}\p{N}])nghi(?=[^\p{L}\p{N}]|$)/u.test(msg) ||
    /luong|phep|ngay nghi|xin nghi|nghi phep|nghi om|nghi viec|nghi bu|nghi le|nghi che do|nghi khong luong|hop dong|cham cong|bao hiem|thue tncn|tang luong|giam tru|bac luong|he so|thai san|phuc loi|thuong|thu nhap|khau tru|cong so|bang luong|phu cap|quy dinh|chinh sach|noi quy|thu viec|di muon|ve som|che do|tro cap|thoi viec|dong phuc|cong tac|nghi mat|kham suc khoe|sa thai|duoi viec|boi thuong/.test(
      msg,
    )

  const isQuizRequest =
    /bai test|bai kiem tra|lam test|quiz|trac nghiem|bai thi|kiem tra ky nang|bat dau dao tao|bat dau bai test|bat dau bai kiem tra|bat dau kiem tra/.test(
      msg,
    ) ||
    /bài test|bài kiểm tra|làm test|trắc nghiệm|bài thi|bắt đầu đào tạo|bắt đầu bài test|bắt đầu kiểm tra/.test(
      msg,
    )

  const isTraining =
    /training|đào tạo|role.?play|kịch bản|luyện tập|tình huống|kỹ năng giao tiếp|roleplay|tập dượt|bài test|bài kiểm tra|làm test|quiz|trắc nghiệm|bài thi|kiểm tra kỹ năng/.test(
      msg,
    ) ||
    /dao tao|kich ban|luyen tap|tinh huong|ky nang|tap duot|bai test|lam test|trac nghiem|bai kiem tra|bai thi|kiem tra/.test(
      msg,
    )

  const isCSKH =
    /khiếu nại|khách hàng|sản phẩm|cskh|phàn nàn|dịch vụ|chăm sóc khách|hỗ trợ khách|complain/.test(
      msg,
    ) || /khieu nai|khach hang|san pham|phan nan|dich vu|cham soc khach|ho tro khach/.test(msg)

  if (isHR) {
    return {
      intent: "HR_QA",
      targetAgent: "WF02 - HR Policy Q&A Agent",
      action: null,
      matchedRule: "Khớp từ khóa nhân sự, chính sách, ngày phép, lương hoặc bảo hiểm",
      badgeVariant: "blue",
    }
  }
  if (isTraining) {
    return {
      intent: "TRAINING",
      targetAgent: "WF03 - Training & Onboarding Agent",
      action: isQuizRequest ? "generate_quiz" : null,
      matchedRule: isQuizRequest
        ? "Khớp yêu cầu sinh bài test trắc nghiệm (action: generate_quiz)"
        : "Khớp từ khóa đào tạo, luyện tập, giải quyết tình huống (role-play)",
      badgeVariant: "amber",
    }
  }
  if (isCSKH) {
    return {
      intent: "CSKH",
      targetAgent: "WF04 - Zalo CSKH & Escalation Agent",
      action: null,
      matchedRule: "Khớp từ khóa khiếu nại, dịch vụ khách hàng hoặc phản ánh",
      badgeVariant: "coral",
    }
  }
  return {
    intent: "OTHER",
    targetAgent: "WF01 - Router Agent (Trả lời trực tiếp)",
    action: null,
    matchedRule: "Không khớp từ khóa chuyên biệt — WF01 xử lý hoặc hướng dẫn",
    badgeVariant: "teal",
  }
}

/** Tô màu các token [MASKED_*] trực quan */
function highlightMaskedTokens(text: string): React.ReactNode[] {
  return text.split(/(\[MASKED_[A-Z_]+\])/g).map((part, i) => {
    if (part === "[MASKED_ID]") {
      return (
        <span
          key={i}
          className="inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-micro font-medium mx-0.5 bg-success-tint text-success"
        >
          {part}
        </span>
      )
    }
    if (part === "[MASKED_PHONE]") {
      return (
        <span
          key={i}
          className="inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-micro font-medium mx-0.5 bg-warning-tint text-warning"
        >
          {part}
        </span>
      )
    }
    if (part === "[MASKED_EMAIL]") {
      return (
        <span
          key={i}
          className="inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-micro font-medium mx-0.5 bg-info-tint text-info"
        >
          {part}
        </span>
      )
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

function auditMasked(item: PiiAuditItem): string | null {
  const meta = item.metadata as { maskedMessage?: unknown } | null
  return typeof meta?.maskedMessage === "string" && meta.maskedMessage.length > 0 ? meta.maskedMessage : null
}

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
  /** WF03 generate_quiz — form bài test 5 MCQ + 2 essay */
  quiz?: QuizQuestion[]
  scenarioType?: string
  quizResult?: QuizSubmitResult
}

const WF04_ROLE_LABEL: Record<string, string> = {
  user: "Khách hàng",
  assistant: "AI CSKH",
  human: "Nhân viên",
  staff: "Nhân viên",
}

/** Q16/Q17 — loại session tương ứng từng tab agent (backend sở hữu phiên) */
const AGENT_SESSION_TYPE: Record<string, "HR_QA" | "TRAINING" | "OTHER"> = {
  wf01: "OTHER",
  wf02: "HR_QA",
  wf03: "TRAINING",
}
const sessionKeyFor = (agentId: string) => `agents:${agentId}`

const fmtDateTime = (iso: string | null) => fmtVNShortDateTime(iso)

/** Form làm bài quiz tương tác — 5 MCQ (chọn A–D) + 2 tự luận, nộp qua WF03 chấm điểm */
function QuizCard({
  quiz,
  scenarioType,
  result,
  onResult,
}: {
  quiz: QuizQuestion[]
  scenarioType?: string
  result?: QuizSubmitResult
  onResult: (r: QuizSubmitResult) => void
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const graded = result != null
  const allAnswered = quiz.every((q) => (answers[q.id] ?? "").trim().length > 0)
  const resultFor = (id: number) => result?.results?.find((r) => r.id === id)

  const handleSubmit = async () => {
    if (!allAnswered || submitting || graded) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await agentsApi.submitQuiz(
        scenarioType ?? "general_communication",
        quiz.map((q) => ({
          questionId: q.id,
          question: q.question,
          type: q.type,
          answer: answers[q.id] ?? "",
          ...(q.type === "mcq" && q.correct ? { correctAnswer: q.correct } : {}),
        })),
      )
      onResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không nộp bài được. Vui lòng thử lại.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full rounded-lg border border-border bg-card p-4 shadow-xs" data-testid="quiz-card">
      <div className="mb-3 flex items-center gap-2 border-b border-border-subtle pb-3">
        <ListChecks className="size-4 shrink-0 text-agent-wf03" />
        <span className="text-body-sm font-semibold text-foreground">Bài kiểm tra kỹ năng mềm</span>
        <span className="ml-auto text-caption text-muted-foreground tabular">
          {quiz.filter((q) => q.type === "mcq").length} trắc nghiệm • {quiz.filter((q) => q.type === "essay").length} tự luận
        </span>
      </div>

      <div className="space-y-4">
        {quiz.map((q, qi) => {
          const r = resultFor(q.id)
          // q.correct bị backend strip khỏi quiz public; đáp án đúng chỉ có
          // trong kết quả chấm sau khi nộp bài.
          const correctLetter = r?.correct_answer ?? q.correct
          return (
            <div key={q.id} className="space-y-2">
              <p className="text-body-sm font-medium text-foreground">
                <span className="mr-1.5 font-mono text-muted-foreground">C{qi + 1}.</span>
                {q.question}
                {q.type === "essay" && <PenLine className="ml-1.5 inline size-3 text-muted-foreground" />}
              </p>

              {q.type === "mcq" && (
                <div className="grid gap-1.5">
                  {Object.entries(q.options ?? {}).map(([letter, text]) => {
                    const selected = answers[q.id] === letter
                    const isCorrect = graded && correctLetter === letter
                    const isWrongPick = graded && selected && correctLetter !== letter
                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={graded}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: letter }))}
                        className={`flex items-start gap-2 rounded-md border px-3 py-2 text-left text-body-sm transition-colors disabled:cursor-default ${
                          isCorrect
                            ? "border-success/30 bg-success-tint text-foreground"
                            : isWrongPick
                              ? "border-danger/30 bg-danger-tint text-foreground"
                              : selected
                                ? "border-primary/30 bg-primary-tint text-foreground"
                                : "border-border bg-card text-secondary-foreground hover:bg-sunken"
                        }`}
                      >
                        <span className={`mt-px font-mono font-medium ${selected ? "text-primary" : "text-muted-foreground"}`}>
                          {letter}.
                        </span>
                        <span>{text}</span>
                      </button>
                    )
                  })}
                  {graded && (
                    <p className="mt-1 text-caption text-muted-foreground">
                      {r?.correct ? (
                        <span className="inline-flex items-center gap-1 font-medium text-success"><CircleCheck className="size-3.5" />Chính xác</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-danger"><CircleX className="size-3.5" />Đáp án đúng: {correctLetter ?? "—"}</span>
                      )}
                      {q.explanation ? ` — ${q.explanation}` : ""}
                    </p>
                  )}
                </div>
              )}

              {q.type === "essay" && (
                <div className="space-y-1.5">
                  <Textarea
                    value={answers[q.id] ?? ""}
                    disabled={graded}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    rows={3}
                    placeholder="Trình bày câu trả lời của bạn…"
                    className="min-h-[72px] resize-y text-body-sm"
                  />
                  {graded && (
                    <p className="text-caption text-muted-foreground">
                      <span className="font-medium text-foreground tabular">
                        Điểm AI: {r?.score != null ? `${r.score.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}/10` : "chưa chấm"}
                      </span>
                      {r?.feedback ? ` — ${r.feedback}` : " — Chưa có nhận xét."}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {graded ? (
        <div className="mt-4 space-y-1.5 rounded-md border border-border bg-sunken p-3 text-body-sm">
          <p className="font-semibold text-foreground tabular">
            Kết quả: {result?.score_percent ?? "--"}% • MCQ đúng {result?.correct_count ?? 0}/{result?.total_mcq ?? 5} • Tự luận TB{" "}
            {result?.essay_avg != null
              ? result.essay_avg.toLocaleString("vi-VN", { maximumFractionDigits: 1 })
              : "--"}
            /10
          </p>
          {result?.overall_feedback && <p className="text-muted-foreground">{result.overall_feedback}</p>}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="gap-1.5"
          >
            {submitting && <Loader2 className="size-3.5 animate-spin" />}
            {submitting ? "Đang chấm điểm…" : "Nộp bài"}
          </Button>
          {!allAnswered && <span className="text-caption text-muted-foreground">Trả lời hết các câu để nộp bài</span>}
          {error && <span className="inline-flex items-center gap-1 text-caption text-danger"><CircleAlert className="size-3.5" />{error}</span>}
        </div>
      )}
    </div>
  )
}

interface AiAgentsViewProps {
  onNavigate?: (tab: string) => void
  /** Mở sẵn một agent (vd. từ CTA "Bắt đầu đánh giá" → wf03) */
  initialAgentId?: string | null
}

export function AiAgentsView({ onNavigate, initialAgentId }: AiAgentsViewProps = {}) {
  const { user, isAdmin } = useAuth()
  const visibleAgents = isAdmin ? agentList : agentList.filter((a) => EMPLOYEE_AGENT_IDS.includes(a.id))
  const [activeAgentId, setActiveAgentId] = useState(initialAgentId ?? (isAdmin ? "wf01" : "wf02"))

  useEffect(() => {
    if (initialAgentId) setActiveAgentId(initialAgentId)
  }, [initialAgentId])

  // Quyền thay đổi sau khi auth tải xong → đưa về agent hợp lệ
  useEffect(() => {
    if (!isAdmin && !EMPLOYEE_AGENT_IDS.includes(activeAgentId)) setActiveAgentId("wf02")
  }, [isAdmin, activeAgentId])

  // Nhãn người gửi theo tài khoản đang đăng nhập
  const userName = user?.employee?.fullName || user?.displayName || user?.email?.split("@")[0] || "Bạn"
  const nameParts = userName.trim().split(/\s+/).filter(Boolean)
  const userInitials =
    ((nameParts[0]?.[0] ?? "") + (nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] ?? "" : "")).toUpperCase() || "?"
  const userRoleLabel = isAdmin ? "Quản trị viên" : "Nhân viên"
  // Ref để effect rehydrate đọc nhãn mới nhất mà không phải chạy lại
  const senderRef = React.useRef({ userName, userInitials, userRoleLabel })
  senderRef.current = { userName, userInitials, userRoleLabel }
  const [inputMessage, setInputMessage] = useState("")
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [hydrating, setHydrating] = useState(false)

  // Router Sandbox & PII Simulator states
  const [sandboxInput, setSandboxInput] = useState(PRESET_SCENARIOS[0]?.text ?? "")
  const [sandboxE2EResult, setSandboxE2EResult] = useState<string | null>(null)
  const [sandboxE2ELoading, setSandboxE2ELoading] = useState(false)
  const [sandboxE2EIntent, setSandboxE2EIntent] = useState<string | null>(null)

  // Router Audit logs
  const [auditItems, setAuditItems] = useState<PiiAuditItem[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  const loadAudit = async () => {
    setAuditLoading(true)
    try {
      const items = await escalationApi.getPiiAudit(10)
      setAuditItems(items)
    } catch (e) {
      console.error(e)
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && activeAgentId === 'wf01') {
      loadAudit()
    }
  }, [activeAgentId, isAdmin])

  const handleSandboxE2E = async () => {
    if (!sandboxInput.trim() || sandboxE2ELoading) return
    setSandboxE2ELoading(true)
    setSandboxE2EResult(null)
    setSandboxE2EIntent(null)
    try {
      const res = await agentsApi.chat(sandboxInput)
      setSandboxE2EResult(res.answer)
      setSandboxE2EIntent(res.intent ?? null)
      agentsApi.getIntentStats().then(setIntentStats).catch(() => {})
      loadAudit()
    } catch (e) {
      setSandboxE2EResult(e instanceof Error ? `Lỗi: ${e.message}` : "Lỗi: gọi AI thất bại")
    } finally {
      setSandboxE2ELoading(false)
    }
  }

  const simulatedPii = clientMaskPii(sandboxInput)
  const simulatedIntent = clientParseIntent(simulatedPii.maskedText)

  /** Q16(c) — commit messages vào store (sống qua điều hướng view) + state render */
  const commitMessages = (agentId: string, updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev[agentId] ?? [])
      patchChat<ChatMessage>(sessionKeyFor(agentId), { messages: next })
      return { ...prev, [agentId]: next }
    })
  }

  /** Q16(c) — rehydrate lịch sử từ DB khi lần đầu mở tab (store rỗng) */
  useEffect(() => {
    const type = AGENT_SESSION_TYPE[activeAgentId]
    if (!type) return
    const key = sessionKeyFor(activeAgentId)
    const stored = getChat<ChatMessage>(key)
    if (stored.hydrated) {
      setMessages((prev) => ({ ...prev, [activeAgentId]: [...(stored.messages as ChatMessage[])] }))
      return
    }
    let cancelled = false
    setHydrating(true)
    agentsApi.getLatestSession(type)
      .then((session) => {
        if (cancelled) return
        const agent = agentList.find((a) => a.id === activeAgentId)
        if (!agent) return
        const msgs: ChatMessage[] = (session?.messages ?? []).map((m: AgentHistoryMessage) => ({
          author: m.role === "user" ? senderRef.current.userName : agent.shortName,
          role: m.role === "user" ? senderRef.current.userRoleLabel : `AI (${modelLabel(agent)})`,
          time: fmtVNTime(m.createdAt),
          initials: m.role === "user" ? senderRef.current.userInitials : "AI",
          avatarColor: m.role === "user" ? "bg-primary-tint text-accent-foreground" : agent.tone,
          bot: m.role !== "user",
          text: m.content,
        }))
        patchChat<ChatMessage>(key, { hydrated: true, sessionId: session?.id, messages: msgs })
        setMessages((prev) => ({ ...prev, [activeAgentId]: msgs }))
      })
      .catch(() => {
        if (!cancelled) patchChat<ChatMessage>(key, { hydrated: true })
      })
      .finally(() => {
        if (!cancelled) setHydrating(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeAgentId])

  /** Q19(i1) — "Phiên mới": đóng phiên hiện tại trên server + xoá tin nhắn local */
  const handleNewSession = async () => {
    const type = AGENT_SESSION_TYPE[activeAgentId]
    if (!type) return
    try {
      const session = await agentsApi.renewSession(type)
      patchChat<ChatMessage>(sessionKeyFor(activeAgentId), {
        hydrated: true,
        sessionId: session.id,
        messages: [],
      })
      setMessages((prev) => ({ ...prev, [activeAgentId]: [] }))
    } catch (e) {
      console.error(e)
    }
  }
  const [isProcessing, setIsProcessing] = useState(false)
  const [waitSeconds, setWaitSeconds] = useState(0)
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

  // Các route giám sát chỉ dành cho admin — nhân viên không gọi để tránh 403 lặp lại
  useEffect(() => {
    if (!isAdmin) return
    const fetchLive = async () => {
      try {
        const perf = await agentsApi.getPerformance()
        setAgentPerf(perf)
      } catch (e) {
        console.warn('[AiAgentsView] Failed to fetch agent performance:', e)
      }
      try {
        const stats = await agentsApi.getIntentStats()
        setIntentStats(stats)
      } catch (e) {
        console.warn('[AiAgentsView] Failed to fetch intent stats:', e)
      }
    }
    fetchLive()
    const interval = setInterval(fetchLive, 30000)
    return () => clearInterval(interval)
  }, [isAdmin])

  // WF04: tải danh sách hội thoại CSKH khi mở tab (poll 30s)
  useEffect(() => {
    if (!isAdmin || activeAgentId !== 'wf04') return
    let alive = true
    const load = async () => {
      try {
        const list = await escalationApi.getAllConversations()
        if (!alive) return
        setCskhConversations(list)
        setCskhSelectedId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0]?.id ?? null))
      } catch (e) {
        console.warn('[AiAgentsView] Failed to fetch conversations:', e)
      }
    }
    load()
    const iv = setInterval(load, 30000)
    return () => { alive = false; clearInterval(iv) }
  }, [activeAgentId, isAdmin])

  // WF04: lịch sử hội thoại của phiên đang chọn (chỉ đọc)
  useEffect(() => {
    if (!isAdmin || activeAgentId !== 'wf04' || !cskhSelectedId) { setCskhHistory([]); return }
    setCskhLoading(true)
    escalationApi
      .getChatHistory(cskhSelectedId)
      .then((h) => setCskhHistory(h.messages))
      .catch(() => setCskhHistory([]))
      .finally(() => setCskhLoading(false))
  }, [activeAgentId, cskhSelectedId, isAdmin])

  const activeAgent = (visibleAgents.find((a) => a.id === activeAgentId) || visibleAgents[0] || agentList[0])!
  const currentMessages = messages[activeAgentId] || []
  const isRouter = activeAgentId === "wf01"
  const isCskhNotify = activeAgentId === "wf04"
  const cskhSelected = cskhConversations.find((c) => c.id === cskhSelectedId) ?? null

  // Đồng hồ đếm ngược thời gian chờ phản hồi AI + giai đoạn pipeline đang chạy
  useEffect(() => {
    if (!isProcessing) return
    setWaitSeconds(0)
    const iv = setInterval(() => setWaitSeconds((s) => s + 1), 1000)
    return () => clearInterval(iv)
  }, [isProcessing])

  const waitStage =
    waitSeconds <= 4
      ? "Đang phân loại câu hỏi & che giấu dữ liệu cá nhân…"
      : waitSeconds <= 12
        ? `${activeAgent.name} đang suy luận với DeepSeek…`
        : waitSeconds <= 25
          ? "Đang tra cứu dữ liệu & chính sách nội bộ…"
          : "AI đang xử lý lâu hơn thường lệ — vẫn đang chờ phản hồi…"

  const currentAgentPerf = agentPerf?.[activeAgentId as keyof AllAgentsPerf]
  const isWf01 = activeAgentId === "wf01"
  const currentAccuracy = currentAgentPerf?.successRate != null ? `${currentAgentPerf.successRate.toLocaleString("vi-VN")}%` : '--'
  // WF01 là router: không gọi LLM nên không có callCount/latency trong bảng performance.
  // Dùng đúng tổng lượt đã định tuyến từ intent-stats để không lệch với sidebar (118 vs 0).
  const currentCallCount = isWf01 ? (intentStats?.total ?? 0) : (currentAgentPerf?.callCount ?? 0)

  /** Kiểm tra kết nối: tin "ping" → Router trả lời tĩnh, không gọi LLM, không ghi lịch sử chat */
  const handlePingTest = async () => {
    setIsPinging(true)
    setPingError(null)
    try {
      const { healthz, roundTrip } = await settingsApi.testAiConnection()
      const failed = !healthz.ok ? healthz : roundTrip && !roundTrip.ok ? roundTrip : null
      if (failed) {
        setLiveLatency(null)
        setPingError(failed.detail)
      } else {
        setLiveLatency(roundTrip?.latencyMs ?? healthz.latencyMs ?? null)
      }
    } catch (e) {
      setLiveLatency(null)
      setPingError(e instanceof Error ? e.message : "Không gọi được AI Agent.")
    } finally {
      setIsPinging(false)
    }
  }

  /** Cập nhật 1 tin nhắn theo index (dùng cho quiz nộp bài xong) */
  const updateMessage = (index: number, patch: Partial<ChatMessage>) => {
    setMessages((prev) => {
      const list = [...(prev[activeAgentId] || [])]
      if (!list[index]) return prev
      list[index] = { ...list[index], ...patch }
      patchChat<ChatMessage>(sessionKeyFor(activeAgentId), { messages: list })
      return { ...prev, [activeAgentId]: list }
    })
  }

  /** Gửi 1 lượt chat (ô nhập và chip bài thi nhanh dùng chung) */
  const sendChat = async (text: string, scenarioType?: string) => {
    if (!text || isProcessing) return

    const userMsg: ChatMessage = {
      author: userName,
      role: userRoleLabel,
      time: fmtVNTime(new Date()),
      initials: userInitials,
      avatarColor: "bg-primary-tint text-accent-foreground",
      text: text,
    }

    commitMessages(activeAgentId, (prev) => [...prev, userMsg])
    setIsProcessing(true)

    const startTime = Date.now()
    try {
      const stored = getChat<ChatMessage>(sessionKeyFor(activeAgentId))
      const result = await agentsApi.chat(text, {
        sessionId: stored.sessionId,
        sessionType: AGENT_SESSION_TYPE[activeAgentId],
        scenarioType,
      })
      const latencyMs = result.latencyMs || Date.now() - startTime
      setLiveLatency(latencyMs)
      if (result.sessionId && result.sessionId !== stored.sessionId) {
        patchChat<ChatMessage>(sessionKeyFor(activeAgentId), { sessionId: result.sessionId })
      }

      const routedTo = (result.intent && INTENT_AGENT_NAME[result.intent]) || activeAgent.shortName

      const assistantMsg: ChatMessage = {
        author: activeAgent.shortName,
        role: `AI (${modelLabel(activeAgent)})`,
        time: fmtVNTime(new Date()),
        initials: "AI",
        avatarColor: activeAgent.tone,
        bot: true,
        text: result.answer,
        insight: `Xử lý bởi: ${routedTo}`,
        ...(result.questions && result.questions.length > 0
          ? { quiz: result.questions, scenarioType: result.scenarioType }
          : {}),
      }
      commitMessages(activeAgentId, (prev) => [...prev, assistantMsg])
    } catch (e) {
      const errMsg: ChatMessage = {
        author: "System",
        role: "Error",
        time: fmtVNTime(new Date()),
        initials: "ERR",
        avatarColor: "bg-danger-tint text-danger",
        bot: true,
        text: e instanceof Error ? e.message : "Không gọi được AI Agent. Vui lòng thử lại.",
      }
      commitMessages(activeAgentId, (prev) => [...prev, errMsg])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSendMessage = () => {
    const text = inputMessage.trim()
    if (!text || isProcessing) return
    setInputMessage("")
    void sendChat(text)
  }

  return (
    <div className="flex min-w-0 flex-col bg-background lg:h-[calc(100dvh-4rem)] lg:flex-row lg:overflow-hidden">
      {/* Sub-sidebar for Agents — danh sách WF + hoạt động */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border bg-card lg:w-[280px] lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 lg:px-5 lg:pt-6">
          <Cpu className="size-4 text-ai" />
          <h2 className="text-h3 font-semibold text-foreground">AI Multi-Agents</h2>
        </div>

        <div className="flex gap-2 overflow-x-auto px-4 pb-4 lg:flex-1 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:px-3">
          {visibleAgents.map((agent) => {
            const Icon = agent.icon
            const isSelected = agent.id === activeAgentId
            const perf = agentPerf?.[agent.id as keyof AllAgentsPerf]
            return (
              <button
                key={agent.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => { setActiveAgentId(agent.id); setLiveLatency(null) }}
                className={cn(
                  "flex w-[240px] shrink-0 items-start gap-3 rounded-lg border p-3 text-left transition-colors lg:w-auto",
                  isSelected
                    ? "border-primary/30 bg-primary-tint"
                    : "border-border bg-card hover:bg-sunken"
                )}
              >
                <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", agent.tone)}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-2 text-body-sm font-semibold leading-tight text-foreground">
                      {agent.name}
                    </span>
                    {isAdmin && (
                      <Badge variant={agent.badgeVariant} className="font-mono">
                        {agent.workflow}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-caption leading-tight text-muted-foreground">
                    {agent.detail}
                  </p>
                  {isAdmin && (
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-caption text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", perf ? "bg-success" : "bg-subtle-foreground")} />
                        <span className="truncate">{perf ? "Hoạt động" : "Chưa có dữ liệu"}</span>
                      </span>
                      {agent.id === "wf01" && (
                        <span className="flex items-center gap-1 tabular" title="Số tin nhắn Router đã định tuyến">
                          <Shuffle className="size-3" />
                          {intentStats?.total ?? 0} lượt
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {isAdmin && (
          <div className="hidden border-t border-border p-3 lg:block">
            <div className="rounded-md bg-sunken p-3 text-caption text-muted-foreground">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                <span className="size-2 rounded-full bg-success animate-pulse" />
                Giám sát trực tiếp
              </p>
              <p className="mt-1">Số liệu làm mới tự động mỗi 30 giây.</p>
            </div>
          </div>
        )}
      </aside>

      {/* ── WF01: Dashboard giám sát Router (không chat — WF01 là router) ── */}
      {isRouter ? (
        <section className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", activeAgent.tone)}>
                <activeAgent.icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-h3 font-semibold text-foreground">{activeAgent.name}</h2>
                  <Badge variant={activeAgent.badgeVariant} className="font-mono">
                    {activeAgent.workflow}
                  </Badge>
                </div>
                <p className="truncate text-caption text-muted-foreground">
                  <span className={activeAgent.model ? "font-mono" : undefined}>{modelLabel(activeAgent)}</span> • {activeAgent.detail}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {liveLatency != null && !pingError && (
                <Badge variant="success" className="hidden sm:inline-flex">
                  <span className="size-1.5 rounded-full bg-success" />
                  Kết nối OK
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePingTest}
                disabled={isPinging}
                className="gap-1.5"
                title="Kiểm tra kết nối tới AI (không ghi lịch sử chat)"
              >
                {isPinging && <Loader2 className="size-3.5 animate-spin" />}
                {isPinging ? "Đang kiểm tra…" : "Kiểm tra kết nối"}
              </Button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-5 lg:p-5 xl:p-6">
            {/* Stat tiles — số liệu thật từ DB (metadata error của aiChatMessage) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
              <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
                <p className="text-caption text-muted-foreground">Tỷ lệ thành công</p>
                <p className="mt-1 text-h2 font-semibold text-foreground tabular">{currentAccuracy}</p>
                {isWf01 && <p className="mt-1 text-caption text-muted-foreground">Router không gọi LLM nên không có tỷ lệ lỗi</p>}
              </div>
              <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
                <p className="text-caption text-muted-foreground">{isWf01 ? "Lượt định tuyến" : "Số cuộc gọi"}</p>
                <p className="mt-1 text-h2 font-semibold text-foreground tabular">{currentCallCount}</p>
              </div>
            </div>

            {pingError && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint p-3 text-body-sm text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span>Kiểm tra kết nối thất bại: {pingError}</span>
              </div>
            )}

            {/* Intent routing chart — WF01 */}
            <div className="rounded-lg border border-border bg-card p-4 shadow-xs lg:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-muted-foreground" />
                  <h3 className="text-h3 font-semibold text-foreground">
                    Định tuyến Intent (Router WF01)
                  </h3>
                </div>
                <Badge variant="success">
                  <span className="size-1.5 rounded-full bg-success animate-pulse" />
                  Live
                </Badge>
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
                            <div className="flex items-center justify-between gap-2 text-caption">
                              <span className="text-secondary-foreground">{label}</span>
                              <span className="font-medium text-foreground tabular">{value} ({pct}%)</span>
                            </div>
                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                              <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border-subtle pt-4">
                      <div className="rounded-md bg-sunken p-3">
                        <p className="text-caption text-muted-foreground">Tổng đã định tuyến</p>
                        <p className="mt-0.5 text-h3 font-semibold text-foreground tabular">{intentStats.total}</p>
                      </div>
                      <div className="rounded-md bg-sunken p-3">
                        <p className="text-caption text-muted-foreground">Escalation chuyển người</p>
                        <p className="mt-0.5 text-h3 font-semibold text-foreground tabular">{intentStats.escalations}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-3" aria-label="Đang tải thống kê intent…">
                    {INTENT_META.map(({ key }) => (
                      <div key={key} className="space-y-1.5">
                        <div className="skeleton h-3 w-1/2 rounded-sm" />
                        <div className="skeleton h-2 w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── BẢNG THÔNG BÁO & GIÁM SÁT ĐIỀU PHỐI (WF01 GATEWAY) ── */}
            <div className="rounded-lg border border-border bg-card p-4 shadow-xs lg:p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-md bg-agent-wf01-tint text-agent-wf01">
                  <ShieldCheck className="size-4" />
                </div>
                <h3 className="text-h3 font-semibold text-foreground">
                  Kiểm thử & nhật ký Router
                </h3>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="sandbox" className="mt-4 w-full">
                <TabsList className="overflow-x-auto">
                  <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
                  <TabsTrigger value="specs">Thông số kỹ thuật</TabsTrigger>
                  <TabsTrigger value="audit">Audit</TabsTrigger>
                </TabsList>

                {/* Tab 1: Sandbox */}
                <TabsContent value="sandbox" className="mt-0 space-y-4 pt-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-body-sm font-medium text-foreground">
                        Kịch bản thử nghiệm mẫu
                      </label>
                      <span className="hidden text-caption text-muted-foreground sm:inline">
                        Bấm chọn để nạp văn bản mẫu kiểm tra tức thì
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PRESET_SCENARIOS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          aria-pressed={sandboxInput === p.text}
                          onClick={() => {
                            setSandboxInput(p.text)
                            setSandboxE2EResult(null)
                            setSandboxE2EIntent(null)
                          }}
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-left text-body-sm transition-colors",
                            sandboxInput === p.text
                              ? "border-primary/30 bg-primary-tint text-accent-foreground"
                              : "border-border bg-card text-secondary-foreground hover:bg-sunken"
                          )}
                        >
                          <span className="font-mono text-caption font-medium">{p.badge}</span> {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="router-sandbox-input" className="text-body-sm font-medium text-foreground">
                      Nội dung cần phân tích & kiểm duyệt PII
                    </label>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-start">
                      <Textarea
                        id="router-sandbox-input"
                        rows={2}
                        value={sandboxInput}
                        onChange={(e) => {
                          setSandboxInput(e.target.value)
                          setSandboxE2EResult(null)
                          setSandboxE2EIntent(null)
                        }}
                        placeholder="Nhập câu chat bất kỳ chứa SĐT, CCCD, Email để thử nghiệm bộ lọc..."
                        className="min-h-[72px] flex-1 resize-none"
                      />
                      <Button
                        type="button"
                        onClick={handleSandboxE2E}
                        disabled={sandboxE2ELoading || !sandboxInput.trim()}
                        className="shrink-0 gap-1.5"
                        title="Gửi thật qua Router — có ghi vào lịch sử & thống kê"
                      >
                        {sandboxE2ELoading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                        {sandboxE2ELoading ? "Đang gọi AI…" : "Thử gọi E2E"}
                      </Button>
                    </div>
                  </div>

                  {/* Realtime Analysis Visualizer Cards — mô phỏng regex/từ khóa của Router ngay trên trình duyệt */}
                  <p className="text-caption text-muted-foreground">
                    Hai thẻ dưới đây là <span className="font-medium text-foreground">mô phỏng phía trình duyệt</span>; kết quả thật chỉ có sau khi bấm &quot;Thử gọi E2E&quot;.
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Box 1: PII Sanitized Preview */}
                    <div className="space-y-2 rounded-lg border border-border bg-sunken p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-body-sm font-semibold text-foreground">
                          <Lock className="size-3.5 text-muted-foreground" />
                          1. Che giấu PII
                        </span>
                        <Badge variant={simulatedPii.totalPii > 0 ? "success" : "outline"}>
                          {simulatedPii.totalPii > 0 ? <ShieldCheck /> : null}
                          {simulatedPii.totalPii > 0 ? `Đã bảo vệ ${simulatedPii.totalPii} dữ liệu` : "An toàn (0 PII)"}
                        </Badge>
                      </div>
                      <div className="min-h-[4rem] rounded-md border border-border bg-card p-3 text-body-sm text-foreground">
                        {sandboxInput.trim() ? (
                          highlightMaskedTokens(simulatedPii.maskedText)
                        ) : (
                          <span className="text-muted-foreground">Nhập văn bản phía trên để xem kết quả che giấu...</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-caption text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-success" />
                          CCCD: <strong className="font-semibold text-foreground tabular">{simulatedPii.idCount}</strong>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-warning" />
                          SĐT: <strong className="font-semibold text-foreground tabular">{simulatedPii.phoneCount}</strong>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-info" />
                          Email: <strong className="font-semibold text-foreground tabular">{simulatedPii.emailCount}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Box 2: Intent Classification & Target Agent */}
                    <div className="space-y-2 rounded-lg border border-border bg-sunken p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-body-sm font-semibold text-foreground">
                          <Cpu className="size-3.5 text-muted-foreground" />
                          2. Định tuyến
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={simulatedIntent.badgeVariant} className="font-mono" title="Mô phỏng">
                            {simulatedIntent.intent}
                          </Badge>
                          {sandboxE2EIntent && (
                            <Badge
                              variant={sandboxE2EIntent === simulatedIntent.intent ? "success" : "warning"}
                              className="font-mono"
                              title="Intent thật do server trả về"
                            >
                              Server: {sandboxE2EIntent}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="min-h-[4rem] space-y-1.5 rounded-md border border-border bg-card p-3 text-body-sm">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="text-caption text-muted-foreground">Đích tiếp nhận:</span>
                          <span className="font-semibold text-foreground">{simulatedIntent.targetAgent}</span>
                        </div>
                        <p className="text-caption text-muted-foreground">
                          <span className="font-medium text-foreground">Quy tắc nhận diện:</span> {simulatedIntent.matchedRule}
                        </p>
                        {simulatedIntent.action && (
                          <div className="mt-1 flex items-center gap-1.5 text-caption text-muted-foreground">
                            <Zap className="size-3.5 text-agent-wf03" />
                            <span>Action đính kèm:</span>
                            <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-micro text-foreground">{simulatedIntent.action}</code>
                          </div>
                        )}
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Chỉ nội dung đã che giấu mới được chuyển tới agent tương ứng.
                      </p>
                    </div>
                  </div>

                  {/* E2E Response Box if available */}
                  {sandboxE2EResult && (
                    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-body-sm font-semibold text-foreground">
                          <Sparkles className="size-3.5 text-ai" />
                          Phản hồi thực tế từ AI Agent (E2E)
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap rounded-md border border-border bg-sunken p-3 text-body-sm text-foreground">
                        {sandboxE2EResult}
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab 2: Specs & Pipeline */}
                <TabsContent value="specs" className="mt-0 space-y-4 pt-4">
                  <div className="rounded-lg border border-border bg-sunken p-4 text-body-sm text-muted-foreground">
                    <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
                      <ShieldCheck className="size-4 text-agent-wf01" />
                      Nguyên lý an ninh dữ liệu & trung tâm điều phối WF01
                    </p>
                    WF01 đóng vai trò cổng bảo vệ dữ liệu (Security Gateway) và bộ điều hướng trung tâm (Orchestrator).
                    Mọi truy vấn từ Portal, Mobile ESS và Slack đều bắt buộc đi qua bước khử dữ liệu cá nhân (Regex PII Sanitizer)
                    trước khi gửi tới mô hình AI (DeepSeek).
                  </div>

                  {/* Pipeline 4 bước */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary-tint text-micro font-semibold text-primary">1</span>
                        Tiếp nhận & xác thực
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Nhận câu hỏi và xác thực phiên đăng nhập của người dùng.
                      </p>
                    </div>
                    <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary-tint text-micro font-semibold text-primary">2</span>
                        Regex PII Masking
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Quét và thay thế tự động CCCD, SĐT, Email bằng các token ẩn danh <code className="rounded-sm bg-muted px-1 font-mono text-micro text-foreground">[MASKED_*]</code>.
                      </p>
                    </div>
                    <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary-tint text-micro font-semibold text-primary">3</span>
                        Phân loại Intent
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Phân tích từ khóa ngữ nghĩa để điều phối tới WF02 (HR), WF03 (Training), WF04 (CSKH) hoặc WF01 trả lời.
                      </p>
                    </div>
                    <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary-tint text-micro font-semibold text-primary">4</span>
                        Dispatch & Audit
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Chuyển nội dung đã che giấu tới agent xử lý, lưu nhật ký audit.
                      </p>
                    </div>
                  </div>

                  {/* 3 Thẻ quy chuẩn PII */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-body-sm font-semibold text-foreground">1. CMND / Căn cước (CCCD)</span>
                        <Badge variant="success" className="font-mono">[MASKED_ID]</Badge>
                      </div>
                      <div className="rounded-sm bg-muted p-2 font-mono text-caption text-secondary-foreground">
                        \b\d&#123;9&#125;\b|\b\d&#123;12&#125;\b
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Bảo vệ số định danh cá nhân 9 số (CMND cũ) hoặc 12 số (CCCD gắn chip) theo Nghị định 13/2023/NĐ-CP.
                      </p>
                    </div>

                    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-body-sm font-semibold text-foreground">2. Số điện thoại VN</span>
                        <Badge variant="warning" className="font-mono">[MASKED_PHONE]</Badge>
                      </div>
                      <div className="rounded-sm bg-muted p-2 font-mono text-caption text-secondary-foreground">
                        \b(0[35789]\d&#123;8&#125;|0\d&#123;9&#125;)\b
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Bảo vệ số liên lạc cá nhân của nhân sự và khách hàng. Tự động nhận diện các đầu số mạng di động VN.
                      </p>
                    </div>

                    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-body-sm font-semibold text-foreground">3. Thư điện tử (Email)</span>
                        <Badge variant="info" className="font-mono">[MASKED_EMAIL]</Badge>
                      </div>
                      <div className="rounded-sm bg-muted p-2 font-mono text-caption text-secondary-foreground">
                        [\w.-]+@[\w.-]+\.\w+
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Bảo vệ địa chỉ hộp thư tổ chức và email cá nhân, ngăn chặn rò rỉ dữ liệu thông tin liên lạc nội bộ.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 3: Live Audit Logs */}
                <TabsContent value="audit" className="mt-0 space-y-3 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-body-sm font-semibold text-foreground">
                        Nhật ký dữ liệu sau kiểm duyệt (Live Audit Trail)
                      </p>
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        Dữ liệu thật từ cơ sở dữ liệu (tối đa 10 tin nhắn gần nhất đã qua xử lý PII)
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadAudit}
                      disabled={auditLoading}
                      className="gap-1.5"
                    >
                      {auditLoading && <Loader2 className="size-3.5 animate-spin" />}
                      Làm mới
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-border bg-card">
                    {auditLoading ? (
                      <div className="flex items-center justify-center gap-2 p-8 text-center text-body-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Đang tải nhật ký audit…
                      </div>
                    ) : auditItems.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 p-8 text-center">
                        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <ShieldCheck className="size-5" />
                        </div>
                        <p className="text-body font-semibold text-foreground">Chưa có dữ liệu audit</p>
                        <p className="max-w-sm text-body-sm text-muted-foreground">
                          Gửi câu hỏi thử nghiệm để quan sát nhật ký ghi nhận thời gian thực.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[calc(100vh-28rem)] divide-y divide-border-subtle overflow-y-auto">
                        {auditItems.map((item) => {
                          const masked = auditMasked(item)
                          const hasPiiMasked = masked !== null && masked !== item.content
                          return (
                            <div key={item.id} className="space-y-1.5 p-3 text-body-sm transition-colors hover:bg-sunken">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={item.role === "user" ? "secondary" : item.role === "human" ? "info" : "ai"}
                                  >
                                    {item.role === "user" ? "Khách / NV" : item.role === "human" ? "Chuyên viên" : "AI Agent"}
                                  </Badge>
                                  <span className="font-mono text-caption text-muted-foreground">
                                    {item.session?.type ?? "OTHER"} • {item.session?.channel ?? "web"}
                                  </span>
                                </div>
                                <span className="text-caption text-muted-foreground tabular">
                                  {fmtDateTime(item.createdAt)}
                                </span>
                              </div>
                              <div className="text-foreground">
                                {masked ? highlightMaskedTokens(masked) : item.content}
                              </div>
                              {hasPiiMasked && (
                                <div className="text-caption text-muted-foreground">
                                  Bản gốc (DB): <span className="font-mono text-foreground">{item.content}</span>
                                </div>
                              )}
                              {masked && (
                                <div className="flex items-center gap-1 text-caption text-success">
                                  <ShieldCheck className="size-3.5" />
                                  <span>{hasPiiMasked ? "Đã che PII nhạy cảm" : "Đã quét PII Masking (Không có PII)"}</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </section>
      ) : isCskhNotify ? (
        /* ── WF04: CSKH Agent — Bảng thông báo Slack & Tiếp Quản ── */
        <section className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">
          {/* Header */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", activeAgent.tone)}>
                <activeAgent.icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-h3 font-semibold text-foreground">{activeAgent.name}</h2>
                  <Badge variant={activeAgent.badgeVariant} className="font-mono">
                    {activeAgent.workflow}
                  </Badge>
                </div>
                <p className="truncate text-caption text-muted-foreground">
                  <span className={activeAgent.model ? "font-mono" : undefined}>{modelLabel(activeAgent)}</span> • Kênh Slack/Zalo
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate?.("cskh-escalation")}
              className="gap-1.5"
              title="Mở trang Tiếp Quản CSKH & PII để xử lý khiếu nại"
            >
              <Headphones className="size-3.5" />
              Mở tiếp quản CSKH
            </Button>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-5 lg:p-5 xl:p-6">
            {/* Banner hướng dẫn WF04 */}
            <div className="flex items-start gap-3 rounded-lg border border-border bg-sunken p-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-agent-wf04-tint text-agent-wf04">
                <ShieldAlert className="size-4" />
              </div>
              <div className="text-body-sm text-muted-foreground">
                <p className="font-semibold text-foreground">
                  Bảng thông báo chỉ đọc — kênh CSKH ngoài (Slack/Zalo)
                </p>
                <p className="mt-0.5">
                  Khách hàng nhắn tin qua Slack/Zalo. Quản trị viên theo dõi hội thoại tại đây; khi khách cần hỗ trợ đặc biệt (human takeover) hoặc bật lại bot, nhấn &quot;Mở tiếp quản CSKH&quot; ở góc phải phía trên.
                </p>
              </div>
            </div>

            {/* Nội dung: danh sách hội thoại + tóm tắt + dữ liệu khách */}
            <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr] lg:gap-6">
              {/* Danh sách phiên hội thoại */}
              <div className="flex max-h-[calc(100vh-16rem)] flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-xs">
                <p className="px-1 pb-1 text-body-sm font-semibold text-foreground">
                  Hội thoại <span className="font-normal text-muted-foreground tabular">({cskhConversations.length})</span>
                </p>
                {cskhConversations.length === 0 && (
                  <p className="p-2 text-body-sm text-muted-foreground">
                    Chưa có hội thoại — khi khách nhắn tin qua Slack/Zalo, phiên sẽ xuất hiện tại đây.
                  </p>
                )}
                {cskhConversations.map((c) => {
                  const selected = c.id === cskhSelectedId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setCskhSelectedId(c.id)}
                      className={cn(
                        "rounded-md border p-2.5 text-left transition-colors",
                        selected
                          ? "border-primary/30 bg-primary-tint"
                          : "border-transparent hover:bg-sunken"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-caption font-semibold text-foreground">
                          {c.externalId ?? "(khách ẩn danh)"}
                        </span>
                        <Badge variant={c.escalated ? "warning" : "success"} className="shrink-0">
                          <span className={cn("size-1.5 rounded-full", c.escalated ? "bg-warning" : "bg-success")} />
                          {c.escalated ? "Đã escalate" : "Bot phục vụ"}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-caption text-muted-foreground">
                        {stripMarkdown(c.lastMessage) || "--"}
                      </p>
                      <p className="mt-0.5 text-micro text-subtle-foreground tabular">
                        {c.messageCount} tin • {fmtDateTime(c.lastMessageAt)}
                      </p>
                    </button>
                  )
                })}
              </div>

              {/* Chi tiết: dữ liệu khách + tóm tắt hội thoại */}
              <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
                <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
                  <h3 className="text-h3 font-semibold text-foreground">
                    Dữ liệu khách hàng (từ Slack)
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-md bg-sunken p-3">
                      <p className="text-caption text-muted-foreground">Customer ID</p>
                      <p className="truncate font-mono text-body-sm font-semibold text-foreground">{cskhSelected?.externalId ?? "--"}</p>
                    </div>
                    <div className="rounded-md bg-sunken p-3">
                      <p className="text-caption text-muted-foreground">Số tin nhắn</p>
                      <p className="text-body-sm font-semibold text-foreground tabular">{cskhSelected?.messageCount ?? 0}</p>
                    </div>
                    <div className="rounded-md bg-sunken p-3">
                      <p className="text-caption text-muted-foreground">Trạng thái</p>
                      <p className={cn("flex items-center gap-1.5 text-body-sm font-semibold", cskhSelected ? (cskhSelected.escalated ? "text-warning" : "text-success") : "text-foreground")}>
                        {cskhSelected && <span className={cn("size-2 rounded-full", cskhSelected.escalated ? "bg-warning" : "bg-success")} />}
                        {cskhSelected ? (cskhSelected.escalated ? "Chờ nhân viên" : "Bot đang phục vụ") : "--"}
                      </p>
                    </div>
                    <div className="rounded-md bg-sunken p-3">
                      <p className="text-caption text-muted-foreground">Hoạt động cuối</p>
                      <p className="text-body-sm font-semibold text-foreground tabular">{fmtDateTime(cskhSelected?.lastMessageAt ?? null)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-[12rem] flex-1 flex-col rounded-lg border border-border bg-card p-4 shadow-xs">
                  <h3 className="text-h3 font-semibold text-foreground">
                    Tóm tắt cuộc hội thoại (chỉ đọc)
                  </h3>
                  <div className="mt-3 flex max-h-[calc(100vh-32rem)] flex-col gap-2.5 overflow-y-auto pr-1">
                    {cskhLoading ? (
                      <div className="flex flex-col gap-2.5" aria-label="Đang tải hội thoại…">
                        <div className="skeleton h-16 w-full rounded-md" />
                        <div className="skeleton h-16 w-full rounded-md" />
                      </div>
                    ) : cskhHistory.length === 0 ? (
                      <p className="text-body-sm text-muted-foreground">Chọn một phiên ở bên trái để xem nội dung.</p>
                    ) : (
                      cskhHistory.map((m) => (
                        <div key={m.id} className="rounded-md border border-border bg-sunken p-3">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={cn(
                              "text-caption font-semibold",
                              m.role === "user" ? "text-secondary-foreground" : m.role === "human" ? "text-primary" : "text-agent-wf04"
                            )}>
                              {WF04_ROLE_LABEL[m.role] ?? m.role}
                            </span>
                            <span className="text-micro text-subtle-foreground tabular">{fmtDateTime(m.createdAt)}</span>
                          </div>
                          <RichText text={m.content} className="mt-1 line-clamp-6 text-body-sm text-foreground" />
                        </div>
                      ))
                    )}
                  </div>
                  <p className="mt-3 border-t border-border-subtle pt-3 text-caption text-muted-foreground">
                    WF04 là agent phục vụ khách — admin không chat tại đây. Để <span className="font-medium text-foreground">trả lời khách (human takeover)</span> hoặc bật lại bot, mở trang <span className="font-medium text-foreground">Tiếp quản CSKH</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* ── WF02/03: Chat workspace ── */
        <section className="flex h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col bg-background lg:h-auto lg:min-h-0">
          {/* Chat Header */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", activeAgent.tone)}>
                <activeAgent.icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-h3 font-semibold text-foreground">{activeAgent.name}</h2>
                  {isAdmin && (
                    <Badge variant={activeAgent.badgeVariant} className="font-mono">
                      {activeAgent.workflow}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-caption text-muted-foreground">
                  <span className={activeAgent.model ? "font-mono" : undefined}>{modelLabel(activeAgent)}</span> • Dữ liệu cá nhân được che giấu trước khi gửi tới AI
                </p>
              </div>
            </div>
            {AGENT_SESSION_TYPE[activeAgentId] && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewSession}
                disabled={hydrating || isProcessing}
                className="gap-1.5"
                title="Đóng phiên hiện tại và bắt đầu phiên mới"
              >
                {hydrating && <Loader2 className="size-3.5 animate-spin" />}
                Phiên mới
              </Button>
            )}
          </div>

          {/* Message Stream */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col gap-4 px-4 py-6">
              {currentMessages.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                  <div className={cn("flex size-10 items-center justify-center rounded-md", activeAgent.tone)}>
                    <activeAgent.icon className="size-5" />
                  </div>
                  <p className="text-body font-semibold text-foreground">Chưa có tin nhắn nào trong phiên này</p>
                  <p className="max-w-sm text-body-sm text-muted-foreground">
                    Gửi câu hỏi để bắt đầu trò chuyện với <span className="font-medium text-foreground">{activeAgent.name}</span>.
                  </p>
                </div>
              )}
              {currentMessages.map((msg, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-2.5",
                    msg.quiz?.length ? "w-full" : "max-w-[85%]",
                    msg.bot ? "mr-auto" : "ml-auto flex-row-reverse"
                  )}
                >
                  <Avatar
                    initials={msg.initials}
                    className={cn("size-7 shrink-0 text-micro font-semibold", msg.avatarColor)}
                  />

                  <div className={cn("flex min-w-0 flex-1 flex-col gap-1", msg.bot ? "items-start" : "items-end")}>
                    <div className="flex items-baseline gap-2 text-caption">
                      <span className="font-medium text-foreground">{msg.author}</span>
                      <span className="text-muted-foreground">{msg.role}</span>
                    </div>

                    <div
                      className={cn(
                        "max-w-full px-3.5 py-2.5 text-body-sm",
                        msg.bot
                          ? "rounded-lg rounded-tl-sm border border-border bg-card text-foreground"
                          : "rounded-lg rounded-tr-sm bg-primary-tint text-accent-foreground"
                      )}
                    >
                      <RichText text={msg.text} className="text-body-sm" />

                      {msg.tags && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.tags.map((tag) => (
                            <code
                              key={tag}
                              className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-micro text-secondary-foreground"
                            >
                              #{tag}
                            </code>
                          ))}
                        </div>
                      )}

                      {msg.insight && (
                        <div className="mt-2 flex items-center gap-1.5 border-t border-border-subtle pt-2 text-caption text-muted-foreground">
                          <Sparkles className="size-3.5 shrink-0 text-ai" />
                          <span className="tabular">{msg.insight}</span>
                        </div>
                      )}

                      <p className={cn("mt-1 text-micro text-subtle-foreground tabular", !msg.bot && "text-right")}>{msg.time}</p>
                    </div>

                    {msg.quiz && msg.quiz.length > 0 && (
                      <QuizCard
                        quiz={msg.quiz}
                        scenarioType={msg.scenarioType}
                        result={msg.quizResult}
                        onResult={(r) => updateMessage(index, { quizResult: r })}
                      />
                    )}
                  </div>
                </div>
              ))}

              {isProcessing && (
                <div className="mr-auto flex max-w-[85%] gap-2.5" data-testid="chat-waiting">
                  <Avatar initials="AI" className={cn("size-7 shrink-0 text-micro font-semibold", activeAgent.tone)} />
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    <div className="flex items-baseline gap-2 text-caption">
                      <span className="font-medium text-foreground">{activeAgent.shortName}</span>
                      <span className="text-muted-foreground">đang soạn phản hồi…</span>
                    </div>
                    <div className="rounded-lg rounded-tl-sm border border-border bg-card px-3.5 py-3">
                      <div className="flex items-center gap-1" aria-label="Trợ lý đang trả lời">
                        <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse" />
                        <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:150ms]" />
                        <span className="size-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:300ms]" />
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 border-t border-border-subtle pt-2 text-caption text-muted-foreground">
                        <span className="min-w-0 truncate">{waitStage}</span>
                        <span className="ml-auto shrink-0 text-micro text-subtle-foreground tabular">
                          {waitSeconds}s
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Message Composer */}
          <div className="shrink-0 border-t border-border bg-card">
            <div className="mx-auto w-full max-w-[720px] px-4 py-2.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
                className="flex flex-col gap-1.5"
              >
                <div className="overflow-hidden rounded-lg border border-input bg-card transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20">
                  <Textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    rows={1}
                    aria-label={`Gửi câu hỏi tới ${activeAgent.name}`}
                    placeholder={`Gửi câu hỏi hoặc tình huống tới ${activeAgent.name}...`}
                    className="min-h-[44px] resize-none border-0 bg-transparent px-3 py-2.5 text-body-sm leading-5 focus-visible:border-transparent focus-visible:ring-0"
                    disabled={isProcessing}
                  />
                  <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-2 py-1.5">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {/* ── Quick Actions: chỉ hiện khi đang ở WF03 Training ── */}
                    {activeAgentId === "wf03" && (
                      <>
                        <span className="hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:flex">
                          <Play className="size-3 text-agent-wf03" />
                          Bài thi nhanh:
                        </span>
                        {[
                          {
                            label: "Xử lý khiếu nại",
                            short: "Khiếu nại",
                            msg: "Tôi muốn làm bài thi kỹ năng xử lý tình huống khiếu nại",
                            scenarioType: "customer_complaint",
                          },
                          {
                            label: "Giải quyết mâu thuẫn",
                            short: "Mâu thuẫn",
                            msg: "Tôi muốn làm bài test giải quyết mâu thuẫn đồng nghiệp",
                            scenarioType: "colleague_conflict",
                          },
                          {
                            label: "Tiếp nhận feedback",
                            short: "Feedback",
                            msg: "Tôi muốn làm bài kiểm tra kỹ năng tiếp nhận phản hồi từ quản lý",
                            scenarioType: "manager_feedback",
                          },
                          {
                            label: "Onboarding",
                            short: "Onboarding",
                            msg: "Tôi muốn làm bài thi kiến thức onboarding nhân viên mới",
                            scenarioType: "new_employee_onboarding",
                          },
                          {
                            label: "Đánh giá hiệu suất",
                            short: "Hiệu suất",
                            msg: "Tôi muốn làm bài thi kỹ năng đánh giá hiệu suất làm việc",
                            scenarioType: "performance_review",
                          },
                          {
                            label: "Role-play giao tiếp",
                            short: "Giao tiếp",
                            msg: "Luyện tập tình huống role-play kỹ năng giao tiếp chuyên nghiệp với tôi",
                            scenarioType: "general_communication",
                          },
                        ].map(({ label, short, msg, scenarioType }) => (
                          <button
                            key={label}
                            type="button"
                            disabled={isProcessing}
                            onClick={() => void sendChat(msg, scenarioType)}
                            title={label}
                            className={cn(
                              badgeVariants({ variant: "secondary" }),
                              "h-6 shrink-0 cursor-pointer whitespace-nowrap px-2 text-[11px] hover:bg-border disabled:pointer-events-none disabled:opacity-50"
                            )}
                          >
                            <span className="sm:hidden">{short}</span>
                            <span className="hidden sm:inline">{label}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    aria-label="Gửi tin nhắn"
                    title="Gửi tin nhắn (Enter)"
                    disabled={!inputMessage.trim() || isProcessing}
                    className="size-8 shrink-0"
                  >
                    {isProcessing ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  </Button>
                  </div>
                </div>
              </form>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                CCCD, số điện thoại, email được tự động che giấu trước khi gửi tới AI — phản hồi có thể mất 5–60s.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
