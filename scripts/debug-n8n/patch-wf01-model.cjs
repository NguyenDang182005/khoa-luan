// Pin modelName=models/gemini-2.5-flash on WF01(fixed) "Gemini Flash" node.
// Updates BOTH workflow_entity.nodes and the active workflow_history version (n8n 2.x executes the active version).
const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, (e) => (e ? rej(e) : res())));
const WF = '3f8ac2e1-7c4d-4e8a-9b1f-2d5e6a7b8c9d';
const MODEL = 'models/gemini-2.5-flash';

function pinModel(nodesJson) {
  const nodes = JSON.parse(nodesJson);
  for (const n of nodes) {
    if (n.name === 'Gemini Flash' && n.type === '@n8n/n8n-nodes-langchain.lmChatGoogleGemini') {
      n.parameters = { modelName: MODEL, ...(n.parameters || {}) };
    }
  }
  return JSON.stringify(nodes);
}

(async () => {
  const entity = await get('SELECT nodes, activeVersionId FROM workflow_entity WHERE id = ?', [WF]);
  const fixedEntity = pinModel(entity.nodes);
  await run('UPDATE workflow_entity SET nodes = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ?', [fixedEntity, WF]);

  const hist = await get('SELECT nodes FROM workflow_history WHERE versionId = ?', [entity.activeVersionId]);
  if (hist) {
    const fixedHist = pinModel(hist.nodes);
    await run('UPDATE workflow_history SET nodes = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE versionId = ?', [fixedHist, entity.activeVersionId]);
    console.log(`pinned modelName in entity + history ${entity.activeVersionId}`);
  } else {
    console.log('no active history row — pinned entity only');
  }
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
