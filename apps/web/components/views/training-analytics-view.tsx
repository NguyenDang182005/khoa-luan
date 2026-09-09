"use client"

import * as React from "react"
import {
  Award,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  TrendingUp,
  Brain,
  Layers,
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

const radarData = [
  {
    criterion: "Chuyên Nghiệp",
    benchmark: 8.0,
    actual: 8.5,
    fullMark: 10,
  },
  {
    criterion: "Thấu Cảm",
    benchmark: 8.0,
    actual: 8.2,
    fullMark: 10,
  },
  {
    criterion: "Giải Quyết Vấn Đề",
    benchmark: 8.0,
    actual: 7.4,
    fullMark: 10,
  },
  {
    criterion: "Diễn Đạt Rõ Ràng",
    benchmark: 8.0,
    actual: 8.8,
    fullMark: 10,
  },
]

const candidateResults = [
  {
    name: "Nguyễn Văn Đạt",
    dept: "Kỹ thuật & AI",
    quizScore: "5/5 (50đ)",
    scenarioScore: "8.8/10 (44đ)",
    totalScore: 94,
    grade: "Xuất sắc",
    aiFeedback: "Giao tiếp rõ ràng, giải pháp logic cao, phong thái chuẩn mực.",
    avatar: "NĐ",
  },
  {
    name: "Trần Thị Mai",
    dept: "Hành chính & Nhân sự",
    quizScore: "5/5 (50đ)",
    scenarioScore: "8.5/10 (42.5đ)",
    totalScore: 92.5,
    grade: "Xuất sắc",
    aiFeedback: "Thấu cảm rất tốt với khách hàng, thái độ hòa nhã, đúng SOP.",
    avatar: "TM",
  },
  {
    name: "Phạm Thùy Linh",
    dept: "Kinh doanh & CSKH",
    quizScore: "4/5 (40đ)",
    scenarioScore: "7.8/10 (39đ)",
    totalScore: 79,
    grade: "Khá",
    aiFeedback: "Cần cải thiện tốc độ đưa ra giải pháp bồi thường cho khách khó tính.",
    avatar: "TL",
  },
  {
    name: "Lê Hoàng Quân",
    dept: "Kỹ thuật & AI",
    quizScore: "5/5 (50đ)",
    scenarioScore: "8.0/10 (40đ)",
    totalScore: 90,
    grade: "Giỏi",
    aiFeedback: "Hiểu sâu quy chế bảo mật, diễn đạt súc tích và gãy gọn.",
    avatar: "HQ",
  },
]

export function TrainingAnalyticsView() {
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
          Đánh giá kết hợp: 5 câu trắc nghiệm nội quy (NestJS chấm) + 2 câu tự luận tình huống (Gemini 3.5 chấm)
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
              So sánh điểm trung bình đợt đào tạo Onboarding Tháng 9 với Chuẩn Năng Lực Công Ty
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="oklch(0.26 0.028 250)" />
                  <PolarAngleAxis dataKey="criterion" stroke="oklch(0.94 0.015 235)" fontSize={12} />
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
                Tỷ Lệ Đạt Trắc Nghiệm Nội Quy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">96.5%</div>
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
              <div className="text-2xl font-bold text-foreground">8.2 / 10</div>
              <p className="text-xs text-muted-foreground mt-1">
                AI Gemini 3.5 chấm điểm qua WF03: Chuyên nghiệp, Thấu cảm, Giải pháp, Rõ ràng
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
              <p className="text-xs text-foreground font-medium">
                🎯 Kỹ năng "Giải quyết vấn đề": 7.4/10
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Cần bổ sung buổi hướng dẫn về quy trình đền bù và xử lý khiếu nại giao vận cho khối CSKH.
              </p>
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
              <TableHead>Phòng Ban</TableHead>
              <TableHead className="text-center">Trắc Nghiệm (5 câu)</TableHead>
              <TableHead className="text-center">Tự Luận AI (2 câu)</TableHead>
              <TableHead className="text-center font-bold">Tổng Điểm</TableHead>
              <TableHead>Xếp Loại</TableHead>
              <TableHead>Nhận Xét Từ Gemini AI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidateResults.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={item.avatar} className="bg-primary/20 text-primary border border-primary/30" />
                    <span className="font-semibold text-xs text-foreground">{item.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.dept}</TableCell>
                <TableCell className="text-center font-mono text-xs text-emerald-400">{item.quizScore}</TableCell>
                <TableCell className="text-center font-mono text-xs text-agent-amber">{item.scenarioScore}</TableCell>
                <TableCell className="text-center font-mono text-xs font-bold text-primary">
                  {item.totalScore} / 100
                </TableCell>
                <TableCell>
                  <Badge variant={item.grade === "Xuất sắc" ? "success" : "default"}>
                    {item.grade}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                  "{item.aiFeedback}"
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
