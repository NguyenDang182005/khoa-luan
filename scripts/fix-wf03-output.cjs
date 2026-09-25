const fs = require('fs');
const data = JSON.parse(fs.readFileSync('n8n-workflows/03-training-agent.json', 'utf8'));

// Fix Format Training Output: detect branch từ node nào đã chạy
const fto = data.nodes.find(n => n.id === 'format-training-output');
fto.parameters.jsCode = [
  '// Detect branch: quiz / grade / roleplay',
  'let out={questions:null,answer:"",scoring:null,scenarioType:"",sessionId:"",intent:"TRAINING"};',
  '// Quiz branch',
  'try{const fqo=$("Format Quiz Output").first().json;out.questions=fqo.questions||null;out.answer=fqo.answer||"";out.scenarioType=fqo.scenarioType||"";out.sessionId=fqo.sessionId||"";if(out.questions)return[{json:out}];}catch(_){}',
  '// Grade branch',
  'try{const fgo=$("Format Grade Output").first().json;out.answer=fgo.overall_feedback||"";out.scoring={score_percent:fgo.score_percent,correct_count:fgo.correct_count,total_mcq:fgo.total_mcq,essay_avg:fgo.essay_avg,results:fgo.results};out.scenarioType=fgo.scenarioType||"";out.sessionId=fgo.sessionId||"";if(fgo.score_percent!==undefined)return[{json:out}];}catch(_){}',
  '// Roleplay branch',
  'try{const pr=$("Parse Result").first().json;out.answer=pr.roleplayResponse||"";out.scoring=pr.scoring||null;out.scenarioType=pr.scenarioType||"";out.sessionId=pr.sessionId||"";}catch(_){}',
  'return[{json:out}];',
].join('\n');

fs.writeFileSync('n8n-workflows/03-training-agent.json', JSON.stringify(data, null, 2), 'utf8');
console.log('✅ Fixed Format Training Output');
console.log('Lines:', fto.parameters.jsCode.split('\n').length);
