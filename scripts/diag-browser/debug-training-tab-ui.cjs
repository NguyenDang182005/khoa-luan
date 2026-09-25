// [DEBUG-train] UI loop: dang nhap employee1 (EMP005), mo tab "Ket Qua Dao Tao", doc so lieu hien thi.
// Ground truth DB (attempts): session moi nhat COLLEAGUE_CONFLICT co 2/5 MCQ dung = 40%
//   -> Quiz dung phai la 20/50, Tong 25/100. DB stores quizScore=20% (1/5) -> tab se hien 10/50 & 10/100 = SAI.
// Chay: node scripts/debug-training-tab-ui.cjs
const puppeteer = require("puppeteer-core");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const WEB = "http://localhost:3000";
const EMAIL = "employee1@company.com";
const PASS = "Employee@123";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(WEB, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', EMAIL, { delay: 15 });
  await page.type('input[type="password"]', PASS, { delay: 15 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await sleep(2000);

  const tabBtn = await page.$('button[title="Kết Quả Đào Tạo"]');
  if (!tabBtn) { console.log("RED: khong thay tab Ket Qua Dao Tao (co the khong phai role EMPLOYEE)"); await browser.close(); process.exit(1); }
  await tabBtn.click();
  await sleep(2500);

  const data = await page.evaluate(() => {
    const main = document.querySelector("main");
    const text = main ? main.innerText : "";
    return text;
  });
  console.log("===== NOI DUNG TAB =====");
  console.log(data);
  console.log("===== KET LUAN =====");

  const has3 = /Lần đánh giá\s*\n\s*3\b/.test(data) || /Lần đánh giá[\s\S]{0,20}\b3\b/.test(data);
  const latestRow = /Xung đột đồng nghiệp[\s\S]{0,200}?(\d[\d.,]*)\/50[\s\S]{0,80}?(\d[\d.,]*)\/10[\s\S]{0,80}?(\d[\d.,]*)\/100/.exec(data);

  console.log(`So sessions (KPI): ${has3 ? "3 (khop DB)" : "KHONG khop 3"}`);
  if (latestRow) {
    const [, quiz, ai, total] = latestRow;
    console.log(`Row moi nhat (Xung dot dong nghiep): Quiz ${quiz}/50 | AI ${ai}/10 | Tong ${total}/100`);
    // Ground truth attempts: 2/5 MCQ dung (40%) -> Quiz 20/50; essay 0 -> Tong 20/100
    const quizN = parseFloat(quiz.replace(",", "."));
    const totalN = parseFloat(total.replace(",", "."));
    if (quizN === 20 && totalN === 20) {
      console.log("GREEN: tab hien dung theo attempts thuc te (2/5 MCQ = 40%)");
    } else if (quizN === 10 && totalN === 10) {
      console.log("RED: tab hien theo quizScore=20% (1/5) trong DB — SAI so voi attempts 2/5=40%");
    } else {
      console.log(`RED: gia tri khong mong doi (quiz=${quizN}, total=${totalN})`);
    }
  } else {
    console.log("RED: khong doc duoc row lich su moi nhat");
  }

  await browser.close();
})().catch((e) => { console.error("LOOP ERROR:", String(e).slice(0, 400)); process.exit(2); });
