"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  id?: string
}

/**
 * Toggle switch — hand-rolled theo pattern của tabs.tsx (không phụ thuộc thư viện ngoài).
 * Dùng trong trang Cài Đặt cho các lựa chọn bật/tắt.
 */
function Switch({ checked, defaultChecked, onCheckedChange, disabled, className, id }: SwitchProps) {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false)
  const isChecked = checked !== undefined ? checked : internalChecked

  const handleToggle = React.useCallback(() => {
    if (disabled) return
    const next = !isChecked
    if (checked === undefined) setInternalChecked(next)
    onCheckedChange?.(next)
  }, [checked, disabled, isChecked, onCheckedChange])

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={isChecked}
      data-slot="switch"
      data-state={isChecked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={handleToggle}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        isChecked ? "bg-primary" : "bg-input",
        className
      )}
    >
      <span
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-card shadow-xs ring-0 transition-transform",
          isChecked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

export { Switch }
