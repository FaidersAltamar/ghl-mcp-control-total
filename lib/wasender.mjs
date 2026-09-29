// Cliente ligero para WasenderApi (WhatsApp por QR, sin Meta/Business Manager).
// Requiere WASENDER_API_KEY en .env (la "API Access Key" de tu panel WasenderApi).
const WASENDER_BASE = 'https://www.wasenderapi.com';

export function getWasenderKey() {
  return process.env.WASENDER_API_KEY;
}

export async function wasenderFetch(path, init = {}) {
  const key = getWasenderKey();
  if (!key) throw new Error('WASENDER_API_KEY no está en .env');
  const headers = {
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  const res = await fetch(WASENDER_BASE + path, { ...init, headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

// Envía un mensaje de texto. `to` en formato E.164 (+57...)
export function sendText(to, text) {
  return wasenderFetch('/api/send-message', {
    method: 'POST',
    body: JSON.stringify({ to, text }),
  });
}

// Envía una imagen/documento por URL. `type` = 'image' | 'document' | 'video' | 'audio'.
export function sendMedia(to, { url, caption = '', type = 'image' }) {
  return wasenderFetch('/api/send-message', {
    method: 'POST',
    body: JSON.stringify({ to, [type]: { url, caption } }),
  });
}

// Estado de la sesión (connected / NEED_SCAN / ...)
export function getStatus() {
  return wasenderFetch('/api/status');
}

// Info del usuario de WhatsApp vinculado
export function getUser() {
  return wasenderFetch('/api/user');
}
