#!/usr/bin/env node
/**
 * Lista las citas de un día (hora Colombia) en todos los calendarios de GHL.
 * Uso: node scripts/calendars/today.mjs [YYYY-MM-DD]
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = 'https://services.leadconnectorhq.com';
const LID = getLocationId();
const h = { Authorization: `Bearer ${getPitToken()}`, Version: '2021-04-15', Accept: 'application/json' };
const get = async (p) => (await fetch(`${BASE}${p}`, { headers: h })).json();

const day = process.argv[2] || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const start = Date.parse(`${day}T00:00:00-05:00`);
const end = start + 86400000;

const cals = (await get(`/calendars/?locationId=${LID}`)).calendars || [];
const rows = [];
for (const c of cals) {
  const ev = (await get(`/calendars/events?locationId=${LID}&calendarId=${c.id}&startTime=${start}&endTime=${end}`)).events || [];
  for (const e of ev) {
    const t = Date.parse(e.startTime);
    if (!(t >= start && t < end)) continue;
    rows.push({
      hora: new Date(e.startTime).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }),
      calendario: c.name.trim().slice(0, 32),
      titulo: (e.title || '').slice(0, 45),
      estado: e.appointmentStatus,
      eliminada: e.deleted ? 'sí' : '',
    });
  }
}
rows.sort((a, b) => a.hora.localeCompare(b.hora));
console.log(`Citas del ${day}: ${rows.length} (activas: ${rows.filter((r) => !['cancelled', 'invalid'].includes(r.estado) && !r.eliminada).length})`);
console.table(rows);
