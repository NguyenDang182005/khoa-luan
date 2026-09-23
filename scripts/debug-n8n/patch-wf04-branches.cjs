// Fix WF04 dead-end branches: route IF(false) and Escalate-to-Admin into "Format CSKH Output"
// so the sub-workflow ALWAYS returns the formatted {answer,...} item to the router.
const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, (e) => (e ? rej(e) : res())));
const WF = 'YRgkOqjnxEXAwhoK';

function fixConnections(conns) {
  conns['Should Escalate?'] = conns['Should Escalate?'] || { main: [[], []] };
  const branches = conns['Should Escalate?'].main;
  branches[0] = branches[0] || []; // true -> Escalate to Admin
  branches[1] = branches[1] || []; // false -> (empty today)
  if (!branches[0].some((c) => c.node === 'Escalate to Admin'))
    branches[0].push({ node: 'Escalate to Admin', type: 'main', index: 0 });
  if (!branches[1].some((c) => c.node === 'Format CSKH Output'))
    branches[1].push({ node: 'Format CSKH Output', type: 'main', index: 0 });
  conns['Escalate to Admin'] = conns['Escalate to Admin'] || { main: [[]] };
  if (!conns['Escalate to Admin'].main[0].some((c) => c.node === 'Format CSKH Output'))
    conns['Escalate to Admin'].main[0].push({ node: 'Format CSKH Output', type: 'main', index: 0 });
  return conns;
}

(async () => {
  const entity = await get('SELECT nodes, connections, activeVersionId FROM workflow_entity WHERE id = ?', [WF]);
  const conns = fixConnections(JSON.parse(entity.connections));
  await run('UPDATE workflow_entity SET connections = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ?', [
    JSON.stringify(conns), WF,
  ]);
  const hist = await get('SELECT connections FROM workflow_history WHERE versionId = ?', [entity.activeVersionId]);
  if (hist) {
    await run('UPDATE workflow_history SET connections = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE versionId = ?', [
      JSON.stringify(fixConnections(JSON.parse(hist.connections))), entity.activeVersionId,
    ]);
    console.log(`patched entity + history ${entity.activeVersionId}`);
  } else {
    console.log('patched entity only (no active history row)');
  }
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
