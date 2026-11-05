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
import { cn, fmtVNTime, fmtVNShortDateTime } from "@/lib/utils"
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
  /** TÃªn ngáº¯n hiá»ƒn thá»‹ cho ngÆ°á»i dÃ¹ng */
  shortName: string
  detail: string
  tone: string
  badgeVariant: "teal" | "blue" | "amber" | "coral"
  icon: LucideIcon
  unread: boolean
  /** null = WF01 rule-based, khÃ´ng dÃ¹ng LLM */
  model: string | null
  sources: number
}

const agentList: AgentItem[] = [
  {
    id: "wf01",
    name: "Router & Privacy Agent",
    workflow: "WF01",
    shortName: "Router",
    detail: "PhÃ¢n loáº¡i Ã½ Ä‘á»‹nh & PII Masking",
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
    detail: "Há»i Ä‘Ã¡p ngÃ y phÃ©p, báº£o hiá»ƒm, lÆ°Æ¡ng",
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
    shortName: "ÄÃ o táº¡o",
    detail: "Luyá»‡n táº­p 2 chiá»u & cháº¥m Ä‘iá»ƒm tá»± luáº­n",
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
    detail: "KhÃ¡ch hÃ ng Slack/Zalo & Tiáº¿p quáº£n",
    tone: "bg-agent-wf04-tint text-agent-wf04",
    badgeVariant: "coral",
    icon: Headphones,
    unread: false,
    model: "deepseek-flash",
    sources: 8,
  },
]

const modelLabel = (agent: AgentItem) => agent.model ?? "Rule-based, khÃ´ng dÃ¹ng LLM"

/** TÃªn agent thá»±c sá»± xá»­ lÃ½ theo intent server tráº£ vá» */
const INTENT_AGENT_NAME: Record<string, string> = {
  OTHER: "Router (tráº£ lá»i trá»±c tiáº¿p)",
  HR_QA: "HR Q&A",
  TRAINING: "ÄÃ o táº¡o",
  CSKH: "CSKH",
}

/** NhÃ¢n viÃªn chá»‰ dÃ¹ng Ä‘Æ°á»£c HR Q&A vÃ  ÄÃ o táº¡o (cÃ¡c route giÃ¡m sÃ¡t chá»‰ dÃ nh cho admin) */
const EMPLOYEE_AGENT_IDS = ["wf02", "wf03"]

const INTENT_META: Array<{ key: "HR_QA" | "CSKH" | "TRAINING" | "OTHER"; label: string; tone: string }> = [
  { key: "HR_QA", label: "HR_QA â†’ WF02 (Há»i Ä‘Ã¡p ná»™i bá»™)", tone: "bg-agent-wf02" },
  { key: "CSKH", label: "CSKH â†’ WF04 (KhÃ¡ch hÃ ng)", tone: "bg-agent-wf04" },
  { key: "TRAINING", label: "TRAINING â†’ WF03 (ÄÃ o táº¡o)", tone: "bg-agent-wf03" },
  { key: "OTHER", label: "OTHER â†’ WF01 tráº£ lá»i trá»±c tiáº¿p", tone: "bg-agent-wf01" },
]

/** Ká»‹ch báº£n máº«u cho Sandbox thá»­ nghiá»‡m WF01 */
const PRESET_SCENARIOS = [
  {
    badge: "[HR_QA]",
    label: "Nghá»‰ phÃ©p & BHXH",
    text: "NhÃ¢n viÃªn Nguyá»…n VÄƒn A CCCD 001200000001, sÄ‘t 0912345678 cáº§n há»i vá» cháº¿ Ä‘á»™ nghá»‰ phÃ©p nÄƒm vÃ  Ä‘Ã³ng BHXH.",
  },
  {
    badge: "[TRAINING]",
    label: "Test Onboarding",
    text: "TÃ´i lÃ  nhÃ¢n viÃªn má»›i muá»‘n lÃ m bÃ i test tráº¯c nghiá»‡m onboarding kiá»ƒm tra kiáº¿n thá»©c há»™i nháº­p.",
  },
  {
    badge: "[CSKH]",
    label: "Khiáº¿u náº¡i dá»‹ch vá»¥",
    text: "KhÃ¡ch hÃ ng hotline 0988776655 vÃ  email khach@gmail.com khiáº¿u náº¡i Ä‘Æ¡n hÃ ng giao trá»….",
  },
  {
    badge: "[OTHER]",
    label: "ChÃ o há»i chung",
    text: "Xin chÃ o trá»£ lÃ½ áº£o, báº¡n cÃ³ thá»ƒ hÆ°á»›ng dáº«n tá»•ng quan quy cháº¿ cÃ´ng ty khÃ´ng?",
  },
]

interface PiiMaskResult {
  maskedText: string
  idCount: number
  phoneCount: number
  emailCount: number
  totalPii: number
}

/** MÃ´ phá»ng thuáº­t toÃ¡n Regex Masking chuáº©n cá»§a WF01 node 'PII Masking' */
function clientMaskPii(text: string): PiiMaskResult {
  let idCount = 0
  let phoneCount = 0
  let emailCount = 0

  // 1. Email: [\w.-]+@[\w.-]+\.\w+
  let masked = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, () => {
    emailCount++
    return '[MASKED_EMAIL]'
  })

  // 2. SÄT VN: \b(0[35789]\d{8})\b hoáº·c \b(0\d{9})\b
  masked = masked.replace(/\b(0[35789]\d{8}|0\d{9})\b/g, () => {
    phoneCount++
    return '[MASKED_PHONE]'
  })

  // 3. ID 9 hoáº·c 12 sá»‘: \b(\d{9}|\d{12})\b
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

