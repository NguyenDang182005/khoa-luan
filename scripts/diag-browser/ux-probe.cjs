/* Targeted probes for the issues seen in the walkthrough. Read-only. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const ROOT = path.resolve(__dirname, '..', '..', '.tmp-ui-audit');
const OUT = path.join(ROOT, 'probe');
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
  page.on('console', (m) => {
    if (m.type() === 'error') (out.consoleErrors ||= []).push(m.text());
  });

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
    await sleep(2500);
  }

  async function nav(label) {
    const ok = await page.evaluate((label) => {
      const b = [...document.querySelectorAll('aside nav button')].find((x) => (x.innerText || '').trim() === label);
      if (!b) return false;
      b.click();
      return true;
    }, label);
    await sleep(1800);
    return ok;
  }

  async function shot(name) {
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  }

  // ── ADMIN ────────────────────────────────────────────────────────────────
  await login('hr-admin@company.com', 'Admin@123');

  out.payrollKpi = await page.evaluate(() => {
    const all = [...document.querySelectorAll('main *')];
    const label = all.find((e) => (e.textContent || '').trim() === 'Quỹ lương tháng');
    if (!label) return null;
    let card = label;
    while (card && !card.className?.toString().includes('rounded')) card = card.parentElement;
    const valueEl = card ? [...card.querySelectorAll('*')].find((e) => (e.textContent || '').trim().match(/^[₫đ]?\s?0/)) : null;
    let rects = null;
    if (valueEl && valueEl.firstChild && valueEl.firstChild.nodeType === 3) {
      const range = document.createRange();
      range.selectNodeContents(valueEl.firstChild);
      rects = [...range.getClientRects()].map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
    }
    return {
      cardHTML: card ? card.innerHTML.slice(0, 1600) : null,
      valueText: valueEl ? JSON.stringify(valueEl.textContent) : null,
      valueClass: valueEl ? valueEl.className : null,
      valueFont: valueEl ? getComputedStyle(valueEl).fontFamily : null,
      valueRects: rects,
    };
  });

  // global search promise vs reality
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyK');
  await page.keyboard.up('Control');
  await sleep(400);
  await page.keyboard.type('Nguyễn', { delay: 20 });
  await sleep(700);
  out.searchEmployee = await page.evaluate(() => {
    const modal = document.querySelector('[role="dialog"][aria-label="Tìm kiếm nhanh"]');
    return {
      text: modal ? modal.innerText.replace(/\s+/g, ' ').trim().slice(0, 500) : null,
      resultButtons: modal ? [...modal.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim()) : [],
    };
  });
  await shot('01-search-employee');
  await page.keyboard.press('Escape');
  await sleep(300);

  // portal progress bar semantics
  await nav('Cổng nhân viên');
  out.portalLeave = await page.evaluate(() => {
    const all = [...document.querySelectorAll('main *')];
    const label = all.find((e) => (e.textContent || '').trim() === 'Phép năm còn lại');
    if (!label) return null;
    let card = label;
    while (card && !card.className?.toString().includes('rounded')) card = card.parentElement;
    const bars = card ? [...card.querySelectorAll('div')].filter((d) => {
      const s = getComputedStyle(d);
      return s.height !== 'auto' && parseFloat(s.height) <= 12 && d.children.length <= 1;
    }) : [];
    return {
      cardText: card ? card.innerText.replace(/\s+/g, ' ').trim() : null,
      bars: bars.map((b) => ({ w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), cls: b.className, childW: b.firstElementChild ? Math.round(b.firstElementChild.getBoundingClientRect().width) : null, aria: b.getAttribute('aria-valuenow') })),
      html: card ? card.innerHTML.slice(0, 2200) : null,
    };
  });

  // settings integrations after a real wait
  await nav('Cài đặt');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === 'Tích hợp');
    if (b) b.click();
  });
  await sleep(12000);
  await shot('02-integrations-after-12s');
  out.integrations = await page.evaluate(() => {
    const main = document.querySelector('main');
    return {
      text: main ? main.innerText.replace(/\s+/g, ' ').trim().slice(0, 1200) : null,
      skeletons: document.querySelectorAll('[class*="animate-pulse"]').length,
    };
  });

  // CSKH message markdown
  await nav('Tiếp quản CSKH');
  out.cskh = await page.evaluate(() => {
    const main = document.querySelector('main');
    const text = main ? main.innerText.replace(/\s+/g, ' ').trim() : '';
    const strongs = main ? main.querySelectorAll('strong').length : 0;
    const rawMarks = (text.match(/\*\*/g) || []).length;
    const firstBubble = [...document.querySelectorAll('main div')].find((d) => (d.innerText || '').includes('Về gói Pro'));
    return {
      rawDoubleAsterisks: rawMarks,
      strongTags: strongs,
      sample: text.slice(text.indexOf('Về gói Pro') - 20, text.indexOf('Về gói Pro') + 260),
      bubbleHTML: firstBubble ? firstBubble.innerHTML.slice(0, 900) : null,
    };
  });
  await shot('03-cskh-message');

  // AI: select WF02 properly
  await nav('Trợ lý AI');
  out.aiAgents = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('aside button')].filter((b) => (b.innerText || '').includes('WF0'));
    return cards.map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim());
  });
  const wf02 = await page.evaluate(() => {
    const b = [...document.querySelectorAll('aside button')].find((x) => (x.innerText || '').includes('HR Policy'));
    if (b) { b.click(); return true; }
    return false;
  });
  await sleep(1800);
  out.wf02Selected = wf02;
  out.aiHeader = await page.evaluate(() => {
    const main = document.querySelector('main');
    return main ? main.innerText.replace(/\s+/g, ' ').trim().slice(0, 700) : null;
  });
  await shot('04-ai-wf02');

  // training bottom
  await nav('Đào tạo & Radar AI');
  await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = 700; });
  await sleep(700);
  await shot('05-training-bottom');

  // ── EMPLOYEE ─────────────────────────────────────────────────────────────
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
  await page.type('input[type="email"]', 'employee1@company.com', { delay: 5 });
  await page.type('input[type="password"]', 'Employee@123', { delay: 5 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Đăng nhập'));
    if (b) b.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('Cổng nhân viên'), { timeout: 30000 });
  await sleep(2500);

  await nav('Kết quả đào tạo');
  out.myTraining = await page.evaluate(() => {
    const main = document.querySelector('main');
    return {
      text: main ? main.innerText.replace(/\s+/g, ' ').trim().slice(0, 1600) : null,
      buttons: main ? [...main.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean) : [],
      links: main ? [...main.querySelectorAll('a')].map((a) => (a.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean) : [],
    };
  });

  // mobile FAB z-index / overlap
  await nav('Cổng nhân viên');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(1000);
  out.mobileFab = await page.evaluate(() => {
    const fab = [...document.querySelectorAll('button')].find((b) => {
      const s = getComputedStyle(b);
      return s.position === 'fixed' && b.getBoundingClientRect().right > window.innerWidth - 90;
    });
    const onboarding = [...document.querySelectorAll('main *')].find((e) => (e.textContent || '').includes('Lộ trình hội nhập') && e.tagName === 'H2');
    const progress = onboarding ? onboarding.closest('.rounded-xl')?.querySelector('[class*="bg-primary"]') : null;
    const fr = fab?.getBoundingClientRect();
    const pr = progress?.getBoundingClientRect();
    return {
      fab: fab ? { right: Math.round(fr.right), bottom: Math.round(fr.bottom), w: Math.round(fr.width), h: Math.round(fr.height), z: getComputedStyle(fab).zIndex } : null,
      progress: pr ? { right: Math.round(pr.right), bottom: Math.round(pr.bottom), w: Math.round(pr.width) } : null,
      overlap: !!(fr && pr && fr.left < pr.right && fr.top < pr.bottom),
      viewport: { w: innerWidth, h: innerHeight },
    };
  });
  await shot('06-mobile-fab');

  fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(out, null, 2));
  await browser.close();
  console.log('DONE');
}

main().catch((e) => {
  console.error('FAILED', e);
  out.error = String(e.stack || e);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(out, null, 2));
  process.exit(1);
});
