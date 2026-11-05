/**
 * test-diagram-flows.mjs — Chạy thật các luồng nghiệp vụ đã vẽ trong báo cáo (Hình 3.x, 4.x)
 * và quét toàn bộ route để kiểm tra phân quyền / lỗi 5xx.
 *
 * Chạy: N8N_API_KEY=... node scripts/test-diagram-flows.mjs
 * GHI DỮ LIỆU vào DB (tạo nhân viên test, đơn phép, phiếu lương...). Nên snapshot DB trước:
 *   docker exec hr_system_db pg_dump -U postgres -Fc hr_system_db -f /tmp/pretest.dump
 */
import { execFileSync } from 'node:child_process';

const BASE = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const N8N = process.env.N8N_URL ?? 'http://localhost:5678';
const KEY = process.env.N8N_API_KEY ?? '';
const ADMIN = { email: 'admin@hr-system.com', password: 'Admin@123' };
const EMP = { email: 'employee1@company.com', password: 'Employee@123' };

let pass = 0, fail = 0;
const fails = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; fails.push(`${name} — ${detail}`); console.log(`  ✗ ${name} — ${String(detail).slice(0, 200)}`); }
};
const info = (msg) => console.log(`    · ${msg}`);
const section = (t) => console.log(`\n── ${t} ──`);

async function api(method, path, { token, body, key, timeout = 120000 } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { 'x-api-key': key } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(timeout),
  }).catch((e) => ({ status: 0, json: async () => ({ error: String(e) }) }));
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const sql = (q) =>
  execFileSync('docker', ['exec', 'hr_system_db', 'psql', '-U', 'postgres', '-d', 'hr_system_db', '-Atc', q], { encoding: 'utf8' }).trim();
const login = async (c) => (await api('POST', '/auth/login', { body: c })).json?.accessToken;
const msg = (r) => JSON.stringify(r.json)?.slice(0, 160);

// ───────────────────────────────────────────────────────────────
const AT = await login(ADMIN);
const ET = await login(EMP);
if (!AT || !ET) { console.error('Không đăng nhập được admin/employee'); process.exit(1); }