/** MÃ´ phá»ng thuáº­t toÃ¡n Parse Intent chuáº©n cá»§a WF01 node 'Parse Intent' */
function clientParseIntent(maskedMessage: string): SimulatedIntentResult {
  const msg = maskedMessage.toLowerCase()

  const isHR =
    /lÆ°Æ¡ng|phÃ©p|nghá»‰|ngÃ y nghá»‰|xin nghá»‰|nghá»‰ phÃ©p|nghá»‰ á»‘m|nghá»‰ viá»‡c|nghá»‰ bÃ¹|nghá»‰ lá»…|nghá»‰ cháº¿ Ä‘á»™|nghá»‰ khÃ´ng lÆ°Æ¡ng|nghá»‰ thai sáº£n|há»£p Ä‘á»“ng|bhxh|bhyt|bhtn|cháº¥m cÃ´ng|báº£o hiá»ƒm|thuáº¿|tncn|overtime|tÄƒng lÆ°Æ¡ng|giáº£m trá»«|báº­c lÆ°Æ¡ng|há»‡ sá»‘|Ä‘Äƒng kÃ½ phÃ©p|thai sáº£n|phÃºc lá»£i|thÆ°á»Ÿng|bonus|thu nháº­p|kháº¥u trá»«|cÃ´ng sá»‘|báº£ng lÆ°Æ¡ng|ngÃ y cÃ´ng|phá»¥ cáº¥p|kÃ½ há»£p Ä‘á»“ng|lá»‹ch lÃ m viá»‡c|quy Ä‘á»‹nh|chÃ­nh sÃ¡ch|ná»™i quy|thá»­ viá»‡c|Ä‘i muá»™n|vá» sá»›m|cháº¿ Ä‘á»™|trá»£ cáº¥p|thÃ´i viá»‡c|Ä‘á»“ng phá»¥c|cÃ´ng tÃ¡c|nghá»‰ mÃ¡t|khÃ¡m sá»©c khá»e|sa tháº£i|Ä‘uá»•i viá»‡c|bá»“i thÆ°á»ng/.test(
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
    /bÃ i test|bÃ i kiá»ƒm tra|lÃ m test|tráº¯c nghiá»‡m|bÃ i thi|báº¯t Ä‘áº§u Ä‘Ã o táº¡o|báº¯t Ä‘áº§u bÃ i test|báº¯t Ä‘áº§u kiá»ƒm tra/.test(
      msg,
    )

  const isTraining =
    /training|Ä‘Ã o táº¡o|role.?play|ká»‹ch báº£n|luyá»‡n táº­p|tÃ¬nh huá»‘ng|ká»¹ nÄƒng giao tiáº¿p|roleplay|táº­p dÆ°á»£t|bÃ i test|bÃ i kiá»ƒm tra|lÃ m test|quiz|tráº¯c nghiá»‡m|bÃ i thi|kiá»ƒm tra ká»¹ nÄƒng/.test(
      msg,
    ) ||
    /dao tao|kich ban|luyen tap|tinh huong|ky nang|tap duot|bai test|lam test|trac nghiem|bai kiem tra|bai thi|kiem tra/.test(
      msg,
    )

  const isCSKH =
    /khiáº¿u náº¡i|khÃ¡ch hÃ ng|sáº£n pháº©m|cskh|phÃ n nÃ n|dá»‹ch vá»¥|chÄƒm sÃ³c khÃ¡ch|há»— trá»£ khÃ¡ch|complain/.test(
      msg,
    ) || /khieu nai|khach hang|san pham|phan nan|dich vu|cham soc khach|ho tro khach/.test(msg)

  if (isHR) {
    return {
      intent: "HR_QA",
      targetAgent: "WF02 - HR Policy Q&A Agent",
      action: null,
      matchedRule: "Khá»›p tá»« khÃ³a nhÃ¢n sá»±, chÃ­nh sÃ¡ch, ngÃ y phÃ©p, lÆ°Æ¡ng hoáº·c báº£o hiá»ƒm",
      badgeVariant: "blue",
    }
  }
  if (isTraining) {
    return {
      intent: "TRAINING",
      targetAgent: "WF03 - Training & Onboarding Agent",
      action: isQuizRequest ? "generate_quiz" : null,
      matchedRule: isQuizRequest
        ? "Khá»›p yÃªu cáº§u sinh bÃ i test tráº¯c nghiá»‡m (action: generate_quiz)"
        : "Khá»›p tá»« khÃ³a Ä‘Ã o táº¡o, luyá»‡n táº­p, giáº£i quyáº¿t tÃ¬nh huá»‘ng (role-play)",
      badgeVariant: "amber",
    }
  }
  if (isCSKH) {
    return {
      intent: "CSKH",
      targetAgent: "WF04 - Zalo CSKH & Escalation Agent",
      action: null,
      matchedRule: "Khá»›p tá»« khÃ³a khiáº¿u náº¡i, dá»‹ch vá»¥ khÃ¡ch hÃ ng hoáº·c pháº£n Ã¡nh",
      badgeVariant: "coral",
    }
  }
  return {
    intent: "OTHER",
    targetAgent: "WF01 - Router Agent (Tráº£ lá»i trá»±c tiáº¿p)",
    action: null,
    matchedRule: "KhÃ´ng khá»›p tá»« khÃ³a chuyÃªn biá»‡t â€” WF01 xá»­ lÃ½ hoáº·c hÆ°á»›ng dáº«n",
    badgeVariant: "teal",
  }
}

/** TÃ´ mÃ u cÃ¡c token [MASKED_*] trá»±c quan */
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
  /** WF03 generate_quiz â€” form bÃ i test 5 MCQ + 2 essay */
  quiz?: QuizQuestion[]
  scenarioType?: string
  quizResult?: QuizSubmitResult
}

const WF04_ROLE_LABEL: Record<string, string> = {
  user: "KhÃ¡ch hÃ ng",
  assistant: "AI CSKH",
  human: "NhÃ¢n viÃªn",
  staff: "NhÃ¢n viÃªn",
}

/** Q16/Q17 â€” loáº¡i session tÆ°Æ¡ng á»©ng tá»«ng tab agent (backend sá»Ÿ há»¯u phiÃªn) */
const AGENT_SESSION_TYPE: Record<string, "HR_QA" | "TRAINING" | "OTHER"> = {
  wf01: "OTHER",
  wf02: "HR_QA",
  wf03: "TRAINING",
}
const sessionKeyFor = (agentId: string) => `agents:${agentId}`

const fmtDateTime = (iso: string | null) => fmtVNShortDateTime(iso)

