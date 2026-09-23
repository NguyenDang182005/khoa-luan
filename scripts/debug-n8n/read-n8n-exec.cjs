const Database = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const zlib = require('zlib');

const db = new Database.Database('/home/node/.n8n/database.sqlite');

const get = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))),
  );

(async () => {
  const id = process.argv[2] || '147';
  const row = await get(
    'SELECT d.data AS data FROM execution_data d WHERE d."executionId" = ?',
    [id],
  );
  if (!row || !row.data) { console.log('no data'); return; }
  let buf = row.data;
  if (typeof buf === 'string') buf = Buffer.from(buf, 'binary'); // sqlite TEXT holding raw bytes
  // n8n stores execution data gzip-compressed (magic 1f 8b)
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  const data = JSON.parse(buf.toString('utf8'));
  console.log(`top-level keys: ${Object.keys(data).join(', ')}`);
  const rd = data.resultData || data.data?.resultData;
  if (!rd) {
    // dump a shallow preview of whatever structure exists
    const preview = JSON.stringify(data, (k, v) =>
      typeof v === 'string' && v.length > 200 ? v.slice(0, 200) + '…' : v,
    );
    console.log(preview.slice(0, 2500));
    db.close();
    return;
  }
  const out = {
    lastNodeExecuted: rd.lastNodeExecuted,
    error: rd.error,
  };
  console.log(JSON.stringify(out, null, 2).slice(0, 3000));
  // per-node error hints
  const run = rd.runData || {};
  for (const [node, runs] of Object.entries(run)) {
    for (const r of runs || []) {
      if (r.error) {
        console.log(`NODE ERROR [${node}]: ${JSON.stringify(r.error).slice(0, 800)}`);
      }
    }
  }
  db.close();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
