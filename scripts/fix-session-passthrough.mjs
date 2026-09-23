// [fix-session-passthrough] Q16/Q18 — session passthrough cho luồng portal chat:
//  - WF02: Normalize Input nhận thêm sessionId; Get/Create Session gửi sessionId lên API
//  - WF03: Get/Create Session gửi sessionId; THÊM node "Save User Message" (trước đó
//    tin nhắn user không được lưu DB → lịch sử chỉ có assistant) + rewire
//    Get/Create Session → Save User Message → Prepare Agent Input
// API /n8n/chat/session đã hỗ trợ sessionId (ưu tiên dùng nếu còn active).
// Deploy theo pattern delete → create → activate; giữ id. Sau đó chạy fix-router.mjs.
const BASE = process.env.N8N_BASE ?? 'http://localhost:5678'
const EMAIL = process.env.N8N_EMAIL ?? 'haidangnguyen1214@gmail.com'
const PASS = process.env.N8N_PASS ?? 'Lolnamdotavn182005@'

const WF02_NORM = "const body=$input.first().json.body||$input.first().json;return[{json:{originalMessage:body.message||body.originalMessage||'',maskedMessage:body.message||body.maskedMessage||'',channel:body.channel||'web',employeeId:body.employeeId||null,sessionId:body.sessionId||null}}];"
const WF02_SESSION = '={{ JSON.stringify({ sessionId: $json.sessionId || null, employeeId: $json.employeeId || null, type: "HR_QA", channel: $json.channel || "web", externalId: $json.employeeId || null }) }}'
const WF03_SESSION = '={{ JSON.stringify({ sessionId: $("Normalize Input").first().json.sessionId || null, employeeId: $("Normalize Input").first().json.employeeId || null, type: "TRAINING", channel: $("Normalize Input").first().json.channel || "mobile", externalId: $("Normalize Input").first().json.employeeId || null }) }}'

const SAVE_USER_MSG_NODE = (from, to) => ({
  parameters: {
    url: 'http://host.docker.internal:3001/api/v1/n8n/chat/message',
    method: 'POST',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ sessionId: $("Get/Create Session").first().json.id, role: "user", content: $("Normalize Input").first().json.originalMessage, metadata: { intent: "TRAINING" } }) }}',
    options: {},
  },
  id: 'save-user-message',
  name: 'Save User Message',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1300, 250],
  credentials: { httpHeaderAuth: { id: 'WZBfvs5Ihd9XEGUN', name: 'NestJS API Key' } },
  __from: from,
  __to: to,
})

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

const patch = async (h, name, mutate) => {
  const list = await (await fetch(`${BASE}/rest/workflows?limit=100`, { headers: h })).json()
  const metas = (list.data ?? []).filter((w) => w.name === name)
  if (metas.length === 0) { console.error(`[session] Không thấy ${name}`); process.exitCode = 1; return }
  const target = metas.find((w) => w.active) ?? metas[0]
  const wf = (await (await fetch(`${BASE}/rest/workflows/${target.id}`, { headers: h })).json()).data
  mutate(wf)
  for (const old of metas) {
    if (old.active) await fetch(`${BASE}/rest/workflows/${old.id}/deactivate`, { method: 'POST', headers: h })
    await fetch(`${BASE}/rest/workflows/${old.id}/archive`, { method: 'POST', headers: h })
    await fetch(`${BASE}/rest/workflows/${old.id}`, { method: 'DELETE', headers: h })
  }
  wf.active = false
  const created = await (await fetch(`${BASE}/rest/workflows`, { method: 'POST', headers: h, body: JSON.stringify(wf) })).json()
  const wfId = created.data?.id
  const versionId = created.data?.versionId
  if (!wfId) { console.error(`[session] ${name}: create thất bại`); process.exitCode = 1; return }
  await fetch(`${BASE}/rest/workflows/${wfId}/activate`, { method: 'POST', headers: h, body: JSON.stringify({ versionId }) })
  console.log(`[session] ${name}: id=${wfId}${wfId !== target.id ? ' (ĐỔI từ ' + target.id + ')' : ' (giữ)'}`)
}

const main = async () => {
  const h = await login()

  await patch(h, '02 - HR Q&A Agent', (wf) => {
    const norm = wf.nodes.find((n) => n.name === 'Normalize Input')
    norm.parameters.jsCode = WF02_NORM
    const sess = wf.nodes.find((n) => n.name === 'Get/Create Session')
    sess.parameters.jsonBody = WF02_SESSION
    console.log('[session] WF02: đã patch Normalize Input + Get/Create Session')
  })

  await patch(h, '03 - Training Role-play Agent', (wf) => {
    const sess = wf.nodes.find((n) => n.name === 'Get/Create Session')
    sess.parameters.jsonBody = WF03_SESSION
    if (!wf.nodes.find((n) => n.name === 'Save User Message')) {
      const node = SAVE_USER_MSG_NODE('Get/Create Session', 'Prepare Agent Input')
      const { __from, __to, ...clean } = node
      wf.nodes.push(clean)
      const fromConn = wf.connections.__from ?? wf.connections['Get/Create Session']
      // rewire: Get/Create Session → Save User Message → Prepare Agent Input
      const conn = wf.connections['Get/Create Session']
      const prevTarget = conn.main[0][0].node
      conn.main[0][0].node = 'Save User Message'
      wf.connections['Save User Message'] = { main: [[{ node: prevTarget, type: 'main', index: 0 }]] }
      console.log(`[session] WF03: thêm Save User Message, rewire ${__from ?? 'Get/Create Session'} → Save User Message → ${prevTarget}`)
    } else {
      console.log('[session] WF03: Save User Message đã tồn tại — bỏ qua thêm node')
    }
  })

  console.log('[session] Xong — chạy: node scripts/fix-router.mjs (WF01 cần passthrough sessionId từ repo)')
}

main().catch((e) => { console.error('[session] Lỗi:', e); process.exitCode = 1 })
