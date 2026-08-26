#!/usr/bin/env node
/**
 * Verifica que .env raíz + ambas conexiones GHL funcionen.
 * Uso: node scripts/verify-connection.mjs
 */
import { loadEnv, getPitToken, getLocationId, getFirebaseRefreshToken, PROJECT_ROOT } from '../lib/env.mjs';
import { ghlWorkflowFetch, getIdToken } from '../lib/ghl-auth.mjs';

loadEnv({ required: true });

const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const VERSION = process.env.GHL_API_VERSION || '2021-07-28';
const LID = getLocationId();
const CID = process.env.GHL_COMPANY_ID;
const PIT = getPitToken();

const results = [];

function ok(name, detail = '') {
  results.push({ name, status: 'OK', detail });
}
function fail(name, detail = '') {
  results.push({ name, status: 'FAIL', detail });
}
function skip(name, detail = '') {
  results.push({ name, status: 'SKIP', detail });
}

async function pitGet(path, label) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${PIT}`,
        Version: VERSION,
        'Content-Type': 'application/json'
      }
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (res.ok) {
      const count = countRecords(body);
      ok(label, `HTTP ${res.status}${count ? ` · ${count}` : ''}`);
      return body;
    }
    fail(label, `HTTP ${res.status}: ${truncate(JSON.stringify(body))}`);
    return null;
  } catch (e) {
    fail(label, e.message);
    return null;
  }
}

async function pitPost(path, body, label) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PIT}`,
        Version: VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (res.ok || res.status === 201) {
      const count = countRecords(data);
      ok(label, `HTTP ${res.status}${count ? ` · ${count}` : ''}`);
      return data;
    }
    fail(label, `HTTP ${res.status}: ${truncate(JSON.stringify(data))}`);
    return null;
  } catch (e) {
    fail(label, e.message);
    return null;
  }
}

function countRecords(body) {
  if (!body || typeof body !== 'object') return '';
  if (Array.isArray(body)) return `${body.length} items`;
  for (const key of ['contacts', 'users', 'products', 'pipelines', 'calendars', 'workflows', 'orders', 'transactions', 'data', 'rows', 'accounts']) {
    if (Array.isArray(body[key])) return `${body[key].length} ${key}`;
  }
  if (body.location || body.name) return body.name || body.location?.name || 'record';
  if (body.success === true) return 'success';
  return '';
}

function truncate(s, max = 120) {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

async function testEnv() {
  if (!LID) fail('ENV: GHL_LOCATION_ID', 'missing');
  else ok('ENV: GHL_LOCATION_ID', LID);
  if (!PIT) fail('ENV: GHL_PIT_TOKEN', 'missing');
  else ok('ENV: GHL_PIT_TOKEN', `set (len ${PIT.length})`);
  if (getFirebaseRefreshToken() || process.env.GHL_INTERNAL_JWT) {
    ok('ENV: workflow auth', getFirebaseRefreshToken() ? 'Firebase refresh' : 'Internal JWT');
  } else {
    fail('ENV: workflow auth', 'missing GHL_FIREBASE_REFRESH_TOKEN');
  }
  if (CID) ok('ENV: GHL_COMPANY_ID', CID);
  else skip('ENV: GHL_COMPANY_ID', 'optional');
}

async function testPublicApi() {
  await pitGet(`/locations/${LID}`, 'API: location details');
  await pitGet(`/contacts/?locationId=${LID}&limit=5`, 'API: contacts');
  await pitGet(`/users/?locationId=${LID}`, 'API: users');
  await pitGet(`/calendars/?locationId=${LID}`, 'API: calendars');
  await pitGet(`/opportunities/pipelines?locationId=${LID}`, 'API: pipelines');
  await pitGet(`/products/?locationId=${LID}&limit=5&offset=0`, 'API: products');
  await pitGet(`/payments/orders?altId=${LID}&altType=location`, 'API: payment orders');
  await pitGet(`/payments/transactions?altId=${LID}&altType=location`, 'API: transactions');
  await pitGet(`/social-media-posting/${LID}/accounts`, 'API: social accounts');
  await pitGet(`/workflows/?locationId=${LID}`, 'API: workflows (public list)');
  await pitGet(`/locations/${LID}/tags`, 'API: tags');
  await pitGet(`/locations/${LID}/customFields`, 'API: custom fields');
  await pitPost(
    '/contacts/search',
    { locationId: LID, page: 1, pageLimit: 5 },
    'API: contacts search (POST)'
  );
  if (CID) {
    await pitGet(
      `/users/search?companyId=${CID}&locationId=${LID}&limit=5&skip=0`,
      'API: users search'
    );
  }
}

async function testWorkflowApi() {
  try {
    await getIdToken();
    ok('Workflows: Firebase auth', 'token obtained');
  } catch (e) {
    fail('Workflows: Firebase auth', e.message);
    return;
  }

  try {
    const list = await ghlWorkflowFetch(
      `/workflow/${LID}/list?type=workflow&limit=100&offset=0`
    );
    const count = list?.rows?.length ?? 0;
    ok('Workflows: internal list', `${count} workflows`);

    if (count > 0) {
      const wf = list.rows[0];
      const detail = await ghlWorkflowFetch(
        `/workflow/${LID}/${wf._id}?includeScheduledPauseInfo=true&sessionId=verify`
      );
      ok('Workflows: get detail', `${detail.name || wf.name} (${detail.status})`);

      const triggers = await ghlWorkflowFetch(
        `/workflow/${LID}/trigger?workflowId=${wf._id}`
      );
      const tCount = Array.isArray(triggers) ? triggers.length : triggers?.length ?? 0;
      ok('Workflows: get triggers', `${tCount} triggers on sample workflow`);
    }
  } catch (e) {
    fail('Workflows: internal API', e.message);
  }
}

async function testSdkClient() {
  try {
    const { spawnSync } = await import('child_process');
    const node = process.execPath;
    const script = `${PROJECT_ROOT}/tools/api-client/ghl-client.js`.replace(/\//g, '\\');
    const r = spawnSync(node, [script, 'raw', 'GET', `/locations/${LID}`, '{}'], {
      cwd: `${PROJECT_ROOT}/tools/api-client`,
      encoding: 'utf8'
    });
    const out = (r.stdout || '') + (r.stderr || '');
    if (r.status === 0 && out.includes('"location"')) {
      ok('SDK: ghl-client.js', 'location fetch via root .env');
    } else {
      fail('SDK: ghl-client.js', truncate(out || `exit ${r.status}`));
    }
  } catch (e) {
    fail('SDK: ghl-client.js', e.message);
  }
}

console.log('\n=== GHL MCP — Verificación de conexión ===\n');

await testEnv();
console.log('');
await testPublicApi();
console.log('');
await testWorkflowApi();
console.log('');
await testSdkClient();

const passed = results.filter((r) => r.status === 'OK').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
const skipped = results.filter((r) => r.status === 'SKIP').length;

console.log('\n=== Resultados ===\n');
for (const r of results) {
  const icon = r.status === 'OK' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}

console.log(`\nTotal: ${passed} OK · ${failed} FAIL · ${skipped} SKIP\n`);
process.exit(failed > 0 ? 1 : 0);
