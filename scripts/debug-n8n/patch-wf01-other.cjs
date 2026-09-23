// Patch WF01 (live n8n DB): OTHER branch — Gemini direct answer instead of error payload.
// Idempotent: safe to run multiple times.
const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const WF = '7vjmoqJQzUjJCr4G';

db.get('SELECT nodes, connections FROM workflow_entity WHERE id = ?', [WF], (e, row) => {
  if (e) { console.error('ERR', e.message); process.exit(1); }
  const nodes = JSON.parse(row.nodes);
  const conns = JSON.parse(row.connections);

  if (nodes.some((n) => n.name === 'Direct Answer')) {
    console.log('Direct Answer already present — nothing to do');
    db.close();
    return;
  }

  // 1) New agent node for direct answers
  nodes.push({
    parameters: {
      promptType: 'define',
      text: '={{ $json.originalMessage || $json.maskedMessage }}',
      options: { maxIterations: 2, returnIntermediateSteps: false },
      systemMessage: [
        'Ban la tro ly ao cua cong ty (kennh chat tong quat).',
        'Cau hoi cua nguoi dung KHONG thuoc phan he nhan su/chinh sach — hay tra loi ngan gon, than thien, bang tieng Viet (2-4 cau).',
        'Neu cau hoi thuoc phan he nhan su (luong, phep, hop dong, cham cong, dao tao, cham soc khach hang), hay lich su huong dan nguoi dung chon dung chuc nang tuong ung trong he thong.',
        'Khong bia dat thong tin noi bo cua cong ty.',
      ].join('\n'),
    },
    id: 'direct-answer',
    name: 'Direct Answer',
    type: '@n8n/n8n-nodes-langchain.agent',
    typeVersion: 1.7,
    position: [1344, 656],
  });

  // 2) Reuse the same Gemini chat model for the new agent
  conns['Gemini Flash']['ai_languageModel'][0].push({
    node: 'Direct Answer', type: 'ai_languageModel', index: 0,
  });

  // 3) Fallback output (index 3) now feeds Direct Answer
  conns['Route by Intent'].main[3] = [
    { node: 'Direct Answer', type: 'main', index: 0 },
  ];

  // 4) Direct Answer -> Respond OTHER
  conns['Direct Answer'] = { main: [[{ node: 'Respond OTHER', type: 'main', index: 0 }]] };

  // 5) Respond OTHER returns a proper { answer } payload
  for (const n of nodes) {
    if (n.name === 'Respond OTHER') {
      n.parameters = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ answer: $json.output || "Xin loi, hien tai toi chua tra loi duoc cau hoi nay.", intent: "OTHER" }) }}',
      };
    }
  }

  db.run(
    'UPDATE workflow_entity SET nodes = ?, connections = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(nodes), JSON.stringify(conns), WF],
    (e2) => {
      if (e2) { console.error('ERR update', e2.message); process.exit(1); }
      console.log('WF01 patched: OTHER -> Direct Answer (Gemini) -> Respond OTHER {answer,intent}');
      db.close();
    },
  );
});
