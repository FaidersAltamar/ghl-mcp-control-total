#!/usr/bin/env node
/**
 * Guarda un enlace de reunión en una cita de GHL (campo address).
 * Uso: node scripts/calendars/set-link.mjs <eventId> [url]
 * Sin url genera una sala https://meet.ffmuc.net/ControlAds-<eventId>.
 */
import { loadEnv, getPitToken } from '../../lib/env.mjs';

loadEnv({ required: true });
const [id, url] = process.argv.slice(2);
if (!id) { console.error('Falta eventId'); process.exit(1); }
const link = url || `https://meet.ffmuc.net/ControlAds-MetaAds-${id}`;
const r = await fetch(`https://services.leadconnectorhq.com/calendars/events/appointments/${id}`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${getPitToken()}`, Version: '2021-04-15', 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: link, meetingLocationType: 'custom', overrideLocationConfig: true }),
});
console.log(r.status, r.ok ? link : (await r.text()).slice(0, 300));
