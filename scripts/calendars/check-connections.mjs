#!/usr/bin/env node
/**
 * Revisa las conexiones de calendario (Google/Outlook/Zoom) de la location.
 * Uso: node scripts/calendars/check-connections.mjs
 */
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });
const LID = getLocationId();

// Nunca imprimir tokens: solo tipo, usuarios, email y estado.
const r = await ghlWorkflowFetch(`/calendars/connections?locationId=${LID}`, { headers: { version: '2021-04-15' } });
const all = [];
for (const [scope, group] of Object.entries(r)) {
  for (const [kind, list] of Object.entries(group || {})) {
    for (const c of Array.isArray(list) ? list : Object.keys(list || {}).length ? [list] : []) {
      all.push({
        scope, kind,
        users: Object.keys(c.users || {}).join(','),
        email: c.settings?.email || c.email || c.accountEmail || '',
        deleted: c.deleted, id: c.id || c._id,
      });
    }
  }
}
console.table(all);
