const fs = require('fs');
const BASE = 'http://localhost:5678';
const EMAIL = 'haidangnguyen1214@gmail.com';
const PASS  = 'Lolnamdotavn182005@';
const WF03_ID = 'aaCU1Zr00f506dcJ';

const NEW_FTO_CODE = [
  '// Detect branch: quiz / grade / roleplay',
  'let out={questions:null,answer:"",scoring:null,scenarioType:"",sessionId:"",intent:"TRAINING"};',
  '// Quiz branch: read questions từ Format Quiz Output',
  'try{const fqo=$("Format Quiz Output").first().json;if(fqo&&Array.isArray(fqo.questions)){out.questions=fqo.questions;out.answer=fqo.answer||"Đây là bài kiểm tra đào tạo của bạn:";out.scenarioType=fqo.scenarioType||"";out.sessionId=fqo.sessionId||"";return[{json:out}];}}catch(_){}',
  '// Grade branch: read result từ Format Grade Output',
  'try{const fgo=$("Format Grade Output").first().json;if(fgo&&fgo.score_percent!==undefined){out.answer=fgo.overall_feedback||"";out.score_percent=fgo.score_percent;out.correct_count=fgo.correct_count;out.total_mcq=fgo.total_mcq;out.essay_avg=fgo.essay_avg;out.results=fgo.results;out.overall_feedback=fgo.overall_feedback||out.answer;out.scoring={score_percent:fgo.score_percent,correct_count:fgo.correct_count,total_mcq:fgo.total_mcq,essay_avg:fgo.essay_avg,results:fgo.results};out.scenarioType=fgo.scenarioType||"";out.sessionId=fgo.sessionId||"";return[{json:out}];}}catch(_){}',
  '// Roleplay branch: read từ Parse Result',
  'try{const pr=$("Parse Result").first().json;out.answer=pr.roleplayResponse||"";out.scoring=pr.scoring||null;out.scenarioType=pr.scenarioType||"";out.sessionId=pr.sessionId||"";}catch(_){}',
  'return[{json:out}];',
].join('\n');

async function main() {
  // 1. Update local file
  const localPath = 'n8n-workflows/03-training-agent.json';
  const data = JSON.parse(fs.readFileSync(localPath, 'utf8'));
  const fto = data.nodes.find(n => n.id === 'format-training-output');
  if (fto) fto.parameters.jsCode = NEW_FTO_CODE;
  fs.writeFileSync(localPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('✅ Updated local n8n-workflows/03-training-agent.json');

  // 2. Login to n8n
  const loginRes = await fetch(BASE + '/rest/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS, mfaCode: '' }),
    redirect: 'manual',
  });
  const cookies = loginRes.headers.get('set-cookie') || '';
  const sessionCookie = cookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
  const headers = { 'Content-Type': 'application/json', Cookie: sessionCookie };

  // 3. Get live WF03
  const getRes = await fetch(BASE + '/rest/workflows/' + WF03_ID, { headers });
  const wf = (await getRes.json()).data;
  const liveFto = wf.nodes.find(n => n.id === 'format-training-output');
  if (liveFto) liveFto.parameters.jsCode = NEW_FTO_CODE;

  // 4. Deactivate -> PATCH -> Activate
  await fetch(BASE + '/rest/workflows/' + WF03_ID + '/deactivate', { method: 'POST', headers });
  const patchRes = await fetch(BASE + '/rest/workflows/' + WF03_ID, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      nodes: wf.nodes,
      connections: wf.connections,
      name: wf.name,
      settings: wf.settings,
    }),
  });
  const patchData = await patchRes.json();
  const newVer = patchData.data?.versionId;
  console.log('PATCH WF03 status:', patchRes.status, 'newVer:', newVer);

  const actRes = await fetch(BASE + '/rest/workflows/' + WF03_ID + '/activate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ versionId: newVer }),
  });
  const actJson = await actRes.json();
  console.log(actJson.data?.active ? '✅ WF03 is ACTIVE' : '❌ Activation failed: ' + actJson.message);
}

main().catch(console.error);
