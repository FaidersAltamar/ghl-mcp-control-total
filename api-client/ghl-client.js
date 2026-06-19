/**
 * GHL Full-Access SDK Client
 *
 * Fallback directo usando el SDK oficial de GoHighLevel.
 * Se conecta con el PIT token y expone helpers para todos los servicios.
 *
 * Uso:
 *   node ghl-client.js contacts "getContacts" '{"locationId":"kNcygEmVTrhIueZQMDXM","limit":10}'
 *   node ghl-client.js raw GET /contacts/ '{"locationId":"kNcygEmVTrhIueZQMDXM","limit":10}'
 */

const { HighLevel, GHLError } = require('@gohighlevel/api-client');
require('dotenv').config({ path: __dirname + '/.env' });

const PIT_TOKEN = process.env.GHL_PIT_TOKEN || 'pit-e6fe67b8-03a5-4be2-984b-808ae4231a62';
const LOCATION_ID = process.env.GHL_LOCATION_ID || 'kNcygEmVTrhIueZQMDXM';
const API_VERSION = process.env.GHL_API_VERSION || '2021-07-28';

const ghl = new HighLevel({
  privateIntegrationToken: PIT_TOKEN,
  apiVersion: API_VERSION,
  logLevel: 'warn'
});

async function callService(serviceName, methodName, payload) {
  const svc = ghl[serviceName];
  if (!svc) {
    throw new Error(`Servicio no encontrado: ${serviceName}. Servicios disponibles: ${Object.keys(ghl).filter(k => typeof ghl[k] === 'object').join(', ')}`);
  }
  const fn = svc[methodName];
  if (!fn) {
    throw new Error(`Método no encontrado: ${methodName} en ${serviceName}`);
  }
  const args = payload ? [payload] : [];
  return await fn.apply(svc, args);
}

async function rawRequest(method, path, query, body) {
  const config = {
    method,
    url: path,
    params: query,
    data: body
  };
  const response = await ghl.request(config);
  return response.data;
}

async function main() {
  const [,, mode, ...rest] = process.argv;

  try {
    if (mode === 'service') {
      const [serviceName, methodName, payloadJson] = rest;
      const payload = payloadJson ? JSON.parse(payloadJson) : undefined;
      const result = await callService(serviceName, methodName, payload);
      console.log(JSON.stringify(result, null, 2));
    } else if (mode === 'raw') {
      const [method, path, queryJson, bodyJson] = rest;
      const query = queryJson ? JSON.parse(queryJson) : undefined;
      const body = bodyJson ? JSON.parse(bodyJson) : undefined;
      const result = await rawRequest(method, path, query, body);
      console.log(JSON.stringify(result, null, 2));
    } else if (mode === 'discover') {
      // Lista todos los servicios y métodos disponibles
      const services = Object.keys(ghl).filter(k => typeof ghl[k] === 'object' && ghl[k] !== null);
      const out = {};
      for (const s of services) {
        out[s] = Object.getOwnPropertyNames(Object.getPrototypeOf(ghl[s]))
          .filter(m => typeof ghl[s][m] === 'function' && m !== 'constructor');
      }
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(`Modo desconocido: ${mode}
Uso:
  node ghl-client.js service <service> <method> [payloadJson]
  node ghl-client.js raw <method> <path> [queryJson] [bodyJson]
  node ghl-client.js discover
`);
      process.exit(1);
    }
  } catch (err) {
    if (err instanceof GHLError) {
      console.error(JSON.stringify({ error: err.message, statusCode: err.statusCode, response: err.response }, null, 2));
    } else {
      console.error(JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
    }
    process.exit(1);
  }
}

main();
