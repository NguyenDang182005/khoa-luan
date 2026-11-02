// Offline evaluation of WF01 Router: runs the exact "PII Masking" + "Parse Intent" code
// from n8n-workflows/01-router-agent.json on a labelled dataset (no LLM, no network).
// Usage: node scripts/eval/eval-router.mjs
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const root = new URL('../../', import.meta.url);
const wf = JSON.parse(readFileSync(new URL('n8n-workflows/01-router-agent.json', root), 'utf8'));
const codeOf = (name) => wf.nodes.find((n) => n.name === name).parameters.jsCode;
const asNode = (code) => new Function('$input', code);
const piiNode = asNode(codeOf('PII Masking'));
const intentNode = asNode(codeOf('Parse Intent'));
const run = (node, json) => node({ first: () => ({ json }), all: () => [{ json }] })[0].json;

const route = (message) => {
  const masked = run(piiNode, { body: { message, channel: 'web' } });
  return run(intentNode, masked);
};

// 1. Intent classification
const data = JSON.parse(readFileSync(new URL('scripts/eval/intent-dataset.json', root), 'utf8'));
const labels = ['HR_QA', 'TRAINING', 'CSKH', 'OTHER'];
const cm = Object.fromEntries(labels.map((a) => [a, Object.fromEntries(labels.map((b) => [b, 0]))]));
const errors = [];
const t0 = performance.now();
for (const { text, label } of data) {
  const { intent } = route(text);
  cm[label][intent]++;
  if (intent !== label) errors.push({ text, label, predicted: intent });
}
const perMsgMs = (performance.now() - t0) / data.length;

const correct = labels.reduce((s, l) => s + cm[l][l], 0);
console.log(`Intent: ${correct}/${data.length} correct, accuracy ${(100 * correct / data.length).toFixed(1)}%`);
console.log('Confusion matrix (row = true, col = predicted):', labels.join(' | '));
for (const l of labels) console.log(l.padEnd(9), labels.map((p) => cm[l][p]).join(' | '));
let macroF1 = 0;
for (const l of labels) {
  const tp = cm[l][l];
  const fp = labels.reduce((s, x) => s + (x !== l ? cm[x][l] : 0), 0);
  const fn = labels.reduce((s, x) => s + (x !== l ? cm[l][x] : 0), 0);
  const p = tp / (tp + fp || 1), r = tp / (tp + fn || 1), f1 = (2 * p * r) / (p + r || 1);
  macroF1 += f1 / labels.length;
  console.log(`${l.padEnd(9)} P=${p.toFixed(3)} R=${r.toFixed(3)} F1=${f1.toFixed(3)}`);
}
console.log(`Macro-F1 ${macroF1.toFixed(3)}; avg time per message ${perMsgMs.toFixed(3)} ms (PII + intent)`);
console.log('Misclassified:'); for (const e of errors) console.log(' -', JSON.stringify(e));

// 2. PII masking (synthetic, non-real values)
const piiCases = [
  ['CCCD của tôi là 001200000001', '[MASKED_ID]'],
  ['CMND cũ 123456789', '[MASKED_ID]'],
  ['Gọi tôi số 0900000001 nhé', '[MASKED_PHONE]'],
  ['SĐT 0381234567', '[MASKED_PHONE]'],
  ['Email test@example.com', '[MASKED_EMAIL]'],
  ['mail nguyen.van-a@cong-ty.vn', '[MASKED_EMAIL]'],
  ['Số bàn 0241234567 (máy bàn Hà Nội)', 'NOT_MASKED'],
  ['SĐT có dấu cách 090 000 0001', 'NOT_MASKED'],
  ['Mã đơn 202611020', '[MASKED_ID]'],
];
let piiOk = 0;
console.log('\nPII masking:');
for (const [input, expect] of piiCases) {
  const out = run(piiNode, { body: { message: input } }).maskedMessage;
  const got = expect === 'NOT_MASKED' ? !/\[MASKED_/.test(out) : out.includes(expect);
  if (got) piiOk++;
  console.log(got ? ' as-expected' : ' UNEXPECTED ', '|', input, '=>', out);
}
console.log(`PII: ${piiOk}/${piiCases.length} behaved as the regex specification predicts`);
