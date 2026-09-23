// [DEBUG-chatprobe] Phase 1 feedback loop — probe n8n webhooks directly.
// Usage: node scripts/probe-chat.cjs ["<message>"] ["<path>"]   (path default "chat")
// Red on the user's symptom when the response has no non-empty `answer` field
// (NestJS portalChat then throws 502 => chat page shows "không phản hồi").
// Env: N8N_URL (default http://localhost:5678), optional N8N_API_KEY.

const N8N_URL = process.env.N8N_URL || 'http://localhost:5678';

const message = process.argv[2] || 'Chế độ nghỉ phép năm của tôi là bao nhiêu ngày?';
const path = process.argv[3] || 'chat';
// employeeId must be a real Employee id (or null) — bogus values fail FK on session create.
const employeeId = process.env.PROBE_EMPLOYEE_ID || null;

async function main() {
  const started = Date.now();
  let res;
  try {
    res = await fetch(`${N8N_URL}/webhook/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_API_KEY ? { 'x-api-key': process.env.N8N_API_KEY } : {}),
      },
      body: JSON.stringify({ message, employeeId, employeeCode: null }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    console.log(`RESULT: RED (transport) — ${e.message}`);
    process.exit(1);
  }
  const latencyMs = Date.now() - started;
  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    console.log(`RESULT: RED (non-JSON HTTP ${res.status}) — ${text.slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`HTTP ${res.status} in ${latencyMs}ms`);
  console.log(`PAYLOAD: ${JSON.stringify(payload).slice(0, 500)}`);
  if (res.ok && typeof payload.answer === 'string' && payload.answer.length > 0) {
    console.log('RESULT: GREEN — n8n returned a proper answer');
  } else {
    console.log('RESULT: RED — no answer field (NestJS will surface this as 502 to the chat page)');
    process.exit(1);
  }
}

main();
