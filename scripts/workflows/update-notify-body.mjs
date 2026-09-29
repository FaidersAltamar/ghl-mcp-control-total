#!/usr/bin/env node
// Actualiza el body de los pasos webhook de los workflows de notificación de citas,
// agregando email, enlace(s) de reunión, título y notas del contacto.
// Uso: node scripts/workflows/update-notify-body.mjs
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });
const LOC = getLocationId();
const SECRET = process.env.APPOINTMENT_NOTIFY_SECRET;
if (!SECRET) throw new Error('APPOINTMENT_NOTIFY_SECRET no configurado en .env');

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
      let body;
      try { body = JSON.parse(t.attributes.body); } catch { continue; }
      const { kind, calendar_id } = body;
      if (!kind || !calendar_id) continue;
      body = {
        secret: SECRET,
        kind,
        calendar_id,
        name: '{{contact.first_name}} {{contact.last_name}}',
        email: '{{contact.email}}',
        phone: '{{contact.phone}}',
        when: '{{appointment.start_time}}',
        location: '{{appointment.location}}',
        meeting_link: '{{appointment.meeting_link}}',
        zoom_link: '{{appointment.zoom_link}}',
        google_meet_link: '{{appointment.google_meet_link}}',
        title: '{{appointment.title}}',
        notes: '{{appointment.notes}}',
      };
      t.attributes.body = JSON.stringify(body);
      changed++;
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
