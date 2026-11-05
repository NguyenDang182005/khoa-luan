/**
 * Sửa WF03 để câu hỏi/đáp án/nhận xét luôn là tiếng Việt CÓ DẤU.
 *
 * - Prompt + system message yêu cầu rõ "tiếng Việt có dấu".
 * - Fallback quiz đổi từ ASCII sang tiếng Việt chuẩn.
 * - Fallback chấm bài tạo results cho từng câu (correct_answer + feedback).
 * - Nếu model trả quiz không dấu → dùng fallback có dấu.
 *
 * Chạy: node scripts/fix-training-quiz-vi.mjs
 * Sau đó: node scripts/setup-n8n.mjs  (cần HR_API_KEY + GEMINI_API_KEY)
 */
import { copyFileSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, '..', 'n8n-workflows', '03-training-agent.json');
const backup = join(__dirname, '..', '.tmp-ui-audit', '03-training-agent.before-vi.json');

const workflow = JSON.parse(readFileSync(file, 'utf8'));
copyFileSync(file, backup);

const loadScenarioCode = String.raw`const input=$input.first().json;
const st=input.scenarioType||"general_communication";
const companyPolicy="Chính sách công ty: Giờ làm việc T2–T6 (8:00–17:30, nghỉ trưa 12:00–13:30), chấm công GPS bán kính văn phòng. Thử việc tối đa 60 ngày (hưởng 85% lương). Phép năm chuẩn 12 ngày/năm dương lịch (nhân viên mới vào làm trong năm tính theo tỷ lệ số tháng làm việc thực tế pro-rate, KHÔNG áp dụng bất kỳ cơ chế cộng thêm ngày phép nào: KHÔNG cộng phép thâm niên, KHÔNG chuyển phép dư năm trước sang năm sau). BHXH 8%, BHYT 1.5%, BHTN 1%. OT ngày thường x1.5, cuối tuần x2.0, lễ tết x3.0. Bảo mật PII: không chia sẻ CCCD, SĐT, lương của đồng nghiệp.";
const scenarios={customer_complaint:{role:"khách hàng khó tính phàn nàn về dịch vụ chậm trễ",objective:"xử lý khiếu nại, đề xuất giải pháp, giữ chân khách hàng",difficulty:"cao"},colleague_conflict:{role:"đồng nghiệp có mâu thuẫn phân công công việc",objective:"giải quyết mâu thuẫn, duy trì quan hệ chuyên nghiệp",difficulty:"trung bình"},manager_feedback:{role:"quản lý phản hồi về hiệu suất thấp và deadline trễ",objective:"tiếp nhận phản hồi tích cực, lập kế hoạch cải thiện cụ thể",difficulty:"trung bình"},new_employee_onboarding:{role:"nhân viên mới tuần đầu tiên cần hướng dẫn làm quen môi trường và chính sách nhân sự (nghỉ phép 12 ngày/năm pro-rate, không cộng phép thâm niên và không chuyển phép dư, chấm công GPS, thử việc, BHXH)",objective:"hòa nhập nhanh, hiểu rõ quy định công ty và kỳ vọng công việc",difficulty:"thấp"},performance_review:{role:"HR đánh giá hiệu suất quý, thảo luận mục tiêu SMART",objective:"đánh giá trung thực, thiết lập mục tiêu rõ ràng, đồng thuận",difficulty:"cao"},general_communication:{role:"đối tác trong cuộc họp đàm phán hợp đồng dịch vụ",objective:"giao tiếp hiệu quả, đạt thỏa thuận có lợi cho cả hai",difficulty:"trung bình"}};
const sd=scenarios[st]||scenarios.general_communication;
return[{json:{...input,scenarioType:st,scenarioData:sd,companyPolicy}}];`;

