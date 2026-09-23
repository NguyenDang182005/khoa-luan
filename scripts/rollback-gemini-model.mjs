// [rollback-gemini] Đưa TẤT CẢ agent workflows về model chuẩn gemini-2.5-flash
// (WF01 Router là 0-LLM nên không có node Gemini; WF02/03/04 được patch).
// - WF03 giữ nguyên các cài đặt đã fix (maxOutputTokens 2048 + retryOnFail).
// - WF02/WF04 chỉ đổi modelName, giữ lại phần còn lại.
// Idempotent: node nào đã là 2.5-flash thì bỏ qua.
// Chạy: node scripts/rollback-gemini-model.mjs → sau đó node scripts/fix-router.mjs (nếu id đổi)
const BASE = process.env.N8N_BASE ?? 'http://localhost:5678'
const EMAIL = process.env.N8N_EMAIL ?? 'haidangnguyen1214@gmail.com'
const PASS = process.env.N8N_PASS ?? 'Lolnamdotavn182005@'
const MODEL = 'models/gemini-3.1-flash-lite'
const NAMES = ['02 - HR Q&A Agent', '03 - Training Role-play Agent', '04 - Zalo OA CSKH Agent']

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
  const idChanged = []
  for (const name of NAMES) {
    const metas = (list.data ?? []).filter((w) => w.name === name)
    if (metas.length === 0) { console.log(`[rollback] Bỏ qua (không thấy): ${name}`); continue }
    const target = metas.find((w) => w.active) ?? metas[0]
    const wf = (await (await fetch(`${BASE}/rest/workflows/${target.id}`, { headers: h })).json()).data
    const gem = wf.nodes.find((n) => n.type.includes('lmChat'))
    if (!gem) { console.log(`[rollback] ${name}: không có node Gemini — bỏ qua`); continue }
    if (gem.parameters.modelName === MODEL) { console.log(`[rollback] ${name}: đã là ${MODEL} — bỏ qua`); continue }

    console.log(`[rollback] ${name}: ${gem.parameters.modelName} → ${MODEL}`)
    gem.parameters.modelName = MODEL

    for (const old of metas) {
      if (old.active) await fetch(`${BASE}/rest/workflows/${old.id}/deactivate`, { method: 'POST', headers: h })
      await fetch(`${BASE}/rest/workflows/${old.id}/archive`, { method: 'POST', headers: h })
      await fetch(`${BASE}/rest/workflows/${old.id}`, { method: 'DELETE', headers: h })
    }
    wf.active = false
    const created = await (await fetch(`${BASE}/rest/workflows`, { method: 'POST', headers: h, body: JSON.stringify(wf) })).json()
    const wfId = created.data?.id
    const versionId = created.data?.versionId
    if (!wfId) { console.error(`[rollback] ${name}: create thất bại ${JSON.stringify(created).slice(0, 150)}`); process.exitCode = 1; continue }
    const act = await (await fetch(`${BASE}/rest/workflows/${wfId}/activate`, { method: 'POST', headers: h, body: JSON.stringify({ versionId }) })).json()
    const g2 = ((await (await fetch(`${BASE}/rest/workflows/${wfId}`, { headers: h })).json()).data).nodes.find((n) => n.type.includes('lmChat'))
    console.log(`[rollback] ${name}: id=${wfId}${wfId !== target.id ? ' (ĐỔI từ ' + target.id + ')' : ' (giữ)'} active=${!!act.data?.active} model=${g2.parameters.modelName}`)
    if (wfId !== target.id) idChanged.push(name)
  }
  console.log(idChanged.length > 0
    ? `[rollback] ⚠️ Có workflow đổi id (${idChanged.join(', ')}) — chạy: node scripts/fix-router.mjs`
    : '[rollback] Không có id đổi — vẫn khuyến nghị chạy fix-router.mjs cho chắc.')
}

main().catch((e) => { console.error('[rollback] Lỗi:', e); process.exitCode = 1 })
