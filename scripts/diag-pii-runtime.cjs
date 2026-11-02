// [diag-pii] Runtime test tính năng PII masking — bắn PII GIẢ qua 2 luồng:
//   WF01: POST /agents/chat (JWT) → n8n WF01 Router → agent → Gemini
//   WF04: POST n8n /webhook/zalo-webhook (mô phỏng khách Zalo/Slack) → Gemini
// Sau đó soi: DB (AiChatMessage content + metadata), GET /agents/pii-audit,
// và quét DB tìm PII "thật" chưa mask (CHỈ BÁO CÁO, không đụng dữ liệu).
//
// PII giả dùng test: SĐT 0900000001 • CCCD 001200000001 • email test@example.com
// Chạy: node scripts/diag-pii-runtime.mjs
const path = require('path')
const { createRequire } = require('module')
const req = createRequire(__filename)
const { PrismaClient } = req(path.resolve(__dirname, '..', 'packages', 'database', 'node_modules', '@prisma', 'client'))

const API_BASE = process.env.API_BASE ?? 'http://localhost:3001/api/v1'
const N8N_CSKH = process.env.N8N_CSKH_WEBHOOK_URL ?? 'http://localhost:5678/webhook/zalo-webhook'
const EMAIL = process.env.DIAG_EMAIL ?? 'hr-admin@company.com'
const PASSWORD = process.env.DIAG_PASSWORD ?? 'Admin@123'

const FAKE = { phone: '0900000001', cccd: '001200000001', email: 'test@example.com', name: 'Nguyễn Văn Test' }
const MARKERS = Object.values(FAKE)
const wf01Msg = `Tôi là ${FAKE.name}, SĐT ${FAKE.phone}, CCCD ${FAKE.cccd}, email ${FAKE.email}. Cho tôi hỏi chính sách nghỉ phép năm bao nhiêu ngày?`
const wf04Msg = `Cho tôi hỏi gói Pro của TechHRM giá bao nhiêu? Liên hệ tôi qua SĐT ${FAKE.phone} hoặc email ${FAKE.email}, CCCD ${FAKE.cccd}.`

