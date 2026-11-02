"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  ShieldCheck,
  KeyRound,
  MonitorSmartphone,
  History,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { settingsApi } from "@/lib/api/settings.api"
import type { SecurityPolicy, SessionInfo, LoginHistoryEntry } from "@/lib/schemas/settings.schema"
import { authApi } from "@/lib/api/auth.api"

/** Rút gọn User-Agent thành mô tả dễ đọc: "Chrome · Windows" */
function describeUserAgent(ua: string | null): string {
  if (!ua) return "Không rõ thiết bị"
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Khác"
  const os = /Windows NT/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iOS/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Khác"
  return `${browser} · ${os}`
}

const REASON_LABELS: Record<string, string> = {
  USER_NOT_FOUND: "Email không tồn tại",
  ACCOUNT_DISABLED: "Tài khoản bị vô hiệu hóa",
  ACCOUNT_LOCKED: "Tài khoản bị khóa",
  INVALID_PASSWORD: "Sai mật khẩu",
  OAUTH_ONLY: "Tài khoản chỉ đăng nhập OAuth",
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "--"
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function SecuritySection({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  // ── Chính sách bảo mật ──
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null)
  const [policySaved, setPolicySaved] = useState<SecurityPolicy | null>(null)
  const [policyBusy, setPolicyBusy] = useState(false)
  const [policyMsg, setPolicyMsg] = useState<string | null>(null)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const policyDirty = useMemo(
    () => Boolean(policy && policySaved && JSON.stringify(policy) !== JSON.stringify(policySaved)),
    [policy, policySaved],
  )

  useEffect(() => {
    onDirtyChange?.(policyDirty)
  }, [policyDirty, onDirtyChange])

  // ── Đổi mật khẩu ──
  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)

  // ── Phiên đăng nhập ──
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null)
  const [sessionsBusy, setSessionsBusy] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [sessionsMsg, setSessionsMsg] = useState<string | null>(null)

  // ── Lịch sử đăng nhập ──
  const [history, setHistory] = useState<LoginHistoryEntry[] | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const p = await settingsApi.getSecurityPolicy()
      setPolicy(p)
      setPolicySaved(p)
    } catch (e) {
      console.error(e)
    }
    setSessionsBusy(true)
    try {
      setSessions(await settingsApi.getSessions())
    } catch (e) {
      console.error(e)
    } finally {
      setSessionsBusy(false)
    }
    try {
      setHistory(await settingsApi.getLoginHistory(20))
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const savePolicy = async () => {
    if (!policy || policyBusy) return
    setPolicyBusy(true)
    setPolicyMsg(null)
    setPolicyError(null)
    try {
      const saved = await settingsApi.updateSecurityPolicy({
        passwordMinLength: Number(policy.passwordMinLength),
        requireUppercase: policy.requireUppercase,
        requireLowercase: policy.requireLowercase,
        requireDigit: policy.requireDigit,
        requireSpecial: policy.requireSpecial,
        passwordMaxAgeDays: Number(policy.passwordMaxAgeDays),
        maxFailedAttempts: Number(policy.maxFailedAttempts),
        lockoutMinutes: Number(policy.lockoutMinutes),
        accessTokenTtlHours: Number(policy.accessTokenTtlHours),
      })
      setPolicy(saved)
      setPolicySaved(saved)
      setPolicyMsg("Đã lưu chính sách bảo mật.")
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setPolicyError(msg ?? "Không lưu được chính sách bảo mật.")
    } finally {
      setPolicyBusy(false)
    }
  }

  const submitPassword = async () => {
    if (pwBusy) return
    setPwMsg(null)
    setPwError(null)
    if (!currentPw || !newPw || !confirmPw) {
      setPwError("Vui lòng nhập đủ 3 trường mật khẩu.")
      return
    }
    if (newPw !== confirmPw) {
      setPwError("Xác nhận mật khẩu mới không khớp.")
      return
    }
    setPwBusy(true)
    try {
      const res = await authApi.changePassword(currentPw, newPw)
      setPwMsg(res.message)
      setCurrentPw("")
      setNewPw("")
      setConfirmPw("")
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setPwError(msg ?? "Không đổi được mật khẩu.")
    } finally {
      setPwBusy(false)
    }
  }

  const doRevoke = async (sessionId: string) => {
    if (revokingId) return
    setRevokingId(sessionId)
    setSessionsMsg(null)
    try {
      await settingsApi.revokeSession(sessionId)
      setSessions((prev) => prev?.filter((s) => s.id !== sessionId) ?? null)
      setSessionsMsg("Đã thu hồi phiên. Thiết bị đó sẽ bị đăng xuất ở request kế tiếp.")
      try {
        setHistory(await settingsApi.getLoginHistory(20))
      } catch {
        /* không bắt buộc */
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setSessionsMsg(msg ?? "Không thu hồi được phiên.")
    } finally {
      setRevokingId(null)
    }
  }

  const doRevokeOthers = async () => {
    if (sessionsBusy) return
    setSessionsBusy(true)
    setSessionsMsg(null)
    try {
      const res = await settingsApi.revokeOtherSessions()
      setSessionsMsg(
        res.revoked
          ? `Đã đăng xuất ${res.revoked} phiên khác của bạn (giữ lại phiên hiện tại).`
          : "Bạn không có phiên nào khác cần đăng xuất.",
      )
      setSessions(await settingsApi.getSessions())
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setSessionsMsg(msg ?? "Không thực hiện được.")
    } finally {
      setSessionsBusy(false)
    }
  }

  const policyToggles: Array<{ key: "requireUppercase" | "requireLowercase" | "requireDigit" | "requireSpecial"; label: string }> = [
    { key: "requireUppercase", label: "Chữ HOA (A-Z)" },
    { key: "requireLowercase", label: "Chữ thường (a-z)" },
    { key: "requireDigit", label: "Chữ số (0-9)" },
    { key: "requireSpecial", label: "Ký tự đặc biệt (!@#...)" },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Chính sách mật khẩu & khóa tài khoản */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="size-4 text-agent-teal" /> Chính Sách Bảo Mật
          </CardTitle>
          <CardDescription>
            Áp dụng khi đổi mật khẩu và khi đăng nhập. Thay đổi lưu vào DB kèm nhật ký kiểm tra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!policy ? (
            <div className="flex h-16 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div title="Độ dài tối thiểu của mật khẩu mới">
                  <label className="text-[11px] font-semibold text-muted-foreground">Độ dài tối thiểu</label>
                  <Input
                    type="number"
                    min={4}
                    max={128}
                    value={String(policy.passwordMinLength)}
                    onChange={(e) => setPolicy({ ...policy, passwordMinLength: Number(e.target.value) })}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
                <div title="0 = không bắt buộc đổi định kỳ">
                  <label className="text-[11px] font-semibold text-muted-foreground">Buộc đổi mỗi (ngày)</label>
                  <Input
                    type="number"
                    min={0}
                    max={3650}
                    value={String(policy.passwordMaxAgeDays)}
                    onChange={(e) => setPolicy({ ...policy, passwordMaxAgeDays: Number(e.target.value) })}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
                <div title="Khóa tài khoản tạm thời sau N lần sai mật khẩu liên tiếp">
                  <label className="text-[11px] font-semibold text-muted-foreground">Khóa sau N lần sai</label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={String(policy.maxFailedAttempts)}
                    onChange={(e) => setPolicy({ ...policy, maxFailedAttempts: Number(e.target.value) })}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
                <div title="Thời gian khóa tạm trước khi thử lại được">
                  <label className="text-[11px] font-semibold text-muted-foreground">Khóa trong (phút)</label>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    value={String(policy.lockoutMinutes)}
                    onChange={(e) => setPolicy({ ...policy, lockoutMinutes: Number(e.target.value) })}
                    className="mt-1 h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-[11px] font-semibold text-muted-foreground">Yêu cầu ký tự trong mật khẩu</label>
                <div className="mt-1.5 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {policyToggles.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                      <Switch checked={policy[key]} onCheckedChange={(v) => setPolicy({ ...policy, [key]: v })} />
                      <span className="text-xs text-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <Switch
                  id="ttl-switch"
                  checked={policy.accessTokenTtlHours <= 24}
                  onCheckedChange={(v) => setPolicy({ ...policy, accessTokenTtlHours: v ? 24 : 720 })}
                />
                <div>
                  <label htmlFor="ttl-switch" className="text-xs font-semibold text-foreground">
                    Thời hạn phiên ngắn (24 giờ)
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Hiện tại: <span className="font-mono">{policy.accessTokenTtlHours}h</span> — áp dụng cho lần đăng nhập
                    sau. Bật để siết còn 24h.
                  </p>
                </div>
              </div>

              {policyMsg && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> {policyMsg}
                </p>
              )}
              {policyError && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-agent-coral">
                  <AlertTriangle className="size-3.5" /> {policyError}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <Button size="sm" className="gap-1.5" onClick={savePolicy} disabled={policyBusy || !policyDirty}>
                  {policyBusy && <Loader2 className="size-3.5 animate-spin" />} Lưu Chính Sách
                </Button>
                {policyDirty && <span className="text-[11px] text-agent-amber">● Có thay đổi chưa lưu</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 2. Đổi mật khẩu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4 text-agent-amber" /> Đổi Mật Khẩu
          </CardTitle>
          <CardDescription>
            {policy
              ? `Mật khẩu mới cần tối thiểu ${policy.passwordMinLength} ký tự${policy.requireUppercase ? ", chữ HOA" : ""}${policy.requireLowercase ? ", chữ thường" : ""}${policy.requireDigit ? ", chữ số" : ""}${policy.requireSpecial ? ", ký tự đặc biệt" : ""}.`
              : "Mật khẩu mới phải tuân theo chính sách bảo mật."}{" "}
            Sau khi đổi, các phiên đăng nhập khác sẽ bị thu hồi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Mật khẩu hiện tại</label>
              <Input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Mật khẩu mới</label>
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">Xác nhận mật khẩu mới</label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
          {pwMsg && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="size-3.5" /> {pwMsg}
            </p>
          )}
          {pwError && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-agent-coral">
              <AlertTriangle className="size-3.5" /> {pwError}
            </p>
          )}
          <Button size="sm" className="mt-3 gap-1.5" onClick={submitPassword} disabled={pwBusy}>
            {pwBusy && <Loader2 className="size-3.5 animate-spin" />} Đổi Mật Khẩu
          </Button>
        </CardContent>
      </Card>

      {/* 3. Phiên đăng nhập đang hoạt động */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <MonitorSmartphone className="size-4 text-agent-blue" /> Phiên Đăng Nhập Đang Hoạt Động
              </CardTitle>
              <CardDescription>
                {sessions ? `${sessions.length} phiên active. Thu hồi → thiết bị bị đăng xuất ngay ở request kế tiếp.` : "Đang tải..."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={loadAll} disabled={sessionsBusy}>
                {sessionsBusy && <Loader2 className="size-3.5 animate-spin" />} Tải Lại
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                onClick={doRevokeOthers}
                disabled={sessionsBusy || (sessions?.length ?? 0) <= 1}
              >
                Đăng Xuất Thiết Bị Khác
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sessionsMsg && <p className="mb-3 text-[11px] text-agent-amber">{sessionsMsg}</p>}
          {!sessions ? (
            <div className="flex h-16 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải phiên đăng nhập...
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Không có phiên nào đang hoạt động.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Thiết bị</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Đăng nhập lúc</TableHead>
                  <TableHead>Hết hạn</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground">{s.user.email}</p>
                      <Badge variant={s.user.role === "ADMIN" ? "blue" : "teal"} className="mt-1">
                        {s.user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{describeUserAgent(s.userAgent)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{s.ip ?? "--"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(s.createdAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(s.expiresAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="xs"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => doRevoke(s.id)}
                        disabled={revokingId === s.id}
                      >
                        {revokingId === s.id && <Loader2 className="size-3 animate-spin" />}
                        Thu hồi
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 4. Lịch sử đăng nhập */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-muted-foreground" /> Lịch Sử Đăng Nhập
          </CardTitle>
          <CardDescription>20 sự kiện gần nhất — cả đăng nhập thành công và thất bại.</CardDescription>
        </CardHeader>
        <CardContent>
          {!history ? (
            <div className="flex h-16 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải...
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Chưa có sự kiện nào.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Kết quả</TableHead>
                  <TableHead>Lý do (nếu thất bại)</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(h.createdAt)}</TableCell>
                    <TableCell className="text-xs text-foreground">{h.email}</TableCell>
                    <TableCell>
                      <Badge variant={h.success ? "success" : "coral"}>{h.success ? "Thành công" : "Thất bại"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {h.reason ? (REASON_LABELS[h.reason] ?? h.reason) : "--"}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{h.ip ?? "--"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
