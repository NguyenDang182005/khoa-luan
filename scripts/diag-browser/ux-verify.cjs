/* Verify the fixes against the running app. Read-only. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const OUT = path.resolve(__dirname, '..', '..', '.tmp-ui-audit', 'verify');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  async function shot(name) {
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  }
  async function login(email, password) {
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', email, { delay: 5 });
    await page.type('input[type="password"]', password, { delay: 5 });
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Đăng nhập'));
      if (b) b.click();
    });
    await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 30000 });
    await sleep(2600);
  }
  async function nav(label) {
    await page.evaluate((label) => {
      const b = [...document.querySelectorAll('aside nav button')].find((x) => (x.innerText || '').trim() === label);
      if (b) b.click();
    }, label);
    await sleep(1800);
  }

  // LOGIN
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.waitForSelector('input[type="email"]');
  await sleep(500);
  await shot('01-login');
  out.login = await page.evaluate(() => ({
    forgot: document.body.innerText.includes('Quên mật khẩu'),
    demoEmails: [...document.querySelectorAll('main span')].map((s) => s.textContent).filter((t) => t.includes('@company.com')),
  }));

  await page.type('input[type="email"]', 'hr-admin@company.com', { delay: 5 });
  await page.type('input[type="password"]', 'Admin@123', { delay: 5 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Đăng nhập'));
    if (b) b.click();
  });
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 30000 });
  await sleep(2600);

  // DASHBOARD
  await shot('02-dashboard');
  out.dashboard = await page.evaluate(() => {
    const txt = document.querySelector('main')?.innerText || '';
    const cards = [...document.querySelectorAll('main .rounded-xl')].slice(0, 4).map((c) => c.innerText.replace(/\s+/g, ' ').trim());
    const donut = [...document.querySelectorAll('main .tabular')].map((e) => e.textContent.trim());
    return { cards, donut, hasPrefixCurrency: /\u20ab\s?0/.test(txt), text: txt.slice(0, 500) };
  });

  // GLOBAL SEARCH EMPLOYEE
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyK');
  await page.keyboard.up('Control');
  await sleep(400);
  await page.keyboard.type('Nguyễn', { delay: 30 });
  await sleep(1400);
  await shot('03-search-employee');
  out.search = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"][aria-label="Tìm kiếm nhanh"]');
    return modal ? { text: modal.innerText.replace(/\s+/g, ' ').trim().slice(0, 500), buttons: [...modal.querySelectorAll('button')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()) } : null;
  });
  const picked = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"][aria-label="Tìm kiếm nhanh"]');
    const b = modal ? [...modal.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Nguyễn Văn Dang')) : null;
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(1800);
  await shot('04-employees-filtered');
  out.searchPicked = picked;
  out.employeesFiltered = await page.evaluate(() => ({
    searchValue: document.querySelector('input[placeholder*="Tìm theo tên"]')?.value,
    text: document.querySelector('main')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 350),
  }));

  // RESPONSIVE EMPLOYEES
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await sleep(900);
  await shot('05-employees-1024');
  out.employees1024 = await page.evaluate(() => {
    const main = document.querySelector('main');
    const table = document.querySelector('table');
    return {
      mainClient: main?.clientWidth, mainScroll: main?.scrollWidth,
      tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
      bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      addButtonVisible: [...document.querySelectorAll('button')].some((b) => (b.innerText || '').includes('Thêm nhân viên') && b.getBoundingClientRect().right <= innerWidth),
    };
  });
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(900);
  await shot('06-employees-375');
  out.employees375 = await page.evaluate(() => {
    const table = document.querySelector('table');
    return {
      tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
      visibleHeaders: [...document.querySelectorAll('thead th')].filter((th) => getComputedStyle(th).display !== 'none').map((th) => th.innerText),
      bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });

  // PAYROLL
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await sleep(700);
  await nav('Bảng lương & thuế');
  await shot('07-payroll');
  out.payroll = await page.evaluate(() => ({
    text: document.querySelector('main')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 500),
    hasPrefixCurrency: /\u20ab\s?0/.test(document.querySelector('main')?.innerText || ''),
  }));
  const calcOpened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === 'Tính lương');
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(600);
  await shot('08-payroll-confirm');
  out.calcOpened = calcOpened;
  await page.keyboard.press('Escape');
  await sleep(400);

  // AI AGENTS
  await nav('Trợ lý AI');
  await shot('09-ai-agents');
  out.ai = await page.evaluate(() => {
    const main = document.querySelector('main');
    const text = main?.innerText.replace(/\s+/g, ' ').trim() || '';
    const ta = main?.querySelector('textarea');
    const send = main?.querySelector('button[aria-label="Gửi tin nhắn"]');
    const taBox = ta?.closest('div')?.parentElement?.getBoundingClientRect();
    const sendBox = send?.getBoundingClientRect();
    return {
      text: text.slice(0, 500),
      stats: text.match(/Tỷ lệ thành công.*?Số cuộc gọi.*?(\d+)/)?.[1],
      sendInsideComposer: !!(taBox && sendBox && sendBox.top >= taBox.top && sendBox.bottom <= taBox.bottom + 1),
      sendBox: sendBox ? { top: Math.round(sendBox.top), bottom: Math.round(sendBox.bottom), right: Math.round(sendBox.right) } : null,
    };
  });

  // CSKH
  await nav('Tiếp quản CSKH');
  await sleep(1200);
  await shot('10-cskh-chat');
  out.cskh = await page.evaluate(() => {
    const text = document.querySelector('main')?.innerText || '';
    return { rawStars: (text.match(/\*\*/g) || []).length, strong: document.querySelectorAll('main strong').length, sample: text.slice(text.indexOf('Về gói Pro') - 20, text.indexOf('Về gói Pro') + 160) };
  });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role="tab"]')].find((x) => (x.innerText || '').includes('Nhật ký PII'));
    if (b) b.click();
  });
  await sleep(800);
  await shot('11-cskh-pii');
  out.pii = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tbody tr')];
    const first = rows[0];
    return {
      rows: rows.length,
      firstRowText: first ? first.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null,
      firstRowHeight: first ? Math.round(first.getBoundingClientRect().height) : null,
    };
  });

  // PORTAL + PROGRESS + LEAVE MODAL
  await nav('Cổng nhân viên');
  await sleep(1500);
  await shot('12-portal');
  out.portal = await page.evaluate(() => {
    const bar = document.querySelector('[role="progressbar"]');
    const card = [...document.querySelectorAll('main *')].find((e) => e.textContent?.trim() === 'Phép năm còn lại')?.closest('.rounded-xl');
    return {
      leaveCard: card?.innerText.replace(/\s+/g, ' ').trim(),
      ariaNow: bar?.getAttribute('aria-valuenow'),
      ariaMax: bar?.getAttribute('aria-valuemax'),
      fillWidth: bar?.firstElementChild ? Math.round(bar.firstElementChild.getBoundingClientRect().width) : null,
      barWidth: bar ? Math.round(bar.getBoundingClientRect().width) : null,
      greeting: document.querySelector('h1')?.innerText,
    };
  });
  const leaveOpen = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Tạo đơn mới'));
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(700);
  await shot('13-leave-modal');
  out.leaveModal = await page.evaluate(() => ({ open: !!document.querySelector('[role="dialog"]'), text: document.querySelector('[role="dialog"]')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 450) }));
  out.leaveOpen = leaveOpen;
  await page.keyboard.press('Escape');
  await sleep(400);

  // SETTINGS
  await nav('Cài đặt');
  await shot('14-settings');
  out.settings = await page.evaluate(() => {
    const text = document.querySelector('main')?.innerText || '';
    return { hasOldHint: text.includes('11.000.000'), hasNewHint: text.includes('15.500.000'), text: text.slice(0, 300) };
  });

  // EMPLOYEE: MY TRAINING CTA
  await page.evaluate(() => { const b = document.querySelector('button[aria-haspopup="menu"]'); if (b) b.click(); });
  await sleep(250);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button[role="menuitem"]')].find((x) => (x.innerText || '').includes('Đăng xuất')); if (b) b.click(); });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', 'employee1@company.com', { delay: 5 });
  await page.type('input[type="password"]', 'Employee@123', { delay: 5 });
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Đăng nhập')); if (b) b.click(); });
  await page.waitForFunction(() => document.body.innerText.includes('Cổng nhân viên'), { timeout: 30000 });
  await sleep(2400);
  await nav('Kết quả đào tạo');
  await shot('15-my-training');
  out.myTraining = await page.evaluate(() => ({
    cta: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter((t) => t.includes('Bắt đầu')),
  }));
  const start = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Bắt đầu đánh giá mới'));
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(1500);
  await shot('16-ai-wf03');
  out.startTraining = { clicked: start, header: await page.evaluate(() => document.querySelector('main')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 200)) };

  // MOBILE FAB
  await nav('Cổng nhân viên');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(900);
  await shot('17-mobile-portal');
  out.mobileFab = await page.evaluate(() => {
    const fab = [...document.querySelectorAll('button')].find((b) => getComputedStyle(b).position === 'fixed' && b.getBoundingClientRect().right > innerWidth - 90);
    return fab ? { z: getComputedStyle(fab).zIndex, box: fab.getBoundingClientRect().toJSON() } : null;
  });
  await page.evaluate(() => { const b = document.querySelector('button[aria-label="Mở menu điều hướng"]'); if (b) b.click(); });
  await sleep(500);
  await shot('18-mobile-nav');
  out.mobileNav = await page.evaluate(() => {
    const fab = [...document.querySelectorAll('button')].find((b) => getComputedStyle(b).position === 'fixed' && b.getBoundingClientRect().right > innerWidth - 90);
    const overlay = document.querySelector('.fixed.inset-0');
    return { fabZ: fab ? getComputedStyle(fab).zIndex : null, overlayZ: overlay ? getComputedStyle(overlay).zIndex : null };
  });

  out.errors = errors;
  fs.writeFileSync(path.join(OUT, 'verify.json'), JSON.stringify(out, null, 2));
  await browser.close();
  console.log('DONE');
}
main().catch((e) => {
  console.error('FAILED', e);
  out.error = String(e.stack || e);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'verify.json'), JSON.stringify(out, null, 2));
  process.exit(1);
});
