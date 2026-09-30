#!/usr/bin/env node
/**
 * Muestra dónde vive el enlace de reunión en los calendarios y citas recientes.
 * Uso: node scripts/calendars/inspect-meeting-links.mjs
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = 'https://services.leadconnectorhq.com';
const LID = getLocationId();
const h = { Authorization: `Bearer ${getPitToken()}`, Version: '2021-07-28', Accept: 'application/json' };
const get = async (p) => (await fetch(`${BASE}${p}`, { headers: h })).json();

const CALS = ['bJT5h32OkoOdSfV2zd4O', 'JGiNpYTCf6w3BwpAdChw', 'o6c2SOIoEkjEfKtBPUNN', '2vVaqq8c1uZ2xSpXW6Cr'];
for (const id of CALS) {
  const c = (await get(`/calendars/${id}`)).calendar || {};
  console.log(`\n=== ${c.name} ===`);
  console.log('locationConfigurations:', JSON.stringify(c.locationConfigurations));
  console.log('teamMembers loc:', JSON.stringify((c.teamMembers || []).map((m) => m.locationConfigurations || m.meetingLocation)));
  const ev = await get(`/calendars/events?locationId=${LID}&calendarId=${id}&startTime=${Date.now() - 10 * 86400000}&endTime=${Date.now() + 20 * 86400000}`);
  for (const e of (ev.events || []).slice(-2)) {
    const pick = Object.fromEntries(Object.entries(e).filter(([k]) => /address|location|meet|link|url|zoom|google/i.test(k)));
    console.log(' evento', e.id, e.startTime, JSON.stringify(pick));
    const full = await get(`/calendars/events/appointments/${e.id}`);
    const a = full.appointment || full.event || full;
    const pick2 = Object.fromEntries(Object.entries(a).filter(([k]) => /address|location|meet|link|url|zoom|google/i.test(k)));
    console.log('   detalle', JSON.stringify(pick2));
  }
}
