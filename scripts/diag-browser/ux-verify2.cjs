const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const OUT = path.resolve(__dirname, '..', '..', '.tmp-ui-audit', 'verify2');
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

  async function login(email, password) {
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', email, { delay: 5 });
    await page.type('input[type="password"]', password, { delay: 5 });
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Đăng nhập')); if (b) b.click(); });
    await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 30000 });
    await sleep(2500);
  }
  async function nav(label) {
    await page.evaluate((label) => { const b = [...document.querySelectorAll('aside nav button')].find((x) => (x.innerText || '').trim() === label); if (b) b.click(); }, label);
    await sleep(1600);
  }

  await login('hr-admin@company.com', 'Admin@123');
  await page.screenshot({ path: path.join(OUT, '01-login-after.png') });

  // mobile employees (navigate after resize)
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(800);
  await nav('Hồ sơ nhân sự');
  await page.screenshot({ path: path.join(OUT, '02-employees-375.png') });
  out.employees375 = await page.evaluate(() => {
    const table = document.querySelector('table');
    return {
      h1: document.querySelector('h1')?.innerText,
      tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
      headers: [...document.querySelectorAll('thead th')].filter((th) => getComputedStyle(th).display !== 'none').map((th) => th.innerText),
      bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      tabs: [...document.querySelectorAll('[role="tab"]')].map((t) => ({ text: t.innerText, right: Math.round(t.getBoundingClientRect().right) })),
    };
  });

  // AI composer at desktop
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await sleep(700);
  await nav('Trợ lý AI');
  await page.evaluate(() => { const b = [...document.querySelectorAll('aside button')].find((x) => (x.innerText || '').includes('HR Policy')); if (b) b.click(); });
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT, '03-ai-wf02.png') });
  out.composer = await page.evaluate(() => {
    const ta = document.querySelector('main textarea');
    const send = document.querySelector('main button[aria-label="Gửi tin nhắn"]');
    const container = ta?.closest('form')?.querySelector('div');
    const c = container?.getBoundingClientRect();
    const s = send?.getBoundingClientRect();
    return {
      hasTextarea: !!ta,
      hasSend: !!send,
      container: c ? { top: Math.round(c.top), bottom: Math.round(c.bottom), right: Math.round(c.right) } : null,
      send: s ? { top: Math.round(s.top), bottom: Math.round(s.bottom), right: Math.round(s.right) } : null,
      inside: !!(c && s && s.top >= c.top && s.bottom <= c.bottom && s.right <= c.right + 1),
    };
  });

  // PII table badge fit
  await nav('Tiếp quản CSKH');
  await page.evaluate(() => { const b = [...document.querySelectorAll('[role="tab"]')].find((x) => (x.innerText || '').includes('Nhật ký PII')); if (b) b.click(); });
  await sleep(900);
  await page.screenshot({ path: path.join(OUT, '04-pii.png') });
  out.pii = await page.evaluate(() => {
    const table = document.querySelector('table');
    const card = table?.closest('.rounded-xl') ?? table?.closest('div');
    const lastBadge = [...document.querySelectorAll('tbody tr:first-child td:last-child .badge, tbody tr:first-child td:last-child span')].pop();
    return {
      tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
      cardW: card ? Math.round(card.getBoundingClientRect().width) : null,
      lastCellText: document.querySelector('tbody tr:first-child td:last-child')?.innerText,
    };
  });

  // login demo after view (logout)
  await page.evaluate(() => { const b = document.querySelector('button[aria-haspopup="menu"]'); if (b) b.click(); });
  await sleep(250);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button[role="menuitem"]')].find((x) => (x.innerText || '').includes('Đăng xuất')); if (b) b.click(); });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, '05-login.png') });
  out.login = await page.evaluate(() => ({
    demoText: [...document.querySelectorAll('main button span')].map((s) => s.textContent).filter((t) => t.includes('@')),
    cardWidths: [...document.querySelectorAll('main .grid > button')].map((b) => Math.round(b.getBoundingClientRect().width)),
  }));

  fs.writeFileSync(path.join(OUT, 'verify2.json'), JSON.stringify(out, null, 2));
  await browser.close();
  console.log('DONE');
}
main().catch((e) => {
  console.error('FAILED', e);
  out.error = String(e.stack || e);
  fs.writeFileSync(path.join(OUT, 'verify2.json'), JSON.stringify(out, null, 2));
  process.exit(1);
});
