"use client"

import * as React from "react"
import { PanelLeftClose, PanelLeftOpen, UsersRound } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  group: string
}

interface AppSidebarProps {
  navItems: NavItem[]
  activeTab: string
  onTabChange: (id: string) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}

export function AppSidebar({
  navItems, activeTab, onTabChange, collapsed, onToggleCollapsed, mobileOpen, onMobileOpenChange,
}: AppSidebarProps) {
  // Gom theo nhóm, giữ thứ tự xuất hiện trong navItems
  const groups = React.useMemo(() => {
    const map = new Map<string, NavItem[]>()
    for (const item of navItems) {
      const list = map.get(item.group) ?? []
      list.push(item)
      map.set(item.group, list)
    }
    return [...map.entries()]
  }, [navItems])

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[var(--overlay)] animate-in fade-in-0 duration-150 lg:hidden"
          onClick={() => onMobileOpenChange(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[transform,width] duration-200 ease-out",
          "lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-modal lg:shadow-none" : "-translate-x-full",
          collapsed && "lg:w-[72px]",
        )}
      >
        <div className={cn("flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4", collapsed && "lg:justify-center lg:px-0")}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <UsersRound className="size-[18px]" />
          </span>
          <span className={cn("truncate text-body font-semibold text-foreground", collapsed && "lg:hidden")}>HR Multi-Agent</span>
        </div>

        <nav aria-label="Điều hướng chính" className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
          {groups.map(([group, items]) => (
            <div key={group} className="flex flex-col gap-0.5">
              <p className={cn("mb-1 px-2.5 text-micro font-medium uppercase tracking-[0.04em] text-muted-foreground", collapsed && "lg:sr-only")}>
                {group}
              </p>
              {items.map((item) => {
                const Icon = item.icon
                const isSelected = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onTabChange(item.id)
                      onMobileOpenChange(false)
                    }}
                    aria-current={isSelected ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-body-sm font-medium transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
                      isSelected
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                      collapsed && "lg:justify-center lg:px-0",
                    )}
                  >
                    <Icon className={cn("size-[18px] shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                    <span className={cn("truncate", collapsed && "lg:sr-only")}>{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-sidebar-border p-3 lg:block">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-body font-medium text-sidebar-foreground transition-colors hover:bg-muted",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed
              ? <PanelLeftOpen className="size-[18px] text-muted-foreground" />
              : <PanelLeftClose className="size-[18px] text-muted-foreground" />}
            <span className={cn(collapsed && "sr-only")}>Thu gọn</span>
          </button>
        </div>
      </aside>
    </>
  )
}
