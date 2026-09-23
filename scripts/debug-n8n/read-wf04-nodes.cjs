// Print full parameters of WF04 code/if nodes.
const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
db.get('SELECT nodes FROM workflow_entity WHERE id = ?', ['YRgkOqjnxEXAwhoK'], (e, row) => {
  if (e) { console.error('ERR', e.message); process.exit(1); }
  const nodes = JSON.parse(row.nodes);
  for (const n of nodes) {
    if (['Parse CSKH Output', 'Should Escalate?', 'Format CSKH Output', 'Parse Zalo Message'].includes(n.name)) {
      console.log(`===== ${n.name}`);
      for (const [k, v] of Object.entries(n.parameters)) {
        console.log(`${k}: ${typeof v === 'string' ? v.slice(0, 700) : JSON.stringify(v).slice(0, 300)}`);
      }
    }
  }
  db.close();
});