const buildQuizPromptCode = String.raw`const d=$input.first().json;
const sd=d.scenarioData||{};
const names={customer_complaint:"Xử lý khiếu nại khách hàng",colleague_conflict:"Giải quyết mâu thuẫn đồng nghiệp",manager_feedback:"Tiếp nhận phản hồi quản lý",new_employee_onboarding:"Hội nhập nhân viên mới",performance_review:"Đánh giá hiệu suất làm việc",general_communication:"Giao tiếp chuyên nghiệp"};
const sn=names[d.scenarioType]||d.scenarioType;
const cp=d.companyPolicy?"\nBối cảnh chính sách công ty: "+d.companyPolicy:"";
const p="Sinh 7 câu hỏi đào tạo bằng tiếng Việt CÓ DẤU cho kịch bản: "+sn+". Mục tiêu: "+(sd.objective||"giao tiếp hiệu quả")+"."+cp+"\n5 câu trắc nghiệm + 2 câu tự luận. YÊU CẦU BẮT BUỘC: Tất cả câu hỏi, phương án A/B/C/D và giải thích phải viết tiếng Việt có dấu đầy đủ, không viết không dấu. Trả về JSON MINIFIED trên 1 dòng duy nhất (không xuống dòng, không indent), phương án và explanation ngắn gọn (<12 từ), câu essay CHỈ có id, type, question (không có explanation) để không vượt 1024 tokens:\n{\"questions\":[{\"id\":1,\"type\":\"mcq\",\"question\":\"Câu hỏi?\",\"options\":{\"A\":\"...\",\"B\":\"...\",\"C\":\"...\",\"D\":\"...\"},\"correct\":\"B\",\"explanation\":\"...\"},{\"id\":6,\"type\":\"essay\",\"question\":\"Mô tả...\"},{\"id\":7,\"type\":\"essay\",\"question\":\"Nếu...\"}]}";
return[{json:{...d,quizPrompt:p}}];`;

const formatQuizCode = String.raw`const raw=$input.first().json.output||"";
const hasVietnameseDiacritics=(s)=>/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(String(s||""));
const fallback=[
{id:1,type:"mcq",question:"Khi khách hàng phản nàn, bước đầu tiên bạn nên:",options:{A:"Biện hộ cho công ty",B:"Lắng nghe và đồng cảm",C:"Chuyển cuộc gọi",D:"Yêu cầu bằng chứng"},correct:"B",explanation:"Lắng nghe là bước quan trọng nhất."},
{id:2,type:"mcq",question:"Câu nào thể hiện sự đồng cảm?",options:{A:"Đó không phải lỗi của chúng tôi",B:"Tôi hiểu bạn đang thất vọng",C:"Bạn cần đọc kỹ điều khoản",D:"Chúng tôi đã giải quyết rồi"},correct:"B",explanation:"Thể hiện hiểu cảm xúc khách."},
{id:3,type:"mcq",question:"Để xác nhận đã hiểu vấn đề, bạn:",options:{A:"Gật đầu im lặng",B:"Tóm tắt lại vấn đề của khách",C:"Hỏi nhiều câu liên tiếp",D:"Chờ khách nói xong mới đưa giải pháp"},correct:"B",explanation:"Tóm tắt giúp xác nhận hiểu đúng."},
{id:4,type:"mcq",question:"Khi không có thẩm quyền, bạn:",options:{A:"Từ chối hỗ trợ",B:"Hứa hẹn không chắc chắn",C:"Leo thang đúng người có thẩm quyền",D:"Bỏ qua khiếu nại"},correct:"C",explanation:"Escalation đúng quy trình là chuyên nghiệp."},
{id:5,type:"mcq",question:"Sau khi giải quyết, bạn nên:",options:{A:"Kết thúc ngay",B:"Follow-up xác nhận khách hài lòng",C:"Viết báo cáo ngay",D:"Chờ khách liên hệ lại"},correct:"B",explanation:"Follow-up thể hiện sự quan tâm."},
{id:6,type:"essay",question:"Mô tả từng bước xử lý khi khách hàng phản nàn đơn hàng đến muộn và sản phẩm bị hỏng."},
{id:7,type:"essay",question:"Nếu khách hàng vẫn không hài lòng sau khi bạn đề xuất giải pháp, bạn sẽ làm gì?"}
];
let qs=[];
try{
  const c=raw.replace(/__FENCE__json\n?/g,"").replace(/__FENCE__/g,"").trim();
  const p=JSON.parse(c);
  qs=p.questions||p;
  if(!Array.isArray(qs)||qs.length===0) throw new Error("empty quiz");
  const sample=qs.map(function(q){return [q.question].concat(q.options?Object.values(q.options):[]).join(" ");}).join(" ");
  if(!hasVietnameseDiacritics(sample)) throw new Error("quiz without Vietnamese diacritics");
}catch(e){qs=fallback;}
const input=$("Build Quiz Gen Prompt").first().json;
return[{json:{answer:"Đây là bài kiểm tra đào tạo của bạn:",questions:qs,scenarioType:input.scenarioType,sessionId:input.sessionId,employeeId:input.employeeId,intent:"TRAINING",action:"generate_quiz"}}];`.replaceAll('__FENCE__', '```');

