const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
// n8n uses typeorm; raw sqlite3 async API is awkward. Try better-sqlite3 style first is unavailable,
// so instead use the sqlite3 callback API wrapped in promises.
const db = new Database.Database('/home/node/.n8n/database.sqlite');

const q = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))),
  );

(async () => {
  const workflows = await q(
    'SELECT id, name, active FROM workflow_entity ORDER BY "updatedAt" DESC',
  );
  console.log('=== WORKFLOWS (live) ===');
  for (const w of workflows) console.log(`id=${w.id} active=${w.active} name=${w.name}`);

  console.log('=== LAST 8 EXECUTIONS ===');
  const execs = await q(
    'SELECT id, "workflowId", mode, status, "startedAt", "stoppedAt" FROM execution_entity ORDER BY id DESC LIMIT 8',
  );
  for (const e of execs)
    console.log(
      `id=${e.id} wf=${e.workflowId} mode=${e.mode} status=${e.status} started=${e.startedAt} stopped=${e.stoppedAt}`,
    );

  db.close();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
