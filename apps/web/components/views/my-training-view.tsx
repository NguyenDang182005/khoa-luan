"use client"

import * as React from "react"
import { Award, TrendingUp, Calendar, Star } from "lucide-react"
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { trainingApi } from '@/lib/api/training.api'
import type { TrainingSession } from '@/lib/schemas/training.schema'
import { scenarioLabel } from '@/lib/utils'

const BENCHMARK = { professional: 8.0, empathy: 8.0, problemSolving: 8.0, clarity: 8.0 }

export function MyTrainingView() {
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
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 text-center p-6">
        <Award className="size-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Tài khoản chưa liên kết hồ sơ nhân viên</h2>
        <p className="text-sm text-muted-foreground">Vui lòng liên hệ HR để gắn tài khoản của bạn với hồ sơ nhân sự.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="flex p-8 items-center justify-center text-muted-foreground">Đang tải lịch sử...</div>
  }

  if (sessions.length === 0) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Award className="size-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Bạn chưa có lịch sử bài đào tạo nào</h2>
          <p className="text-sm text-muted-foreground">Hãy bắt đầu một bài đánh giá để xem kết quả tại đây.</p>
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
      ).toFixed(1)
    : "0.0"

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Award className="size-5 text-agent-amber" />
            Kết Quả Đào Tạo Của Tôi
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Theo dõi tiến bộ kỹ năng qua các lần đánh giá AI Hybrid Assessment
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Lần đánh giá</p>
          <p className="text-2xl font-bold text-foreground mt-1">{sessions.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">bài test hoàn thành</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Điểm tổng gần nhất</p>
          <p className="text-2xl font-bold text-agent-amber mt-1">{selected?.totalScore ?? 0}/100</p>
          <p className="text-xs text-muted-foreground mt-0.5">Quiz 50% + AI 50%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Điểm kỹ năng AI</p>
          <p className="text-2xl font-bold text-primary mt-1">{avgAiScore}/10</p>
          <p className="text-xs text-muted-foreground mt-0.5">trung bình 4 tiêu chí</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Radar Chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            Biểu Đồ Năng Lực 4 Tiêu Chí
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="oklch(0.26 0.028 250)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 11, fill: "oklch(0.65 0.025 240)" }}
              />
              <Radar
                name="Chuẩn công ty"
                dataKey="Chuẩn công ty"
                stroke="oklch(0.65 0.025 240)"
                fill="oklch(0.65 0.025 240)"
                fillOpacity={0.1}
                strokeDasharray="4 4"
              />
              <Radar
                name="Của bạn"
                dataKey="Của bạn"
                stroke="oklch(0.78 0.15 82)"
                fill="oklch(0.78 0.15 82)"
                fillOpacity={0.25}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.18 0.025 248)",
                  border: "1px solid oklch(0.26 0.028 250)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "oklch(0.94 0.015 235)",
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-agent-amber inline-block" />
              Của bạn
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-muted-foreground inline-block" />
              Chuẩn công ty
            </span>
          </div>
        </div>

        {/* AI Comment */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Star className="size-4 text-agent-amber" />
            Nhận Xét Từ AI
          </h2>
          <div className="flex flex-col gap-3">
            {selected?.aiScore && Object.entries(selected.aiScore).map(([key, val]) => {
              const labels: Record<string, string> = {
                professional: "Chuyên nghiệp",
                empathy: "Thấu cảm",
                problemSolving: "Giải quyết vấn đề",
                clarity: "Rõ ràng",
              }
              const numVal = typeof val === 'number' ? val : 0
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{labels[key]}</span>
                    <span className="font-semibold text-foreground">{numVal}/10</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-agent-amber transition-all"
                      style={{ width: `${(numVal / 10) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {selected?.aiFeedback && (
            <div className="rounded-lg bg-muted/50 border border-border p-3 mt-auto">
              <p className="text-xs text-muted-foreground italic">&ldquo;{selected.aiFeedback}&rdquo;</p>
            </div>
          )}
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            Lịch Sử Đánh Giá
          </h2>
        </div>
        <div className="divide-y divide-border">
          {sessions.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className={`w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors ${
                selected?.id === item.id ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{scenarioLabel(item.scenario)}</span>
                <span className="text-xs text-muted-foreground">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }) : "--"}
                </span>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div>
                  <p className="text-xs text-muted-foreground">Quiz</p>
                  <p className="text-sm font-semibold text-foreground">
                    {Math.round(((item.quizScore ?? 0) * 0.5) * 10) / 10}/50
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-agent-amber">
                    {item.aiScore
                      ? (
                          ((item.aiScore.professional ?? item.aiScore.essay_avg ?? 0) +
                            (item.aiScore.empathy ?? item.aiScore.essay_avg ?? 0) +
                            (item.aiScore.problemSolving ?? item.aiScore.essay_avg ?? 0) +
                            (item.aiScore.clarity ?? item.aiScore.essay_avg ?? 0)) /
                          4
                        ).toFixed(1)
                      : "0.0"}
                    /10
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tổng</p>
                  <p className={`text-sm font-bold ${(item.totalScore ?? 0) >= 80 ? "text-emerald-500" : (item.totalScore ?? 0) >= 65 ? "text-agent-amber" : "text-agent-coral"}`}>
                    {item.totalScore ?? 0}/100
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
