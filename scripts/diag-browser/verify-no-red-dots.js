// [verify] Dem cham do/badge con lai: sidebar + khung chat n8n (AI Agents view)
const puppeteer = require("puppeteer-core");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const WEB = "http://localhost:3000";

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await page.goto(WEB, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', "hr-admin@company.com", { delay: 15 });
  await page.type('input[type="password"]', "Admin@123", { delay: 15 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await sleep(2000);

  const sidebarBadges = await page.evaluate(() => document.querySelectorAll("aside span.absolute").length);
  console.log("Sidebar badges con lai:", sidebarBadges);

  const navBtn = await page.$('button[title="AI Multi-Agents Sandbox"]');
  if (!navBtn) { console.log("RED: khong thay tab AI Sandbox"); process.exit(1); }
  await navBtn.click();
  await sleep(2500);

  const redDots = await page.evaluate(() => ({
    unreadDots: document.querySelectorAll('span.size-2.bg-agent-coral').length,
    anyCoralCircle: Array.from(document.querySelectorAll("span")).filter((s) => {
      const c = getComputedStyle(s).backgroundColor;
      return s.classList.contains("rounded-full") && c.includes("220, 38, 38");
    }).length,
  }));
  console.log("Khung chat n8n:", JSON.stringify(redDots));

  const ok = sidebarBadges === 0 && redDots.unreadDots === 0;
  console.log(ok ? "GREEN: khong con cham do nao" : "RED: van con cham do");
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
