// Dump execution result data (tolerant of control chars in stored JSON).
const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const zlib = require('zlib');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));

function decode(row) {
  let buf = row.data;
  if (typeof buf === 'string') buf = Buffer.from(buf, 'binary');
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  const text = buf.toString('utf8').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
  return JSON.parse(text);
}

(async () => {
  const id = process.argv[2];
  const row = await get('SELECT d.data AS data, e."deduplicationKey" AS dk FROM execution_data d JOIN execution_entity e ON e.id = d."executionId" WHERE d."executionId" = ?', [id]);
  const data = decode(row);
  const tbl = Array.isArray(data) ? data : null;
  const deref = (v, depth = 0) => {
    if (tbl && typeof v === 'string' && /^\d+$/.test(v) && depth < 10) return deref(tbl[Number(v)], depth + 1);
    if (Array.isArray(v)) return v.map((x) => deref(x, depth + 1));
    if (v && typeof v === 'object') { const o = {}; for (const [k, val] of Object.entries(v)) o[k] = deref(val, depth + 1); return o; }
    return v;
  };
  const d = deref(data);
  const meta = Array.isArray(d) ? d[0] : d;
  const result = meta.resultData || {};
  console.log(`dedupKey: ${row.dk}`);
  console.log(`lastNodeExecuted: ${result.lastNodeExecuted}`);
  const run = result.runData || {};
  const last = process.argv[3];
  for (const [node, runs] of Object.entries(run)) {
    console.log(`node ${node}`);
    if (last && node === last) {
      for (const r of runs || []) {
        const s = JSON.stringify(r.data);
        console.log(`  DATA: ${s ? s.slice(0, 600) : 'null'}`);
      }
    }
  }
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
