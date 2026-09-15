/**
 * import-slack-update.mjs
 * Đồng bộ workflow 03/04/05 lên n8n (bản Slack transport cho CSKH):
 * - Tạo/tìm credential "NestJS API Key" (Header Auth) — thay cho $env bị chặn trong n8n
 * - 03 Training Agent, 04 Zalo CSKH: PATCH tại chỗ + activate lại
 * - 05 Slack Gateway: archive+delete rồi tạo mới (responseNode phải serve graph mới nhất)
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = 'http://127.0.0.1:5678';
const EMAIL = 'haidangnguyen1214@gmail.com';
const PASS = 'Lolnamdotavn182005@';
const GEMINI_ID = 'saU5RHwXIHvauhiS';
const PG_ID = 'DImvfbYdTqnryV2B';
const HEADER_AUTH_NAME = 'NestJS API Key';

/** Đọc biến từ root .env (KEY=VALUE từng dòng) */
function readRootEnv(key) {
  const lines = readFileSync(join(ROOT, '.env'), 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(new RegExp(`^${key}=(.*)$`));
    if (m) return m[1].trim();
  }
  return '';
}

/** Tạo hoặc tìm credential Header Auth chứa x-api-key */
async function ensureHeaderAuth(headers) {
  const apiKey = readRootEnv('HR_API_KEY');
  if (!apiKey) throw new Error('Thiếu HR_API_KEY trong root .env');
  const listRes = await fetch(`${BASE}/rest/credentials`, { headers });
  const listJson = await listRes.json().catch(() => ({}));
  const existing = (listJson.data ?? []).find((c) => c.name === HEADER_AUTH_NAME);
  if (existing) {
    console.log(`🔑 Credential "${HEADER_AUTH_NAME}" đã có (id: ${existing.id})`);
    return existing.id;
  }
  const createRes = await fetch(`${BASE}/rest/credentials`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: HEADER_AUTH_NAME, type: 'httpHeaderAuth', data: { name: 'x-api-key', value: apiKey } }),
  });
  const created = await createRes.json().catch(() => ({}));
  const createdId = created?.data?.id ?? created?.id;
  if (!createdId) throw new Error(`Tạo credential failed: ${JSON.stringify(created).slice(0, 200)}`);
  console.log(`🔑 Đã tạo credential "${HEADER_AUTH_NAME}" (id: ${createdId})`);
  return createdId;
}

/** Deactivate (nếu có thể) rồi activate lại — ép n8n đăng ký lại webhook production */
async function refreshActivation(headers, wfId, versionId, label) {
  const deact = await fetch(`${BASE}/rest/workflows/${wfId}/deactivate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ versionId }),
  }).catch(() => null);
  console.log(`   deactivate: HTTP ${deact ? deact.status : 'network-error'}`);
  const act = await fetch(`${BASE}/rest/workflows/${wfId}/activate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ versionId }),
  });
  const actJson = await act.json().catch(() => ({}));
  console.log(`   ${label} active: ${actJson.data?.active ?? '✓'}`);
}

