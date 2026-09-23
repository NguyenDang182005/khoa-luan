const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
db.get('SELECT nodes, connections, settings FROM workflow_entity WHERE id = ?', [process.argv[2]], (e, row) => {
  if (e) { console.error('ERR', e.message); process.exit(1); }
  const nodes = JSON.parse(row.nodes);
  const conns = JSON.parse(row.connections);
  const mode = process.argv[3] || '';
  if (mode === 'creds') {
    db.all('SELECT id, name, type FROM credentials_entity', (e2, rows) => {
      if (e2) { console.error('ERR', e2.message); process.exit(1); }
      for (const r of rows) console.log(`cred id=${r.id} name=${r.name} type=${r.type}`);
      db.close();
    });
    return;
  }
  for (const n of nodes) {
    console.log(`NODE ${JSON.stringify(n.name)} type=${n.type} v=${n.typeVersion} pos=${JSON.stringify(n.position)} id=${n.id} creds=${JSON.stringify(n.credentials || null)}`);
  }
  console.log('CONNECTIONS ' + JSON.stringify(conns));
  db.close();
});
