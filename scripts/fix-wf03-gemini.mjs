// [fix-wf03-gemini] Sửa node Gemini của WF03 (Training) — fix bug "không trả về 5 MCQ + 2 tự luận":
//  - model: models/gemini-2.5-flash (chuẩn tài liệu, tránh 503 high-demand của 3.6-flash)
//  - maxOutputTokens: 8192 — gemini-2.5-flash là model THINKING, thinking token tính vào budget;
//    1024/2048 đều bị cắt cụt JSON (finishReason=MAX_TOKENS) → rơi quiz cứng fallback
//  - retryOnFail: true, maxTries: 3, waitBetweenTries: 3000 (lướt qua 503 tạm thời)
// Deploy theo pattern fix-router.mjs (deactivate → archive → delete → create → activate).
// Idempotent: nếu node đã đúng cấu hình → thoát.
// Chạy: node scripts/fix-wf03-gemini.mjs   → sau đó: node scripts/fix-router.mjs
const BASE = process.env.N8N_BASE ?? 'http://localhost:5678'
const EMAIL = process.env.N8N_EMAIL ?? 'haidangnguyen1214@gmail.com'
const PASS = process.env.N8N_PASS ?? 'Lolnamdotavn182005@'
const WF_NAME = '03 - Training Role-play Agent'
const EXPECT_MAX_OUT = 8192

const login = async () => {
  const res = await fetch(`${BASE}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS, mfaCode: '' }),
    redirect: 'manual',
  })
  const cookies = res.headers.get('set-cookie') || ''
  return { 'Content-Type': 'application/json', Cookie: cookies.split(',').map((c) => c.split(';')[0].trim()).join('; ') }
}

const main = async () => {
  const h = await login()
  const list = await (await fetch(`${BASE}/rest/workflows?limit=100`, { headers: h })).json()
  const metas = (list.data ?? []).filter((w) => w.name === WF_NAME)
  if (metas.length === 0) { console.error(`Không tìm thấy "${WF_NAME}"`); process.exitCode = 1; return }
  const target = metas.find((w) => w.active) ?? metas[0]
  const wf = (await (await fetch(`${BASE}/rest/workflows/${target.id}`, { headers: h })).json()).data
  const gem = wf.nodes.find((n) => n.type.includes('lmChat'))
  if (!gem) { console.error('Không tìm thấy node Gemini'); process.exitCode = 1; return }

  const already =
    gem.parameters.modelName === 'models/gemini-2.5-flash' &&
    gem.parameters.options?.maxOutputTokens === EXPECT_MAX_OUT &&
    gem.retryOnFail === true
  if (already) { console.log('[fix-wf03-gemini] Node đã đúng cấu hình — không làm gì (idempotent).'); return }

  console.log(`[fix-wf03-gemini] Before: model=${gem.parameters.modelName} maxOut=${gem.parameters.options?.maxOutputTokens} retry=${gem.retryOnFail ?? false}`)
  gem.parameters.modelName = 'models/gemini-2.5-flash'
  gem.parameters.options = { ...(gem.parameters.options ?? {}), maxOutputTokens: EXPECT_MAX_OUT }
  gem.retryOnFail = true
  gem.maxTries = 3
  gem.waitBetweenTries = 3000

  // Gỡ bản cũ → tạo bản mới (payload giữ nguyên id → n8n thường giữ id; nếu đổi sẽ in ra)
  for (const old of metas) {
    if (old.active) await fetch(`${BASE}/rest/workflows/${old.id}/deactivate`, { method: 'POST', headers: h })
    await fetch(`${BASE}/rest/workflows/${old.id}/archive`, { method: 'POST', headers: h })
    await fetch(`${BASE}/rest/workflows/${old.id}`, { method: 'DELETE', headers: h })
    console.log(`[fix-wf03-gemini] Đã gỡ bản cũ: ${old.id}`)
  }
  wf.active = false
  const created = await (await fetch(`${BASE}/rest/workflows`, { method: 'POST', headers: h, body: JSON.stringify(wf) })).json()
  const wfId = created.data?.id
  const versionId = created.data?.versionId
  if (!wfId) { console.error(`Create thất bại: ${JSON.stringify(created).slice(0, 200)}`); process.exitCode = 1; return }
  const act = await (await fetch(`${BASE}/rest/workflows/${wfId}/activate`, { method: 'POST', headers: h, body: JSON.stringify({ versionId }) })).json()
  console.log(`[fix-wf03-gemini] Activate: ${act.data?.active ? '🟢' : `❌ ${act.message}`}`)

  // Verify
  const after = (await (await fetch(`${BASE}/rest/workflows/${wfId}`, { headers: h })).json()).data
  const g2 = after.nodes.find((n) => n.type.includes('lmChat'))
  const okCfg = g2.parameters.modelName === 'models/gemini-2.5-flash' && g2.parameters.options?.maxOutputTokens === EXPECT_MAX_OUT && g2.retryOnFail === true
  console.log(`[fix-wf03-gemini] Verify: model=${g2.parameters.modelName} maxOut=${g2.parameters.options?.maxOutputTokens} retry=${g2.retryOnFail} → ${okCfg ? '✅' : '❌'}`)
  console.log(`[fix-wf03-gemini] WF03_ID=${wfId}`)
  if (wfId !== target.id) console.log('[fix-wf03-gemini] ⚠️ ID đổi — BẮT BUỘC chạy: node scripts/fix-router.mjs')
  else console.log('[fix-wf03-gemini] ID giữ nguyên — vẫn nên chạy fix-router.mjs cho chắc.')
}

main().catch((e) => { console.error('[fix-wf03-gemini] Lỗi:', e); process.exitCode = 1 })
