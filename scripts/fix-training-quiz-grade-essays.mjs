/**
 * WF03 grader chỉ chấm 2 câu tự luận (MCQ do NestJS chấm deterministic).
 * Lý do: schema cũ bắt LLM trả 7 results + criteria → vượt maxTokens 1024,
 * output rỗng, rơi vào fallback "chưa chấm được chi tiết".
 *
 * Chạy: node scripts/fix-training-quiz-grade-essays.mjs
 * Sau đó: node scripts/setup-n8n.mjs
 */
import { copyFileSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, '..', 'n8n-workflows', '03-training-agent.json');
const backup = join(__dirname, '..', '.tmp-ui-audit', '03-training-agent.before-essay-grade.json');
const workflow = JSON.parse(readFileSync(file, 'utf8'));
copyFileSync(file, backup);

const buildGradePromptCode = String.raw`const d=$input.first().json;
const answers=d.answers||[];
const essays=answers.filter(function(a){return a.type==="essay";});
const names={customer_complaint:"Xử lý khiếu nại khách hàng",colleague_conflict:"Giải quyết mâu thuẫn đồng nghiệp",manager_feedback:"Tiếp nhận phản hồi quản lý",new_employee_onboarding:"Hội nhập nhân viên mới",performance_review:"Đánh giá hiệu suất",general_communication:"Giao tiếp chuyên nghiệp"};
const sn=names[d.scenarioType]||d.scenarioType;
const cp=d.companyPolicy?"\nBối cảnh chính sách công ty: "+d.companyPolicy:"";
const at=essays.map(function(a){return "Câu "+a.questionId+" (tự luận): "+a.question+"\nBài làm: "+a.answer;}).join("\n---\n");
const p="Chấm 2 câu tự luận của bài đào tạo. Kịch bản: "+sn+"."+cp+"\n"+at+"\n\nChấm mỗi câu 0-10 theo 4 tiêu chí (thang 0-10): chuyen_nghiep, dong_cam, giai_quyet, ro_rang. KHÔNG chấm trắc nghiệm (hệ thống tự chấm). Tất cả nhận xét phải viết tiếng Việt CÓ DẤU đầy đủ. Trả về JSON MINIFIED trên 1 dòng, feedback ngắn gọn (<20 từ):\n{\"results\":[{\"id\":6,\"type\":\"essay\",\"score\":7.5,\"max_score\":10,\"criteria\":{\"chuyen_nghiep\":7,\"dong_cam\":8,\"giai_quyet\":7,\"ro_rang\":8},\"feedback\":\"...\"},{\"id\":7,\"type\":\"essay\",\"score\":7,\"max_score\":10,\"criteria\":{\"chuyen_nghiep\":7,\"dong_cam\":7,\"giai_quyet\":7,\"ro_rang\":7},\"feedback\":\"...\"}],\"overall_feedback\":\"...\"}";
return[{json:{...d,gradePrompt:p}}];`;

const formatGradeCode = String.raw`const raw=$input.first().json.output||"";
const input=$("Build Quiz Grade Prompt").first().json;
const answers=input.answers||[];
const mcqResults=answers.filter(function(a){return a.type==="mcq";}).map(function(a){
  const isCorrect=String(a.answer||"").toUpperCase()===String(a.correctAnswer||"").toUpperCase();
  return {id:a.questionId,type:"mcq",correct:isCorrect,correct_answer:a.correctAnswer||null,feedback:isCorrect?"Chính xác.":"Đáp án đúng là "+(a.correctAnswer||"—")+"."};
});
const essayFallback=answers.filter(function(a){return a.type==="essay";}).map(function(a){
  return {id:a.questionId,type:"essay",score:5,max_score:10,criteria:{chuyen_nghiep:5,dong_cam:5,giai_quyet:5,ro_rang:5},feedback:"Câu trả lời đã được ghi nhận; AI chưa chấm được chi tiết."};
});
function finalize(gr){
  const parsed=Array.isArray(gr.results)?gr.results.filter(function(r){return r.type==="essay";}):[];
  const essays=essayFallback.map(function(fb){
    const r=parsed.find(function(x){return x.id===fb.id;});
    return r?{...fb,...r,type:"essay"}:fb;
  });
  const essayAvg=essays.length?essays.reduce(function(s,r){return s+(typeof r.score==="number"?r.score:0);},0)/essays.length:0;
  const correct=mcqResults.filter(function(r){return r.correct;}).length;
  const total=mcqResults.length;
  return {...gr,results:mcqResults.concat(essays),correct_count:correct,total_mcq:total,essay_avg:Math.round(essayAvg*10)/10,score_percent:Math.round((correct/Math.max(1,total))*100*0.5+essayAvg*10*0.5),overall_feedback:gr.overall_feedback||"Đã chấm xong bài đào tạo."};
}
let gr;
try{
  const c=raw.replace(/__FENCE__json\n?/g,"").replace(/__FENCE__/g,"").trim();
  gr=JSON.parse(c);
  if(!Array.isArray(gr.results)||gr.results.length===0) throw new Error("empty results");
  gr=finalize(gr);
}catch(e){
  gr=finalize({results:essayFallback,overall_feedback:"Hệ thống chấm điểm tự động. Phần tự luận tạm tính 5/10 do AI chưa chấm được chi tiết."});
}
return[{json:{...gr,scenarioType:input.scenarioType,sessionId:input.sessionId,employeeId:input.employeeId,intent:"TRAINING",action:"submit_quiz",answer:"Kết quả: "+(gr.score_percent||0)+"% - Đúng "+(gr.correct_count||0)+"/"+(gr.total_mcq||5)+" MCQ. "+(gr.overall_feedback||"")}}];`.replaceAll('__FENCE__', '```');

const gradeSystem = 'Bạn là giám khảo chấm 2 câu tự luận của bài đào tạo nhân sự. Chỉ chấm tự luận, KHÔNG chấm trắc nghiệm. Bám sát quy định công ty (phép năm chuẩn 12 ngày/năm, pro-rate năm đầu, không cộng phép thâm niên, không chuyển phép dư). Tất cả nhận xét phải viết tiếng Việt CÓ DẤU đầy đủ. Chỉ trả về JSON thuần minified trên 1 dòng, không markdown.';

function setCode(name, code) {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`Không tìm thấy node ${name}`);
  node.parameters.jsCode = code;
  console.log(`✔ ${name}`);
}

const gradeNode = workflow.nodes.find((n) => n.name === 'Quiz Grader Agent');
if (!gradeNode) throw new Error('Không tìm thấy Quiz Grader Agent');
gradeNode.parameters.options = { ...(gradeNode.parameters.options || {}), systemMessage: gradeSystem };
console.log('✔ Quiz Grader Agent systemMessage');

setCode('Build Quiz Grade Prompt', buildGradePromptCode);
setCode('Format Grade Output', formatGradeCode);

writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log(`\nĐã ghi ${file}`);
console.log(`Backup: ${backup}`);
