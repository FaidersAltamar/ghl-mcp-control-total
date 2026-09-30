#!/usr/bin/env node
/**
 * Cruza las citas recientes de los 4 calendarios con los correos que recibió
 * cada contacto y muestra el estado de entrega (delivered/opened/failed...).
 * Uso: node scripts/calendars/check-booking-emails.mjs [dias=15]
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const LID = getLocationId();
const h = {
  Authorization: `Bearer ${getPitToken()}`,
  Version: process.env.GHL_API_VERSION || '2021-07-28',
  Accept: 'application/json',
};
const get = async (p) => {
  const r = await fetch(`${BASE}${p}`, { headers: h });
  return r.json().catch(() => ({}));
};

const DAYS = Number(process.argv[2] || 15);
const CALS = {
  bJT5h32OkoOdSfV2zd4O: 'Meta',
  JGiNpYTCf6w3BwpAdChw: 'Contingencias FB',
  o6c2SOIoEkjEfKtBPUNN: 'TikTok',
  '2vVaqq8c1uZ2xSpXW6Cr': 'Contingencias TikTok',
};

const start = Date.now() - DAYS * 86400000;
const end = Date.now() + 30 * 86400000;

for (const [calId, label] of Object.entries(CALS)) {
  const ev = await get(`/calendars/events?locationId=${LID}&calendarId=${calId}&startTime=${start}&endTime=${end}`);
  const events = (ev.events || []).filter((e) => new Date(e.dateAdded).getTime() >= start);
  console.log(`\n=== ${label}: ${events.length} citas creadas en ${DAYS}d ===`);
  for (const e of events) {
    const c = (await get(`/contacts/${e.contactId}`)).contact || {};
    const conv = await get(`/conversations/search?locationId=${LID}&contactId=${e.contactId}`);
    let emails = [];
    for (const cv of conv.conversations || []) {
      const m = await get(`/conversations/${cv.id}/messages?limit=50`);
      const arr = m.messages?.messages || [];
      emails.push(...arr.filter((x) => x.messageType === 'TYPE_EMAIL' && new Date(x.dateAdded) >= new Date(e.dateAdded) - 60000));
    }
    const detail = [];
    for (const em of emails.slice(0, 3)) {
      const id = em.meta?.email?.messageIds?.[0];
      const d = id ? (await get(`/conversations/messages/email/${id}`)).emailMessage || {} : {};
      detail.push(`${d.status || em.status || '?'}${d.subject ? ` "${d.subject.slice(0, 40)}"` : ''}`);
    }
    console.log(`${e.dateAdded?.slice(0, 16)} ${e.appointmentStatus} | ${c.email || 'SIN EMAIL'} | ${e.title?.slice(0, 40)} | emails: ${detail.length ? detail.join(' ; ') : 'NINGUNO'}`);
  }
}
