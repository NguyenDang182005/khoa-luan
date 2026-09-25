"use client"

import { useEffect, useState, useCallback } from "react"
import { PlugZap, Loader2, RefreshCw, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { settingsApi } from "@/lib/api/settings.api"
import type { IntegrationStatus } from "@/lib/schemas/settings.schema"

function StatusBadge({ status }: { status: IntegrationStatus["status"] }) {
  if (status === "ok") return <Badge variant="success">Hoạt động</Badge>
  if (status === "error") return <Badge variant="coral">Lỗi</Badge>
  return <Badge variant="warning">Chưa cấu hình</Badge>
}

function StatusIcon({ status }: { status: IntegrationStatus["status"] }) {
  if (status === "ok") return <CheckCircle2 className="size-4 text-emerald-400" />
  if (status === "error") return <AlertTriangle className="size-4 text-agent-coral" />
  return <HelpCircle className="size-4 text-agent-amber" />
}

export function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<Awaited<ReturnType<typeof settingsApi.getIntegrations>> | null>(null)
  const [pinging, setPinging] = useState(false)

  const load = useCallback(async () => {
    setPinging(true)
    try {
      setIntegrations(await settingsApi.getIntegrations())
    } catch (e) {
      console.error(e)
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <PlugZap className="size-4 text-agent-teal" /> Trạng Thái Tích Hợp
            </CardTitle>
            <CardDescription>
              Ping thật từng dịch vụ: PostgreSQL, n8n (/healthz), Slack (auth.test) và Gemini API.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={load} disabled={pinging}>
            {pinging ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Kiểm Tra Lại
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!integrations ? (
          <div className="flex h-16 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang ping các dịch vụ...
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {integrations.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <StatusIcon status={item.status} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.detail ?? "--"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {item.latencyMs !== null && (
                    <span className="font-mono text-[11px] text-muted-foreground">{item.latencyMs}ms</span>
                  )}
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