/** Form lÃ m bÃ i quiz tÆ°Æ¡ng tÃ¡c â€” 5 MCQ (chá»n Aâ€“D) + 2 tá»± luáº­n, ná»™p qua WF03 cháº¥m Ä‘iá»ƒm */
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
      setError(e instanceof Error ? e.message : "KhÃ´ng ná»™p bÃ i Ä‘Æ°á»£c. Vui lÃ²ng thá»­ láº¡i.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full rounded-lg border border-border bg-card p-4 shadow-xs" data-testid="quiz-card">
      <div className="mb-3 flex items-center gap-2 border-b border-border-subtle pb-3">
        <ListChecks className="size-4 shrink-0 text-agent-wf03" />
        <span className="text-body-sm font-semibold text-foreground">BÃ i kiá»ƒm tra ká»¹ nÄƒng má»m</span>
        <span className="ml-auto text-caption text-muted-foreground tabular">
          {quiz.filter((q) => q.type === "mcq").length} tráº¯c nghiá»‡m â€¢ {quiz.filter((q) => q.type === "essay").length} tá»± luáº­n
        </span>
      </div>

      <div className="space-y-4">
        {quiz.map((q, qi) => {
          const r = resultFor(q.id)
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
                    const isCorrect = graded && q.correct === letter
                    const isWrongPick = graded && selected && q.correct !== letter
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
                        <span className="inline-flex items-center gap-1 font-medium text-success"><CircleCheck className="size-3.5" />ChÃ­nh xÃ¡c</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-danger"><CircleX className="size-3.5" />ÄÃ¡p Ã¡n Ä‘Ãºng: {q.correct}</span>
                      )}
                      {q.explanation ? ` â€” ${q.explanation}` : ""}
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
                    placeholder="TrÃ¬nh bÃ y cÃ¢u tráº£ lá»i cá»§a báº¡nâ€¦"
                    className="min-h-[72px] resize-y text-body-sm"
                  />
                  {graded && (
                    <p className="text-caption text-muted-foreground">
                      <span className="font-medium text-foreground tabular">Äiá»ƒm AI: {r?.score ?? "--"}/10</span>
                      {r?.feedback ? ` â€” ${r.feedback}` : ""}
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
            Káº¿t quáº£: {result?.score_percent ?? "--"}% â€¢ MCQ Ä‘Ãºng {result?.correct_count ?? 0}/{result?.total_mcq ?? 5} â€¢ Tá»± luáº­n TB {result?.essay_avg ?? "--"}/10
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
            {submitting ? "Äang cháº¥m Ä‘iá»ƒmâ€¦" : "Ná»™p bÃ i"}
          </Button>
          {!allAnswered && <span className="text-caption text-muted-foreground">Tráº£ lá»i háº¿t cÃ¡c cÃ¢u Ä‘á»ƒ ná»™p bÃ i</span>}
          {error && <span className="inline-flex items-center gap-1 text-caption text-danger"><CircleAlert className="size-3.5" />{error}</span>}
        </div>
      )}
    </div>
  )
}

interface AiAgentsViewProps {
  onNavigate?: (tab: string) => void
  /** Má»Ÿ sáºµn má»™t agent (vd. tá»« CTA "Báº¯t Ä‘áº§u Ä‘Ã¡nh giÃ¡" â†’ wf03) */
  initialAgentId?: string | null
}

