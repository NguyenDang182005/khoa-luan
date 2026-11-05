"use client"

import * as React from "react"
import { Headset, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAiSocket, type NotificationEvent } from "@/lib/hooks/useAiSocket"

/** Sự kiện trình duyệt để màn Tiếp quản CSKH tải lại hàng đợi ngay, không chờ vòng poll 10s. */
export const ESCALATION_EVENT = "hr:escalation"

const MAX_ALERTS = 3

/**
 * Lắng nghe 'notification:new' (WebSocket /notifications) cho ADMIN trên mọi màn hình.
 * Hiện thẻ cảnh báo góc dưới phải và phát ESCALATION_EVENT cho màn CSKH.
 */
export function EscalationAlert({
  userId,
  onOpen,
}: {
  userId: string
  onOpen: () => void
}) {
  const [alerts, setAlerts] = React.useState<NotificationEvent[]>([])

  const handleNotification = React.useCallback((n: NotificationEvent) => {
    setAlerts((prev) => [n, ...prev.filter((a) => a.id !== n.id)].slice(0, MAX_ALERTS))
    window.dispatchEvent(new CustomEvent(ESCALATION_EVENT, { detail: n }))
  }, [])

  useAiSocket({ userId, isAdmin: true, onNotification: handleNotification })

  const dismiss = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id))

  if (alerts.length === 0) return null

  return (
    <div
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-40 flex w-[min(360px,calc(100%-2rem))] flex-col gap-2"
    >
      {alerts.map((a) => (
        <div
          key={a.id}
          role="alert"
          className="rounded-lg border border-danger/40 bg-card p-3 shadow-modal animate-in fade-in-0 slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-danger-tint text-danger">
              <Headset className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-semibold text-foreground">{a.title}</p>
              <p className="mt-0.5 line-clamp-2 text-caption text-muted-foreground">{a.body}</p>
              {a.data?.lastMessage && (
                <p className="mt-1 line-clamp-2 text-caption italic text-secondary-foreground">
                  “{a.data.lastMessage}”
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Đóng cảnh báo"
              onClick={() => dismiss(a.id)}
              className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-2.5 flex justify-end">
            <Button
              size="xs"
              variant="destructive"
              onClick={() => {
                dismiss(a.id)
                onOpen()
              }}
            >
              Mở Tiếp quản CSKH
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
