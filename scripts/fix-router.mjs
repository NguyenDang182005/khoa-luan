import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = 'http://localhost:5678';
const EMAIL = 'haidangnguyen1214@gmail.com';
const PASS = 'Lolnamdotavn182005@';
const GEMINI_ID = 'saU5RHwXIHvauhiS';
const PG_ID = 'DImvfbYdTqnryV2B';

const loginRes = await fetch(`${BASE}/rest/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS, mfaCode: '' }),
  redirect: 'manual',
});
const cookies = loginRes.headers.get('set-cookie') || '';
const sessionCookie = cookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
const h = { 'Content-Type': 'application/json', 'Cookie': sessionCookie };

function patchNodes(nodes) {
  return nodes.map(n => {
    if (n.type === '@n8n/n8n-nodes-langchain.lmChatGoogleGemini')
      n.credentials = { googlePalmApi: { id: GEMINI_ID, name: 'Google Gemini(PaLM) Api account' } };
    if (n.type === '@n8n/n8n-nodes-langchain.memoryPostgresChat')
      n.credentials = { postgres: { id: PG_ID, name: 'HR System PostgreSQL' } };
    if (n.type === 'n8n-nodes-base.executeWorkflowTrigger') {
      n.typeVersion = 1;
      n.parameters = {};
    }
    return n;
  });
}

// Step 1: Get all active sub-workflow IDs
const listRes = await fetch(`${BASE}/rest/workflows?limit=50`, { headers: h });
const listJson = await listRes.json();
const wfs = listJson.data || [];
const activeMap = {};
for (const w of wfs) {
  if (w.active) activeMap[w.name] = w.id;
}
console.log('Active workflows:', activeMap);

const wf02Id = activeMap['02 - HR Q&A Agent'];
const wf03Id = activeMap['03 - Training Role-play Agent'];
const wf04Id = activeMap['04 - Zalo OA CSKH Agent'];

if (!wf02Id || !wf03Id || !wf04Id) {
  console.error('Missing active sub-workflows:', { wf02Id, wf03Id, wf04Id });
  process.exit(1);
}

// Step 2: Load WF01 and patch workflow IDs
const wf01Json = JSON.parse(readFileSync(join(ROOT, 'n8n-workflows/01-router-agent.json'), 'utf-8'));
wf01Json.nodes = patchNodes(wf01Json.nodes);
// Patch Execute Workflow node IDs
for (const node of wf01Json.nodes) {
  if (node.id === 'exec-hr-qa') node.parameters.workflowId.value = wf02Id;
  if (node.id === 'exec-training') node.parameters.workflowId.value = wf03Id;
  if (node.id === 'exec-cskh') node.parameters.workflowId.value = wf04Id;
}
wf01Json.active = false;

// Step 3: Delete old WF01 versions, create + activate new one
const wf01List = wfs.filter(w => w.name === '01 - Router Agent');
for (const old of wf01List) {
  if (old.active) await fetch(`${BASE}/rest/workflows/${old.id}/deactivate`, { method: 'POST', headers: h });
  await fetch(`${BASE}/rest/workflows/${old.id}/archive`, { method: 'POST', headers: h });
  await fetch(`${BASE}/rest/workflows/${old.id}`, { method: 'DELETE', headers: h });
  console.log('Deleted WF01:', old.id);
}

// Create fresh
const createRes = await fetch(`${BASE}/rest/workflows`, {
  method: 'POST', headers: h, body: JSON.stringify(wf01Json),
});
const created = await createRes.json();
const newId = created.data?.id;
const versionId = created.data?.versionId;
if (!newId) { console.error('Create failed:', JSON.stringify(created).slice(0, 300)); process.exit(1); }

const actRes = await fetch(`${BASE}/rest/workflows/${newId}/activate`, {
  method: 'POST', headers: h, body: JSON.stringify({ versionId }),
});
const actJson = await actRes.json();
console.log(actJson.data?.active ? `✅ Router activated: ${newId}` : `❌ Activate failed: ${actJson.message}`);
