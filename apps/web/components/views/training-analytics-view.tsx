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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
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

// 4 tiêu chí AI cho mini bar trong bảng xếp hạng (màu var(--chart-1..4))
const AI_CRITERIA = [
  ["professional", "Chuyên nghiệp", "var(--chart-1)"],
  ["empathy", "Thấu cảm", "var(--chart-2)"],
  ["problemSolving", "Giải pháp", "var(--chart-3)"],
  ["clarity", "Rõ ràng", "var(--chart-4)"],
] as const

export function TrainingAnalyticsView() {
  const [analytics, setAnalytics] = useState<TrainingAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
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
              Điểm trắc nghiệm nội quy (50%) + điểm tự luận xử lý tình huống AI (50%)
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
                <TableHead>Tiêu chí AI</TableHead>
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
                    <TableRow key={item.id}>
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
                          <div className="grid w-40 grid-cols-4 gap-1.5">
                            {AI_CRITERIA.map(([key, label, color]) => {
                              const v = ai[key] ?? ai.essay_avg ?? 0
                              return (
                                <div
                                  key={key}
                                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                                  title={`${label}: ${v}/10`}
                                  aria-label={`${label}: ${v}/10`}
                                >
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${Math.min(100, (v / 10) * 100)}%`, background: color }}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="text-body-sm text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-body-sm text-muted-foreground">
                        {item.aiFeedback ? `"${item.aiFeedback}"` : "--"}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-subtle px-5 py-3 text-caption text-muted-foreground sm:px-6">
            {AI_CRITERIA.map(([key, label, color]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full" style={{ background: color }} />
                {label}
              </span>
            ))}
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
    </div>
  )
}
