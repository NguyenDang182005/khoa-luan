// List latest executions of a workflow (no data parsing) + optionally count today's.
const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
(async () => {
  const WF = process.argv[2] || '3f8ac2e1-7c4d-4e8a-9b1f-2d5e6a7b8c9d';
  const rows = await all(
    'SELECT id, status, mode, "startedAt" FROM execution_entity WHERE "workflowId" = ? ORDER BY id DESC LIMIT 10',
    [WF],
  );
  for (const r of rows) console.log(`id=${r.id} ${r.status} ${r.mode} ${r.startedAt}`);
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
