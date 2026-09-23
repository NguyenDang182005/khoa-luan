const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
(async () => {
  const rows = await all('SELECT * FROM webhook_entity');
  console.log(JSON.stringify(rows, null, 1));
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
