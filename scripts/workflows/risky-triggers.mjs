#!/usr/bin/env node
/**
 * Lista los workflows PUBLICADOS cuyos disparadores se activan al crear/editar contactos,
 * agregar etiquetas o cambiar campos (riesgo antes de importaciones masivas).
 * Uso: node scripts/workflows/risky-triggers.mjs
 */
import { loadEnv, getLocationId, getPitToken } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });
const LOC = getLocationId();
const RISKY = /contact_created|contact_changed|contact_tag|tag|customField|custom_field|contact_dnd|birthday/i;

const r = await fetch(`https://services.leadconnectorhq.com/workflows/?locationId=${LOC}`, {
  headers: { Authorization: `Bearer ${getPitToken()}`, Version: '2021-07-28' },
});
const workflows = ((await r.json()).workflows || []).filter((w) => w.status === 'published');
console.log('publicados:', workflows.length);
for (const w of workflows) {
  const t = await ghlWorkflowFetch(`/workflow/${LOC}/trigger?workflowId=${w.id}`).catch(() => null);
  const list = (t?.triggers || t || []).filter?.((x) => x.active !== false) || [];
  const risky = list.filter((x) => RISKY.test(x.type || ''));
  if (risky.length) {
    console.log(`\n⚠ ${w.name} (${w.id})`);
    for (const x of risky) console.log('   ', x.type, JSON.stringify(x.conditions || []).slice(0, 250));
  }
}
