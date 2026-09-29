#!/usr/bin/env node
/**
 * Envía un correo de prueba (vía conversación Email) a un contacto.
 * Uso: node scripts/calendars/send-test-email.mjs <email> [asunto]
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';
import { getIdToken, BACKEND } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

const LID = getLocationId();
const PIT = getPitToken();
const toEmail = process.argv[2];
if (!toEmail) {
  console.error('Uso: node scripts/calendars/send-test-email.mjs <email>');
  process.exit(1);
}

// 1) Buscar contacto por email
const sr = await fetch('https://services.leadconnectorhq.com/contacts/search', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + PIT,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    locationId: LID,
    page: 1,
    pageLimit: 1,
    filters: [{ field: 'email', operator: 'eq', value: toEmail }],
  }),
});
const sj = await sr.json();
const contact = (sj.contacts && sj.contacts[0]) || null;
if (!contact) {
  console.error('Contacto no encontrado para:', toEmail);
  process.exit(1);
}
console.log('Contacto:', contact.id, contact.firstName, contact.lastName, '|', contact.email);

// 2) Enviar correo via backend
const token = await getIdToken();
const headers = {
  'token-id': token,
  channel: 'APP',
  source: 'WEB_USER',
  version: '2021-07-28',
  'content-type': 'application/json',
  accept: 'application/json',
};

const subject = process.argv[3] || 'Prueba de correo — Control Ads';

const html = `
<p>Hola ${contact.firstName || ''},</p>
<p>Este es un correo de <strong>prueba</strong> para confirmar que el sistema de notificaciones del calendario funciona correctamente.</p>
<p>Si recibes este correo sin problemas, ya está todo listo.</p>
<p>— Control Ads (Faiders Altamar)</p>
`;

const r = await fetch(`${BACKEND}/conversations/messages`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    type: 'Email',
    contactId: contact.id,
    subject,
    html,
  }),
});
const t = await r.text();
console.log('Envío ->', r.status);
console.log(t.slice(0, 500));
