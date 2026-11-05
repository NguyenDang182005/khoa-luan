/* Contrast, breakpoints and error-state probes. Read-only. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const OUT = path.resolve(__dirname, '..', '..', '.tmp-ui-audit', 'probe3');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
    defaultViewport: { width: 1366, height: 768 },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  async function login() {
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'hr-admin@company.com', { delay: 5 });
    await page.type('input[type="password"]', 'Admin@123', { delay: 5 });
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Đăng nhập'));
      if (b) b.click();
    });
    await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 30000 });
    await sleep(2500);
  }

  async function nav(label) {
    await page.evaluate((label) => {
      const b = [...document.querySelectorAll('aside nav button')].find((x) => (x.innerText || '').trim() === label);
      if (b) b.click();
    }, label);
    await sleep(1500);
  }

  function contrastScript() {
    function lum(rgb) {
      const [r, g, b] = rgb.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    function parse(c) {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
    }
    function bg(el) {
      let cur = el;
      while (cur) {
        const c = parse(getComputedStyle(cur).backgroundColor);
        if (c && c.a > 0.95) return c;
        cur = cur.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    }
    const samples = [
      ['sidebar-group', 'aside nav p'],
      ['page-subtitle', 'main p.text-body.text-muted-foreground'],
      ['table-header', 'thead th'],
      ['helper-text', 'main p.text-caption.text-muted-foreground'],
      ['primary-button', 'main button.bg-primary'],
      ['status-badge', 'main [class*="badge"]'],
    ];
    const res = {};
    for (const [name, sel] of samples) {
      const el = document.querySelector(sel);
      if (!el) { res[name] = null; continue; }
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      const b = bg(el);
      const l1 = lum([fg.r, fg.g, fg.b]);
      const l2 = lum([b.r, b.g, b.b]);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      res[name] = {
        text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        color: cs.color,
        bg: `rgb(${b.r}, ${b.g}, ${b.b})`,
        size: cs.fontSize,
        weight: cs.fontWeight,
        ratio: Math.round(ratio * 100) / 100,
      };
    }
    return res;
  }

  await login();
  out.contrast1366 = await page.evaluate(contrastScript);
  await page.screenshot({ path: path.join(OUT, '01-dashboard-1366.png') });

  await nav('Hồ sơ nhân sự');
  out.employees1366 = await page.evaluate(() => {
    const main = document.querySelector('main');
    const table = document.querySelector('table');
    return {
      viewport: innerWidth,
      mainClient: main?.clientWidth,
      mainScroll: main?.scrollWidth,
      tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
      bodyScroll: document.documentElement.scrollWidth,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  await page.screenshot({ path: path.join(OUT, '02-employees-1366.png') });

  for (const [w, h, name] of [[1024, 768, '03-employees-1024'], [768, 1024, '04-employees-768'], [375, 812, '05-employees-375']]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 768, hasTouch: w < 768 });
    await sleep(800);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    out[`employees_${w}`] = await page.evaluate(() => {
      const main = document.querySelector('main');
      const table = document.querySelector('table');
      return {
        viewport: innerWidth,
        mainClient: main?.clientWidth,
        mainScroll: main?.scrollWidth,
        tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
        bodyScroll: document.documentElement.scrollWidth,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        sidebarVisible: (() => { const a = document.querySelector('aside'); if (!a) return false; const r = a.getBoundingClientRect(); return r.width > 0 && r.left >= 0; })(),
      };
    });
  }

  // login error state
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    const b = document.querySelector('button[aria-haspopup="menu"]');
    if (b) b.click();
  });
  await sleep(300);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button[role="menuitem"]')].find((x) => (x.innerText || '').includes('Đăng xuất'));
    if (b) b.click();
  });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', 'hr-admin@company.com', { delay: 5 });
  await page.type('input[type="password"]', 'sai-mat-khau', { delay: 5 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Đăng nhập'));
    if (b) b.click();
  });
  await sleep(2500);
  await page.screenshot({ path: path.join(OUT, '06-login-error.png') });
  out.loginError = await page.evaluate(() => ({
    text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 500),
    alerts: [...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText),
  }));

  fs.writeFileSync(path.join(OUT, 'probe3.json'), JSON.stringify(out, null, 2));
  await browser.close();
  console.log('DONE');
}

main().catch((e) => {
  console.error('FAILED', e);
  out.error = String(e.stack || e);
  fs.writeFileSync(path.join(OUT, 'probe3.json'), JSON.stringify(out, null, 2));
  process.exit(1);
});
