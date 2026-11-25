"use client"

import * as React from "react"
import {
  Sparkles,
  CheckCircle2,
  PenLine,
  Target,
  Trophy,
  Building2,
  Radar as RadarIcon,
  XCircle,
  MessageSquareQuote,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { useEffect, useState } from 'react'
import { trainingApi } from '@/lib/api/training.api'
import type { TrainingAnalytics, AnalyticsSession } from '@/lib/schemas/training.schema'
import { currentMonthYearVN } from '@/lib/utils'

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "var(--shadow-sm)",
  fontSize: 12,
  color: "var(--foreground)",
}

// 4 tiêu chí AI cho bảng xếp hạng & modal chi tiết
const AI_CRITERIA = [
  ["professional", "Chuyên nghiệp", "CN", "var(--chart-1)"],
  ["empathy", "Thấu cảm", "TC", "var(--chart-2)"],
  ["problemSolving", "Giải pháp", "GP", "var(--chart-3)"],
  ["clarity", "Rõ ràng", "RR", "var(--chart-4)"],
] as const

const SCENARIO_LABEL: Record<string, string> = {
  CUSTOMER_COMPLAINT: "Xử lý khiếu nại khách hàng",
  COLLEAGUE_CONFLICT: "Giải quyết xung đột đồng nghiệp",
  MANAGER_FEEDBACK: "Phản hồi với quản lý",
  NEW_EMPLOYEE_ONBOARDING: "Hội nhập nhân viên mới",
  PERFORMANCE_REVIEW: "Đánh giá hiệu suất",
  GENERAL_COMMUNICATION: "Giao tiếp nội bộ",
}

function getCritScore(ai: AnalyticsSession["aiScore"], key: string): number {
  if (!ai) return 0
  const raw =
    key === "problemSolving"
      ? (ai.problemSolving ?? (ai as Record<string, unknown>).problem_solving ?? ai.essay_avg ?? 0)
      : ((ai as Record<string, unknown>)[key] ?? ai.essay_avg ?? 0)
  return typeof raw === "number" ? Math.round(raw * 10) / 10 : 0
}

