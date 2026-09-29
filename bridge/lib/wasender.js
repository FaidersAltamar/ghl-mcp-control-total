// Helpers de WasenderApi (envío de mensajes + gestión completa de sesiones).
const WASENDER_BASE = 'https://www.wasenderapi.com';

const apiKey = () => process.env.WASENDER_API_KEY;
const pat = () => process.env.WASENDER_PAT;

const DEFAULT_WEBHOOK_EVENTS = [
  'messages.received',
  'messages.upsert',
  'message.sent',
  'messages.update',
  'session.status',
];

async function wasenderFetch(path, { method = 'GET', body, auth = 'pat', token } = {}) {
  const t = token || (auth === 'pat' ? pat() : apiKey());
  if (!t) throw new Error(`WASENDER_${auth === 'pat' ? 'PAT' : 'API_KEY'} no configurado`);
  const headers = {
    Authorization: 'Bearer ' + t,
    'Content-Type': 'application/json',
  };
  const resp = await fetch(`${WASENDER_BASE}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!resp.ok) {
    throw new Error(`Wasender ${method} ${path} ${resp.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

// --- Mensajería (Session API Key) ---
// `apiKeyOverride` permite enviar desde una sesión específica (su api_key),
// en lugar de la sesión por defecto (WASENDER_API_KEY).
export async function sendText(to, text, apiKeyOverride) {
  return wasenderFetch('/api/send-message', {
    method: 'POST',
    body: { to, text },
    auth: 'key',
    token: apiKeyOverride,
  });
}

export async function getUser() {
  return wasenderFetch('/api/user', { auth: 'key' });
}

// --- Gestión de sesiones (Personal Access Token) ---
export async function listSessions() {
  return wasenderFetch('/api/whatsapp-sessions', { auth: 'pat' });
}

export async function getSession(id) {
  return wasenderFetch(`/api/whatsapp-sessions/${id}`, { auth: 'pat' });
}

// Encuentra una sesión por su webhook_secret (para saber desde qué número llegó un mensaje).
export async function findSessionBySecret(secret) {
  if (!secret) return null;
  const result = await listSessions();
  const list = result.data || [];
  return list.find((s) => s.webhook_secret === secret) || null;
}

// Resuelve la api_key de una sesión a partir de su id o su teléfono (para enviar desde esa sesión).
export async function getSessionApiKey(idOrPhone) {
  const result = await listSessions();
  const list = result.data || [];
  const want = String(idOrPhone).replace(/^\+/, '');
  const s = list.find((x) =>
    String(x.id) === String(idOrPhone) ||
    String(x.phone_number).replace(/^\+/, '') === want
  );
  if (!s) throw new Error('Sesión no encontrada para: ' + idOrPhone);
  return { id: s.id, name: s.name, phone_number: s.phone_number, api_key: s.api_key, status: s.status };
}

// Devuelve la primera sesión CONECTADA de una lista de candidatos (id o teléfono), en orden.
// Útil para enviar avisos aunque el número principal se haya desconectado.
export async function pickConnectedSession(candidates = []) {
  const result = await listSessions();
  const list = result.data || [];
  const norm = (p) => String(p || '').replace(/\D/g, '');
  const tried = [];
  for (const c of candidates) {
    const s = list.find((x) => String(x.id) === String(c) || norm(x.phone_number) === norm(c));
    if (!s) continue;
    tried.push({ phone: s.phone_number, status: s.status });
    if (s.status === 'connected' && s.api_key) {
      return { id: s.id, name: s.name, phone_number: s.phone_number, api_key: s.api_key, status: s.status, tried };
    }
  }
  return { api_key: null, tried };
}

export async function createSession({ name, phone_number }) {
  const webhookUrl = process.env.WASENDER_WEBHOOK_URL || 'https://bridge-iota-opal.vercel.app/api/webhook';
  return wasenderFetch('/api/whatsapp-sessions', {
    method: 'POST',
    auth: 'pat',
    body: {
      name,
      phone_number,
      account_protection: true,
      log_messages: true,
      read_incoming_messages: false,
      webhook_url: webhookUrl,
      webhook_enabled: true,
      webhook_events: DEFAULT_WEBHOOK_EVENTS,
    },
  });
}

export async function connectSession(id, linkMethod = 'qr') {
  return wasenderFetch(`/api/whatsapp-sessions/${id}/connect`, {
    method: 'POST',
    auth: 'pat',
    body: { linkMethod },
  });
}

export async function getSessionQr(id) {
  return wasenderFetch(`/api/whatsapp-sessions/${id}/qrcode`, { auth: 'pat' });
}

export async function disconnectSession(id) {
  return wasenderFetch(`/api/whatsapp-sessions/${id}/disconnect`, {
    method: 'POST',
    auth: 'pat',
    body: {},
  });
}

export async function updateSession(id, fields) {
  return wasenderFetch(`/api/whatsapp-sessions/${id}`, {
    method: 'PUT',
    auth: 'pat',
    body: fields,
  });
}
