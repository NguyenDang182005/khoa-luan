// generate-wf03.cjs — chạy: node generate-wf03.cjs
const fs = require('fs');

const wf3 = {
  name: '03 - Training Role-play Agent',
  nodes: [
    {
      parameters: {},
      id: 'training-input',
      name: 'Input from Router',
      type: 'n8n-nodes-base.executeWorkflowTrigger',
      typeVersion: 1,
      position: [240, 300]
    },
    {
      parameters: {
        httpMethod: 'POST',
        path: 'training-quiz',
        responseMode: 'responseNode',
        options: {}
      },
      id: 'training-webhook',
      name: 'Training Quiz Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [240, 520],
      webhookId: 'training-quiz-webhook'
    },
    {
      parameters: {
        jsCode:
          'const src=$input.first().json;const body=src.body||src;return[{json:{message:body.message||\"\",maskedMessage:body.maskedMessage||body.message||\"\",employeeId:body.employeeId||null,scenarioType:body.scenarioType||\"general_communication\",action:body.action||null,answers:body.answers||null,sessionId:body.sessionId||null,channel:body.channel||\"web\"}}];'
      },
      id: 'normalize-input',
      name: 'Normalize Input',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [460, 400]
    },
    {
      parameters: {
        jsCode:
          'const input=$input.first().json;const st=input.scenarioType||"general_communication";const scenarios={customer_complaint:{role:"khach hang kho tinh phan nan ve dich vu cham tre",objective:"xu ly khieu nai, de xuat giai phap, giu chan khach hang",difficulty:"cao"},colleague_conflict:{role:"dong nghiep co mau thuan phan cong cong viec",objective:"giai quyet mau thuan, duy tri quan he chuyen nghiep",difficulty:"trung binh"},manager_feedback:{role:"manager feedback hieu suat thap va deadline tre",objective:"tiep nhan feedback tich cuc, lap ke hoach cai thien cu the",difficulty:"trung binh"},new_employee_onboarding:{role:"nhan vien moi tuan dau tien can huong dan lam quen moi truong",objective:"hoa nhap nhanh, hieu ro quy dinh va ky vong cong ty",difficulty:"thap"},performance_review:{role:"HR danh gia hieu suat quy, thao luan muc tieu SMART",objective:"danh gia trung thuc, thiet lap muc tieu ro rang, dong thuan",difficulty:"cao"},general_communication:{role:"doi tac trong cuoc hop dam phan hop dong dich vu",objective:"giao tiep hieu qua, dat thoa thuan co loi cho ca hai",difficulty:"trung binh"}};const sd=scenarios[st]||scenarios.general_communication;return[{json:{...input,scenarioType:st,scenarioData:sd}}];'
      },
      id: 'load-scenario',
      name: 'Load Scenario',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [680, 400]
    },
    {
      parameters: {
        rules: {
          values: [
            {
              conditions: {
                options: { caseSensitive: false, leftValue: '', typeValidation: 'strict', version: 2 },
                conditions: [{ leftValue: '={{ $json.action }}', rightValue: 'generate_quiz', operator: { type: 'string', operation: 'equals' } }],
                combinator: 'and'
              },
              renameOutput: true,
              outputKey: 'generate_quiz'
            },
            {
              conditions: {
                options: { caseSensitive: false, leftValue: '', typeValidation: 'strict', version: 2 },
                conditions: [{ leftValue: '={{ $json.action }}', rightValue: 'submit_quiz', operator: { type: 'string', operation: 'equals' } }],
                combinator: 'and'
              },
              renameOutput: true,
              outputKey: 'submit_quiz'
            }
          ]
        },
        options: { fallbackOutput: 'extra' }
      },
      id: 'action-switch',
      name: 'Action Switch',
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      position: [900, 400]
    },
    {
      parameters: {
        jsCode:
          'const d=$input.first().json;const sd=d.scenarioData||{};const names={customer_complaint:"Xu ly khieu nai khach hang",colleague_conflict:"Giai quyet mau thuan dong nghiep",manager_feedback:"Tiep nhan phan hoi quan ly",new_employee_onboarding:"Hoi nhap nhan vien moi",performance_review:"Danh gia hieu suat lam viec",general_communication:"Giao tiep chuyen nghiep"};const sn=names[d.scenarioType]||d.scenarioType;const p="Sinh 7 cau hoi dao tao ky nang mem tieng Viet cho kich ban: "+sn+". Muc tieu: "+(sd.objective||"giao tiep hieu qua")+".\\n5 MCQ + 2 tu luan. TRA VE CHI JSON THUAN:\\n{\\"questions\\":[{\\"id\\":1,\\"type\\":\\"mcq\\",\\"question\\":\\"Q?\\",\\"options\\":{\\"A\\":\\"a\\",\\"B\\":\\"b\\",\\"C\\":\\"c\\",\\"D\\":\\"d\\"},\\"correct\\":\\"B\\",\\"explanation\\":\\"...\\\"},{\\"id\\":6,\\"type\\":\\"essay\\",\\"question\\":\\"Mo ta...\\"},{\\"id\\":7,\\"type\\":\\"essay\\",\\"question\\":\\"Neu...\\"}]}";return[{json:{...d,quizPrompt:p}}];'
      },
      id: 'quiz-gen-prompt',
      name: 'Build Quiz Gen Prompt',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1100, 220]
    },
    {
      parameters: {
        promptType: 'define',
        text: '={{ $json.quizPrompt }}',
        options: { maxIterations: 1, systemMessage: 'Ban la AI sinh cau hoi dao tao. Chi tra ve JSON thuan, khong markdown.' }
      },
      id: 'quiz-gen-agent',
      name: 'Quiz Generator Agent',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.7,
      position: [1300, 220]
    },
    {
      parameters: {
        jsCode:
          'const raw=$input.first().json.output||"";let qs=[];try{const c=raw.replace(/```json\\n?/g,"").replace(/```/g,"").trim();const p=JSON.parse(c);qs=p.questions||p;}catch(e){qs=[{id:1,type:"mcq",question:"Khi khach hang phan nan, buoc dau tien ban nen:",options:{A:"Bien ho cho cong ty",B:"Lang nghe va dong cam",C:"Chuyen cuoc goi",D:"Yeu cau bang chung"},correct:"B",explanation:"Lang nghe la buoc quan trong nhat."},{id:2,type:"mcq",question:"Cau nao the hien su dong cam?",options:{A:"Do khong phai loi chung toi",B:"Toi hieu ban dang that vong",C:"Ban can doc ky dieu khoan",D:"Chung toi da giai quyet roi"},correct:"B",explanation:"The hien hieu cam xuc khach."},{id:3,type:"mcq",question:"De xac nhan da hieu van de, ban:",options:{A:"Gat dau im lang",B:"Tom tat lai van de cua khach",C:"Hoi nhieu cau lien tiep",D:"Cho khach noi xong moi dua giai phap"},correct:"B",explanation:"Tom tat giup xac nhan hieu dung."},{id:4,type:"mcq",question:"Khi khong co tham quyen, ban:",options:{A:"Tu choi ho tro",B:"Hua hen khong chac chan",C:"Leo thang dung nguoi co tham quyen",D:"Bo qua khieu nai"},correct:"C",explanation:"Escalation dung quy trinh la chuyen nghiep."},{id:5,type:"mcq",question:"Sau khi giai quyet, ban nen:",options:{A:"Ket thuc ngay",B:"Follow-up xac nhan khach hai long",C:"Viet bao cao ngay",D:"Cho khach lien he lai"},correct:"B",explanation:"Follow-up the hien su quan tam.\"},{id:6,type:"essay",question:"Mo ta tung buoc xu ly khi khach hang phan nan don hang den muon va san pham bi hong."},{id:7,type:"essay",question:"Neu khach hang van khong hai long sau khi ban de xuat giai phap, ban se lam gi?"}];}const input=$("Build Quiz Gen Prompt").first().json;return[{json:{answer:"Day la bai kiem tra dao tao cua ban:",questions:qs,scenarioType:input.scenarioType,sessionId:input.sessionId,employeeId:input.employeeId,intent:"TRAINING",action:"generate_quiz"}}];'
      },
      id: 'quiz-gen-format',
      name: 'Format Quiz Output',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1500, 220]
    },
    {
      parameters: {
        jsCode:
          'const d=$input.first().json;const answers=d.answers||[];const names={customer_complaint:"Xu ly khieu nai KH",colleague_conflict:"Giai quyet mau thuan dong nghiep",manager_feedback:"Tiep nhan phan hoi quan ly",new_employee_onboarding:"Hoi nhap nhan vien moi",performance_review:"Danh gia hieu suat",general_communication:"Giao tiep chuyen nghiep"};const sn=names[d.scenarioType]||d.scenarioType;const at=answers.map(function(a){if(a.type==="mcq")return"Cau "+a.questionId+" MCQ: "+a.question+"\\nDung: "+a.correctAnswer+" | HV: "+a.answer;return"Cau "+a.questionId+" TuLuan: "+a.question+"\\nTL: "+a.answer;}).join("\\n---\\n");const p="Cham bai dao tao. Kich ban: "+sn+".\\n"+at+"\\n\\nCham: MCQ dung/sai theo correctAnswer; TuLuan 0-10.\\nJSON THUAN:{\\"score_percent\\":71,\\"correct_count\\":4,\\"total_mcq\\":5,\\"results\\":[{\\"id\\":1,\\"type\\":\\"mcq\\",\\"correct\\":true,\\"correct_answer\\":\\"B\\",\\"feedback\\":\\"...\\"},{\\"id\\":6,\\"type\\":\\"essay\\",\\"score\\":7.5,\\"max_score\\":10,\\"feedback\\":\\"...\\"}],\\"overall_feedback\\":\\"...\\"}";return[{json:{...d,gradePrompt:p}}];'
      },
      id: 'quiz-grade-prompt',
      name: 'Build Quiz Grade Prompt',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1100, 580]
    },
    {
      parameters: {
        promptType: 'define',
        text: '={{ $json.gradePrompt }}',
        options: { maxIterations: 1, systemMessage: 'Ban la giam khao cham bai dao tao. Chi tra ve JSON thuan, khong markdown.' }
      },
      id: 'quiz-grade-agent',
      name: 'Quiz Grader Agent',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.7,
      position: [1300, 580]
    },
    {
      parameters: {
        jsCode:
          'const raw=$input.first().json.output||"";let gr;try{const c=raw.replace(/```json\\n?/g,"").replace(/```/g,"").trim();gr=JSON.parse(c);}catch(e){gr={score_percent:60,correct_count:3,total_mcq:5,results:[],overall_feedback:"He thong cham diem tu dong."};}const input=$("Build Quiz Grade Prompt").first().json;return[{json:{...gr,scenarioType:input.scenarioType,employeeId:input.employeeId,intent:"TRAINING",action:"submit_quiz",answer:"Ket qua: "+(gr.score_percent||0)+"% - Dung "+(gr.correct_count||0)+"/"+(gr.total_mcq||5)+" MCQ. "+(gr.overall_feedback||"")}}];'
      },
      id: 'quiz-grade-format',
      name: 'Format Grade Output',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1500, 580]
    },
    {
      parameters: {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify($json) }}',
        options: {}
      },
      id: 'respond-quiz-webhook',
      name: 'Respond Quiz Webhook',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.1,
      position: [1700, 580]
    },
    {
      parameters: {
        url: 'http://host.docker.internal:3001/api/v1/n8n/chat/session',
        method: 'POST',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ employeeId: $("Normalize Input").first().json.employeeId || null, type: "TRAINING", channel: $("Normalize Input").first().json.channel || "mobile", externalId: $("Normalize Input").first().json.employeeId || null }) }}',
        options: {}
      },
      id: 'get-session',
      name: 'Get/Create Session',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1100, 400],
      credentials: { httpHeaderAuth: { id: '__N8N_HEADER_AUTH_ID__', name: 'NestJS API Key' } }
    },
    {
      parameters: {
        jsCode:
          'const session=$input.first().json;const scenario=$("Load Scenario").first().json.scenarioData;const ri=$("Normalize Input").first().json;return[{json:{sessionId:session.id,maskedMessage:ri.maskedMessage,employeeId:ri.employeeId,scenarioRole:scenario.role,scenarioObjective:scenario.objective,scenarioDifficulty:scenario.difficulty}}];'
      },
      id: 'prep-agent-input',
      name: 'Prepare Agent Input',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1300, 400]
    },
    {
      parameters: {
        promptType: 'define',
        text: '={{ $("Normalize Input").first().json.maskedMessage }}',
        options: {
          maxIterations: 3,
          systemMessage: '={{ "Ban dang dong vai trong kich ban dao tao:\\nVai dien: " + $json.scenarioRole + ".\\nMuc tieu: " + $json.scenarioObjective + ".\\nDo kho: " + $json.scenarioDifficulty + ".\\n\\nHuong dan:\\n1) Phan ung TU NHIEN theo vai dien (tieng Viet)\\n2) Sau do CHAM DIEM cau tra loi TRUOC (neu co) theo format:\\n[DANH GIA: chuyen_nghiep=X, dong_cam=X, giai_quyet=X, ro_rang=X, tong=X, nhan_xet=text]\\n\\nX la so tu 0-10. Neu tin nhan dau tien thi khong cham, chi bat dau dong vai." }}'
        }
      },
      id: 'training-agent',
      name: 'Training Agent',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.7,
      position: [1500, 400]
    },
    {
      parameters: {
        modelName: 'models/gemini-2.5-flash',
        options: { temperature: 0.8, maxOutputTokens: 1024 }
      },
      id: 'gemini-training',
      name: 'Gemini Flash',
      type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
      typeVersion: 1,
      position: [1300, 700],
      credentials: { googlePalmApi: { id: 'saU5RHwXIHvauhiS', name: 'Google Gemini(PaLM) Api account' } }
    },
    {
      parameters: {
        sessionKey: '={{ $("Get/Create Session").first().json.id }}',
        tableName: 'n8n_chat_histories',
        contextWindowLength: 20
      },
      id: 'postgres-memory',
      name: 'Postgres Chat Memory',
      type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
      typeVersion: 1,
      position: [1500, 700],
      credentials: { postgres: { id: 'DImvfbYdTqnryV2B', name: 'HR System PostgreSQL' } }
    },
    {
      parameters: {
        jsCode:
          'const output=$input.first().json.output||"";const scoreMatch=output.match(/\\[DANH GIA:([^\\]]+)\\]/);let scoring=null;if(scoreMatch){const p=scoreMatch[1];const ex=(k)=>{const m=p.match(new RegExp(k+"=(\\\\d+(?:\\\\.\\\\d+)?)"));return m?parseFloat(m[1]):0;};const nx=p.match(/nhan_xet=(.+)/);scoring={scores:{professional:ex("chuyen_nghiep"),empathy:ex("dong_cam"),problem_solving:ex("giai_quyet"),clarity:ex("ro_rang")},total:ex("tong"),feedback:nx?nx[1].trim():""};}const rp=output.replace(/\\[DANH GIA:[^\\]]+\\]/,"").trim();const sessionId=$("Get/Create Session").first().json.id;const scenarioType=$("Load Scenario").first().json.scenarioType;return[{json:{roleplayResponse:rp,scoring,sessionId,scenarioType}}];'
      },
      id: 'parse-result',
      name: 'Parse Result',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1700, 400]
    },
    {
      parameters: {
        url: 'http://host.docker.internal:3001/api/v1/n8n/chat/message',
        method: 'POST',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ sessionId: $json.sessionId, role: "assistant", content: $json.roleplayResponse, metadata: { model: "gemini-2.5-flash", scenarioType: $json.scenarioType, scoring: $json.scoring } }) }}',
        options: {}
      },
      id: 'save-assistant',
      name: 'Save Assistant Message',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1900, 400],
      credentials: { httpHeaderAuth: { id: '__N8N_HEADER_AUTH_ID__', name: 'NestJS API Key' } }
    },
    {
      parameters: {
        jsCode:
          'const pr=$("Parse Result").first().json;return[{json:{answer:pr.roleplayResponse,roleplayResponse:pr.roleplayResponse,scoring:pr.scoring,sessionId:pr.sessionId,scenarioType:pr.scenarioType,intent:"TRAINING"}}];'
      },
      id: 'format-training-output',
      name: 'Format Training Output',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2100, 400]
    }
  ],
  pinData: {},
  connections: {
    'Input from Router': { main: [[{ node: 'Normalize Input', type: 'main', index: 0 }]] },
    'Training Quiz Webhook': { main: [[{ node: 'Normalize Input', type: 'main', index: 0 }]] },
    'Normalize Input': { main: [[{ node: 'Load Scenario', type: 'main', index: 0 }]] },
    'Load Scenario': { main: [[{ node: 'Action Switch', type: 'main', index: 0 }]] },
    'Action Switch': {
      main: [
        [{ node: 'Build Quiz Gen Prompt', type: 'main', index: 0 }],
        [{ node: 'Build Quiz Grade Prompt', type: 'main', index: 0 }],
        [{ node: 'Get/Create Session', type: 'main', index: 0 }]
      ]
    },
    'Build Quiz Gen Prompt': { main: [[{ node: 'Quiz Generator Agent', type: 'main', index: 0 }]] },
    'Quiz Generator Agent': { main: [[{ node: 'Format Quiz Output', type: 'main', index: 0 }]] },
    'Build Quiz Grade Prompt': { main: [[{ node: 'Quiz Grader Agent', type: 'main', index: 0 }]] },
    'Quiz Grader Agent': { main: [[{ node: 'Format Grade Output', type: 'main', index: 0 }]] },
    'Format Grade Output': { main: [[{ node: 'Respond Quiz Webhook', type: 'main', index: 0 }]] },
    'Get/Create Session': { main: [[{ node: 'Prepare Agent Input', type: 'main', index: 0 }]] },
    'Prepare Agent Input': { main: [[{ node: 'Training Agent', type: 'main', index: 0 }]] },
    'Training Agent': { main: [[{ node: 'Parse Result', type: 'main', index: 0 }]] },
    'Parse Result': { main: [[{ node: 'Save Assistant Message', type: 'main', index: 0 }]] },
    'Save Assistant Message': { main: [[{ node: 'Format Training Output', type: 'main', index: 0 }]] },
    'Gemini Flash': {
      ai_languageModel: [
        [{ node: 'Quiz Generator Agent', type: 'ai_languageModel', index: 0 }],
        [{ node: 'Quiz Grader Agent', type: 'ai_languageModel', index: 0 }],
        [{ node: 'Training Agent', type: 'ai_languageModel', index: 0 }]
      ]
    },
    'Postgres Chat Memory': { ai_memory: [[{ node: 'Training Agent', type: 'ai_memory', index: 0 }]] }
  },
  active: false,
  settings: { executionOrder: 'v1' },
  tags: [],
  meta: { templateCredsSetupCompleted: false }
};

fs.writeFileSync('n8n-workflows/03-training-agent.json', JSON.stringify(wf3, null, 2));
// Validate by re-reading
const verify = JSON.parse(fs.readFileSync('n8n-workflows/03-training-agent.json', 'utf-8'));
console.log('WF03 valid! Nodes:', verify.nodes.length, 'Has webhook:', verify.nodes.some(n => n.id === 'training-webhook'));