// ── 0. Quét toàn bộ route GET (admin / employee / không token) ──
section('0. Quét route: GET không lỗi 5xx, route ghi thiếu token → 401');
{
  const empList = (await api('GET', '/employees?limit=1', { token: AT })).json;
  const someEmp = (empList?.data ?? empList)?.[0]?.id ?? 'x';
  const gets = [
    '/agents/performance', '/agents/chat-session/latest/HR_QA', '/agents/intent-stats', '/agents/conversations',
    '/agents/escalation-queue', '/agents/pii-audit', '/agents/onboarding/my', '/attendance?month=10&year=2026',
    `/attendance/employee/${someEmp}?month=10&year=2026`, `/attendance/report/${someEmp}?month=10&year=2026`,
    '/auth/profile', '/contracts', `/contracts/active/${someEmp}`, '/dashboard/kpis', '/dashboard/attendance-chart',
    '/dashboard/department-distribution', '/dashboard/pending-leaves', '/dashboard/ai-activity', '/departments',
    '/positions', '/employees', `/employees/${someEmp}`, '/leave', `/leave/balance/${someEmp}?year=2026`,
    '/notifications/my', '/onboarding/tasks', '/onboarding/progress', `/onboarding/progress/${someEmp}`,
    '/payroll?month=10&year=2026', '/payroll/me', `/payroll/employee/${someEmp}`,
    `/payroll/preview/${someEmp}?month=10&year=2026`, '/salary-config/current', '/salary-config',
    '/settings/geofence', '/settings/integrations', '/settings/leave-policy', '/settings/security-policy',
    '/settings/sessions', '/settings/login-history', '/settings/ai-config', '/settings/holidays?year=2026',
    '/settings/audit-log', '/training/questions', '/training/my-sessions', '/training/analytics',
    '/training/dashboard/me', '/training/dashboard/overview', '/users',
  ];
  const table = [];
  for (const p of gets) {
    const a = await api('GET', p, { token: AT });
    const e = await api('GET', p, { token: ET });
    const n = await api('GET', p);
    table.push(`${String(a.status).padEnd(4)}${String(e.status).padEnd(4)}${String(n.status).padEnd(4)}${p}`);
    ok(`GET ${p} không 5xx`, a.status < 500 && e.status < 500, `admin=${a.status} emp=${e.status} ${msg(a)}`);
    ok(`GET ${p} không token → 401`, n.status === 401, `→ ${n.status}`);
  }
  console.log('    admin emp none  path'); table.forEach((l) => console.log('    ' + l));

  const writes = [
    ['POST', '/agents/chat'], ['POST', '/attendance/check-in'], ['POST', '/attendance/check-out'],
    ['PATCH', '/attendance/record'], ['POST', '/contracts'], ['POST', '/employees'], ['POST', '/leave'],
    ['PATCH', '/leave/x/approve'], ['POST', '/payroll/generate-bulk'], ['PATCH', '/settings/geofence'],
    ['POST', '/settings/holidays'], ['POST', '/training/submit'], ['POST', '/salary-config'],
    ['POST', '/onboarding/tasks'], ['DELETE', '/settings/sessions/x'],
  ];
  for (const [m, p] of writes) {
    const r = await api(m, p, { body: {} });
    ok(`${m} ${p} không token → 401`, r.status === 401, `→ ${r.status}`);
  }
  for (const p of ['/n8n/employee-context/x', '/n8n/payroll-context/x', '/n8n/knowledge-search?query=a']) {
    const r = await api('GET', p, { token: AT });
    ok(`GET ${p} có JWT nhưng thiếu x-api-key → 401/403`, [401, 403].includes(r.status), `→ ${r.status}`);
  }
  const adminOnlyWrites = [
    ['POST', '/employees', {}], ['PATCH', '/leave/x/approve'], ['PATCH', '/leave/x/reject', { rejectionReason: 'x' }],
    ['POST', '/payroll/generate-bulk', { month: 10, year: 2026 }], ['PATCH', '/payroll/x/approve'],
    ['PATCH', '/settings/geofence', {}], ['PATCH', '/attendance/record', {}], ['POST', '/salary-config', {}],
    ['POST', '/agents/chat-session/x/reply', { message: 'x' }],
  ];
  for (const [m, p, b] of adminOnlyWrites) {
    const r = await api(m, p, { token: ET, body: b ?? {} });
    ok(`EMPLOYEE ${m} ${p} → 403`, r.status === 403, `→ ${r.status} ${msg(r)}`);
  }
}

