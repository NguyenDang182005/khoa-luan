const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
(async () => {
  const users = await all('SELECT id, email, "firstName" FROM user LIMIT 5');
  console.log('users:', JSON.stringify(users));
  let projects = [];
  try { projects = await all('SELECT id, name, type FROM project LIMIT 5'); } catch (e) { projects = [{ err: e.message }]; }
  console.log('projects:', JSON.stringify(projects));
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
