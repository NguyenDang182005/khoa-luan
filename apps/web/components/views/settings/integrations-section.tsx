"use client"

import { useEffect, useState, useCallback } from "react"
import { PlugZap, Loader2, AlertTriangle, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { settingsApi } from "@/lib/api/settings.api"
import type { IntegrationStatus } from "@/lib/schemas/settings.schema"

function StatusDot({ status }: { status: IntegrationStatus["status"] }) {
  const { dot, text, label } =
    status === "ok"
      ? { dot: "bg-success", text: "text-success", label: "Hoạt động" }
      : status === "error"
        ? { dot: "bg-danger", text: "text-danger", label: "Lỗi" }
        : { dot: "bg-warning", text: "text-warning", label: "Chưa cấu hình" }
  return (
    <span className={`inline-flex items-center gap-1.5 text-caption font-medium ${text}`}>
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  )
}

export function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<Awaited<ReturnType<typeof settingsApi.getIntegrations>> | null>(null)
  const [pinging, setPinging] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setPinging(true)
    setLoadError(null)
    try {
      setIntegrations(await settingsApi.getIntegrations())
    } catch (e) {
      console.error(e)
      setLoadError("Không lấy được trạng thái tích hợp.")
    } finally {
      setPinging(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <PlugZap className="size-4 text-primary" /> Trạng thái tích hợp
            </CardTitle>
            <CardDescription className="mt-1">
              Kiểm tra kết nối thật tới từng dịch vụ: PostgreSQL, n8n (/healthz), Slack (auth.test) và Gemini (embedding).
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={load} disabled={pinging}>
            {pinging ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Kiểm tra
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger-tint px-4 py-3 text-body-sm text-danger">
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" /> {loadError}
            </span>
            <Button size="sm" variant="outline" onClick={load} disabled={pinging}>
              Thử lại
            </Button>
          </div>
        ) : !integrations ? (
          <div aria-label="Đang kiểm tra các dịch vụ...">
            <p className="mb-3 flex items-center gap-2 text-body-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang kiểm tra kết nối tới các dịch vụ…
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-[88px] rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {integrations.items.map((item) => (
              <div key={item.key} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <StatusDot status={item.status} />
                </div>
                <div className="min-w-0">
                  <p className="text-body font-semibold text-foreground">{item.name}</p>
                  <p className="truncate text-body-sm text-muted-foreground" title={item.detail ?? undefined}>
                    {item.detail ?? "--"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