export function TrainingAnalyticsView() {
  const [analytics, setAnalytics] = useState<TrainingAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<AnalyticsSession | null>(null)
  const now = currentMonthYearVN()

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      try {
        const data = await trainingApi.getAnalytics(now.month, now.year)
        setAnalytics(data)
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Đang tải báo cáo...">
        <div className="skeleton h-8 w-72 rounded-md" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="skeleton h-[400px] rounded-lg lg:col-span-2" />
          <div className="flex flex-col gap-4">
            <div className="skeleton h-28 rounded-lg" />
            <div className="skeleton h-28 rounded-lg" />
            <div className="skeleton h-28 rounded-lg" />
          </div>
        </div>
        <div className="skeleton h-72 rounded-lg" />
      </div>
    )
  }

  const radarData = analytics?.radarData ?? []
  const sessions: AnalyticsSession[] = analytics?.sessions ?? []

  // Calculate KPIs
  const totalSessions = sessions.length
  const completedSessions = sessions.filter((s) => s.status === 'GRADED' || s.status === 'COMPLETED').length
  const passRate = totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1).replace(".", ",") : "0,0"

  let avgAiScore = 0
  const gradedSessions = sessions.filter((s) => (s.status === 'GRADED' || s.status === 'COMPLETED') && s.totalScore !== null && s.totalScore !== undefined)
  if (gradedSessions.length > 0) {
    const totalAiScore = gradedSessions.reduce((sum, s) => {
      const quizPart = (s.quizScore ?? 0) * 0.5
      const aiPart = Math.max(0, (s.totalScore ?? 0) - quizPart)
      return sum + aiPart
    }, 0)
    avgAiScore = totalAiScore / gradedSessions.length
  }

  // Đề xuất đào tạo: tiêu chí có khoảng cách so với chuẩn lớn nhất (từ dữ liệu thật)
  const weakest = radarData.length > 0
    ? radarData.reduce((worst, item) => ((item.benchmark - item.actual) > (worst.benchmark - worst.actual) ? item : worst), radarData[0]!)
    : null

  // Hiển thị: bài đã có tổng điểm xếp trước theo điểm giảm dần, bài chưa xong xếp cuối
  const isScored = (s: AnalyticsSession) =>
    (s.status === 'GRADED' || s.status === 'COMPLETED') && s.totalScore !== null && s.totalScore !== undefined
  const ranked = [...sessions].sort((a, b) => {
    const sa = isScored(a) ? (a.totalScore ?? 0) : -1
    const sb = isScored(b) ? (b.totalScore ?? 0) : -1
    return sb - sa
  })

  // Điểm tổng TB theo phòng ban (từ các bài đã chấm trong kỳ)
  const deptMap = new Map<string, { sum: number; count: number }>()
  for (const s of gradedSessions) {
    const name = s.employee?.department?.name ?? 'Chưa phân bổ'
    const cur = deptMap.get(name) ?? { sum: 0, count: 0 }
    cur.sum += s.totalScore ?? 0
    cur.count += 1
    deptMap.set(name, cur)
  }
  const deptData = Array.from(deptMap.entries()).map(([department, v]) => ({
    department,
    score: Math.round((v.sum / v.count) * 10) / 10,
  }))

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 font-semibold text-foreground">
              Báo cáo năng lực đào tạo & radar 4 tiêu chí
            </h1>
            <Badge variant="ai">
              <Sparkles className="size-3" />
              Mô hình đánh giá kết hợp
            </Badge>
          </div>
          <p className="mt-1 text-body text-muted-foreground">
            Đánh giá kết hợp: 5 câu trắc nghiệm nội quy (chấm tự động theo đáp án) + 2 câu tự luận tình huống (AI chấm)
          </p>
        </div>
      </div>

      {/* Row 1: Radar Chart & Metrics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Radar Chart (Spider Chart) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-ai-tint text-ai">
                <RadarIcon className="size-4" />
              </span>
              Ma trận năng lực mềm 4 cánh
            </CardTitle>
            <CardDescription>
              So sánh điểm trung bình đợt đánh giá tháng {now.month}/{now.year} với chuẩn năng lực công ty
            </CardDescription>
          </CardHeader>
          <CardContent>
            {radarData.length === 0 || totalSessions === 0 ? (
              <div className="flex h-[320px] flex-col items-center justify-center gap-3 text-center">
                <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <RadarIcon className="size-5" />
                </span>
                <div>
                  <p className="text-body font-semibold text-foreground">Chưa có dữ liệu đánh giá trong tháng</p>
                  <p className="mt-1 text-body-sm text-muted-foreground">
                    Biểu đồ radar sẽ hiển thị khi có bài đánh giá được chấm trong kỳ.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-[320px] w-full items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="75%">
                    <PolarGrid stroke="var(--chart-grid)" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 10]}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      axisLine={false}
                    />
                    <Radar
                      name="Chuẩn công ty"
                      dataKey="benchmark"
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 4"
                      fill="none"
                      fillOpacity={0}
                    />
                    <Radar
                      name="Thực tế đợt này"
                      dataKey="actual"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="var(--chart-1)"
                      fillOpacity={0.12}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, paddingTop: 10, color: "var(--muted-foreground)" }}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evaluation Summary Cards */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex items-start gap-3 p-4 pt-4 sm:p-5 sm:pt-5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-success-tint text-success">
                <CheckCircle2 className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-body-sm text-muted-foreground">Tỷ lệ hoàn thành</p>
                <div className="tabular mt-1 text-h1 font-semibold text-foreground">{passRate}%</div>
                <p className="mt-1 text-caption text-muted-foreground">
                  {completedSessions}/{totalSessions} bài đánh giá trong tháng đã nộp hoặc đã chấm xong
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-3 p-4 pt-4 sm:p-5 sm:pt-5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-ai-tint text-ai">
                <PenLine className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-body-sm text-muted-foreground">Điểm tự luận tình huống TB</p>
                <div className="tabular mt-1 text-h1 font-semibold text-foreground">
                  {avgAiScore.toFixed(1).replace(".", ",")}
                  <span className="text-body font-normal text-muted-foreground"> / 50</span>
                </div>
                <p className="mt-1 text-caption text-muted-foreground">
                  AI chấm điểm theo 4 tiêu chí: Chuyên nghiệp, Thấu cảm, Giải pháp, Rõ ràng
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-3 p-4 pt-4 sm:p-5 sm:pt-5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-warning-tint text-warning">
                <Target className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-body-sm text-muted-foreground">Đề xuất đào tạo thêm</p>
                {weakest ? (
                  <>
                    <p className="mt-1 text-body font-semibold text-foreground">{weakest.subject}</p>
                    <p className="mt-1 text-caption text-muted-foreground">
                      Khoảng cách so với chuẩn lớn nhất: <span className="tabular">{weakest.actual}/{weakest.benchmark}</span> điểm — tính tự động từ dữ liệu kỳ này.
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-caption text-muted-foreground">
                    Chưa đủ dữ liệu AI Score trong kỳ để đưa ra đề xuất.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 2: Leaderboard & department chart */}
      <div className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary-tint text-primary">
                <Trophy className="size-4" />
              </span>
              Bảng xếp hạng kết quả đánh giá tổng hợp
            </CardTitle>
            <CardDescription>
              Điểm trắc nghiệm nội quy (50%) + điểm tự luận xử lý tình huống AI (50%) · Nhấn vào dòng để xem chi tiết bài thi & nhận xét AI
            </CardDescription>
          </CardHeader>
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Học viên</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Trắc nghiệm</TableHead>
                <TableHead className="text-right">Tự luận AI</TableHead>
                <TableHead className="text-right">Tổng điểm</TableHead>
                <TableHead>Tiêu chí AI (thang 10)</TableHead>
                <TableHead>Nhận xét từ AI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranked.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-8 text-center text-body-sm text-muted-foreground">
                    Chưa có dữ liệu đào tạo trong tháng này
                  </TableCell>
                </TableRow>
              ) : (
                ranked.map((item, idx) => {
                  const quizPart = Math.round(((item.quizScore ?? 0) * 0.5) * 10) / 10;
                  const aiScoreVal = Math.max(0, Math.round(((item.totalScore ?? 0) - quizPart) * 10) / 10);
                  // Bài chưa làm xong: hiện "--" thay vì 0 điểm gây hiểu nhầm
                  const finished = item.status === 'GRADED' || item.status === 'COMPLETED'
                  const hasQuiz = finished && item.quizScore !== null && item.quizScore !== undefined
                  const hasTotal = finished && item.totalScore !== null && item.totalScore !== undefined
                  const ai = item.aiScore
                  return (
                    <TableRow
                      key={item.id}
                      onClick={() => setSelectedSession(item)}
                      className="cursor-pointer transition-colors hover:bg-muted/60"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setSelectedSession(item)
                        }
                      }}
                    >
                      <TableCell className="tabular text-center text-body-sm font-semibold text-muted-foreground">
                        {hasTotal ? idx + 1 : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            initials={(item.employee?.fullName ?? 'HV').split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase()}
                            className="bg-primary-tint text-accent-foreground"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-body-sm font-medium text-foreground">{item.employee?.fullName || 'Học viên'}</p>
                            <p className="truncate text-caption text-muted-foreground">
                              <span className="font-mono">{item.employee?.employeeCode}</span> · {item.employee?.department?.name ?? '—'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.status === 'GRADED' ? (
                          <Badge variant="success"><span className="size-1.5 rounded-full bg-success" />Đã chấm</Badge>
                        ) : item.status === 'COMPLETED' ? (
                          <Badge variant="info"><span className="size-1.5 rounded-full bg-info" />Hoàn thành</Badge>
                        ) : (
                          <Badge variant="secondary"><span className="size-1.5 rounded-full bg-muted-foreground" />Đang làm</Badge>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right text-body-sm text-foreground">{hasQuiz ? `${quizPart}/50` : '--'}</TableCell>
                      <TableCell className="tabular text-right text-body-sm text-foreground">{hasTotal ? `${aiScoreVal}/50` : '--'}</TableCell>
                      <TableCell className="tabular text-right text-body-sm font-semibold text-foreground">
                        {hasTotal ? `${item.totalScore} / 100` : '--'}
                      </TableCell>
                      <TableCell>
                        {ai ? (
                          <div className="grid grid-cols-2 gap-1.5 w-44">
                            {AI_CRITERIA.map(([key, label, shortLabel, color]) => {
                              const v = getCritScore(ai, key)
                              return (
                                <span
                                  key={key}
                                  title={`${label}: ${v}/10`}
                                  className="inline-flex items-center justify-between gap-1.5 rounded-md border border-border-subtle bg-sunken px-2 py-0.5 text-caption"
                                >
                                  <span className="flex items-center gap-1 text-muted-foreground">
                                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
                                    {shortLabel}
                                  </span>
                                  <span className="tabular font-semibold text-foreground">{v}/10</span>
                                </span>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="text-body-sm text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="line-clamp-2 text-body-sm text-muted-foreground">
                            {item.aiFeedback ? `"${item.aiFeedback}"` : "--"}
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border-subtle px-5 py-3 text-caption text-muted-foreground sm:px-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {AI_CRITERIA.map(([key, label, shortLabel, color]) => (
                <span key={key} className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full" style={{ background: color }} />
                  <strong className="font-medium text-foreground">{shortLabel}:</strong> {label}
                </span>
              ))}
            </div>
            <span className="text-micro text-muted-foreground">Nhấn vào từng học viên để xem toàn bộ bài làm & nhận xét</span>
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary-tint text-primary">
                <Building2 className="size-4" />
              </span>
              Điểm TB theo phòng ban
            </CardTitle>
            <CardDescription>Điểm tổng trung bình các bài đã chấm trong kỳ</CardDescription>
          </CardHeader>
          <CardContent>
            {deptData.length === 0 ? (
              <div className="flex h-[280px] flex-col items-center justify-center gap-3 text-center">
                <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Building2 className="size-5" />
                </span>
                <p className="text-body-sm text-muted-foreground">Chưa có bài đã chấm trong kỳ</p>
              </div>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis
                      dataKey="department"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: "var(--muted)" }}
                      formatter={(v) => [`${v} / 100`, "Điểm TB"]}
                    />
                    <Bar dataKey="score" name="Điểm TB" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(selectedSession)}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(null)
        }}
        className="max-w-3xl"
      >
        {selectedSession && (() => {
          const hasQuiz = selectedSession.quizScore !== null && selectedSession.quizScore !== undefined
          const hasTotal = selectedSession.totalScore !== null && selectedSession.totalScore !== undefined
          const quizPart = hasQuiz ? Math.round(((selectedSession.quizScore ?? 0) * 0.5) * 10) / 10 : 0
          const aiScoreVal = hasTotal ? Math.max(0, Math.round(((selectedSession.totalScore ?? 0) - quizPart) * 10) / 10) : 0
          const ai = selectedSession.aiScore ?? null
          const scenarioKey = selectedSession.scenario ?? ''
          const scenarioTitle = SCENARIO_LABEL[scenarioKey] ?? (scenarioKey || 'Bài tập huấn')
          const attempts = selectedSession.attempts ?? []
          const submittedTime = selectedSession.completedAt || selectedSession.createdAt

          return (
            <div className="flex flex-col gap-5">
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-medium">
                    {scenarioTitle}
                  </Badge>
                  {selectedSession.status === 'GRADED' ? (
                    <Badge variant="success"><span className="size-1.5 rounded-full bg-success" />Đã chấm</Badge>
                  ) : selectedSession.status === 'COMPLETED' ? (
                    <Badge variant="info"><span className="size-1.5 rounded-full bg-info" />Hoàn thành</Badge>
                  ) : (
                    <Badge variant="secondary"><span className="size-1.5 rounded-full bg-muted-foreground" />Đang làm</Badge>
                  )}
                  {submittedTime && (
                    <span className="text-caption text-muted-foreground">
                      Nộp lúc {new Date(submittedTime).toLocaleString('vi-VN')}
                    </span>
                  )}
                </div>
                <DialogTitle className="mt-1">
                  {selectedSession.employee?.fullName || 'Học viên'}
                </DialogTitle>
                <DialogDescription>
                  Mã NV: <span className="font-mono font-medium text-foreground">{selectedSession.employee?.employeeCode ?? '—'}</span>
                  {' · '}Phòng ban: <span className="font-medium text-foreground">{selectedSession.employee?.department?.name ?? '—'}</span>
                </DialogDescription>
              </DialogHeader>

              {/* Tóm tắt điểm số */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border-subtle bg-sunken p-3.5">
                  <p className="text-caption text-muted-foreground">Trắc nghiệm (50%)</p>
                  <p className="mt-1 tabular text-h3 font-semibold text-foreground">
                    {hasQuiz ? `${quizPart} / 50` : '--'}
                  </p>
                  {hasQuiz && (
                    <p className="text-micro text-muted-foreground">Đúng {selectedSession.quizScore}% bộ câu hỏi</p>
                  )}
                </div>
                <div className="rounded-lg border border-border-subtle bg-sunken p-3.5">
                  <p className="text-caption text-muted-foreground">Tự luận AI (50%)</p>
                  <p className="mt-1 tabular text-h3 font-semibold text-primary">
                    {hasTotal ? `${aiScoreVal} / 50` : '--'}
                  </p>
                  <p className="text-micro text-muted-foreground">Chấm theo 4 tiêu chí AI</p>
                </div>
                <div className="rounded-lg border border-primary/25 bg-primary-tint/40 p-3.5">
                  <p className="text-caption font-medium text-primary">Tổng điểm toàn bài</p>
                  <p className="mt-1 tabular text-h2 font-bold text-foreground">
                    {hasTotal ? `${selectedSession.totalScore} / 100` : '--'}
                  </p>
                  <p className="text-micro text-muted-foreground">
                    {(selectedSession.totalScore ?? 0) >= 80
                      ? 'Xuất sắc'
                      : (selectedSession.totalScore ?? 0) >= 65
                        ? 'Đạt yêu cầu'
                        : 'Cần cải thiện'}
                  </p>
                </div>
              </div>

              {/* Chi tiết 4 tiêu chí AI */}
              <div className="rounded-lg border border-border-subtle bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                    <Sparkles className="size-4 text-primary" />
                    Đánh giá 4 tiêu chí AI (Thang điểm 10)
                  </h3>
                  <span className="text-caption text-muted-foreground">Trung bình các câu tự luận</span>
                </div>
                {ai ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {AI_CRITERIA.map(([key, label, shortLabel, color]) => {
                      const val = getCritScore(ai, key)
                      const pct = Math.min(100, Math.max(0, val * 10))
                      return (
                        <div key={key} className="rounded-md border border-border-subtle bg-sunken p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-body-sm font-medium text-foreground">
                              <span className="size-2.5 rounded-full" style={{ background: color }} />
                              {label} <span className="text-caption text-muted-foreground">({shortLabel})</span>
                            </span>
                            <span className="tabular rounded-md bg-card px-2 py-0.5 text-body-sm font-semibold text-foreground shadow-2xs">
                              {val} / 10
                            </span>
                          </div>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: color }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-body-sm text-muted-foreground">Chưa có điểm tiêu chí AI cho phiên làm bài này.</p>
                )}
              </div>

              {/* Nhận xét tổng quan từ AI */}
              <div className="rounded-lg border border-primary/20 bg-primary-tint/30 p-4">
                <h3 className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                  <MessageSquareQuote className="size-4 text-primary" />
                  Nhận xét tổng hợp từ AI
                </h3>
                <p className="mt-2 whitespace-pre-line text-body-sm leading-relaxed text-foreground">
                  {selectedSession.aiFeedback || 'Chưa có nhận xét từ hệ thống AI.'}
                </p>
              </div>

              {/* Danh sách câu trả lời chi tiết */}
              {attempts.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="text-body-sm font-semibold text-foreground">
                    Chi tiết từng câu trả lời ({attempts.length} câu)
                  </h3>
                  <div className="flex flex-col gap-3">
                    {attempts.map((att, idx) => {
                      const evalData = att.aiEvaluation
                      const isEssay = evalData?.type === 'essay' || att.isCorrect === null
                      const crit = evalData?.criteria
                      return (
                        <div key={att.id} className="rounded-lg border border-border-subtle bg-sunken p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex size-6 items-center justify-center rounded-full bg-card text-caption font-semibold text-foreground border border-border-subtle">
                                {idx + 1}
                              </span>
                              <Badge variant={isEssay ? 'info' : 'secondary'}>
                                {isEssay ? 'Tự luận AI' : 'Trắc nghiệm'}
                              </Badge>
                            </div>
                            {isEssay ? (
                              evalData?.score !== null && evalData?.score !== undefined && (
                                <Badge variant="outline" className="tabular font-semibold">
                                  Điểm AI: {evalData.score} / 10
                                </Badge>
                              )
                            ) : att.isCorrect ? (
                              <Badge variant="success" className="gap-1">
                                <CheckCircle2 className="size-3.5" /> Chính xác
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="size-3.5" /> Chưa đúng
                              </Badge>
                            )}
                          </div>

                          {evalData?.question && (
                            <p className="mt-2.5 text-body-sm font-medium text-foreground">
                              {evalData.question}
                            </p>
                          )}

                          <div className="mt-2 rounded-md border border-border-subtle bg-card p-3">
                            <p className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
                              Câu trả lời của học viên
                            </p>
                            <p className="mt-1 whitespace-pre-line text-body-sm text-foreground">
                              {att.answer || '—'}
                            </p>
                          </div>

                          {!isEssay && !att.isCorrect && evalData?.correct_answer && (
                            <p className="mt-2 text-caption text-success">
                              Đáp án đúng: <strong className="font-semibold">{evalData.correct_answer}</strong>
                            </p>
                          )}

                          {isEssay && crit && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {AI_CRITERIA.map(([key, label, , color]) => {
                                const v = getCritScore(crit as Record<string, number | undefined>, key)
                                return (
                                  <span
                                    key={key}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-card px-2.5 py-1 text-caption"
                                  >
                                    <span className="size-1.5 rounded-full" style={{ background: color }} />
                                    <span className="text-muted-foreground">{label}:</span>
                                    <span className="tabular font-semibold text-foreground">{v}/10</span>
                                  </span>
                                )
                              })}
                            </div>
                          )}

                          {evalData?.feedback && (
                            <div className="mt-2.5 rounded-md bg-primary-tint/30 px-3 py-2 text-caption text-foreground">
                              <strong className="font-medium text-primary">Nhận xét AI: </strong>
                              {evalData.feedback}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setSelectedSession(null)}>
                  Đóng
                </Button>
              </DialogFooter>
            </div>
          )
        })()}
      </Dialog>
    </div>
  )
}
