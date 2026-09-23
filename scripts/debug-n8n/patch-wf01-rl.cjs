// Fix executeWorkflow resource-locator params (__rl: true) in entity + active history version.
const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, (e) => (e ? rej(e) : res())));

function fixExecNodes(nodes) {
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.executeWorkflow' && n.parameters && n.parameters.workflowId) {
      const wfId = n.parameters.workflowId;
      if (typeof wfId === 'object' && wfId.value && !wfId.__rl) {
        n.parameters.workflowId = { __rl: true, value: String(wfId.value), mode: wfId.mode || 'id' };
        console.log(`  fixed exec node: ${n.name} -> __rl rl-value ${wfId.value}`);
      }
    }
  }
  return nodes;
}

(async () => {
  const WF = '7vjmoqJQzUjJCr4G';
  const entity = await get('SELECT nodes, connections, activeVersionId FROM workflow_entity WHERE id = ?', [WF]);

  const entNodes = fixExecNodes(JSON.parse(entity.nodes));
  await run('UPDATE workflow_entity SET nodes = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ?', [
    JSON.stringify(entNodes), WF,
  ]);

  const hist = await get('SELECT nodes FROM workflow_history WHERE versionId = ?', [entity.activeVersionId]);
  const histNodes = fixExecNodes(JSON.parse(hist.nodes));
  await run('UPDATE workflow_history SET nodes = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE versionId = ?', [
    JSON.stringify(histNodes), entity.activeVersionId,
  ]);

  console.log('done');
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
