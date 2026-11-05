/**
 * Đổi chat model của các agent n8n từ Gemini (lmChatGoogleGemini) sang DeepSeek (lmChatDeepSeek).
 * Giữ nguyên temperature, maxTokens 1024, retry; đổi tên node "Gemini Flash" → "DeepSeek Chat"
 * (cập nhật connections) và metadata.model lưu vào DB.
 * Chạy: node scripts/swap-llm-deepseek.cjs <credId> <file.json> [...]
 *   (file có thể là 1 workflow hoặc mảng workflow từ `n8n export:workflow --all`)
 */
const fs = require('fs');

const OLD_NAME = 'Gemini Flash';
const NEW_NAME = 'DeepSeek Chat';
const MODEL = 'deepseek-flash';
const [credId, ...files] = process.argv.slice(2);
if (!credId || !files.length) {
  console.error('usage: node scripts/swap-llm-deepseek.cjs <credId> <file.json> [...]');
  process.exit(1);
}

let swapped = 0;
const toDeepSeek = (n) => {
  const { temperature, maxOutputTokens } = n.parameters?.options ?? {};
  swapped++;
  return {
    ...n,
    name: NEW_NAME,
    type: '@n8n/n8n-nodes-langchain.lmChatDeepSeek',
    typeVersion: 1,
    parameters: {
      model: MODEL,
      options: { temperature: temperature ?? 0.7, maxTokens: maxOutputTokens ?? 1024 },
    },
    credentials: { deepSeekApi: { id: credId, name: 'DeepSeek account' } },
  };
};

// Duyệt đệ quy: workflow có thể chứa bản sao nodes/connections (vd. activeVersion)
const walk = (v) => {
  if (Array.isArray(v)) return v.map(walk);
  if (!v || typeof v !== 'object') {
    return typeof v === 'string'
      ? v.replaceAll('model: \\"gemini-3.1-flash-lite\\"', `model: \\"${MODEL}\\"`)
          .replaceAll('model: "gemini-3.1-flash-lite"', `model: "${MODEL}"`)
          .replaceAll('Gemini/Chat Memory', 'LLM/Chat Memory')
      : v;
  }
  if (v.type === '@n8n/n8n-nodes-langchain.lmChatGoogleGemini') v = toDeepSeek(v);
  if (v.type === '@n8n/n8n-nodes-langchain.lmChatDeepSeek' && v.id?.startsWith('gemini-')) {
    return { ...v, id: v.id.replace('gemini-', 'deepseek-') };
  }
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    const key = k === OLD_NAME ? NEW_NAME : k; // key trong connections
    out[key] = key === 'node' && val === OLD_NAME ? NEW_NAME : walk(val);
  }
  return out;
};

for (const f of files) {
  const before = swapped;
  fs.writeFileSync(f, JSON.stringify(walk(JSON.parse(fs.readFileSync(f, 'utf8'))), null, 2) + '\n');
  console.log(`${f}: ${swapped - before} node(s) → ${MODEL}`);
}
