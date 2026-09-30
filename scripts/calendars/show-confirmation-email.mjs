#!/usr/bin/env node
/**
 * Muestra los enlaces del último correo de confirmación de cita de un contacto.
 * Uso: node scripts/calendars/show-confirmation-email.mjs correo@cliente.com
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = 'https://services.leadconnectorhq.com';
const LID = getLocationId();
const h = { Authorization: `Bearer ${getPitToken()}`, Version: '2021-07-28', Accept: 'application/json', 'Content-Type': 'application/json' };
const call = async (p, init) => (await fetch(`${BASE}${p}`, { headers: h, ...init })).json();

const email = process.argv[2];
const s = await call('/contacts/search', { method: 'POST', body: JSON.stringify({ locationId: LID, pageLimit: 1, filters: [{ field: 'email', operator: 'eq', value: email }] }) });
const c = s.contacts?.[0];
const conv = await call(`/conversations/search?locationId=${LID}&contactId=${c.id}`);
for (const cv of conv.conversations || []) {
  const m = await call(`/conversations/${cv.id}/messages?limit=30`);
  const em = (m.messages?.messages || []).find((x) => x.messageType === 'TYPE_EMAIL');
  if (!em) continue;
  const d = (await call(`/conversations/messages/email/${em.meta.email.messageIds[0]}`)).emailMessage || {};
  console.log('Asunto:', d.subject);
  const text = (d.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  console.log('Texto:', text.slice(0, 1500));
  console.log('Enlaces:', [...new Set((d.body || '').match(/https?:\/\/[^"'\s<>]+/g) || [])].join('\n'));
}
