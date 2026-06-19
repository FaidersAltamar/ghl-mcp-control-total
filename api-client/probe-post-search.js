/**
 * Prueba masiva de endpoints POST tipo search/list con body mínimo correcto.
 */

const fs = require('fs');
const { execSync } = require('child_process');

require('dotenv').config({ path: __dirname + '/.env' });
const LID = process.env.GHL_LOCATION_ID || 'kNcygEmVTrhIueZQMDXM';
const TOKEN = process.env.GHL_PIT_TOKEN || 'pit-e6fe67b8-03a5-4be2-984b-808ae4231a62';
const BASE = 'https://services.leadconnectorhq.com';
const CID = 'BD6igmJPz1Fd1TRdDVaq';
const COMPANY = 'Z1tBjx04W5ynDkgSEiEt';

const data = JSON.parse(fs.readFileSync(__dirname + '/all-endpoints.json', 'utf8'));

const testEndpoints = [];
for (const [svc, eps] of Object.entries(data.endpoints)) {
  for (const ep of eps) {
    if (ep.httpMethod === 'POST' && /search|list|preview|validate|check|filter|generate|export|import/i.test(ep.methodName)) {
      testEndpoints.push({ svc, ...ep });
    }
  }
}

function buildUrl(ep) {
  let url = ep.url;
  for (const p of ep.params) {
    if (p.in === 'path') {
      let val;
      switch (p.name) {
        case 'locationId': val = LID; break;
        case 'contactId': val = CID; break;
        case 'companyId': val = COMPANY; break;
        case 'id': val = 'test-id'; break;
        case 'schemaKey': val = 'business'; break;
        default: val = 'test-' + p.name.toLowerCase();
      }
      url = url.replace(new RegExp(`\\{${p.name}\\}`, 'g'), val);
    }
  }
  return BASE + url;
}

function getBody(ep) {
  const body = {};
  for (const p of ep.params) {
    if (p.in === 'query') {
      switch (p.name) {
        case 'locationId': body[p.name] = LID; break;
        case 'location_id': body[p.name] = LID; break;
        case 'altId': body[p.name] = LID; break;
        case 'altType': body[p.name] = 'location'; break;
        case 'contactId': body[p.name] = CID; break;
        case 'companyId': body[p.name] = COMPANY; break;
        case 'limit': body[p.name] = 10; break;
        case 'pageLimit': body[p.name] = 10; break;
        case 'pageSize': body[p.name] = 10; break;
        case 'offset': body[p.name] = 0; break;
        case 'skip': body[p.name] = 0; break;
        case 'page': body[p.name] = 1; break;
        case 'status': body[p.name] = 'open'; break;
        case 'type': body[p.name] = 'file'; break;
        case 'startAfter': body[p.name] = 0; break;
        case 'startAt': body[p.name] = 0; break;
        case 'endAt': body[p.name] = 9999999999999; break;
        case 'search': body[p.name] = 'test'; break;
        case 'query': body[p.name] = 'test'; break;
        case 'q': body[p.name] = 'test'; break;
        default: body[p.name] = 'test';
      }
    }
  }
  // Si no hay params de query, agregar defaults
  if (Object.keys(body).length === 0) {
    body.locationId = LID;
    body.limit = 10;
  }
  return JSON.stringify(body);
}

const results = [];
for (const ep of testEndpoints) {
  const url = buildUrl(ep);
  const body = getBody(ep);
  try {
    const cmd = `curl -s -o /tmp/ghl_post.json -w "%{http_code}" -X POST -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -H "Version: 2021-07-28" -d '${body}' "${url}"`;
    const code = execSync(cmd, { encoding: 'utf8', timeout: 15000 }).trim();
    const resp = fs.existsSync('/tmp/ghl_post.json') ? fs.readFileSync('/tmp/ghl_post.json', 'utf8').slice(0, 200) : '';
    results.push({ svc: ep.svc, method: ep.methodName, url, status: code, note: resp });
  } catch (err) {
    results.push({ svc: ep.svc, method: ep.methodName, url, status: 'ERROR', note: err.message });
  }
  execSync('sleep 0.15');
}

fs.writeFileSync(__dirname + '/post-search-results.json', JSON.stringify(results, null, 2));

const summary = {};
for (const r of results) summary[r.status] = (summary[r.status] || 0) + 1;
console.log(JSON.stringify(summary, null, 2));
