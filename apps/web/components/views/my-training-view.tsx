"use client"

import * as React from "react"
import { Award, TrendingUp, Calendar, Sparkles, ClipboardCheck, Target, UserX, Play } from "lucide-react"
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { trainingApi } from '@/lib/api/training.api'
import type { TrainingSession } from '@/lib/schemas/training.schema'
import { cn, scenarioLabel } from '@/lib/utils'

const BENCHMARK = { professional: 8.0, empathy: 8.0, problemSolving: 8.0, clarity: 8.0 }
const AI_CRITERIA = [
  ["professional", "Chuyên nghiệp"],
  ["empathy", "Thấu cảm"],
  ["problemSolving", "Giải quyết vấn đề"],
  ["clarity", "Rõ ràng"],
] as const
// Màu thanh điểm theo thứ tự tiêu chí
const CRITERIA_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"] as const

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "var(--shadow-sm)",
  fontSize: 12,
  color: "var(--foreground)",
}

interface MyTrainingViewProps {
  onStartTraining?: () => void
}

export function MyTrainingView({ onStartTraining }: MyTrainingViewProps = {}) {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [selected, setSelected] = useState<TrainingSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const employeeId = user?.employee?.id
    if (!employeeId) {
      setLoading(false)
      return
    }
    const fetch = async () => {
      setLoading(true)
      try {
        const data = await trainingApi.getMySessions(employeeId)
        setSessions(data)
        if (data.length > 0) setSelected(data[0] ?? null)
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    fetch()
  }, [user])

  if (!user?.employee?.id) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <UserX className="size-5" />
        </span>
        <div>
          <h2 className="text-body font-semibold text-foreground">Tài khoản chưa liên kết hồ sơ nhân viên</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">Vui lòng liên hệ HR để gắn tài khoản của bạn với hồ sơ nhân sự.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Đang tải lịch sử...">
        <div className="skeleton h-8 w-64 rounded-md" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
          <div className="skeleton h-28 rounded-lg" />
          <div className="skeleton h-28 rounded-lg" />
          <div className="skeleton h-28 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="skeleton h-[340px] rounded-lg" />
          <div className="skeleton h-[340px] rounded-lg" />
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Award className="size-5" />
        </span>
        <div>
          <h2 className="text-body font-semibold text-foreground">Bạn chưa có lịch sử bài đào tạo nào</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">Hãy bắt đầu một bài đánh giá để xem kết quả tại đây.</p>
          {onStartTraining && (
            <Button className="mt-4" onClick={onStartTraining}>
              <Play className="size-4" /> Bắt đầu đánh giá
            </Button>
          )}
        </div>
      </div>
    )
  }

  const fallbackScore = selected?.aiScore?.essay_avg ?? 0
  const radarData = [
    {
      subject: "Chuyên nghiệp",
      "Của bạn": selected?.aiScore?.professional ?? fallbackScore,
      "Chuẩn công ty": BENCHMARK.professional,
    },
    {
      subject: "Thấu cảm",
      "Của bạn": selected?.aiScore?.empathy ?? fallbackScore,
      "Chuẩn công ty": BENCHMARK.empathy,
    },
    {
      subject: "Giải pháp",
      "Của bạn": selected?.aiScore?.problemSolving ?? fallbackScore,
      "Chuẩn công ty": BENCHMARK.problemSolving,
    },
    {
      subject: "Rõ ràng",
      "Của bạn": selected?.aiScore?.clarity ?? fallbackScore,
      "Chuẩn công ty": BENCHMARK.clarity,
    },
  ]

  const avgAiScore = selected?.aiScore
    ? (
        ((selected.aiScore.professional ?? fallbackScore) +
          (selected.aiScore.empathy ?? fallbackScore) +
          (selected.aiScore.problemSolving ?? fallbackScore) +
          (selected.aiScore.clarity ?? fallbackScore)) /
        4
      ).toFixed(1).replace(".", ",")
    : "0,0"

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-semibold text-foreground">Kết quả đào tạo của tôi</h1>
          <p className="mt-1 text-body text-muted-foreground">
            Theo dõi tiến bộ kỹ năng qua các lần đánh giá kết hợp (trắc nghiệm + AI chấm tự luận)
          </p>
        </div>
        {onStartTraining && (
          <Button variant="outline" onClick={onStartTraining}>
            <Play className="size-4" /> Bắt đầu đánh giá mới
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6">
        <Card>
          <CardContent className="flex items-start gap-3 p-4 pt-4 sm:p-5 sm:pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
              <ClipboardCheck className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-body-sm text-muted-foreground">Lần đánh giá</p>
              <p className="tabular mt-1 text-h1 font-semibold text-foreground">{sessions.filter((s) => s.status === "GRADED").length}</p>
              <p className="mt-0.5 text-caption text-muted-foreground">bài đã chấm điểm</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-4 pt-4 sm:p-5 sm:pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-success-tint text-success">
              <Target className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-body-sm text-muted-foreground">Điểm tổng (lần đang xem)</p>
              <p className="tabular mt-1 text-h1 font-semibold text-foreground">
                {selected?.totalScore ?? "--"}
                <span className="text-body font-normal text-muted-foreground">/100</span>
              </p>
              <p className="mt-0.5 text-caption text-muted-foreground">Quiz 50% + AI 50%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 p-4 pt-4 sm:p-5 sm:pt-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ai-tint text-ai">
              <Sparkles className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-body-sm text-muted-foreground">Điểm kỹ năng AI</p>
              <p className="tabular mt-1 text-h1 font-semibold text-foreground">
                {avgAiScore}
                <span className="text-body font-normal text-muted-foreground">/10</span>
              </p>
              <p className="mt-0.5 text-caption text-muted-foreground">trung bình 4 tiêu chí</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Radar Chart */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary-tint text-primary">
                <TrendingUp className="size-4" />
              </span>
              Biểu đồ năng lực 4 tiêu chí
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--chart-grid)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <Radar
                  name="Chuẩn công ty"
                  dataKey="Chuẩn công ty"
                  stroke="var(--muted-foreground)"
                  fill="none"
                  fillOpacity={0}
                  strokeDasharray="4 4"
                />
                <Radar
                  name="Của bạn"
                  dataKey="Của bạn"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="var(--chart-1)"
                  fillOpacity={0.12}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center justify-center gap-4 text-caption text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-chart-1" />
                Của bạn
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 border-t-2 border-dashed border-muted-foreground" />
                Chuẩn công ty
              </span>
            </div>
          </CardContent>
        </Card>

        {/* AI Comment */}
        <Card className="flex min-w-0 flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-ai-tint text-ai">
                <Sparkles className="size-4" />
              </span>
              Nhận xét từ AI
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="flex flex-col gap-3">
              {/* Chỉ 4 tiêu chí cố định — aiScore còn chứa field phụ (vd essay_avg) không có nhãn */}
              {selected?.aiScore && AI_CRITERIA.map(([key, label], idx) => {
                const val = (selected.aiScore as Record<string, unknown>)[key]
                const numVal = typeof val === 'number' ? val : 0
                return (
                  <div key={key}>
                    <div className="mb-1.5 flex justify-between text-body-sm">
                      <span className="text-secondary-foreground">{label}</span>
                      <span className="tabular font-semibold text-foreground">{numVal}/10</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(numVal / 10) * 100}%`, background: CRITERIA_COLORS[idx] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            {selected?.aiFeedback && (
              <div className="mt-auto rounded-md border border-border bg-sunken p-3">
                <p className="text-body-sm italic text-secondary-foreground">&ldquo;{selected.aiFeedback}&rdquo;</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card className="min-w-0">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary-tint text-primary">
              <Calendar className="size-4" />
            </span>
            Lịch sử đánh giá
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead className="text-right">Điểm quiz</TableHead>
                <TableHead className="text-right">Điểm AI</TableHead>
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((item) => (
                <TableRow
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected?.id === item.id}
                  onClick={() => setSelected(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelected(item)
                    }
                  }}
                  className={cn(
                    "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                    selected?.id === item.id && "bg-primary-tint hover:bg-primary-tint"
                  )}
                >
                  <TableCell className="tabular text-body-sm text-secondary-foreground">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    }) : "--"}
                  </TableCell>
                  <TableCell className="text-body-sm font-medium text-foreground">{scenarioLabel(item.scenario)}</TableCell>
                  <TableCell className="tabular text-right text-body-sm text-foreground">
                    {Math.round(((item.quizScore ?? 0) * 0.5) * 10) / 10}/50
                  </TableCell>
                  <TableCell className="tabular text-right text-body-sm text-foreground">
                    {item.aiScore
                      ? (
                          ((item.aiScore.professional ?? item.aiScore.essay_avg ?? 0) +
                            (item.aiScore.empathy ?? item.aiScore.essay_avg ?? 0) +
                            (item.aiScore.problemSolving ?? item.aiScore.essay_avg ?? 0) +
                            (item.aiScore.clarity ?? item.aiScore.essay_avg ?? 0)) /
                          4
                        ).toFixed(1).replace(".", ",")
                      : "0,0"}
                    /10
                  </TableCell>
                  <TableCell
                    className={cn(
                      "tabular text-right text-body-sm font-semibold",
                      (item.totalScore ?? 0) >= 80 ? "text-success" : (item.totalScore ?? 0) >= 65 ? "text-warning" : "text-danger"
                    )}
                  >
                    {item.totalScore ?? 0}/100
                  </TableCell>
                  <TableCell>
                    {item.status === "GRADED" ? (
                      <Badge variant="success"><span className="size-1.5 rounded-full bg-success" />Đã chấm</Badge>
                    ) : item.status === "COMPLETED" ? (
                      <Badge variant="info"><span className="size-1.5 rounded-full bg-info" />Hoàn thành</Badge>
                    ) : (
                      <Badge variant="secondary"><span className="size-1.5 rounded-full bg-muted-foreground" />Đang làm</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
