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

  const workflows = [];

  for (const row of list.rows) {
    try {
      const detail = await ghlFetch(token, `/workflow/${locationId}/${row._id}?includeScheduledPauseInfo=true&sessionId=test`);
      workflows.push({
        name: row.name || '(sin nombre)',
        id: row._id,
        status: detail.status,
        version: detail.version,
        updatedAt: row.updatedAt,
      });
    } catch (e) {
      workflows.push({
        name: row.name || '(sin nombre)',
        id: row._id,
        status: 'unknown',
        error: e.message,
      });
    }
  }

  const active = workflows.filter(w => w.status === 'published');
  const draft = workflows.filter(w => w.status === 'draft');

  console.log(`\n=== Workflows encontrados: ${workflows.length} ===\n`);
  console.log(`Activos (published): ${active.length}`);
  for (const w of active) {
    console.log(`  ✅ ${w.name} (id: ${w.id})`);
  }

  console.log(`\nDraft / inactivos: ${draft.length}`);
  for (const w of draft) {
    console.log(`  📝 ${w.name} (id: ${w.id})`);
  }

  if (workflows.some(w => w.status !== 'published' && w.status !== 'draft')) {
    console.log(`\nOtros estados:`);
    for (const w of workflows.filter(w => w.status !== 'published' && w.status !== 'draft')) {
      console.log(`  ❓ ${w.name} → ${w.status}`);
    }
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