export function AiAgentsView({ onNavigate, initialAgentId }: AiAgentsViewProps = {}) {
  const { user, isAdmin } = useAuth()
  const visibleAgents = isAdmin ? agentList : agentList.filter((a) => EMPLOYEE_AGENT_IDS.includes(a.id))
  const [activeAgentId, setActiveAgentId] = useState(initialAgentId ?? (isAdmin ? "wf01" : "wf02"))

  useEffect(() => {
    if (initialAgentId) setActiveAgentId(initialAgentId)
  }, [initialAgentId])

  // Quyá»n thay Ä‘á»•i sau khi auth táº£i xong â†’ Ä‘Æ°a vá» agent há»£p lá»‡
  useEffect(() => {
    if (!isAdmin && !EMPLOYEE_AGENT_IDS.includes(activeAgentId)) setActiveAgentId("wf02")
  }, [isAdmin, activeAgentId])

  // NhÃ£n ngÆ°á»i gá»­i theo tÃ i khoáº£n Ä‘ang Ä‘Äƒng nháº­p
  const userName = user?.employee?.fullName || user?.displayName || user?.email?.split("@")[0] || "Báº¡n"
  const nameParts = userName.trim().split(/\s+/).filter(Boolean)
  const userInitials =
    ((nameParts[0]?.[0] ?? "") + (nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] ?? "" : "")).toUpperCase() || "?"
  const userRoleLabel = isAdmin ? "Quáº£n trá»‹ viÃªn" : "NhÃ¢n viÃªn"
  // Ref Ä‘á»ƒ effect rehydrate Ä‘á»c nhÃ£n má»›i nháº¥t mÃ  khÃ´ng pháº£i cháº¡y láº¡i
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
      setSandboxE2EResult(e instanceof Error ? `Lá»—i: ${e.message}` : "Lá»—i: gá»i AI tháº¥t báº¡i")
    } finally {
      setSandboxE2ELoading(false)
    }
  }

  const simulatedPii = clientMaskPii(sandboxInput)
  const simulatedIntent = clientParseIntent(simulatedPii.maskedText)

  /** Q16(c) â€” commit messages vÃ o store (sá»‘ng qua Ä‘iá»u hÆ°á»›ng view) + state render */
  const commitMessages = (agentId: string, updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev[agentId] ?? [])
      patchChat<ChatMessage>(sessionKeyFor(agentId), { messages: next })
      return { ...prev, [agentId]: next }
    })
  }

  /** Q16(c) â€” rehydrate lá»‹ch sá»­ tá»« DB khi láº§n Ä‘áº§u má»Ÿ tab (store rá»—ng) */
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

  /** Q19(i1) â€” "PhiÃªn má»›i": Ä‘Ã³ng phiÃªn hiá»‡n táº¡i trÃªn server + xoÃ¡ tin nháº¯n local */
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

  // WF04 â€” báº£ng thÃ´ng bÃ¡o CSKH (chá»‰ Ä‘á»c): há»™i thoáº¡i + dá»¯ liá»‡u khÃ¡ch tá»« Slack
  const [cskhConversations, setCskhConversations] = useState<ConversationItem[]>([])
  const [cskhSelectedId, setCskhSelectedId] = useState<string | null>(null)
  const [cskhHistory, setCskhHistory] = useState<ChatHistoryMessage[]>([])
  const [cskhLoading, setCskhLoading] = useState(false)

  // CÃ¡c route giÃ¡m sÃ¡t chá»‰ dÃ nh cho admin â€” nhÃ¢n viÃªn khÃ´ng gá»i Ä‘á»ƒ trÃ¡nh 403 láº·p láº¡i
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

  // WF04: táº£i danh sÃ¡ch há»™i thoáº¡i CSKH khi má»Ÿ tab (poll 30s)
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

  // WF04: lá»‹ch sá»­ há»™i thoáº¡i cá»§a phiÃªn Ä‘ang chá»n (chá»‰ Ä‘á»c)
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

  // Äá»“ng há»“ Ä‘áº¿m ngÆ°á»£c thá»i gian chá» pháº£n há»“i AI + giai Ä‘oáº¡n pipeline Ä‘ang cháº¡y
  useEffect(() => {
    if (!isProcessing) return
    setWaitSeconds(0)
    const iv = setInterval(() => setWaitSeconds((s) => s + 1), 1000)
    return () => clearInterval(iv)
  }, [isProcessing])

  const waitStage =
    waitSeconds <= 4
      ? "Äang phÃ¢n loáº¡i cÃ¢u há»i & che giáº¥u dá»¯ liá»‡u cÃ¡ nhÃ¢nâ€¦"
      : waitSeconds <= 12
        ? `${activeAgent.name} Ä‘ang suy luáº­n vá»›i DeepSeekâ€¦`
        : waitSeconds <= 25
          ? "Äang tra cá»©u dá»¯ liá»‡u & chÃ­nh sÃ¡ch ná»™i bá»™â€¦"
          : "AI Ä‘ang xá»­ lÃ½ lÃ¢u hÆ¡n thÆ°á»ng lá»‡ â€” váº«n Ä‘ang chá» pháº£n há»“iâ€¦"

  const currentAgentPerf = agentPerf?.[activeAgentId as keyof AllAgentsPerf]
  const currentAccuracy = currentAgentPerf?.successRate != null ? `${currentAgentPerf.successRate}%` : '--'
  const currentCallCount = currentAgentPerf?.callCount ?? 0

  /** Kiá»ƒm tra káº¿t ná»‘i: tin "ping" â†’ Router tráº£ lá»i tÄ©nh, khÃ´ng gá»i LLM, khÃ´ng ghi lá»‹ch sá»­ chat */
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
      setPingError(e instanceof Error ? e.message : "KhÃ´ng gá»i Ä‘Æ°á»£c AI Agent.")
    } finally {
      setIsPinging(false)
    }
  }

  /** Cáº­p nháº­t 1 tin nháº¯n theo index (dÃ¹ng cho quiz ná»™p bÃ i xong) */
  const updateMessage = (index: number, patch: Partial<ChatMessage>) => {
    setMessages((prev) => {
      const list = [...(prev[activeAgentId] || [])]
      if (!list[index]) return prev
      list[index] = { ...list[index], ...patch }
      patchChat<ChatMessage>(sessionKeyFor(activeAgentId), { messages: list })
      return { ...prev, [activeAgentId]: list }
    })
  }

  /** Gá»­i 1 lÆ°á»£t chat (Ã´ nháº­p vÃ  chip bÃ i thi nhanh dÃ¹ng chung) */
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
        insight: `Xá»­ lÃ½ bá»Ÿi: ${routedTo}`,
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
        text: e instanceof Error ? e.message : "KhÃ´ng gá»i Ä‘Æ°á»£c AI Agent. Vui lÃ²ng thá»­ láº¡i.",
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
      {/* Sub-sidebar for Agents â€” danh sÃ¡ch WF + hoáº¡t Ä‘á»™ng */}
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
                    <span className="truncate text-body-sm font-semibold text-foreground">
                      {agent.name}
                    </span>
                    {isAdmin && (
                      <Badge variant={agent.badgeVariant} className="font-mono">
                        {agent.workflow}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-caption text-muted-foreground">
                    {agent.detail}
                  </p>
                  {isAdmin && (
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-caption text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full", perf ? "bg-success" : "bg-subtle-foreground")} />
                        <span className="truncate">{perf ? "Hoáº¡t Ä‘á»™ng" : "ChÆ°a cÃ³ dá»¯ liá»‡u"}</span>
                      </span>
                      {agent.id === "wf01" && (
                        <span className="flex items-center gap-1 tabular" title="Sá»‘ tin nháº¯n Router Ä‘Ã£ Ä‘á»‹nh tuyáº¿n">
                          <Shuffle className="size-3" />
                          {intentStats?.total ?? 0} lÆ°á»£t
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
                GiÃ¡m sÃ¡t trá»±c tiáº¿p
              </p>
              <p className="mt-1">Sá»‘ liá»‡u lÃ m má»›i tá»± Ä‘á»™ng má»—i 30 giÃ¢y.</p>
            </div>
          </div>
        )}
      </aside>

      {/* â”€â”€ WF01: Dashboard giÃ¡m sÃ¡t Router (khÃ´ng chat â€” WF01 lÃ  router) â”€â”€ */}
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
                  <span className={activeAgent.model ? "font-mono" : undefined}>{modelLabel(activeAgent)}</span> â€¢ {activeAgent.detail}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {liveLatency != null && !pingError && (
                <Badge variant="success" className="hidden sm:inline-flex">
                  <span className="size-1.5 rounded-full bg-success" />
                  Káº¿t ná»‘i OK
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePingTest}
                disabled={isPinging}
                className="gap-1.5"
                title="Kiá»ƒm tra káº¿t ná»‘i tá»›i AI (khÃ´ng ghi lá»‹ch sá»­ chat)"
              >
                {isPinging && <Loader2 className="size-3.5 animate-spin" />}
                {isPinging ? "Äang kiá»ƒm traâ€¦" : "Kiá»ƒm tra káº¿t ná»‘i"}
              </Button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:gap-6 xl:p-8">
            {/* Stat tiles â€” sá»‘ liá»‡u tháº­t tá»« DB (metadata error cá»§a aiChatMessage) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
              <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
                <p className="text-caption text-muted-foreground">Tá»· lá»‡ thÃ nh cÃ´ng</p>
                <p className="mt-1 text-h2 font-semibold text-foreground tabular">{currentAccuracy}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
                <p className="text-caption text-muted-foreground">Sá»‘ cuá»™c gá»i</p>
                <p className="mt-1 text-h2 font-semibold text-foreground tabular">{currentCallCount}</p>
              </div>
            </div>

            {pingError && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-tint p-3 text-body-sm text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span>Kiá»ƒm tra káº¿t ná»‘i tháº¥t báº¡i: {pingError}</span>
              </div>
            )}

            {/* Intent routing chart â€” WF01 */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-xs lg:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-muted-foreground" />
                  <h3 className="text-h3 font-semibold text-foreground">
                    Äá»‹nh tuyáº¿n Intent (Router WF01)
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
                        <p className="text-caption text-muted-foreground">Tá»•ng Ä‘Ã£ Ä‘á»‹nh tuyáº¿n</p>
                        <p className="mt-0.5 text-h3 font-semibold text-foreground tabular">{intentStats.total}</p>
                      </div>
                      <div className="rounded-md bg-sunken p-3">
                        <p className="text-caption text-muted-foreground">Escalation chuyá»ƒn ngÆ°á»i</p>
                        <p className="mt-0.5 text-h3 font-semibold text-foreground tabular">{intentStats.escalations}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-3" aria-label="Äang táº£i thá»‘ng kÃª intentâ€¦">
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

            {/* â”€â”€ Báº¢NG THÃ”NG BÃO & GIÃM SÃT ÄIá»€U PHá»I (WF01 GATEWAY) â”€â”€ */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-xs lg:p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-md bg-agent-wf01-tint text-agent-wf01">
                  <ShieldCheck className="size-4" />
                </div>
                <h3 className="text-h3 font-semibold text-foreground">
                  Kiá»ƒm thá»­ & nháº­t kÃ½ Router
                </h3>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="sandbox" className="mt-4 w-full">
                <TabsList className="overflow-x-auto">
                  <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
                  <TabsTrigger value="specs">ThÃ´ng sá»‘ ká»¹ thuáº­t</TabsTrigger>
                  <TabsTrigger value="audit">Audit</TabsTrigger>
                </TabsList>

                {/* Tab 1: Sandbox */}
                <TabsContent value="sandbox" className="mt-0 space-y-4 pt-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-body-sm font-medium text-foreground">
                        Ká»‹ch báº£n thá»­ nghiá»‡m máº«u
                      </label>
                      <span className="hidden text-caption text-muted-foreground sm:inline">
                        Báº¥m chá»n Ä‘á»ƒ náº¡p vÄƒn báº£n máº«u kiá»ƒm tra tá»©c thÃ¬
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
                      Ná»™i dung cáº§n phÃ¢n tÃ­ch & kiá»ƒm duyá»‡t PII
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
                        placeholder="Nháº­p cÃ¢u chat báº¥t ká»³ chá»©a SÄT, CCCD, Email Ä‘á»ƒ thá»­ nghiá»‡m bá»™ lá»c..."
                        className="min-h-[72px] flex-1 resize-none"
                      />
                      <Button
                        type="button"
                        onClick={handleSandboxE2E}
                        disabled={sandboxE2ELoading || !sandboxInput.trim()}
                        className="shrink-0 gap-1.5"
                        title="Gá»­i tháº­t qua Router â€” cÃ³ ghi vÃ o lá»‹ch sá»­ & thá»‘ng kÃª"
                      >
                        {sandboxE2ELoading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                        {sandboxE2ELoading ? "Äang gá»i AIâ€¦" : "Thá»­ gá»i E2E"}
                      </Button>
                    </div>
                  </div>

                  {/* Realtime Analysis Visualizer Cards â€” mÃ´ phá»ng regex/tá»« khÃ³a cá»§a Router ngay trÃªn trÃ¬nh duyá»‡t */}
                  <p className="text-caption text-muted-foreground">
                    Hai tháº» dÆ°á»›i Ä‘Ã¢y lÃ  <span className="font-medium text-foreground">mÃ´ phá»ng phÃ­a trÃ¬nh duyá»‡t</span>; káº¿t quáº£ tháº­t chá»‰ cÃ³ sau khi báº¥m &quot;Thá»­ gá»i E2E&quot;.
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Box 1: PII Sanitized Preview */}
                    <div className="space-y-2 rounded-lg border border-border bg-sunken p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-body-sm font-semibold text-foreground">
                          <Lock className="size-3.5 text-muted-foreground" />
                          1. Che giáº¥u PII
                        </span>
                        <Badge variant={simulatedPii.totalPii > 0 ? "success" : "outline"}>
                          {simulatedPii.totalPii > 0 ? <ShieldCheck /> : null}
                          {simulatedPii.totalPii > 0 ? `ÄÃ£ báº£o vá»‡ ${simulatedPii.totalPii} dá»¯ liá»‡u` : "An toÃ n (0 PII)"}
                        </Badge>
                      </div>
                      <div className="min-h-[4rem] rounded-md border border-border bg-card p-3 text-body-sm text-foreground">
                        {sandboxInput.trim() ? (
                          highlightMaskedTokens(simulatedPii.maskedText)
                        ) : (
                          <span className="text-muted-foreground">Nháº­p vÄƒn báº£n phÃ­a trÃªn Ä‘á»ƒ xem káº¿t quáº£ che giáº¥u...</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-caption text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-success" />
                          CCCD: <strong className="font-semibold text-foreground tabular">{simulatedPii.idCount}</strong>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-warning" />
                          SÄT: <strong className="font-semibold text-foreground tabular">{simulatedPii.phoneCount}</strong>
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
                          2. Äá»‹nh tuyáº¿n
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={simulatedIntent.badgeVariant} className="font-mono" title="MÃ´ phá»ng">
                            {simulatedIntent.intent}
                          </Badge>
                          {sandboxE2EIntent && (
                            <Badge
                              variant={sandboxE2EIntent === simulatedIntent.intent ? "success" : "warning"}
                              className="font-mono"
                              title="Intent tháº­t do server tráº£ vá»"
                            >
                              Server: {sandboxE2EIntent}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="min-h-[4rem] space-y-1.5 rounded-md border border-border bg-card p-3 text-body-sm">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="text-caption text-muted-foreground">ÄÃ­ch tiáº¿p nháº­n:</span>
                          <span className="font-semibold text-foreground">{simulatedIntent.targetAgent}</span>
                        </div>
                        <p className="text-caption text-muted-foreground">
                          <span className="font-medium text-foreground">Quy táº¯c nháº­n diá»‡n:</span> {simulatedIntent.matchedRule}
                        </p>
                        {simulatedIntent.action && (
                          <div className="mt-1 flex items-center gap-1.5 text-caption text-muted-foreground">
                            <Zap className="size-3.5 text-agent-wf03" />
                            <span>Action Ä‘Ã­nh kÃ¨m:</span>
                            <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-micro text-foreground">{simulatedIntent.action}</code>
                          </div>
                        )}
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Chá»‰ ná»™i dung Ä‘Ã£ che giáº¥u má»›i Ä‘Æ°á»£c chuyá»ƒn tá»›i agent tÆ°Æ¡ng á»©ng.
                      </p>
                    </div>
                  </div>

                  {/* E2E Response Box if available */}
                  {sandboxE2EResult && (
                    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-body-sm font-semibold text-foreground">
                          <Sparkles className="size-3.5 text-ai" />
                          Pháº£n há»“i thá»±c táº¿ tá»« AI Agent (E2E)
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
                      NguyÃªn lÃ½ an ninh dá»¯ liá»‡u & trung tÃ¢m Ä‘iá»u phá»‘i WF01
                    </p>
                    WF01 Ä‘Ã³ng vai trÃ² cá»•ng báº£o vá»‡ dá»¯ liá»‡u (Security Gateway) vÃ  bá»™ Ä‘iá»u hÆ°á»›ng trung tÃ¢m (Orchestrator).
                    Má»i truy váº¥n tá»« Portal, Mobile ESS vÃ  Slack Ä‘á»u báº¯t buá»™c Ä‘i qua bÆ°á»›c khá»­ dá»¯ liá»‡u cÃ¡ nhÃ¢n (Regex PII Sanitizer)
                    trÆ°á»›c khi gá»­i tá»›i mÃ´ hÃ¬nh AI (DeepSeek).
                  </div>

                  {/* Pipeline 4 bÆ°á»›c */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary-tint text-micro font-semibold text-primary">1</span>
                        Tiáº¿p nháº­n & xÃ¡c thá»±c
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Nháº­n cÃ¢u há»i vÃ  xÃ¡c thá»±c phiÃªn Ä‘Äƒng nháº­p cá»§a ngÆ°á»i dÃ¹ng.
                      </p>
                    </div>
                    <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary-tint text-micro font-semibold text-primary">2</span>
                        Regex PII Masking
                      </div>
                      <p className="text-caption text-muted-foreground">
                        QuÃ©t vÃ  thay tháº¿ tá»± Ä‘á»™ng CCCD, SÄT, Email báº±ng cÃ¡c token áº©n danh <code className="rounded-sm bg-muted px-1 font-mono text-micro text-foreground">[MASKED_*]</code>.
                      </p>
                    </div>
                    <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary-tint text-micro font-semibold text-primary">3</span>
                        PhÃ¢n loáº¡i Intent
                      </div>
                      <p className="text-caption text-muted-foreground">
                        PhÃ¢n tÃ­ch tá»« khÃ³a ngá»¯ nghÄ©a Ä‘á»ƒ Ä‘iá»u phá»‘i tá»›i WF02 (HR), WF03 (Training), WF04 (CSKH) hoáº·c WF01 tráº£ lá»i.
                      </p>
                    </div>
                    <div className="space-y-1.5 rounded-lg border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary-tint text-micro font-semibold text-primary">4</span>
                        Dispatch & Audit
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Chuyá»ƒn ná»™i dung Ä‘Ã£ che giáº¥u tá»›i agent xá»­ lÃ½, lÆ°u nháº­t kÃ½ audit.
                      </p>
                    </div>
                  </div>

                  {/* 3 Tháº» quy chuáº©n PII */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-body-sm font-semibold text-foreground">1. CMND / CÄƒn cÆ°á»›c (CCCD)</span>
                        <Badge variant="success" className="font-mono">[MASKED_ID]</Badge>
                      </div>
                      <div className="rounded-sm bg-muted p-2 font-mono text-caption text-secondary-foreground">
                        \b\d&#123;9&#125;\b|\b\d&#123;12&#125;\b
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Báº£o vá»‡ sá»‘ Ä‘á»‹nh danh cÃ¡ nhÃ¢n 9 sá»‘ (CMND cÅ©) hoáº·c 12 sá»‘ (CCCD gáº¯n chip) theo Nghá»‹ Ä‘á»‹nh 13/2023/NÄ-CP.
                      </p>
                    </div>

                    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-body-sm font-semibold text-foreground">2. Sá»‘ Ä‘iá»‡n thoáº¡i VN</span>
                        <Badge variant="warning" className="font-mono">[MASKED_PHONE]</Badge>
                      </div>
                      <div className="rounded-sm bg-muted p-2 font-mono text-caption text-secondary-foreground">
                        \b(0[35789]\d&#123;8&#125;|0\d&#123;9&#125;)\b
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Báº£o vá»‡ sá»‘ liÃªn láº¡c cÃ¡ nhÃ¢n cá»§a nhÃ¢n sá»± vÃ  khÃ¡ch hÃ ng. Tá»± Ä‘á»™ng nháº­n diá»‡n cÃ¡c Ä‘áº§u sá»‘ máº¡ng di Ä‘á»™ng VN.
                      </p>
                    </div>

                    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-body-sm font-semibold text-foreground">3. ThÆ° Ä‘iá»‡n tá»­ (Email)</span>
                        <Badge variant="info" className="font-mono">[MASKED_EMAIL]</Badge>
                      </div>
                      <div className="rounded-sm bg-muted p-2 font-mono text-caption text-secondary-foreground">
                        [\w.-]+@[\w.-]+\.\w+
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Báº£o vá»‡ Ä‘á»‹a chá»‰ há»™p thÆ° tá»• chá»©c vÃ  email cÃ¡ nhÃ¢n, ngÄƒn cháº·n rÃ² rá»‰ dá»¯ liá»‡u thÃ´ng tin liÃªn láº¡c ná»™i bá»™.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 3: Live Audit Logs */}
                <TabsContent value="audit" className="mt-0 space-y-3 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-body-sm font-semibold text-foreground">
                        Nháº­t kÃ½ dá»¯ liá»‡u sau kiá»ƒm duyá»‡t (Live Audit Trail)
                      </p>
                      <p className="mt-0.5 text-caption text-muted-foreground">
                        Dá»¯ liá»‡u tháº­t tá»« cÆ¡ sá»Ÿ dá»¯ liá»‡u (tá»‘i Ä‘a 10 tin nháº¯n gáº§n nháº¥t Ä‘Ã£ qua xá»­ lÃ½ PII)
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
                      LÃ m má»›i
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-border bg-card">
                    {auditLoading ? (
                      <div className="flex items-center justify-center gap-2 p-8 text-center text-body-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Äang táº£i nháº­t kÃ½ auditâ€¦
                      </div>
                    ) : auditItems.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 p-8 text-center">
                        <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <ShieldCheck className="size-5" />
                        </div>
                        <p className="text-body font-semibold text-foreground">ChÆ°a cÃ³ dá»¯ liá»‡u audit</p>
                        <p className="max-w-sm text-body-sm text-muted-foreground">
                          Gá»­i cÃ¢u há»i thá»­ nghiá»‡m Ä‘á»ƒ quan sÃ¡t nháº­t kÃ½ ghi nháº­n thá»i gian thá»±c.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[calc(100vh-28rem)] divide-y divide-border-subtle overflow-y-auto">
                        {auditItems.map((item) => {
                          const masked = auditMasked(item)
                          return (
                            <div key={item.id} className="space-y-1.5 p-3 text-body-sm transition-colors hover:bg-sunken">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={item.role === "user" ? "secondary" : item.role === "human" ? "info" : "ai"}
                                  >
                                    {item.role === "user" ? "KhÃ¡ch / NV" : item.role === "human" ? "ChuyÃªn viÃªn" : "AI Agent"}
                                  </Badge>
                                  <span className="font-mono text-caption text-muted-foreground">
                                    {item.session?.type ?? "OTHER"} â€¢ {item.session?.channel ?? "web"}
                                  </span>
                                </div>
                                <span className="text-caption text-muted-foreground tabular">
                                  {fmtDateTime(item.createdAt)}
                                </span>
                              </div>
                              <div className="text-foreground">
                                {masked ? highlightMaskedTokens(masked) : item.content}
                              </div>
                              {masked && (
                                <div className="flex items-center gap-1 text-caption text-success">
                                  <ShieldCheck className="size-3.5" />
                                  <span>ÄÃ£ qua PII Masking</span>
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
        /* â”€â”€ WF04: CSKH Agent â€” Báº£ng thÃ´ng bÃ¡o Slack & Tiáº¿p Quáº£n â”€â”€ */
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
                  <span className={activeAgent.model ? "font-mono" : undefined}>{modelLabel(activeAgent)}</span> â€¢ KÃªnh Slack/Zalo
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate?.("cskh-escalation")}
              className="gap-1.5"
              title="Má»Ÿ trang Tiáº¿p Quáº£n CSKH & PII Ä‘á»ƒ xá»­ lÃ½ khiáº¿u náº¡i"
            >
              <Headphones className="size-3.5" />
              Má»Ÿ tiáº¿p quáº£n CSKH
            </Button>
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:gap-6 xl:p-8">
            {/* Banner hÆ°á»›ng dáº«n WF04 */}
            <div className="flex items-start gap-3 rounded-lg border border-border bg-sunken p-4">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-agent-wf04-tint text-agent-wf04">
                <ShieldAlert className="size-4" />
              </div>
              <div className="text-body-sm text-muted-foreground">
                <p className="font-semibold text-foreground">
                  Báº£ng thÃ´ng bÃ¡o chá»‰ Ä‘á»c â€” kÃªnh CSKH ngoÃ i (Slack/Zalo)
                </p>
                <p className="mt-0.5">
                  KhÃ¡ch hÃ ng nháº¯n tin qua Slack/Zalo. Quáº£n trá»‹ viÃªn theo dÃµi há»™i thoáº¡i táº¡i Ä‘Ã¢y; khi khÃ¡ch cáº§n há»— trá»£ Ä‘áº·c biá»‡t (human takeover) hoáº·c báº­t láº¡i bot, nháº¥n &quot;Má»Ÿ tiáº¿p quáº£n CSKH&quot; á»Ÿ gÃ³c pháº£i phÃ­a trÃªn.
                </p>
              </div>
            </div>

            {/* Ná»™i dung: danh sÃ¡ch há»™i thoáº¡i + tÃ³m táº¯t + dá»¯ liá»‡u khÃ¡ch */}
            <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr] lg:gap-6">
              {/* Danh sÃ¡ch phiÃªn há»™i thoáº¡i */}
              <div className="flex max-h-[calc(100vh-16rem)] flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-xs">
                <p className="px-1 pb-1 text-body-sm font-semibold text-foreground">
                  Há»™i thoáº¡i <span className="font-normal text-muted-foreground tabular">({cskhConversations.length})</span>
                </p>
                {cskhConversations.length === 0 && (
                  <p className="p-2 text-body-sm text-muted-foreground">
                    ChÆ°a cÃ³ há»™i thoáº¡i â€” khi khÃ¡ch nháº¯n tin qua Slack/Zalo, phiÃªn sáº½ xuáº¥t hiá»‡n táº¡i Ä‘Ã¢y.
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
                          {c.externalId ?? "(khÃ¡ch áº©n danh)"}
                        </span>
                        <Badge variant={c.escalated ? "warning" : "success"} className="shrink-0">
                          <span className={cn("size-1.5 rounded-full", c.escalated ? "bg-warning" : "bg-success")} />
                          {c.escalated ? "ÄÃ£ escalate" : "Bot phá»¥c vá»¥"}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-caption text-muted-foreground">
                        {c.lastMessage ?? "--"}
                      </p>
                      <p className="mt-0.5 text-micro text-subtle-foreground tabular">
                        {c.messageCount} tin â€¢ {fmtDateTime(c.lastMessageAt)}
                      </p>
                    </button>
                  )
                })}
              </div>

              {/* Chi tiáº¿t: dá»¯ liá»‡u khÃ¡ch + tÃ³m táº¯t há»™i thoáº¡i */}
              <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
                <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
                  <h3 className="text-h3 font-semibold text-foreground">
                    Dá»¯ liá»‡u khÃ¡ch hÃ ng (tá»« Slack)
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-md bg-sunken p-3">
                      <p className="text-caption text-muted-foreground">Customer ID</p>
                      <p className="truncate font-mono text-body-sm font-semibold text-foreground">{cskhSelected?.externalId ?? "--"}</p>
                    </div>
                    <div className="rounded-md bg-sunken p-3">
                      <p className="text-caption text-muted-foreground">Sá»‘ tin nháº¯n</p>
                      <p className="text-body-sm font-semibold text-foreground tabular">{cskhSelected?.messageCount ?? 0}</p>
                    </div>
                    <div className="rounded-md bg-sunken p-3">
                      <p className="text-caption text-muted-foreground">Tráº¡ng thÃ¡i</p>
                      <p className={cn("flex items-center gap-1.5 text-body-sm font-semibold", cskhSelected ? (cskhSelected.escalated ? "text-warning" : "text-success") : "text-foreground")}>
                        {cskhSelected && <span className={cn("size-2 rounded-full", cskhSelected.escalated ? "bg-warning" : "bg-success")} />}
                        {cskhSelected ? (cskhSelected.escalated ? "Chá» nhÃ¢n viÃªn" : "Bot Ä‘ang phá»¥c vá»¥") : "--"}
                      </p>
                    </div>
                    <div className="rounded-md bg-sunken p-3">
                      <p className="text-caption text-muted-foreground">Hoáº¡t Ä‘á»™ng cuá»‘i</p>
                      <p className="text-body-sm font-semibold text-foreground tabular">{fmtDateTime(cskhSelected?.lastMessageAt ?? null)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-[12rem] flex-1 flex-col rounded-lg border border-border bg-card p-5 shadow-xs">
                  <h3 className="text-h3 font-semibold text-foreground">
                    TÃ³m táº¯t cuá»™c há»™i thoáº¡i (chá»‰ Ä‘á»c)
                  </h3>
                  <div className="mt-3 flex max-h-[calc(100vh-32rem)] flex-col gap-2.5 overflow-y-auto pr-1">
                    {cskhLoading ? (
                      <div className="flex flex-col gap-2.5" aria-label="Äang táº£i há»™i thoáº¡iâ€¦">
                        <div className="skeleton h-16 w-full rounded-md" />
                        <div className="skeleton h-16 w-full rounded-md" />
                      </div>
                    ) : cskhHistory.length === 0 ? (
                      <p className="text-body-sm text-muted-foreground">Chá»n má»™t phiÃªn á»Ÿ bÃªn trÃ¡i Ä‘á»ƒ xem ná»™i dung.</p>
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
                          <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-body-sm text-foreground">{m.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="mt-3 border-t border-border-subtle pt-3 text-caption text-muted-foreground">
                    WF04 lÃ  agent phá»¥c vá»¥ khÃ¡ch â€” admin khÃ´ng chat táº¡i Ä‘Ã¢y. Äá»ƒ <span className="font-medium text-foreground">tráº£ lá»i khÃ¡ch (human takeover)</span> hoáº·c báº­t láº¡i bot, má»Ÿ trang <span className="font-medium text-foreground">Tiáº¿p quáº£n CSKH</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* â”€â”€ WF02/03: Chat workspace â”€â”€ */
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
                  <span className={activeAgent.model ? "font-mono" : undefined}>{modelLabel(activeAgent)}</span> â€¢ Dá»¯ liá»‡u cÃ¡ nhÃ¢n Ä‘Æ°á»£c che giáº¥u trÆ°á»›c khi gá»­i tá»›i AI
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
                title="ÄÃ³ng phiÃªn hiá»‡n táº¡i vÃ  báº¯t Ä‘áº§u phiÃªn má»›i"
              >
                {hydrating && <Loader2 className="size-3.5 animate-spin" />}
                PhiÃªn má»›i
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
                  <p className="text-body font-semibold text-foreground">ChÆ°a cÃ³ tin nháº¯n nÃ o trong phiÃªn nÃ y</p>
                  <p className="max-w-sm text-body-sm text-muted-foreground">
                    Gá»­i cÃ¢u há»i Ä‘á»ƒ báº¯t Ä‘áº§u trÃ² chuyá»‡n vá»›i <span className="font-medium text-foreground">{activeAgent.name}</span>.
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
                      <span className="text-muted-foreground">Ä‘ang soáº¡n pháº£n há»“iâ€¦</span>
                    </div>
                    <div className="rounded-lg rounded-tl-sm border border-border bg-card px-3.5 py-3">
                      <div className="flex items-center gap-1" aria-label="Trá»£ lÃ½ Ä‘ang tráº£ lá»i">
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
            <div className="mx-auto w-full max-w-[720px] px-4 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
                className="flex flex-col gap-2"
              >
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  rows={2}
                  aria-label={`Gá»­i cÃ¢u há»i tá»›i ${activeAgent.name}`}
                  placeholder={`Gá»­i cÃ¢u há»i hoáº·c tÃ¬nh huá»‘ng tá»›i ${activeAgent.name}...`}
                  className="min-h-[64px] resize-none"
                  disabled={isProcessing}
                />
                <div className="flex items-end gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {/* â”€â”€ Quick Actions: chá»‰ hiá»‡n khi Ä‘ang á»Ÿ WF03 Training â”€â”€ */}
                    {activeAgentId === "wf03" && (
                      <>
                        <span className="flex items-center gap-1 text-caption text-muted-foreground">
                          <Play className="size-3 text-agent-wf03" />
                          BÃ i thi nhanh:
                        </span>
                        {[
                          {
                            label: "Xá»­ lÃ½ khiáº¿u náº¡i",
                            msg: "TÃ´i muá»‘n lÃ m bÃ i thi ká»¹ nÄƒng xá»­ lÃ½ tÃ¬nh huá»‘ng khiáº¿u náº¡i",
                            scenarioType: "customer_complaint",
                          },
                          {
                            label: "Giáº£i quyáº¿t mÃ¢u thuáº«n",
                            msg: "TÃ´i muá»‘n lÃ m bÃ i test giáº£i quyáº¿t mÃ¢u thuáº«n Ä‘á»“ng nghiá»‡p",
                            scenarioType: "colleague_conflict",
                          },
                          {
                            label: "Tiáº¿p nháº­n feedback",
                            msg: "TÃ´i muá»‘n lÃ m bÃ i kiá»ƒm tra ká»¹ nÄƒng tiáº¿p nháº­n pháº£n há»“i tá»« quáº£n lÃ½",
                            scenarioType: "manager_feedback",
                          },
                          {
                            label: "Onboarding",
                            msg: "TÃ´i muá»‘n lÃ m bÃ i thi kiáº¿n thá»©c onboarding nhÃ¢n viÃªn má»›i",
                            scenarioType: "new_employee_onboarding",
                          },
                          {
                            label: "ÄÃ¡nh giÃ¡ hiá»‡u suáº¥t",
                            msg: "TÃ´i muá»‘n lÃ m bÃ i thi ká»¹ nÄƒng Ä‘Ã¡nh giÃ¡ hiá»‡u suáº¥t lÃ m viá»‡c",
                            scenarioType: "performance_review",
                          },
                          {
                            label: "Role-play giao tiáº¿p",
                            msg: "Luyá»‡n táº­p tÃ¬nh huá»‘ng role-play ká»¹ nÄƒng giao tiáº¿p chuyÃªn nghiá»‡p vá»›i tÃ´i",
                            scenarioType: "general_communication",
                          },
                        ].map(({ label, msg, scenarioType }) => (
                          <button
                            key={label}
                            type="button"
                            disabled={isProcessing}
                            onClick={() => void sendChat(msg, scenarioType)}
                            className={cn(
                              badgeVariants({ variant: "secondary" }),
                              "h-7 cursor-pointer px-2.5 hover:bg-border disabled:pointer-events-none disabled:opacity-50"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    aria-label="Gá»­i tin nháº¯n"
                    disabled={!inputMessage.trim() || isProcessing}
                    className="size-9 shrink-0"
                  >
                    {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>
              </form>
              <p className="mt-2 text-center text-micro text-muted-foreground">
                CCCD, sá»‘ Ä‘iá»‡n thoáº¡i, email Ä‘Æ°á»£c tá»± Ä‘á»™ng che giáº¥u trÆ°á»›c khi gá»­i tá»›i AI â€” pháº£n há»“i cÃ³ thá»ƒ máº¥t 5â€“60s.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
