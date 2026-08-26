import { getFirebaseRefreshToken, getLocationId } from './env.mjs';

export const BACKEND = 'https://backend.leadconnectorhq.com';
export const FIREBASE_API_KEY = 'AIzaSyB_w3vXmsI7WeQtrIOkjR6xTRVN5uOieiE';

let cachedIdToken = null;
let tokenExpiry = 0;

export async function getIdToken() {
  const internalJwt = process.env.GHL_INTERNAL_JWT;
  if (internalJwt) return internalJwt;

  const refreshToken = getFirebaseRefreshToken();
  if (!refreshToken) {
    throw new Error('GHL_FIREBASE_REFRESH_TOKEN or GHL_INTERNAL_JWT required in .env');
  }

  const now = Date.now();
  if (cachedIdToken && tokenExpiry > now + 60000) {
    return cachedIdToken;
  }

  const resp = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
    }
  );
  if (!resp.ok) {
    throw new Error(`Firebase refresh failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  cachedIdToken = data.id_token;
  tokenExpiry = now + parseInt(data.expires_in, 10) * 1000;
  return cachedIdToken;
}

export async function ghlWorkflowFetch(path, init = {}) {
  const token = await getIdToken();
  const internalJwt = process.env.GHL_INTERNAL_JWT;
  const headers = {
    channel: 'APP',
    source: 'WEB_USER',
    accept: 'application/json, text/plain, */*',
    ...(init.headers || {})
  };
  if (internalJwt) {
    headers.authorization = `Bearer ${token}`;
  } else {
    headers['token-id'] = token;
  }
  if (init.body && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }
  const resp = await fetch(`${BACKEND}${path}`, { method: 'GET', ...init, headers });
  const text = await resp.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!resp.ok) {
    throw new Error(`GHL API ${resp.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

export { getLocationId };
