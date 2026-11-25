"use client"

import * as React from "react"
import { CircleCheck, CircleX, CircleHelp, PenLine, Sparkles, FileQuestion } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { TrainingAttemptItem } from "@/lib/schemas/training.schema"
import { cn } from "@/lib/utils"

// Key tiêu chí do WF03 trả trong criteria{} của từng câu tự luận
const ESSAY_CRITERIA = [
  ["chuyen_nghiep", "Chuyên nghiệp"],
  ["dong_cam", "Thấu cảm"],
  ["giai_quyet", "Giải quyết vấn đề"],
  ["ro_rang", "Rõ ràng"],
] as const

const fmt1 = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 })

function scoreTone(score: number) {
  return score >= 8 ? "text-success" : score >= 6.5 ? "text-warning" : "text-danger"
}

function McqItem({ index, item }: { index: number; item: TrainingAttemptItem }) {
  const ev = item.aiEvaluation
  const correct = item.isCorrect
  // Bản ghi cũ lưu correct_answer = null, đáp án chỉ có trong câu "Đáp án đúng là B."
  const answerInFeedback = ev?.feedback?.match(/Đáp án đúng(?: là)?\s*:?\s*([A-D])\b/i)?.[1]
  const correctAnswer = ev?.correct_answer?.trim() || answerInFeedback?.toUpperCase()
  const feedbackIsOnlyAnswer = !!ev?.feedback && /^\s*Đáp án đúng(?: là)?\s*:?\s*[A-D]\.?\s*$/i.test(ev.feedback)
  const Icon = correct === true ? CircleCheck : correct === false ? CircleX : CircleHelp

  return (
    <li className="flex gap-3 py-4">
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          correct === true ? "text-success" : correct === false ? "text-danger" : "text-muted-foreground",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-body text-foreground">
          <span className="font-semibold">Câu {index}.</span> {ev?.question || "Không lưu nội dung câu hỏi"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-body-sm">
          <span className="text-muted-foreground">Bạn chọn</span>
          <Badge variant={correct === true ? "success" : correct === false ? "destructive" : "secondary"} className="font-mono">
            {item.answer || "—"}
          </Badge>
          {correct === false && correctAnswer && (
            <>
              <span className="text-muted-foreground">· Đáp án đúng</span>
              <Badge variant="success" className="font-mono">{correctAnswer}</Badge>
            </>
          )}
          <span className="sr-only">{correct === true ? "Trả lời đúng" : correct === false ? "Trả lời sai" : "Chưa chấm"}</span>
        </div>
        {ev?.feedback && correct !== true && !feedbackIsOnlyAnswer && (
          <p className="mt-2 text-body-sm text-muted-foreground">{ev.feedback}</p>
        )}
      </div>
    </li>
  )
}

function EssayItem({ index, item }: { index: number; item: TrainingAttemptItem }) {
  const ev = item.aiEvaluation
  const score = typeof ev?.score === "number" ? ev.score : null
  const criteria = ev?.criteria ?? null

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-body text-foreground">
          <span className="font-semibold">Câu {index}.</span> {ev?.question || "Không lưu nội dung câu hỏi"}
        </p>
        <span className={cn("tabular shrink-0 text-body font-semibold", score !== null ? scoreTone(score) : "text-muted-foreground")}>
          {score !== null ? fmt1(score) : "--"}
          <span className="text-body-sm font-normal text-muted-foreground">/10</span>
        </span>
      </div>

      <div className="mt-3 rounded-md border border-border-subtle bg-sunken p-3">
        <p className="mb-1 flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
          <PenLine className="size-3.5" /> Bài làm của bạn
        </p>
        <p className="whitespace-pre-wrap break-words text-body-sm text-foreground">{item.answer || "Không có câu trả lời."}</p>
      </div>

      {criteria && (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ESSAY_CRITERIA.map(([key, label]) => {
            const v = criteria[key]
            return (
              <div key={key} className="rounded-md border border-border bg-card px-3 py-2">
                <dt className="truncate text-caption text-muted-foreground">{label}</dt>
                <dd className="tabular text-body-sm font-semibold text-foreground">
                  {typeof v === "number" ? `${fmt1(v)}/10` : "--"}
                </dd>
              </div>
            )
          })}
        </dl>
      )}

      {ev?.feedback && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-ai-tint p-3 text-body-sm text-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-ai" aria-hidden="true" />
          <p className="min-w-0">
            <span className="sr-only">Nhận xét của AI: </span>
            {ev.feedback}
          </p>
        </div>
      )}
    </li>
  )
}

export function SessionAttempts({ attempts }: { attempts: TrainingAttemptItem[] | undefined }) {
  const list = React.useMemo(() => {
    const items = [...(attempts ?? [])]
    // Thứ tự làm bài theo thời gian lưu; trắc nghiệm trước tự luận như đề gốc
    items.sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))
    const isEssay = (a: TrainingAttemptItem) => a.aiEvaluation?.type === "essay"
    return [...items.filter((a) => !isEssay(a)), ...items.filter(isEssay)]
  }, [attempts])

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileQuestion className="size-5" />
        </span>
        <p className="mt-3 text-body font-semibold text-foreground">Bài này không có chi tiết câu hỏi</p>
        <p className="mt-1 max-w-sm text-body-sm text-muted-foreground">
          Các bài làm trước khi hệ thống lưu từng câu chỉ có điểm tổng.
        </p>
      </div>
    )
  }

  const mcq = list.filter((a) => a.aiEvaluation?.type !== "essay")
  const essay = list.filter((a) => a.aiEvaluation?.type === "essay")
  const correctCount = mcq.filter((a) => a.isCorrect === true).length

  return (
    <div className="flex flex-col gap-6">
      {mcq.length > 0 && (
        <section aria-labelledby="mcq-heading">
          <div className="flex items-center justify-between gap-3">
            <h3 id="mcq-heading" className="text-body font-semibold text-foreground">Trắc nghiệm</h3>
            <Badge variant={correctCount === mcq.length ? "success" : "secondary"} className="tabular">
              Đúng {correctCount}/{mcq.length} câu
            </Badge>
          </div>
          <ol className="divide-y divide-border-subtle">
            {mcq.map((a, i) => <McqItem key={a.id} index={i + 1} item={a} />)}
          </ol>
        </section>
      )}
      {essay.length > 0 && (
        <section aria-labelledby="essay-heading" className={cn(mcq.length > 0 && "border-t border-border pt-6")}>
          <div className="flex items-center justify-between gap-3">
            <h3 id="essay-heading" className="text-body font-semibold text-foreground">Tự luận (AI chấm)</h3>
            <Badge variant="ai">{essay.length} câu</Badge>
          </div>
          <ol className="divide-y divide-border-subtle">
            {essay.map((a, i) => <EssayItem key={a.id} index={mcq.length + i + 1} item={a} />)}
          </ol>
        </section>
      )}
    </div>
  )
}
