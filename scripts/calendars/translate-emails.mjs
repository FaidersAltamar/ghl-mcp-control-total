#!/usr/bin/env node
/**
 * Traduce a español las notificaciones email de los calendarios oficiales.
 * Conserva los destinatarios (additionalEmailIds) existentes.
 * Uso: node scripts/calendars/translate-emails.mjs
 */
import { loadEnv, getPitToken } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const VERSION = process.env.GHL_API_VERSION || '2021-07-28';
const PIT = getPitToken();

const TARGETS = ['bJT5h32OkoOdSfV2zd4O', 'o6c2SOIoEkjEfKtBPUNN'];

const h = {
  Authorization: `Bearer ${PIT}`,
  Version: VERSION,
  'Content-Type': 'application/json',
};

const ADD_TO_CAL = `
<div style="text-align: left; margin-top: 28px;">
  <p style="font-weight: 500; line-height: 4px; text-align: left;">Agregar al calendario</p><br>
  <a href="{{base_url}}/google/calendar/add-event/{{event_id}}"
    style="display: inline-block; padding: 10px 16px; border-radius: 8px; border: 1px solid #D0D5DD; color: #344054; cursor: pointer; text-decoration: none;"
    target="_blank"><img style="width:16px;height:16px;vertical-align:middle;margin-right:4px;border-style: none;padding: 2px 2px;"
      src="https://storage.googleapis.com/preview-production-assets/calendars/img/g-calendar.png" />Google</a>
  <a href="{{base_url}}/google/calendar/get-ics/{{event_id}}"
    style="display: inline-block; margin: 0 15px; padding: 10px 16px; border-radius: 8px; border: 1px solid #D0D5DD;color: #344054; cursor: pointer; text-decoration: none;"
    target="_blank"><img style="width:16px;height:16px;vertical-align:middle;margin-right:4px;border-style: none;padding: 2px 2px;"
      src="https://storage.googleapis.com/preview-production-assets/calendars/img/ms_outlook.png" />Outlook</a>
  <a href="{{base_url}}/google/calendar/get-ics/{{event_id}}"
    style="display: inline-block; padding: 10px 16px; border-radius: 8px; border: 1px solid #D0D5DD;color: #344054; cursor: pointer; text-decoration: none;"
    target="_blank"><img style="width:16px;height:16px;vertical-align:middle;margin-right:4px;border-style: none;padding: 2px 2px;"
      src="https://storage.googleapis.com/preview-production-assets/calendars/img/iCal.png" />iCloud</a>
</div>
`;

const REVIEW_BTN = `
<table width="100%" border="0" cellspacing="0" cellpadding="0">
<tr>
<td>
<table border="0" cellspacing="0" cellpadding="0">
<tr>
<td bgcolor="#EB7035" style="padding: 10px 9px 10px 9px;border-radius:3px;background-color: #37ca37;" align="center">
<a href="{{appointment_link}}" target="_blank" style="font-size: 16px; font-family: Helvetica, Arial, sans-serif; font-weight: normal; color: #ffffff; text-decoration: none; display: inline-block;">Revisar solicitud &rarr;</a>
</td>
</tr>
</table>
</td>
</tr>
</table>
`;

