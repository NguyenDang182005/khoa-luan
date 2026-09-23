// Check + patch the workflow_history version that activeVersionId points to.
const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, (e) => (e ? rej(e) : res())));

(async () => {
  const WF = '7vjmoqJQzUjJCr4G';
  const entity = await get('SELECT nodes, connections, activeVersionId, versionId FROM workflow_entity WHERE id = ?', [WF]);
  const hist = await get('SELECT nodes, connections FROM workflow_history WHERE versionId = ?', [entity.activeVersionId]);
  const histHasDirect = hist.nodes.includes('Direct Answer');
  const entHasDirect = entity.nodes.includes('Direct Answer');
  console.log(`entity.nodes has Direct Answer: ${entHasDirect}`);
  console.log(`history(${entity.activeVersionId}) has Direct Answer: ${histHasDirect}`);

  if (histHasDirect) { console.log('history already patched'); db.close(); return; }

  // Use the patched entity graph as the new active version content
  await run(
    'UPDATE workflow_history SET nodes = ?, connections = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE versionId = ?',
    [entity.nodes, entity.connections, entity.activeVersionId],
  );
  const after = await get('SELECT nodes FROM workflow_history WHERE versionId = ?', [entity.activeVersionId]);
  console.log(`history patched, now has Direct Answer: ${after.nodes.includes('Direct Answer')}`);
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