// ── H4.2: tạo nhân viên ──
section('Hình 4.2 — Tạo hồ sơ nhân viên mới');
const deps = (await api('GET', '/departments', { token: AT })).json;
const pos = (await api('GET', '/positions', { token: AT })).json;
const depId = (deps?.data ?? deps)?.[0]?.id, posId = (pos?.data ?? pos)?.[0]?.id;
const tag = Date.now().toString().slice(-6);
const testEmail = `flowtest${tag}@company.com`;
const lastCode = sql(`select max("employeeCode") from employees where "employeeCode" ~ '^EMP[0-9]{4}$'`);
const cr = await api('POST', '/employees', {
  token: AT,
  body: { fullName: `Flow Test ${tag}`, email: testEmail, joinDate: '2026-01-05', departmentId: depId, positionId: posId, role: 'EMPLOYEE', baseSalary: 15000000, allowances: 1000000 },
});
ok('POST /employees (role → user active) → 201', cr.status === 201, `${cr.status} ${msg(cr)}`);
const T = cr.json ?? {};
const expectCode = 'EMP' + String(parseInt(lastCode.slice(3)) + 1).padStart(4, '0');
ok(`Mã sinh kế tiếp = ${expectCode}`, T.employeeCode === expectCode, `got ${T.employeeCode}`);
info(`status=${T.status}`);
const userActive = sql(`select u."isActive" from users u join employees e on e."userId"=u.id where e.id='${T.id}'`);
ok('User được tạo active', userActive === 't' || userActive === 'true', userActive);
const ob = sql(`select count(*)||'/'||(select count(*) from onboarding_tasks)||' '||string_agg(distinct status::text,',') from onboarding_progress where "employeeId"='${T.id}'`);
ok('Gán toàn bộ OnboardingTask trạng thái PENDING', /^(\d+)\/\1 PENDING$/.test(ob), ob);
const ct = sql(`select type||' '||"baseSalary"||' '||"isActive" from contracts where "employeeId"='${T.id}'`);
info(`hợp đồng tạo kèm: ${ct}`);
const dup = await api('POST', '/employees', { token: AT, body: { fullName: 'Dup', email: testEmail, joinDate: '2026-01-05', departmentId: depId, positionId: posId } });
ok('Trùng email → 409', dup.status === 409, `${dup.status}`);
const ph = await api('POST', '/employees', { token: AT, body: { fullName: `Flow Placeholder ${tag}`, email: `ph${tag}@company.com`, joinDate: '2026-01-05', departmentId: depId, positionId: posId } });
const phUser = sql(`select u."isActive"||' '||u.email from users u join employees e on e."userId"=u.id where e.id='${ph.json?.id}'`);
ok('Không truyền role → user giữ chỗ isActive=false', /^(f|false) /.test(phUser), phUser);
const rp = await api('POST', `/employees/${T.id}/reset-password`, { token: AT, body: { mode: 'GENERATE' } });
const tPass = rp.json?.generatedPassword ?? rp.json?.newPassword ?? rp.json?.password ?? rp.json?.temporaryPassword;
ok('Reset mật khẩu nhân viên test', rp.status < 300 && !!tPass, `${rp.status} keys=${Object.keys(rp.json ?? {})}`);
const TT = await login({ email: testEmail, password: tPass });
ok('Nhân viên test đăng nhập được', !!TT);
if (!TT) { console.log(`\n══ DỪNG: không có nhân viên test. ${pass} pass, ${fail} fail ══`); fails.forEach((f) => console.log('  - ' + f)); process.exit(1); }

// ── H3.9: xác thực ──
section('Hình 3.9 — Đăng nhập & xác thực request');
{
  const prof = await api('GET', '/auth/profile', { token: TT });
  ok('Bearer token → profile role EMPLOYEE', prof.json?.role === 'EMPLOYEE', msg(prof));
  const payload = JSON.parse(Buffer.from(TT.split('.')[1], 'base64url').toString());
  ok('accessToken chứa sid', !!payload.sid, JSON.stringify(payload));
  const rt = sql(`select round(extract(epoch from ("expiresAt"-"createdAt"))/86400) from refresh_tokens where id='${payload.sid}'`);
  ok('RefreshToken hạn 30 ngày', rt === '30', `${rt} ngày`);
  const lh = sql(`select count(*) from login_history lh join users u on u.id=lh."userId" where u.email='${testEmail}'`);
  ok('Ghi LoginHistory', parseInt(lh) >= 1, lh);
  const fb = await api('POST', '/auth/firebase', { body: { idToken: 'invalid' } });
  ok('POST /auth/firebase idToken sai → 401', fb.status === 401, `${fb.status} ${msg(fb)}`);
  // role đọc lại từ DB mỗi request
  sql(`update users set role='ADMIN' where email='${testEmail}'`);
  const prof2 = await api('GET', '/auth/profile', { token: TT });
  ok('JwtStrategy đọc lại role từ DB (đổi role không cần login lại)', prof2.json?.role === 'ADMIN', msg(prof2));
  sql(`update users set role='EMPLOYEE' where email='${testEmail}'`);
}

