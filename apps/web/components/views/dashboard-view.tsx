"use client"

import * as React from "react"
import {
  Users,
  Clock,
  Coins,
  Bot,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  Timer,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

import { useEffect, useState, useCallback } from 'react'
import { dashboardApi } from '@/lib/api/dashboard.api'
import type { KpiData, AttendanceChartData, DeptDistributionData, PendingLeaveData, AiWorkflowStat } from '@/lib/schemas/dashboard.schema'
import { useAuth } from '@/lib/auth-context'
import { useAiSocket } from '@/lib/hooks/useAiSocket'
import type { AiActivityEvent } from '@/lib/hooks/useAiSocket'

export function DashboardView() {
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [attendanceData, setAttendanceData] = useState<AttendanceChartData>([])
  const [departmentData, setDepartmentData] = useState<DeptDistributionData>([])
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeaveData[]>([])
  const [aiStats, setAiStats] = useState<AiWorkflowStat[]>([])
  const [loading, setLoading] = useState(true)
  const { user, isAdmin } = useAuth()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [kpiData, attData, deptData, leaves, activities] = await Promise.all([
        dashboardApi.getKpis(),
        dashboardApi.getAttendanceChart(),
        dashboardApi.getDeptDistribution(),
        dashboardApi.getPendingLeaves(),
        dashboardApi.getAiActivity(),
      ])
      setKpis(kpiData)
      setAttendanceData(attData)
      setDepartmentData(deptData)
      setPendingLeaves(leaves)
      setAiStats(activities)
    } catch (e) {
      console.error('Dashboard fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  /** Merge a single WS event into the aiStats array — update only the matching row */
  const handleAiActivity = useCallback((event: AiActivityEvent) => {
    setAiStats(prev => prev.map(stat =>
      stat.wf === event.wf
        ? { ...stat, total: event.total, avgLatencyMs: event.avgLatencyMs, lastActiveAt: event.lastActiveAt }
        : stat
    ))
    // Also bump the active workflow count in kpis if needed (already up-to-date from init)
  }, [])

  const { connected: wsConnected } = useAiSocket({
    userId: user?.id ?? null,
    isAdmin: isAdmin ?? false,
    onActivity: handleAiActivity,
  })

  const handleAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    if (!user?.employee?.id) return
    try {
      if (action === 'approve') await dashboardApi.approveLeave(id, user.employee.id)
      else await dashboardApi.rejectLeave(id, user.employee.id, reason || 'Từ chối bởi quản lý')
      const updated = await dashboardApi.getPendingLeaves()
      setPendingLeaves(updated)
    } catch (e) { console.error(e) }
  }

  const [rejectTarget, setRejectTarget] = React.useState<PendingLeaveData | null>(null)
  const [rejectReason, setRejectReason] = React.useState('')
  const confirmReject = async () => {
    if (!rejectTarget) return
    await handleAction(rejectTarget.id, 'reject', rejectReason.trim() || undefined)
    setRejectTarget(null)
    setRejectReason('')
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top Header Banner */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Bảng Điều Hành Nhân Sự & AI Multi-Agent
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Theo dõi tổng quan quân số, chấm công, quỹ lương và hiệu năng điều phối của 4 AI Agent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="teal" className="gap-1 px-3 py-1">
            <span className="size-2 rounded-full bg-agent-teal animate-pulse" />
            {kpis?.activeWorkflows ?? 0} Workflows AI Có Hoạt Động (7 ngày qua)
          </Badge>
        </div>
      </div>

      {/* Row 1: 4 Key Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tổng Quân Số
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <div className="animate-pulse h-8 w-16 bg-muted rounded" /> : kpis?.totalEmployees ?? '...'}
              {!loading && <span className="text-xs font-normal text-muted-foreground ml-1">nhân sự</span>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Tổng số nhân sự đang quản lý trong hệ thống
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-agent-teal/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tỷ Lệ Đi Làm Hôm Nay
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-agent-teal/10 text-agent-teal">
              <Clock className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-agent-teal">
              {loading ? <div className="animate-pulse h-8 w-16 bg-muted rounded" /> : `${kpis?.todayAttendanceRate ?? '...'}%`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {loading ? '...' : `${kpis?.todayDetail?.onTime ?? 0} đúng giờ • ${kpis?.todayDetail?.late ?? 0} đi muộn • ${kpis?.todayDetail?.onLeave ?? 0} nghỉ phép`}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-agent-amber/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Quỹ Lương Tháng
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-agent-amber/10 text-agent-amber">
              <Coins className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <div className="animate-pulse h-8 w-24 bg-muted rounded" /> : `₫${kpis?.monthlyPayrollTotal ?? '...'}`}
            </div>
            <p className="mt-1 flex items-center text-xs text-muted-foreground">
              <ArrowUpRight className="mr-1 size-3 text-agent-amber" /> Đã chốt dự thảo sơ bộ
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-agent-coral/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              AI Multi-Agent Resolution
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-agent-coral/10 text-agent-coral">
              <Bot className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-agent-coral">
              {loading
                ? <div className="animate-pulse h-8 w-16 bg-muted rounded" />
                : kpis?.aiResolutionRate != null ? `${kpis.aiResolutionRate}%` : '--'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {loading ? '...' : `${kpis?.totalAiMessages ?? 0} câu hỏi • ${kpis?.escalationCount ?? 0} ca Escalate con người`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Charts (Recharts Area & Pie) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Xu Hướng Chấm Công 9 Ngày Đầu Tháng</CardTitle>
            <CardDescription>Số lượng nhân sự đúng giờ, đi muộn và nghỉ phép thực tế</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="onTimeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.68 0.18 260)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="oklch(0.68 0.18 260)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.78 0.15 82)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="oklch(0.78 0.15 82)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.028 250)" />
                  <XAxis dataKey="day" stroke="oklch(0.65 0.025 240)" fontSize={12} />
                  <YAxis stroke="oklch(0.65 0.025 240)" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.18 0.025 248)",
                      borderColor: "oklch(0.26 0.028 250)",
                      borderRadius: "8px",
                      color: "oklch(0.94 0.015 235)",
                    }}
                  />
                  <Area type="monotone" dataKey="onTime" name="Đúng giờ" stroke="oklch(0.68 0.18 260)" fillOpacity={1} fill="url(#onTimeGrad)" />
                  <Area type="monotone" dataKey="late" name="Đi muộn" stroke="oklch(0.78 0.15 82)" fillOpacity={1} fill="url(#lateGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Phân Bổ Nhân Lực</CardTitle>
            <CardDescription>Tỷ trọng cơ cấu theo từng khối phòng ban</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={["oklch(0.68 0.18 260)", "oklch(0.75 0.14 180)", "oklch(0.78 0.15 82)", "oklch(0.70 0.18 28)"][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.18 0.025 248)",
                      borderColor: "oklch(0.26 0.028 250)",
                      borderRadius: "8px",
                      color: "oklch(0.94 0.015 235)",
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Actionable Lists (Pending Approvals & AI Activity Feed) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Duyệt Đơn Nghỉ Phép Chờ Xử Lý</CardTitle>
              <CardDescription>Cần HR Admin hoặc Quản lý trực tiếp phê duyệt</CardDescription>
            </div>
            <Badge variant="secondary">{pendingLeaves.length} đơn mới</Badge>
          </CardHeader>
          <CardContent>
            {pendingLeaves.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-muted-foreground">
                <CheckCircle2 className="size-8 text-emerald-400 mb-2" />
                <p className="text-xs">Đã xử lý hết toàn bộ đơn nghỉ phép!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar initials={leave.employee.fullName.substring(0, 2).toUpperCase()} className="bg-primary/20 text-primary border border-primary/30" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">{leave.employee.fullName}</p>
                        <p className="text-[11px] text-muted-foreground">{leave.employee.department.name} • {leave.startDate} - {leave.endDate} ({leave.totalDays} ngày)</p>
                        <p className="text-[11px] text-muted-foreground italic">&ldquo;{leave.reason}&rdquo;</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="xs" variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleAction(leave.id, 'approve')}>
                        <CheckCircle2 className="size-3 mr-1" /> Duyệt
                      </Button>
                      <Button size="xs" variant="ghost" className="text-destructive hover:bg-destructive/10" aria-label="Từ chối đơn" onClick={() => { setRejectTarget(leave); setRejectReason('') }}>
                        <XCircle className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="size-4 text-agent-teal" />
                Hiệu Năng AI Multi-Agent
              </CardTitle>
              <CardDescription>Thống kê tổng hợp theo từng workflow n8n</CardDescription>
            </div>
            <Badge
              variant={wsConnected ? "teal" : "secondary"}
              className="gap-1 px-2.5 py-1 text-[11px] transition-colors"
            >
              <span className={`size-1.5 rounded-full ${wsConnected ? 'bg-agent-teal animate-pulse' : 'bg-muted-foreground'}`} />
              {wsConnected ? `${kpis?.activeWorkflows ?? 0} workflow active` : 'Ngoại tuyến'}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* Max latency across all workflows — used to size bars */}
            {(() => {
              const maxLatency = Math.max(
                ...aiStats.map(s => s.avgLatencyMs ?? 0),
                1,
              )
              const WF_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
                WF02: { bg: 'bg-primary/10',        text: 'text-primary',      bar: 'bg-primary' },
                WF03: { bg: 'bg-agent-amber/10',    text: 'text-agent-amber',  bar: 'bg-agent-amber' },
                WF04: { bg: 'bg-agent-teal/10',     text: 'text-agent-teal',   bar: 'bg-agent-teal' },
              }
              return aiStats.map((stat) => {
                const color = WF_COLORS[stat.wf] ?? WF_COLORS['WF02']
                const latencyPct = stat.avgLatencyMs
                  ? Math.min(Math.round((stat.avgLatencyMs / maxLatency) * 100), 100)
                  : 0
                const lastActive = stat.lastActiveAt
                  ? (() => {
                      const diff = Date.now() - new Date(stat.lastActiveAt).getTime()
                      const h = Math.floor(diff / 3_600_000)
                      const d = Math.floor(h / 24)
                      if (d > 0) return `${d} ngày trước`
                      if (h > 0) return `${h} giờ trước`
                      return 'Vừa xong'
                    })()
                  : 'Chưa hoạt động'

                return (
                  <div
                    key={stat.wf}
                    className="rounded-xl border border-border/60 bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
                  >
                    {/* Top row: badge + label + stats */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`shrink-0 inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ${color.bg} ${color.text}`}>
                          {stat.wf}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{stat.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{stat.desc}</p>
                        </div>
                      </div>
                      {/* Right stats cluster */}
                      <div className="flex items-center gap-3 shrink-0">
                        {/* Message count */}
                        <div className="flex items-center gap-1 text-right">
                          <MessageSquare className="size-3 text-muted-foreground" />
                          <span className="text-xs font-semibold text-foreground tabular-nums">{stat.total}</span>
                        </div>
                        {/* Escalation (WF04 only) */}
                        {stat.escalated !== null && (
                          <div className={`flex items-center gap-1 ${stat.escalated > 0 ? 'text-agent-coral' : 'text-muted-foreground'}`}>
                            <AlertTriangle className="size-3" />
                            <span className="text-xs font-semibold tabular-nums">{stat.escalated}</span>
                          </div>
                        )}
                        {/* Last active */}
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Timer className="size-3" />
                          <span className="text-[10px]">{lastActive}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom row: latency bar */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-border/60 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${color.bar} opacity-70`}
                          style={{ width: `${latencyPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-14 text-right tabular-nums shrink-0">
                        {stat.avgLatencyMs != null ? `⌀ ${stat.avgLatencyMs}ms` : 'N/A'}
                      </span>
                    </div>
                  </div>
                )
              })
            })()}

            {/* Footer summary row */}
            <div className="mt-1 flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
              <span className="text-[11px] text-muted-foreground">Tổng phản hồi AI</span>
              <span className="text-xs font-bold text-foreground tabular-nums">
                {aiStats.reduce((s, w) => s + w.total, 0).toLocaleString('vi-VN')} lượt
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reject Reason Dialog */}
      <Dialog open={rejectTarget !== null} onOpenChange={(open) => { if (!open) setRejectTarget(null) }}>
        <DialogHeader>
          <DialogTitle>Từ Chối Đơn Nghỉ Phép</DialogTitle>
          <DialogDescription>
            Đơn của {rejectTarget?.employee.fullName ?? "nhân viên"} ({rejectTarget?.startDate} → {rejectTarget?.endDate})
          </DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <label className="text-[11px] font-semibold text-muted-foreground">Lý do từ chối</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            placeholder="Nhập lý do từ chối (để trống sẽ dùng lý do mặc định)..."
            className="mt-1 w-full rounded-lg border border-border bg-input/40 p-2 text-xs text-foreground outline-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRejectTarget(null)}>Hủy</Button>
          <Button
            variant="default"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={confirmReject}
          >
            Xác Nhận Từ Chối
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
