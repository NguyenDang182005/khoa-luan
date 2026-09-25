// [DEBUG-train] Feedback loop: so sánh GET /training/my-sessions (API thật) với DB ground truth.
// Chạy: node scripts/debug-training-api.mjs
const API = "http://localhost:3001/api/v1";

const EMPLOYEES = [
  { code: "EMP004", id: "cmtxpxq90000ptlho7k3p197b", dbRows: 1 },
  { code: "EMP005", id: "cmtxpxqbx000stlhoh608r4zl", dbRows: 3 },
  { code: "EMP006", id: "cmtxpxqg6000vtlhof9ql393f", dbRows: 4 },
];

async function login() {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "hr-admin@company.com", password: "Admin@123" }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const data = await res.json();
  return data.accessToken;
}

const token = await login();
let failures = 0;

for (const emp of EMPLOYEES) {
  const res = await fetch(`${API}/training/my-sessions?employeeId=${emp.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = await res.text();
  let body;
  try { body = JSON.parse(raw); } catch { body = null; }

  if (!res.ok) {
    console.log(`[RED] ${emp.code}: HTTP ${res.status} — ${raw.slice(0, 300)}`);
    failures++;
    continue;
  }
  if (!Array.isArray(body)) {
    console.log(`[RED] ${emp.code}: response KHÔNG phải mảng: ${typeof body} — ${raw.slice(0, 300)}`);
    failures++;
    continue;
  }
  if (body.length !== emp.dbRows) {
    console.log(`[RED] ${emp.code}: API trả ${body.length} sessions, DB có ${emp.dbRows}`);
    failures++;
    continue;
  }
  console.log(`[GREEN] ${emp.code}: ${body.length} sessions`);
  for (const s of body) {
    console.log(
      `    - ${s.scenario} status=${s.status} quiz=${s.quizScore} total=${s.totalScore} ` +
      `aiScore=${JSON.stringify(s.aiScore)} feedback=${JSON.stringify((s.aiFeedback ?? "").slice(0, 60))}`
    );
  }
}

console.log(failures === 0 ? "\n=== ALL GREEN ===" : `\n=== ${failures} RED ===`);
process.exit(failures === 0 ? 0 : 1);