// ── H4.3: chấm công ──
section('Hình 4.3 — Chấm công GPS');
{
  const gf = (await api('GET', '/settings/geofence', { token: TT })).json;
  ok('GET /settings/geofence trả lat,lng,radiusM', gf && 'lat' in gf && 'radiusM' in gf, JSON.stringify(gf));
  const out = await api('POST', '/attendance/check-in', { token: TT, body: { lat: 0, lng: 0 } });
  info(`check-in ở (0,0) ngoài bán kính → ${out.status} ${msg(out)} (ATTENDANCE_GEOFENCE_MOCK quyết định)`);
  let ci = out;
  if (out.status === 403) ci = await api('POST', '/attendance/check-in', { token: TT, body: { lat: gf.lat, lng: gf.lng } });
  ok('Check-in trong bán kính → 201', ci.status === 201, `${ci.status} ${msg(ci)}`);
  const now = new Date(Date.now() + 7 * 3600e3);
  const late = now.getUTCHours() * 60 + now.getUTCMinutes() > 8 * 60 + 30;
  info(`trạng thái=${ci.json?.status} dayType=${ci.json?.dayType} (giờ VN ${now.toISOString().slice(11, 16)})`);
  if (ci.json?.dayType === 'NORMAL') ok(`Sau 08:30 → LATE, trước → PRESENT`, ci.json?.status === (late ? 'LATE' : 'PRESENT'), ci.json?.status);
  const ci2 = await api('POST', '/attendance/check-in', { token: TT, body: { lat: gf.lat, lng: gf.lng } });
  ok('Check-in lần 2 cùng ngày → 409', ci2.status === 409, `${ci2.status}`);
  const co = await api('POST', '/attendance/check-out', { token: TT, body: {} });
  ok('Check-out → 2xx', co.status >= 200 && co.status < 300, `${co.status} ${msg(co)}`);
  info(`check-out status code=${co.status}, workDays=${co.json?.workDays}, overtime=${co.json?.overtime}`);
  ok('workDays theo bước 0,25', co.json && Number.isInteger(co.json.workDays * 4), co.json?.workDays);
}

// ── H4.4 + H4.5: nghỉ phép ──
section('Hình 4.4 & 4.5 — Đơn nghỉ phép');
let leaveId;
{
  const bal0 = (await api('GET', `/leave/balance/${T.id}?year=2026`, { token: TT })).json;
  info(`số dư phép đầu: ${JSON.stringify(bal0)?.slice(0, 160)}`);
  const c1 = await api('POST', '/leave', { token: TT, body: { employeeId: T.id, type: 'ANNUAL', startDate: '2026-11-13', endDate: '2026-11-17', reason: 'Flow test' } });
  ok('POST /leave ANNUAL → PENDING', c1.status === 201 && c1.json?.status === 'PENDING', `${c1.status} ${msg(c1)}`);
  leaveId = c1.json?.id;
  ok('countWorkdays bỏ T7/CN: 13→17/11/2026 (T6..T3) = 3 ngày', c1.json?.totalDays === 3, c1.json?.totalDays);
  const ov = await api('POST', '/leave', { token: TT, body: { employeeId: T.id, type: 'SICK', startDate: '2026-11-16', endDate: '2026-11-16', reason: 'overlap' } });
  ok('Trùng ngày đơn PENDING → bị chặn', ov.status === 400 || ov.status === 409, `${ov.status} ${msg(ov)}`);
  const big = await api('POST', '/leave', { token: TT, body: { employeeId: T.id, type: 'ANNUAL', startDate: '2026-12-01', endDate: '2026-12-31', reason: 'quá số dư' } });
  ok('ANNUAL vượt số dư → bị chặn', big.status === 400, `${big.status} ${msg(big)}`);
  const selfApprove = await api('PATCH', `/leave/${leaveId}/approve`, { token: TT });
  ok('Nhân viên tự duyệt → 403', selfApprove.status === 403, `${selfApprove.status}`);
  const ap = await api('PATCH', `/leave/${leaveId}/approve`, { token: AT });
  ok('ADMIN duyệt → APPROVED, approvedBy/approvedAt', ap.json?.status === 'APPROVED' && ap.json?.approvedById && ap.json?.approvedAt, `${ap.status} ${msg(ap)}`);
  const onLeave = sql(`select string_agg(to_char(date,'MM-DD')||':'||status, ',' order by date) from attendances where "employeeId"='${T.id}' and date between '2026-11-13' and '2026-11-17'`);
  ok('Upsert attendance ON_LEAVE cho từng ngày làm việc', onLeave === '11-13:ON_LEAVE,11-16:ON_LEAVE,11-17:ON_LEAVE', onLeave);
  const cancelApproved = await api('PATCH', `/leave/${leaveId}/cancel`, { token: TT });
  ok('Đơn APPROVED không hủy được', cancelApproved.status >= 400, `${cancelApproved.status}`);
  const c2 = await api('POST', '/leave', { token: TT, body: { employeeId: T.id, type: 'SICK', startDate: '2026-11-20', endDate: '2026-11-20', reason: 'hủy' } });
  const adminCancel = await api('PATCH', `/leave/${c2.json?.id}/cancel`, { token: AT });
  ok('ADMIN không hủy hộ đơn của người khác', adminCancel.status >= 400, `${adminCancel.status}`);
  const cc = await api('PATCH', `/leave/${c2.json?.id}/cancel`, { token: TT });
  ok('Người tạo đơn hủy → CANCELLED', cc.json?.status === 'CANCELLED', `${cc.status} ${msg(cc)}`);
  const c3 = await api('POST', '/leave', { token: TT, body: { employeeId: T.id, type: 'SICK', startDate: '2026-11-24', endDate: '2026-11-24', reason: 'từ chối' } });
  const rj = await api('PATCH', `/leave/${c3.json?.id}/reject`, { token: AT, body: { rejectionReason: 'Thiếu người trực' } });
  ok('ADMIN từ chối kèm lý do → REJECTED', rj.json?.status === 'REJECTED' && rj.json?.rejectionReason, `${rj.status} ${msg(rj)}`);
  const reApprove = await api('PATCH', `/leave/${c3.json?.id}/approve`, { token: AT });
  ok('REJECTED là trạng thái cuối (không duyệt lại được)', reApprove.status >= 400, `${reApprove.status}`);
}

