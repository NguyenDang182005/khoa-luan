/**
 * import-workflows.mjs
 * Import 4 workflows vào n8n qua /rest API (session cookie) + activate
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const BASE = 'http://localhost:5678';
const EMAIL = 'haidangnguyen1214@gmail.com';
const PASS  = 'Lolnamdotavn182005@';
const GEMINI_ID = 'saU5RHwXIHvauhiS';
const PG_ID     = 'DImvfbYdTqnryV2B';

// Thứ tự import: sub-workflows trước, router sau
const FILES = [
  'n8n-workflows/02-hr-qa-agent.json',
  'n8n-workflows/03-training-agent.json',
  'n8n-workflows/04-zalo-cskh.json',
  'n8n-workflows/01-router-agent.json',
];

async function main() {
  console.log('🔐 Đăng nhập n8n...');
  // Login để lấy session cookie
  const loginRes = await fetch(`${BASE}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS, mfaCode: '' }),
    redirect: 'manual',
  });

  // Lấy cookie
  const cookies = loginRes.headers.get('set-cookie') || '';
  const sessionCookie = cookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
  console.log('✅ Đăng nhập thành công');

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': sessionCookie,
  };

  function patchNodes(nodes) {
    return nodes.map(n => {
      if (n.type === '@n8n/n8n-nodes-langchain.lmChatGoogleGemini')
        n.credentials = { googlePalmApi: { id: GEMINI_ID, name: 'Google Gemini(PaLM) Api account' } };
      if (n.type === '@n8n/n8n-nodes-langchain.memoryPostgresChat')
        n.credentials = { postgres: { id: PG_ID, name: 'HR System PostgreSQL' } };
      // Fix executeWorkflowTrigger v1.1 → v1 (tránh lỗi workflowInputs)
      if (n.type === 'n8n-nodes-base.executeWorkflowTrigger') {
        n.typeVersion = 1;
        n.parameters = {};
      }
      return n;
    });
  }

  console.log('\n📦 Import workflows:\n');

  for (const file of FILES) {
    const wfJson = JSON.parse(readFileSync(join(ROOT, file), 'utf-8'));
    wfJson.nodes = patchNodes(wfJson.nodes);
    wfJson.active = false; // tạo inactive trước

    // Tạo workflow mới
    const createRes = await fetch(`${BASE}/rest/workflows`, {
      method: 'POST',
      headers,
      body: JSON.stringify(wfJson),
    });
    const created = await createRes.json();

    if (!created.data?.id) {
      console.error(`❌ ${wfJson.name}: ${JSON.stringify(created).slice(0,200)}`);
      continue;
    }

    const wfId = created.data.id;
    const versionId = created.data.versionId;

    // Activate
    const actRes = await fetch(`${BASE}/rest/workflows/${wfId}/activate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ versionId }),
    });
    const actJson = await actRes.json();

    if (actJson.data?.active) {
      console.log(`✅ ${wfJson.name} (id: ${wfId}) → Active 🟢`);
    } else {
      console.log(`⚠️  ${wfJson.name} (id: ${wfId}) → created nhưng activate lỗi: ${actJson.message}`);
    }
  }

  console.log('\n🎉 Import xong! Mở http://localhost:5678 để kiểm tra.\n');
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
