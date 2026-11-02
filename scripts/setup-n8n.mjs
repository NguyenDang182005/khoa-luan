#!/usr/bin/env node
/**
 * n8n Setup Script — Tự động import + cấu hình credentials + publish 4 workflows
 *
 * Chạy: node scripts/setup-n8n.mjs
 *
 * Yêu cầu:
 *   - n8n đang chạy tại http://localhost:5678
 *   - GEMINI_API_KEY đã có
 *   - PostgreSQL đang chạy (docker-compose up -d postgres)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// =====================
// CẤU HÌNH
// =====================
const N8N_BASE = 'http://127.0.0.1:5678';
// Secrets chỉ đọc từ env — không hardcode. Thiếu key → dừng ngay.
const N8N_API_KEY = process.env.HR_API_KEY;
if (!N8N_API_KEY) {
  console.error('❌ Thiếu HR_API_KEY (x-api-key của n8n ↔ NestJS). Set trước khi chạy.');
  process.exit(1);
}

// Đọc từ docker-compose env (hoặc set tay ở đây)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('❌ Thiếu GEMINI_API_KEY. Set trước khi chạy.');
  process.exit(1);
}
const PG_HOST = 'host.docker.internal'; // n8n trong docker gọi ra ngoài
const PG_PORT = 5432;
const PG_DATABASE = 'hr_system_db';
const PG_USER = 'postgres';
const PG_PASSWORD = 'postgres123';

const WORKFLOW_DIR = join(__dirname, '..', 'n8n-workflows');
const WORKFLOWS = [
  '02-hr-qa-agent.json',
  '03-training-agent.json',
  '04-zalo-cskh.json',
  '01-router-agent.json', // Router cuối cùng vì cần WF02/03/04 đã active
];

// =====================
// HELPERS
// =====================
async function n8nFetch(path, options = {}) {
  const res = await fetch(`${N8N_BASE}${path}`, {
    ...options,
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n API ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

function log(icon, msg) {
  console.log(`${icon}  ${msg}`);
}

// =====================
// STEP 1: Tạo Gemini Credential
// =====================
async function createGeminiCredential() {
  log('🔑', 'Tạo Gemini API credential...');

  // Kiểm tra đã có chưa
  const existing = await n8nFetch('/api/v1/credentials');
  const found = existing.data?.find(c => c.name === 'Gemini API Key' || c.name === 'Gemini 2025' || c.type === 'googlePalmApi');
  if (found) {
    log('✅', `Gemini credential đã tồn tại (id: ${found.id}, name: "${found.name}")`);
    return { id: found.id, name: found.name };
  }

  const cred = await n8nFetch('/api/v1/credentials', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Gemini API Key',
      type: 'googlePalmApi',
      data: {
        apiKey: GEMINI_API_KEY,
        host: 'generativelanguage.googleapis.com',
      },
    }),
  });

  log('✅', `Gemini credential tạo thành công (id: ${cred.id})`);
  return { id: cred.id, name: cred.name };
}

// =====================
// STEP 2: Tạo PostgreSQL Credential
// =====================
async function createPostgresCredential() {
  log('🐘', 'Tạo PostgreSQL credential...');

  const existing = await n8nFetch('/api/v1/credentials');
  const found = existing.data?.find(c => c.name === 'HR System PostgreSQL' || c.type === 'postgres');
  if (found) {
    log('✅', `PostgreSQL credential đã tồn tại (id: ${found.id}, name: "${found.name}")`);
    return { id: found.id, name: found.name };
  }

  const cred = await n8nFetch('/api/v1/credentials', {
    method: 'POST',
    body: JSON.stringify({
      name: 'HR System PostgreSQL',
      type: 'postgres',
      data: {
        host: PG_HOST,
        port: PG_PORT,
        database: PG_DATABASE,
        user: PG_USER,
        password: PG_PASSWORD,
        ssl: false,
      },
    }),
  });

  log('✅', `PostgreSQL credential tạo thành công (id: ${cred.id})`);
  return { id: cred.id, name: cred.name };
}

// =====================
// STEP 3: Tạo HTTP Header Auth cho NestJS
// =====================
async function createNestJSCredential() {
  log('🔐', 'Tạo NestJS API Key credential...');

  const HR_API_KEY = process.env.HR_API_KEY;

  const existing = await n8nFetch('/api/v1/credentials');
  const found = existing.data?.find(c => c.name === 'HR API Key Header');
  if (found) {
    log('✅', `NestJS credential đã tồn tại (id: ${found.id})`);
    return found.id;
  }

  const cred = await n8nFetch('/api/v1/credentials', {
    method: 'POST',
    body: JSON.stringify({
      name: 'HR API Key Header',
      type: 'httpHeaderAuth',
      data: {
        name: 'x-api-key',
        value: HR_API_KEY,
      },
    }),
  });

  log('✅', `NestJS credential tạo thành công (id: ${cred.id})`);
  return cred.id;
}

// =====================
// STEP 4: Import + Publish từng workflow
// =====================
async function importAndPublishWorkflow(filename, geminiCred, pgCred, nestCredId) {
  const filePath = join(WORKFLOW_DIR, filename);
  const workflowJson = JSON.parse(readFileSync(filePath, 'utf-8'));

  // Patch credentials vào nodes
  workflowJson.nodes = workflowJson.nodes.map(node => {
    if (node.type === '@n8n/n8n-nodes-langchain.lmChatGoogleGemini') {
      node.credentials = { googlePalmApi: { id: geminiCred.id, name: geminiCred.name } };
    }
    if (node.type === '@n8n/n8n-nodes-langchain.memoryPostgresChat') {
      node.credentials = { postgres: { id: pgCred.id, name: pgCred.name } };
    }
    // Gán HR API Key Header cho httpRequest / toolHttpRequest gọi vào NestJS
    if ((node.type === 'n8n-nodes-base.httpRequest' || node.type === '@n8n/n8n-nodes-langchain.toolHttpRequest') && node.parameters?.url && String(node.parameters.url).includes('host.docker.internal:3001')) {
      node.parameters.authentication = 'genericCredentialType';
      node.parameters.genericAuthType = 'httpHeaderAuth';
      node.credentials = {
        httpHeaderAuth: { id: nestCredId, name: 'HR API Key Header' },
      };
      if (node.parameters.headerParameters?.parameters) {
        node.parameters.headerParameters.parameters = node.parameters.headerParameters.parameters.filter(
          p => p.name !== 'x-api-key'
        );
      }
    }
    // Webhook bật headerAuth (WF01/02/03/04) dùng chung khóa x-api-key với NestJS
    if (node.type === 'n8n-nodes-base.webhook' && node.parameters?.authentication === 'headerAuth') {
      node.credentials = { httpHeaderAuth: { id: nestCredId, name: 'HR API Key Header' } };
    }
    return node;
  });

  log('📥', `Importing ${workflowJson.name}...`);

  // Kiểm tra workflow đã tồn tại chưa
  const allWorkflows = await n8nFetch('/api/v1/workflows?limit=100');
  const existing = allWorkflows.data?.find(w => w.name === workflowJson.name);

  const payload = {
    name: workflowJson.name,
    nodes: workflowJson.nodes,
    connections: workflowJson.connections,
    settings: workflowJson.settings || { executionOrder: 'v1' },
  };

  let workflowId;
  if (existing) {
    // Update existing
    await n8nFetch(`/api/v1/workflows/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    workflowId = existing.id;
    log('🔄', `Cập nhật workflow "${workflowJson.name}" (id: ${workflowId})`);
  } else {
    // Create new
    const created = await n8nFetch('/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    workflowId = created.id;
    log('✨', `Tạo workflow "${workflowJson.name}" (id: ${workflowId})`);
  }

  // Activate (publish)
  await n8nFetch(`/api/v1/workflows/${workflowId}/activate`, {
    method: 'POST',
  });
  log('🚀', `Published "${workflowJson.name}" ✅`);

  return workflowId;
}

// =====================
// MAIN
// =====================
async function main() {
  console.log('\n🤖 n8n Setup Script — HR Multi-Agent System');
  console.log('='.repeat(50));

  // Kiểm tra n8n đang chạy
  try {
    await fetch(`${N8N_BASE}/healthz`);
    log('✅', 'n8n đang chạy tại ' + N8N_BASE);
  } catch {
    console.error('❌ Không kết nối được n8n tại ' + N8N_BASE);
    console.error('   Chạy: docker-compose up -d n8n');
    process.exit(1);
  }

  // Tạo credentials
  const geminiCred = await createGeminiCredential();
  const pgCred = await createPostgresCredential();
  const nestCredId = await createNestJSCredential();

  console.log('\n' + '─'.repeat(50));
  console.log('📦 Import & Publish Workflows (thứ tự: 02→03→04→01)');
  console.log('─'.repeat(50));

  // Import theo thứ tự đúng (sub-workflows trước, router sau)
  for (const filename of WORKFLOWS) {
    await importAndPublishWorkflow(filename, geminiCred, pgCred, nestCredId);
    // Chờ 1s giữa mỗi workflow để n8n xử lý
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 Setup hoàn tất!\n');
  console.log('📋 Kiểm tra tại: http://localhost:5678');
  console.log('🧪 Test WF02 HR Agent:');
  console.log(`   curl -X POST http://localhost:5678/webhook/chat \\`);
  console.log(`     -H "Content-Type: application/json" -H "x-api-key: $HR_API_KEY" \\`);
  console.log(`     -d '{"message":"Lương tháng 8 của tôi là bao nhiêu?","channel":"web","employeeId":"EMP003"}'`);
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Lỗi:', err.message);
  process.exit(1);
});