// ── H4.6 + H4.7: lương ──
section('Hình 4.6 & 4.7 — Tính lương & trạng thái phiếu lương');
{
  const empGen = await api('POST', `/payroll/generate/${T.id}`, { token: TT, body: { month: 10, year: 2026 } });
  ok('Nhân viên gọi generate → 403', empGen.status === 403, `${empGen.status}`);
  const g = await api('POST', `/payroll/generate/${T.id}`, { token: AT, body: { month: 10, year: 2026 } });
  ok('generate → DRAFT', g.json?.status === 'DRAFT', `${g.status} ${msg(g)}`);
  const P = g.json ?? {};
  info(`T10/2026: chuẩn=${P.workingDays} thực tế=${P.actualWorkingDays} base=${P.baseSalary} bhxh=${P.bhxh} tax=${P.tax ?? P.pit} net=${P.netSalary}`);
  ok('Ngày công < 14 → không trích bảo hiểm', (P.actualWorkingDays ?? 0) >= 14 || (Number(P.bhxh ?? 0) === 0), `days=${P.actualWorkingDays} bhxh=${P.bhxh}`);
  ok('Ngày công chuẩn T10/2026 = 22 (T2–T6, không lễ)', P.workingDays === 22, P.workingDays);
  const adj = await api('PATCH', `/payroll/${P.id}/adjust`, { token: AT, body: { bonus: 500000, advance: 200000, note: 'flow' } });
  ok('adjust DRAFT → vẫn DRAFT', adj.json?.status === 'DRAFT', `${adj.status} ${msg(adj)}`);
  const regen = await api('POST', `/payroll/generate/${T.id}`, { token: AT, body: { month: 10, year: 2026 } });
  ok('DRAFT tính lại được, giữ bonus/advance', regen.json?.status === 'DRAFT' && Number(regen.json?.bonus) === 500000, msg(regen));
  const ap = await api('PATCH', `/payroll/${P.id}/approve`, { token: AT });
  ok('approve → APPROVED', ap.json?.status === 'APPROVED', `${ap.status} ${msg(ap)}`);
  const regen2 = await api('POST', `/payroll/generate/${T.id}`, { token: AT, body: { month: 10, year: 2026 } });
  ok('APPROVED không tính lại được → 400', regen2.status === 400, `${regen2.status}`);
  const adj2 = await api('PATCH', `/payroll/${P.id}/adjust`, { token: AT, body: { bonus: 1 } });
  ok('APPROVED không adjust được', adj2.status >= 400, `${adj2.status}`);
  const paid = await api('PATCH', `/payroll/${P.id}/paid`, { token: AT });
  ok('paid → PAID + paidAt', paid.json?.status === 'PAID' && !!paid.json?.paidAt, `${paid.status} ${msg(paid)}`);
  const me = await api('GET', '/payroll/me?month=10&year=2026', { token: TT });
  ok('Nhân viên xem phiếu lương của mình', me.status === 200, `${me.status}`);
  // lương T11 có 3 ngày phép năm đã duyệt
  const pv = await api('GET', `/payroll/preview/${T.id}?month=11&year=2026`, { token: AT });
  info(`preview T11: thực tế=${pv.json?.actualWorkingDays} (gồm 3 ngày phép năm + ngày công hôm nay)`);
  ok('Ngày công thực tế T11 cộng 3 ngày phép năm đã duyệt', (pv.json?.actualWorkingDays ?? 0) >= 3, msg(pv));
}

