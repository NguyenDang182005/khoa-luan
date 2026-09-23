// [diag-input] V2 — đối chiếu 2 execution WF03 gần nhất: quiz call vs roleplay call
const BASE = 'http://localhost:5678'
const EMAIL = 'haidangnguyen1214@gmail.com'
const PASS = 'Lolnamdotavn182005@'

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
  const tr = list.data.results.filter((x) => x.workflowName.includes('Training'))
  console.log('WF03 gần nhất: ' + tr.map((x) => x.id + ':' + x.status).join(', '))
  for (const ex of tr.slice(0, 2)) {
    const j = await (await fetch(`${BASE}/rest/executions/${ex.id}?includeData=true`, { headers: h })).json()
    const e = j.data ?? j
    const T = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    const s = typeof T === 'string' ? T : JSON.stringify(T)
    console.log('--- exec ' + ex.id + ' ' + ex.status + ' ---')
    for (const kw of ['generate_quiz', 'Build Quiz Gen Prompt', 'Quiz Generator Agent', 'Save Quiz Assistant Message', 'Training Agent']) {
      console.log('  ' + kw + ' : ' + (s.includes(kw) ? 'CO' : 'khong'))
    }
    const m = s.match(/action\\?":\\?"?([a-z_]+|\d{1,4})/g)
    if (m) console.log('  action refs: ' + m.slice(0, 4).join(' | '))
  }
}
main().catch((e) => console.log('ERR', e.message))
