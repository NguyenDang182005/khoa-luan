// Dump all Gemini/lmChat node modelName configs across live workflows.
const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
(async () => {
  const wfs = await all('SELECT id, name, nodes, active FROM workflow_entity');
  for (const wf of wfs) {
    const nodes = JSON.parse(wf.nodes);
    for (const n of nodes) {
      if (n.type && n.type.includes('lmChat') || n.type && n.type.includes('Gemini')) {
        console.log(`[${wf.name}${wf.active ? ' ACTIVE' : ''}] node "${n.name}" type=${n.type}`);
        console.log(`   parameters: ${JSON.stringify(n.parameters)}`);
        console.log(`   credentials: ${JSON.stringify(n.credentials || null)}`);
      }
    }
  }
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
