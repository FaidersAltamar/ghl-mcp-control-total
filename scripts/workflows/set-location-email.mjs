#!/usr/bin/env node
// Cambia el email por defecto de la ubicacion via backend (admin user)
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { getIdToken, BACKEND } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });
const LID = getLocationId();
const NEW_EMAIL = process.argv[2] || 'no-reply@controlads.com.co';

const token = await getIdToken();
const hd = {
  'token-id': token,
  channel: 'APP',
  source: 'WEB_USER',
  version: '2021-07-28',
  accept: 'application/json',
};

const r = await fetch(`${BACKEND}/locations/${LID}`, {
  method: 'PUT',
  headers: { ...hd, 'content-type': 'application/json' },
  body: JSON.stringify({ email: NEW_EMAIL }),
});
const t = await r.text();
console.log('PUT /locations ->', r.status, t.slice(0, 400));

const r2 = await fetch(`${BACKEND}/locations/${LID}`, { headers: hd });
const j2 = await r2.json();
console.log('email ahora =', (j2.location || j2).email);
