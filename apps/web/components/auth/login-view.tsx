"use client"

import * as React from "react"
import { UsersRound, Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"

// Brand mark chính thức — màu thương hiệu là ngoại lệ duy nhất được phép hardcode
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

export function LoginView() {
  const { login, loginWithGoogle, loginWithFacebook, isLoading } = useAuth()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [rememberMe, setRememberMe] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [oauthLoading, setOauthLoading] = React.useState<"google" | "facebook" | null>(null)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)
    const result = await login(email, password, rememberMe)
    if (!result.success && result.error) setErrorMessage(result.error)
    setIsSubmitting(false)
  }

  const handleGoogle = async () => {
    setErrorMessage(null)
    setOauthLoading("google")
    const result = await loginWithGoogle(rememberMe)
    if (!result.success && result.error) setErrorMessage(result.error)
    setOauthLoading(null)
  }

  const handleFacebook = async () => {
    setErrorMessage(null)
    setOauthLoading("facebook")
    const result = await loginWithFacebook(rememberMe)
    if (!result.success && result.error) setErrorMessage(result.error)
    setOauthLoading(null)
  }

  const busy = isSubmitting || oauthLoading !== null || isLoading

  return (
    <div
      className="flex min-h-dvh w-full flex-col items-center justify-center bg-background px-4 py-10"
      style={{ backgroundImage: "radial-gradient(1200px 600px at 0% 0%, color-mix(in srgb, var(--primary) 4%, transparent), transparent 60%)" }}
    >
      <main className="flex w-full max-w-[400px] flex-col gap-5 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UsersRound className="size-[18px]" />
            </span>
            <span className="text-body font-semibold text-foreground">HR Multi-Agent</span>
          </div>
          <h1 className="mt-5 text-h1 font-semibold text-foreground">Đăng nhập</h1>
          <p className="mt-1 text-body text-muted-foreground">Quản trị nhân sự và trợ lý AI cho doanh nghiệp của bạn.</p>
        </div>

        {/* OAuth */}
        <div className="flex flex-col gap-3">
          <Button type="button" variant="outline" onClick={handleGoogle} disabled={busy} className="h-11 w-full text-body">
            {oauthLoading === "google" ? <Loader2 className="size-[18px] animate-spin" /> : <GoogleIcon className="size-[18px]" />}
            Tiếp tục với Google
          </Button>
          <Button type="button" variant="outline" onClick={handleFacebook} disabled={busy} className="h-11 w-full text-body">
            {oauthLoading === "facebook" ? <Loader2 className="size-[18px] animate-spin" /> : <FacebookIcon className="size-[18px]" />}
            Tiếp tục với Facebook
          </Button>
        </div>

        <div className="flex items-center gap-3 text-caption text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          hoặc
          <span className="h-px flex-1 bg-border" />
        </div>

        {errorMessage && (
          <div role="alert" className="-mt-2 flex items-start gap-2 rounded-md border border-danger/20 bg-danger-tint px-3 py-2.5 text-body-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Email / mật khẩu */}
        <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-body-sm font-medium text-secondary-foreground">Email công việc</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hr-system.com"
                className="h-11 pl-9"
                aria-invalid={errorMessage ? true : undefined}
                required
                disabled={busy}
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-body-sm font-medium text-secondary-foreground">Mật khẩu</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="h-11 pl-9 pr-11"
                aria-invalid={errorMessage ? true : undefined}
                required
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <p className="text-caption text-muted-foreground">
            Quên mật khẩu? Liên hệ HR Admin để được đặt lại.
          </p>

          <label className="flex min-h-6 cursor-pointer select-none items-center gap-2.5 text-body-sm text-secondary-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded accent-primary"
            />
            Nhớ đăng nhập trong 30 ngày
          </label>

          <Button type="submit" size="lg" disabled={busy} className="h-11 w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Đang đăng nhập...
              </>
            ) : (
              "Đăng nhập"
            )}
          </Button>
        </form>

        {/* Tài khoản mẫu — chỉ hiện khi NEXT_PUBLIC_SHOW_DEMO_LOGIN !== 'false'
            (production nên đặt 'false' để không lộ tài khoản mẫu). */}
        {process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN !== 'false' && (
          <div className="rounded-md bg-muted p-4">
            <p className="text-body-sm font-medium text-secondary-foreground">Tài khoản mẫu</p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail("hr-admin@company.com")
                  setPassword("Admin@123")
                }}
                className="flex min-w-0 items-start gap-2 rounded-md border border-input bg-card p-2.5 text-left transition-colors hover:bg-sunken"
              >
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-body-sm font-semibold text-foreground">Quản trị viên</span>
                  <span className="block break-all text-caption leading-tight text-muted-foreground">hr-admin@company.com</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("employee1@company.com")
                  setPassword("Employee@123")
                }}
                className="flex min-w-0 items-start gap-2 rounded-md border border-input bg-card p-2.5 text-left transition-colors hover:bg-sunken"
              >
                <User className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-body-sm font-semibold text-foreground">Nhân viên</span>
                  <span className="block break-all text-caption leading-tight text-muted-foreground">employee1@company.com</span>
                </span>
              </button>
            </div>
          </div>
        )}
      </main>

      <p className="mt-6 text-center text-caption text-muted-foreground">
        Hệ thống nội bộ — chỉ dành cho nhân viên đã được cấp quyền.
      </p>
    </div>
  )
}
