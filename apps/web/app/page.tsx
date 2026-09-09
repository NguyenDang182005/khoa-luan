"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Users,
  Coins,
  Bot,
  ShieldAlert,
  Award,
  UserCheck,
  Settings,
  Bell,
  Search,
  Sparkles,
  ChevronDown,
  Command,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"

// Views
import { DashboardView } from "@/components/views/dashboard-view"
import { EmployeesView } from "@/components/views/employees-view"
import { PayrollView } from "@/components/views/payroll-view"
import { AiAgentsView } from "@/components/views/ai-agents-view"
import { CskhEscalationView } from "@/components/views/cskh-escalation-view"
import { TrainingAnalyticsView } from "@/components/views/training-analytics-view"
import { EmployeePortalView } from "@/components/views/employee-portal-view"

type NavigationTab =
  | "dashboard"
  | "employees"
  | "payroll"
  | "ai-agents"
  | "cskh-escalation"
  | "training-analytics"
  | "employee-portal"

interface NavItem {
  id: NavigationTab
  label: string
  icon: any
  badge?: string
  badgeColor?: "teal" | "coral" | "amber" | "destructive"
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Bảng Điều Hành", icon: LayoutDashboard },
  { id: "employees", label: "Hồ Sơ Nhân Sự", icon: Users },
  { id: "payroll", label: "Bảng Lương & Thuế", icon: Coins },
  { id: "ai-agents", label: "AI Multi-Agents", icon: Bot, badge: "n8n", badgeColor: "teal" },
  { id: "cskh-escalation", label: "Tiếp Quản CSKH & PII", icon: ShieldAlert, badge: "!", badgeColor: "coral" },
  { id: "training-analytics", label: "Đào Tạo & Radar AI", icon: Award, badge: "Hybrid", badgeColor: "amber" },
  { id: "employee-portal", label: "Cổng Nhân Viên (ESS)", icon: UserCheck },
]

export default function Home() {
  const [activeTab, setActiveTab] = React.useState<NavigationTab>("dashboard")
  const [role, setRole] = React.useState<"admin" | "employee">("admin")
  const [searchOpen, setSearchOpen] = React.useState(false)

  // Switch to employee portal when role is employee
  const handleRoleChange = (newRole: "admin" | "employee") => {
    setRole(newRole)
    if (newRole === "employee") {
      setActiveTab("employee-portal")
    } else {
      setActiveTab("dashboard")
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      {/* TOP SHELL HEADER */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-shell px-4 z-20">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
            <Sparkles className="size-4" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
              HR Multi-Agent Platform
              <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[9px] font-mono text-primary font-bold">
                Enterprise
              </span>
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              NestJS 11 • n8n • Gemini 3.5
            </p>
          </div>
        </div>

        {/* Search Modal Trigger & Status */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium text-foreground">API :3001</span>
            <span className="text-muted-foreground/40">•</span>
            <span className="size-2 rounded-full bg-agent-teal animate-pulse" />
            <span className="text-[11px] font-medium text-foreground">n8n :5678</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 border-border bg-muted/40 text-xs text-muted-foreground"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="size-3.5" />
            Tìm kiếm nhanh
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[9px] font-mono">⌘ K</kbd>
          </Button>

          {/* Role Switcher */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            <button
              onClick={() => handleRoleChange("admin")}
              className={`rounded-md px-2.5 py-1 transition-all ${
                role === "admin"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              HR Admin
            </button>
            <button
              onClick={() => handleRoleChange("employee")}
              className={`rounded-md px-2.5 py-1 transition-all ${
                role === "employee"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Nhân Viên (ESS)
            </button>
          </div>

          {/* Notifications Bell */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => setActiveTab("cskh-escalation")}
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            <span className="absolute right-1.5 top-1.5 flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-agent-coral opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-agent-coral" />
            </span>
          </Button>

          <Avatar initials={role === "admin" ? "AD" : "NĐ"} className="bg-primary/20 text-primary border border-primary/30" />
        </div>
      </header>

      {/* Global Search Dialog Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
          <div className="relative z-50 w-[min(540px,calc(100%-2rem))] rounded-xl border border-border bg-card p-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                autoFocus
                placeholder="Tìm nhân viên, quy chế, agent hoặc phiên chat..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>
            <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
              <p className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground mb-1">
                Gợi ý nhanh
              </p>
              <button
                className="flex items-center justify-between rounded-lg p-2 text-left hover:bg-muted/50 text-foreground"
                onClick={() => {
                  setActiveTab("ai-agents")
                  setSearchOpen(false)
                }}
              >
                <span>🤖 Chat với WF02 - Tra cứu ngày phép & chế độ</span>
                <span className="text-[10px] text-muted-foreground">AI Agent</span>
              </button>
              <button
                className="flex items-center justify-between rounded-lg p-2 text-left hover:bg-muted/50 text-foreground"
                onClick={() => {
                  setActiveTab("payroll")
                  setSearchOpen(false)
                }}
              >
                <span>💰 Mở bảng lương tháng 09 & chạy Rule Engine</span>
                <span className="text-[10px] text-muted-foreground">Bảng Lương</span>
              </button>
              <button
                className="flex items-center justify-between rounded-lg p-2 text-left hover:bg-muted/50 text-foreground"
                onClick={() => {
                  setActiveTab("cskh-escalation")
                  setSearchOpen(false)
                }}
              >
                <span>🚨 Tiếp quản trường hợp khiếu nại Zalo khẩn cấp</span>
                <span className="text-[10px] text-agent-coral font-semibold">Cảnh Báo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BODY CONTENT: LEFT ICON RAIL + MAIN CONTENT AREA */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT ICON RAIL */}
        <aside className="w-16 shrink-0 flex flex-col items-center gap-3 border-r border-border bg-rail py-4 z-10">
          {navItems.map((item) => {
            const Icon = item.icon
            const isSelected = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                className={`group relative flex size-10 items-center justify-center rounded-xl transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                }`}
              >
                <Icon className="size-5" />
                {item.badge && (
                  <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-agent-coral text-[9px] font-bold text-white shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}

          <div className="mt-auto flex flex-col items-center gap-3">
            <button
              onClick={() => setActiveTab("payroll")}
              title="Cài đặt hệ thống"
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
            >
              <Settings className="size-4" />
            </button>
            <Avatar initials={role === "admin" ? "AD" : "NĐ"} className="size-8 bg-avatar-sand text-foreground" />
          </div>
        </aside>

        {/* MAIN WORKSPACE CANVAS */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-background">
          {activeTab === "dashboard" && <DashboardView />}
          {activeTab === "employees" && <EmployeesView />}
          {activeTab === "payroll" && <PayrollView />}
          {activeTab === "ai-agents" && <AiAgentsView />}
          {activeTab === "cskh-escalation" && <CskhEscalationView />}
          {activeTab === "training-analytics" && <TrainingAnalyticsView />}
          {activeTab === "employee-portal" && <EmployeePortalView />}
        </main>
      </div>
    </main>
  )
}
