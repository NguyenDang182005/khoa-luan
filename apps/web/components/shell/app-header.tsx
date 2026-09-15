"use client"

import * as React from "react"
import { Search, Sparkles, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import type { AuthUser } from "@/lib/auth-context"

interface AppHeaderProps {
  user: AuthUser
  onLogout: () => void
  onOpenSearch: () => void
}

export function AppHeader({ user, onLogout, onOpenSearch }: AppHeaderProps) {
  const roleBadgeColor =
    user.role === "ADMIN"
      ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
      : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"

  const userInitials = user.employee?.fullName
    ? user.employee.fullName
        .split(" ")
        .map((w) => w[0])
        .slice(-2)
        .join("")
        .toUpperCase()
    : "AD"

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-shell px-4 z-20">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
          <Sparkles className="size-4" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
            HR Multi-Agent Platform
            <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-mono text-primary font-bold">Enterprise</span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">NestJS 11 • n8n • Gemini 2.5</p>
        </div>
      </div>

      <div className="hidden items-center gap-3 md:flex">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          <span className="text-[11px] font-medium text-foreground">API :3001</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-[11px] font-medium text-foreground">n8n :5678</span>
        </div>

        {user.role !== "EMPLOYEE" && (
          <Button variant="outline" size="sm" className="h-8 gap-2 border-border bg-muted/40 text-xs text-muted-foreground" onClick={onOpenSearch}>
            <Search className="size-3.5" />
            Tim kiem nhanh
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[9px] font-mono">C-k</kbd>
          </Button>
        )}

        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <Avatar initials={userInitials} className="size-8 bg-primary/20 text-primary border border-primary/30" />
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-foreground leading-tight">{user.employee?.fullName || user.email}</span>
            <span className={`text-[9px] font-mono px-1 py-0.5 rounded-sm border inline-block w-fit mt-0.5 ${roleBadgeColor}`}>{user.role}</span>
          </div>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-1" title="Dang xuat" onClick={onLogout}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
