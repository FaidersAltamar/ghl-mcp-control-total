#!/usr/bin/env node
/**
 * Busca los contactos del equipo por email y muestra los últimos correos
 * que GHL les registró con su estado de entrega.
 * Uso: node scripts/calendars/check-team-inbox.mjs email1 email2 ...
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const LID = getLocationId();
const h = {
  Authorization: `Bearer ${getPitToken()}`,
  Version: process.env.GHL_API_VERSION || '2021-07-28',
  Accept: 'application/json',
  'Content-Type': 'application/json',
};
const call = async (p, init = {}) => {
  const r = await fetch(`${BASE}${p}`, { headers: h, ...init });
  return r.json().catch(() => ({}));
};

for (const email of process.argv.slice(2)) {
  const s = await call(`/contacts/search`, {
    method: 'POST',
    body: JSON.stringify({ locationId: LID, pageLimit: 5, filters: [{ field: 'email', operator: 'eq', value: email }] }),
  });
  const list = s.contacts || [];
  console.log(`\n=== ${email}: ${list.length} contacto(s) ===`);
  for (const c of list) {
    console.log(`contacto ${c.id} ${c.firstNameLowerCase || ''} ${c.lastNameLowerCase || ''} dnd=${c.dnd} tags=${(c.tags || []).join(',')}`);
    const conv = await call(`/conversations/search?locationId=${LID}&contactId=${c.id}`);
    for (const cv of conv.conversations || []) {
      const m = await call(`/conversations/${cv.id}/messages?limit=30`);
      for (const x of (m.messages?.messages || []).filter((x) => x.messageType === 'TYPE_EMAIL').slice(0, 10)) {
        const id = x.meta?.email?.messageIds?.[0];
        const d = id ? (await call(`/conversations/messages/email/${id}`)).emailMessage || {} : {};
        console.log(`  ${x.dateAdded?.slice(0, 16)} ${x.direction} ${d.status || '?'} "${(d.subject || '').slice(0, 60)}"`);
      }
    }
  }
}
