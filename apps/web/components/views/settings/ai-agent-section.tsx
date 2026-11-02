"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Bot, Loader2, PlugZap, Info, CheckCircle2, AlertTriangle, CircleSlash } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { settingsApi, type AiConnectionTest } from "@/lib/api/settings.api"
import type { AiAgentConfig } from "@/lib/schemas/settings.schema"

/** Tham số LLM thật sự nằm trong n8n workflow (Q20=B) — chỉ hiển thị đọc */
const N8N_MODEL_PARAMS = [
  { label: "Model", value: "gemini-3.1-flash-lite" },
  { label: "Temperature", value: "0.3" },
  { label: "Max output tokens", value: "1024" },
]

export function AiAgentSection({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [cfg, setCfg] = useState<AiAgentConfig | null>(null)
  const [savedCfg, setSavedCfg] = useState<AiAgentConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // API key mới chỉ gửi khi admin gõ vào ô (write-only)
  const [newApiKey, setNewApiKey] = useState("")
  const [showKeyInput, setShowKeyInput] = useState(false)

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<AiConnectionTest | null>(null)

  const dirty = useMemo(
    () => Boolean(cfg && savedCfg && (cfg.enabled !== savedCfg.enabled || cfg.webhookUrl !== savedCfg.webhookUrl || cfg.timeoutMs !== savedCfg.timeoutMs || newApiKey.length > 0)),
    [cfg, savedCfg, newApiKey],
  )

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const load = useCallback(async () => {
    try {
      const c = await settingsApi.getAiConfig()
      setCfg(c)
      setSavedCfg(c)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!cfg || busy) return
    setBusy(true)
    setMsg(null)
    setErr(null)
    try {
      const saved = await settingsApi.updateAiConfig({
        enabled: cfg.enabled,
        webhookUrl: cfg.webhookUrl ?? "",
        timeoutMs: Number(cfg.timeoutMs),
        ...(newApiKey.length > 0 ? { apiKey: newApiKey } : {}),
      })
      setCfg(saved)
      setSavedCfg(saved)
      setNewApiKey("")
      setShowKeyInput(false)
      setMsg("Đã lưu cấu hình AI Agent. Có hiệu lực ngay cho các lượt chat kế tiếp.")
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErr(m ?? "Không lưu được cấu hình.")
    } finally {
      setBusy(false)
    }
  }

  const runTest = async () => {
    if (testing) return
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await settingsApi.testAiConnection())
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErr(m ?? "Không kiểm tra được kết nối.")
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Bật/tắt + cấu hình kết nối */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="size-4 text-agent-teal" /> AI Agent (NestJS ↔ n8n)
          </CardTitle>
          <CardDescription>
            Kiểm soát phía NestJS: bật/tắt agent, webhook n8n, API key và thời gian chờ. Tham số model nằm trong n8n
            workflow (xem panel bên dưới).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!cfg ? (
            <div className="flex h-16 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Bật AI Agent toàn hệ thống {cfg.enabled ? "" : "— ĐANG TẮT"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Khi tắt: nhân viên chat sẽ nhận thông báo &quot;Agent tạm tắt&quot;, không gọi sang n8n.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div title="Trống = dùng env N8N_WEBHOOK_URL (mặc định http://localhost:5678/webhook/chat)">
                  <label className="text-[11px] font-semibold text-muted-foreground">Webhook URL (n8n WF01)</label>
                  <Input
                    value={cfg.webhookUrl ?? ""}
                    placeholder="http://localhost:5678/webhook/chat (mặc định từ env)"
                    onChange={(e) => setCfg({ ...cfg, webhookUrl: e.target.value })}
                    className="mt-1 h-8 font-mono text-xs"
                  />
                </div>
                <div title="Trống = dùng env N8N_API_KEY. Key chỉ ghi, không bao giờ hiển thị lại.">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    API Key (x-api-key) {cfg.apiKeySet ? "— đã cấu hình ✓" : "— chưa cấu hình"}
                  </label>
                  {!showKeyInput ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 h-8 w-full justify-start font-mono text-xs text-muted-foreground"
                      onClick={() => setShowKeyInput(true)}
                    >
                      {cfg.apiKeySet ? "•••••••••••• (bấm để thay đổi)" : "Bấm để nhập API key"}
                    </Button>
                  ) : (
                    <div className="mt-1 flex items-center gap-1.5">
                      <Input
                        type="password"
                        value={newApiKey}
                        placeholder="Dán API key mới (trống = xóa, fallback env)"
                        onChange={(e) => setNewApiKey(e.target.value)}
                        className="h-8 flex-1 font-mono text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs shrink-0"
                        onClick={() => {
                          setShowKeyInput(false)
                          setNewApiKey("")
                        }}
                      >
                        Hủy
                      </Button>
                    </div>
                  )}
                </div>
                <div title="Thời gian chờ tối đa mỗi lần gọi n8n (ms)">
                  <label className="text-[11px] font-semibold text-muted-foreground">Timeout (ms)</label>
                  <Input
                    type="number"
                    min={1000}
                    max={300000}
                    step={1000}
                    value={String(cfg.timeoutMs)}
                    onChange={(e) => setCfg({ ...cfg, timeoutMs: Number(e.target.value) })}
                    className="mt-1 h-8 font-mono text-xs"
                  />
                </div>
              </div>

              {msg && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> {msg}
                </p>
              )}
              {err && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-agent-coral">
                  <AlertTriangle className="size-3.5" /> {err}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <Button size="sm" className="gap-1.5" onClick={save} disabled={busy || !dirty}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />} Lưu Cấu Hình
                </Button>
                {dirty && <span className="text-[11px] text-agent-amber">● Có thay đổi chưa lưu</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 2. Kiểm tra kết nối */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <PlugZap className="size-4 text-agent-blue" /> Kiểm Tra Kết Nối
              </CardTitle>
              <CardDescription>
                Ping <span className="font-mono">/healthz</span> của n8n + gửi 1 tin nhắn thử qua webhook (đo trễ
                round-trip).
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={runTest} disabled={testing}>
              {testing && <Loader2 className="size-3.5 animate-spin" />} Kiểm Tra Ngay
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!testResult ? (
            <p className="text-xs text-muted-foreground">Chưa chạy kiểm tra. Bấm &quot;Kiểm Tra Ngay&quot; để đo.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-2.5">
                  {testResult.healthz.ok ? (
                    <CheckCircle2 className="size-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="size-4 text-agent-coral" />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-foreground">n8n /healthz</p>
                    <p className="text-[11px] text-muted-foreground">{testResult.healthz.detail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  {testResult.healthz.latencyMs !== null && (
                    <span className="font-mono text-[11px] text-muted-foreground">{testResult.healthz.latencyMs}ms</span>
                  )}
                  <Badge variant={testResult.healthz.ok ? "success" : "coral"}>
                    {testResult.healthz.ok ? "OK" : "Lỗi"}
                  </Badge>
                </div>
              </div>
              {testResult.roundTrip && (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-2.5">
                    {testResult.roundTrip.ok ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="size-4 text-agent-coral" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-foreground">Round-trip qua webhook</p>
                      <p className="text-[11px] text-muted-foreground">{testResult.roundTrip.detail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {testResult.roundTrip.latencyMs !== null && (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {testResult.roundTrip.latencyMs}ms
                      </span>
                    )}
                    <Badge variant={testResult.roundTrip.ok ? "success" : "coral"}>
                      {testResult.roundTrip.ok ? "OK" : "Lỗi"}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Tham số model — chỉ đọc (Q20=B) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Info className="size-4 text-muted-foreground" /> Tham Số Model Hiện Hành (đặt trong n8n workflow)
          </CardTitle>
          <CardDescription>
            Tham số AI được quản lý trong n8n (WF01/WF02), không thay đổi được từ trang này.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {N8N_MODEL_PARAMS.map((p) => (
              <div key={p.label} className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{p.label}</p>
                <p className="mt-1 font-mono text-xs text-foreground">{p.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CircleSlash className="size-3.5" /> Muốn đổi model/temperature/prompt: sửa trong n8n UI rồi reimport bằng
            scripts/import-workflows.mjs.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
