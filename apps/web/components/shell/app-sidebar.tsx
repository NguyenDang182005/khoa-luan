"use client"

import * as React from "react"
import { LogOut } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  badge?: string
  badgeColor?: string
}

interface AppSidebarProps {
  navItems: NavItem[]
  activeTab: string
  onTabChange: (id: string) => void
  onLogout: () => void
  userInitials: string
}

export function AppSidebar({ navItems, activeTab, onTabChange, onLogout, userInitials }: AppSidebarProps) {
  return (
    <aside className="w-16 shrink-0 flex flex-col items-center gap-3 border-r border-border bg-rail py-4 z-10">
      {navItems.map((item) => {
        const Icon = item.icon
        const isSelected = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
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
          onClick={onLogout}
          title="Dang xuat he thong"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
        </button>
        <Avatar initials={userInitials} className="size-8 bg-avatar-sand text-foreground" />
      </div>
    </aside>
  )
}
