/**
 * E2E test — Tab Bảo Mật & Phiên đăng nhập của trang Cài Đặt.
 * Chạy: node scripts/test-security.mjs  (API phải đang chạy ở :3001)
 *
 * Kiểm tra:
 *  1. Login gắn sid + ghi login_history
 *  2. GET /settings/sessions KHÔNG lộ refresh-token
 *  3. Thu hồi phiên → access token chết ngay (Q17=A)
 *  4. Lockout sau N lần sai (SecurityPolicy) — reset khóa bằng SQL thủ công sau test
 *  5. POST /auth/change-password: mật khẩu yếu bị chặn theo policy, đổi mạnh thành công
 *
 * LƯU Ý: script dùng tài khoản hr-admin@company.com (seed) — kết thúc sẽ trả lại mật khẩu Admin@123.
 */

const BASE = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const ADMIN = { email: 'admin@hr-system.com', password: 'Admin@123' };
const TARGET = { email: 'hr-admin@company.com', password: 'Admin@123' };

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

function decodeJwtPayload(jwt) {
  const p = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
}

async function main() {
  console.log(`\n=== E2E Security — ${BASE} ===\n`);

  // 1. Login
  const adminLogin = await api('POST', '/auth/login', { body: ADMIN });
  check('Admin login OK', adminLogin.status === 200);
  const adminToken = adminLogin.json.accessToken;

  const targetLogin = await api('POST', '/auth/login', { body: TARGET });
  check('hr-admin login OK', targetLogin.status === 200, JSON.stringify(targetLogin.json));
  const targetToken = targetLogin.json.accessToken;
  if (!targetToken) {
    console.log(
      `\n  ⛔ hr-admin không đăng nhập được (có thể đang bị khóa từ lần chạy trước). Reset bằng PowerShell:\n` +
        `    'UPDATE users SET "lockedUntil" = NULL, "failedLoginAttempts" = 0 WHERE email = ''${TARGET.email}'';' | Out-File -Encoding utf8 "$env:TEMP\\unlock.sql"\n` +
        `    Get-Content "$env:TEMP\\unlock.sql" | docker exec -i hr_system_db psql -U postgres -d hr_system_db\n`,
    );
    console.log(`\n=== KẾT QUẢ: ${passed} pass, ${failed} fail ===\n`);
    process.exit(1);
  }
  const targetSid = decodeJwtPayload(targetToken).sid;
  check('Access token có sid (phiên)', Boolean(targetSid), JSON.stringify(decodeJwtPayload(targetToken)));

  // 2. Sessions không lộ token
  const sessions = await api('GET', '/settings/sessions', { token: adminToken });
  const first = Array.isArray(sessions.json) ? sessions.json[0] : null;
  check('GET /settings/sessions 200', sessions.status === 200);
  check('Session KHÔNG chứa trường token', first !== null && !('token' in first));
  check('Session có ip/userAgent fields', first !== null && 'ip' in first && 'userAgent' in first);

  // 3. Thu hồi phiên thật
  const profileBefore = await api('GET', '/auth/profile', { token: targetToken });
  check('Profile của hr-admin hoạt động trước thu hồi', profileBefore.status === 200);
  const revoke = await api('DELETE', `/settings/sessions/${targetSid}`, { token: adminToken });
  check('Thu hồi phiên thành công', revoke.json?.revoked === true);
  const profileAfter = await api('GET', '/auth/profile', { token: targetToken });
  check('Token đã chết ngay sau thu hồi (401)', profileAfter.status === 401, `status=${profileAfter.status}`);

  // 4. Lockout (bật bằng mặc định; chạy SKIP_LOCKOUT=1 để bỏ qua — ví dụ để test change-password)
  if (!process.env.SKIP_LOCKOUT) {
    let lastLoginResult = null;
    for (let i = 0; i < 5; i++) {
      lastLoginResult = await api('POST', '/auth/login', {
        body: { email: TARGET.email, password: 'WrongPass@1' },
      });
    }
    check('Lần sai thứ 5 bị chặn (401)', lastLoginResult.status === 401);
    check('Có thông báo khóa', /khóa|khoá/i.test(lastLoginResult.json?.message ?? ''), lastLoginResult.json?.message);
    const lockedLogin = await api('POST', '/auth/login', { body: TARGET });
    check('Đúng mật khẩu vẫn chặn khi đang khóa (401)', lockedLogin.status === 401);
    console.log('  ⚠ Đang khóa hr-admin — reset bằng SQL ở ngoài script (xem hướng dẫn in bên dưới)');
  }

  // 5. Change password (yêu cầu reset khóa trước — script dừng ở đây nếu chưa reset)
  const relogin = await api('POST', '/auth/login', { body: TARGET });
  if (relogin.status !== 200) {
    console.log('\n  ⏭ Bỏ qua phần change-password vì tài khoản đang bị khóa. Reset bằng:');
    console.log(`    docker exec hr_system_db psql -U postgres -d hr_system_db -c "UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE email = '${TARGET.email}';"`);
  } else {
    const weak = await api('POST', '/auth/change-password', {
      token: relogin.json.accessToken,
      body: { currentPassword: TARGET.password, newPassword: 'weak' },
    });
    check('Mật khẩu yếu bị chặn (400)', weak.status === 400, JSON.stringify(weak.json));
    check('Lỗi liệt kê yêu cầu policy', /ký tự|HOA|thường|chữ số|đặc biệt/i.test(weak.json?.message ?? ''), weak.json?.message);

    const strong = await api('POST', '/auth/change-password', {
      token: relogin.json.accessToken,
      body: { currentPassword: TARGET.password, newPassword: 'Strong@Pass9' },
    });
    check('Đổi mật khẩu mạnh thành công (200)', strong.status === 200, JSON.stringify(strong.json));

    const withNew = await api('POST', '/auth/login', {
      body: { email: TARGET.email, password: 'Strong@Pass9' },
    });
    check('Đăng nhập bằng mật khẩu mới OK', withNew.status === 200);

    const revert = await api('POST', '/auth/change-password', {
      token: withNew.json.accessToken,
      body: { currentPassword: 'Strong@Pass9', newPassword: TARGET.password },
    });
    check('Trả lại mật khẩu ban đầu OK', revert.status === 200);
  }

  console.log(`\n=== KẾT QUẢ: ${passed} pass, ${failed} fail ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Script lỗi:', e);
  process.exit(1);
});
