// Point live WF01(fixed) Execute CSKH Agent at the real live CSKH workflow id.
const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, (e) => (e ? rej(e) : res())));
const WF = '3f8ac2e1-7c4d-4e8a-9b1f-2d5e6a7b8c9d';
const CSKH_ID = 'YRgkOqjnxEXAwhoK';

function fix(nodesJson) {
  const nodes = JSON.parse(nodesJson);
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.executeWorkflow' && n.name === 'Execute CSKH Agent') {
      n.parameters.workflowId = { __rl: true, value: CSKH_ID, mode: 'id' };
    }
  }
  return JSON.stringify(nodes);
}

(async () => {
  const entity = await get('SELECT nodes, activeVersionId FROM workflow_entity WHERE id = ?', [WF]);
  const before = entity.nodes.includes('QvguLO7il2BRO1on') ? 'QvguLO7il2BRO1on' : 'already YRgk?';
  const fixedEntity = fix(entity.nodes);
  await run('UPDATE workflow_entity SET nodes = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ?', [fixedEntity, WF]);
  const hist = await get('SELECT nodes FROM workflow_history WHERE versionId = ?', [entity.activeVersionId]);
  if (hist) {
    await run('UPDATE workflow_history SET nodes = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE versionId = ?', [fix(hist.nodes), entity.activeVersionId]);
  }
  console.log(`CSKH ref: ${before} -> ${CSKH_ID} (entity + history ${entity.activeVersionId})`);
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
