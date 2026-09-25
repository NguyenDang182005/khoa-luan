/**
 * test-all-endpoints.mjs — Kiểm tra TOÀN BỘ endpoint hệ thống HR Multi-Agent
 * Chạy: node scripts/test-all-endpoints.mjs
 *
 * Phủ: Auth · Agents (chat+session) · Settings · Payroll · Leave · Onboarding · n8n WF01-04
 */

const BASE     = process.env.API_URL  ?? 'http://localhost:3001/api/v1';
const N8N_BASE = process.env.N8N_URL  ?? 'http://localhost:5678';
const ADMIN    = { email: 'admin@hr-system.com',     password: 'Admin@123' };
const EMP      = { email: 'employee1@company.com',   password: 'Employee@123' };
const TIMEOUT  = parseInt(process.env.TIMEOUT_MS ?? '30000');

// ── ANSI colors ──
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', gray: '\x1b[90m', blue: '\x1b[34m',
};

let passed = 0, failed = 0, skipped = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ${C.green}✓${C.reset} ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  ${C.red}✗${C.reset} ${name}${detail ? C.gray + ' — ' + detail.slice(0, 120) + C.reset : ''}`);
  }
}

function skip(name, reason) {
  skipped++;
  console.log(`  ${C.yellow}⊘${C.reset} ${C.gray}SKIP${C.reset} ${name} (${reason})`);
}

function section(title) {
  console.log(`\n${C.bold}${C.blue}── ${title} ──${C.reset}`);
}

async function api(method, path, { token, body, timeoutMs = TIMEOUT } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    let json = null;
    try { json = await res.json(); } catch { /* empty body */ }
    return { status: res.status, json };
  } catch (e) {
    clearTimeout(timer);
    return { status: 0, json: null, error: e.message };
  }
}

async function n8n(path, body, { timeoutMs = TIMEOUT } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${N8N_BASE}/webhook/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* raw */ }
    return { status: res.status, json, raw: text };
  } catch (e) {
    clearTimeout(timer);
    return { status: 0, json: null, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════
async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗
║  HR Multi-Agent — Full Endpoint Test Suite       ║
║  API: ${BASE.padEnd(41)}║
╚══════════════════════════════════════════════════╝${C.reset}`);

  // ═══ 1. AUTH ═══
  section('1. Auth — Đăng nhập & Phân quyền');

  const adminRes = await api('POST', '/auth/login', { body: ADMIN });
  check('Admin login → 200', adminRes.status === 200, JSON.stringify(adminRes.json));
  const AT = adminRes.json?.accessToken;

  const empRes = await api('POST', '/auth/login', { body: EMP });
  check('Employee login → 200', empRes.status === 200, JSON.stringify(empRes.json));
  const ET = empRes.json?.accessToken;

  if (!AT) { console.log(`${C.red}  ⛔ Không lấy được admin token — dừng test.${C.reset}`); process.exit(1); }

  const profile = await api('GET', '/auth/profile', { token: AT });
  check('GET /auth/profile (admin) → 200', profile.status === 200);
  check('Profile có role ADMIN', profile.json?.role === 'ADMIN', profile.json?.role);

  const noAuth = await api('GET', '/auth/profile');
  check('GET /auth/profile (no token) → 401', noAuth.status === 401);

  // ═══ 2. EMPLOYEES ═══
  section('2. Employees');

  const emps = await api('GET', '/employees', { token: AT });
  check('GET /employees → 200', emps.status === 200);
  check('Employees có data[]', Array.isArray(emps.json?.data) && emps.json.data.length > 0, `count=${emps.json?.data?.length}`);

  const emp0 = emps.json?.data?.[0];
  const empId = emp0?.id;

  if (empId) {
    const empDetail = await api('GET', `/employees/${empId}`, { token: AT });
    check(`GET /employees/:id → 200`, empDetail.status === 200);
  } else {
    skip('GET /employees/:id', 'không có employee');
  }

  // Employee không được xem list người khác
  if (ET) {
    const empList = await api('GET', '/employees', { token: ET });
    check('EMPLOYEE GET /employees → 403', empList.status === 403, `status=${empList.status}`);
  }

  // ═══ 3. PAYROLL ═══
  section('3. Payroll');

  const payrolls = await api('GET', '/payroll', { token: AT });
  check('GET /payroll → 200', payrolls.status === 200);
  // /payroll trả thẳng array (không wrap {data:[]})
  check('Payroll là array có records', Array.isArray(payrolls.json) && payrolls.json.length > 0,
    `type=${typeof payrolls.json} len=${payrolls.json?.length ?? 'N/A'}`);

  const salCfg = await api('GET', '/salary-config/current', { token: AT });
  check('GET /salary-config/current → 200', salCfg.status === 200);
  check('SalaryConfig có bhxhRate', typeof salCfg.json?.bhxhRate === 'number', JSON.stringify(salCfg.json));

  // ═══ 4. LEAVE ═══
  section('4. Leave — Phép & Nghỉ');

  const leavePol = await api('GET', '/settings/leave-policy', { token: AT });
  check('GET /settings/leave-policy → 200', leavePol.status === 200);
  check('Leave policy có annualQuotaDays', typeof leavePol.json?.annualQuotaDays === 'number');

  if (empId) {
    const balance = await api('GET', `/leave/balance/${empId}?year=2026`, { token: AT });
    check(`GET /leave/balance/:id → 200`, balance.status === 200);
    check('Balance có quota field', balance.json?.quota !== undefined, JSON.stringify(balance.json));
  }

  // Route đúng là GET /leave (không phải /leave/requests) — trả array thẳng
  const leaveList = await api('GET', '/leave', { token: AT });
  check('GET /leave → 200', leaveList.status === 200, `status=${leaveList.status}`);
  check('Leave list là array', Array.isArray(leaveList.json), `type=${typeof leaveList.json}`);

  // ═══ 5. SETTINGS ═══
  section('5. Settings — Cài Đặt Hệ Thống');

  const secPol = await api('GET', '/settings/security-policy', { token: AT });
  check('GET /settings/security-policy → 200', secPol.status === 200);

  const geofence = await api('GET', '/settings/geofence', { token: AT });
  check('GET /settings/geofence → 200', geofence.status === 200);

  const integrations = await api('GET', '/settings/integrations', { token: AT });
  check('GET /settings/integrations → 200', integrations.status === 200);

  const sessions = await api('GET', '/settings/sessions', { token: AT });
  check('GET /settings/sessions → 200', sessions.status === 200);
  check('Sessions KHÔNG lộ token field', Array.isArray(sessions.json) && !('token' in (sessions.json[0] ?? {})));

  const loginHist = await api('GET', '/settings/login-history', { token: AT });
  check('GET /settings/login-history → 200', loginHist.status === 200);
  check('Login history ≥ 2 sự kiện', Array.isArray(loginHist.json) && loginHist.json.length >= 2, `count=${loginHist.json?.length}`);

  const auditLog = await api('GET', '/settings/audit-log?limit=50', { token: AT });
  check('GET /settings/audit-log → 200', auditLog.status === 200);
  check('Audit log có items[]', Array.isArray(auditLog.json?.items));

  // AI config — không lộ apiKey
  const aiCfg = await api('GET', '/settings/ai-config', { token: AT });
  check('GET /settings/ai-config → 200', aiCfg.status === 200);
  check('ai-config KHÔNG lộ apiKey (chỉ apiKeySet)', !('apiKey' in (aiCfg.json ?? {})) && 'apiKeySet' in (aiCfg.json ?? {}), JSON.stringify(aiCfg.json));

  // Test connection n8n
  const testConn = await api('POST', '/settings/ai/test-connection', { token: AT });
  check('POST /settings/ai/test-connection → healthz.ok', testConn.json?.healthz?.ok === true, JSON.stringify(testConn.json?.healthz));

  // Employee bị chặn settings
  if (ET) {
    for (const path of ['/settings/security-policy', '/settings/ai-config', '/settings/audit-log']) {
      const r = await api('GET', path, { token: ET });
      check(`EMPLOYEE GET ${path} → 403`, r.status === 403, `status=${r.status}`);
    }
  }

  // ═══ 6. AGENTS — Chat & Session ═══
  section('6. Agents — Chat Portal (JWT)');

  // Session latest
  const sessionHR = await api('GET', '/agents/chat-session/latest/HR_QA', { token: AT });
  check('GET /agents/chat-session/latest/HR_QA → 200|204', [200, 204].includes(sessionHR.status), `status=${sessionHR.status}`);

  const sessionTraining = await api('GET', '/agents/chat-session/latest/TRAINING', { token: AT });
  check('GET /agents/chat-session/latest/TRAINING → 200|204', [200, 204].includes(sessionTraining.status));

  // Performance & stats
  const perf = await api('GET', '/agents/performance', { token: AT });
  check('GET /agents/performance → 200', perf.status === 200);
  check('Performance có wf01/wf02/wf03/wf04', ['wf01','wf02','wf03','wf04'].every(k => k in (perf.json ?? {})));

  const intentStats = await api('GET', '/agents/intent-stats', { token: AT });
  check('GET /agents/intent-stats → 200', intentStats.status === 200);
  check('IntentStats có total & byIntent', typeof intentStats.json?.total === 'number' && intentStats.json?.byIntent);

  const piiAudit = await api('GET', '/agents/pii-audit', { token: AT });
  check('GET /agents/pii-audit → 200', piiAudit.status === 200);
  check('PII audit có items[]', Array.isArray(piiAudit.json?.items));

  // AI Agent TẮT → chat thân thiện
  await api('PATCH', '/settings/ai-config', { token: AT, body: { enabled: false } });
  const chatOff = await api('POST', '/agents/chat', { token: ET ?? AT, body: { message: 'ping' } });
  check('Agent TẮT → answer thân thiện (latencyMs=0)', chatOff.status === 200 && chatOff.json?.latencyMs === 0, JSON.stringify(chatOff.json));
  await api('PATCH', '/settings/ai-config', { token: AT, body: { enabled: true } }); // bật lại

  // Onboarding của tôi
  const myOnboarding = await api('GET', '/agents/onboarding/my', { token: ET ?? AT });
  check('GET /agents/onboarding/my → 200|404', [200, 404].includes(myOnboarding.status), `status=${myOnboarding.status}`);

  // ═══ 7. ONBOARDING TASKS ═══
  section('7. Onboarding Tasks');

  const tasks = await api('GET', '/onboarding/tasks', { token: AT });
  check('GET /onboarding/tasks → 200', tasks.status === 200);
  check('Tasks là array', Array.isArray(tasks.json));

  // ═══ 8. NOTIFICATIONS ═══
  section('8. Notifications');

  const notifs = await api('GET', '/notifications/my', { token: ET ?? AT });
  check('GET /notifications/my → 200', notifs.status === 200);

  // ═══ 9. TRAINING ═══
  section('9. Training Module');

  const trainingQ = await api('GET', '/training/questions', { token: AT });
  check('GET /training/questions → 200', trainingQ.status === 200);

  const trainingDashMe = await api('GET', '/training/dashboard/me', { token: ET ?? AT });
  check('GET /training/dashboard/me → 200', trainingDashMe.status === 200);

  const trainingDashOv = await api('GET', '/training/dashboard/overview', { token: AT });
  check('GET /training/dashboard/overview → 200', trainingDashOv.status === 200);

  // ═══ 10. DASHBOARD ═══
  section('10. Dashboard KPIs');

  const kpis = await api('GET', '/dashboard/kpis', { token: AT });
  check('GET /dashboard/kpis → 200', kpis.status === 200);

  const aiActivity = await api('GET', '/dashboard/ai-activity', { token: AT });
  check('GET /dashboard/ai-activity → 200', aiActivity.status === 200);

  const deptDist = await api('GET', '/dashboard/department-distribution', { token: AT });
  check('GET /dashboard/department-distribution → 200', deptDist.status === 200);

  // ═══ 11. n8n WORKFLOWS (Direct webhook) ═══
  section('11. n8n Workflows — Direct Webhook');
  console.log(`  ${C.gray}(timeout ${TIMEOUT/1000}s mỗi request — có thể chậm do Gemini free-tier)${C.reset}`);

  // WF01 OTHER — nhanh nhất (không gọi LLM)
  const wf01Other = await n8n('chat', {
    message: 'xin chao', maskedMessage: 'xin chao',
    channel: 'web', employeeId: null,
  }, { timeoutMs: 10000 });
  check('WF01 OTHER → answer string', typeof wf01Other.json?.answer === 'string' && wf01Other.json.answer.length > 0,
    wf01Other.error ?? wf01Other.raw?.slice(0, 100));

  await new Promise((r) => setTimeout(r, 2000));

  // WF02 HR Q&A
  const wf02 = await n8n('chat', {
    message: 'chinh sach nghi phep nam', maskedMessage: 'chinh sach nghi phep nam',
    channel: 'web', employeeId: null,
  }, { timeoutMs: TIMEOUT });
  check('WF02 HR_QA → intent=HR_QA + answer', wf02.json?.intent === 'HR_QA' && typeof wf02.json?.answer === 'string',
    wf02.error ?? `intent=${wf02.json?.intent} answer=${!!wf02.json?.answer}`);

  await new Promise((r) => setTimeout(r, 2000));

  // WF03 Training role-play
  const wf03Roleplay = await n8n('chat', {
    message: 'dao tao role-play ky nang giao tiep', maskedMessage: 'dao tao role-play ky nang giao tiep',
    channel: 'web', employeeId: null, scenarioType: 'general_communication',
  }, { timeoutMs: TIMEOUT });
  check('WF03 TRAINING role-play → answer', typeof wf03Roleplay.json?.answer === 'string' && wf03Roleplay.json.answer.length > 0,
    wf03Roleplay.error ?? `intent=${wf03Roleplay.json?.intent}`);

  await new Promise((r) => setTimeout(r, 2000));

  // WF03 Generate quiz
  const wf03Quiz = await n8n('chat', {
    message: 'lam bai test trac nghiem', maskedMessage: 'lam bai test trac nghiem',
    channel: 'web', employeeId: null,
    scenarioType: 'customer_complaint', action: 'generate_quiz',
  }, { timeoutMs: TIMEOUT });
  check('WF03 TRAINING generate_quiz → có questions[]', Array.isArray(wf03Quiz.json?.questions) && wf03Quiz.json.questions.length > 0,
    wf03Quiz.error ?? `questions=${wf03Quiz.json?.questions?.length}`);

  // ═══ SUMMARY ═══
  const total = passed + failed + skipped;
  const pct = total > 0 ? Math.round((passed / (passed + failed)) * 100) : 0;
  const color = failed === 0 ? C.green : failed <= 3 ? C.yellow : C.red;

  console.log(`\n${C.bold}${color}╔══════════════════════════════════════════╗`);
  console.log(`║  KẾT QUẢ: ${passed} pass  ${failed} fail  ${skipped} skip  (${pct}%)  ║`);
  console.log(`╚══════════════════════════════════════════╝${C.reset}`);

  if (failures.length > 0) {
    console.log(`\n${C.bold}${C.red}Các test FAIL:${C.reset}`);
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name}${f.detail ? C.gray + ' — ' + f.detail + C.reset : ''}`);
    });
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`${C.red}Script lỗi:${C.reset}`, e.message);
  process.exit(1);
});
