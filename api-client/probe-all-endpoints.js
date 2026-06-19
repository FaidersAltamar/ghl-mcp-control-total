/**
 * Prueba masiva de TODOS los endpoints extraídos del SDK.
 * Solo hace llamadas GET inocuas. Para POST/PUT/DELETE solo construye la URL.
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

require('dotenv').config({ path: __dirname + '/.env' });
const LID = process.env.GHL_LOCATION_ID || 'kNcygEmVTrhIueZQMDXM';
const TOKEN = process.env.GHL_PIT_TOKEN || 'pit-e6fe67b8-03a5-4be2-984b-808ae4231a62';
const BASE = 'https://services.leadconnectorhq.com';
const CID = 'BD6igmJPz1Fd1TRdDVaq';

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'all-endpoints.json'), 'utf8'));

const results = [];

function buildUrl(endpoint) {
  let url = endpoint.url;
  const query = {};

  for (const p of endpoint.params) {
    if (p.in === 'path') {
      // Sustituir path param con valores conocidos o placeholder
      let val;
      switch (p.name) {
        case 'locationId': val = LID; break;
        case 'contactId': val = CID; break;
        case 'id': val = 'test-id'; break;
        case 'taskId': val = 'test-task-id'; break;
        case 'userId': val = 'test-user-id'; break;
        case 'calendarId': val = 'test-calendar-id'; break;
        case 'appointmentId': val = 'test-appointment-id'; break;
        case 'opportunityId': val = 'test-opp-id'; break;
        case 'pipelineId': val = 'test-pipeline-id'; break;
        case 'stageId': val = 'test-stage-id'; break;
        case 'funnelId': val = 'test-funnel-id'; break;
        case 'pageId': val = 'test-page-id'; break;
        case 'postId': val = 'test-post-id'; break;
        case 'blogId': val = 'test-blog-id'; break;
        case 'templateId': val = 'test-template-id'; break;
        case 'invoiceId': val = 'test-invoice-id'; break;
        case 'estimateId': val = 'test-estimate-id'; break;
        case 'scheduleId': val = 'test-schedule-id'; break;
        case 'productId': val = 'test-product-id'; break;
        case 'priceId': val = 'test-price-id'; break;
        case 'orderId': val = 'test-order-id'; break;
        case 'subscriptionId': val = 'test-sub-id'; break;
        case 'transactionId': val = 'test-transaction-id'; break;
        case 'accountId': val = 'test-account-id'; break;
        case 'campaignId': val = 'test-campaign-id'; break;
        case 'workflowId': val = 'test-workflow-id'; break;
        case 'formId': val = 'test-form-id'; break;
        case 'surveyId': val = 'test-survey-id'; break;
        case 'noteId': val = 'test-note-id'; break;
        case 'companyId': val = 'Z1tBjx04W5ynDkgSEiEt'; break;
        default: val = 'test-' + p.name.toLowerCase();
      }
      url = url.replace(new RegExp(`\\{${p.name}\\}`, 'g'), val);
    } else if (p.in === 'query') {
      // Valores por defecto para query params
      switch (p.name) {
        case 'locationId': query[p.name] = LID; break;
        case 'altId': query[p.name] = LID; break;
        case 'altType': query[p.name] = 'location'; break;
        case 'location_id': query[p.name] = LID; break;
        case 'contactId': query[p.name] = CID; break;
        case 'limit': query[p.name] = '10'; break;
        case 'offset': query[p.name] = '0'; break;
        case 'skip': query[p.name] = '0'; break;
        case 'type': query[p.name] = 'file'; break;
        case 'status': query[p.name] = 'open'; break;
        case 'startAfter': query[p.name] = '0'; break;
        case 'startAt': query[p.name] = '0'; break;
        case 'endAt': query[p.name] = '9999999999999'; break;
        case 'search': query[p.name] = 'test'; break;
        case 'q': query[p.name] = 'test'; break;
        case 'fetchAll': query[p.name] = 'true'; break;
        default: query[p.name] = 'test';
      }
    } else if (p.in === 'header') {
      // locationId en header si aplica
      if (p.name === 'locationId') query[p.name] = LID;
    }
  }

  const qs = Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return qs ? `${BASE}${url}?${qs}` : `${BASE}${url}`;
}

function testEndpoint(service, endpoint) {
  const fullUrl = buildUrl(endpoint);
  const isSafeGet = endpoint.httpMethod === 'GET';

  if (!isSafeGet) {
    return {
      service,
      methodName: endpoint.methodName,
      httpMethod: endpoint.httpMethod,
      url: fullUrl,
      status: 'SKIPPED',
      note: 'Non-GET method, skipped to avoid mutations'
    };
  }

  try {
    const cmd = `curl -s -o /tmp/ghl_probe.json -w "%{http_code}" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -H "Version: 2021-07-28" "${fullUrl}"`;
    const code = execSync(cmd, { encoding: 'utf8', timeout: 15000 }).trim();
    const body = fs.existsSync('/tmp/ghl_probe.json') ? fs.readFileSync('/tmp/ghl_probe.json', 'utf8').slice(0, 200) : '';
    return {
      service,
      methodName: endpoint.methodName,
      httpMethod: endpoint.httpMethod,
      url: fullUrl,
      status: code,
      note: body
    };
  } catch (err) {
    return {
      service,
      methodName: endpoint.methodName,
      httpMethod: endpoint.httpMethod,
      url: fullUrl,
      status: 'ERROR',
      note: err.message
    };
  }
}

let count = 0;
for (const [service, endpoints] of Object.entries(data.endpoints)) {
  for (const ep of endpoints) {
    const res = testEndpoint(service, ep);
    results.push(res);
    count++;
    if (count % 10 === 0) {
      console.error(`Probed ${count} endpoints...`);
    }
    // Pequeño delay para no saturar
    require('child_process').execSync('sleep 0.15');
  }
}

// Guardar resultados
fs.writeFileSync(path.join(__dirname, 'probe-results.json'), JSON.stringify(results, null, 2));

// Resumen
const summary = {
  total: results.length,
  byStatus: {}
};
for (const r of results) {
  summary.byStatus[r.status] = (summary.byStatus[r.status] || 0) + 1;
}

console.log(JSON.stringify(summary, null, 2));