const TEMPLATES = {
  'booked|contact': {
    subject: 'Solicitud de cita recibida para el {{appointment.start_time}} ({{appointment.timezone_offset}})',
    body: `\nHola {{contact.name}},\n<br><br>\nHemos recibido tu solicitud de cita y te confirmaremos en breve.\n<br><br>\nEstos son los detalles de tu cita solicitada:\n<br><br>\nTítulo de la cita: {{appointment.title}}<br>\nFecha y hora: {{appointment.start_time}} ({{appointment.timezone_offset}})<br>\nEnlace / Ubicación de la reunión: {{appointment.meeting_location}}<br>\n<br><br>\n`,
  },
  'booked|assignedUser': {
    subject: 'Nueva cita agendada con {{contact.name}} el {{appointment.start_time}} ({{appointment.timezone_offset}})',
    body: `\nHola,\n<br><br>\nSe ha agendado una nueva cita con {{contact.name}}. Revisa los detalles a continuación y confirma la cita:\n<br><br>\nTítulo de la cita: {{appointment.title}}<br>\nFecha y hora: {{appointment.start_time}} ({{appointment.timezone_offset}})<br>\nEnlace / Ubicación de la reunión: {{appointment.meeting_location}}<br>\nNombre del contacto: {{contact.name}}<br>\n<br><br>\nHaz clic abajo para aprobar, reprogramar o cancelar la solicitud.\n<br><br>\n${REVIEW_BTN}\n`,
  },
  'booked|emails': {
    subject: 'Nueva cita agendada con {{contact.name}} el {{appointment.start_time}} ({{appointment.timezone_offset}})',
    body: `\nHola,\n<br><br>\nSe ha agendado una nueva cita con {{contact.name}}. Revisa los detalles a continuación y confirma la cita:\n<br><br>\nTítulo de la cita: {{appointment.title}}<br>\nFecha y hora: {{appointment.start_time}} ({{appointment.timezone_offset}})<br>\nEnlace / Ubicación de la reunión: {{appointment.meeting_location}}<br>\nNombre del contacto: {{contact.name}}<br>\n<br><br>\nHaz clic abajo para aprobar, reprogramar o cancelar la solicitud.\n<br><br>\n${REVIEW_BTN}\n`,
  },
  'confirmation|contact': {
    subject: 'Confirmación de cita para el {{appointment.start_time}} ({{appointment.timezone_offset}})',
    body: `\nHola {{contact.name}},\n<br><br>\nTu cita ha sido agendada. Estos son los detalles de tu próxima cita:\n<br><br>\nTítulo de la cita: {{appointment.title}}<br>\nFecha y hora: {{appointment.start_time}} ({{appointment.timezone_offset}})<br>\nEnlace / Ubicación de la reunión: {{appointment.meeting_location}}<br>\n${ADD_TO_CAL}\n`,
  },
  'confirmation|assignedUser': {
    subject: 'Confirmación de cita de {{contact.name}} el {{appointment.start_time}} ({{appointment.timezone_offset}})',
    body: `\nHola,\n<br><br>\nSe ha confirmado tu cita con {{contact.name}}. Estos son los detalles de la próxima cita:\n<br><br>\nTítulo de la cita: {{appointment.title}}<br>\nFecha y hora: {{appointment.start_time}} ({{appointment.timezone_offset}})<br>\nEnlace / Ubicación de la reunión: {{appointment.meeting_location}}<br>\nNombre del contacto: {{contact.name}}<br>\n<br><br>\nHaz clic abajo para aprobar, reprogramar o cancelar la solicitud.\n<br><br>\n${REVIEW_BTN}\n`,
  },
  'confirmation|emails': {
    subject: 'Confirmación de cita de {{contact.name}} el {{appointment.start_time}} ({{appointment.timezone_offset}})',
    body: `\nHola,\n<br><br>\nSe ha confirmado tu cita con {{contact.name}}. Estos son los detalles de la próxima cita:\n<br><br>\nTítulo de la cita: {{appointment.title}}<br>\nFecha y hora: {{appointment.start_time}} ({{appointment.timezone_offset}})<br>\nEnlace / Ubicación de la reunión: {{appointment.meeting_location}}<br>\nNombre del contacto: {{contact.name}}<br>\n<br><br>\nHaz clic abajo para aprobar, reprogramar o cancelar la solicitud.\n<br><br>\n${REVIEW_BTN}\n`,
  },
};

async function getNotifs(calId) {
  const res = await fetch(`${BASE}/calendars/${calId}/notifications`, { headers: h });
  if (!res.ok) throw new Error(`GET notifs ${calId} → ${res.status}`);
  return res.json();
}

for (const calId of TARGETS) {
  const notifs = await getNotifs(calId);
  console.log(`\n=== ${calId} ===`);
  for (const n of notifs) {
    if (n.channel !== 'email') continue;
    const key = `${n.notificationType}|${n.receiverType}`;
    const tpl = TEMPLATES[key];
    if (!tpl) {
      console.log(`SKIP ${key}`);
      continue;
    }
    const body = {
      channel: 'email',
      notificationType: n.notificationType,
      receiverType: n.receiverType,
      beforeTime: n.beforeTime || [],
      afterTime: n.afterTime || [],
      subject: tpl.subject,
      body: tpl.body,
      isActive: n.isActive !== false,
      ...(n.receiverType === 'emails' ? { additionalEmailIds: n.additionalEmailIds || [] } : {}),
    };
    const res = await fetch(`${BASE}/calendars/${calId}/notifications/${n._id}`, {
      method: 'PUT',
      headers: h,
      body: JSON.stringify(body),
    });
    console.log(`${res.status} ${key}${n.receiverType === 'emails' ? ' → ' + (n.additionalEmailIds || []).join(', ') : ''}`);
  }
}

console.log('\nDone.');
