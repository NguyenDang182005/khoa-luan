/* UX audit walkthrough — real-user pass over the local HR portal.
 * Uses the puppeteer-core already installed in scripts/diag-browser.
 * Read-only: opens dialogs/menus but does not submit mutations.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const OUT = path.resolve(__dirname, '..', '..', '.tmp-ui-audit', 'shots');
fs.mkdirSync(OUT, { recursive: true });

const report = { startedAt: new Date().toISOString(), steps: [], console: [], requestsFailed: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=none',
      '--force-device-scale-factor=1',
      '--hide-scrollbars=false',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      report.console.push(`[${m.type()}] ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => report.console.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => {
    const err = r.failure() ? r.failure().errorText : 'unknown';
    report.requestsFailed.push(`${r.url()} :: ${err}`);
  });

  async function shot(name, fullPage = false) {
    await page.addStyleTag({
      content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}',
    }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage });
    report.steps.push({ name, at: new Date().toISOString(), url: page.url() });
  }

  async function snapshot(label) {
    const data = await page.evaluate(() => {
      const main = document.querySelector('main');
      const interactive = [...document.querySelectorAll('button,a,input,select,textarea')];
      const unnamed = interactive.filter((el) => {
        const name = (
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.textContent ||
          el.getAttribute('placeholder') ||
          ''
        ).trim();
        return !name;
      }).length;
      return {
        title: document.title,
        h1: document.querySelector('h1')?.innerText || null,
        mainText: (main?.innerText || document.body.innerText || '').slice(0, 1800),
        viewport: { w: window.innerWidth, h: window.innerHeight },
        scrollWidth: document.documentElement.scrollWidth,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        interactive: interactive.length,
        unnamed,
        buttons: [...document.querySelectorAll('button')].slice(0, 60).map((b) => ({
          t: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
          title: b.getAttribute('title'),
          aria: b.getAttribute('aria-label'),
        })),
      };
    });
    report.steps.push({ label, ...data });
    return data;
  }

  async function clickButtonText(text, exact = false) {
    return page.evaluate(
      (text, exact) => {
        const buttons = [...document.querySelectorAll('button')];
        const b = buttons.find((x) => {
          const t = (x.innerText || '').replace(/\s+/g, ' ').trim();
          return exact ? t === text : t.includes(text);
        });
        if (!b) return false;
        b.click();
        return true;
      },
      text,
      exact,
    );
  }

  async function clickNav(label) {
    const ok = await page.evaluate((label) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('title') === label);
      if (!b) return false;
      b.click();
      return true;
    }, label);
    await sleep(1400);
    return ok;
  }

  async function closeOverlay() {
    await page.keyboard.press('Escape');
    await sleep(400);
    // click backdrop if a dialog is still open
    await page.evaluate(() => {
      const overlay = document.querySelector('[data-slot="dialog-overlay"], [role="presentation"]');
      if (overlay) overlay.click();
    }).catch(() => {});
    await sleep(300);
  }

  // ── 1. LOGIN ──────────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(800);
  await shot('01-login');
  await snapshot('login');

  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  report.steps.push({ label: 'login-body-bg', bg });

  await page.type('input[type="email"]', 'hr-admin@company.com', { delay: 10 });
  await page.type('input[type="password"]', 'Admin@123', { delay: 10 });
  await clickButtonText('Đăng nhập', true);

  await page.waitForFunction(() => document.body.innerText.includes('Bảng Điều Hành'), { timeout: 30000 }).catch(() => {});
  await sleep(2500);
  await page.evaluate(() => document.fonts.ready);
  await shot('02-dashboard', true);
  await snapshot('dashboard');

  // ── 2. GLOBAL SEARCH ──────────────────────────────────────────────────────
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyK');
  await page.keyboard.up('Control');
  await sleep(500);
  await shot('03-search-modal');
  const searchVisible = await page.evaluate(() => document.body.innerText.includes('Tìm trang, nhân viên, chức năng'));
  report.steps.push({ label: 'search-modal-visible', searchVisible });
  if (searchVisible) {
    await page.keyboard.type('lương', { delay: 30 });
    await sleep(500);
    await shot('04-search-results');
  }
  await closeOverlay();

  // ── 3. DASHBOARD INTERACTION ─────────────────────────────────────────────
  const openedLeave = await clickButtonText('Xem & Duyệt');
  await sleep(900);
  await shot('05-dashboard-leave-modal');
  report.steps.push({ label: 'dashboard-leave-modal-opened', openedLeave });
  await closeOverlay();

  // ── 4. EMPLOYEES ─────────────────────────────────────────────────────────
  report.steps.push({ label: 'nav-employees', ok: await clickNav('Hồ Sơ Nhân Sự') });
  await sleep(1200);
  await shot('06-employees');
  await snapshot('employees');

  const searchInput = await page.$('input[placeholder*="Tìm theo tên"]');
  if (searchInput) {
    await searchInput.type('Nguyễn', { delay: 25 });
    await sleep(1200);
    await shot('07-employees-search');
    await searchInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await sleep(800);
  }

  const rowOpened = await page.evaluate(() => {
    const row = document.querySelector('tbody tr');
    if (!row) return false;
    row.click();
    return true;
  });
  await sleep(1200);
  await shot('08-employees-profile-drawer');
  report.steps.push({ label: 'employee-row-opened', rowOpened });
  await closeOverlay();

  // leave approvals tab
  const tabLeave = await clickButtonText('Duyệt Đơn');
  await sleep(1200);
  await shot('09-employees-leave-tab');
  report.steps.push({ label: 'leave-tab-opened', tabLeave });

  // ── 5. PAYROLL ───────────────────────────────────────────────────────────
  report.steps.push({ label: 'nav-payroll', ok: await clickNav('Bảng Lương & Thuế') });
  await sleep(1800);
  await shot('10-payroll', true);
  await snapshot('payroll');

  const policyOpened = await clickButtonText('Xem quy chế lương');
  await sleep(900);
  await shot('11-payroll-policy-dialog');
  report.steps.push({ label: 'payroll-policy-opened', policyOpened });
  await closeOverlay();

  // ── 6. AI AGENTS ─────────────────────────────────────────────────────────
  report.steps.push({ label: 'nav-ai', ok: await clickNav('Trợ Lý AI') });
  await sleep(1800);
  await shot('12-ai-agents');
  await snapshot('ai-agents');

  const wf02 = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('HR QA'));
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(1200);
  await shot('13-ai-wf02');
  report.steps.push({ label: 'wf02-selected', wf02 });

  const specsTab = await clickButtonText('Thông số kỹ thuật');
  await sleep(800);
  await shot('14-ai-specs');
  report.steps.push({ label: 'specs-tab', specsTab });

  // ── 7. CSKH ──────────────────────────────────────────────────────────────
  report.steps.push({ label: 'nav-cskh', ok: await clickNav('Tiếp Quản CSKH & PII') });
  await sleep(1800);
  await shot('15-cskh');
  await snapshot('cskh');

  const conv = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Chờ tiếp quản|Tất cả/.test(x.innerText || ''));
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(600);
  await shot('16-cskh-filter');
  report.steps.push({ label: 'cskh-filter', conv });

  // ── 8. TRAINING ──────────────────────────────────────────────────────────
  report.steps.push({ label: 'nav-training', ok: await clickNav('Đào Tạo & Radar AI') });
  await sleep(1500);
  await shot('17-training', true);
  await snapshot('training');

  // ── 9. EMPLOYEE PORTAL (admin view) ──────────────────────────────────────
  report.steps.push({ label: 'nav-portal', ok: await clickNav('Cổng Nhân Viên') });
  await sleep(1800);
  await shot('18-portal-admin', true);
  await snapshot('portal-admin');

  const leaveModal = await clickButtonText('Tạo Đơn Mới');
  await sleep(900);
  await shot('19-portal-leave-modal');
  report.steps.push({ label: 'portal-leave-modal', leaveModal });
  await closeOverlay();

  // ── 10. SETTINGS ─────────────────────────────────────────────────────────
  report.steps.push({ label: 'nav-settings', ok: await clickNav('Cài Đặt Hệ Thống') });
  await sleep(1500);
  await shot('20-settings', true);
  await snapshot('settings');

  const integrations = await clickButtonText('Tích Hợp', true);
  await sleep(1200);
  await shot('21-settings-integrations');
  report.steps.push({ label: 'settings-integrations', integrations });

  const security = await clickButtonText('Bảo Mật & Phiên', true);
  await sleep(1200);
  await shot('22-settings-security');
  report.steps.push({ label: 'settings-security', security });

  // ── 11. LOGOUT → EMPLOYEE ────────────────────────────────────────────────
  const logout = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('title') === 'Đăng xuất');
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(1800);
  await shot('23-logout-login');
  report.steps.push({ label: 'logout', logout });

  await page.waitForSelector('input[type="email"]', { timeout: 15000 }).catch(() => {});
  await page.type('input[type="email"]', 'employee1@company.com', { delay: 10 });
  await page.type('input[type="password"]', 'Employee@123', { delay: 10 });
  await clickButtonText('Đăng nhập', true);
  await page.waitForFunction(() => document.body.innerText.includes('Bàn Làm Việc Cá Nhân'), { timeout: 30000 }).catch(() => {});
  await sleep(2500);
  await shot('24-portal-employee', true);
  await snapshot('portal-employee');

  // calendar day popover
  const calDay = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('button')].filter((b) => /^\d{1,2}$/.test((b.innerText || '').trim()));
    const b = cells[Math.min(14, cells.length - 1)];
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(800);
  await shot('25-portal-calendar-popover');
  report.steps.push({ label: 'calendar-popover', calDay });
  await closeOverlay();

  // ── 12. EMPLOYEE TRAINING + AI ───────────────────────────────────────────
  report.steps.push({ label: 'nav-my-training', ok: await clickNav('Kết Quả Đào Tạo') });
  await sleep(1500);
  await shot('26-my-training', true);
  await snapshot('my-training');

  report.steps.push({ label: 'nav-ai-employee', ok: await clickNav('Trợ Lý AI') });
  await sleep(1500);
  await shot('27-ai-employee');
  await snapshot('ai-employee');

  // ── 13. MOBILE ───────────────────────────────────────────────────────────
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(1000);
  await shot('28-mobile-ai');
  await snapshot('mobile-ai');

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, '..', 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log('DONE', OUT);
}

main().catch(async (e) => {
  console.error('FAILED', e);
  report.error = String(e && e.stack ? e.stack : e);
  fs.mkdirSync(path.join(OUT, '..'), { recursive: true });
  fs.writeFileSync(path.join(OUT, '..', 'report.json'), JSON.stringify(report, null, 2));
  process.exit(1);
});
