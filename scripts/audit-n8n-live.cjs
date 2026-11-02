/**
 * Audit 4 workflow đang chạy trên n8n live (không phải file JSON):
 *  1. WF01 /webhook/chat với 4 intent (HR/TRAINING/CSKH/OTHER)
 *  2. So workflow ID mà WF01 Execute-Workflow trỏ tới có tồn tại trên instance không
 *  3. So x-api-key trong WF02/03 (bản live) có khớp N8N_API_KEY của NestJS không
 * Chạy: node scripts/audit-n8n-live.cjs
 */
const http = require('http');
const fs = require('fs');

const req = (host, port, path, method, body, headers = {}) =>
  new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      { host, port, path, method, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      },
    );
    r.on('error', (e) => resolve({ status: 0, body: 'ERR ' + e.code }));
    if (data) r.write(data);
    r.end();
  });

(async () => {
  // Đọc N8N_API_KEY từ apps/api/.env
  const env = fs.readFileSync('apps/api/.env', 'utf8');
  const apiKey = (env.match(/N8N_API_KEY=(\S+)/) || [])[1];
  console.log('NestJS N8N_API_KEY prefix:', apiKey ? apiKey.slice(0, 20) + '...' : 'NOT FOUND');

  // 1) Liệt kê workflow trên instance n8n live
  const list = await req('127.0.0.1', 5678, '/api/v1/workflows?limit=50', 'GET', null, { 'X-N8N-API-KEY': apiKey });
  console.log('\n== n8n API list workflows:', list.status);
  if (list.status === 200) {
    const wf = JSON.parse(list.body).data || [];
    for (const w of wf) console.log(`  [${w.active ? 'ACTIVE' : 'off'}] ${w.id}  ${w.name}`);
  } else {
    console.log('  body:', list.body.slice(0, 200));
  }

  // 2) Gửi tin HR intent qua WF01 — tái hiện lỗi của user
  const tests = [
    ['HR', 'tôi còn mấy ngày nghỉ phép năm nay?'],
    ['OTHER', 'ping'],
  ];
  for (const [label, msg] of tests) {
    const t0 = Date.now();
    const r = await req('127.0.0.1', 5678, '/webhook/chat', 'POST', { message: msg, channel: 'web', sessionId: 'audit-' + label.toLowerCase() + '-' + Date.now() }, { 'x-api-key': process.env.N8N_API_KEY ?? '' });
    console.log(`\n== WF01 [${label}] "${msg}" → ${r.status} (${Date.now() - t0}ms)`);
    console.log('  ', r.body.slice(0, 300).replace(/\n/g, ' '));
  }
})();