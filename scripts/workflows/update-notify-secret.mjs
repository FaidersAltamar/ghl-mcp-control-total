#!/usr/bin/env node
// Actualiza el "secret" de los pasos webhook de los workflows de notificación de citas.
// Uso: node scripts/workflows/update-notify-secret.mjs
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });
const LOC = getLocationId();
const NEW_SECRET = process.env.APPOINTMENT_NOTIFY_SECRET;
if (!NEW_SECRET) throw new Error('APPOINTMENT_NOTIFY_SECRET no configurado en .env');

const WORKFLOWS = [
  '74ae799e-650f-4109-8a9b-0835ab1b9a9d', // TikTok
  '8f124c53-25a4-44aa-bfa4-18d0507a132e', // Meta
];

for (const wfId of WORKFLOWS) {
  const cur = await ghlWorkflowFetch(`/workflow/${LOC}/${wfId}?includeScheduledPauseInfo=true&sessionId=test`);
  const templates = (cur.workflowData && cur.workflowData.templates) || [];
  let changed = 0;
  for (const t of templates) {
    if (t.type === 'webhook' && t.attributes && typeof t.attributes.body === 'string') {
      try {
        const body = JSON.parse(t.attributes.body);
        if (body.secret && body.secret !== NEW_SECRET) {
          body.secret = NEW_SECRET;
          t.attributes.body = JSON.stringify(body);
          changed++;
        }
      } catch {}
    }
  }
  if (!changed) {
    console.log(`SKIP ${wfId} (sin cambios)`);
    continue;
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
  console.log(`OK ${wfId} (${changed} pasos actualizados)`);
}

console.log('Done.');
