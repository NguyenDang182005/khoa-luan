const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
(async () => {
  const WF = '7vjmoqJQzUjJCr4G';
  const entity = await get('SELECT nodes, activeVersionId FROM workflow_entity WHERE id = ?', [WF]);
  const hist = await get('SELECT nodes FROM workflow_history WHERE versionId = ?', [entity.activeVersionId]);
  for (const [label, raw] of [['ENTITY', entity.nodes], ['HISTORY', hist.nodes]]) {
    const nodes = JSON.parse(raw);
    const exec = nodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflow');
    console.log(`${label}: exec node = ${JSON.stringify(exec ? exec.parameters : null)}`);
  }
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
