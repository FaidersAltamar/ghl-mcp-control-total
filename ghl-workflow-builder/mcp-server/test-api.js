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
  console.log('Obteniendo token...');
  const token = await getIdToken();
  console.log('Token OK');

  console.log('Listando workflows...');
  const list = await ghlFetch(token, `/workflow/${locationId}/list?type=workflow&limit=10&offset=0`);
  console.log('Workflows:', list.rows?.map(r => ({ id: r._id, name: r.name, status: r.status })));

  if (list.rows && list.rows.length > 0) {
    const wf = list.rows[0];
    console.log(`\nDetalle de ${wf.name}...`);
    const detail = await ghlFetch(token, `/workflow/${locationId}/${wf._id}?includeScheduledPauseInfo=true&sessionId=test`);
    console.log('Status:', detail.status, 'Version:', detail.version);
    console.log('Triggers file:', detail.triggersFilePath || 'none');

    const triggers = await ghlFetch(token, `/workflow/${locationId}/trigger?workflowId=${wf._id}`);
    console.log('Triggers count:', Array.isArray(triggers) ? triggers.length : 'N/A');
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
