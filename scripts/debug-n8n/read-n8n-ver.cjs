const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
(async () => {
  const WF = '7vjmoqJQzUjJCr4G';
  const pub = await all('SELECT * FROM workflow_published_version WHERE workflowId = ?', [WF]);
  console.log('published_version rows:', JSON.stringify(pub));
  const hist = await all('SELECT versionId, createdAt, autosaved, length(nodes) AS nlen FROM workflow_history WHERE workflowId = ? ORDER BY createdAt DESC LIMIT 5', [WF]);
  console.log('history rows:', JSON.stringify(hist));
  const cur = await all('SELECT activeVersionId, versionId, "updatedAt" FROM workflow_entity WHERE id = ?', [WF]);
  console.log('entity:', JSON.stringify(cur));
  const latest = await all('SELECT nodes FROM workflow_history WHERE workflowId = ? ORDER BY createdAt DESC LIMIT 1', [WF]);
  if (latest[0]) {
    const nodes = JSON.parse(latest[0].nodes);
    console.log('latest history nodes:', nodes.map((n) => n.name).join(' | '));
  }
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
