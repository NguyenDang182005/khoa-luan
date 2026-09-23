// Build a fixed WF01 graph file inside the container for n8n import:workflow.
// Fixes: executeWorkflow resource locators (__rl), Direct Answer patch, proper Respond OTHER.
const fs = require('fs');
const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');

db.get('SELECT nodes, connections, name, settings FROM workflow_entity WHERE id = ?', ['7vjmoqJQzUjJCr4G'], (e, row) => {
  if (e) { console.error('ERR', e.message); process.exit(1); }
  const nodes = JSON.parse(row.nodes);
  const conns = JSON.parse(row.connections);

  // 1) Fix executeWorkflow resource locators
  const KNOWN_SUBWORKFLOWS = {
    'Execute HR Q&A Agent': 'oy5rWkKaus7wiacX',
    'Execute Training Agent': '7EZ6MXJZzPx1fDlu',
    'Execute CSKH Agent': 'QvguLO7il2BRO1on',
  };
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.executeWorkflow') {
      const p = n.parameters || {};
      const wfId = p.workflowId && typeof p.workflowId === 'object' ? p.workflowId.value : p.workflowId;
      const resolved = wfId || KNOWN_SUBWORKFLOWS[n.name];
      if (!resolved) { console.error(`exec node ${n.name} has no workflowId value!`); process.exit(1); }
      n.parameters = {
        workflowId: { __rl: true, value: String(resolved), mode: 'id' },
        options: p.options || {},
      };
    }
  }

  // 2) Ensure Direct Answer node exists (idempotent)
  if (!nodes.some((n) => n.name === 'Direct Answer')) {
    nodes.push({
      parameters: {
        promptType: 'define',
        text: '={{ $json.originalMessage || $json.maskedMessage }}',
        options: { maxIterations: 2, returnIntermediateSteps: false },
        systemMessage: [
          'Ban la tro ly ao cua cong ty (kenh chat tong quat).',
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
    conns['Gemini Flash']['ai_languageModel'][0].push({ node: 'Direct Answer', type: 'ai_languageModel', index: 0 });
    conns['Route by Intent'].main[3] = [{ node: 'Direct Answer', type: 'main', index: 0 }];
    conns['Direct Answer'] = { main: [[{ node: 'Respond OTHER', type: 'main', index: 0 }]] };
  }

  // 3) Respond OTHER returns proper answer payload
  for (const n of nodes) {
    if (n.name === 'Respond OTHER') {
      n.parameters = {
        respondWith: 'json',
        responseBody: '={{ JSON.stringify({ answer: $json.output || "Xin loi, hien tai toi chua tra loi duoc cau hoi nay.", intent: "OTHER" }) }}',
      };
    }
  }

  const out = {
    id: '3f8ac2e1-7c4d-4e8a-9b1f-2d5e6a7b8c9d',
    name: '01 - Router Agent (fixed)',
    active: false,
    nodes,
    connections: conns,
    settings: row.settings ? JSON.parse(row.settings) : {},
    meta: { templateCredsSetupCompleted: true },
  };
  fs.writeFileSync('/home/node/wf01-fixed.json', JSON.stringify(out, null, 2), 'utf8');
  console.log('written /home/node/wf01-fixed.json with nodes: ' + nodes.map((n) => n.name).join(' | '));
  db.close();
});