// ── H4.8: cài đặt & nhật ký ──
section('Hình 4.8 — Cập nhật cấu hình & nhật ký thay đổi');
{
  const lp = (await api('GET', '/settings/leave-policy', { token: AT })).json;
  const before = parseInt(sql(`select count(*) from settings_audit_logs`));
  const up = await api('PATCH', '/settings/leave-policy', { token: AT, body: { annualQuotaDays: lp.annualQuotaDays + 1 } });
  ok('PATCH leave-policy → 200', up.status === 200, `${up.status} ${msg(up)}`);
  const row = sql(`select section||'|'||field||'|'||"oldValue"||'|'||"newValue" from settings_audit_logs order by "createdAt" desc limit 1`);
  ok('logChanges ghi đúng trường đổi (cũ → mới)', row.includes('annualQuotaDays') && row.includes(String(lp.annualQuotaDays + 1)), row);
  ok('Chỉ ghi trường thay đổi (1 dòng)', parseInt(sql(`select count(*) from settings_audit_logs`)) === before + 1);
  await api('PATCH', '/settings/leave-policy', { token: AT, body: { annualQuotaDays: lp.annualQuotaDays } });
  ok('Bản ghi đơn id = default', sql(`select string_agg(id, ',') from leave_policies`) === 'default');
  const integ = (await api('GET', '/settings/integrations', { token: AT })).json;
  info(`integrations: ${JSON.stringify(integ)?.slice(0, 400)}`);
}