const buildGradePromptCode = String.raw`const d=$input.first().json;
const answers=d.answers||[];
const names={customer_complaint:"Xử lý khiếu nại khách hàng",colleague_conflict:"Giải quyết mâu thuẫn đồng nghiệp",manager_feedback:"Tiếp nhận phản hồi quản lý",new_employee_onboarding:"Hội nhập nhân viên mới",performance_review:"Đánh giá hiệu suất",general_communication:"Giao tiếp chuyên nghiệp"};
const sn=names[d.scenarioType]||d.scenarioType;
const cp=d.companyPolicy?"\nBối cảnh chính sách công ty: "+d.companyPolicy:"";
const at=answers.map(function(a){
  if(a.type==="mcq") return "Câu "+a.questionId+" (trắc nghiệm): "+a.question+"\nĐáp án đúng: "+(a.correctAnswer||"—")+" | Học viên chọn: "+a.answer;
  return "Câu "+a.questionId+" (tự luận): "+a.question+"\nBài làm: "+a.answer;
}).join("\n---\n");
const p="Chấm bài đào tạo. Kịch bản: "+sn+"."+cp+"\n"+at+"\n\nChấm: MCQ đúng/sai theo đáp án đúng; tự luận 0-10, mỗi tự luận PHẢI chấm theo 4 tiêu chí (thang 0-10): chuyen_nghiep, dong_cam, giai_quyet, ro_rang. YÊU CẦU: Trả về JSON MINIFIED trên 1 dòng (feedback tiếng Việt có dấu, ngắn gọn <15 từ):\n{\"score_percent\":71,\"correct_count\":4,\"total_mcq\":5,\"essay_avg\":7.5,\"results\":[{\"id\":1,\"type\":\"mcq\",\"correct\":true,\"correct_answer\":\"B\",\"feedback\":\"...\"},{\"id\":6,\"type\":\"essay\",\"score\":7.5,\"max_score\":10,\"criteria\":{\"chuyen_nghiep\":7,\"dong_cam\":8,\"giai_quyet\":7,\"ro_rang\":8},\"feedback\":\"...\"}],\"overall_feedback\":\"...\"}";
return[{json:{...d,gradePrompt:p}}];`;