async function main() {
  console.log('🔐 Đăng nhập n8n...');
  const loginRes = await fetch(`${BASE}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS, mfaCode: '' }),
    redirect: 'manual',
  });
  if (!loginRes.ok && loginRes.status !== 302) {
    throw new Error(`Login failed HTTP ${loginRes.status}`);
  }
  const cookies = loginRes.headers.get('set-cookie') || '';
  const sessionCookie = cookies.split(',').map((c) => c.split(';')[0].trim()).join('; ');
  const headers = { 'Content-Type': 'application/json', Cookie: sessionCookie };
  console.log('✅ Đăng nhập thành công\n');

  const headerAuthId = await ensureHeaderAuth(headers);

  // Danh sách workflow hiện có (fetch một lần đầu main)
  const listRes = await fetch(`${BASE}/rest/workflows?limit=50`, { headers });
  const list = (await listRes.json()).data ?? [];

  function patchNodes(nodes) {
    return JSON.parse(
      JSON.stringify(nodes)
        .replaceAll('__N8N_HEADER_AUTH_ID__', headerAuthId),
    ).map((n) => {
      if (n.type === '@n8n/n8n-nodes-langchain.lmChatGoogleGemini')
        n.credentials = { ...(n.credentials ?? {}), googlePalmApi: { id: GEMINI_ID, name: 'Google Gemini(PaLM) Api account' } };
      if (n.type === '@n8n/n8n-nodes-langchain.memoryPostgresChat')
        n.credentials = { ...(n.credentials ?? {}), postgres: { id: PG_ID, name: 'HR System PostgreSQL' } };
      if (n.type === 'n8n-nodes-base.executeWorkflowTrigger') {
        n.typeVersion = 1;
        n.parameters = {};
      }
      return n;
    });
  }

  /** Archive+delete rồi create mới (an toàn cho workflow có respondToWebhook) */
  async function recreateWorkflow(fileName, findPrefix, label) {
    for (const w of list.filter((w) => w.name.startsWith(findPrefix))) {
      if (w.active) await fetch(`${BASE}/rest/workflows/${w.id}/deactivate`, { method: 'POST', headers, body: '{}' });
      await fetch(`${BASE}/rest/workflows/${w.id}/archive`, { method: 'POST', headers, body: '{}' });
      const del = await fetch(`${BASE}/rest/workflows/${w.id}`, { method: 'DELETE', headers });
      console.log(`   Đã xóa bản cũ ${w.id} (HTTP ${del.status})`);
    }
    const wfJson = JSON.parse(readFileSync(join(ROOT, fileName), 'utf-8'));
    wfJson.active = false;
    wfJson.nodes = patchNodes(wfJson.nodes);
    const created = await (await fetch(`${BASE}/rest/workflows`, { method: 'POST', headers, body: JSON.stringify(wfJson) })).json();
    if (!created.data?.id) throw new Error(`Tạo ${label} failed: ${JSON.stringify(created).slice(0, 300)}`);
    await refreshActivation(headers, created.data.id, created.data.versionId, label);
    return created.data;
  }

  // ── 1. Recreate workflow 04 (PATCH tại chỗ bị n8n serve graph cũ) ──
  console.log('🔁 Recreate workflow 04...');
  const created04 = await recreateWorkflow('n8n-workflows/04-zalo-cskh.json', '04 - Zalo OA CSKH', '04');
  const nodeNames = (created04.nodes ?? []).map((n) => n.name);
  console.log(`   Nodes: ${nodeNames.join(' | ')}`);
  if (!nodeNames.includes('Send Reply Outbound')) throw new Error('Workflow 04 sau recreate thiếu node Send Reply Outbound!');

  // ── 2. Đồng bộ workflow 02 (HR Q&A + RAG tool) — PATCH tại chỗ, GIỮ ID ──
  const wf02 = list.find((w) => w.name.startsWith('02 - HR QA') || w.name.startsWith('02 -'));
  if (wf02) {
    console.log(`\n🔁 Cập nhật workflow 02 "${wf02.name}" tại chỗ (giữ id để WF01 gọi đúng)...`);
    const wf02Json = JSON.parse(readFileSync(join(ROOT, 'n8n-workflows/02-hr-qa-agent.json'), 'utf-8'));
    wf02Json.nodes = patchNodes(wf02Json.nodes);
    const put02 = await fetch(`${BASE}/rest/workflows/${wf02.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        name: wf02Json.name,
        nodes: wf02Json.nodes,
        connections: wf02Json.connections,
        settings: wf02Json.settings ?? { executionOrder: 'v1' },
        pinData: {},
      }),
    });
    const put02Json = await put02.json();
    if (!put02.ok) throw new Error(`PATCH 02 failed: ${JSON.stringify(put02Json).slice(0, 300)}`);
    if (wf02.active) await refreshActivation(headers, wf02.id, put02Json.data?.versionId, '02');
  }

  // ── 3. Đồng bộ workflow 03 (Training) — nếu có ──────────────────
  const wf03 = list.find((w) => w.name.startsWith('03 -'));
  if (wf03) {
    console.log(`\n🔁 Cập nhật workflow 03 "${wf03.name}" tại chỗ...`);
    const wf03Json = JSON.parse(readFileSync(join(ROOT, 'n8n-workflows/03-training-agent.json'), 'utf-8'));
    wf03Json.nodes = patchNodes(wf03Json.nodes);
    const put03 = await fetch(`${BASE}/rest/workflows/${wf03.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        name: wf03Json.name,
        nodes: wf03Json.nodes,
        connections: wf03Json.connections,
        settings: wf03Json.settings ?? { executionOrder: 'v1' },
        pinData: {},
      }),
    });
    const put03Json = await put03.json();
    if (!put03.ok) throw new Error(`PATCH 03 failed: ${JSON.stringify(put03Json).slice(0, 300)}`);
    if (wf03.active) await refreshActivation(headers, wf03.id, put03Json.data?.versionId, '03');
  }

  // ── 3. Đồng bộ workflow 05 (Gateway) — recreate sạch ────────────
  console.log('\n🌐 Recreate workflow 05 (Slack Gateway)...');
  await recreateWorkflow('n8n-workflows/05-slack-verify.json', '05 - Slack', '05');

  console.log('\n🎉 Import xong!');
}

main().catch((err) => {
  console.error('❌', err.message);
  if (err.cause) console.error('   cause:', err.cause.message ?? err.cause);
  process.exit(1);
});
