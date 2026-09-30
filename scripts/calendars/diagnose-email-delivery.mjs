#!/usr/bin/env node
/**
 * Diagnóstico de entrega de correos de citas: usuarios, notificaciones de
 * los 4 calendarios de contingencias y estado de los últimos emails enviados.
 * Uso: node scripts/calendars/diagnose-email-delivery.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const LID = getLocationId();
const h = {
  Authorization: `Bearer ${getPitToken()}`,
  Version: process.env.GHL_API_VERSION || '2021-07-28',
  Accept: 'application/json',
};

async function get(path, version) {
  const res = await fetch(`${BASE}${path}`, { headers: version ? { ...h, Version: version } : h });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

const CALS = {
  bJT5h32OkoOdSfV2zd4O: 'Meta',
  JGiNpYTCf6w3BwpAdChw: 'Contingencias FB',
  o6c2SOIoEkjEfKtBPUNN: 'TikTok',
  '2vVaqq8c1uZ2xSpXW6Cr': 'Contingencias TikTok',
};

const out = {};

const users = await get(`/users/?locationId=${LID}`);
out.users = (users.body.users || []).map((u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, deleted: u.deleted,
}));
const userById = Object.fromEntries(out.users.map((u) => [u.id, u]));
console.log('\n=== USUARIOS ===');
for (const u of out.users) console.log(`${u.id}  ${u.name}  <${u.email}>`);

const loc = await get(`/locations/${LID}`);
const l = loc.body.location || loc.body;
out.location = { email: l.email, settings: l.settings, business: l.business?.email };
console.log('\n=== LOCATION ===', l.email);

out.calendars = {};
for (const [id, label] of Object.entries(CALS)) {
  const cal = await get(`/calendars/${id}`);
  const c = cal.body.calendar || {};
  const notifs = await get(`/calendars/${id}/notifications`);
  const list = Array.isArray(notifs.body) ? notifs.body : notifs.body.notifications || [];
  out.calendars[id] = {
    label,
    isActive: c.isActive,
    teamMembers: (c.teamMembers || []).map((m) => ({ ...m, user: userById[m.userId]?.name, email: userById[m.userId]?.email })),
    notifications: list.map((n) => ({
      id: n._id, channel: n.channel, type: n.notificationType, receiver: n.receiverType,
      isActive: n.isActive, deleted: n.deleted, additionalEmailIds: n.additionalEmailIds,
      selectedUsers: n.selectedUsers, fromAddress: n.fromAddress, fromName: n.fromName,
      subject: n.subject,
    })),
  };
  console.log(`\n=== ${label} (${id}) active=${c.isActive} ===`);
  for (const m of out.calendars[id].teamMembers) console.log(`  miembro: ${m.user} <${m.email}>`);
  for (const n of out.calendars[id].notifications) {
    console.log(`  [${n.isActive ? 'ON ' : 'OFF'}] ${n.channel}/${n.type}/${n.receiver} extra=${JSON.stringify(n.additionalEmailIds || [])} users=${JSON.stringify(n.selectedUsers || [])}`);
  }
}

// Últimos emails enviados desde la location
const since = Date.now() - 14 * 86400000;
const convs = await get(`/conversations/search?locationId=${LID}&limit=100&sort=desc&sortBy=last_message_date&lastMessageType=TYPE_EMAIL`);
const emails = [];
for (const cv of convs.body.conversations || []) {
  const msgs = await get(`/conversations/${cv.id}/messages?limit=20&type=TYPE_EMAIL`);
  const arr = msgs.body.messages?.messages || msgs.body.messages || [];
  for (const m of arr) {
    if (new Date(m.dateAdded).getTime() < since) continue;
    emails.push({
      date: m.dateAdded, dir: m.direction, status: m.status, contact: cv.fullName || cv.contactName,
      to: cv.email, subject: m.meta?.email?.subject || m.subject, source: m.source, error: m.error || m.meta?.error,
    });
  }
}
out.emails = emails.sort((a, b) => b.date.localeCompare(a.date));
const byStatus = {};
for (const e of out.emails.filter((e) => e.dir === 'outbound')) byStatus[e.status] = (byStatus[e.status] || 0) + 1;
console.log(`\n=== EMAILS SALIENTES 14d: ${out.emails.filter((e) => e.dir === 'outbound').length} ===`, byStatus);
for (const e of out.emails.slice(0, 40)) {
  console.log(`${e.date.slice(0, 16)} ${e.dir} ${e.status} → ${e.to} | ${e.subject || ''} ${e.error ? 'ERR ' + JSON.stringify(e.error) : ''}`);
}

mkdirSync('reports', { recursive: true });
writeFileSync('reports/email-delivery.json', JSON.stringify(out, null, 2));
console.log('\nGuardado en reports/email-delivery.json');
