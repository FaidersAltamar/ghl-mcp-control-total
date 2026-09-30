#!/usr/bin/env node
/**
 * Eventos crudos de un calendario entre dos fechas (hora Colombia).
 * Uso: node scripts/calendars/raw-events.mjs <calendarId> <desde YYYY-MM-DD> [días=3]
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });
const [calId, from, days = '3'] = process.argv.slice(2);
const s = Date.parse(`${from}T00:00:00-05:00`);
const e = s + Number(days) * 86400000;
const r = await fetch(
  `https://services.leadconnectorhq.com/calendars/events?locationId=${getLocationId()}&calendarId=${calId}&startTime=${s}&endTime=${e}`,
  { headers: { Authorization: `Bearer ${getPitToken()}`, Version: '2021-04-15' } },
);
for (const ev of (await r.json()).events || []) {
  console.log(ev.id, '|', ev.startTime, '|', ev.endTime, '|', ev.title, '|', ev.appointmentStatus, '|', ev.address || '');
}
