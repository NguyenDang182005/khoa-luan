const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
db.all(
  "SELECT name, sql FROM sqlite_master WHERE type='table' AND (name LIKE 'execution%' OR name LIKE 'workflow%')",
  (err, rows) => {
    if (err) { console.error('ERR', err.message); process.exit(1); }
    for (const r of rows) console.log(`--- ${r.name}\n${r.sql}\n`);
    db.close();
  },
);
