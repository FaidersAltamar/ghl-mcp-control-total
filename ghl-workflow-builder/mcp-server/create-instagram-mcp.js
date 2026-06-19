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

  // 1. Crear workflow
  console.log('Creando workflow "Instagram - Respuesta MCP"...');
  const created = await ghlFetch(token, `/workflow/${locationId}`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Instagram - Respuesta MCP', status: 'draft' })
  });
  const workflowId = created.id;
  console.log('Workflow creado:', workflowId);

  // 2. Añadir acción: enviar Instagram DM
  const actionId = crypto.randomUUID();
  const templates = [{
    id: actionId,
    order: 0,
    name: 'Responder hola',
    type: 'instagram-dm',
    attributes: {
      body: 'hola como estas',
      attachments: []
    },
    next: null
  }];

  const current = await ghlFetch(token, `/workflow/${locationId}/${workflowId}?includeScheduledPauseInfo=true&sessionId=test`);
  const updatePayload = Object.assign({}, current, {
    version: current.version,
    workflowData: { templates }
  });
  delete updatePayload._id;
  delete updatePayload.createdAt;
  delete updatePayload.updatedAt;

  await ghlFetch(token, `/workflow/${locationId}/${workflowId}`, {
    method: 'PUT',
    body: JSON.stringify(updatePayload)
  });
  console.log('Acción añadida.');

  // 3. Añadir trigger: Customer Replied en Instagram con palabra clave MCP
  const trigger = {
    workflowId,
    type: 'customer_reply',
    name: 'Instagram DM contiene MCP',
    masterType: 'highlevel',
    active: true,
    status: 'draft',
    actions: [{ workflow_id: workflowId, type: 'add_to_workflow' }],
    conditions: [
      {
        operator: '==',
        field: 'message.type',
        value: 18,
        title: 'Reply channel',
        type: 'select'
      },
      {
        operator: 'string-contains-any-of',
        field: 'message.body',
        value: ['MCP'],
        title: 'Contains phrase',
        type: 'string',
        id: 'message-contains-phrase'
      }
    ]
  };
  const triggerResp = await ghlFetch(token, `/workflow/${locationId}/trigger`, {
    method: 'POST',
    body: JSON.stringify(trigger)
  });
  console.log('Trigger añadido:', triggerResp.id);

  // 4. Publicar workflow
  const current2 = await ghlFetch(token, `/workflow/${locationId}/${workflowId}?includeScheduledPauseInfo=true&sessionId=test`);
  const publishPayload = Object.assign({}, current2, {
    status: 'published',
    version: current2.version
  });
  delete publishPayload._id;
  delete publishPayload.createdAt;
  delete publishPayload.updatedAt;

  await ghlFetch(token, `/workflow/${locationId}/${workflowId}`, {
    method: 'PUT',
    body: JSON.stringify(publishPayload)
  });
  console.log('Workflow publicado.');
  console.log('\n✅ Listo. URL aproximada:');
  console.log(`https://crm.dropi.co/v2/location/${locationId}/automation/workflows/${workflowId}`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
