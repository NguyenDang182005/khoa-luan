// [diag-loop] DOM-level repro: "Sua ho so" tren trang Quan Ly Nhan Su
// RED   = dialog khong dong / loi hien tren man hinh / PATCH that bai / console error
// GREEN = luu thanh cong + API nhan PATCH 200 + du lieu persist
const puppeteer = require("puppeteer-core");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const WEB = "http://localhost:3000";
const EMAIL = process.env.DIAG_EMAIL || "hr-admin@company.com";
const PASS = process.env.DIAG_PASS || "Admin@123";
const NEW_PHONE = "090" + String(Math.floor(1000000 + Math.random() * 8999999));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  const patchCalls = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
  });
  page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 300)));
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/api/v1/")) {
      let body = "";
      try { body = (await res.text()).slice(0, 160); } catch {}
      patchCalls.push(`${res.request().method()} ${url.replace("http://localhost:3001", "")} -> ${res.status()} ${body}`);
    }
  });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fail = async (msg) => {
    console.log("RED:", msg);
    console.log("PATCH/GET calls:", JSON.stringify(patchCalls, null, 2));
    console.log("Console errors:", JSON.stringify(consoleErrors, null, 2));
    await page.screenshot({ path: "red-shot.png" });
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

  // 2) Mo tab Quan Ly Nhan Su
  const navBtn = await page.$('button[title="Ho So Nhan Su"]');
  if (!navBtn) await fail("khong thay nut sidebar 'Ho So Nhan Su' — co the van o man hinh login");
  await navBtn.click();
  await sleep(1500);

  // 2b) Tim kiem EMP003 de nam tren trang hien tai
  const searched = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder^="Tìm theo"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "EMP003");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  });
  if (searched) await sleep(2500); // debounce 300ms + fetch

  // 3) Mo drawer EMP003
  const clicked = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("table tbody tr"));
    const row = rows.find((r) => r.textContent.includes("EMP003"));
    if (row) { row.click(); return true; }
    return false;
  });
  if (!clicked) await fail("khong thay row EMP003 trong bang");
  await sleep(2000); // cho drawer fetch detail

  // 4) Bam 'Sua ho so'
  const editBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    return btns.find((b) => b.textContent.includes("Sửa hồ sơ"));
  });
  if (!editBtn || !(await editBtn.asElement())) {
    const drawerText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    await fail("khong thay nut 'Sửa hồ sơ'. Body head: " + drawerText.replace(/\n/g, " | "));
  }
  await editBtn.asElement().click();
  await sleep(800);

  // 5) Sua so dien thoai trong dialog (React controlled input)
  const setVal = await page.evaluate((v) => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], .fixed'));
    const dlg = dialogs.find((d) => d.textContent.includes("Chỉnh Sửa Hồ Sơ"));
    if (!dlg) return "NO_DIALOG";
    const labels = Array.from(dlg.querySelectorAll("label"));
    const lbl = labels.find((l) => l.textContent.includes("Số điện thoại"));
    if (!lbl) return "NO_LABEL";
    const input = lbl.parentElement.querySelector("input");
    if (!input) return "NO_INPUT";
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return "OK";
  }, NEW_PHONE);
  if (setVal !== "OK") await fail("khong sua duoc input SDT: " + setVal);

  // 6) Bam Luu Thay Doi
  const saveClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const save = btns.find((b) => b.textContent.includes("Lưu Thay Đổi"));
    if (save) { save.click(); return true; }
    return false;
  });
  if (!saveClicked) await fail("khong thay nut 'Lưu Thay Đổi'");

  await sleep(3500); // cho PATCH + refetch

  // 7) Dung doan ket qua
  const state = await page.evaluate(() => {
    // Chi dem loi trong DIALOG sua ho so (loai trinh trang tri trang nhu so ngay phep mau coral)
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], .fixed'));
    const dlg = dialogs.find((d) => d.textContent.includes("Chỉnh Sửa Hồ Sơ"));
    let red = [];
    if (dlg) {
      red = Array.from(dlg.querySelectorAll("p"))
        .filter((p) => p.className.includes("text-agent-coral"))
        .map((p) => p.textContent);
    }
    const dialogStillOpen = !!dlg;
    return { red, dialogStillOpen };
  });
  const patch = patchCalls.find((c) => c.startsWith("PATCH") && c.includes("/employees/"));
  const persisted = patch && patch.includes("-> 200");

  console.log("New phone:", NEW_PHONE);
  console.log("Dialog still open:", state.dialogStillOpen, "| Red errors on screen:", JSON.stringify(state.red));
  console.log("PATCH result:", patch || "(khong thay PATCH nao duoc goi)");
  if (consoleErrors.length) console.log("Console errors:", JSON.stringify(consoleErrors, null, 2));

  if (state.red.length > 0 || !patch || !persisted || state.dialogStillOpen) {
    console.log("RED: " + (!patch ? "PATCH khong duoc goi" : !persisted ? "PATCH that bai" : state.dialogStillOpen ? "dialog khong dong" : "loi tren man hinh"));
    await page.screenshot({ path: "red-shot.png" });
    await browser.close();
    process.exit(1);
  }
  console.log("GREEN: ho so da luu (PATCH 200, dialog dong, khong loi)");
  await page.screenshot({ path: "green-shot.png" });
  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error("RED: script crash —", String(e).slice(0, 500));
  process.exit(1);
});
