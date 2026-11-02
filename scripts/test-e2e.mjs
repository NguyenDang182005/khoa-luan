const payload = {
  message: 'Lương tháng 8/2026 của tôi là bao nhiêu?',
  channel: 'web',
  employeeId: 'EMP003'
};

console.log('Sending E2E Turn 1 request to http://127.0.0.1:5678/webhook/chat...');
const startTime = Date.now();

try {
  const res = await fetch('http://127.0.0.1:5678/webhook/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.N8N_API_KEY ?? '' },
    body: JSON.stringify(payload)
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Status: ${res.status} (${duration}s)`);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    console.log('Response JSON:\n', JSON.stringify(json, null, 2));
  } catch {
    console.log('Response raw text:\n', text);
  }
} catch (err) {
  console.error('Error during fetch:', err);
}
