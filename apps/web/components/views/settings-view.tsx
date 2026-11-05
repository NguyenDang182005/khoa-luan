"use client"

import { useCallback, useState } from "react"
import { AlertTriangle } from "lucide-react"
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

const NAV_ITEMS: Array<{ id: SettingsTab; label: string; hint: string }> = [
  { id: "salary", label: "Lương & thuế", hint: "BHXH, thuế, hệ số OT theo năm" },
  { id: "geofence", label: "Vùng chấm công", hint: "Tọa độ + bán kính check-in GPS" },
  { id: "integrations", label: "Tích hợp", hint: "Trạng thái DB / n8n / Slack / Gemini (embedding)" },
  { id: "leave", label: "Phép năm", hint: "Quota chuẩn, pro-rate năm đầu" },
  { id: "security", label: "Bảo mật & phiên", hint: "Mật khẩu, khóa tài khoản, phiên đăng nhập" },
  { id: "ai", label: "AI Agent", hint: "Bật/tắt agent, kết nối n8n" },
  { id: "audit", label: "Nhật ký thay đổi", hint: "Ai sửa gì, lúc nào" },
]

/**
 * Trang Cài đặt hệ thống (ADMIN) — sidebar trái + panel phải.
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
      // Bỏ thay đổi → xóa dấu "chưa lưu" của section đang rời
      setDirtyMap((prev) => ({ ...prev, [active]: false }))
      setActive(pendingTab)
      setPendingTab(null)
    }
  }

  const activeItem = NAV_ITEMS.find((n) => n.id === active)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h1 font-semibold text-foreground">Cài đặt hệ thống</h1>
        <p className="mt-1 text-body text-muted-foreground">
          Cấu hình vận hành, nhân sự, bảo mật và AI Agent — dành cho quản trị viên.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        {/* Sub-nav — cuộn ngang dưới lg, cột 220px từ lg */}
        <nav
          className="min-w-0 rounded-lg border border-border bg-card p-2 lg:self-start"
          aria-label="Nhóm cài đặt"
        >
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {NAV_ITEMS.map(({ id, label, hint }) => {
              const isActive = id === active
              const isDirty = Boolean(dirtyMap[id])
              return (
                <li key={id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => requestTab(id)}
                    title={hint}
                    aria-current={isActive ? "page" : undefined}
                    data-state={isActive ? "active" : "inactive"}
                    className={cn(
                      "flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-body transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-secondary-foreground hover:bg-sunken hover:text-foreground",
                    )}
                  >
                    <span className="whitespace-nowrap">{label}</span>
                    {isDirty && (
                      <span className="ml-auto flex shrink-0 items-center pl-1">
                        <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
                        <span className="sr-only">có thay đổi chưa lưu</span>
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Panel phải — chỉ render section đang active */}
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h2 className="text-h2 font-semibold text-foreground">{activeItem?.label}</h2>
            <p className="mt-1 text-body-sm text-muted-foreground">{activeItem?.hint}</p>
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
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning-tint text-warning">
                <AlertTriangle className="size-4" />
              </span>
              Có thay đổi chưa lưu
            </DialogTitle>
            <DialogDescription>
              Mục &quot;{activeItem?.label}&quot; đang có thay đổi chưa lưu. Rời khỏi đây sẽ mất các thay đổi đó.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingTab(null)}>
              Ở lại sửa tiếp
            </Button>
            <Button variant="destructive" onClick={confirmLeave}>
              Rời bỏ thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
