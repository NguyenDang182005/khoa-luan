"use client"

import * as React from "react"
import { signInWithGoogle, signInWithFacebook, firebaseSignOut } from "@/lib/firebase"
import { isAdminRole } from "@repo/shared-types"

export type UserRole = "ADMIN" | "EMPLOYEE"

export interface EmployeeProfile {
  id: string
  employeeCode: string
  fullName: string
  avatarUrl?: string | null
  departmentName?: string
  positionTitle?: string
  remainingLeaveDays?: number
  salary?: number
}

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  isActive: boolean
  avatarUrl?: string | null
  displayName?: string | null
  employee?: EmployeeProfile
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>
  loginWithGoogle: (rememberMe: boolean) => Promise<{ success: boolean; error?: string }>
  loginWithFacebook: (rememberMe: boolean) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
const API_BASE = rawApiUrl.replace(/\/api\/v1\/?$/, "") + "/api/v1"

async function fetchProfile(token: string): Promise<Partial<AuthUser>> {
  try {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return {}
    const data = await res.json()
    // Số ngày phép còn lại — đọc thật từ API, lỗi thì bỏ qua (không chặn đăng nhập)
    let remainingLeaveDays: number | undefined
    try {
      const balRes = await fetch(`${API_BASE}/leave/balance/${data.employee.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (balRes.ok) {
        const bal = await balRes.json()
        if (typeof bal?.remainingDays === 'number') remainingLeaveDays = bal.remainingDays
      }
    } catch {
      // bỏ qua
    }
    return {
      avatarUrl: data.avatarUrl ?? null,
      displayName: data.displayName ?? null,
      employee: data.employee
        ? {
            id: data.employee.id,
            employeeCode: data.employee.employeeCode,
            fullName: data.employee.fullName,
            avatarUrl: data.employee.avatarUrl,
            departmentName: data.employee.department?.name,
            positionTitle: data.employee.position?.title,
            remainingLeaveDays,
          }
        : undefined,
    }
  } catch {
    return {}
  }
}

interface AuthResponseData {
  accessToken: string
  user: {
    id: string
    email: string
    role: string
    isActive: boolean
    avatarUrl?: string | null
    displayName?: string | null
  }
}

function saveSession(user: AuthUser, token: string, rememberMe: boolean) {
  if (rememberMe) {
    localStorage.setItem("hr_auth_user", JSON.stringify(user))
    localStorage.setItem("hr_auth_token", token)
  } else {
    // Không "nhớ đăng nhập" → chỉ giữ phiên trong tab hiện tại
    sessionStorage.setItem("hr_auth_user", JSON.stringify(user))
    sessionStorage.setItem("hr_auth_token", token)
  }
}

function clearSession() {
  localStorage.removeItem("hr_auth_user")
  localStorage.removeItem("hr_auth_token")
  sessionStorage.removeItem("hr_auth_user")
  sessionStorage.removeItem("hr_auth_token")
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [token, setToken] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // Restore session from localStorage (rememberMe) hoặc sessionStorage (phiên tab)
  React.useEffect(() => {
    try {
      const savedUser = localStorage.getItem("hr_auth_user") ?? sessionStorage.getItem("hr_auth_user")
      const savedToken = localStorage.getItem("hr_auth_token") ?? sessionStorage.getItem("hr_auth_token")
      if (savedUser && savedToken) {
        setUser(JSON.parse(savedUser))
        setToken(savedToken)
      }
    } catch {
      clearSession()
    } finally {
      setIsLoading(false)
    }
  }, [])

  const applyAuthResponse = async (data: AuthResponseData, rememberMe = true) => {
    const authToken: string = data.accessToken
    let authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      role: data.user.role as UserRole,
      isActive: data.user.isActive,
      avatarUrl: data.user.avatarUrl ?? null,
      displayName: data.user.displayName ?? null,
    }
    const extra = await fetchProfile(authToken)
    authUser = { ...authUser, ...extra }
    setUser(authUser)
    setToken(authToken)
    saveSession(authUser, authToken, rememberMe)
    setIsLoading(false)
    return { success: true as const }
  }

  /** Email/password login — for HR Admin */
  const login = async (
    email: string,
    password: string,
    rememberMe?: boolean,
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        const data = await res.json()
        return applyAuthResponse(data, rememberMe ?? false)
      }
      const err = await res.json().catch(() => ({}))
      setIsLoading(false)
      return { success: false, error: err.message ?? "Email hoặc mật khẩu không chính xác." }
    } catch {
      setIsLoading(false)
      return { success: false, error: "Không thể kết nối máy chủ. Vui lòng thử lại." }
    }
  }

  /** Firebase OAuth — Google */
  const loginWithGoogle = async (rememberMe: boolean): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    try {
      const idToken = await signInWithGoogle(rememberMe)
      const res = await fetch(`${API_BASE}/auth/firebase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, rememberMe }),
      })
      if (res.ok) return applyAuthResponse(await res.json(), rememberMe)
      const err = await res.json().catch(() => ({}))
      setIsLoading(false)
      return { success: false, error: err.message ?? "Tài khoản chưa được cấp quyền truy cập." }
    } catch (err: unknown) {
      setIsLoading(false)
      const code = (err as { code?: string })?.code
      if (code === "auth/popup-closed-by-user") return { success: false, error: "" }
      return { success: false, error: "Đăng nhập Google thất bại. Vui lòng thử lại." }
    }
  }

  /** Firebase OAuth — Facebook */
  const loginWithFacebook = async (rememberMe: boolean): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    try {
      const idToken = await signInWithFacebook(rememberMe)
      const res = await fetch(`${API_BASE}/auth/firebase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, rememberMe }),
      })
      if (res.ok) return applyAuthResponse(await res.json(), rememberMe)
      const err = await res.json().catch(() => ({}))
      setIsLoading(false)
      return { success: false, error: err.message ?? "Tài khoản chưa được cấp quyền truy cập." }
    } catch (err: unknown) {
      setIsLoading(false)
      const code = (err as { code?: string })?.code
      if (code === "auth/popup-closed-by-user") return { success: false, error: "" }
      return { success: false, error: "Đăng nhập Facebook thất bại. Vui lòng thử lại." }
    }
  }

  const logout = () => {
    firebaseSignOut().catch(() => {})
    setUser(null)
    setToken(null)
    clearSession()
  }

  const isAdmin = user ? isAdminRole(user.role) : false

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        isAdmin,
        login,
        loginWithGoogle,
        loginWithFacebook,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}
