// [DEBUG-chatprobe] Gemini connectivity probe. Env: GEMINI_API_KEY (from repo .env).
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const envText = fs.readFileSync(path.join(root, '.env'), 'utf8');
const m = envText.match(/^GEMINI_API_KEY=(.*)$/m);
const key = m ? m[1].trim() : '';
if (!key) { console.log('RESULT: RED — GEMINI_API_KEY missing'); process.exit(1); }

const body = {
  contents: [{ parts: [{ text: 'Reply with exactly: PONG' }] }],
  generationConfig: { maxOutputTokens: 1024 },
};

const started = Date.now();
fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(40_000),
})
  .then(async (res) => {
    const ms = Date.now() - started;
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.log(`RESULT: RED — HTTP ${res.status} in ${ms}ms: ${JSON.stringify(json).slice(0, 400)}`);
      process.exit(1);
    }
    const cand = json?.candidates?.[0];
    console.log(`HTTP ${res.status} in ${ms}ms; finishReason=${cand?.finishReason}`);
    console.log(`usage: ${JSON.stringify(json?.usageMetadata)}`);
    console.log(`text: ${JSON.stringify(cand?.content?.parts?.map((p) => p.text))}`);
    if (cand?.content?.parts?.length) console.log('RESULT: GREEN — Gemini works');
    else { console.log('RESULT: RED — no parts in candidate'); process.exit(1); }
  })
  .catch((e) => { console.log(`RESULT: RED — ${e.message}`); process.exit(1); });
