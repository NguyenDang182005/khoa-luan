/* Final probes: login error, mobile employees, 1024 table scroll. */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const OUT = path.resolve(__dirname, '..', '..', '.tmp-ui-audit', 'probe4');
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

  // wrong password first
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'hr-admin@company.com', { delay: 5 });
  await page.type('input[type="password"]', 'sai-mat-khau', { delay: 5 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Đăng nhập'));
    if (b) b.click();
  });
  await sleep(3000);
  await page.screenshot({ path: path.join(OUT, '01-login-error.png') });
  out.loginError = await page.evaluate(() => ({
    text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 600),
    alert: [...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText),
  }));

  // correct login
  await page.evaluate(() => { const i = document.querySelector('input[type="password"]'); if (i) i.value = ''; });
  await page.click('input[type="password"]', { clickCount: 3 });
  await page.type('input[type="password"]', 'Admin@123', { delay: 5 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('Đăng nhập'));
    if (b) b.click();
  });
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 30000 });
  await sleep(2500);

  async function nav(label) {
    await page.evaluate((label) => {
      const b = [...document.querySelectorAll('aside nav button')].find((x) => (x.innerText || '').trim() === label);
      if (b) b.click();
    }, label);
    await sleep(1500);
  }

  // 1024 table wrapper overflow
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await sleep(700);
  await nav('Hồ sơ nhân sự');
  out.table1024 = await page.evaluate(() => {
    const table = document.querySelector('table');
    const wrap = table?.parentElement;
    const main = document.querySelector('main');
    return {
      tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
      wrapClass: wrap?.className,
      wrapOverflowX: wrap ? getComputedStyle(wrap).overflowX : null,
      wrapClient: wrap?.clientWidth,
      wrapScroll: wrap?.scrollWidth,
      mainScroll: main ? { client: main.clientWidth, scroll: main.scrollWidth, overflowX: getComputedStyle(main).overflowX } : null,
      lastHeader: [...document.querySelectorAll('thead th')].slice(-3).map((e) => e.innerText),
    };
  });

  // 375 employees
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sleep(1000);
  await nav('Hồ sơ nhân sự');
  await page.screenshot({ path: path.join(OUT, '02-employees-375.png') });
  out.employees375 = await page.evaluate(() => {
    const main = document.querySelector('main');
    return {
      h1: document.querySelector('h1')?.innerText,
      text: main?.innerText.replace(/\s+/g, ' ').trim().slice(0, 700),
      tables: document.querySelectorAll('table').length,
      tableW: document.querySelector('table')?.getBoundingClientRect().width,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });

  await page.screenshot({ path: path.join(OUT, '03-employees-375-scroll.png') });

  fs.writeFileSync(path.join(OUT, 'probe4.json'), JSON.stringify(out, null, 2));
  await browser.close();
  console.log('DONE');
}
main().catch((e) => {
  console.error('FAILED', e);
  out.error = String(e.stack || e);
  fs.writeFileSync(path.join(OUT, 'probe4.json'), JSON.stringify(out, null, 2));
  process.exit(1);
});
