/* Real-user UX walkthrough v2 — light theme currently served at :3000.
 * Read-only: opens dialogs/drawers/tabs but never submits a mutation.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const ROOT = path.resolve(__dirname, '..', '..', '.tmp-ui-audit');
const OUT = path.join(ROOT, 'shots2');
fs.mkdirSync(OUT, { recursive: true });

const report = { startedAt: new Date().toISOString(), steps: [], console: [], requestsFailed: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none', '--force-device-scale-factor=1'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') report.console.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => report.console.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => {
    const f = r.failure();
    report.requestsFailed.push(`${r.url()} :: ${f ? f.errorText : 'unknown'}`);
  });

  async function shot(name) {
    await page.addStyleTag({
      content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}',
    }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
    report.steps.push({ type: 'shot', name, at: new Date().toISOString() });
  }

  async function snap(label) {
    const data = await page.evaluate(() => {
      const main = document.querySelector('main');
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      return {
        h1: clean(document.querySelector('h1')?.innerText),
        headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).map((e) => clean(e.innerText)).slice(0, 24),
        buttons: [...document.querySelectorAll('button')].filter(visible).map((b) => clean(b.innerText) || b.getAttribute('aria-label') || b.getAttribute('title')).filter(Boolean).slice(0, 50),
        tableHeaders: [...document.querySelectorAll('thead th')].filter(visible).map((e) => clean(e.innerText)).slice(0, 20),
        rowCount: document.querySelectorAll('tbody tr').length,
        emptyStates: [...document.querySelectorAll('*')].filter((e) => visible(e) && /Chưa có|Không tìm thấy|Không có|Trống|chưa có/.test(e.textContent || '') && e.children.length === 0).map((e) => clean(e.textContent)).slice(0, 8),
        viewport: { w: window.innerWidth, h: window.innerHeight },
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        mainScroll: main ? { top: main.scrollTop, height: main.scrollHeight, client: main.clientHeight } : null,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        font: getComputedStyle(document.body).fontFamily,
        unnamedControls: [...document.querySelectorAll('button,a,input,select,textarea')].filter(visible).filter((el) => {
          const n = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.getAttribute('placeholder') || '').trim();
          return !n;
        }).length,
        mainText: clean(main?.innerText).slice(0, 2200),
      };
    });
    report.steps.push({ type: 'snap', label, ...data });
    return data;
  }

  async function nav(label) {
    const ok = await page.evaluate((label) => {
      const b = [...document.querySelectorAll('aside nav button')].find(
        (x) => (x.innerText || '').replace(/\s+/g, ' ').trim() === label,
      );
      if (!b) return false;
      b.click();
      return true;
    }, label);
    await sleep(1700);
    return ok;
  }

  async function clickText(text, selector = 'button,[role="tab"],a') {
    const ok = await page.evaluate(
      (text, selector) => {
        const els = [...document.querySelectorAll(selector)];
        const b = els.find((x) => (x.innerText || '').replace(/\s+/g, ' ').trim().includes(text));
        if (!b) return false;
        b.click();
        return true;
      },
      text,
      selector,
    );
    await sleep(900);
    return ok;
  }

  async function scroll(y) {
    await page.evaluate((y) => {
      const m = document.querySelector('main');
      if (m) m.scrollTop = y;
      else window.scrollTo(0, y);
    }, y);
    await sleep(600);
  }

  async function close() {
    await page.keyboard.press('Escape');
    await sleep(350);
    await page.keyboard.press('Escape');
    await sleep(500);
  }

  // ── LOGIN ────────────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(700);
  await shot('01-login');
  await snap('login');

  await page.type('input[type="email"]', 'hr-admin@company.com', { delay: 8 });
  await page.type('input[type="password"]', 'Admin@123', { delay: 8 });
  await clickText('Đăng nhập', 'button');
  await page.waitForFunction(() => document.body.innerText.includes('Bảng điều hành'), { timeout: 30000 }).catch(() => {});
  await sleep(2600);

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  await shot('02-dashboard-top');
  const dash = await snap('dashboard-top');
  const kpi = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('main .rounded-xl')].slice(0, 8);
    return cards.map((c) => ({
      text: (c.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160),
      w: Math.round(c.getBoundingClientRect().width),
      h: Math.round(c.getBoundingClientRect().height),
    }));
  });
  report.steps.push({ type: 'kpi-cards', cards: kpi });
  await scroll(560);
  await shot('03-dashboard-mid');
  await scroll(1400);
  await shot('04-dashboard-bottom');
  await scroll(0);

  // search
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyK');
  await page.keyboard.up('Control');
  await sleep(500);
  await shot('05-search-modal');
  await page.keyboard.type('lương', { delay: 25 });
  await sleep(600);
  await shot('06-search-results');
  await close();

  // pending leave modal (read-only)
  const leaveOpen = await clickText('Xem & duyệt', 'button');
  await shot('07-leave-modal');
  report.steps.push({ type: 'action', label: 'open-pending-leave', ok: leaveOpen });
  await close();

  // ── EMPLOYEES ────────────────────────────────────────────────────────────
  report.steps.push({ type: 'action', label: 'nav-employees', ok: await nav('Hồ sơ nhân sự') });
  await shot('08-employees-top');
  await snap('employees-top');
  await scroll(500);
  await shot('09-employees-table');
  await scroll(0);

  const search = await page.$('input[placeholder*="Tìm theo tên"]');
  if (search) {
    await search.type('Nguyễn', { delay: 20 });
    await sleep(1200);
    await shot('10-employees-search');
    await search.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await sleep(800);
  }

  const rowOpen = await page.evaluate(() => {
    const row = document.querySelector('tbody tr');
    if (!row) return false;
    row.click();
    return true;
  });
  await sleep(1200);
  await shot('11-employee-drawer');
  report.steps.push({ type: 'action', label: 'open-employee-row', ok: rowOpen });
  await snap('employee-drawer');
  await close();

  report.steps.push({ type: 'action', label: 'tab-leave', ok: await clickText('Duyệt đơn', '[role="tab"]') });
  await shot('12-leave-approvals');
  await snap('leave-approvals');

  report.steps.push({ type: 'action', label: 'tab-onboarding', ok: await clickText('Lộ trình hội nhập', '[role="tab"]') });
  await shot('13-onboarding');
  await snap('onboarding');

  // ── PAYROLL ──────────────────────────────────────────────────────────────
  report.steps.push({ type: 'action', label: 'nav-payroll', ok: await nav('Bảng lương & thuế') });
  await shot('14-payroll-top');
  await snap('payroll-top');
  await scroll(600);
  await shot('15-payroll-table');
  await scroll(0);

  const policy = await clickText('Xem quy chế lương', 'button');
  await shot('16-payroll-policy');
  report.steps.push({ type: 'action', label: 'open-payroll-policy', ok: policy });
  await close();

  // ── AI AGENTS ────────────────────────────────────────────────────────────
  report.steps.push({ type: 'action', label: 'nav-ai', ok: await nav('Trợ lý AI') });
  await shot('17-ai-top');
  await snap('ai-top');

  const wf02 = await page.evaluate(() => {
    const b = [...document.querySelectorAll('aside button')].find((x) => (x.innerText || '').includes('HR QA'));
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(1200);
  await shot('18-ai-wf02');
  report.steps.push({ type: 'action', label: 'select-wf02', ok: wf02 });

  report.steps.push({ type: 'action', label: 'ai-specs', ok: await clickText('Thông số kỹ thuật', '[role="tab"]') });
  await shot('19-ai-specs');
  await snap('ai-specs');

  report.steps.push({ type: 'action', label: 'ai-audit', ok: await clickText('Audit', '[role="tab"]') });
  await shot('20-ai-audit');
  await snap('ai-audit');

  // ── CSKH ─────────────────────────────────────────────────────────────────
  report.steps.push({ type: 'action', label: 'nav-cskh', ok: await nav('Tiếp quản CSKH') });
  await shot('21-cskh-top');
  await snap('cskh-top');

  report.steps.push({ type: 'action', label: 'cskh-pii', ok: await clickText('Nhật ký PII Masking', '[role="tab"]') });
  await shot('22-cskh-pii');
  await snap('cskh-pii');

  // ── TRAINING ─────────────────────────────────────────────────────────────
  report.steps.push({ type: 'action', label: 'nav-training', ok: await nav('Đào tạo & Radar AI') });
  await shot('23-training-top');
  await snap('training-top');
  await scroll(600);
  await shot('24-training-mid');
  await scroll(0);

  // ── PORTAL (admin) ───────────────────────────────────────────────────────
  report.steps.push({ type: 'action', label: 'nav-portal', ok: await nav('Cổng nhân viên') });
  await shot('25-portal-top');
  await snap('portal-top');
  await scroll(600);
  await shot('26-portal-calendar');
  await scroll(0);

  const leaveModal = await clickText('Tạo đơn mới', 'button');
  await shot('27-portal-leave-modal');
  report.steps.push({ type: 'action', label: 'open-portal-leave', ok: leaveModal });
  await close();

  const payslip = await clickText('Xem chi tiết', 'button');
  await shot('28-portal-payslip');
  report.steps.push({ type: 'action', label: 'open-payslip', ok: payslip });
  await close();

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  report.steps.push({ type: 'action', label: 'nav-settings', ok: await nav('Cài đặt') });
  await shot('29-settings-salary');
  await snap('settings-salary');

  report.steps.push({ type: 'action', label: 'settings-integrations', ok: await clickText('Tích hợp', 'button') });
  await shot('30-settings-integrations');
  await snap('settings-integrations');

  report.steps.push({ type: 'action', label: 'settings-security', ok: await clickText('Bảo mật & phiên', 'button') });
  await shot('31-settings-security');
  await snap('settings-security');

  report.steps.push({ type: 'action', label: 'settings-audit', ok: await clickText('Nhật ký thay đổi', 'button') });
  await shot('32-settings-audit');
  await snap('settings-audit');

  // ── USER MENU + EMPLOYEE ─────────────────────────────────────────────────
  const menu = await page.evaluate(() => {
    const b = document.querySelector('button[aria-haspopup="menu"]');
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(500);
  await shot('33-user-menu');

  const logout = await clickText('Đăng xuất', 'button[role="menuitem"]');
  await sleep(1600);
  report.steps.push({ type: 'action', label: 'logout', ok: logout });

  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', 'employee1@company.com', { delay: 8 });
  await page.type('input[type="password"]', 'Employee@123', { delay: 8 });
  await clickText('Đăng nhập', 'button');
  await page.waitForFunction(() => document.body.innerText.includes('Bàn làm việc') || document.body.innerText.includes('Cổng nhân viên'), { timeout: 30000 }).catch(() => {});
  await sleep(2400);
  await shot('34-employee-portal');
  await snap('employee-portal');
  await scroll(600);
  await shot('35-employee-portal-lower');
  await scroll(0);

  report.steps.push({ type: 'action', label: 'nav-my-training', ok: await nav('Kết quả đào tạo') });
  await shot('36-my-training');
  await snap('my-training');

  report.steps.push({ type: 'action', label: 'nav-ai-employee', ok: await nav('Trợ lý AI') });
  await shot('37-employee-ai');
  await snap('employee-ai');

  // ── MOBILE ───────────────────────────────────────────────────────────────
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(1200);
  await shot('38-mobile-portal');
  await snap('mobile-portal');

  const mobileMenu = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Mở menu điều hướng"]');
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(600);
  await shot('39-mobile-nav');
  report.steps.push({ type: 'action', label: 'open-mobile-nav', ok: mobileMenu });

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(ROOT, 'report2.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log('DONE', OUT);
}

main().catch(async (e) => {
  console.error('FAILED', e);
  report.error = String(e && e.stack ? e.stack : e);
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'report2.json'), JSON.stringify(report, null, 2));
  process.exit(1);
});
