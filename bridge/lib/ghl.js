// Helpers de GHL: upsert de contacto (API pública) y creación de mensajes (backend).
const PUBLIC_BASE = 'https://services.leadconnectorhq.com';
const BACKEND_BASE = 'https://backend.leadconnectorhq.com';
const FIREBASE_API_KEY = 'AIzaSyB_w3vXmsI7WeQtrIOkjR6xTRVN5uOieiE';

let cachedToken = null;
let tokenExpiry = 0;

const PIT = () => process.env.GHL_PIT_TOKEN;
const LID = () => process.env.GHL_LOCATION_ID;

async function getBackendToken() {
  const internalJwt = process.env.GHL_INTERNAL_JWT;
  if (internalJwt) return internalJwt;
  const refreshToken = process.env.GHL_FIREBASE_REFRESH_TOKEN;
  if (!refreshToken) throw new Error('GHL_FIREBASE_REFRESH_TOKEN no configurado');
  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 60000) return cachedToken;
  const resp = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    }
  );
  if (!resp.ok) throw new Error(`Firebase refresh failed: ${resp.status}`);
  const data = await resp.json();
  cachedToken = data.id_token;
  tokenExpiry = now + parseInt(data.expires_in, 10) * 1000;
  return cachedToken;
}

export function normalizePhone(raw = '') {
  let p = String(raw).replace(/[^\d]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.length === 10 && p.startsWith('3')) p = '57' + p; // Colombia móvil
  return p ? '+' + p : '';
}

