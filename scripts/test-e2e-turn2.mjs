const payload = {
  message: 'Thế còn số ngày phép năm còn lại của tôi?',
  channel: 'web',
  employeeId: 'EMP003',
  sessionId: 'cmtomf3g70001tl8kuzmariov'
};

console.log('Sending E2E Turn 2 request to http://127.0.0.1:5678/webhook/chat...');
const startTime = Date.now();

try {
  const res = await fetch('http://127.0.0.1:5678/webhook/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
