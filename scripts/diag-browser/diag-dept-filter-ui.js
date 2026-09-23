// [diag-loop] DOM check: bo loc phong ban tren trang Ho So Nhan Su
// GREEN = click chip phong ban -> moi row hien thi dung phong ban do; "Tat ca" tra lai day du
const puppeteer = require("puppeteer-core");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const WEB = "http://localhost:3000";
const EMAIL = process.env.DIAG_EMAIL || "hr-admin@company.com";
const PASS = process.env.DIAG_PASS || "Admin@123";
const DEPT = "Chăm sóc khách hàng";

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 200)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fail = async (msg) => {
    console.log("RED:", msg);
    console.log("Console errors:", JSON.stringify(consoleErrors));
    await browser.close();
    process.exit(1);
  };

  await page.goto(WEB, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', EMAIL, { delay: 15 });
  await page.type('input[type="password"]', PASS, { delay: 15 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await sleep(2000);

  const navBtn = await page.$('button[title="Ho So Nhan Su"]');
  if (!navBtn) await fail("khong thay nut sidebar Ho So Nhan Su");
  await navBtn.click();
  await sleep(2000);

  const rowsBefore = await page.evaluate(() => document.querySelectorAll("table tbody tr").length);
  console.log("Rows (Tat ca, page 1):", rowsBefore);

  // Click chip phong ban
  const chipClicked = await page.evaluate((dept) => {
    const chips = Array.from(document.querySelectorAll("button"));
    const chip = chips.find((b) => b.textContent.trim() === dept);
    if (!chip) return false;
    chip.click();
    return true;
  }, DEPT);
  if (!chipClicked) await fail("khong thay chip phong ban: " + DEPT);
  await sleep(2000); // cho refetch

  const afterDept = await page.evaluate((dept) => {
    const rows = Array.from(document.querySelectorAll("table tbody tr"));
    const wrong = rows.filter((r) => !r.textContent.includes(dept)).length;
    return { rows: rows.length, wrong, active: Array.from(document.querySelectorAll("button")).some((b) => b.textContent.trim() === dept && b.className.includes("bg-primary")) };
  }, DEPT);
  console.log("After dept filter:", JSON.stringify(afterDept));

  // Click "Tat ca" de tra lai
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll("button"));
    const all = chips.find((b) => b.textContent.trim() === "Tất cả");
    if (all) all.click();
  });
  await sleep(2000);
  const rowsAfter = await page.evaluate(() => document.querySelectorAll("table tbody tr").length);
  console.log("Rows (Tat ca, sau khi bo loc):", rowsAfter);

  if (afterDept.rows === 0 || afterDept.wrong > 0) {
    await fail(`sau khi loc con ${afterDept.rows} row nhung ${afterDept.wrong} row sai phong ban`);
  }
  if (rowsAfter < rowsBefore) await fail(`boc loc "Tat ca" khong tra lai day du: ${rowsAfter} < ${rowsBefore}`);
  if (consoleErrors.length) await fail("co console errors: " + JSON.stringify(consoleErrors));

  console.log("GREEN: bo loc phong ban hoat dong — chi con row thuoc '" + DEPT + "', 'Tat ca' tra lai day du");
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("RED: script crash —", String(e).slice(0, 500));
  process.exit(1);
});
