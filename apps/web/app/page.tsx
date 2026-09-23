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
  { id: "dashboard",         label: "Bang Dieu Hanh",         icon: LayoutDashboard },
  { id: "employees",         label: "Ho So Nhan Su",          icon: Users },
  { id: "payroll",           label: "Bang Luong & Thue",      icon: Coins },
  { id: "ai-agents",         label: "AI Multi-Agents Sandbox", icon: Bot },
  { id: "cskh-escalation",   label: "Tiep Quan CSKH & PII",   icon: ShieldAlert },
  { id: "training-analytics",label: "Dao Tao & Radar AI",      icon: Award },
  { id: "employee-portal",   label: "Cong Nhan Vien (ESS)",   icon: UserCheck },
  { id: "my-training",       label: "Ket Qua Dao Tao",        icon: Award },
  { id: "settings",          label: "Cai Dat He Thong",       icon: Settings },
]

/** Tab duy nhat hien voi EMPLOYEE (whitelist: ESS + dao tao ca nhan).
 *  Dung whitelist thay vi blacklist de tab quan ly moi khong lo vao UI employee. */
const EMPLOYEE_TABS: Set<NavigationTab> = new Set(["employee-portal", "my-training"])

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
            placeholder="Tim trang, nhan vien, chuc nang..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="mt-3 flex flex-col gap-1 text-xs">
          <p className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground mb-1">
            {query ? "Ket qua" : "Goi y nhanh"}
          </p>
          {results.length === 0
            ? <p className="p-2 text-muted-foreground">Khong tim thay.</p>
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
    if (user.role === "EMPLOYEE") return ALL_NAV_ITEMS.filter((i) => EMPLOYEE_TABS.has(i.id))
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
        if (user && user.role !== "EMPLOYEE") setSearchOpen((v) => !v)
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
      .map((i) => ({ key: `nav-${i.id}`, label: i.label, hint: "Chuyen trang", action: () => { setActiveTab(i.id); setSearchOpen(false) } }))
    const quickLinks = [
      { key: "q-wf02",   label: "Giam sat WF02 - Tra cuu ngay phep", hint: "AI Agent",  tab: "ai-agents"       as NavigationTab, adminOnly: true },
      { key: "q-payroll",label: "Mo bang luong & chay Rule Engine",   hint: "Bang Luong", tab: "payroll"         as NavigationTab, adminOnly: false },
      { key: "q-cskh",   label: "Tiep quan khieu nai Zalo khan cap",  hint: "Canh Bao",   tab: "cskh-escalation" as NavigationTab, adminOnly: false },
    ]
      .filter((i) => !i.adminOnly || (user && isAdminRole(user.role)))
      .filter((i) => !q || i.label.toLowerCase().includes(q))
      .map((i) => ({ key: i.key, label: i.label, hint: i.hint, action: () => { setActiveTab(i.tab); setSearchOpen(false) } }))
    return [...navMatches, ...quickLinks]
  }, [searchQuery, navItems, user])

  const userInitials = user?.employee?.fullName
    ? user.employee.fullName.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase()
    : "AD"

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
          onLogout={logout}
          userInitials={userInitials}
        />

        {/* CONTENT — chỉ vùng này cuộn */}
        <main className="flex-1 min-w-0 overflow-y-auto bg-background">
          {activeTab === "dashboard"          && user.role === "ADMIN"       && <DashboardView />}
          {activeTab === "employees"          && user.role === "ADMIN"       && <EmployeesView />}
          {activeTab === "payroll"            && isAdminRole(user.role)      && <PayrollView />}
          {activeTab === "ai-agents"          && isAdminRole(user.role)      && <AiAgentsView />}
          {activeTab === "cskh-escalation"    && isAdminRole(user.role)      && <CskhEscalationView />}
          {activeTab === "training-analytics" && user.role === "ADMIN"       && <TrainingAnalyticsView />}
          {activeTab === "employee-portal"                                   && <EmployeePortalView />}
          {activeTab === "my-training"        && user.role === "EMPLOYEE"    && <MyTrainingView />}
          {activeTab === "settings"           && user.role === "ADMIN"       && <SettingsView />}
        </main>
      </div>

      {/* SEARCH MODAL */}
      {searchOpen && user.role !== "EMPLOYEE" && (
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
