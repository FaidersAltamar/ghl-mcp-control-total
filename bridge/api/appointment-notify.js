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

function isUrl(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
}

function fmtWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const b = req.body || {};
  const notifySecret = process.env.APPOINTMENT_NOTIFY_SECRET || '';
  const adminKey = req.headers['x-admin-key'] || '';
  const bodySecret = b.secret || '';

  // Solo el secreto dedicado. Si no está configurado, la función queda bloqueada.
  if (!notifySecret || (bodySecret !== notifySecret && adminKey !== notifySecret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    calendar_id, kind, name, email, phone, when, location,
    meeting_link, zoom_link, google_meet_link, title, notes,
  } = b;

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
  const whenFmt = fmtWhen(when);
  const calName = teamKey === 'tiktok' ? 'TikTok Ads' : 'Meta Ads';

  // Enlace de la reunión: preferir zoom > meet > genérico > location si es URL.
  const link = [zoom_link, google_meet_link, meeting_link, location]
    .map((s) => (s || '').toString().trim())
    .find(isUrl) || '';

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
      link ? `🔗 Enlace: ${link}` : '',
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
      link ? `🔗 Enlace: ${link}` : '',
      notes ? `📝 Notas: ${clean(notes)}` : '',
    ].filter(Boolean).join('\n');
  }

  // Elegir la sesión emisora: el número principal si está conectado; si no, un respaldo conectado.
  const fallbacks = (process.env.NOTIFY_FALLBACK_PHONES || '3150030990')
    .split(',').map((p) => p.trim()).filter(Boolean);
  let sender;
  try {
    sender = await pickConnectedSession([fromPhone, ...fallbacks]);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'wasender-no-disponible' });
  }
  if (!sender.api_key) {
    console.error('appointment-notify: ninguna sesión conectada', JSON.stringify(sender.tried));
    return res.status(503).json({ ok: false, error: 'sin-sesion-conectada', tried: sender.tried.map((t) => t.status) });
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

  let ok = 0;
  let failed = 0;
  for (const to of team) {
    try {
      await sendText(to, text, apiKey);
      ok += 1;
    } catch (e) {
      failed += 1;
    }
    await sleep(5500); // respetar protección de cuenta (1 msg cada ~5s)
  }

  // Respuesta mínima: sin exponer números ni detalles internos.
  return res.status(200).json({
    ok: failed === 0,
    sent: ok,
    failed,
    team: team.map(maskPhone),
    kind,
    fallback: usedFallback,
  });
}
