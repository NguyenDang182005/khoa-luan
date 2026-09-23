// [deploy-wf03] Deploy WF03 từ repo JSON (n8n-workflows/03-training-agent.json) lên live.
// Dùng khi restructure connections/nodes — patch tại chỗ quá phức tạp thì deploy cả workflow.
// Sau khi chạy: node scripts/fix-router.mjs (WF03 có thể đổi id).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = process.env.N8N_BASE ?? 'http://localhost:5678'
const EMAIL = process.env.N8N_EMAIL ?? 'haidangnguyen1214@gmail.com'
const PASS = process.env.N8N_PASS ?? 'Lolnamdotavn182005@'
const WF_NAME = '03 - Training Role-play Agent'

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

// Key x-api-key KHÔNG có exp (JWT vĩnh viễn) — bản trong credential cũ đã hết hạn → 401
const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjhjNjczMy01ZDU1LTRiMjYtOWVjYS1mMGRjY2JhZDQxZDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzUxZWFiMGMtOTIyZi00ODRjLTkyZDktMDYxMDNmODAxYjIwIiwiaWF0IjoxNzg4NTQwMjM5fQ.t2tPDsIFoPfi_h1WmiECQ_1N_IhvKRQpJLeKp9Hqe7k'

/** Đảm bảo có credential httpHeaderAuth "NestJS API Key" với key không-hạn; trả về id */
const ensureCredential = async (h) => {
  const res = await fetch(`${BASE}/rest/credentials`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ name: 'NestJS API Key (no-exp)', type: 'httpHeaderAuth', data: { name: 'x-api-key', value: API_KEY } }),
  })
  const j = await res.json()
  const id = j.data?.id ?? j.id
  if (!id) { console.error(`[deploy-wf03] Tạo credential thất bại: ${JSON.stringify(j).slice(0, 200)}`); process.exitCode = 1; return }
  console.log(`[deploy-wf03] Credential mới: ${id}`)
  return id
}

const main = async () => {
  const h = await login()
  const here = dirname(fileURLToPath(import.meta.url))
  const repo = JSON.parse(readFileSync(join(here, '..', 'n8n-workflows', '03-training-agent.json'), 'utf8'))

  const list = await (await fetch(`${BASE}/rest/workflows?limit=100`, { headers: h })).json()
  const metas = (list.data ?? []).filter((w) => w.name === WF_NAME)
  for (const old of metas) {
    if (old.active) await fetch(`${BASE}/rest/workflows/${old.id}/deactivate`, { method: 'POST', headers: h })
    await fetch(`${BASE}/rest/workflows/${old.id}/archive`, { method: 'POST', headers: h })
    await fetch(`${BASE}/rest/workflows/${old.id}`, { method: 'DELETE', headers: h })
    console.log(`[deploy-wf03] Đã gỡ bản cũ: ${old.id}`)
  }

  repo.active = false
  // QUAN TRỌNG 1: bỏ các field ownership/export (shared/workflowId cũ…) — nếu giữ,
  // workflow mới mất quyền truy cập credential httpHeaderAuth
  // QUAN TRỌNG 2: các node HTTP dùng INLINE header x-api-key (pattern của WF02 —
  // credential httpHeaderAuth trên build n8n này trả 401 không rõ nguyên nhân)
  for (const node of repo.nodes) {
    if (node.credentials?.httpHeaderAuth) {
      delete node.credentials
      // Tắt generic auth (nếu không, node báo "Credentials not found") + dùng inline header
      node.parameters.authentication = 'none'
      node.parameters.sendHeaders = true
      node.parameters.headerParameters = { parameters: [{ name: 'x-api-key', value: API_KEY }] }
    }
  }
  const clean = {
    name: repo.name,
    nodes: repo.nodes,
    connections: repo.connections,
    settings: repo.settings ?? { executionOrder: 'v1' },
    meta: { templateCredsSetupCompleted: false },
    active: false,
  }
  const created = await (await fetch(`${BASE}/rest/workflows`, { method: 'POST', headers: h, body: JSON.stringify(clean) })).json()
  const wfId = created.data?.id
  const versionId = created.data?.versionId
  if (!wfId) { console.error(`[deploy-wf03] Create thất bại: ${JSON.stringify(created).slice(0, 300)}`); process.exitCode = 1; return }
  const act = await (await fetch(`${BASE}/rest/workflows/${wfId}/activate`, { method: 'POST', headers: h, body: JSON.stringify({ versionId }) })).json()
  console.log(`[deploy-wf03] Activate: ${act.data?.active ? '🟢' : `❌ ${act.message}`}`)

  // Verify cấu trúc mới trên live
  const wf = (await (await fetch(`${BASE}/rest/workflows/${wfId}`, { headers: h })).json()).data
  const names = wf.nodes.map((n) => n.name)
  const need = ['Get/Create Session', 'Save User Message', 'Save Quiz Assistant Message', 'Save Grade Assistant Message', 'Gemini Flash']
  const okNodes = need.every((n) => names.includes(n))
  const connLS = wf.connections['Load Scenario']?.main?.[0]?.[0]?.node
  const connSUM = wf.connections['Save User Message']?.main?.[0]?.[0]?.node
  const okConn = connLS === 'Get/Create Session' && connSUM === 'Action Switch'
  const gem = wf.nodes.find((n) => n.name === 'Gemini Flash')
  console.log(`[deploy-wf03] Verify: nodes=${okNodes ? '✅' : '❌'} LoadScenario→Session=${connLS} SaveUserMsg→${connSUM} ${okConn ? '✅' : '❌'} gemini=${gem.parameters.modelName}/${gem.parameters.options?.maxOutputTokens}/retry=${gem.retryOnFail}`)
  console.log(`[deploy-wf03] WF03_ID=${wfId}${wfId !== metas[0]?.id ? ' (ĐỔI — chạy fix-router)' : ''}`)
}

main().catch((e) => { console.error('[deploy-wf03] Lỗi:', e); process.exitCode = 1 })
