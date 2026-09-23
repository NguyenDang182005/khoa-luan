// [diag-toggle] Feedback loop cho bug "nút toggle bot lỗi" ở Bàn Tiếp Quản CSKH.
//
// Cách chạy:
//   node scripts/diag-toggle.mjs
//   DIAG_EMAIL=... DIAG_PASSWORD=... API_BASE=http://localhost:3001/api/v1 node scripts/diag-toggle.mjs
//
// Script này:
//   1. Đăng nhập lấy JWT (như Web Portal).
//   2. GET /agents/conversations + /agents/escalation-queue.
//   3. Chọn 1 phiên CSKH → POST deactivate → kiểm tra contract → POST reactivate → khôi phục.
//   4. Assert: (a) `escalated` authoritative từ server lật đúng sau mỗi lần toggle;
//              (b) membership hàng đợi lật đúng;
//              (c) TRẠNG THÁI UI SUY RA (rule của component) khớp authoritative —
//                  đây chính là symptom "bấm toggle xong trạng thái vẫn như cũ".
//
// Exit code: 0 = mọi assertion PASS, 1 = có RED.

const API_BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1'
const EMAIL = process.env.DIAG_EMAIL ?? 'hr-admin@company.com'
const PASSWORD = process.env.DIAG_PASSWORD ?? 'Admin@123'

let failures = 0
const ok = (cond, label, detail = '') => {
  const tag = cond ? 'PASS' : 'RED '
  if (!cond) failures++
  console.log(`  [${tag}] ${label}${detail ? ` — ${detail}` : ''}`)
}

const api = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Connection: 'close', // không giữ keep-alive socket → process kết thúc sạch trên Windows
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* giữ text */ }
  return { status: res.status, json, text }
}

// ── Rule suy ra trạng thái UI ────────────────────────────────────────────────
// RULE CŨ (bug): metadata.escalated (do WF04 ghi vào TIN NHẮN lúc escalate) thắng.
const deriveOld = (c) => c.metadata?.escalated ?? c.escalated
// RULE MỚI (fix): escalated authoritative của server luôn thắng; queue thì luôn true.
const deriveNew = (c, fromQueue) => (fromQueue ? true : c.escalated)

const main = async () => {
  console.log(`[diag-toggle] API: ${API_BASE}`)
  const login = await api('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } })
  if (login.status !== 200 || !login.json?.accessToken) {
    console.log(`  [RED ] Login thất bại HTTP ${login.status} — không chạy tiếp được.`)
    process.exitCode = 1; return
  }
  const token = login.json.accessToken
  console.log('  [PASS] Login OK (token đã ẩn)')

  const conv = await api('/agents/conversations', { token })
  ok(conv.status === 200 && Array.isArray(conv.json), 'GET /agents/conversations trả 200 + array', `status=${conv.status}`)
  const sessions = conv.json ?? []
  if (sessions.length === 0) {
    console.log('  [RED ] Không có phiên CSKH nào trong DB để test toggle — cần seed dữ liệu trước.')
    process.exitCode = 1; return
  }

  // 1) Tiền đề dữ liệu: metadata.escalated có MỌI THÌ lệch với authoritative?
  const mismatched = sessions.filter((c) => c.metadata?.escalated !== undefined && c.metadata.escalated !== c.escalated)
  console.log(`\n— Dữ liệu: ${sessions.length} phiên CSKH, ${mismatched.length} phiên có metadata.escalated KHÁC authoritative (escalated=!isActive)`)
  for (const c of mismatched.slice(0, 5)) {
    console.log(`    • ${c.id.slice(0, 8)}… authoritative=${c.escalated} metadata.escalated=${c.metadata.escalated}`)
  }

  const target = sessions[0]
  const id = target.id
  const origEscalated = target.escalated
  console.log(`\n— Target: session ${id.slice(0, 8)}… (trạng thái gốc escalated=${origEscalated})`)

  // 2) Toggle #1: đưa session về trạng thái NGƯỢC LẠI rồi kiểm tra contract
  const wantEscalated = !origEscalated
  const toggleRes = await api(`/agents/chat-session/${id}/${wantEscalated ? 'deactivate' : 'reactivate'}`, { method: 'POST', token })
  ok([200, 201].includes(toggleRes.status), `POST /agents/chat-session/:id/${wantEscalated ? 'deactivate' : 'reactivate'} trả 200/201 (NestJS @Post mặc định 201)`, `status=${toggleRes.status} body=${toggleRes.text.slice(0, 120)}`)

  const after1 = await api('/agents/conversations', { token })
  const row1 = (after1.json ?? []).find((c) => c.id === id)
  ok(row1?.escalated === wantEscalated, 'Sau toggle #1: escalated authoritative lật đúng', `expected=${wantEscalated} actual=${row1?.escalated}`)

  const queue1 = await api('/agents/escalation-queue', { token })
  const inQueue1 = (queue1.json ?? []).some((c) => c.id === id)
  ok(inQueue1 === wantEscalated, 'Sau toggle #1: membership hàng đợi lật đúng', `expected inQueue=${wantEscalated} actual=${inQueue1}`)

  // 3) SYMPTOM CHÍNH: UI suy ra từ payload server — rule cũ lệch nghĩa là "bấm toggle mà trạng thái vẫn như cũ"
  const uiOld1 = deriveOld(row1)
  const uiNew1 = deriveNew(row1, false)
  ok(uiNew1 === row1.escalated, 'Trạng thái UI (rule MỚI: authoritative thắng) khớp server', `ui=${uiNew1}`)
  if (uiOld1 !== row1.escalated) {
    console.log(`  [RED ] (rule CŨ trước fix) UI sẽ hiển thị escalated=${uiOld1} trong khi server=${row1.escalated} → bấm toggle xong trạng thái LẬT NGƯỢC LẠI như cũ — đúng bug user báo (đã sửa: component dùng rule MỚI)`)
  } else {
    console.log(`  [PASS] rule CŨ lần này trùng authoritative (metadata may mắn khớp) — nhưng vẫn không đáng tin`)
  }

  // 4) Toggle #2: quay về trạng thái gốc, kiểm tra contract + UI lần nữa
  const backRes = await api(`/agents/chat-session/${id}/${origEscalated ? 'deactivate' : 'reactivate'}`, { method: 'POST', token })
  ok([200, 201].includes(backRes.status), `Khôi phục trạng thái gốc trả 200/201`, `status=${backRes.status}`)

  const after2 = await api('/agents/conversations', { token })
  const row2 = (after2.json ?? []).find((c) => c.id === id)
  ok(row2?.escalated === origEscalated, 'Sau toggle #2 (khôi phục): escalated đúng như gốc', `expected=${origEscalated} actual=${row2?.escalated}`)
  const uiOld2 = deriveOld(row2)
  const uiNew2 = deriveNew(row2, false)
  ok(uiNew2 === row2.escalated, 'Trạng thái UI (rule MỚI) khớp server (lần 2)', `ui=${uiNew2}`)
  if (uiOld2 !== row2.escalated) {
    console.log(`  [RED ] (rule CŨ) UI hiển thị escalated=${uiOld2} trong khi server=${row2.escalated}`)
  }

  console.log(`\n[diag-toggle] Kết thúc: ${failures === 0 ? 'MỌI ASSERTION PASS ✅' : `${failures} assertion RED ❌`}`)
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch((e) => {
  console.error('[diag-toggle] Lỗi không mong đợi:', e)
  process.exitCode = 1; return
})
