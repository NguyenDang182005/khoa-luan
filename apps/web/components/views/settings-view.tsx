"use client"

import { useCallback, useState } from "react"
import {
  Banknote,
  MapPin,
  PlugZap,
  CalendarDays,
  ShieldCheck,
  Bot,
  History,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import { SalarySection } from "@/components/views/settings/salary-section"
import { GeofenceSection } from "@/components/views/settings/geofence-section"
import { IntegrationsSection } from "@/components/views/settings/integrations-section"
import { LeavePolicySection } from "@/components/views/settings/leave-policy-section"
import { SecuritySection } from "@/components/views/settings/security-section"
import { AiAgentSection } from "@/components/views/settings/ai-agent-section"
import { AuditLogSection } from "@/components/views/settings/audit-log-section"

type SettingsTab = "salary" | "geofence" | "integrations" | "leave" | "security" | "ai" | "audit"

const NAV_ITEMS: Array<{ id: SettingsTab; label: string; icon: typeof Banknote; hint: string }> = [
  { id: "salary", label: "Lương & Thuế", icon: Banknote, hint: "BHXH, thuế, hệ số OT theo năm" },
  { id: "geofence", label: "Vùng Chấm Công", icon: MapPin, hint: "Tọa độ + bán kính check-in GPS" },
  { id: "integrations", label: "Tích Hợp", icon: PlugZap, hint: "Trạng thái DB / n8n / Slack / Gemini" },
  { id: "leave", label: "Phép Năm", icon: CalendarDays, hint: "Quota, thâm niên, carry-over" },
  { id: "security", label: "Bảo Mật & Phiên", icon: ShieldCheck, hint: "Mật khẩu, khóa tài khoản, phiên đăng nhập" },
  { id: "ai", label: "AI Agent", icon: Bot, hint: "Bật/tắt agent, kết nối n8n" },
  { id: "audit", label: "Nhật Ký Thay Đổi", icon: History, hint: "Ai sửa gì, lúc nào" },
]

/**
 * Trang Cài Đặt Hệ Thống (ADMIN) — sidebar trái + panel phải.
 * Mỗi section tự quản state và báo dirty qua onDirtyChange;
 * chuyển section khi dirty sẽ hiện dialog xác nhận rời bỏ.
 */
export function SettingsView() {
  const [active, setActive] = useState<SettingsTab>("salary")
  const [dirtyMap, setDirtyMap] = useState<Partial<Record<SettingsTab, boolean>>>({})
  const [pendingTab, setPendingTab] = useState<SettingsTab | null>(null)

  const markDirty = useCallback(
    (tab: SettingsTab) => (dirty: boolean) => {
      setDirtyMap((prev) => (prev[tab] === dirty ? prev : { ...prev, [tab]: dirty }))
    },
    [],
  )

  const requestTab = (tab: SettingsTab) => {
    if (tab === active) return
    if (dirtyMap[active]) {
      setPendingTab(tab) // mở dialog xác nhận
    } else {
      setActive(tab)
    }
  }

  const confirmLeave = () => {
    if (pendingTab) {
      setActive(pendingTab)
      setPendingTab(null)
    }
  }

  const activeItem = NAV_ITEMS.find((n) => n.id === active)

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Cài Đặt Hệ Thống</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cấu hình vận hành, nhân sự, bảo mật và AI Agent — dành cho quản trị viên.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
        {/* Sidebar trái */}
        <nav className="lg:w-56 shrink-0" aria-label="Nhóm cài đặt">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV_ITEMS.map(({ id, label, icon: Icon, hint }) => {
              const isActive = id === active
              const isDirty = Boolean(dirtyMap[id])
              return (
                <li key={id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => requestTab(id)}
                    title={hint}
                    data-state={isActive ? "active" : "inactive"}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", isActive ? "text-agent-teal" : "")} />
                    <span className="whitespace-nowrap lg:whitespace-normal">{label}</span>
                    {isDirty && (
                      <span className="ml-auto size-1.5 shrink-0 rounded-full bg-agent-amber" title="Có thay đổi chưa lưu" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Panel phải — chỉ render section đang active */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-foreground">{activeItem?.label}</h2>
            <span className="text-[11px] text-muted-foreground">{activeItem?.hint}</span>
          </div>
          {active === "salary" && <SalarySection onDirtyChange={markDirty("salary")} />}
          {active === "geofence" && <GeofenceSection onDirtyChange={markDirty("geofence")} />}
          {active === "integrations" && <IntegrationsSection />}
          {active === "leave" && <LeavePolicySection onDirtyChange={markDirty("leave")} />}
          {active === "security" && <SecuritySection onDirtyChange={markDirty("security")} />}
          {active === "ai" && <AiAgentSection onDirtyChange={markDirty("ai")} />}
          {active === "audit" && <AuditLogSection />}
        </div>
      </div>

      {/* Dialog cảnh báo rời section còn dirty */}
      <Dialog open={pendingTab !== null} onOpenChange={(open) => !open && setPendingTab(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-agent-amber" /> Có thay đổi chưa lưu
            </DialogTitle>
            <DialogDescription>
              Section &quot;{activeItem?.label}&quot; đang có thay đổi chưa lưu. Rời khỏi đây sẽ mất các thay đổi đó.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setPendingTab(null)}>
              Ở lại sửa tiếp
            </Button>
            <Button size="sm" variant="destructive" onClick={confirmLeave}>
              Rời bỏ thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
