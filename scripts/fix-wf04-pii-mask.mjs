// [fix-wf04-pii] Cắm node "PII Masking" vào WF04 live (n8n) — fix gốc rễ M1/M2:
// Gemini/Chat Memory chỉ thấy bản masked; DB vẫn lưu original (content) + masked (metadata).
// - Idempotent: nếu node "PII Masking" đã tồn tại → thoát, không làm gì.
// - Cập nhật tại chỗ (PUT) để giữ workflow id + credential; fallback: archive+delete → create → activate.
// Chạy: node scripts/fix-wf04-pii-mask.mjs
const BASE = process.env.N8N_BASE ?? 'http://localhost:5678'
const EMAIL = process.env.N8N_EMAIL ?? 'haidangnguyen1214@gmail.com'
const PASS = process.env.N8N_PASS ?? 'Lolnamdotavn182005@'
const WF_NAME = '04 - Zalo OA CSKH Agent'
const MASK_NODE_NAME = 'PII Masking'

const MASK_JSCODE = [
  '// [PII Masking] WF04 — dùng lại đúng regex của WF01 Router (doc 11: CCCD/CMND, SĐT VN, email).',
  '// Gemini/Chat Memory CHỈ thấy bản masked; bản original vẫn được lưu DB để đối chiếu audit.',
  'const p = $input.first().json;',
  'const raw = String(p.message || p.originalMessage || "");',
  'const masked = raw',
  '  .replace(/\\b(\\d{9}|\\d{12})\\b/g, "[MASKED_ID]")',
  '  .replace(/\\b(0[35789]\\d{8})\\b/g, "[MASKED_PHONE]")',
  '  .replace(/[\\w.-]+@[\\w.-]+\\.\\w+/g, "[MASKED_EMAIL]");',
  'return [{ json: { ...p, message: masked, maskedMessage: masked } }];',
].join('\n')

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
  const wfMeta = (list.data ?? []).filter((w) => w.name === WF_NAME)
  if (wfMeta.length === 0) { console.error(`[fix-wf04-pii] Không tìm thấy workflow "${WF_NAME}"`); process.exitCode = 1; return }
  const target = wfMeta.find((w) => w.active) ?? wfMeta[0]
  console.log(`[fix-wf04-pii] Target: ${target.name} id=${target.id} active=${target.active}`)

  const wf = (await (await fetch(`${BASE}/rest/workflows/${target.id}`, { headers: h })).json()).data
  if (wf.nodes.some((n) => n.name === MASK_NODE_NAME)) {
    console.log('[fix-wf04-pii] Node "PII Masking" đã tồn tại — không làm gì (idempotent).')
    return
  }

  const parseNode = wf.nodes.find((n) => n.name === 'Parse Zalo Message')
  const getSession = wf.nodes.find((n) => n.name === 'Get/Create CSKH Session')
  const saveUser = wf.nodes.find((n) => n.name === 'Save User Message')
  const agent = wf.nodes.find((n) => n.name === 'CSKH Agent')
  if (!parseNode || !getSession || !saveUser || !agent) {
    console.error('[fix-wf04-pii] Thiếu node bắt buộc:', { parseNode: !!parseNode, getSession: !!getSession, saveUser: !!saveUser, agent: !!agent })
    process.exitCode = 1
    return
  }

  // 1) Chèn node PII Masking giữa Parse Zalo Message → Get/Create CSKH Session
  const pos = {
    x: Math.round((parseNode.position[0] + getSession.position[0]) / 2),
    y: parseNode.position[1],
  }
  wf.nodes.push({
    parameters: { jsCode: MASK_JSCODE },
    id: 'pii-masking-cskh',
    name: MASK_NODE_NAME,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [pos.x, pos.y],
  })
  wf.connections['Parse Zalo Message'] = { main: [[{ node: MASK_NODE_NAME, type: 'main', index: 0 }]] }
  wf.connections[MASK_NODE_NAME] = { main: [[{ node: 'Get/Create CSKH Session', type: 'main', index: 0 }]] }

  // 2) Save User Message: content = originalMessage (lưu gốc per doc 07), metadata.maskedMessage = bản mask thật
  const su = saveUser.parameters.jsonBody ?? ''
  const su2 = su.replaceAll('$("Parse Zalo Message")', '$("PII Masking")')
  if (su2 === su) { console.error('[fix-wf04-pii] Save User Message jsonBody không chứa tham chiếu "Parse Zalo Message" — dừng để kiểm tra tay.'); process.exitCode = 1; return }
  saveUser.parameters.jsonBody = su2

  // 3) CSKH Agent: prompt text = bản masked
  const tx = agent.parameters.text ?? ''
  const tx2 = tx.replaceAll('$("Parse Zalo Message")', '$("PII Masking")')
  if (tx2 === tx) { console.error('[fix-wf04-pii] CSKH Agent text không chứa tham chiếu "Parse Zalo Message" — dừng để kiểm tra tay.'); process.exitCode = 1; return }
  agent.parameters.text = tx2

  // 4) Cập nhật live — thử PUT giữ nguyên id; nếu API không hỗ trợ (404) thì fallback
  //    delete+create+activate (pattern chứng minh của scripts/fix-router.mjs).
  const putRes = await fetch(`${BASE}/rest/workflows/${target.id}`, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings, pinData: wf.pinData }),
  })
  const putJson = await putRes.json().catch(() => ({}))
  let wfId = putJson.data?.id ?? null
  let versionId = putJson.data?.versionId ?? null

  if (!putRes.ok || !wfId) {
    console.log(`[fix-wf04-pii] PUT không khả dụng (HTTP ${putRes.status}) → fallback delete+create (như fix-router.mjs)`)
    for (const old of wfMeta) {
      if (old.active) await fetch(`${BASE}/rest/workflows/${old.id}/deactivate`, { method: 'POST', headers: h })
      await fetch(`${BASE}/rest/workflows/${old.id}/archive`, { method: 'POST', headers: h })
      await fetch(`${BASE}/rest/workflows/${old.id}`, { method: 'DELETE', headers: h })
      console.log(`[fix-wf04-pii] Đã gỡ bản cũ: ${old.id}`)
    }
    wf.active = false
    const createRes = await fetch(`${BASE}/rest/workflows`, { method: 'POST', headers: h, body: JSON.stringify(wf) })
    const created = await createRes.json().catch(() => ({}))
    wfId = created.data?.id ?? null
    versionId = created.data?.versionId ?? null
    if (!wfId) { console.error(`[fix-wf04-pii] Create thất bại: ${JSON.stringify(created).slice(0, 200)}`); process.exitCode = 1; return }
    const act = await (await fetch(`${BASE}/rest/workflows/${wfId}/activate`, { method: 'POST', headers: h, body: JSON.stringify({ versionId }) })).json()
    console.log(`[fix-wf04-pii] Activate: ${act.data?.active ? '🟢' : `❌ ${act.message}`}`)
  }

  // 5) Verify
  const after = (await (await fetch(`${BASE}/rest/workflows/${wfId}`, { headers: h })).json()).data
  const okNode = after.nodes.some((n) => n.name === MASK_NODE_NAME)
  const okConn = after.connections?.[MASK_NODE_NAME]?.main?.[0]?.[0]?.node === 'Get/Create CSKH Session'
    && after.connections?.['Parse Zalo Message']?.main?.[0]?.[0]?.node === MASK_NODE_NAME
  const okRef = after.nodes.find((n) => n.name === 'CSKH Agent').parameters.text.includes('$("PII Masking")')
    && after.nodes.find((n) => n.name === 'Save User Message').parameters.jsonBody.includes('$("PII Masking")')
  console.log(`[fix-wf04-pii] Verify: node=${okNode ? '✅' : '❌'} connections=${okConn ? '✅' : '❌'} refs=${okRef ? '✅' : '❌'} active=${after.active}`)
  if (okNode && okConn && okRef) {
    console.log(`[fix-wf04-pii] ✅ WF04 đã có PII Masking. NEW_WF04_ID=${wfId}`)
    console.log('[fix-wf04-pii] ⚠️ WF01 Router vẫn trỏ workflowId cũ của WF04 — BẮT BUỘC chạy tiếp: node scripts/fix-router.mjs')
    console.log('[fix-wf04-pii] Kế tiếp: node scripts/fix-router.mjs → node scripts/diag-pii-runtime.cjs')
  } else process.exitCode = 1
}

main().catch((e) => { console.error('[fix-wf04-pii] Lỗi:', e); process.exitCode = 1 })
