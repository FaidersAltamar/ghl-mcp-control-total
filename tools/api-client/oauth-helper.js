/**
 * GHL OAuth Helper
 *
 * Una vez creada la Marketplace OAuth app y obtenido el Location Access Token,
 * este script intercambia el código de autorización por tokens y refresca el
 * access token. También puede instalar webhooks suscribiendo eventos.
 *
 * Uso:
 *   node oauth-helper.js authorize <clientId> <clientSecret> <authCode>
 *   node oauth-helper.js refresh <clientId> <clientSecret> <refreshToken>
 */

const axios = require('axios');

const BASE_URL = 'https://services.leadconnectorhq.com';

async function authorize(clientId, clientSecret, code) {
  const response = await axios.post(`${BASE_URL}/oauth/token`, {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
  return response.data;
}

async function refresh(clientId, clientSecret, refreshToken) {
  const response = await axios.post(`${BASE_URL}/oauth/token`, {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  }, {
    headers: { 'Content-Type': 'application/json' }
  });
  return response.data;
}

async function main() {
  const [,, action, ...args] = process.argv;
  try {
    if (action === 'authorize') {
      const [clientId, clientSecret, code] = args;
      const data = await authorize(clientId, clientSecret, code);
      console.log(JSON.stringify(data, null, 2));
    } else if (action === 'refresh') {
      const [clientId, clientSecret, refreshToken] = args;
      const data = await refresh(clientId, clientSecret, refreshToken);
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`Acción desconocida: ${action}
Uso:
  node oauth-helper.js authorize <clientId> <clientSecret> <authCode>
  node oauth-helper.js refresh <clientId> <clientSecret> <refreshToken>
`);
      process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ error: err.message, response: err.response?.data }, null, 2));
    process.exit(1);
  }
}

main();
