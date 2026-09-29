#!/usr/bin/env node
// Pone secret, kind y calendario en la URL de los pasos webhook de los workflows de avisos de citas.
// La acción "Webhook" estándar de GHL no envía el body personalizado, así que el endpoint
// lee estos datos de la query.
// Uso: node scripts/workflows/update-notify-url.mjs
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });
const LOC = getLocationId();
const SECRET = process.env.APPOINTMENT_NOTIFY_SECRET;
if (!SECRET) throw new Error('APPOINTMENT_NOTIFY_SECRET no configurado en .env');
const BASE = process.env.NOTIFY_WEBHOOK_URL || 'https://bridge-iota-opal.vercel.app/api/appointment-notify';

const WORKFLOWS = [
  '74ae799e-650f-4109-8a9b-0835ab1b9a9d', // TikTok
  '8f124c53-25a4-44aa-bfa4-18d0507a132e', // Meta
];

for (const wfId of WORKFLOWS) {
  const cur = await ghlWorkflowFetch(`/workflow/${LOC}/${wfId}?includeScheduledPauseInfo=true&sessionId=test`);
  const templates = (cur.workflowData && cur.workflowData.templates) || [];
  let changed = 0;
  for (const t of templates) {
    if (t.type !== 'webhook' || !t.attributes) continue;
    let body = {};
    try { body = JSON.parse(t.attributes.body || '{}'); } catch { /* sin body */ }
    const kind = body.kind || 'booked';
    const cal = body.calendar_id || '';
    const qs = new URLSearchParams({ secret: SECRET, kind, cal });
    t.attributes.url = `${BASE}?${qs}`;
    changed++;
  }
  await ghlWorkflowFetch(`/workflow/${LOC}/${wfId}`, {
    method: 'PUT',
    body: JSON.stringify({
      version: cur.version,
      name: cur.name,
      status: cur.status || 'published',
      allowMultiple: true,
      removeContactFromLastStep: true,
      workflowData: { templates },
    }),
  });
  console.log(`OK ${cur.name} (${changed} pasos webhook)`);
}
