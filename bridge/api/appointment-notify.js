// Notificación de citas al equipo vía WhatsApp (desde el número americano).
// Recibe un POST desde un workflow de GHL (acción "webhook") con los datos de la cita
// y envía el aviso a los responsables del calendario correspondiente.
//
// Seguridad:
//  - Solo acepta el secreto dedicado APPOINTMENT_NOTIFY_SECRET (vía body "secret" o header "x-admin-key").
//    NO acepta el secreto del webhook de WhatsApp entrante (WASENDER_WEBHOOK_SECRET).
//  - Solo envía a los números fijos del equipo (variables TIKTOK_TEAM_PHONES / META_TEAM_PHONES);
//    nunca acepta un destinatario arbitrario desde la petición.
//  - La respuesta no expone los números del equipo.
//
// Body (JSON):
// {
//   "secret": "...",
//   "kind": "booked" | "reminder",
//   "calendar_id": "o6c2SOIoEkjEfKtBPUNN",
//   "name": "Nombre del cliente",
//   "email": "cliente@correo.com",
//   "phone": "+57...",
//   "when": "2026-09-20T10:00:00-05:00",
//   "location": "Zoom / presencial",
//   "meeting_link": "https://...",
//   "zoom_link": "https://...",
//   "google_meet_link": "https://...",
//   "title": "Título de la cita",
//   "notes": "Notas / respuestas del formulario"
// }

import { sendText, pickConnectedSession } from '../lib/wasender.js';
import { sendTrackedEmail, getAppointment, getContactAppointments, setAppointmentLink } from '../lib/ghl.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Calendarios TikTok y Meta (ids -> equipo)
const CAL_TIKTOK = new Set([
  'o6c2SOIoEkjEfKtBPUNN', // TikTok Ads - Llamada Estrategica
  '2vVaqq8c1uZ2xSpXW6Cr', // Contingencias TikTok
]);
const CAL_META = new Set([
  'bJT5h32OkoOdSfV2zd4O', // Meta Ads - Llamada Estrategica
  'JGiNpYTCf6w3BwpAdChw', // Contingencias facebook
]);

const CAL_LABEL = {
  bJT5h32OkoOdSfV2zd4O: 'Meta Ads',
  JGiNpYTCf6w3BwpAdChw: 'Contingencias Facebook',
  o6c2SOIoEkjEfKtBPUNN: 'TikTok Ads',
  '2vVaqq8c1uZ2xSpXW6Cr': 'Contingencias TikTok',
};

function phones(envKey, fallback) {
  return (process.env[envKey] || fallback)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

function maskPhone(p) {
  // Enmascara el número: +57••••••4111
  const d = p.replace(/\D/g, '');
  if (d.length < 6) return '•••';
  return `+${d.slice(0, 2)}••••${d.slice(-4)}`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// WhatsApp -> HTML: *negrita* y saltos de línea; URLs como enlaces.
function toHtml(text) {
  return esc(text)
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .split('\n').join('<br>');
}

async function sendEmailWithRetry(msg) {
  try {
    return await sendTrackedEmail(msg);
  } catch (e) {
    await sleep(1500);
    return sendTrackedEmail(msg);
  }
}

function isUrl(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
}

// GHL a veces envía la hora sin zona ("2026-10-02T08:30:00"): es hora de la cuenta (Bogotá).
function parseWhen(s, timeZone = 'America/Bogota') {
  if (!s) return null;
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(s)) return new Date(s);
  const asUtc = new Date(`${s.replace(' ', 'T')}Z`);
  if (isNaN(asUtc.getTime())) return new Date(s);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(asUtc).map((x) => [x.type, x.value]));
  const zoned = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(asUtc.getTime() - (zoned - asUtc.getTime()));
}

