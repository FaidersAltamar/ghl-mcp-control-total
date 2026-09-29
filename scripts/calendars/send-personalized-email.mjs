#!/usr/bin/env node
/**
 * Envía un email personalizado (from_name custom) vía workflow GHL.
 * Crea un workflow temporal con acción "email", trigger por tag, y lo dispara
 * añadiendo el tag al contacto destino.
 *
 * Uso: node scripts/calendars/send-personalized-email.mjs "<from_name>" "<tag>" "<to_email>" "<asunto>"
 */
import { randomUUID } from 'crypto';
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

const LOC = getLocationId();
const PIT = getPitToken();
const USER_ID = process.env.GHL_USER_ID || 'd4QvP27fL7tIKcutJNfd';

const FROM_NAME = process.argv[2];
const TAG = process.argv[3];
const TO_EMAIL = process.argv[4];
const SUBJECT = process.argv[5] || 'Prueba personalizada';

if (!FROM_NAME || !TAG || !TO_EMAIL) {
  console.error('Uso: node send-personalized-email.mjs "<from_name>" "<tag>" "<to_email>" "<asunto>"');
  process.exit(1);
}

const FROM_EMAIL = 'no-reply@controlads.com.co';

// 1) buscar contacto
const sr = await fetch('https://services.leadconnectorhq.com/contacts/search', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + PIT,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId: LOC,
    page: 1,
    pageLimit: 1,
    filters: [{ field: 'email', operator: 'eq', value: TO_EMAIL }],
  }),
});
const sj = await sr.json();
const contact = (sj.contacts && sj.contacts[0]) || null;
if (!contact) {
  console.error('Contacto no encontrado:', TO_EMAIL);
  process.exit(1);
}
console.log('Contacto:', contact.id, '|', contact.email);

// 2) crear workflow con acción email
const stepEmail = randomUUID();
const html = `<p>Hola,</p><p>Esta es la <strong>prueba de remitente personalizado</strong>.</p><p>El remitente debería aparecer como: <strong>${FROM_NAME}</strong>.</p>`;

const created = await ghlWorkflowFetch(`/workflow/${LOC}`, {
  method: 'POST',
  body: JSON.stringify({
    name: `TEST email - ${FROM_NAME}`,
    workflowData: {
      templates: [
        {
          id: stepEmail,
          order: 0,
          name: 'Enviar email personalizado',
          type: 'email',
          attributes: {
            subject: SUBJECT,
            html,
            from_name: FROM_NAME,
            from_email: FROM_EMAIL,
          },
        },
      ],
    },
  }),
});
const wfId = created.id || created._id || created.workflowId;
console.log('Workflow:', wfId);

// guardar steps (PUT con version)
const current = await ghlWorkflowFetch(`/workflow/${LOC}/${wfId}?includeScheduledPauseInfo=true&sessionId=test`);
await ghlWorkflowFetch(`/workflow/${LOC}/${wfId}`, {
  method: 'PUT',
  body: JSON.stringify({
    version: current.version,
    name: `TEST email - ${FROM_NAME}`,
    status: 'draft',
    allowMultiple: true,
    removeContactFromLastStep: true,
    workflowData: {
      templates: [
        {
          id: stepEmail,
          order: 0,
          name: 'Enviar email personalizado',
          type: 'email',
          attributes: { subject: SUBJECT, html, from_name: FROM_NAME, from_email: FROM_EMAIL },
        },
      ],
    },
  }),
});

// 3) trigger por tag
const trig = await ghlWorkflowFetch(`/workflow/${LOC}/trigger`, {
  method: 'POST',
  body: JSON.stringify({
    workflowId: wfId,
    type: 'contact_tag_added',
    name: `Tag ${TAG}`,
    active: true,
    conditions: [
      {
        field: 'tagsAdded',
        operator: 'index-of-true',
        value: TAG,
        title: 'Tag Added',
        type: 'select',
        id: 'tag-added',
      },
    ],
    actions: [{ workflow_id: wfId, type: 'add_to_workflow' }],
  }),
});
const trigId = trig.id || trig._id;
console.log('Trigger:', trigId);

// 4) publicar
await ghlWorkflowFetch(`/workflow/${LOC}/change-status/${wfId}`, {
  method: 'PUT',
  body: JSON.stringify({ status: 'published', updatedBy: USER_ID }),
});
console.log('Publicado.');

// 5) disparar: añadir tag al contacto
const tr = await fetch(`https://services.leadconnectorhq.com/contacts/${contact.id}/tags`, {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + PIT,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ tags: [TAG] }),
});
console.log('Tag añadido ->', tr.status);
const ttxt = await tr.text();
console.log(ttxt.slice(0, 300));

console.log('\n=== LISTO ===');
console.log(JSON.stringify({ workflowId: wfId, triggerId: trigId, tag: TAG, from_name: FROM_NAME }, null, 2));
