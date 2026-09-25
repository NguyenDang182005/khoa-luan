import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE = 'http://localhost:5678';
const EMAIL = 'haidangnguyen1214@gmail.com';
const PASS = 'Lolnamdotavn182005@';

const PII_JS_CODE = `const body=$input.first().json.body||{};const text=body.message||"";const channel=body.channel||"web";const employeeId=body.employeeId||null;const scenarioType=body.scenarioType||null;const action=body.action||null;const sessionId=body.sessionId||null;const sessionType=body.sessionType||null;const masked=text.replace(/\\b(\\d{9}|\\d{12})\\b/g,"[MASKED_ID]").replace(/\\b(0[35789]\\d{8})\\b/g,"[MASKED_PHONE]").replace(/[\\w.-]+@[\\w.-]+\\.\\w+/g,"[MASKED_EMAIL]");return[{json:{originalMessage:text,maskedMessage:masked,channel,employeeId,scenarioType,action,sessionId,sessionType}}];`;

const PARSE_INTENT_JS_CODE = `const data = $input.first().json;
const msg = (data.maskedMessage || '').toLowerCase();

const isHR = /lương|phép|nghỉ|ngày nghỉ|xin nghỉ|nghỉ phép|nghỉ ốm|nghỉ việc|nghỉ bù|nghỉ lễ|nghỉ chế độ|nghỉ không lương|nghỉ thai sản|hợp đồng|bhxh|bhyt|bhtn|chấm công|bảo hiểm|thuế|tncn|overtime|tăng lương|giảm trừ|bậc lương|hệ số|đăng ký phép|thai sản|phúc lợi|thưởng|bonus|thu nhập|khấu trừ|công số|bảng lương|ngày công|phụ cấp|ký hợp đồng|lịch làm việc|quy định|chính sách|nội quy|thử việc|đi muộn|về sớm|chế độ|trợ cấp|thôi việc|đồng phục|công tác|nghỉ mát|khám sức khỏe|sa thải|đuổi việc|bồi thường/.test(msg)
  || /(?:^|[^\\p{L}\\p{N}])nghi(?=[^\\p{L}\\p{N}]|$)/u.test(msg)
  || /luong|phep|ngay nghi|xin nghi|nghi phep|nghi om|nghi viec|nghi bu|nghi le|nghi che do|nghi khong luong|hop dong|cham cong|bao hiem|thue tncn|tang luong|giam tru|bac luong|he so|thai san|phuc loi|thuong|thu nhap|khau tru|cong so|bang luong|phu cap|quy dinh|chinh sach|noi quy|thu viec|di muon|ve som|che do|tro cap|thoi viec|dong phuc|cong tac|nghi mat|kham suc khoe|sa thai|duoi viec|boi thuong/.test(msg);

const isQuizRequest = /bai test|bai kiem tra|lam test|quiz|trac nghiem|bai thi|kiem tra ky nang|bat dau dao tao|bat dau bai test|bat dau bai kiem tra|bat dau kiem tra/.test(msg)
  || /bài test|bài kiểm tra|làm test|trắc nghiệm|bài thi|bắt đầu đào tạo|bắt đầu bài test|bắt đầu kiểm tra/.test(msg);

const isTraining = /training|đào tạo|role.?play|kịch bản|luyện tập|tình huống|kỹ năng giao tiếp|roleplay|tập dượt|bài test|bài kiểm tra|làm test|quiz|trắc nghiệm|bài thi|kiểm tra kỹ năng/.test(msg)
  || /dao tao|kich ban|luyen tap|tinh huong|ky nang|tap duot|bai test|lam test|trac nghiem|bai kiem tra|bai thi|kiem tra/.test(msg);

const isCSKH = /khiếu nại|khách hàng|sản phẩm|cskh|phàn nàn|dịch vụ|chăm sóc khách|hỗ trợ khách|complain/.test(msg)
  || /khieu nai|khach hang|san pham|phan nan|dich vu|cham soc khach|ho tro khach/.test(msg);

let intent = 'OTHER';
if (isHR) intent = 'HR_QA';
else if (isTraining) intent = 'TRAINING';
else if (isCSKH) intent = 'CSKH';
else if (data.sessionType && ['HR_QA', 'TRAINING', 'CSKH'].includes(data.sessionType)) {
  intent = data.sessionType;
}

// Tự động set action='generate_quiz' khi user nhắn từ khoá quiz/test
const action = data.action || (intent === 'TRAINING' && isQuizRequest ? 'generate_quiz' : null);

return [{ json: { ...data, intent, action } }];`;

async function main() {
  // 1. Sync local JSON
  const localPath = join(ROOT, 'n8n-workflows/01-router-agent.json');
  const wf01Local = JSON.parse(readFileSync(localPath, 'utf-8'));
  const piiNode = wf01Local.nodes.find(n => n.id === 'pii-masking');
  if (piiNode) piiNode.parameters.jsCode = PII_JS_CODE;
  const parseNode = wf01Local.nodes.find(n => n.id === 'parse-intent');
  if (parseNode) parseNode.parameters.jsCode = PARSE_INTENT_JS_CODE;
  writeFileSync(localPath, JSON.stringify(wf01Local, null, 2), 'utf-8');
  console.log('✅ Local n8n-workflows/01-router-agent.json updated.');

  // 2. Login to n8n
  const loginRes = await fetch(`${BASE}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS, mfaCode: '' }),
  });
  const cookies = loginRes.headers.get('set-cookie') || '';
  const sessionCookie = cookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
  const h = { 'Content-Type': 'application/json', 'Cookie': sessionCookie };

  // 3. Find active WF01
  const listRes = await fetch(`${BASE}/rest/workflows?limit=50`, { headers: h });
  const listJson = await listRes.json();
  const wfs = listJson.data || [];
  const activeWf01 = wfs.find(w => w.name === '01 - Router Agent' && w.active);
  if (!activeWf01) {
    console.error('Active WF01 not found among workflows');
    process.exit(1);
  }
  const wfId = activeWf01.id;
  console.log(`Found active WF01: id=${wfId}`);

  // 4. Fetch full workflow data
  const getRes = await fetch(`${BASE}/rest/workflows/${wfId}`, { headers: h });
  const wfData = (await getRes.json()).data;

  // 5. Update nodes
  const remotePii = wfData.nodes.find(n => n.id === 'pii-masking');
  if (remotePii) remotePii.parameters.jsCode = PII_JS_CODE;
  const remoteParse = wfData.nodes.find(n => n.id === 'parse-intent');
  if (remoteParse) remoteParse.parameters.jsCode = PARSE_INTENT_JS_CODE;

  // 6. Deactivate -> PATCH -> Activate
  await fetch(`${BASE}/rest/workflows/${wfId}/deactivate`, { method: 'POST', headers: h });
  const patchRes = await fetch(`${BASE}/rest/workflows/${wfId}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({
      nodes: wfData.nodes,
      connections: wfData.connections,
      name: wfData.name,
      settings: wfData.settings,
    }),
  });
  const patchJson = await patchRes.json();
  const newVersionId = patchJson.data?.versionId;
  console.log('PATCH WF01:', patchJson.data?.id ? 'OK' : 'ERR ' + JSON.stringify(patchJson));

  const actRes = await fetch(`${BASE}/rest/workflows/${wfId}/activate`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ versionId: newVersionId }),
  });
  const actJson = await actRes.json();
  console.log(actJson.data?.active ? `✅ Router activated successfully: ${wfId}` : `❌ Activate failed: ${actJson.message}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
