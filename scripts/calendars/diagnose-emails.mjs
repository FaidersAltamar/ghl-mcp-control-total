#!/usr/bin/env node
/**
 * Diagnóstico de correos de calendario: plantillas, idioma, destinatarios.
 * Uso: node scripts/calendars/diagnose-emails.mjs
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const VERSION = process.env.GHL_API_VERSION || '2021-07-28';
const LID = getLocationId();
const PIT = getPitToken();

const h = {
  Authorization: `Bearer ${PIT}`,
  Version: VERSION,
  'Content-Type': 'application/json',
};

async function pitGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: h });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  return body;
}

// Location (idioma, email default)
let location = null;
try {
  location = await pitGet(`/locations/${LID}`);
} catch (e) {
  console.error('location error:', e.message);
}

console.log('\n=== LOCATION ===');
console.log(JSON.stringify({
  id: location?.id,
  name: location?.name,
  companyName: location?.companyName,
  email: location?.email,
  fromEmail: location?.fromEmail,
  timezone: location?.timezone,
  language: location?.language,
  website: location?.website,
  city: location?.city,
  country: location?.country,
}, null, 2));

const { calendars = [] } = await pitGet(`/calendars/?locationId=${LID}`);

const TARGETS = ['bJT5h32OkoOdSfV2zd4O', 'o6c2SOIoEkjEfKtBPUNN'];

for (const cal of calendars.filter((c) => TARGETS.includes(c.id))) {
  console.log(`\n\n========================================`);
  console.log(`CALENDAR: ${cal.name} (${cal.id})`);
  console.log(`========================================`);
  console.log(JSON.stringify({
    isActive: cal.isActive,
    teamMembers: cal.teamMembers,
    calendarMembers: cal.calendarMembers,
    googleInvitationEmails: cal.googleInvitationEmails,
    preBuffer: cal.preBuffer,
    slotDuration: cal.slotDuration,
  }, null, 2));

  let notifs = [];
  try {
    const r = await pitGet(`/calendars/${cal.id}/notifications?locationId=${LID}`);
    notifs = Array.isArray(r) ? r : (r.notifications || []);
  } catch (e) {
    console.error('notifs error:', e.message);
  }

  for (const n of notifs) {
    console.log(`\n--- notif ${n.notificationType}/${n.receiverType} (${n._id}) ---`);
    console.log(JSON.stringify({
      channel: n.channel,
      isActive: n.isActive,
      beforeTime: n.beforeTime,
      afterTime: n.afterTime,
      delayedEmail: n.delayedEmail,
      additionalEmailIds: n.additionalEmailIds,
      userId: n.userId,
      subject: n.subject,
      body: n.body,
    }, null, 2));
  }
}
