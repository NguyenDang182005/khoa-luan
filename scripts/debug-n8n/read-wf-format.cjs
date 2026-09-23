const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
db.get('SELECT nodes, connections FROM workflow_history WHERE versionId = ?', ['532db84e-0006-4d8e-ae36-ee13dddfdd01'], (e, row) => {
  if (e) { console.error('ERR', e.message); process.exit(1); }
  const nodes = JSON.parse(row.nodes);
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.executeWorkflow') {
      console.log(`EXEC NODE ${n.name} v=${n.typeVersion}`);
      console.log(JSON.stringify(n.parameters));
    }
  }
  console.log('node list:', nodes.map((n) => `${n.name}(${n.type} v${n.typeVersion})`).join(' | '));
  db.close();
});
