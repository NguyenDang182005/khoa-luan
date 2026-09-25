/**
 * E2E test tổng hợp — Trang "Cài Đặt Hệ Thống" (admin).
 * Chạy: node scripts/test-settings.mjs  (API đang chạy ở :3001, DB có seed)
 *
 * Phủ: phân quyền ADMIN/EMPLOYEE, 7 section (lương-thuế, geofence, tích hợp,
 * phép năm, bảo mật, AI agent, nhật ký thay đổi), audit log, gate AI agent.
 *
 * Lưu ý: script trả mọi cấu hình về giá trị ban đầu sau khi test.
 */

const BASE = process.env.API_URL ?? 'http://localhost:3001/api/v1';

let passed = 0;
let failed = 0;

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* body rỗng */
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`\n=== E2E Settings — ${BASE} ===\n`);

  // ── Đăng nhập 2 vai ──
  const admin = await api('POST', '/auth/login', {
    body: { email: 'admin@hr-system.com', password: 'Admin@123' },
  });
  check('Admin login', admin.status === 200);
  const t = admin.json.accessToken;

  const emp = await api('POST', '/auth/login', {
    body: { email: 'employee1@company.com', password: 'Employee@123' },
  });
  check('Employee login', emp.status === 200, JSON.stringify(emp.json));
  const te = emp.json.accessToken;

  // ── 1. PHÂN QUYỀN: employee bị chặn mọi endpoint cài đặt admin ──
  console.log('\n── Phân quyền ──');
  for (const [method, path] of [
    ['GET', '/settings/leave-policy'],
    ['GET', '/settings/security-policy'],
    ['GET', '/settings/ai-config'],
    ['GET', '/settings/sessions'],
    ['GET', '/settings/login-history'],
    ['GET', '/settings/audit-log'],
    ['GET', '/settings/integrations'],
  ]) {
    const r = await api(method, path, { token: te });
    check(`EMPLOYEE ${method} ${path} → 403`, r.status === 403, `status=${r.status}`);
  }
  const geoEmp = await api('GET', '/settings/geofence', { token: te });
  check('EMPLOYEE GET /settings/geofence → 200 (check-in cần)', geoEmp.status === 200);

  // ── 2. PHÉP NĂM ──
  console.log('\n── Phép Năm ──');
  const lp0 = await api('GET', '/settings/leave-policy', { token: t });
  check('GET leave-policy 200 (auto-create default)', lp0.status === 200 && lp0.json.id === 'default');

  const employees = await api('GET', '/employees', { token: t });
  const emp0 = employees.json.data[0];
  const bal0 = await api('GET', `/leave/balance/${emp0.id}?year=2026`, { token: t });
  check('Balance có breakdown mới (quota/carryOver)', bal0.json.quota !== undefined && bal0.json.carryOver !== undefined);

  const lp1 = await api('PATCH', '/settings/leave-policy', {
    token: t,
    body: { annualQuotaDays: 14 },
  });
  check('PATCH quota 12→14 thành công', lp1.status === 200 && lp1.json.annualQuotaDays === 14);
  const bal1 = await api('GET', `/leave/balance/${emp0.id}?year=2026`, { token: t });
  // Quota scale theo tỷ lệ mới/ cũ (nhân viên pro-rate vẫn đúng: 5 → 5.83 khi 12→14)
  const expected = Math.round((bal0.json.quota * 14) / 12 * 100) / 100;
  check(
    'Balance phản ánh quota mới (scale 14/12)',
    Math.abs(bal1.json.quota - expected) < 0.05,
    `${bal0.json.quota} → ${bal1.json.quota} (kỳ vọng ~${expected})`,
  );
  await api('PATCH', '/settings/leave-policy', { token: t, body: { annualQuotaDays: lp0.json.annualQuotaDays } });

  // ── 3. LƯƠNG & THUẾ + GEOFENCE (audit retrofit) ──
  console.log('\n── Lương & Thuế + Geofence ──');
  const sc0 = await api('GET', '/salary-config/current', { token: t });
  check('GET salary-config/current 200', sc0.status === 200);
  // Payload sạch — không truyền id/createdAt/updatedAt từ GET vào POST
  const sc1 = await api('POST', '/salary-config', {
    token: t,
    body: {
      year: 2026,
      bhxhRate: sc0.json.bhxhRate,
      bhytRate: sc0.json.bhytRate,
      bhtnRate: sc0.json.bhtnRate,
      pitFreeAmount: Number(sc0.json.pitFreeAmount) + 500000,
      overtimeRate: sc0.json.overtimeRate,
      otWeekendRate: sc0.json.otWeekendRate,
      otHolidayRate: sc0.json.otHolidayRate,
      standardWorkHours: sc0.json.standardWorkHours,
    },
  });
  check('POST salary-config đổi giảm trừ', sc1.status === 200 && Number(sc1.json.pitFreeAmount) === Number(sc0.json.pitFreeAmount) + 500000, JSON.stringify(sc1.json));
  const gf1 = await api('PATCH', '/settings/geofence', { token: t, body: { radiusM: 260 } });
  check('PATCH geofence radius 260', gf1.status === 200 && gf1.json.radiusM === 260);

  // ── 4. BẢO MẬT ──
  console.log('\n── Bảo Mật ──');
  const sp = await api('GET', '/settings/security-policy', { token: t });
  check('GET security-policy 200 (default)', sp.status === 200 && sp.json.maxFailedAttempts >= 1);
  const sessions = await api('GET', '/settings/sessions', { token: t });
  check('Sessions: có dữ liệu + không lộ token', sessions.status === 200 && Array.isArray(sessions.json) && !('token' in (sessions.json[0] ?? {})));
  const history = await api('GET', '/settings/login-history', { token: t });
  check('Login history ≥ 2 sự kiện (vừa login 2 vai)', history.status === 200 && history.json.length >= 2);

  // ── 5. AI AGENT ──
  console.log('\n── AI Agent ──');
  const ai0 = await api('GET', '/settings/ai-config', { token: t });
  check('GET ai-config 200, không có field apiKey', ai0.status === 200 && !('apiKey' in ai0.json) && 'apiKeySet' in ai0.json);

  await api('PATCH', '/settings/ai-config', { token: t, body: { enabled: false } });
  const chatOff = await api('POST', '/agents/chat', { token: te, body: { message: 'ping' } });
  // Chữ ký của nhánh "agent bị tắt": latencyMs = 0 (không gọi n8n) + có answer
  check(
    'Agent TẮT → chat nhận thông báo thân thiện',
    chatOff.status === 200 && chatOff.json?.latencyMs === 0 && typeof chatOff.json?.answer === 'string' && chatOff.json.answer.length > 0,
    JSON.stringify(chatOff.json),
  );

  await api('PATCH', '/settings/ai-config', { token: t, body: { enabled: true } });
  const test1 = await api('POST', '/settings/ai/test-connection', { token: t });
  check('Test connection: healthz OK', test1.json?.healthz?.ok === true, JSON.stringify(test1.json?.healthz));

  // ── 6. NHẬT KÝ THAY ĐỔI ──
  console.log('\n── Nhật Ký Thay Đổi ──');
  const audit = await api('GET', '/settings/audit-log?limit=100', { token: t });
  const sections = new Set(audit.json.items.map((i) => i.section));
  check('Audit có bản ghi leave_policy', sections.has('leave_policy'));
  check('Audit có bản ghi salary_config', sections.has('salary_config'));
  check('Audit có bản ghi geofence', sections.has('geofence'));
  check('Audit có bản ghi ai_agent', sections.has('ai_agent'));
  const filtered = await api('GET', '/settings/audit-log?section=leave_policy', { token: t });
  check('Filter theo section hoạt động', filtered.json.items.every((i) => i.section === 'leave_policy'));

  // ── 7. HOÀN TRẢ CẤU HÌNH BAN ĐẦU ──
  console.log('\n── Hoàn trả ──');
  const scRestore = await api('POST', '/salary-config', {
    token: t,
    body: {
      year: 2026,
      bhxhRate: sc0.json.bhxhRate,
      bhytRate: sc0.json.bhytRate,
      bhtnRate: sc0.json.bhtnRate,
      pitFreeAmount: sc0.json.pitFreeAmount,
      overtimeRate: sc0.json.overtimeRate,
      otWeekendRate: sc0.json.otWeekendRate,
      otHolidayRate: sc0.json.otHolidayRate,
      standardWorkHours: sc0.json.standardWorkHours,
    },
  });
  const gfRestore = await api('PATCH', '/settings/geofence', { token: t, body: { radiusM: 200 } });
  check(
    'Đã trả cấu hình về giá trị ban đầu',
    scRestore.status === 200 && Number(scRestore.json.pitFreeAmount) === Number(sc0.json.pitFreeAmount) && gfRestore.json.radiusM === 200,
  );

  console.log(`\n=== KẾT QUẢ: ${passed} pass, ${failed} fail ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Script lỗi:', e);
  process.exit(1);
});
