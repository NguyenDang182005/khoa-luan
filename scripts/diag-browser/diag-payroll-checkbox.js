// [diag-loop] DOM repro: "khong chon duoc o tick" tren trang Bang Luong & Thue
// RED   = click checkbox nhung khong chuyen checked / khong cap nhat counter
// GREEN = tick doi duoc, counter "Da chon 1/N" xuat hien
const puppeteer = require("puppeteer-core");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const WEB = "http://localhost:3000";
const EMAIL = process.env.DIAG_EMAIL || "hr-admin@company.com";
const PASS = process.env.DIAG_PASS || "Admin@123";

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 300)));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fail = async (msg) => {
    console.log("RED:", msg);
    console.log("Console errors:", JSON.stringify(consoleErrors, null, 2));
    await page.screenshot({ path: "red-payroll.png" });
    await browser.close();
    process.exit(1);
  };

  // 1) Login
  await page.goto(WEB, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', EMAIL, { delay: 20 });
  await page.type('input[type="password"]', PASS, { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await sleep(2000);

  // 2) Mo tab Bang Luong & Thue
  const navBtn = await page.$('button[title="Bang Luong & Thue"]');
  if (!navBtn) await fail("khong thay nut sidebar 'Bang Luong & Thue'");
  await navBtn.click();
  await sleep(2500); // cho fetch payroll

  // 3) Thong ke trang thai checkbox truoc khi click
  const before = await page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll('table tbody input[type="checkbox"]'));
    return {
      total: boxes.length,
      disabled: boxes.filter((b) => b.disabled).length,
      enabled: boxes.filter((b) => !b.disabled).length,
      checkedBefore: boxes.filter((b) => b.checked).length,
      bodyHead: document.body.innerText.slice(0, 300).replace(/\n/g, " | "),
    };
  });
  console.log("Before:", JSON.stringify(before));
  if (before.enabled === 0) await fail("tat ca checkbox disable (khong co DRAFT/APPROVED nao?)");

  // 4) Click checkbox dau tien dang bat — bang CHUOT THAT (toado that, qua hit-test)
  const box = await page.evaluateHandle(() =>
    Array.from(document.querySelectorAll('table tbody input[type="checkbox"]')).find((b) => !b.disabled)
  );
  const boxEl = box.asElement();
  if (!boxEl) await fail("NO_BOX");
  await boxEl.click(); // real mouse events tai toa do element
  await sleep(800);

  // 5) Doc lai trang thai sau khi React render lai
  const after = await page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll('table tbody input[type="checkbox"]'));
    const text = document.body.innerText;
    const paidBox = boxes.find((b) => b.disabled);
    return {
      checkedAfter: boxes.filter((b) => b.checked).length,
      counterShown: text.includes("Đã chọn"),
      counterText: (text.match(/Đã chọn[^\n]*/) || [""])[0],
      paidTooltip: paidBox ? paidBox.title : "(khong co o disable)",
      paidCursor: paidBox ? getComputedStyle(paidBox).cursor : "",
    };
  });
  console.log("After:", JSON.stringify(after));

  const uxOk = after.paidTooltip.includes("Đã chi trả") && after.paidCursor === "not-allowed";
  if (after.checkedAfter > 0 && after.counterShown) {
    console.log(uxOk ? "GREEN" : "GREEN (thieu tooltip UX) —", after.counterText, "| paidTooltip:", after.paidTooltip);
    await page.screenshot({ path: "green-payroll.png" });
    await browser.close();
    process.exit(0);
  }
  console.log("Console errors:", JSON.stringify(consoleErrors, null, 2));
  await page.screenshot({ path: "red-payroll.png" });
  console.log(`RED: click xong checkedAfter=${after.checkedAfter}, counterShown=${after.counterShown}`);
  await browser.close();
  process.exit(1);
})().catch((e) => {
  console.error("RED: script crash —", String(e).slice(0, 500));
  process.exit(1);
});
