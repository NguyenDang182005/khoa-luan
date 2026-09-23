const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const zlib = require('zlib');
const db = new Database.Database('/home/node/.n8n/database.sqlite');
const get = (sql, params = []) =>
  new Promise((res, rej) => db.get(sql, params, (e, r) => (e ? rej(e) : res(r))));
const all = (sql, params = []) =>
  new Promise((res, rej) => db.all(sql, params, (e, r) => (e ? rej(e) : res(r))));

function decode(row) {
  let buf = row.data;
  if (typeof buf === 'string') buf = Buffer.from(buf, 'binary');
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  return JSON.parse(buf.toString('utf8'));
}

(async () => {
  const wfId = process.argv[2] || '';
  if (wfId === '--tools') {
    const wf = await get('SELECT nodes FROM workflow_entity WHERE id = ?', [process.argv[3]]);
    const nodes = JSON.parse(wf.nodes);
    for (const n of nodes) {
      if (n.type === '@n8n/n8n-nodes-langchain.toolHttpRequest') {
        console.log(`--- TOOL ${n.name}`);
        console.log(JSON.stringify(n.parameters, null, 1).slice(0, 900));
      }
      if (n.type === '@n8n/n8n-nodes-langchain.memoryPostgresChat') {
        console.log(`--- MEMORY ${n.name}`);
        console.log(JSON.stringify(n.parameters, null, 1).slice(0, 500));
      }
    }
    db.close();
    return;
  }

  // default: summarize latest executions of the workflow, with per-node timing + errors
  const rows = await all(
    'SELECT e.id, e.status, e."startedAt" FROM execution_entity e WHERE e."workflowId" = ? ORDER BY e.id DESC LIMIT 3',
    [process.argv[2]],
  );
  for (const row of rows) {
    console.log(`=== execution ${row.id} status=${row.status} started=${row.startedAt}`);
    const dataRow = await get('SELECT data FROM execution_data WHERE "executionId" = ?', [row.id]);
    if (!dataRow) { console.log('  (no data)'); continue; }
    let data;
    try { data = decode(dataRow); } catch (e) { console.log(`  decode err: ${e.message}`); continue; }
    // data uses a string-intern table: value "N" refers to index N in the array
    const tbl = Array.isArray(data) ? data : null;
    const deref = (v, depth = 0) => {
      if (tbl && typeof v === 'string' && /^\d+$/.test(v) && depth < 8) {
        return deref(tbl[Number(v)], depth + 1);
      }
      if (Array.isArray(v)) return v.map((x) => deref(x, depth + 1));
      if (v && typeof v === 'object') {
        const o = {};
        for (const [k, val] of Object.entries(v)) o[k] = deref(val, depth + 1);
        return o;
      }
      return v;
    };
    const d = deref(data);
    const meta = Array.isArray(d) ? d[0] : d;
    const result = meta.resultData || (d['2'] && d['2'].resultData) || {};
    const run = result.runData || {};
    const wantOut = process.argv[3] || '';
    for (const [node, runs] of Object.entries(run)) {
      for (const r of runs || []) {
        const t = r.executionTime != null ? ` ${r.executionTime}ms` : '';
        const err = r.error ? ` ERROR: ${(r.error.message || JSON.stringify(r.error)).slice(0, 200)}` : '';
        console.log(`  node ${node}${t}${err}`);
        if (wantOut && node === wantOut && r.data && r.data.main) {
          for (const branch of r.data.main) {
            for (const item of branch || []) {
              console.log(`    OUT: ${JSON.stringify(item.json).slice(0, 1200)}`);
            }
          }
        }
      }
    }
  }
  db.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