// ── H4.9 / H4.10: hỏi đáp lương + RAG ──
section('Hình 4.9 & 4.10 — Hỏi đáp lương qua HR Agent, truy xuất chính sách');
{
  const rag = await api('GET', '/n8n/knowledge-search?query=' + encodeURIComponent('nghỉ phép năm được bao nhiêu ngày') + '&topK=3', { key: KEY });
  const items = rag.json?.results ?? rag.json?.items ?? rag.json;
  ok('knowledge-search trả top-3 đoạn', Array.isArray(items) && items.length === 3, `${rag.status} ${msg(rag)}`);
  if (Array.isArray(items)) info(`top-1: ${items[0]?.docTitle} score=${items[0]?.score}; mode=${rag.json?.mode ?? rag.json?.backend ?? '?'}`);
  ok('Mỗi đoạn có docTitle và score', Array.isArray(items) && items.every((i) => i.docTitle && typeof i.score === 'number'));
  const pc = await api('GET', `/n8n/payroll-context/${T.id}?month=10&year=2026`, { key: KEY });
  ok('payroll-context trả phiếu lương Rule Engine', pc.status === 200, `${pc.status} ${msg(pc)}`);
  const t0 = Date.now();
  const chat = await api('POST', '/agents/chat', { token: ET, body: { message: 'Lương tháng 10 năm 2026 của tôi thực lĩnh bao nhiêu?', sessionType: 'HR_QA' } });
  ok('POST /agents/chat (HR) → answer', chat.status === 200 && typeof chat.json?.answer === 'string' && chat.json.answer.length > 0, `${chat.status} ${msg(chat)}`);
  info(`intent=${chat.json?.intent} latency=${Date.now() - t0}ms answer="${chat.json?.answer?.slice(0, 160)}"`);
  ok('intent = HR_QA', chat.json?.intent === 'HR_QA', chat.json?.intent);
  const sid = chat.json?.sessionId;
  if (sid) {
    const m = sql(`select string_agg(role, ',' order by "createdAt") from ai_chat_messages where "sessionId"='${sid}'`);
    info(`tin nhắn trong phiên: ${m}`);
    ok('Lưu cả tin người dùng và câu trả lời', m.includes('user') && m.includes('assistant'), m);
  }
}

// ── H4.11: sinh và chấm bài kiểm tra ──
section('Hình 4.11 — Sinh và chấm bài kiểm tra đào tạo');
{
  const gq = await api('POST', '/agents/chat', { token: TT, body: { message: 'Bắt đầu bài test', sessionType: 'TRAINING', scenarioType: 'CUSTOMER_COMPLAINT' } });
  const qs = gq.json?.questions ?? gq.json?.quiz?.questions ?? gq.json?.data?.questions;
  ok('generate_quiz → 7 câu (5 MCQ + 2 tự luận)', Array.isArray(qs) && qs.length === 7, `${gq.status} ${msg(gq)}`);
  if (Array.isArray(qs)) {
    ok('Câu hỏi trả về KHÔNG kèm correctAnswer', qs.every((q) => q.correctAnswer === undefined), JSON.stringify(qs[0]));
    const answers = qs.map((q, i) => ({ questionId: q.questionId ?? q.id ?? i + 1, question: q.question, type: q.type, answer: q.type === 'mcq' ? 'A' : 'Tôi sẽ lắng nghe khách hàng, xin lỗi vì sự bất tiện, xác minh vấn đề và đề xuất phương án xử lý cụ thể trong ngày.' }));
    const sub = await api('POST', '/training/submit', { token: TT, body: { scenarioType: 'CUSTOMER_COMPLAINT', answers } });
    ok('POST /training/submit → chấm điểm', sub.status < 300, `${sub.status} ${msg(sub)}`);
    info(`kết quả: ${JSON.stringify(sub.json)?.slice(0, 300)}`);
  }
}

