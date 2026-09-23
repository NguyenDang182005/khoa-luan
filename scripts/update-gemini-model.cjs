// update-gemini-model.cjs
// Cập nhật model sang gemini-3.1-flash-lite trên tất cả workflow n8n
const EMAIL = 'haidangnguyen1214@gmail.com';
const PASS  = 'Lolnamdotavn182005@';
const BASE  = 'http://localhost:5678';
const NEW_MODEL = 'models/gemini-3.1-flash-lite';

async function main() {
  const r = await fetch(`${BASE}/rest/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: EMAIL, password: PASS, mfaCode: '' })
  });
  const cookies = (r.headers.get('set-cookie') || '').split(',').map(c => c.split(';')[0].trim()).join('; ');
  const h = { 'Content-Type': 'application/json', Cookie: cookies };

  // Fetch all workflows
  const wfs = await (await fetch(`${BASE}/rest/workflows`, { headers: h })).json();
  if (!wfs.data) {
    throw new Error('Could not fetch workflows: ' + JSON.stringify(wfs));
  }

  for (const item of wfs.data) {
    const cur = await (await fetch(`${BASE}/rest/workflows/${item.id}`, { headers: h })).json();
    const wf = cur.data;
    let updated = 0;

    wf.nodes = wf.nodes.map(n => {
      if (n.type === '@n8n/n8n-nodes-langchain.lmChatGoogleGemini') {
        const old = n.parameters.modelName;
        n.parameters.modelName = NEW_MODEL;
        console.log(`  [${wf.name}] Node "${n.name}": ${old} -> ${NEW_MODEL}`);
        updated++;
      }
      if (n.type === 'n8n-nodes-base.httpRequest' && n.parameters?.jsonBody) {
        if (typeof n.parameters.jsonBody === 'string' && n.parameters.jsonBody.includes('gemini-2.5-flash')) {
          n.parameters.jsonBody = n.parameters.jsonBody.replaceAll('gemini-2.5-flash', 'gemini-3.1-flash-lite');
          console.log(`  [${wf.name}] Node "${n.name}": updated metadata model to gemini-3.1-flash-lite`);
          updated++;
        }
      }
      return n;
    });

    if (updated > 0) {
      const wasActive = wf.active;
      if (wasActive) {
        await fetch(`${BASE}/rest/workflows/${item.id}/deactivate`, { method: 'POST', headers: h });
      }
      const p = await (await fetch(`${BASE}/rest/workflows/${item.id}`, {
        method: 'PATCH', headers: h,
        body: JSON.stringify({ ...wf, id: item.id, versionId: wf.versionId })
      })).json();

      let a = { data: { active: false } };
      if (wasActive) {
        a = await (await fetch(`${BASE}/rest/workflows/${item.id}/activate`, {
          method: 'POST', headers: h,
          body: JSON.stringify({ versionId: p.data?.versionId })
        })).json();
      }
      console.log(`✅ [${wf.name}] (ID: ${item.id}) updated (${updated} nodes). Active=${a.data?.active ? '✅' : '❌'}`);
    } else {
      console.log(`ℹ️ [${wf.name}] (ID: ${item.id}): No Gemini nodes need update.`);
    }
  }

  console.log(`\n🎉 Tất cả workflows trên n8n đã được cập nhật sang ${NEW_MODEL}!`);
}

main().catch(e => console.error('FATAL:', e.message));
