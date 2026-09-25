/**
 * fix-wf03-final.cjs
 * Fix dứt khoát WF03: kết nối Save Quiz/Grade → Format Training Output
 * và update jsCode để đọc đúng data theo branch.
 * Sau đó patch + activate WF03 trong n8n.
 */
const fs = require('fs');
const BASE = 'http://localhost:5678';
const EMAIL = 'haidangnguyen1214@gmail.com';
const PASS  = 'Lolnamdotavn182005@';
const WF03_ID = 'aaCU1Zr00f506dcJ';

async function main() {
  // 1. Fix local file
  const data = JSON.parse(fs.readFileSync('n8n-workflows/03-training-agent.json', 'utf8'));

  // Fix connections
  data.connections['Save Quiz Assistant Message'] = {
    main: [[{ node: 'Format Training Output', type: 'main', index: 0 }]]
  };
  data.connections['Save Grade Assistant Message'] = {
    main: [[{ node: 'Format Training Output', type: 'main', index: 0 }]]
  };

  // Fix Format Training Output jsCode
  const fto = data.nodes.find(n => n.id === 'format-training-output');
  fto.parameters.jsCode = [
    '// Detect branch: quiz / grade / roleplay',
    'let out={questions:null,answer:"",scoring:null,scenarioType:"",sessionId:"",intent:"TRAINING"};',
    '// Quiz branch: read questions từ Format Quiz Output',
    'try{const fqo=$("Format Quiz Output").first().json;if(fqo&&Array.isArray(fqo.questions)){out.questions=fqo.questions;out.answer=fqo.answer||"Đây là bài kiểm tra đào tạo của bạn:";out.scenarioType=fqo.scenarioType||"";out.sessionId=fqo.sessionId||"";return[{json:out}];}}catch(_){}',
    '// Grade branch: read result từ Format Grade Output',
    'try{const fgo=$("Format Grade Output").first().json;if(fgo&&fgo.score_percent!==undefined){out.answer=fgo.overall_feedback||"";out.scoring={score_percent:fgo.score_percent,correct_count:fgo.correct_count,total_mcq:fgo.total_mcq,essay_avg:fgo.essay_avg,results:fgo.results};out.scenarioType=fgo.scenarioType||"";out.sessionId=fgo.sessionId||"";return[{json:out}];}}catch(_){}',
    '// Roleplay branch: read từ Parse Result',
    'try{const pr=$("Parse Result").first().json;out.answer=pr.roleplayResponse||"";out.scoring=pr.scoring||null;out.scenarioType=pr.scenarioType||"";out.sessionId=pr.sessionId||"";}catch(_){}',
    'return[{json:out}];',
  ].join('\n');

  fs.writeFileSync('n8n-workflows/03-training-agent.json', JSON.stringify(data, null, 2), 'utf8');
  
  // Verify
  const saved = JSON.parse(fs.readFileSync('n8n-workflows/03-training-agent.json', 'utf8'));
  console.log('✅ Local file - Save Quiz connections:', JSON.stringify(saved.connections['Save Quiz Assistant Message']));
  console.log('✅ Local file - Save Grade connections:', JSON.stringify(saved.connections['Save Grade Assistant Message']));

  // 2. Patch n8n
  const loginRes = await fetch(BASE + '/rest/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS, mfaCode: '' }),
    redirect: 'manual',
  });
  const cookies = loginRes.headers.get('set-cookie') || '';
  const sessionCookie = cookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
  const headers = { 'Content-Type': 'application/json', 'Cookie': sessionCookie };

  // Get live WF03
  const getRes = await fetch(BASE + '/rest/workflows/' + WF03_ID, { headers });
  const wf = (await getRes.json()).data;

  // Apply connections
  wf.connections['Save Quiz Assistant Message'] = data.connections['Save Quiz Assistant Message'];
  wf.connections['Save Grade Assistant Message'] = data.connections['Save Grade Assistant Message'];
  console.log('Applied connections to live WF03');

  // Apply jsCode
  const liveFto = wf.nodes.find(n => n.id === 'format-training-output');
  if (liveFto) liveFto.parameters.jsCode = fto.parameters.jsCode;
  console.log('Applied jsCode - lines:', fto.parameters.jsCode.split('\n').length);

  // Deactivate
  await fetch(BASE + '/rest/workflows/' + WF03_ID + '/deactivate', { method: 'POST', headers });

  // PATCH
  const patchRes = await fetch(BASE + '/rest/workflows/' + WF03_ID, {
    method: 'PATCH', headers, body: JSON.stringify(wf),
  });
  const patchData = await patchRes.json();
  console.log('PATCH status:', patchRes.status);

  // Verify connections were saved in n8n
  const saveQuizConn = patchData.data?.connections?.['Save Quiz Assistant Message'];
  console.log('n8n Save Quiz connections after patch:', JSON.stringify(saveQuizConn));

  // Activate
  const wf2 = (await (await fetch(BASE + '/rest/workflows/' + WF03_ID, { headers })).json()).data;
  const actRes = await fetch(BASE + '/rest/workflows/' + WF03_ID + '/activate', {
    method: 'POST', headers, body: JSON.stringify({ versionId: wf2.versionId }),
  });
  const actJson = await actRes.json();
  console.log('Activate:', actJson.data?.active ? '🟢 ACTIVE' : '❌ FAILED: ' + actJson.message);
}

main().catch(console.error);
