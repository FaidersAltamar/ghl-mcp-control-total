#!/usr/bin/env node
/**
 * Crea una cita de PRUEBA en un calendario para un contacto existente (por teléfono),
 * espera y muestra si GHL generó el enlace de reunión. Con --cancel <eventId> la cancela.
 * Uso: node scripts/calendars/test-booking.mjs <calendarId> <telefono>
 *      node scripts/calendars/test-booking.mjs --cancel <eventId>
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = 'https://services.leadconnectorhq.com';
const LID = getLocationId();
const h = { Authorization: `Bearer ${getPitToken()}`, Version: '2021-04-15', Accept: 'application/json', 'Content-Type': 'application/json' };
const call = async (p, init) => {
  const r = await fetch(`${BASE}${p}`, { headers: h, ...init });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

if (process.argv[2] === '--cancel') {
  const r = await call(`/calendars/events/appointments/${process.argv[3]}`, { method: 'PUT', body: JSON.stringify({ appointmentStatus: 'cancelled' }) });
  console.log('cancel', r.status);
  process.exit(0);
}

const [calendarId, phone] = process.argv.slice(2);
const s = await call('/contacts/search', { method: 'POST', body: JSON.stringify({ locationId: LID, pageLimit: 1, filters: [{ field: 'phone', operator: 'eq', value: phone }] }) });
const contact = s.body.contacts?.[0];
if (!contact) throw new Error('Contacto no encontrado');
console.log('contacto', contact.id);

const cal = (await call(`/calendars/${calendarId}`)).body.calendar;
const start = Date.now() + 2 * 86400000;
const slots = (await call(`/calendars/${calendarId}/free-slots?startDate=${start}&endDate=${start + 5 * 86400000}&timezone=America/Bogota`)).body;
const day = Object.keys(slots).find((k) => slots[k]?.slots?.length);
const slot = slots[day].slots[0];
console.log('slot', slot);

const r = await call('/calendars/events/appointments', {
  method: 'POST',
  body: JSON.stringify({
    calendarId, locationId: LID, contactId: contact.id, startTime: slot,
    title: 'PRUEBA — ignorar (verificando enlace)', appointmentStatus: 'confirmed',
    assignedUserId: cal.teamMembers[0].userId, meetingLocationType: 'gmeet',
  }),
});
console.log('create', r.status, JSON.stringify(r.body).slice(0, 400));
const id = r.body.id;
for (let i = 0; i < 6; i++) {
  await new Promise((res) => setTimeout(res, 5000));
  const a = (await call(`/calendars/events/appointments/${id}`)).body;
  const ap = a.appointment || a.event || a;
  console.log(`t+${(i + 1) * 5}s address=`, ap.address, 'meetingLocationType=', ap.meetingLocationType);
  if (ap.address) break;
}
console.log('eventId', id);
