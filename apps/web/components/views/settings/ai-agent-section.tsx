"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { Bot, Loader2, PlugZap, Info, CheckCircle2, AlertTriangle, CircleSlash } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { settingsApi, type AiConnectionTest } from "@/lib/api/settings.api"
import type { AiAgentConfig } from "@/lib/schemas/settings.schema"

/** Tham số LLM thật sự nằm trong n8n workflow (Q20=B) — chỉ hiển thị đọc */
const N8N_AGENT_PARAMS: Array<{ agent: string; model: string; temperature: string; maxTokens: string }> = [
  { agent: "WF01 Router", model: "Rule-based, không dùng LLM", temperature: "--", maxTokens: "--" },
  { agent: "WF02 HR Q&A", model: "deepseek-flash", temperature: "0.3", maxTokens: "1024" },
  { agent: "WF03 Training", model: "deepseek-flash", temperature: "0.8", maxTokens: "1024" },
  { agent: "WF04 CSKH", model: "deepseek-flash", temperature: "0.5", maxTokens: "1024" },
]

export function AiAgentSection({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [cfg, setCfg] = useState<AiAgentConfig | null>(null)
  const [savedCfg, setSavedCfg] = useState<AiAgentConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // API key mới chỉ gửi khi admin gõ vào ô (write-only)
  const [newApiKey, setNewApiKey] = useState("")
  const [showKeyInput, setShowKeyInput] = useState(false)

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<AiConnectionTest | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  const dirty = useMemo(
    () => Boolean(cfg && savedCfg && (cfg.enabled !== savedCfg.enabled || cfg.webhookUrl !== savedCfg.webhookUrl || cfg.timeoutMs !== savedCfg.timeoutMs || newApiKey.length > 0)),
    [cfg, savedCfg, newApiKey],
  )

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const c = await settingsApi.getAiConfig()
      setCfg(c)
      setSavedCfg(c)
    } catch (e) {
      console.error(e)
      setLoadError("Không tải được cấu hình AI Agent.")
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
    setTestError(null)
    try {
      setTestResult(await settingsApi.testAiConnection())
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setTestError(m ?? "Không kiểm tra được kết nối.")
    } finally {
      setTesting(false)
    }
  }

  const labelCls = "text-body-sm font-medium text-secondary-foreground"
  // Màu agent theo WF01..WF04 (teal=WF01 · blue=WF02 · amber=WF03 · coral=WF04)
  const agentVariants = ["teal", "blue", "amber", "coral"] as const

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {/* 1. Bật/tắt + cấu hình kết nối */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-4 text-ai" /> AI Agent (NestJS ↔ n8n)
          </CardTitle>
          <CardDescription>
            Kiểm soát phía NestJS: bật/tắt agent, webhook n8n, API key và thời gian chờ. Tham số model nằm trong n8n
            workflow (xem panel bên dưới).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!cfg && loadError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger-tint px-4 py-3 text-body-sm text-danger">
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" /> {loadError}
              </span>
              <Button size="sm" variant="outline" onClick={load}>
                Thử lại
              </Button>
            </div>
          ) : !cfg ? (
            <div className="flex h-16 items-center justify-center gap-2 text-body-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải...
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-sunken p-4">
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-body font-medium text-foreground">
                    Bật AI Agent toàn hệ thống
                    {!cfg.enabled && (
                      <Badge variant="warning">
                        <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" /> Đang tắt
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    Khi tắt: nhân viên chat sẽ nhận thông báo &quot;Agent tạm tắt&quot;, không gọi sang n8n.
                  </p>
                </div>
                <Switch
                  checked={cfg.enabled}
                  onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })}
                  aria-label="Bật AI Agent toàn hệ thống"
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                <div>
                  <label htmlFor="ai-webhook" className={labelCls}>Webhook URL (n8n WF01)</label>
                  <Input
                    id="ai-webhook"
                    value={cfg.webhookUrl ?? ""}
                    placeholder="http://localhost:5678/webhook/chat (mặc định từ env)"
                    onChange={(e) => setCfg({ ...cfg, webhookUrl: e.target.value })}
                    className="mt-1.5 font-mono text-body-sm"
                  />
                  <p className="mt-1 text-caption text-muted-foreground">
                    Trống = dùng env N8N_WEBHOOK_URL (mặc định http://localhost:5678/webhook/chat)
                  </p>
                </div>
                <div>
                  <p className={`flex flex-wrap items-center gap-2 ${labelCls}`}>
                    API Key (x-api-key)
                    {cfg.apiKeySet ? (
                      <span className="inline-flex items-center gap-1 text-caption font-medium text-success">
                        <CheckCircle2 className="size-3.5" /> Đã cấu hình
                      </span>
                    ) : (
                      <span className="text-caption font-medium text-muted-foreground">Chưa cấu hình</span>
                    )}
                  </p>
                  {!showKeyInput ? (
                    <Button
                      variant="outline"
                      className="mt-1.5 h-10 w-full justify-start font-mono text-body-sm font-normal text-muted-foreground"
                      onClick={() => setShowKeyInput(true)}
                    >
                      {cfg.apiKeySet ? "•••••••••••• (bấm để thay đổi)" : "Bấm để nhập API key"}
                    </Button>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Input
                        type="password"
                        value={newApiKey}
                        placeholder="Dán API key mới (trống = xóa, fallback env)"
                        onChange={(e) => setNewApiKey(e.target.value)}
                        aria-label="API key mới"
                        className="flex-1 font-mono text-body-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 shrink-0"
                        onClick={() => {
                          setShowKeyInput(false)
                          setNewApiKey("")
                        }}
                      >
                        Hủy
                      </Button>
                    </div>
                  )}
                  <p className="mt-1 text-caption text-muted-foreground">
                    Trống = dùng env N8N_API_KEY. Key chỉ ghi, không bao giờ hiển thị lại.
                  </p>
                </div>
                <div>
                  <label htmlFor="ai-timeout" className={labelCls}>Timeout (ms)</label>
                  <Input
                    id="ai-timeout"
                    type="number"
                    min={1000}
                    max={300000}
                    step={1000}
                    value={String(cfg.timeoutMs)}
                    onChange={(e) => setCfg({ ...cfg, timeoutMs: Number(e.target.value) })}
                    className="mt-1.5 tabular"
                  />
                  <p className="mt-1 text-caption text-muted-foreground">Thời gian chờ tối đa mỗi lần gọi n8n (ms)</p>
                </div>
              </div>

              {msg && (
                <p className="mt-4 flex items-center gap-1.5 text-body-sm text-success">
                  <CheckCircle2 className="size-4 shrink-0" /> {msg}
                </p>
              )}
              {err && (
                <p className="mt-4 flex items-center gap-1.5 text-body-sm text-danger">
                  <AlertTriangle className="size-4 shrink-0" /> {err}
                </p>
              )}
            </>
          )}
        </CardContent>
        {cfg && (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 rounded-b-lg border-t border-border bg-card px-5 py-4 sm:px-6">
            {dirty && (
              <span className="mr-auto flex items-center gap-1.5 text-body-sm text-warning">
                <span className="size-2 rounded-full bg-warning" aria-hidden="true" /> Có thay đổi chưa lưu
              </span>
            )}
            <Button onClick={save} disabled={busy || !dirty}>
              {busy && <Loader2 className="size-4 animate-spin" />} Lưu thay đổi
            </Button>
          </div>
        )}
      </Card>

      {/* 2. Kiểm tra kết nối */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <PlugZap className="size-4 text-primary" /> Kiểm tra kết nối
              </CardTitle>
              <CardDescription className="mt-1">
                Gọi <span className="font-mono">/healthz</span> của n8n + gửi 1 tin nhắn thử qua webhook.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={runTest} disabled={testing}>
              {testing && <Loader2 className="size-4 animate-spin" />} Kiểm tra ngay
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {testError ? (
            <p className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-tint px-4 py-3 text-body-sm text-danger">
              <AlertTriangle className="size-4 shrink-0" /> {testError}
            </p>
          ) : !testResult ? (
            <p className="text-body-sm text-muted-foreground">Chưa chạy kiểm tra. Bấm &quot;Kiểm tra ngay&quot; để đo.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-caption font-medium ${testResult.healthz.ok ? "text-success" : "text-danger"}`}
                  >
                    <span
                      className={`size-2 rounded-full ${testResult.healthz.ok ? "bg-success" : "bg-danger"}`}
                      aria-hidden="true"
                    />
                    {testResult.healthz.ok ? "OK" : "Lỗi"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-body font-semibold text-foreground">n8n /healthz</p>
                  <p className="text-body-sm text-muted-foreground">{testResult.healthz.detail}</p>
                </div>
              </div>
              {testResult.roundTrip && (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-caption font-medium ${testResult.roundTrip.ok ? "text-success" : "text-danger"}`}
                    >
                      <span
                        className={`size-2 rounded-full ${testResult.roundTrip.ok ? "bg-success" : "bg-danger"}`}
                        aria-hidden="true"
                      />
                      {testResult.roundTrip.ok ? "OK" : "Lỗi"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-foreground">Round-trip qua webhook</p>
                    <p className="text-body-sm text-muted-foreground">{testResult.roundTrip.detail}</p>
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
          <CardTitle className="flex items-center gap-2">
            <Info className="size-4 text-muted-foreground" /> Tham số model hiện hành (đặt trong n8n workflow)
          </CardTitle>
          <CardDescription>
            Tham số AI được quản lý trong n8n (WF01–WF04), không thay đổi được từ trang này.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Temperature</TableHead>
                  <TableHead className="text-right">Max tokens</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {N8N_AGENT_PARAMS.map((p, i) => (
                  <TableRow key={p.agent}>
                    <TableCell>
                      <Badge variant={agentVariants[i] ?? "secondary"}>{p.agent}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-caption text-secondary-foreground">{p.model}</TableCell>
                    <TableCell className="text-right text-secondary-foreground tabular">{p.temperature}</TableCell>
                    <TableCell className="text-right text-secondary-foreground tabular">{p.maxTokens}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-4 text-body-sm text-muted-foreground">
            Embedding RAG: <span className="font-mono text-caption text-secondary-foreground">gemini-embedding-001</span>
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-body-sm text-muted-foreground">
            <CircleSlash className="size-4 shrink-0" /> Muốn đổi model, temperature hoặc prompt: chỉnh trực tiếp trong n8n.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
