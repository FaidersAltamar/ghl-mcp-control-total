#!/usr/bin/env node
/**
 * Muestra la estructura de las conexiones de Google (sin tokens) para ver
 * el calendario vinculado de cada usuario.
 * Uso: node scripts/calendars/inspect-google-connection.mjs
 */
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });
const LID = getLocationId();

const redact = (o) => JSON.parse(JSON.stringify(o, (k, v) => (/token|secret|code/i.test(k) ? '***' : v)));

const r = await ghlWorkflowFetch(`/calendars/connections?locationId=${LID}`, { headers: { version: '2021-04-15' } });
for (const c of r.locationConnections?.google || []) {
  console.log('\n---', c.settings?.email || c.email || Object.keys(c.users || {}).join(','));
  console.log(JSON.stringify(redact(c), null, 1).slice(0, 2500));
}
console.log('\nOTRAS CLAVES:', Object.keys(r));
