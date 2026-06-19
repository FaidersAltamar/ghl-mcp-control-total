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

  // Crear workflow
  console.log('Creando workflow de prueba...');
  const created = await ghlFetch(token, `/workflow/${locationId}`, {
    method: 'POST',
    body: JSON.stringify({ name: 'TEST Instagram MCP Auto', status: 'draft' })
  });
  console.log('Creado:', created);
  const workflowId = created.id;

  // Añadir trigger de Instagram comment
  console.log('Añadiendo trigger...');
  const trigger = {
    workflowId,
    type: 'ig_comment_on_post',
    name: 'Instagram comment',
    conditions: [],
    active: true,
    status: 'draft'
  };
  const triggerResp = await ghlFetch(token, `/workflow/${locationId}/trigger`, {
    method: 'POST',
    body: JSON.stringify(trigger)
  });
  console.log('Trigger:', triggerResp);

  // Publicar
  console.log('Publicando...');
  const current = await ghlFetch(token, `/workflow/${locationId}/${workflowId}?includeScheduledPauseInfo=true&sessionId=test`);
  const payload = Object.assign({}, current, { status: 'published', version: current.version });
  delete payload._id;
  delete payload.createdAt;
  delete payload.updatedAt;
  const published = await ghlFetch(token, `/workflow/${locationId}/${workflowId}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  console.log('Publicado:', published);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
