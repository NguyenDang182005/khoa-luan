"use client"

import * as React from "react"
import {
  Sparkles,
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

  if (loading) return <div className="flex p-8 items-center justify-center text-muted-foreground">Đang tải báo cáo...</div>

  const radarData = analytics?.radarData ?? []
  const sessions: AnalyticsSession[] = analytics?.sessions ?? []

  // Calculate KPIs
  const totalSessions = sessions.length
  const completedSessions = sessions.filter((s) => s.status === 'GRADED' || s.status === 'COMPLETED').length
  const passRate = totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : "0.0"

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
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Báo Cáo Năng Lực Đào Tạo & Biểu Đồ Radar 4 Tiêu Chí
          </h1>
          <Badge variant="amber">Mô Hình Hybrid Assessment</Badge>
        </div>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Đánh giá kết hợp: 5 câu trắc nghiệm nội quy (NestJS chấm) + 2 câu tự luận tình huống (Gemini 3.1 Flash Lite chấm)
        </p>
      </div>

      {/* Row 1: Radar Chart & Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Radar Chart (Spider Chart) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="size-4 text-agent-amber" />
              Ma Trận Năng Lực Mềm 4 Cánh (Competency Spider Chart)
            </CardTitle>
            <CardDescription>
              So sánh điểm trung bình đợt đánh giá Tháng {now.month}/{now.year} với Chuẩn Năng Lực Công Ty
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="oklch(0.26 0.028 250)" />
                  <PolarAngleAxis dataKey="subject" stroke="oklch(0.94 0.015 235)" fontSize={12} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} stroke="oklch(0.65 0.025 240)" fontSize={10} />
                  <Radar
                    name="Chuẩn Công Ty"
                    dataKey="benchmark"
                    stroke="oklch(0.65 0.025 240)"
                    fill="oklch(0.65 0.025 240)"
                    fillOpacity={0.15}
                  />
                  <Radar
                    name="Thực Tế Đợt Này"
                    dataKey="actual"
                    stroke="oklch(0.78 0.15 82)"
                    fill="oklch(0.78 0.15 82)"
                    fillOpacity={0.5}
                  />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.18 0.025 248)",
                      borderColor: "oklch(0.26 0.028 250)",
                      borderRadius: "8px",
                      color: "oklch(0.94 0.015 235)",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Evaluation Summary Cards */}
        <div className="flex flex-col gap-4">
          <Card className="border-agent-teal/30 bg-agent-teal/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-agent-teal">
                Tỷ Lệ Hoàn Thành
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{passRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Tự động so khớp đáp án tại NestJS Backend (Tiết kiệm 100% token AI)
              </p>
            </CardContent>
          </Card>

          <Card className="border-agent-amber/30 bg-agent-amber/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-agent-amber">
                Điểm Tự Luận Tình Huống TB
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{avgAiScore.toFixed(1)} / 50</div>
              <p className="text-xs text-muted-foreground mt-1">
                AI Gemini 3.1 Flash Lite chấm điểm qua WF03: Chuyên nghiệp, Thấu cảm, Giải pháp, Rõ ràng
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Đề Xuất Đào Tạo Thêm
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weakest ? (
                <>
                  <p className="text-xs text-foreground font-medium">🎯 {weakest.subject}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Khoảng cách so với chuẩn lớn nhất: {weakest.actual}/{weakest.benchmark} điểm — tính tự động từ dữ liệu kỳ này.
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Chưa đủ dữ liệu AI Score trong kỳ để đưa ra đề xuất.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 2: Candidate Hybrid Assessment Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Bảng Xếp Hạng Kết Quả Đánh Giá Tổng Hợp</CardTitle>
          <CardDescription>
            Điểm Trắc nghiệm Nội quy (50%) + Điểm Tự luận Xử lý tình huống AI (50%)
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Học Viên</TableHead>
              <TableHead>Trạng Thái</TableHead>
              <TableHead className="text-center">Trắc Nghiệm</TableHead>
              <TableHead className="text-center">Tự Luận AI</TableHead>
              <TableHead className="text-center font-bold">Tổng Điểm</TableHead>
              <TableHead>Nhận Xét Từ Gemini AI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground p-8">
                  Chưa có dữ liệu đào tạo trong tháng này
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((item) => {
                const quizPart = Math.round(((item.quizScore ?? 0) * 0.5) * 10) / 10;
                const aiScoreVal = Math.max(0, Math.round(((item.totalScore ?? 0) - quizPart) * 10) / 10);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={(item.employee?.fullName ?? 'HV').split(' ').map((w) => w[0]).slice(-2).join('').toUpperCase()} className="bg-primary/20 text-primary border border-primary/30" />
                        <div>
                          <span className="font-semibold text-xs text-foreground">{item.employee?.fullName || 'Học viên'}</span>
                          <p className="text-[10px] text-muted-foreground">{item.employee?.employeeCode} • {item.employee?.department?.name ?? '—'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.status}</TableCell>
                    <TableCell className="text-center font-mono text-xs text-emerald-400">{quizPart}/50</TableCell>
                    <TableCell className="text-center font-mono text-xs text-agent-amber">{aiScoreVal}/50</TableCell>
                    <TableCell className="text-center font-mono text-xs font-bold text-primary">
                      {item.totalScore ?? 0} / 100
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {item.aiFeedback ? `"${item.aiFeedback}"` : "--"}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
