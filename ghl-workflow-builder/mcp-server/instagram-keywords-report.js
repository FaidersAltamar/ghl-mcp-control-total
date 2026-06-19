import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '.env'), 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length) acc[k.trim()] = v.join('=').trim();
    return acc;
  }, {});

const refreshToken = env.GHL_FIREBASE_REFRESH_TOKEN;
const locationId = env.GHL_DEFAULT_LOCATION_ID || 'kNcygEmVTrhIueZQMDXM';
const FIREBASE_API_KEY = 'AIzaSyB_w3vXmsI7WeQtrIOkjR6xTRVN5uOieiE';
const BACKEND = 'https://backend.leadconnectorhq.com';

async function getIdToken() {
  const resp = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
  });
  if (!resp.ok) throw new Error(`Firebase refresh failed: ${resp.status}`);
  const data = await resp.json();
  return data.id_token;
}

async function ghlFetch(token, path, init = {}) {
  const url = `${BACKEND}${path}`;
  const headers = Object.assign({
    'token-id': token,
    'channel': 'APP',
    'accept': 'application/json, text/plain, */*'
  }, init.headers || {});
  if (init.body && !headers['content-type']) headers['content-type'] = 'application/json';
  const resp = await fetch(url, Object.assign({ method: 'GET' }, init, { headers }));
  const text = await resp.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) { body = text; }
  if (!resp.ok) throw new Error(`GHL ${resp.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const token = await getIdToken();
  const list = await ghlFetch(token, `/workflow/${locationId}/list?type=workflow&limit=100&offset=0`);

  const igWorkflows = [];

  for (const row of list.rows) {
    const triggers = await ghlFetch(token, `/workflow/${locationId}/trigger?workflowId=${row._id}`);
    const igTriggers = triggers.filter(t =>
      t.conditions && t.conditions.some(c => c.field === 'message.type' && c.value === 18)
    );
    if (igTriggers.length === 0) continue;

    const detail = await ghlFetch(token, `/workflow/${locationId}/${row._id}?includeScheduledPauseInfo=true&sessionId=test`);
    let templates = [];
    if (detail.fileUrl) {
      try {
        const tResp = await fetch(detail.fileUrl);
        const tData = await tResp.json();
        templates = tData.templates || [];
      } catch (_) {}
    }

    const keywords = [];
    for (const t of igTriggers) {
      const kwCondition = t.conditions.find(c => c.field === 'message.body');
      if (kwCondition) {
        const vals = Array.isArray(kwCondition.value) ? kwCondition.value : [kwCondition.value];
        keywords.push(...vals);
      }
    }

    igWorkflows.push({
      name: row.name || '(sin nombre)',
      id: row._id,
      status: detail.status,
      active: igTriggers.some(t => t.active !== false),
      keywords,
      templates
    });
  }

  console.log('# Reporte de palabras clave y respuestas de Instagram\n');
  for (const wf of igWorkflows) {
    console.log(`## ${wf.name}`);
    console.log(`- Estado: ${wf.status} ${wf.active ? '(activo)' : '(inactivo)'}`);
    console.log(`- Palabras clave: ${wf.keywords.map(k => `"${k}"`).join(', ')}`);
    console.log(`- Respuestas:`);
    for (const t of wf.templates) {
      if (t.type === 'instagram-dm' || t.type === 'instagram_dm') {
        const body = t.attributes?.body || '(sin texto)';
        console.log(`  - ${body.slice(0, 200).replace(/\n/g, ' ')}${body.length > 200 ? '...' : ''}`);
      }
    }
    console.log();
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
