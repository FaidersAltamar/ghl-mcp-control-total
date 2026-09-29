#!/usr/bin/env node
/**
 * Actualiza los workflows de confirmación de cita con el contenido final
 * (español con acentos correctos) y remitente personalizado.
 *
 * Uso: node scripts/calendars/setup-personalized-emails.mjs
 */
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

const LOC = getLocationId();

const SUBJECT = 'Tu cita está confirmada — {{appointment.start_time}}';

const HTML = `<p>Hola {{contact.first_name}},</p>
<p>Tu cita fue <strong>confirmada</strong>. Estos son los detalles:</p>
<p><strong>Fecha y hora:</strong> {{appointment.start_time}}<br>
<strong>Ubicación:</strong> {{appointment.location}}</p>
<p>Si necesitas reprogramar o cancelar, responde a este correo.</p>
<p>¡Te esperamos!</p>`;

const WORKFLOWS = [
  {
    id: '5ffd7735-2d63-47b1-8daa-acb196313565',
    name: 'Cita - Contingencia Facebook Done For You',
    from: 'Contingencia Facebook Done For You',
    cc: (process.env.TEAM_CC_FACEBOOK || '').split(',').filter(Boolean),
  },
  {
    id: '956ad43c-ee1b-401c-b888-9f9d89b3969e',
    name: 'Cita - Contingencia TikTok Done For You',
    from: 'Contingencia TikTok Done For You',
    cc: (process.env.TEAM_CC_TIKTOK || '').split(',').filter(Boolean),
  },
];

for (const w of WORKFLOWS) {
  const cur = await ghlWorkflowFetch(`/workflow/${LOC}/${w.id}?includeScheduledPauseInfo=true&sessionId=test`);
  const tmpls = (cur.workflowData && cur.workflowData.templates) || [];
  const step = tmpls[0];
  if (!step) {
    console.log(`SKIP ${w.id} (sin steps)`);
    continue;
  }
  step.name = 'Enviar confirmación personalizada';
  step.attributes = {
    subject: SUBJECT,
    html: HTML,
    from_name: w.from,
    from_email: 'no-reply@controlads.com.co',
    cc: (w.cc || []).join(', '),
  };
  await ghlWorkflowFetch(`/workflow/${LOC}/${w.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      version: cur.version,
      name: w.name,
      status: cur.status || 'published',
      allowMultiple: true,
      removeContactFromLastStep: true,
      workflowData: { templates: tmpls },
    }),
  });
  console.log(`OK ${w.name}`);
}

console.log('\nDone.');
