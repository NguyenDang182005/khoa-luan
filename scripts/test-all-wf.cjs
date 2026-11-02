// test-all-wf.cjs - Test WF01, WF02, WF03, WF04
const BASE = 'http://localhost:5678/webhook/chat';

async function test(label, body, timeoutMs = 30000) {
  const t = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.N8N_API_KEY ?? '' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!r.ok) { console.log(`[${label}] HTTP ${r.status}`); return; }
    const text = await r.text();
    let d;
    try { d = JSON.parse(text); } catch(e) { console.log(`[${label}] RAW:`, text.slice(0, 150)); return; }
    const elapsed = Date.now() - t;
    console.log(`[${label}] intent=${d.intent||'?'} action=${d.action||'-'} | ${elapsed}ms`);
    console.log(`  answer: ${(d.answer || d.message || '').slice(0, 100)}`);
  } catch(e) {
    console.log(`[${label}] ERROR: ${e.message}`);
  }
}

(async () => {
  // WF02: HR Q&A
  await test('WF02 HR-QA', {
    message: 'chinh sach nghi phep la gi',
    maskedMessage: 'chinh sach nghi phep la gi',
    channel: 'web', employeeId: 'EMP003'
  }, 25000);

  // WF03: Training role-play
  await test('WF03 Roleplay', {
    message: 'toi muon luyen tap ky nang giao tiep',
    maskedMessage: 'toi muon luyen tap ky nang giao tiep',
    channel: 'web', employeeId: 'EMP003', scenarioType: 'customer_complaint'
  }, 25000);

  // WF03: Generate quiz
  await test('WF03 Quiz-Gen', {
    message: 'lam bai test',
    maskedMessage: 'lam bai test',
    channel: 'web', employeeId: 'EMP003',
    scenarioType: 'customer_complaint', action: 'generate_quiz'
  }, 25000);

  // WF01 OTHER (no LLM - should be fast)
  await test('WF01 OTHER', {
    message: 'xin chao',
    maskedMessage: 'xin chao',
    channel: 'web', employeeId: 'EMP003'
  }, 5000);

  console.log('\nDone.');
})();
