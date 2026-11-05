"use client"

import * as React from "react"
import {
  LayoutDashboard, Users, Wallet, Sparkles, Headset, Radar, GraduationCap, IdCard, Settings, Search,
} from "lucide-react"
import { isAdminRole } from "@repo/shared-types"
import type { LucideIcon } from "lucide-react"

import { AuthProvider, useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { employeesApi } from "@/lib/api/employees.api"
import type { Employee } from "@/lib/schemas/employee.schema"
import { LoginView } from "@/components/auth/login-view"
import { AppHeader } from "@/components/shell/app-header"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { EscalationAlert } from "@/components/shell/escalation-alert"

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
  group: string
}

// Thứ tự mảng = thứ tự trong sidebar admin; group là nhóm hiển thị cho admin
const ALL_NAV_ITEMS: NavItem[] = [
  { id: "dashboard",          label: "Bảng điều hành",     icon: LayoutDashboard, group: "Tổng quan" },
  { id: "employees",          label: "Hồ sơ nhân sự",      icon: Users,           group: "Nhân sự" },
  { id: "payroll",            label: "Bảng lương & thuế",  icon: Wallet,          group: "Nhân sự" },
  { id: "ai-agents",          label: "Trợ lý AI",          icon: Sparkles,        group: "Vận hành AI" },
  { id: "cskh-escalation",    label: "Tiếp quản CSKH",     icon: Headset,         group: "Vận hành AI" },
  { id: "training-analytics", label: "Đào tạo & Radar AI", icon: Radar,           group: "Phát triển" },
  { id: "my-training",        label: "Kết quả đào tạo",    icon: GraduationCap,   group: "Phát triển" },
  { id: "employee-portal",    label: "Cổng nhân viên",     icon: IdCard,          group: "Cá nhân" },
  { id: "settings",           label: "Cài đặt",            icon: Settings,        group: "Hệ thống" },
]

// Màn tự quản chiều cao (layout nhiều cột cố định) — main không thêm padding/max-width
const FULL_BLEED_TABS: NavigationTab[] = ["ai-agents"]
const SIDEBAR_COLLAPSED_KEY = "hr-sidebar-collapsed"