// Vercel corre en UTC: la zona horaria debe ir explícita.
function fmtWhen(iso, timeZone = 'America/Bogota') {
  if (!iso) return '';
  try {
    const d = parseWhen(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short', timeZone });
  } catch {
    return timeZone === 'America/Bogota' ? iso : fmtWhen(iso);
  }
}

// MEETING_LINKS="calendarId=https://...,calendarId2=https://..." — enlace fijo por calendario.
function fixedMeetingLink(calendarId) {
  for (const pair of (process.env.MEETING_LINKS || '').split(',')) {
    const i = pair.indexOf('=');
    if (i > 0 && pair.slice(0, i).trim() === calendarId) return pair.slice(i + 1).trim();
  }
  return '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const b = req.body || {};
  const q = req.query || {};
  const cd = b.customData || b.custom_data || {};
  const notifySecret = process.env.APPOINTMENT_NOTIFY_SECRET || '';
  const adminKey = req.headers['x-admin-key'] || '';
  const givenSecret = b.secret || cd.secret || q.secret || '';

  // Solo el secreto dedicado. Si no está configurado, la función queda bloqueada.
  if (!notifySecret || (givenSecret !== notifySecret && adminKey !== notifySecret)) {
    console.warn('appointment-notify 401 keys=', Object.keys(b).join(','));
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // La acción "Webhook" estándar de GHL ignora el body personalizado y envía su propio
  // payload (contacto en la raíz + objeto `calendar`), así que se aceptan ambos formatos.
  // Las variables sin resolver ("{{...}}") se tratan como vacías.
  const val = (...xs) => {
    for (const x of xs) {
      if (x && typeof x === 'object') continue;
      const s = (x ?? '').toString().trim();
      if (s && !/^\{\{.*\}\}$/.test(s)) return s;
    }
    return '';
  };
  const cal = b.calendar || {};
  const calendar_id = val(b.calendar_id, cd.calendar_id, q.cal, cal.id, cal.calendarId);
  const kind = val(b.kind, cd.kind, q.kind) || 'booked';
  const name = val(b.name, b.full_name, [b.first_name, b.last_name].filter(Boolean).join(' '), b.contact_name);
  const email = val(b.email);
  const phone = val(b.phone);
  let when = val(b.when, cal.startTime, cal.start_time);
  const location = val(b.location, cal.address, cal.location);
  const meeting_link = val(b.meeting_link, cal.meetingLocation, cal.meeting_location);
  const zoom_link = val(b.zoom_link);
  const google_meet_link = val(b.google_meet_link);
  const title = val(b.title, cal.title);
  const notes = val(b.notes, cal.notes);

  let teamKey = null;
  if (CAL_TIKTOK.has(calendar_id)) teamKey = 'tiktok';
  else if (CAL_META.has(calendar_id)) teamKey = 'meta';
  if (!teamKey) {
    return res.status(200).json({ ok: false, skipped: 'calendario-no-configurado' });
  }

  const team = teamKey === 'tiktok'
    ? phones('TIKTOK_TEAM_PHONES', '')
    : phones('META_TEAM_PHONES', '');

  const fromPhone = process.env.NOTIFY_FROM_PHONE || '+17863728411';
  const clientTz = val(cal.selectedTimezone, cal.selected_timezone, b.timezone) || 'America/Bogota';
  let calName = teamKey === 'tiktok' ? 'TikTok Ads' : 'Meta Ads';
  console.log('appointment-notify calendar=', JSON.stringify(cal).slice(0, 600));

  // Enlace de la reunión: payload > cita en GHL (Meet/Zoom generado) > enlace fijo del calendario.
  let link = [zoom_link, google_meet_link, meeting_link, location]
    .map((s) => (s || '').toString().trim())
    .find(isUrl) || '';
  // La cita consultada en GHL trae la hora con zona horaria y el enlace; Google Meet
  // puede tardar unos segundos en generarse, por eso se reintenta.
  const appointmentId = val(cal.appointmentId, cal.appointment_id, b.appointment_id);
  const contactId = val(b.contact_id, b.contactId, cd.contact_id);
  const linkOf = (a) => [a?.address, a?.meetingLocation, a?.hangoutLink].find(isUrl) || '';
  let appt = null;
  for (let attempt = 0; !link && (appointmentId || contactId) && attempt < 4; attempt++) {
    if (attempt) await sleep(3000);
    try {
      if (appointmentId) {
        appt = await getAppointment(appointmentId);
      } else {
        const whenMs = parseWhen(when)?.getTime() ?? Date.now();
        const teamCals = teamKey === 'tiktok' ? CAL_TIKTOK : CAL_META;
        const appts = (await getContactAppointments(contactId))
          .filter((a) => teamCals.has(a.calendarId))
          .sort((x, y) => Math.abs(Date.parse(x.startTime) - whenMs) - Math.abs(Date.parse(y.startTime) - whenMs));
        appt = appts[0] || null;
      }
      link = linkOf(appt);
    } catch (e) { /* no fatal */ }
  }
  if (appt?.startTime && /[zZ]|[+-]\d\d:?\d\d$/.test(appt.startTime)) when = appt.startTime;
  const realCalendarId = appt?.calendarId || calendar_id;
  if (CAL_LABEL[realCalendarId]) calName = CAL_LABEL[realCalendarId];
  // Citas creadas a mano como "Llamada por WhatsApp": sin enlace de video.
  const whatsappCall = /whatsapp/i.test(appt?.address || location || '');
  if (!link && !whatsappCall) link = fixedMeetingLink(realCalendarId);
  // Sin Google Meet: sala propia por cita, guardada en GHL para recordatorios, correos y agenda.
  if (!link && !whatsappCall && appt?.id && kind !== 'reminder') {
    // meet.jit.si exige que un moderador inicie sesión; esta instancia abre la sala sin cuenta.
    const base = process.env.MEETING_BASE_URL || 'https://meet.ffmuc.net';
    link = `${base}/ControlAds-${calName.replace(/\s+/g, '')}-${appt.id}`;
    try { await setAppointmentLink(appt.id, link); } catch (e) { /* no fatal */ }
  }
  const whenFmt = fmtWhen(when);

  // El paso "24 h antes" se ejecuta de inmediato si se agendó con menos de 24 h: se omite ese duplicado.
  if (kind === 'reminder' && appt) {
    const status = (appt.appointmentStatus || '').toLowerCase();
    const ageMin = (Date.now() - Date.parse(appt.dateAdded || 0)) / 60000;
    if (['cancelled', 'noshow', 'invalid'].includes(status) || ageMin < 20) {
      return res.status(200).json({ ok: true, skipped: status === 'confirmed' || !status ? 'recien-agendada' : `estado-${status}` });
    }
  }

  const clean = (s) => (s || '').toString().trim();

  let text;
  if (kind === 'reminder') {
    text = [
      `⏰ *Recordatorio de cita — ${calName}*`,
      title ? `📌 ${clean(title)}` : '',
      `👤 Cliente: ${clean(name) || '—'}`,
      email ? `📧 Correo: ${clean(email)}` : '',
      phone ? `📱 Contacto: ${clean(phone)}` : '',
      `📅 Fecha y hora: ${whenFmt || '—'}`,
      location && !isUrl(location) ? `📍 Ubicación: ${clean(location)}` : '',
      link ? `🔗 Enlace: ${link}` : whatsappCall ? '📞 Llamada por WhatsApp al número del cliente.' : '⚠️ Sin enlace de reunión: envíaselo al cliente por WhatsApp.',
      '',
      'Recuerda revisar los detalles de la llamada. ¡Éxitos! 💪',
    ].filter(Boolean).join('\n');
  } else {
    text = [
      `🔔 *Nueva cita agendada — ${calName}*`,
      title ? `📌 ${clean(title)}` : '',
      `👤 Cliente: ${clean(name) || '—'}`,
      email ? `📧 Correo: ${clean(email)}` : '',
      phone ? `📱 Contacto: ${clean(phone)}` : '',
      `📅 Fecha y hora: ${whenFmt || '—'}`,
      location && !isUrl(location) ? `📍 Ubicación: ${clean(location)}` : '',
      link ? `🔗 Enlace: ${link}` : whatsappCall ? '📞 Llamada por WhatsApp al número del cliente.' : '⚠️ Sin enlace de reunión: envíaselo al cliente por WhatsApp.',
      notes ? `📝 Notas: ${clean(notes)}` : '',
    ].filter(Boolean).join('\n');
  }

  // Correos al equipo en paralelo y en primer lugar: salen aunque WhatsApp esté caído.
  const teamEmails = phones(teamKey === 'tiktok' ? 'TIKTOK_TEAM_EMAILS' : 'META_TEAM_EMAILS', '');
  const subject = kind === 'reminder'
    ? `⏰ Recordatorio de cita ${calName} — ${clean(name) || 'cliente'} — ${whenFmt}`
    : `🔔 Nueva cita ${calName} — ${clean(name) || 'cliente'} — ${whenFmt}`;
  const emailJobs = teamEmails.map((to) => sendEmailWithRetry({
    to,
    subject,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${toHtml(text)}</div>`,
    fromName: `Citas ${calName}`,
  }));
  if (email && (link || whatsappCall)) {
    const first = clean(b.first_name) || clean(name).split(' ')[0] || '';
    const btn = link ? `<a href="${esc(link)}" style="display:inline-block;background:#d60000;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Unirme a la llamada</a>` : '';
    const how = link
      ? `<p><strong>🔗 Enlace de la reunión:</strong><br><a href="${esc(link)}">${esc(link)}</a></p><p>${btn}</p>`
      : '<p><strong>📞 Te llamaremos por WhatsApp</strong> al número que registraste.</p>';
    emailJobs.push(sendEmailWithRetry({
      to: email,
      subject: kind === 'reminder'
        ? `⏰ Recordatorio: tu llamada con ${calName} — ${whenFmt}`
        : `✅ Tu llamada con ${calName} está confirmada — ${whenFmt}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">
<p>Hola${first ? ` ${esc(first)}` : ''},</p>
<p>${kind === 'reminder' ? 'Te recordamos tu llamada' : 'Tu llamada quedó agendada'} con el equipo de <strong>${esc(calName)}</strong>.</p>
<p><strong>📅 Fecha y hora:</strong> ${esc(whenFmt)} (hora Colombia)</p>
${how}
<p>Te recomendamos estar disponible 5 minutos antes. Si necesitas reprogramar, responde a este correo.</p>
</div>`,
      fromName: `Citas ${calName}`,
    }));
  }
  const emailsPromise = Promise.allSettled(emailJobs);
  const emailSummary = async () => {
    const results = await emailsPromise;
    const failedEmails = results.filter((r) => r.status === 'rejected');
    for (const r of failedEmails) console.error('appointment-notify email falló:', r.reason?.message);
    return { sent: results.length - failedEmails.length, failed: failedEmails.length };
  };

  // Elegir la sesión emisora: el número principal si está conectado; si no, un respaldo conectado.
  const fallbacks = (process.env.NOTIFY_FALLBACK_PHONES || '3150030990')
    .split(',').map((p) => p.trim()).filter(Boolean);
  let sender;
  try {
    sender = await pickConnectedSession([fromPhone, ...fallbacks]);
  } catch (e) {
    sender = { api_key: null, tried: [] };
  }
  if (!sender.api_key) {
    console.error('appointment-notify: ninguna sesión conectada', JSON.stringify(sender.tried));
    const emails = await emailSummary();
    return res.status(emails.sent ? 200 : 503).json({
      ok: false, error: 'sin-sesion-conectada', whatsapp: { sent: 0, failed: team.length }, emails,
    });
  }
  const apiKey = sender.api_key;
  const usedFallback = sender.phone_number.replace(/\D/g, '') !== fromPhone.replace(/\D/g, '');

  // Si el número principal está caído, avisar al dueño para que lo reconecte (vía el respaldo).
  if (usedFallback) {
    const owner = process.env.NOTIFY_OWNER_PHONE || '+573165559823';
    const alert = [
      '⚠️ *WhatsApp principal desconectado*',
      `El número ${fromPhone} no está conectado, por eso este aviso sale desde el número de respaldo.`,
      '🔗 Reconéctalo escaneando el QR: https://bridge-iota-opal.vercel.app/',
    ].join('\n');
    try { await sendText(owner, alert, apiKey); } catch (e) { /* no fatal */ }
    await sleep(5500);
  }

  const sendWithRetry = async (to, body) => {
    try {
      await sendText(to, body, apiKey);
      return true;
    } catch (e) {
      await sleep(5500);
      try {
        await sendText(to, body, apiKey);
        return true;
      } catch (e2) {
        console.error('appointment-notify whatsapp falló:', maskPhone(to), e2.message);
        return false;
      }
    }
  };

  // Aviso a quien agendó. Solo desde el número principal: el de respaldo es el de contingencias.
  let client = 'sin-telefono';
  if (phone && !usedFallback) {
    const firstName = clean(b.first_name) || clean(name).split(' ')[0] || '';
    const localWhen = fmtWhen(when, clientTz);
    const clientWhen = !whenFmt ? '—' : clientTz !== 'America/Bogota' && localWhen !== whenFmt
      ? `${whenFmt} (hora Colombia) · ${localWhen.split(', ').pop()} en tu zona (${clientTz})`
      : `${whenFmt} (hora Colombia)`;
    const clientText = kind === 'reminder'
      ? [
        `⏰ Hola${firstName ? ` ${firstName}` : ''}, te recordamos tu llamada con el equipo de *${calName}*.`,
        '',
        `📅 ${clientWhen}`,
        link ? `🔗 Enlace para conectarte: ${link}` : whatsappCall ? '📞 Te llamaremos por WhatsApp a este número.' : '',
        '',
        'Te recomendamos conectarte 5 minutos antes. ¡Nos vemos! 🙌',
      ]
      : [
        `✅ Hola${firstName ? ` ${firstName}` : ''}, tu llamada con el equipo de *${calName}* quedó agendada.`,
        '',
        `📅 ${clientWhen}`,
        link ? `🔗 Enlace para conectarte: ${link}` : whatsappCall ? '📞 Te llamaremos por WhatsApp a este número.' : 'El enlace de la llamada te llegará por este medio antes de la reunión.',
        '',
        'Si necesitas reprogramar, responde a este mensaje. ¡Te esperamos! 🙌',
      ];
    client = (await sendWithRetry(phone, clientText.filter((l, i, a) => l || a[i - 1]).join('\n'))) ? 'enviado' : 'fallido';
    await sleep(5500);
  } else if (phone) {
    client = 'omitido-respaldo';
  }

  let ok = 0;
  let failed = 0;
  for (const to of team) {
    if (await sendWithRetry(to, text)) ok += 1;
    else failed += 1;
    await sleep(5500); // respetar protección de cuenta (1 msg cada ~5s)
  }

  const emails = await emailSummary();

  // Respuesta mínima: sin exponer números, correos ni detalles internos.
  return res.status(200).json({
    ok: failed === 0 && emails.failed === 0,
    sent: ok,
    failed,
    emails,
    client,
    link: Boolean(link),
    team: team.map(maskPhone),
    kind,
    fallback: usedFallback,
  });
}
