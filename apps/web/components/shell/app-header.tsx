"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, LogOut, Menu, Search } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import type { AuthUser } from "@/lib/auth-context"

interface AppHeaderProps {
  user: AuthUser
  groupLabel?: string
  pageLabel: string
  onLogout: () => void
  onOpenSearch: () => void
  onOpenMenu: () => void
}

export function AppHeader({ user, groupLabel, pageLabel, onLogout, onOpenSearch, onOpenMenu }: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  const userInitials = user.employee?.fullName
    ? user.employee.fullName
        .split(" ")
        .map((w) => w[0])
        .slice(-2)
        .join("")
        .toUpperCase()
    : "AD"
  const roleLabel = user.role === "ADMIN" ? "Quản trị viên" : user.role === "EMPLOYEE" ? "Nhân viên" : user.role

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-shell px-4 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Mở menu điều hướng"
        className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-body-sm">
        {groupLabel && (
          <>
            <span className="hidden whitespace-nowrap text-muted-foreground lg:inline">{groupLabel}</span>
            <ChevronRight className="hidden size-4 text-subtle-foreground lg:inline" />
          </>
        )}
        <span className="truncate font-medium text-foreground" aria-current="page">{pageLabel}</span>
      </nav>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {user.role !== "EMPLOYEE" && (
          <>
            <button
              type="button"
              onClick={onOpenSearch}
              className="hidden h-9 w-[240px] items-center gap-2 rounded-md border border-input bg-card px-3 text-body-sm text-subtle-foreground transition-colors hover:bg-sunken lg:flex xl:w-[320px]"
            >
              <Search className="size-4" />
              Tìm kiếm nhanh
              <kbd className="ml-auto rounded-sm border border-border bg-muted px-1.5 font-mono text-micro text-muted-foreground">Ctrl K</kbd>
            </button>
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Tìm kiếm nhanh"
              className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Search className="size-5" />
            </button>
          </>
        )}

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-10 items-center gap-2.5 rounded-md pl-1 pr-2 transition-colors hover:bg-muted"
          >
            <Avatar initials={userInitials} className="bg-primary-tint text-accent-foreground" />
            <span className="hidden text-left leading-tight lg:block">
              <span className="block max-w-40 truncate text-body-sm font-semibold text-foreground">{user.employee?.fullName || user.email}</span>
              <span className="block text-caption text-muted-foreground">{roleLabel}</span>
            </span>
            <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-lg border border-border bg-popover p-1.5 shadow-pop animate-in fade-in-0 zoom-in-95 duration-150">
              <div className="px-3 py-2">
                <p className="truncate text-body-sm font-semibold text-foreground">{user.employee?.fullName || user.email}</p>
                <p className="truncate text-caption text-muted-foreground">{user.email}</p>
              </div>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                className="flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-body-sm font-medium text-danger transition-colors hover:bg-danger-tint"
              >
                <LogOut className="size-4" />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