const formatGradeCode = String.raw`const raw=$input.first().json.output||"";
const input=$("Build Quiz Grade Prompt").first().json;
const answers=input.answers||[];
const fallbackResults=answers.map(function(a){
  if(a.type==="mcq"){
    const isCorrect=String(a.answer||"").toUpperCase()===String(a.correctAnswer||"").toUpperCase();
    return {id:a.questionId,type:"mcq",correct:isCorrect,correct_answer:a.correctAnswer||null,feedback:isCorrect?"Chính xác.":"Đáp án đúng là "+(a.correctAnswer||"—")+"."};
  }
  return {id:a.questionId,type:"essay",score:5,max_score:10,criteria:{chuyen_nghiep:5,dong_cam:5,giai_quyet:5,ro_rang:5},feedback:"Câu trả lời đã được ghi nhận; AI chưa chấm được chi tiết."};
});
let gr;
try{
  const c=raw.replace(/__FENCE__json\n?/g,"").replace(/__FENCE__/g,"").trim();
  gr=JSON.parse(c);
  if(!Array.isArray(gr.results)||gr.results.length===0) throw new Error("empty results");
  const hasEssay=gr.results.some(function(r){return r.type==="essay";});
  if(!hasEssay) gr.results=gr.results.concat(fallbackResults.filter(function(r){return r.type==="essay";}));
  gr.results=gr.results.map(function(r){
    const a=answers.find(function(x){return x.questionId===r.id;});
    return {...r,...(r.type==="mcq"&&!r.correct_answer?{correct_answer:a?a.correctAnswer:null}:{})};
  });
  if(typeof gr.essay_avg!=="number") gr.essay_avg=5;
}catch(e){
  const mcq=fallbackResults.filter(function(r){return r.type==="mcq";});
  const correct=mcq.filter(function(r){return r.correct;}).length;
  gr={score_percent:Math.round((correct/Math.max(1,mcq.length))*100),correct_count:correct,total_mcq:mcq.length,essay_avg:5,results:fallbackResults,overall_feedback:"Hệ thống chấm điểm tự động. Phần tự luận tạm tính 5/10 do AI chưa chấm được chi tiết."};
}
return[{json:{...gr,scenarioType:input.scenarioType,sessionId:input.sessionId,employeeId:input.employeeId,intent:"TRAINING",action:"submit_quiz",answer:"Kết quả: "+(gr.score_percent||0)+"% - Đúng "+(gr.correct_count||0)+"/"+(gr.total_mcq||5)+" MCQ. "+(gr.overall_feedback||"")}}];`.replaceAll('__FENCE__', '```');

const quizSystem = 'Bạn là AI sinh câu hỏi đào tạo nhân sự. Bám sát quy định công ty (phép năm chuẩn 12 ngày/năm, pro-rate năm đầu theo tháng vào làm, không cộng phép thâm niên và không chuyển phép dư sang năm sau). Tất cả câu hỏi, phương án và giải thích phải viết tiếng Việt CÓ DẤU đầy đủ, không viết không dấu. Chỉ trả về JSON thuần minified trên 1 dòng, không markdown.';

const gradeSystem = 'Bạn là giám khảo chấm bài đào tạo nhân sự. Bám sát quy định công ty (phép năm chuẩn 12 ngày/năm, pro-rate năm đầu theo tháng vào làm, không cộng phép thâm niên và không chuyển phép dư sang năm sau). Tất cả nhận xét phải viết tiếng Việt CÓ DẤU đầy đủ. Chỉ trả về JSON thuần minified trên 1 dòng, không markdown.';

function setCode(name, code) {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`Không tìm thấy node ${name}`);
  node.parameters.jsCode = code;
  console.log(`✔ ${name}`);
}

function setSystem(name, message) {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) throw new Error(`Không tìm thấy node ${name}`);
  node.parameters.options = { ...(node.parameters.options || {}), systemMessage: message };
  console.log(`✔ ${name} systemMessage`);
}

setCode('Load Scenario', loadScenarioCode);
setCode('Build Quiz Gen Prompt', buildQuizPromptCode);
setCode('Format Quiz Output', formatQuizCode);
setCode('Build Quiz Grade Prompt', buildGradePromptCode);
setCode('Format Grade Output', formatGradeCode);
setSystem('Quiz Generator Agent', quizSystem);
setSystem('Quiz Grader Agent', gradeSystem);

writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log(`\nĐã ghi ${file}`);
console.log(`Backup: ${backup}`);