// ─── Search Modal ────────────────────────────────────────────────────────────
function SearchModal({
  query, results, onClose, onChange, searching,
}: {
  query: string
  results: { key: string; label: string; hint: string; action: () => void }[]
  onClose: () => void
  onChange: (q: string) => void
  searching?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div className="fixed inset-0 bg-[var(--overlay)] animate-in fade-in-0 duration-150" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Tìm kiếm nhanh" className="relative z-50 w-[min(560px,calc(100%-2rem))] rounded-xl border border-border bg-card shadow-modal animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Search className="size-[18px] text-muted-foreground" />
          <input
            autoFocus value={query} onChange={(e) => onChange(e.target.value)}
            placeholder="Tìm trang, nhân viên, chức năng..."
            aria-label="Từ khoá tìm kiếm"
            className="w-full bg-transparent text-body outline-none placeholder:text-subtle-foreground"
          />
          <kbd className="rounded-sm border border-border bg-muted px-1.5 font-mono text-micro text-muted-foreground">Esc</kbd>
        </div>
        <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto p-2">
          <p className="px-3 pb-1 pt-2 text-caption font-medium text-muted-foreground">
            {query ? "Kết quả" : "Gợi ý nhanh"}
          </p>
          {searching && (
            <p className="px-3 py-2 text-body-sm text-muted-foreground">Đang tìm nhân viên…</p>
          )}
          {results.length === 0
            ? !searching && <p className="px-3 py-6 text-center text-body-sm text-muted-foreground">Không tìm thấy kết quả.</p>
            : results.map((r) => (
              <button key={r.key} onClick={r.action}
                className="flex h-10 items-center justify-between gap-3 rounded-md px-3 text-left text-body-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 text-caption text-muted-foreground">{r.hint}</span>
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
  const [employeeResults, setEmployeeResults] = React.useState<Employee[]>([])
  const [employeeSearchLoading, setEmployeeSearchLoading] = React.useState(false)
  const [employeeSearch, setEmployeeSearch] = React.useState("")
  const [aiAgentPreset, setAiAgentPreset] = React.useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  // Nhớ trạng thái thu gọn sidebar theo trình duyệt
  React.useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") setSidebarCollapsed(true)
    } catch {
      // storage bị chặn (private mode) — giữ mặc định mở rộng
    }
  }, [])
  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((v) => {
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? "0" : "1")
      } catch {
        // không lưu được thì chỉ áp dụng cho phiên hiện tại
      }
      return !v
    })
  }, [])

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
        .map((item) => ({ ...item, group: "Của tôi" }))
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
      if (e.key === "Escape") {
        setSearchOpen(false)
        setMobileNavOpen(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [user])

  // Tìm nhân viên thật trong global search (chỉ ADMIN) — debounce 250ms
  React.useEffect(() => {
    const q = searchQuery.trim()
    if (!searchOpen || q.length < 2 || !user || !isAdminRole(user.role)) {
      setEmployeeResults([])
      setEmployeeSearchLoading(false)
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setEmployeeSearchLoading(true)
      try {
        const res = await employeesApi.list({ search: q, limit: 5 })
        if (!cancelled) setEmployeeResults(res.data)
      } catch {
        if (!cancelled) setEmployeeResults([])
      } finally {
        if (!cancelled) setEmployeeSearchLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery, searchOpen, user])

  const handleEmployeeSearchApplied = React.useCallback(() => setEmployeeSearch(""), [])

  const searchResults = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const employeeMatches = employeeResults.map((emp) => ({
      key: `emp-${emp.id}`,
      label: emp.fullName,
      hint: `${emp.employeeCode} · ${emp.department.name}`,
      action: () => {
        setEmployeeSearch(emp.fullName)
        setActiveTab("employees")
        setSearchOpen(false)
      },
    }))
    const navMatches = navItems
      .filter((i) => !q || i.label.toLowerCase().includes(q))
      .map((i) => ({ key: `nav-${i.id}`, label: i.label, hint: "Chuyển trang", action: () => { setActiveTab(i.id); setSearchOpen(false) } }))
    const quickLinks = [
      { key: "q-wf02",   label: "Giám sát WF02 - Tra cứu ngày phép", hint: "AI Agent",   tab: "ai-agents"       as NavigationTab, adminOnly: false },
      { key: "q-payroll",label: "Mở bảng lương & chạy Rule Engine",   hint: "Bảng lương", tab: "payroll"         as NavigationTab, adminOnly: true },
      { key: "q-cskh",   label: "Tiếp quản khiếu nại Zalo khẩn cấp",  hint: "Cảnh báo",   tab: "cskh-escalation" as NavigationTab, adminOnly: true },
    ]
      .filter((i) => !i.adminOnly || (user && isAdminRole(user.role)))
      .filter((i) => !q || i.label.toLowerCase().includes(q))
      .map((i) => ({ key: i.key, label: i.label, hint: i.hint, action: () => { setActiveTab(i.tab); setSearchOpen(false) } }))
    return [...employeeMatches, ...navMatches, ...quickLinks]
  }, [searchQuery, navItems, user, employeeResults])

  if (!isAuthenticated || !user) return <LoginView />

  const activeItem = navItems.find((i) => i.id === activeTab)
  const fullBleed = FULL_BLEED_TABS.includes(activeTab)

  return (
    <div className="flex h-full bg-background text-foreground">
      {/* SIDEBAR — 240px, thu gọn 72px; dưới 1024px thành drawer */}
      <AppSidebar
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={(id) => {
          if (id === "ai-agents") setAiAgentPreset(null)
          setActiveTab(id as NavigationTab)
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* HEADER — cố định trên cùng */}
        <AppHeader
          user={user}
          groupLabel={activeItem?.group}
          pageLabel={activeItem?.label ?? ""}
          onLogout={logout}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMenu={() => setMobileNavOpen(true)}
        />

        {/* CONTENT — chỉ vùng này cuộn */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-background">
          <div className={cn(!fullBleed && "mx-auto w-full max-w-[1440px] px-4 py-5 md:px-6 lg:py-6 xl:px-8")}>
            {activeTab === "dashboard"          && user.role === "ADMIN"       && <DashboardView />}
            {activeTab === "employees"          && user.role === "ADMIN"       && (
              <EmployeesView
                initialSearch={employeeSearch}
                onInitialSearchApplied={handleEmployeeSearchApplied}
              />
            )}
            {activeTab === "payroll"            && isAdminRole(user.role)      && <PayrollView />}
            {activeTab === "ai-agents"                                         && (
              <AiAgentsView
                initialAgentId={aiAgentPreset}
                onNavigate={(t) => setActiveTab(t as NavigationTab)}
              />
            )}
            {activeTab === "cskh-escalation"                                   && <CskhEscalationView />}
            {activeTab === "training-analytics" && user.role === "ADMIN"       && <TrainingAnalyticsView />}
            {activeTab === "employee-portal"                                   && <EmployeePortalView />}
            {activeTab === "my-training"        && user.role === "EMPLOYEE"    && (
              <MyTrainingView
                onStartTraining={() => {
                  setAiAgentPreset("wf03")
                  setActiveTab("ai-agents")
                }}
              />
            )}
            {activeTab === "settings"           && user.role === "ADMIN"       && <SettingsView />}
          </div>
        </main>
      </div>

      {/* Cảnh báo leo thang CSKH realtime (notification:new) cho ADMIN */}
      {isAdminRole(user.role) && (
        <EscalationAlert userId={user.id} onOpen={() => setActiveTab("cskh-escalation")} />
      )}

      {/* SEARCH MODAL */}
      {searchOpen && (
        <SearchModal
          query={searchQuery}
          results={searchResults}
          onClose={() => setSearchOpen(false)}
          onChange={setSearchQuery}
          searching={employeeSearchLoading}
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
