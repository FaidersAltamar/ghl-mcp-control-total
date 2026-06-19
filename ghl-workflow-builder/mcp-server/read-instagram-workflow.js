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

  // Buscar workflow llamado Instagram - Dropi
  const list = await ghlFetch(token, `/workflow/${locationId}/list?type=workflow&limit=100&offset=0`);
  const igWf = list.rows.find(r => r.name && r.name.toLowerCase().includes('instagram'));
  if (!igWf) {
    console.log('No se encontró workflow de Instagram');
    return;
  }

  console.log('Workflow encontrado:', igWf.name, igWf._id, igWf.status);

  const detail = await ghlFetch(token, `/workflow/${locationId}/${igWf._id}?includeScheduledPauseInfo=true&sessionId=test`);
  console.log('\n--- METADATA ---');
  console.log(JSON.stringify({
    status: detail.status,
    version: detail.version,
    filePath: detail.filePath,
    triggersFilePath: detail.triggersFilePath,
    fileUrl: detail.fileUrl
  }, null, 2));

  // Descargar templates
  if (detail.fileUrl) {
    const templatesResp = await fetch(detail.fileUrl);
    const templates = await templatesResp.json();
    console.log('\n--- TEMPLATES (ACTIONS) ---');
    console.log(JSON.stringify(templates, null, 2));
  }

  // Triggers
  const triggers = await ghlFetch(token, `/workflow/${locationId}/trigger?workflowId=${igWf._id}`);
  console.log('\n--- TRIGGERS ---');
  console.log(JSON.stringify(triggers, null, 2));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
