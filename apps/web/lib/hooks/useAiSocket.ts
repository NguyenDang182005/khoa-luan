"use client"

import { useEffect, useRef, useState } from "react"
import { io, Socket } from "socket.io-client"

export interface AiActivityEvent {
  wf: string
  label: string
  total: number
  avgLatencyMs: number | null
  lastActiveAt: string
}

interface UseAiSocketOptions {
  userId: string | null
  isAdmin: boolean
  onActivity: (data: AiActivityEvent) => void
}

/**
 * Connects to ws://API_HOST/notifications, joins room '"'"'admin'"'"',
 * and calls onActivity() whenever the server emits '"'"'ai:activity'"'"'.
 * Returns `connected` boolean so the dashboard badge can reflect live status.
 */
export function useAiSocket({ userId, isAdmin, onActivity }: UseAiSocketOptions) {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const onActivityRef = useRef(onActivity)

  // Keep callback ref fresh without re-connecting on every render
  useEffect(() => {
    onActivityRef.current = onActivity
  }, [onActivity])

  useEffect(() => {
    if (!userId || !isAdmin) return

    // #14: gửi token trong handshake — server verify JWT mới cho join room.
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
    const wsBase = rawApiUrl.replace(/\/api\/v1\/?$/, "")

    // Lấy token từ localStorage (cách lưu của auth-context).
    let token: string | null = null
    try { token = localStorage.getItem("hr_auth_token") ?? sessionStorage.getItem("hr_auth_token") } catch { /* storage bị chặn: kết nối không token, server sẽ từ chối */ }

    const socket = io(`${wsBase}/notifications`, {
      transports: ["websocket"],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      auth: { token },
    })
    socketRef.current = socket

    socket.on("connect", () => {
      setConnected(true)
      socket.emit("join-admin")
    })

    socket.on("disconnect", () => setConnected(false))
    socket.on("connect_error", () => setConnected(false))

    socket.on("ai:activity", (data: AiActivityEvent) => {
      onActivityRef.current(data)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [userId, isAdmin])

  return { connected }
}
