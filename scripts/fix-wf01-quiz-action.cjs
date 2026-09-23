// fix-wf01-quiz-action.cjs
// Cập nhật WF01 Parse Intent: tự động set action='generate_quiz' khi detect quiz keywords
const fs = require('fs');

const EMAIL = 'haidangnguyen1214@gmail.com';
const PASS  = 'Lolnamdotavn182005@';
const WF01_ID = '3f8ac2e1-7c4d-4e8a-9b1f-2d5e6a7b8c9d';

// Parse Intent code mới: thêm quiz detection + action logic
const NEW_PARSE_INTENT_CODE = `const data = $input.first().json;
const msg = (data.maskedMessage || '').toLowerCase();
let intent = 'OTHER';

const isHR = /l\\u01b0\\u01a1ng|ph\\u00e9p|ngh\\u1ec9 ph\\u00e9p|h\\u1ee3p \\u0111\\u1ed3ng|bhxh|bhyt|bhtn|ch\\u1ea5m c\\u00f4ng|b\\u1ea3o hi\\u1ec3m|thu\\u1ebf|tncn|overtime|t\\u0103ng l\\u01b0\\u01a1ng|gi\\u1ea3m tr\\u1eeb|b\\u1eadc l\\u01b0\\u01a1ng|h\\u1ec7 s\\u1ed1|\\u0111\\u0103ng k\\u00fd ph\\u00e9p|thai s\\u1ea3n|ph\\u00fac l\\u1ee3i|th\\u01b0\\u1edfng|bonus|thu nh\\u1eadp|kh\\u1ea5u tr\\u1eeb|c\\u00f4ng s\\u1ed1|b\\u1ea3ng l\\u01b0\\u01a1ng|ng\\u00e0y c\\u00f4ng|ph\\u1ee5 c\\u1ea5p|k\\u00fd h\\u1ee3p \\u0111\\u1ed3ng|l\\u1ecbch l\\u00e0m vi\\u1ec7c|quy \\u0111\\u1ecbnh|ch\\u00ednh s\\u00e1ch|n\\u1ed9i quy/.test(msg)
  || /luong|phep|nghi phep|hop dong|cham cong|bao hiem|thue tncn|tang luong|giam tru|bac luong|he so|thai san|phuc loi|thuong|thu nhap|khau tru|cong so|bang luong|phu cap|quy dinh|chinh sach|noi quy/.test(msg);

const isQuizRequest = /bai test|bai kiem tra|lam test|quiz|trac nghiem|bai thi|kiem tra ky nang/.test(msg)
  || /b\\u00e0i test|b\\u00e0i ki\\u1ec3m tra|l\\u00e0m test|tr\\u1eafc nghi\\u1ec7m|b\\u00e0i thi/.test(msg);

const isTraining = /training|\\u0111\\u00e0o t\\u1ea1o|role.?play|k\\u1ecbch b\\u1ea3n|luy\\u1ec7n t\\u1eadp|t\\u00ecnh hu\\u1ed1ng|k\\u1ef9 n\\u0103ng giao ti\\u1ebfp|roleplay|t\\u1eadp d\\u01b0\\u1ee3t|b\\u00e0i test|b\\u00e0i ki\\u1ec3m tra|l\\u00e0m test|quiz|tr\\u1eafc nghi\\u1ec7m|b\\u00e0i thi|ki\\u1ec3m tra k\\u1ef9 n\\u0103ng/.test(msg)
  || /dao tao|kich ban|luyen tap|tinh huong|ky nang|tap duot|bai test|lam test|trac nghiem|bai kiem tra|bai thi|kiem tra/.test(msg);

const isCSKH = /khi\\u1ebfu n\\u1ea1i|kh\\u00e1ch h\\u00e0ng|s\\u1ea3n ph\\u1ea9m|cskh|ph\\u00e0n n\\u00e0n|d\\u1ecbch v\\u1ee5|ch\\u0103m s\\u00f3c kh\\u00e1ch|h\\u1ed7 tr\\u1ee3 kh\\u00e1ch|complain/.test(msg)
  || /khieu nai|khach hang|san pham|phan nan|dich vu|cham soc khach|ho tro khach/.test(msg);

if (isHR) intent = 'HR_QA';
else if (isTraining) intent = 'TRAINING';
else if (isCSKH) intent = 'CSKH';

// Tự động set action='generate_quiz' khi user nhắn từ khóa quiz/test
const action = data.action || (intent === 'TRAINING' && isQuizRequest ? 'generate_quiz' : null);

return [{ json: { ...data, intent, action } }];`;

async function main() {
  const loginRes = await fetch('http://localhost:5678/rest/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS, mfaCode: '' })
  });
  const cookies = (loginRes.headers.get('set-cookie') || '')
    .split(',').map(c => c.split(';')[0].trim()).join('; ');
  const h = { 'Content-Type': 'application/json', Cookie: cookies };

  const cur = await (await fetch(`http://localhost:5678/rest/workflows/${WF01_ID}`, { headers: h })).json();
  const wf = cur.data;

  const pi = wf.nodes.find(n => n.id === 'parse-intent');
  pi.parameters.jsCode = NEW_PARSE_INTENT_CODE;
  console.log('Parse Intent code updated');

  await fetch(`http://localhost:5678/rest/workflows/${WF01_ID}/deactivate`, { method: 'POST', headers: h });

  const p = await (await fetch(`http://localhost:5678/rest/workflows/${WF01_ID}`, {
    method: 'PATCH', headers: h,
    body: JSON.stringify({ ...wf, id: WF01_ID, versionId: wf.versionId })
  })).json();
  console.log('PATCH WF01:', p.data?.id ? 'OK' : 'ERR: ' + JSON.stringify(p).slice(0, 200));

  const a = await (await fetch(`http://localhost:5678/rest/workflows/${WF01_ID}/activate`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ versionId: p.data?.versionId })
  })).json();
  console.log('Activate WF01:', a.data?.active ? 'ACTIVE ✅' : 'ERR: ' + JSON.stringify(a).slice(0, 200));

  // Sync local WF01 file
  const wf1Local = JSON.parse(fs.readFileSync('n8n-workflows/01-router-agent.json', 'utf-8'));
  const piLocal = wf1Local.nodes.find(n => n.id === 'parse-intent');
  piLocal.parameters.jsCode = NEW_PARSE_INTENT_CODE;
  fs.writeFileSync('n8n-workflows/01-router-agent.json', JSON.stringify(wf1Local, null, 2));
  console.log('Local WF01 synced');
}

main().catch(e => console.error('ERR:', e.message));
