"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error("Tabs compound components must be used within Tabs")
  }
  return context
}

function Tabs({
  value,
  onValueChange,
  defaultValue,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "")
  const currentValue = value !== undefined ? value : internalValue

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue)
      }
      onValueChange?.(newValue)
    },
    [value, onValueChange]
  )

  return (
    <TabsContext.Provider
      value={{ value: currentValue, onValueChange: handleValueChange }}
    >
      <div data-slot="tabs" className={cn("flex flex-col", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  value,
  className,
  ...props
}: React.ComponentProps<"button"> & { value: string }) {
  const { value: activeValue, onValueChange } = useTabs()
  const isActive = activeValue === value

  return (
    <button
      type="button"
      data-slot="tabs-trigger"
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={() => onValueChange(value)}
      {...props}
    />
  )
}

function TabsContent({
  value,
  className,
  ...props
}: React.ComponentProps<"div"> & { value: string }) {
  const { value: activeValue } = useTabs()
  if (activeValue !== value) return null

  return (
    <div
      data-slot="tabs-content"
      className={cn("mt-2 ring-offset-background focus-visible:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
