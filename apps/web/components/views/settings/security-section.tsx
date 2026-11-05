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
  RefreshCw,
  LogOut,
  Info,
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
import { useAuth } from "@/lib/auth-context"

/** Đọc claim `sid` (id phiên) từ access token đang lưu — decode base64url, lỗi thì trả null */
function readCurrentSessionId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const token = localStorage.getItem("hr_auth_token") ?? sessionStorage.getItem("hr_auth_token")
    const part = token?.split(".")[1]
    if (!part) return null
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")
    const payload = JSON.parse(atob(b64)) as { sid?: unknown }
    return typeof payload.sid === "string" ? payload.sid : null
  } catch {
    return null
  }
}

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
  const { user } = useAuth()
  const [currentSid, setCurrentSid] = useState<string | null>(null)
  useEffect(() => {
    setCurrentSid(readCurrentSessionId())
  }, [])

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

  // Danh sách gồm phiên của mọi user — "Đăng xuất thiết bị khác" chỉ tác động phiên của chính mình
  const myOtherSessionCount = useMemo(
    () => (sessions ?? []).filter((s) => s.userId === user?.id && s.id !== currentSid).length,
    [sessions, user?.id, currentSid],
  )

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

  const doRevoke = async (sessionId: string, email: string) => {
    if (revokingId) return
    if (!confirm(`Thu hồi phiên đăng nhập của ${email}? Thiết bị đó sẽ bị đăng xuất.`)) return
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
    if (!confirm(`Đăng xuất ${myOtherSessionCount} phiên khác của bạn? Phiên hiện tại được giữ lại.`)) return
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

  const labelCls = "text-body-sm font-medium text-secondary-foreground"

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {/* 1. Chính sách mật khẩu & khóa tài khoản */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> Chính sách bảo mật
          </CardTitle>
          <CardDescription>
            Áp dụng khi đổi mật khẩu và khi đăng nhập. Thay đổi lưu vào DB kèm nhật ký kiểm tra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!policy ? (
            <div className="flex h-16 items-center justify-center gap-2 text-body-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
                <div>
                  <label htmlFor="sec-min-length" className={labelCls}>Độ dài tối thiểu</label>
                  <Input
                    id="sec-min-length"
                    type="number"
                    min={4}
                    max={128}
                    value={String(policy.passwordMinLength)}
                    onChange={(e) => setPolicy({ ...policy, passwordMinLength: Number(e.target.value) })}
                    className="mt-1.5 tabular"
                  />
                  <p className="mt-1 text-caption text-muted-foreground">Độ dài tối thiểu của mật khẩu mới</p>
                </div>
                <div>
                  <label htmlFor="sec-max-age" className={labelCls}>Buộc đổi mỗi (ngày)</label>
                  <Input
                    id="sec-max-age"
                    type="number"
                    min={0}
                    max={3650}
                    value={String(policy.passwordMaxAgeDays)}
                    onChange={(e) => setPolicy({ ...policy, passwordMaxAgeDays: Number(e.target.value) })}
                    className="mt-1.5 tabular"
                  />
                  <p className="mt-1 text-caption text-muted-foreground">0 = không bắt buộc đổi định kỳ</p>
                </div>
                <div>
                  <label htmlFor="sec-max-failed" className={labelCls}>Khóa sau N lần sai</label>
                  <Input
                    id="sec-max-failed"
                    type="number"
                    min={1}
                    max={50}
                    value={String(policy.maxFailedAttempts)}
                    onChange={(e) => setPolicy({ ...policy, maxFailedAttempts: Number(e.target.value) })}
                    className="mt-1.5 tabular"
                  />
                  <p className="mt-1 text-caption text-muted-foreground">
                    Khóa tài khoản tạm thời sau N lần sai mật khẩu liên tiếp
                  </p>
                </div>
                <div>
                  <label htmlFor="sec-lockout" className={labelCls}>Khóa trong (phút)</label>
                  <Input
                    id="sec-lockout"
                    type="number"
                    min={1}
                    max={1440}
                    value={String(policy.lockoutMinutes)}
                    onChange={(e) => setPolicy({ ...policy, lockoutMinutes: Number(e.target.value) })}
                    className="mt-1.5 tabular"
                  />
                  <p className="mt-1 text-caption text-muted-foreground">Thời gian khóa tạm trước khi thử lại được</p>
                </div>
              </div>

              <div className="mt-6">
                <p className={labelCls}>Yêu cầu ký tự trong mật khẩu</p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {policyToggles.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-sunken px-4 py-3"
                    >
                      <span className="text-body text-foreground">{label}</span>
                      <Switch
                        checked={policy[key]}
                        onCheckedChange={(v) => setPolicy({ ...policy, [key]: v })}
                        aria-label={label}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-border bg-sunken p-4">
                <div>
                  <label htmlFor="ttl-switch" className="text-body font-medium text-foreground">
                    Thời hạn phiên ngắn (24 giờ)
                  </label>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    Hiện tại: <span className="font-medium text-secondary-foreground tabular">{policy.accessTokenTtlHours}h</span> — áp dụng cho lần đăng nhập
                    sau. Bật để siết còn 24h.
                  </p>
                </div>
                <Switch
                  id="ttl-switch"
                  checked={policy.accessTokenTtlHours <= 24}
                  onCheckedChange={(v) => setPolicy({ ...policy, accessTokenTtlHours: v ? 24 : 720 })}
                />
              </div>

              {policyMsg && (
                <p className="mt-4 flex items-center gap-1.5 text-body-sm text-success">
                  <CheckCircle2 className="size-4 shrink-0" /> {policyMsg}
                </p>
              )}
              {policyError && (
                <p className="mt-4 flex items-center gap-1.5 text-body-sm text-danger">
                  <AlertTriangle className="size-4 shrink-0" /> {policyError}
                </p>
              )}
            </>
          )}
        </CardContent>
        {policy && (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 rounded-b-lg border-t border-border bg-card px-5 py-4 sm:px-6">
            {policyDirty && (
              <span className="mr-auto flex items-center gap-1.5 text-body-sm text-warning">
                <span className="size-2 rounded-full bg-warning" aria-hidden="true" /> Có thay đổi chưa lưu
              </span>
            )}
            <Button onClick={savePolicy} disabled={policyBusy || !policyDirty}>
              {policyBusy && <Loader2 className="size-4 animate-spin" />} Lưu thay đổi
            </Button>
          </div>
        )}
      </Card>

      {/* 2. Đổi mật khẩu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" /> Đổi mật khẩu
          </CardTitle>
          <CardDescription>
            {policy
              ? `Mật khẩu mới cần tối thiểu ${policy.passwordMinLength} ký tự${policy.requireUppercase ? ", chữ HOA" : ""}${policy.requireLowercase ? ", chữ thường" : ""}${policy.requireDigit ? ", chữ số" : ""}${policy.requireSpecial ? ", ký tự đặc biệt" : ""}.`
              : "Mật khẩu mới phải tuân theo chính sách bảo mật."}{" "}
            Sau khi đổi, các phiên đăng nhập khác sẽ bị thu hồi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            <div className="md:col-span-2 md:max-w-[calc(50%-12px)]">
              <label htmlFor="pw-current" className={labelCls}>Mật khẩu hiện tại</label>
              <Input
                id="pw-current"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
                className="mt-1.5"
              />
            </div>
            <div>
              <label htmlFor="pw-new" className={labelCls}>Mật khẩu mới</label>
              <Input
                id="pw-new"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                className="mt-1.5"
              />
            </div>
            <div>
              <label htmlFor="pw-confirm" className={labelCls}>Xác nhận mật khẩu mới</label>
              <Input
                id="pw-confirm"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                className="mt-1.5"
              />
            </div>
          </div>
          {pwMsg && (
            <p className="mt-4 flex items-center gap-1.5 text-body-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" /> {pwMsg}
            </p>
          )}
          {pwError && (
            <p className="mt-4 flex items-center gap-1.5 text-body-sm text-danger">
              <AlertTriangle className="size-4 shrink-0" /> {pwError}
            </p>
          )}
        </CardContent>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">
          <Button variant="outline" onClick={submitPassword} disabled={pwBusy}>
            {pwBusy && <Loader2 className="size-4 animate-spin" />} Đổi mật khẩu
          </Button>
        </div>
      </Card>

      {/* 3. Phiên đăng nhập đang hoạt động */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <MonitorSmartphone className="size-4 text-primary" /> Phiên đăng nhập đang hoạt động
              </CardTitle>
              <CardDescription className="mt-1">
                {sessions ? (
                  <>
                    <span className="tabular">{sessions.length}</span> phiên active. Thu hồi → thiết bị bị đăng xuất ngay
                    ở request kế tiếp.
                  </>
                ) : (
                  "Đang tải..."
                )}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={loadAll} disabled={sessionsBusy}>
                {sessionsBusy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Tải lại
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={doRevokeOthers}
                disabled={sessionsBusy || myOtherSessionCount === 0}
              >
                <LogOut className="size-4" /> Đăng xuất thiết bị khác
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sessionsMsg && (
            <p className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-sunken px-4 py-3 text-body-sm text-secondary-foreground">
              <Info className="size-4 shrink-0 text-info" /> {sessionsMsg}
            </p>
          )}
          {!sessions ? (
            <div className="flex h-16 items-center justify-center gap-2 text-body-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải phiên đăng nhập...
            </div>
          ) : sessions.length === 0 ? (
            <p className="py-6 text-center text-body-sm text-muted-foreground">Không có phiên nào đang hoạt động.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table className="min-w-[760px]">
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
                        <p className="font-medium text-foreground">{s.user.email}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge variant={s.user.role === "ADMIN" ? "default" : "secondary"}>{s.user.role}</Badge>
                          {s.id === currentSid && (
                            <Badge variant="success">
                              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" /> Phiên hiện tại
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-secondary-foreground">{describeUserAgent(s.userAgent)}</TableCell>
                      <TableCell className="font-mono text-caption text-muted-foreground">{s.ip ?? "--"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground tabular">{fmtDateTime(s.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground tabular">{fmtDateTime(s.expiresAt)}</TableCell>
                      <TableCell className="text-right">
                        {s.id === currentSid ? (
                          <span className="text-caption text-muted-foreground">Đang dùng</span>
                        ) : (
                          <Button
                            size="xs"
                            variant="destructive"
                            onClick={() => doRevoke(s.id, s.user.email)}
                            disabled={revokingId === s.id}
                          >
                            {revokingId === s.id && <Loader2 className="size-3.5 animate-spin" />}
                            Thu hồi
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Lịch sử đăng nhập */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-primary" /> Lịch sử đăng nhập
          </CardTitle>
          <CardDescription>20 sự kiện gần nhất — cả đăng nhập thành công và thất bại.</CardDescription>
        </CardHeader>
        <CardContent>
          {!history ? (
            <div className="flex h-16 items-center justify-center gap-2 text-body-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Đang tải...
            </div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-body-sm text-muted-foreground">Chưa có sự kiện nào.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table className="min-w-[720px]">
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
                      <TableCell className="whitespace-nowrap text-muted-foreground tabular">{fmtDateTime(h.createdAt)}</TableCell>
                      <TableCell className="text-foreground">{h.email}</TableCell>
                      <TableCell>
                        <Badge variant={h.success ? "success" : "destructive"}>
                          {h.success ? <CheckCircle2 /> : <AlertTriangle />}
                          {h.success ? "Thành công" : "Thất bại"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {h.reason ? (REASON_LABELS[h.reason] ?? h.reason) : "--"}
                      </TableCell>
                      <TableCell className="font-mono text-caption text-muted-foreground">{h.ip ?? "--"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
