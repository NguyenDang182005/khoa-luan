"use client"

import * as React from "react"
import { Sparkles, Mail, Lock, Chrome, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"

// Facebook icon SVG
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8f9fa] p-4">
      <div className="w-full max-w-[400px] flex flex-col gap-0">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#dadce0] shadow-sm p-8 flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
              <Sparkles className="size-6 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-normal text-[#202124]">Đăng nhập</h1>
              <p className="text-sm text-[#5f6368] mt-1">HR Multi-Agent Platform Enterprise</p>
            </div>
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          {/* OAuth Buttons */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 h-10 rounded-lg border border-[#dadce0] bg-white hover:bg-[#f8f9fa] transition-colors text-sm font-medium text-[#3c4043] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {oauthLoading === "google" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Chrome className="size-4 text-[#4285F4]" />
              )}
              Tiếp tục với Google
            </button>

            <button
              type="button"
              onClick={handleFacebook}
              disabled={busy}
              className="w-full flex items-center justify-center gap-3 h-10 rounded-lg border border-[#dadce0] bg-white hover:bg-[#f8f9fa] transition-colors text-sm font-medium text-[#3c4043] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {oauthLoading === "facebook" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FacebookIcon className="size-4 text-[#1877F2]" />
              )}
              Tiếp tục với Facebook
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#e0e0e0]" />
            <span className="text-xs text-[#5f6368]">hoặc</span>
            <div className="h-px flex-1 bg-[#e0e0e0]" />
          </div>

          {/* Email/Password form */}
          <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#3c4043]">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#5f6368]" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@hr-system.com"
                  className="pl-9 h-10 border-[#dadce0] focus-visible:ring-[#4285F4] focus-visible:border-[#4285F4] text-sm"
                  required
                  disabled={busy}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#3c4043]">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#5f6368]" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10 h-10 border-[#dadce0] focus-visible:ring-[#4285F4] focus-visible:border-[#4285F4] text-sm"
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f6368] hover:text-[#202124]"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 rounded border-[#dadce0] accent-[#4285F4]"
              />
              <span className="text-sm text-[#3c4043]">Nhớ đăng nhập trong 30 ngày</span>
            </label>

            <Button
              type="submit"
              disabled={busy}
              className="h-10 bg-[#1a73e8] hover:bg-[#1765cc] text-white text-sm font-medium rounded-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Đang đăng nhập...
                </>
              ) : (
                "Đăng nhập"
              )}
            </Button>

            {/* Quick Fill Demo Credentials — chỉ hiện khi NEXT_PUBLIC_SHOW_DEMO_LOGIN !== 'false'
                (môi trường production nên đặt 'false' để không lộ tài khoản mẫu). */}
            {process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN !== 'false' && (
            <div className="pt-3 border-t border-[#dadce0] flex flex-col gap-2">
              <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider text-center">
                Tài khoản mẫu để thử nghiệm
              </span>
            <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail("hr-admin@company.com")
                    setPassword("Admin@123")
                  }}
                  className="flex flex-col items-start p-2 rounded-lg border border-[#dadce0] bg-[#f8f9fa] hover:bg-[#e8f0fe] hover:border-[#4285F4] transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-[#1a73e8]">Admin</span>
                  <span className="text-[10px] text-[#5f6368] truncate w-full">hr-admin@company.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("employee1@company.com")
                    setPassword("Employee@123")
                  }}
                  className="flex flex-col items-start p-2 rounded-lg border border-[#dadce0] bg-[#f8f9fa] hover:bg-[#e8f0fe] hover:border-[#4285F4] transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-[#1a73e8]">Nhân viên</span>
                  <span className="text-[10px] text-[#5f6368] truncate w-full">employee1@company.com</span>
                </button>
              </div>
            </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#5f6368] mt-4">
          Hệ thống nội bộ — Chỉ dành cho nhân viên đã được cấp quyền.
        </p>
      </div>
    </div>
  )
}
