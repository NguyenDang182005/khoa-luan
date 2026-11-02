"use client"

import * as React from "react"
import {
  LayoutDashboard, Users, Coins, Bot, ShieldAlert, Award, UserCheck, Settings, Search,
} from "lucide-react"
import { isAdminRole } from "@repo/shared-types"
import type { LucideIcon } from "lucide-react"

import { AuthProvider, useAuth } from "@/lib/auth-context"
import { LoginView } from "@/components/auth/login-view"
import { AppHeader } from "@/components/shell/app-header"
import { AppSidebar } from "@/components/shell/app-sidebar"

import { DashboardView } from "@/components/views/dashboard-view"
import { EmployeesView } from "@/components/views/employees-view"
import { PayrollView } from "@/components/views/payroll-view"
import { AiAgentsView } from "@/components/views/ai-agents-view"
import { CskhEscalationView } from "@/components/views/cskh-escalation-view"
import { TrainingAnalyticsView } from "@/components/views/training-analytics-view"
import { EmployeePortalView } from "@/components/views/employee-portal-view"
import { MyTrainingView } from "@/components/views/my-training-view"
import { SettingsView } from "@/components/views/settings-view"

type NavigationTab =
  | "dashboard" | "employees" | "payroll" | "ai-agents"
  | "cskh-escalation" | "training-analytics" | "employee-portal"
  | "my-training" | "settings"

interface NavItem {
  id: NavigationTab
  label: string
  icon: LucideIcon
}

const ALL_NAV_ITEMS: NavItem[] = [
  { id: "dashboard",         label: "Bảng Điều Hành",         icon: LayoutDashboard },
  { id: "employees",         label: "Hồ Sơ Nhân Sự",          icon: Users },
  { id: "payroll",           label: "Bảng Lương & Thuế",      icon: Coins },
  { id: "ai-agents",         label: "AI Multi-Agents Sandbox", icon: Bot },
  { id: "cskh-escalation",   label: "Tiếp Quản CSKH & PII",   icon: ShieldAlert },
  { id: "training-analytics",label: "Đào Tạo & Radar AI",      icon: Award },
  { id: "employee-portal",   label: "Cổng Nhân Viên (ESS)",   icon: UserCheck },
  { id: "my-training",       label: "Kết Quả Đào Tạo",        icon: Award },
  { id: "settings",          label: "Cài Đặt Hệ Thống",       icon: Settings },
]

// ─── Search Modal ────────────────────────────────────────────────────────────
function SearchModal({
  query, results, onClose, onChange,
}: {
  query: string
  results: { key: string; label: string; hint: string; action: () => void }[]
  onClose: () => void
  onChange: (q: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-[min(540px,calc(100%-2rem))] rounded-xl border border-border bg-card p-4 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus value={query} onChange={(e) => onChange(e.target.value)}
            placeholder="Tìm trang, nhân viên, chức năng..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="mt-3 flex flex-col gap-1 text-xs">
          <p className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground mb-1">
            {query ? "Kết quả" : "Gợi ý nhanh"}
          </p>
          {results.length === 0
            ? <p className="p-2 text-muted-foreground">Không tìm thấy.</p>
            : results.map((r) => (
              <button key={r.key} onClick={r.action}
                className="flex items-center justify-between rounded-lg p-2 text-left hover:bg-muted/50 text-foreground"
              >
                <span>{r.label}</span>
                <span className="text-[10px] text-muted-foreground">{r.hint}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

// ─── App Shell ───────────────────────────────────────────────────────────────
function AppShell() {
  const { user, isAuthenticated, logout } = useAuth()
  const [activeTab, setActiveTab] = React.useState<NavigationTab>(
    user?.role === "EMPLOYEE" ? "employee-portal" : "dashboard",
  )  
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // RBAC: filter nav
  const navItems = React.useMemo<NavItem[]>(() => {
    if (!user) return []
    if (user.role === "EMPLOYEE") {
      const empOrder: NavigationTab[] = [
        "employee-portal",
        "my-training",
        "ai-agents",
      ]
      return empOrder
        .map((id) => ALL_NAV_ITEMS.find((item) => item.id === id))
        .filter((item): item is NavItem => item !== undefined)
    }
    return ALL_NAV_ITEMS.filter((i) => i.id !== "my-training")
  }, [user])

  // Auto-redirect if active tab not allowed
  React.useEffect(() => {
    if (navItems.length > 0 && !navItems.some((i) => i.id === activeTab)) {
      setActiveTab(navItems[0]!.id)
    }
  }, [navItems, activeTab])

  // Keyboard search shortcut
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
      if (e.key === "Escape") setSearchOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [user])

  const searchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const navMatches = navItems
      .filter((i) => !q || i.label.toLowerCase().includes(q))
      .map((i) => ({ key: `nav-${i.id}`, label: i.label, hint: "Chuyển trang", action: () => { setActiveTab(i.id); setSearchOpen(false) } }))
    const quickLinks = [
      { key: "q-wf02",   label: "Giám sát WF02 - Tra cứu ngày phép", hint: "AI Agent",  tab: "ai-agents"       as NavigationTab, adminOnly: false },
      { key: "q-payroll",label: "Mở bảng lương & chạy Rule Engine",   hint: "Bảng Lương", tab: "payroll"         as NavigationTab, adminOnly: true },
      { key: "q-cskh",   label: "Tiếp quản khiếu nại Zalo khẩn cấp",  hint: "Cảnh Báo",   tab: "cskh-escalation" as NavigationTab, adminOnly: true },
    ]
      .filter((i) => !i.adminOnly || (user && isAdminRole(user.role)))
      .filter((i) => !q || i.label.toLowerCase().includes(q))
      .map((i) => ({ key: i.key, label: i.label, hint: i.hint, action: () => { setActiveTab(i.tab); setSearchOpen(false) } }))
    return [...navMatches, ...quickLinks]
  }, [searchQuery, navItems, user])

  if (!isAuthenticated || !user) return <LoginView />

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* HEADER — cố định trên cùng */}
      <AppHeader user={user} onLogout={logout} onOpenSearch={() => setSearchOpen(true)} />

      {/* BODY — phần còn lại, không cuộn tổng thể */}
      <div className="flex flex-1 min-h-0">
        {/* SIDEBAR — cố định bên trái */}
        <AppSidebar
          navItems={navItems}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as NavigationTab)}
        />

        {/* CONTENT — chỉ vùng này cuộn */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-background">
          {activeTab === "dashboard"          && user.role === "ADMIN"       && <DashboardView />}
          {activeTab === "employees"          && user.role === "ADMIN"       && <EmployeesView />}
          {activeTab === "payroll"            && isAdminRole(user.role)      && <PayrollView />}
          {activeTab === "ai-agents"                                         && <AiAgentsView onNavigate={(t) => setActiveTab(t as NavigationTab)} />}
          {activeTab === "cskh-escalation"                                   && <CskhEscalationView />}
          {activeTab === "training-analytics" && user.role === "ADMIN"       && <TrainingAnalyticsView />}
          {activeTab === "employee-portal"                                   && <EmployeePortalView />}
          {activeTab === "my-training"        && user.role === "EMPLOYEE"    && <MyTrainingView />}
          {activeTab === "settings"           && user.role === "ADMIN"       && <SettingsView />}
        </main>
      </div>

      {/* SEARCH MODAL */}
      {searchOpen && (
        <SearchModal
          query={searchQuery}
          results={searchResults}
          onClose={() => setSearchOpen(false)}
          onChange={setSearchQuery}
        />
      )}
    </div>
  )
}

// ─── Root ────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
