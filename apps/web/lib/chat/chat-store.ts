/**
 * Q16(c) — Chat session store (module-level singleton).
 *
 * - Sống qua mọi lần điều hướng view trong SPA (Dashboard ↔ AI Agents ↔ Portal)
 *   vì state không nằm trong component nữa.
 * - DB là nguồn chân lý: khi F5 / đăng nhập lại, store rỗng → view gọi
 *   `agentsApi.getLatestSession(type)` để rehydrate lịch sử từ server.
 * - SessionId do backend sở hữu (Q18): store chỉ giữ lại để gửi kèm lượt chat sau.
 */
import type { ChatHistoryMessage } from '@/lib/api/agents.api'

export interface StoredChat<TMsg> {
  sessionId?: string
  /** true sau khi đã rehydrate từ DB (hoặc xác nhận không có phiên cũ) */
  hydrated: boolean
  /** tin nhắn quiz (chỉ sống trong SPA session — DB chưa lưu đề bài) */
  quizByMessageKey?: Record<string, unknown>
  messages: TMsg[]
}

type AnyChat = StoredChat<unknown>
type Listener = () => void

const store = new Map<string, AnyChat>()
const listeners = new Map<string, Set<Listener>>()

export function getChat<TMsg>(key: string): StoredChat<TMsg> {
  if (!store.has(key)) store.set(key, { hydrated: false, messages: [] })
  return store.get(key) as StoredChat<TMsg>
}

export function patchChat<TMsg>(key: string, patch: Partial<StoredChat<TMsg>>): StoredChat<TMsg> {
  const next = { ...getChat<TMsg>(key), ...patch } as AnyChat
  store.set(key, next)
  listeners.get(key)?.forEach((fn) => fn())
  return next as unknown as StoredChat<TMsg>
}

export function subscribeChat(key: string, fn: Listener): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set())
  listeners.get(key)!.add(fn)
  return () => {
    listeners.get(key)?.delete(fn)
  }
}

/** Ánh xạ message lịch sử từ DB → shape tin nhắn của view (dùng chung 2 view) */
export function mapHistory<TMsg>(
  messages: ChatHistoryMessage[],
  map: (m: ChatHistoryMessage) => TMsg,
): TMsg[] {
  return messages.map(map)
}
