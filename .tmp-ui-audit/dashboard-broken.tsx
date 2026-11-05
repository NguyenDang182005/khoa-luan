"use client"

import * as React from "react"
import {
  Users,
  Clock,
  Wallet,
  Sparkles,
  Calendar,
  Inbox,
  ChartArea,
  PieChart as PieChartIcon,
  UserRoundCheck,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
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
} from "recharts"

import { useEffect, useState, useCallback } from 'react'
import { dashboardApi } from '@/lib/api/dashboard.api'
import type { KpiData, AttendanceChartData, DeptDistributionData, PendingLeaveData, AiWorkflowStat } from '@/lib/schemas/dashboard.schema'
import { useAuth } from '@/lib/auth-context'
import { useAiSocket } from '@/lib/hooks/useAiSocket'
import { LeaveDetailModal } from "@/components/employees/leave-detail-modal"
import { vnd, requestDurationLabel, leaveTypeLabel } from "@/lib/utils"

function fmtVN(iso: string) {
  if (!iso) return "--"
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso.slice(0, 10)
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch {
    return iso.slice(0, 10)
  }
}
import type { AiActivityEvent } from '@/lib/hooks/useAiSocket'

export function DashboardView() {
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [attendanceData, setAttendanceData] = useState<AttendanceChartData>([])
  const [departmentData, setDepartmentData] = useState<DeptDistributionData>([])
  const [pendingLeaves, setPendingLeaves] = useState<PendingLeaveData[]>([])
  const [aiStats, setAiStats] = useState<AiWorkflowStat[]>([])
  const [loading, setLoading] = useState(true)
  const { user, isAdmin } = useAuth()

  // NhÃ£n thÃ¡ng cá»§a biá»ƒu Ä‘á»“ (API tráº£ "dd/MM" theo thÃ¡ng Ä‘ang xem).
  const chartMonthLabel = React.useMemo(() => {
    const first = attendanceData[0]?.day
    return first ? first.split("/")[1] : ""
  }, [attendanceData])

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

  /** Merge a single WS event into the aiStats array â€” update only the matching row */
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

  // Lá»—i nÃ©m lÃªn Ä‘á»ƒ LeaveDetailModal hiá»ƒn thá»‹; ngÆ°á»i duyá»‡t láº¥y tá»« JWT phÃ­a backend
  const handleAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    if (action === 'approve') await dashboardApi.approveLeave(id)
    else await dashboardApi.rejectLeave(id, reason || 'Tá»« chá»‘i bá»Ÿi quáº£n lÃ½')
    setPendingLeaves(await dashboardApi.getPendingLeaves())
  }

  const [detailTarget, setDetailTarget] = React.useState<PendingLeaveData | null>(null)

  const now = new Date()
  const periodLabel = `ThÃ¡ng ${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`

  const chartTooltipStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    boxShadow: "var(--shadow-sm)",
    fontSize: 12,
  }
  const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 }
  const DEPT_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]
  const deptTotal = departmentData.reduce((s, d) => s + d.value, 0)

  const kpiCards = [
    {
      label: "Tá»•ng há»“ sÆ¡ nhÃ¢n sá»±",
      icon: Users,
      tint: "bg-primary-tint text-primary",
      value: kpis
        ? (kpis.totalEmployeeRecords ?? kpis.totalEmployees).toLocaleString("vi-VN")
        : "--",
      unit: "há»“ sÆ¡",
      sub: kpis
        ? `${kpis.totalEmployees.toLocaleString("vi-VN")} Ä‘ang lÃ m viá»‡c Â· ${(kpis.terminatedEmployees ?? 0).toLocaleString("vi-VN")} Ä‘Ã£ nghá»‰ viá»‡c`
        : "Äang táº£i...",
    },
    {
      label: "Tá»· lá»‡ Ä‘i lÃ m hÃ´m nay",
      icon: Clock,
      tint: "bg-success-tint text-success",
      value: kpis ? `${kpis.todayAttendanceRate.toLocaleString("vi-VN")}%` : "--",
      sub: `${kpis?.todayDetail?.onTime ?? 0} Ä‘Ãºng giá» Â· ${kpis?.todayDetail?.late ?? 0} Ä‘i muá»™n Â· ${kpis?.todayDetail?.onLeave ?? 0} nghá»‰ phÃ©p`,
    },
    {
      label: "Quá»¹ lÆ°Æ¡ng thÃ¡ng",
      icon: Wallet,
      tint: "bg-warning-tint text-warning",
      value: vnd(kpis?.monthlyPayrollTotal ?? NaN),
      sub: "Tá»•ng thá»±c lÄ©nh, má»i tráº¡ng thÃ¡i",
    },
    {
      label: "AI tá»± giáº£i quyáº¿t",
      icon: Sparkles,
      tint: "bg-ai-tint text-ai",
      value: kpis?.aiResolutionRate != null ? `${kpis.aiResolutionRate.toLocaleString("vi-VN")}%` : "--",
      sub: `${(kpis?.totalAiMessages ?? 0).toLocaleString("vi-VN")} cÃ¢u há»i Â· ${kpis?.escalationCount ?? 0} ca chuyá»ƒn ngÆ°á»i Â· ${kpis?.activeWorkflows ?? 0} agent hoáº¡t Ä‘á»™ng (7 ngÃ y)`,
    },
  ]

  // MÃ u agent: WF01 violet Â· WF02 blue Â· WF03 amber Â· WF04 rose
  const WF_COLORS: Record<string, { tag: string; bar: string }> = {
    WF01: { tag: "bg-agent-wf01-tint text-agent-wf01", bar: "bg-agent-wf01" },
    WF02: { tag: "bg-agent-wf02-tint text-agent-wf02", bar: "bg-agent-wf02" },
    WF03: { tag: "bg-agent-wf03-tint text-agent-wf03", bar: "bg-agent-wf03" },
    WF04: { tag: "bg-agent-wf04-tint text-agent-wf04", bar: "bg-agent-wf04" },
  }
  const DEFAULT_WF_COLOR = WF_COLORS.WF02!

  const emptyState = (Icon: React.ElementType, title: string, desc: string) => (
    <div className="flex h-full min-h-56 flex-col items-center justify-center px-6 py-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-body font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-72 text-body-sm text-muted-foreground">{desc}</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-semibold text-foreground">Báº£ng Ä‘iá»u hÃ nh</h1>
          <p className="mt-1 text-body text-muted-foreground">
            TÃ¬nh hÃ¬nh nhÃ¢n sá»±, cháº¥m cÃ´ng, quá»¹ lÆ°Æ¡ng vÃ  hoáº¡t Ä‘á»™ng AI trong ká»³.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="h-8 px-3 text-body-sm">
            <Calendar className="size-4" />
            {periodLabel}
          </Badge>
          <Badge variant={wsConnected ? "success" : "secondary"} className="h-8 px-3 text-body-sm">
            <span className={`size-2 rounded-full ${wsConnected ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
            {wsConnected ? "Realtime" : "Máº¥t káº¿t ná»‘i"}
          </Badge>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5 xl:grid-cols-4">
        {kpiCards.map((k) => (
          <Card key={k.label} className="p-4 sm:p-5">
            {loading ? (
              <>
                <div className="skeleton size-9 rounded-md" />
                <div className="skeleton mt-4 h-4 w-28 rounded" />
                <div className="skeleton mt-2 h-8 w-24 rounded" />
                <div className="skeleton mt-3 h-3 w-40 rounded" />
              </>
            ) : (
              <>
                <span className={`flex size-8 items-center justify-center rounded-md ${k.tint}`}>
                  <k.icon className="size-4" />
                </span>
                <p className="mt-3 text-body-sm text-muted-foreground">{k.label}</p>
                <p className="tabular mt-1 whitespace-nowrap text-[26px] font-semibold leading-8 text-foreground">
                  {k.value}
                  {k.unit && <span className="ml-1.5 text-body-sm font-normal text-muted-foreground">{k.unit}</span>}
                </p>
                <p className="mt-1 text-caption text-muted-foreground">{k.sub}</p>
              </>
            )}
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-3">
        <Card className="p-4 sm:p-5 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-h3 font-semibold text-foreground">
                Xu hÆ°á»›ng cháº¥m cÃ´ng{chartMonthLabel ? ` thÃ¡ng ${chartMonthLabel}` : ""}
              </h2>
              <p className="text-body-sm text-muted-foreground">Sá»‘ nhÃ¢n sá»± Ä‘Ãºng giá», Ä‘i muá»™n vÃ  nghá»‰ phÃ©p má»—i ngÃ y</p>
            </div>
            <div className="flex items-center gap-4 text-caption text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-1" />ÄÃºng giá»</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-3" />Äi muá»™n</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-2" />Nghá»‰ phÃ©p</span>
            </div>
          </div>
          <div className={`relative mt-4 w-full ${!loading && attendanceData.length === 0 ? "h-[220px]" : "h-[300px]"}`}>
            {loading ? (
              <div className="skeleton absolute inset-0 rounded-md" />
            ) : attendanceData.length === 0 ? (
              emptyState(ChartArea, "ChÆ°a cÃ³ dá»¯ liá»‡u cháº¥m cÃ´ng", "Dá»¯ liá»‡u sáº½ xuáº¥t hiá»‡n khi nhÃ¢n viÃªn báº¯t Ä‘áº§u check-in trong ká»³.")
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendanceData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="onTimeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="onTime" name="ÄÃºng giá»" stroke="var(--chart-1)" strokeWidth={2} fillOpacity={1} fill="url(#onTimeGrad)" />
                  <Area type="monotone" dataKey="late" name="Äi muá»™n" stroke="var(--chart-3)" strokeWidth={2} fill="none" dot={{ r: 3, fill: "var(--chart-3)", strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="leave" name="Nghá»‰ phÃ©p" stroke="var(--chart-2)" strokeWidth={2} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-h3 font-semibold text-foreground">PhÃ¢n bá»• nhÃ¢n lá»±c</h2>
          <p className="text-body-sm text-muted-foreground">CÆ¡ cáº¥u nhÃ¢n sá»± Ä‘ang lÃ m viá»‡c theo phÃ²ng ban</p>
          <div className="mt-4">
            {loading ? (
              <>
                <div className="skeleton mx-auto size-44 rounded-full" />
                <div className="skeleton mt-6 h-3 w-full rounded" />
                <div className="skeleton mt-2 h-3 w-3/4 rounded" />
              </>
            ) : departmentData.length === 0 || deptTotal === 0 ? (
              emptyState(PieChartIcon, "ChÆ°a cÃ³ nhÃ¢n sá»±", "ThÃªm nhÃ¢n viÃªn Ä‘á»ƒ xem cÆ¡ cáº¥u phÃ²ng ban.")
            ) : (
              <>
                <div className="relative mx-auto size-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departmentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={59}
                        outerRadius={81}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {departmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="tabular text-h2 font-semibold text-foreground">{deptTotal.toLocaleString("vi-VN")}</span>
                    <span className="text-caption text-muted-foreground">nhÃ¢n sá»±</span>
                  </div>
                </div>
                <ul className="mt-5 grid gap-2 text-body-sm">
                  {departmentData.map((d, index) => (
                    <li key={d.name} className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{ background: DEPT_COLORS[index % DEPT_COLORS.length] }}
                      />
                      <span className="flex-1 truncate text-secondary-foreground">{d.name}</span>
                      <span className="tabular text-muted-foreground">{Math.round((d.value / deptTotal) * 100)}%</span>
                      <span className="tabular w-8 text-right font-medium text-foreground">{d.value}</span>
                    </li>
                  ))}
                </ul>
                {(kpis?.terminatedEmployees ?? 0) > 0 && (
                  <p className="mt-3 text-caption text-muted-foreground">
                    KhÃ´ng gá»“m {kpis?.terminatedEmployees} há»“ sÆ¡ Ä‘Ã£ nghá»‰ viá»‡c.
                  </p>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
            <div>
              <h2 className="text-h3 font-semibold text-foreground">ÄÆ¡n chá» duyá»‡t</h2>
              <p className="text-body-sm text-muted-foreground">Táº¥t cáº£ Ä‘Æ¡n Ä‘ang chá», khÃ´ng giá»›i háº¡n ká»³</p>
            </div>
            <Badge variant="warning" className="tabular">{pendingLeaves.length} Ä‘Æ¡n</Badge>
          </div>
          <ul className="divide-y divide-border-subtle border-t border-border-subtle">
            {loading ? (
              [1, 2, 3].map((i) => (
                <li key={i} className="flex gap-3 px-4 py-3.5 sm:px-5">
                  <div className="skeleton size-10 rounded-full" />
                  <div className="flex-1">
                    <div className="skeleton h-4 w-40 rounded" />
                    <div className="skeleton mt-2 h-3 w-56 rounded" />
                  </div>
                </li>
              ))
            ) : pendingLeaves.length === 0 ? (
              <li>{emptyState(Inbox, "ÄÃ£ xá»­ lÃ½ háº¿t cÃ¡c Ä‘Æ¡n", "ÄÆ¡n má»›i cá»§a nhÃ¢n viÃªn sáº½ hiá»‡n á»Ÿ Ä‘Ã¢y.")}</li>
            ) : (
              pendingLeaves.map((leave) => (
                <li
                  key={leave.id}
                  onClick={() => setDetailTarget(leave)}
                  className="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-sunken sm:px-5"
                >
                  <Avatar
                    initials={leave.employee.fullName.substring(0, 2).toUpperCase()}
                    className="size-10 text-body-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-foreground">
                      {leave.employee.fullName}{" "}
                      <span className="font-normal text-muted-foreground">Â· {leave.employee.department.name}</span>
                    </p>
                    <p className="text-body-sm text-secondary-foreground">
                      <span className="font-medium">{leaveTypeLabel(leave.type)}</span> Â· {fmtVN(leave.startDate)} â†’ {fmtVN(leave.endDate)} Â· <span className="tabular">{requestDurationLabel(leave)}</span>
                    </p>
                    <p className="truncate text-caption text-muted-foreground">{leave.reason}</p>
                  </div>
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => setDetailTarget(leave)}>
                      Xem & duyá»‡t
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
            <div>
              <h2 className="text-h3 font-semibold text-foreground">Hoáº¡t Ä‘á»™ng AI</h2>
              <p className="text-body-sm text-muted-foreground">Thá»‘ng kÃª theo tá»«ng agent</p>
            </div>
            <Badge variant={wsConnected ? "success" : "secondary"}>
              <span className={`size-2 rounded-full ${wsConnected ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
              {wsConnected ? "Äang káº¿t ná»‘i" : "Ngoáº¡i tuyáº¿n"}
            </Badge>
          </div>
          <ul className="divide-y divide-border-subtle border-t border-border-subtle">
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <li key={i} className="px-4 py-3.5 sm:px-5">
                  <div className="skeleton h-4 w-48 rounded" />
                  <div className="skeleton mt-3 h-2 w-full rounded" />
                </li>
              ))
            ) : aiStats.length === 0 ? (
              <li>{emptyState(Sparkles, "ChÆ°a cÃ³ hoáº¡t Ä‘á»™ng AI", "Khi nhÃ¢n viÃªn hoáº·c khÃ¡ch hÃ ng nháº¯n tin, thá»‘ng kÃª sáº½ hiá»‡n á»Ÿ Ä‘Ã¢y.")}</li>
            ) : (
              aiStats.map((stat) => {
                const color = WF_COLORS[stat.wf] ?? DEFAULT_WF_COLOR
                const lastActive = stat.lastActiveAt
                  ? (() => {
                      const diff = Date.now() - new Date(stat.lastActiveAt).getTime()
                      const h = Math.floor(diff / 3_600_000)
                      const d = Math.floor(h / 24)
                      if (d > 0) return `${d} ngÃ y trÆ°á»›c`
                      if (h > 0) return `${h} giá» trÆ°á»›c`
                      return 'Vá»«a xong'
                    })()
                  : 'ChÆ°a hoáº¡t Ä‘á»™ng'

                return (
                  <li key={stat.wf} className="px-4 py-3.5 sm:px-5">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-[22px] shrink-0 items-center rounded-sm px-2 font-mono text-micro font-semibold ${color.tag}`}>
                        {stat.wf}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body font-medium text-foreground">{stat.label}</p>
                        <p className="truncate text-caption text-muted-foreground">{stat.desc}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-body font-semibold text-foreground">{stat.total.toLocaleString("vi-VN")}</p>
                        <p className="text-caption text-muted-foreground">{lastActive}</p>
                      </div>
                    </div>
                    {stat.escalated !== null && (
                      <div className="mt-2 flex">
                        {stat.escalated > 0 ? (
                          <Badge variant="destructive" className="tabular">
                            <UserRoundCheck className="size-3.5" />
                            {stat.escalated} chuyá»ƒn ngÆ°á»i
                          </Badge>
                        ) : (
                          <Badge variant="secondary">0 chuyá»ƒn ngÆ°á»i</Badge>
                        )}
                      </div>
                    )}
                  </li>
                )
              })
            )}
          </ul>
          {!loading && aiStats.length > 0 && (
            <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5 sm:px-5">
              <span className="text-body-sm text-muted-foreground">Tá»•ng pháº£n há»“i AI</span>
              <span className="tabular text-body font-semibold text-foreground">
                {aiStats.reduce((s, w) => s + w.total, 0).toLocaleString('vi-VN')} lÆ°á»£t
              </span>
            </div>
          )}
        </Card>
      </div>

      {/* Pop up chi tiáº¿t Ä‘Æ¡n nghá»‰ phÃ©p kÃ¨m phÃª duyá»‡t */}
      <LeaveDetailModal
        leave={
          detailTarget
            ? {
                id: detailTarget.id,
                type: detailTarget.type,
                startDate: detailTarget.startDate,
                endDate: detailTarget.endDate,
                totalDays: detailTarget.totalDays,
                overtimeHours: detailTarget.overtimeHours,
                reason: detailTarget.reason,
                status: "PENDING",
                employee: {
                  id: detailTarget.employee.id,
                  fullName: detailTarget.employee.fullName,
                  employeeCode: detailTarget.employee.employeeCode || "--",
                  department: detailTarget.employee.department,
                },
              }
            : null
        }
        isOpen={detailTarget !== null}
        onClose={() => setDetailTarget(null)}
        onApprove={async (id) => {
          await handleAction(id, "approve")
        }}
        onReject={async (id, reason) => {
          await handleAction(id, "reject", reason)
        }}
      />
    </div>
  )
}