// ── H4.12 / H3.8: CSKH & leo thang ──
section('Hình 4.12 & 3.8 — CSKH & leo thang');
{
  const ext = `flowtest-${tag}`;
  const r = await fetch(`${N8N}/webhook/zalo-webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
    body: JSON.stringify({ userId: ext, message: 'Tôi muốn khiếu nại, cho tôi gặp người thật ngay', originalMessage: 'x', channel: 'zalo', externalId: ext, slackChannel: 'CFLOWTEST', threadTs: '1.1' }),
  });
  ok('WF04 webhook nhận tin (x-api-key) → 200', r.status === 200, `${r.status}`);
  let sess = '';
  for (let i = 0; i < 40 && !sess.includes('|f|'); i++) {
    await new Promise((s) => setTimeout(s, 3000));
    sess = sql(`select id||'|'||case when "isActive" then 't' else 'f' end||'|'||coalesce("escalatedAt"::text,'') from ai_chat_sessions where "externalId"='${ext}'`);
  }
  info(`phiên CSKH: ${sess}`);
  const sessId = sess.split('|')[0];
  const roles = sql(`select string_agg(role, ',' order by "createdAt") from ai_chat_messages where "sessionId"='${sessId}'`);
  ok('Lưu tin khách + câu trả lời AI', roles.includes('user') && roles.includes('assistant'), roles);
  ok('Yêu cầu gặp người thật → leo thang (isActive=false, escalatedAt)', sess.includes('|f|') && sess.split('|')[2] !== '', sess);
  const nt = sql(`select count(*) from notifications where "createdAt" > now() - interval '3 minutes' and (title ilike '%leo thang%' or title ilike '%escalat%' or body ilike '%${ext}%' or type::text ilike '%ESCAL%')`);
  info(`thông báo admin mới: ${nt}`);
  // Bot muted: tin tiếp theo chỉ lưu, không gọi AI
  const before = parseInt(sql(`select count(*) from ai_chat_messages where "sessionId"='${sessId}'`) || '0');
  await fetch(`${N8N}/webhook/zalo-webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': KEY }, body: JSON.stringify({ userId: ext, message: 'alo', channel: 'zalo', externalId: ext, slackChannel: 'CFLOWTEST', threadTs: '1.1' }) });
  await new Promise((s) => setTimeout(s, 8000));
  const after = sql(`select string_agg(role || ':' || coalesce(metadata->>'botMuted',''), ',' order by "createdAt") from (select * from ai_chat_messages where "sessionId"='${sessId}' order by "createdAt" offset ${before}) x`);
  ok('Bot đã tắt → chỉ lưu tin, không gọi AI (botMuted)', after === 'user:true', after);
  const reply = await api('POST', `/agents/chat-session/${sessId}/reply`, { token: AT, body: { content: 'Chào anh/chị, em là nhân viên CSKH.' } });
  info(`admin reply → ${reply.status} ${msg(reply)} (kênh Slack giả, không gửi ra ngoài)`);
  const re = await api('POST', `/agents/chat-session/${sessId}/reactivate`, { token: AT });
  ok('Admin bật lại bot → isActive=true', re.status < 300 && sql(`select "isActive" from ai_chat_sessions where id='${sessId}'`) === 't', `${re.status}`);
}

// ── Khóa tài khoản (làm cuối) ──
section('Hình 3.9 — Khóa tài khoản khi nhập sai mật khẩu');
{
  const pol = (await api('GET', '/settings/security-policy', { token: AT })).json;
  info(`maxFailedAttempts=${pol?.maxFailedAttempts} lockoutMinutes=${pol?.lockoutMinutes}`);
  let last;
  for (let i = 0; i < pol.maxFailedAttempts; i++) last = await api('POST', '/auth/login', { body: { email: testEmail, password: 'Wrong#Pass123' } });
  ok(`Sai ${pol.maxFailedAttempts} lần → 401 + thông báo khóa`, last.status === 401 && /khóa/i.test(JSON.stringify(last.json)), msg(last));
  const lk = sql(`select round(extract(epoch from ("lockedUntil"-now()))/60)||' '||"failedLoginAttempts" from users where email='${testEmail}'`);
  ok(`lockedUntil ≈ +${pol.lockoutMinutes} phút, bộ đếm reset 0`, lk === `${pol.lockoutMinutes} 0`, lk);
  const right = await api('POST', '/auth/login', { body: { email: testEmail, password: tPass } });
  ok('Đúng mật khẩu khi đang khóa vẫn bị từ chối', right.status === 401, `${right.status}`);
  const fresh = (await api('POST', '/auth/login', { body: ADMIN })).json;
  const lo = await api('POST', '/auth/logout', { token: fresh.accessToken, body: { refreshToken: fresh.refreshToken } });
  const after = await api('GET', '/auth/profile', { token: fresh.accessToken });
  ok('Logout thu hồi phiên → token cũ 401', after.status === 401, `logout ${lo.status}, profile ${after.status}`);
}

console.log(`\n══ KẾT QUẢ: ${pass} pass, ${fail} fail ══`);
fails.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
