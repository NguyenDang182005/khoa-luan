// [diag-exec] V4 — quét N execution gần nhất của WF03: node lỗi + message
const BASE = 'http://localhost:5678'
const EMAIL = 'haidangnguyen1214@gmail.com'
const PASS = 'Lolnamdotavn182005@'
const N = Number(process.argv[2] ?? 4)

const deref1 = (T, v) => (typeof v === 'string' && /^\d+$/.test(v) && Number(v) < T.length ? T[Number(v)] : v)

const main = async () => {
  const res = await fetch(`${BASE}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS, mfaCode: '' }),
    redirect: 'manual',
  })
  const ck = (res.headers.get('set-cookie') || '').split(',').map((c) => c.split(';')[0].trim()).join('; ')
  const h = { Cookie: ck, Connection: 'close' }
  const list = await (await fetch(`${BASE}/rest/executions?limit=15&includeData=false`, { headers: h })).json()
  const tr = list.data.results.filter((x) => x.workflowName.includes('Training')).slice(0, N)
  for (const ex of tr) {
    const j = await (await fetch(`${BASE}/rest/executions/${ex.id}?includeData=true`, { headers: h })).json()
    const e = j.data ?? j
    const T = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    const entry = (Array.isArray(T) ? T : []).find((x) => x && typeof x === 'object' && 'resultData' in x)
    let R = deref1(T, entry.resultData)
    if (typeof R === 'string') R = deref1(T, R)
    const target = String(deref1(T, R.lastNodeExecuted))
    let E = {}
    try {
      const rd = deref1(T, R.runData)
      let runs = deref1(T, rd[target])
      const run = Array.isArray(runs) ? deref1(T, runs[0]) : runs
      E = deref1(T, deref1(T, run.error))
    } catch { /* ignore */ }
    const val = (x) => { const d = deref1(T, x); return typeof d === 'object' ? JSON.stringify(d)?.slice(0, 160) : JSON.stringify(d)?.slice(0, 160) }
    console.log(`exec=${ex.id} ${ex.status} lastNode=${target}`)
    if (E.name) console.log(`   err=${val(E.name)} http=${val(E.httpCode)} msg=${val(E.message)}`)
  }
}
main().catch((e) => console.log('ERR', e.message))