export async function upsertContact({ phone, email, name, firstName, lastName, customFields, tags }) {
  const body = { locationId: LID() };
  if (phone) body.phone = phone;
  if (email) body.email = email;
  if (firstName) body.firstName = firstName;
  if (lastName) body.lastName = lastName;
  else if (name) body.firstName = name;
  if (customFields && customFields.length) body.customFields = customFields;
  if (tags && tags.length) body.tags = tags;
  const resp = await fetch(`${PUBLIC_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + PIT(),
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!resp.ok) throw new Error(`Contact upsert ${resp.status}: ${text.slice(0, 200)}`);
  return json.contact || json;
}

export async function searchContact(filters) {
  const resp = await fetch(`${PUBLIC_BASE}/contacts/search`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + PIT(),
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ locationId: LID(), page: 1, pageLimit: 1, filters }),
  });
  if (!resp.ok) throw new Error(`Contact search ${resp.status}`);
  const json = await resp.json();
  return (json.contacts && json.contacts[0]) || null;
}

export const findContactByPhone = (phone) => searchContact([{ field: 'phone', operator: 'eq', value: phone }]);
export const findContactByEmail = (email) => searchContact([{ field: 'email', operator: 'eq', value: email }]);

export async function getAppointment(eventId) {
  const resp = await fetch(`${PUBLIC_BASE}/calendars/events/appointments/${encodeURIComponent(eventId)}`, {
    headers: { Authorization: 'Bearer ' + PIT(), Version: '2021-07-28', Accept: 'application/json' },
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json.appointment || json.event || null;
}

export async function getContactAppointments(contactId) {
  const resp = await fetch(`${PUBLIC_BASE}/contacts/${encodeURIComponent(contactId)}/appointments`, {
    headers: { Authorization: 'Bearer ' + PIT(), Version: '2021-07-28', Accept: 'application/json' },
  });
  if (!resp.ok) return [];
  const json = await resp.json();
  return json.events || json.appointments || [];
}

// Envía un email por la API de conversaciones (queda registrado con estado de entrega en GHL).
export async function sendTrackedEmail({ to, subject, html, fromName }) {
  let contact = await findContactByEmail(to);
  if (!contact) contact = await upsertContact({ email: to, tags: ['equipo-notificaciones'] });
  const resp = await fetch(`${PUBLIC_BASE}/conversations/messages`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + PIT(),
      Version: '2021-04-15',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'Email',
      contactId: contact.id,
      subject,
      html,
      ...(fromName ? { emailFrom: `${fromName} <${process.env.NOTIFY_EMAIL_FROM || 'no-reply@controlads.com.co'}>` } : {}),
    }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`Email ${resp.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

export async function updateContactPhone(contactId, phone) {
  const resp = await fetch(`${PUBLIC_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + PIT(),
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone }),
  });
  if (!resp.ok) throw new Error(`Contact update ${resp.status}`);
  return resp.json();
}

export function lidEmail(remoteJid = '') {
  const base = String(remoteJid).split('@')[0];
  return base ? `${base}@wa.invalid` : '';
}

export const WA_CUSTOM_FIELDS = {
  nick: { id: 'Q9eibeWdzLHZy5fyXUyT', key: 'contact.whatsapp_nick' },
  lid: { id: 'FxpuicULvRokRR05SdKH', key: 'contact.whatsapp_lid' },
  historial: { id: 'txwgOnePjNRuvTE0NPYg', key: 'contact.whatsapp_historial' },
  contextoIA: { id: 'h9iYCwBTvvaxSLvTqYBu', key: 'contact.whatsapp_contexto_ia' },
};

// Devuelve las citas próximas (próximos `days` días) de una lista de calendarios.
// Devuelve objetos normalizados: { calendarId, calendarName, title, startTime, contactName, email, phone, location, meetingLocation }.
export async function listUpcomingEvents({ calendarIds = [], days = 7, calendarNames = {} } = {}) {
  // La API de GHL espera startTime/endTime en MILISEGUNDOS (con ISO devuelve 0 eventos).
  const start = Date.now() - 60 * 60 * 1000;
  const end = Date.now() + days * 86400000;
  const out = [];
  for (const calId of calendarIds) {
    const url = `${PUBLIC_BASE}/calendars/events?locationId=${LID()}&calendarId=${calId}&startTime=${start}&endTime=${end}`;
    const resp = await fetch(url, {
      headers: { Authorization: 'Bearer ' + PIT(), Version: '2021-07-28' },
    });
    if (!resp.ok) continue;
    const json = await resp.json();
    for (const e of (json.events || [])) {
      const c = e.contact || {};
      out.push({
        calendarId: calId,
        calendarName: calendarNames[calId] || e.calendarName || '',
        title: e.title || '',
        startTime: e.startTime || '',
        endTime: e.endTime || '',
        contactName: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.fullName || '',
        email: c.email || '',
        phone: c.phone || '',
        location: e.location || '',
        meetingLocation: e.meetingLocation || e.meeting_location || '',
        status: e.appointmentStatus || '',
      });
    }
  }
  out.sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));
  return out;
}

export async function getContact(contactId) {
  const resp = await fetch(`${PUBLIC_BASE}/contacts/${contactId}`, {
    headers: {
      Authorization: 'Bearer ' + PIT(),
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
  });
  if (!resp.ok) throw new Error(`Contact get ${resp.status}`);
  const json = await resp.json();
  return json.contact || json;
}

// Agrega una línea al campo "WhatsApp Historial" (fallback cuando el contacto no tiene teléfono).
export async function appendContactHistory(contactId, entry) {
  const contact = await getContact(contactId);
  const cf = (contact.customFields || []).find((f) => f.id === WA_CUSTOM_FIELDS.historial.id);
  const prev = (cf && (cf.value || cf.field_value)) || '';
  const value = prev ? prev + '\n' + entry : entry;
  const resp = await fetch(`${PUBLIC_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + PIT(),
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customFields: [{ id: WA_CUSTOM_FIELDS.historial.id, value }] }),
  });
  if (!resp.ok) throw new Error(`Contact update ${resp.status}`);
  return resp.json();
}

// Establece el valor de un campo personalizado sin tocar los demás.
export async function setContactCustomField(contactId, fieldId, value) {
  const resp = await fetch(`${PUBLIC_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + PIT(),
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customFields: [{ id: fieldId, value }] }),
  });
  if (!resp.ok) throw new Error(`Contact update ${resp.status}`);
  return resp.json();
}

async function backendMessage({ contactId, text, direction }) {
  const token = await getBackendToken();
  const headers = {
    'token-id': token,
    channel: 'APP',
    source: 'WEB_USER',
    version: '2021-07-28',
    'content-type': 'application/json',
    accept: 'application/json',
  };
  const body = { type: 'WhatsApp', contactId, message: text };
  if (direction) body.direction = direction;
  const resp = await fetch(`${BACKEND_BASE}/conversations/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const respText = await resp.text();
  let json;
  try { json = JSON.parse(respText); } catch { json = respText; }
  if (!resp.ok) throw new Error(`Backend message ${resp.status}: ${respText.slice(0, 200)}`);
  return json;
}

export const createInboundMessage = ({ contactId, text }) =>
  backendMessage({ contactId, text, direction: 'inbound' });

export const createOutboundMessage = ({ contactId, text }) =>
  backendMessage({ contactId, text, direction: 'outbound' });