let failures = 0
const ok = (cond, label, detail = '') => {
  console.log(`  [${cond ? 'PASS' : 'RED '}] ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}

/** Đếm PII giả xuất hiện nguyên văn trong 1 chuỗi */
const rawHits = (s) => (typeof s === 'string' ? MARKERS.filter((m) => s.includes(m)) : [])

const api = async (p, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${API_BASE}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', Connection: 'close', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try { return { status: res.status, json: JSON.parse(text), text } } catch { return { status: res.status, json: null, text } }
}

/** Rút gọn PII thật khi in ra màn hình (3 ký tự đầu + độ dài) */
const redact = (s) => (s.length > 6 ? `${s.slice(0, 3)}…(độ dài ${s.length})` : '…')

let prisma = null

const main = async () => {
  console.log('[diag-pii] Runtime test PII masking — PII GIẢ: 0900000001 / 001200000001 / test@example.com')
  prisma = new PrismaClient()
  let token = null
  const login = await api('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } })
  token = login.json?.accessToken ?? null
  if (!token) { console.log('  [RED ] Login thất bại — dừng.'); process.exitCode = 1; return }
  console.log('  [PASS] Login OK')

  // ── Luồng WF01: portal chat ──────────────────────────────────────────────
  console.log('\n— WF01: POST /agents/chat với PII giả trong câu hỏi nghỉ phép')
  const mark = new Date(Date.now() - 5000)
  const r1 = await api('/agents/chat', { method: 'POST', token, body: { message: wf01Msg } })
  ok(r1.status === 200 || r1.status === 201, 'WF01 portal chat trả 200/201', `status=${r1.status}`)
  const reply1 = typeof r1.json === 'string' ? r1.json : r1.json?.reply ?? r1.json?.message ?? r1.json?.content ?? JSON.stringify(r1.json)?.slice(0, 200)
  console.log(`    Bot trả lời (cắt 120 ký tự): ${String(reply1).slice(0, 120)}`)
  ok(rawHits(String(reply1)).length === 0, 'WF01: phản hồi bot KHÔNG lặp lại PII giả nguyên văn', rawHits(String(reply1)).join(','))

  // ── Luồng WF04: mô phỏng khách Zalo/Slack qua n8n webhook ───────────────
  console.log('\n— WF04: POST n8n /webhook/zalo-webhook với PII giả (khách hỏi giá gói Pro)')
  let wf04Ok = false
  try {
    const res = await fetch(N8N_CSKH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close', 'x-api-key': process.env.N8N_API_KEY ?? '' },
      body: JSON.stringify({ userId: 'diag-pii-test-user', message: wf04Msg, originalMessage: wf04Msg, channel: 'zalo', externalId: 'diag-pii-test-user', slackChannel: process.env.DIAG_SLACK_CHANNEL ?? null, threadTs: null }),
      signal: AbortSignal.timeout(90_000),
    })
    const text = await res.text()
    wf04Ok = res.ok
    ok(wf04Ok, 'n8n WF04 webhook trả 2xx', `status=${res.status} body=${text.slice(0, 120)}`)
  } catch (e) {
    ok(false, 'n8n WF04 webhook gọi được', e.message)
  }

  // Đợi pipeline ghi DB xong (WF04 reply outbound chạy nền)
  await new Promise((r) => setTimeout(r, 5000))

  // ── Soi DB: session mới nhất chứa PII giả ────────────────────────────────
  console.log('\n— DB: AiChatMessage chứa PII giả (sau mốc test)')
  const msgs = await prisma.aiChatMessage.findMany({
    where: { createdAt: { gte: mark }, OR: MARKERS.map((m) => ({ content: { contains: m } })) },
    orderBy: { createdAt: 'asc' },
    include: { session: { select: { id: true, type: true, channel: true, externalId: true } } },
  })
  console.log(`    Tìm thấy ${msgs.length} message chứa PII giả nguyên văn trong content`)
  for (const m of msgs) {
    const maskedTokens = (JSON.stringify(m.metadata)?.match(/\[MASKED_[A-Z_]+\]/g) ?? []).join(',')
    console.log(`    • [${m.role}] session=${m.session?.type}/${m.session?.channel} ext=${m.session?.externalId} metadata_masked_tokens=${maskedTokens || '(không có)'} content=${JSON.stringify(m.content).slice(0, 90)}`)
  }
  const userMsgsRaw = msgs.filter((m) => m.role === 'user' && rawHits(m.content).length > 0)
  console.log(`    (content gốc giữ PII là CHỦ ĐÍCH của kế hoạch "lưu original + masked" — đánh giá nằm ở metadata.maskedMessage bên dưới)`)

  // ── Assertion chính WF04: bản mask phải thật ─────────────────────────────
  console.log('\n— Assertion WF04: metadata.maskedMessage của message user mới nhất')
  const wf04User = await prisma.aiChatMessage.findFirst({
    where: { role: 'user', session: { externalId: 'diag-pii-test-user' } },
    orderBy: { createdAt: 'desc' },
  })
  if (!wf04User) {
    ok(false, 'WF04: tìm thấy message user của session test trong DB')
  } else {
    const mm = wf04User.metadata?.maskedMessage
    console.log(`    content(raw, chủ đích)=${JSON.stringify(wf04User.content).slice(0, 80)}`)
    console.log(`    metadata.maskedMessage=${JSON.stringify(mm)?.slice(0, 100)}`)
    ok(typeof mm === 'string' && mm !== wf04User.content, 'WF04: metadata.maskedMessage KHÁC content (bản mask thật, không còn no-op)')
    ok(
      typeof mm === 'string' && mm.includes('[MASKED_PHONE]') && mm.includes('[MASKED_ID]') && mm.includes('[MASKED_EMAIL]'),
      'WF04: bản mask chứa đủ 3 token [MASKED_PHONE]/[MASKED_ID]/[MASKED_EMAIL]',
    )
    ok(typeof mm === 'string' && rawHits(mm).length === 0, 'WF04: bản mask không còn PII giả nguyên văn', rawHits(String(mm)).join(','))
  }

  // Assistant reply của WF04 không lặp lại PII giả
  const wf04Assistant = await prisma.aiChatMessage.findFirst({
    where: { role: 'assistant', session: { externalId: 'diag-pii-test-user' } },
    orderBy: { createdAt: 'desc' },
  })
  if (wf04Assistant) ok(rawHits(wf04Assistant.content).length === 0, 'WF04: phản hồi bot không lặp lại PII giả')

  // Metadata của user message mới nhất mỗi luồng — xem bản masking được lưu không
  console.log('\n— Metadata đầy đủ của message user (WF01 + WF04) — tìm bản masked')
  const forMeta = await prisma.aiChatMessage.findMany({
    where: { role: 'user', createdAt: { gte: mark } },
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: { session: { select: { type: true, externalId: true } } },
  })
  for (const m of forMeta.slice(0, 4)) {
    console.log(`    • ${m.session?.type}/${m.session?.externalId}: metadata=${JSON.stringify(m.metadata)?.slice(0, 300)}`)
  }

  // ── API pii-audit trả gì: masked hay raw? ────────────────────────────────
  console.log('\n— API GET /agents/pii-audit?limit=10')
  const audit = await api('/agents/pii-audit?limit=10', { token })
  ok(audit.status === 200 && Array.isArray(audit.json?.items), 'pii-audit trả 200 + items', `status=${audit.status}`)
  const items = audit.json?.items ?? []
  for (const it of items.slice(0, 6)) {
    const hits = rawHits(it.content)
    const metaStr = JSON.stringify(it.metadata ?? {})
    const metaMasked = /\[MASKED_/.test(metaStr)
    console.log(`    • [${it.role}] ${it.session?.type ?? '?'} raw_hits=[${hits.join(',')}] metadata_has_masked=${metaMasked} content=${JSON.stringify(it.content).slice(0, 80)}`)
  }

  // ── Quét DB tìm PII "THẬT" chưa mask (CHỈ BÁO CÁO) ─────────────────────
  console.log('\n— Quét toàn bộ DB: PII trông-thật (khác PII giả test) — CHỈ BÁO CÁO')
  const all = await prisma.aiChatMessage.findMany({ select: { id: true, role: true, content: true, session: { select: { type: true } } } })
  const patterns = [
    { name: 'SĐT VN', re: /(?:^|\D)(0(?:3|5|7|8|9)\d{8})(?:\D|$)/g },
    { name: 'Email', re: /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g },
    { name: 'CCCD 12 số', re: /(?:^|\D)(0\d{2}\d{9})(?:\D|$)/g },
  ]
  const leaks = {}
  for (const m of all) {
    for (const p of patterns) {
      for (const match of m.content.matchAll(p.re)) {
        const v = match[1] ?? match[0]
        if (MARKERS.includes(v)) continue // PII giả của test
        const key = `${p.name}`
        leaks[key] = leaks[key] ?? new Map()
        leaks[key].set(v, (leaks[key].get(v) ?? 0) + 1)
      }
    }
  }
  if (Object.keys(leaks).length === 0) {
    console.log('    Không thấy PII trông-thật nào trong content của DB ✅')
  } else {
    for (const [k, vals] of Object.entries(leaks)) {
      console.log(`    [CẢNH BÁO] ${k}: ${vals.size} giá trị trông-thật xuất hiện nguyên văn trong content`)
      let i = 0
      for (const [v, n] of vals) {
        if (i++ >= 5) { console.log(`      … và còn ${vals.size - 5} giá trị khác`); break }
        console.log(`      • ${redact(v)} (x${n})`)
      }
    }
    console.log('    → Chỉ ghi nhận, CHƯA xử lý dữ liệu (theo quyết định của bạn).')
  }

  console.log(`\n[diag-pii] Kết thúc: ${failures === 0 ? 'KHÔNG có assertion RED ✅' : `${failures} assertion RED ❌`}`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((e) => { console.error('[diag-pii] Lỗi:', e); process.exitCode = 1 })
  .finally(async () => { try { await prisma?.$disconnect?.() } catch { /* noop */ } })
