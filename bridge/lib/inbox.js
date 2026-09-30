// Reenvía los eventos de WhatsApp a la bandeja de chats del sitio (Lovable).
// INBOX_INGEST_URL + INBOX_SECRET: si falta alguno, no hace nada.
import { decryptMedia } from './wasender.js';

const MEDIA_TYPES = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
};
const STATUS = { 0: 'failed', 1: 'pending', 2: 'sent', 3: 'delivered', 4: 'read', 5: 'played' };

const digits = (s) => String(s || '').split('@')[0].split(':')[0].replace(/\D/g, '');

// WhatsApp envuelve algunos mensajes (temporales, ver una vez, documento con texto).
function unwrap(message) {
  let m = message || {};
  for (let i = 0; i < 4; i++) {
    const inner = m.ephemeralMessage || m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension || m.documentWithCaptionMessage;
    if (!inner?.message) break;
    m = inner.message;
  }
  return m;
}

function toList(data) {
  if (!data) return [];
  const m = data.messages ?? (data.key ? data : null);
  if (!m) return [];
  return Array.isArray(m) ? m : [m];
}

function isIgnoredJid(jid) {
  return /@g\.us$|@broadcast$|@newsletter$|^status@/.test(jid || '');
}

async function normalizeMessage(msg, session, isBotSend) {
  const key = msg.key || {};
  const jid = String(key.remoteJid || '');
  if (!key.id || isIgnoredJid(jid)) return null;
  const fromMe = key.fromMe === true;
  const alt = String(key.remoteJidAlt || '');
  let lid = '';
  let phone = '';
  if (jid.endsWith('@lid')) {
    lid = jid;
    if (!fromMe) phone = digits(key.cleanedSenderPn || key.senderPn);
    if (!phone && alt && !alt.endsWith('@lid')) phone = digits(alt);
  } else {
    phone = digits(jid);
    if (alt.endsWith('@lid')) lid = alt;
    else if (!fromMe && String(key.senderLid || '').endsWith('@lid')) lid = key.senderLid;
  }
  if (!phone && !lid) return null;

  const m = unwrap(msg.message);
  let type = 'text';
  let text = msg.messageBody || m.conversation || m.extendedTextMessage?.text || '';
  const out = {};

  const mediaKey = Object.keys(MEDIA_TYPES).find((k) => m[k]);
  if (mediaKey) {
    const media = m[mediaKey];
    type = MEDIA_TYPES[mediaKey];
    if (type === 'audio' && media.ptt) type = 'voice';
    text = media.caption || text || '';
    out.mime = media.mimetype || null;
    out.file_name = media.fileName || null;
    out.duration = media.seconds || null;
    try {
      out.media_url = await decryptMedia(key.id, mediaKey, media, session?.api_key);
    } catch (e) {
      out.media_error = e.message.slice(0, 200);
    }
  } else if (m.locationMessage || m.liveLocationMessage) {
    const l = m.locationMessage || m.liveLocationMessage;
    type = 'location';
    out.lat = l.degreesLatitude;
    out.lng = l.degreesLongitude;
    text = [l.name, l.address].filter(Boolean).join(' — ') || text;
  } else if (m.contactMessage || m.contactsArrayMessage) {
    type = 'contact';
    const c = m.contactMessage || m.contactsArrayMessage?.contacts?.[0] || {};
    text = c.displayName || text;
    out.vcard = c.vcard || null;
  } else if (m.reactionMessage) {
    return {
      kind: 'reaction',
      session_phone: digits(session?.phone_number),
      target_wa_id: m.reactionMessage.key?.id,
      emoji: m.reactionMessage.text || '',
      direction: fromMe ? 'out' : 'in',
    };
  } else if (m.protocolMessage) {
    if (m.protocolMessage.type === 0 || m.protocolMessage.type === 'REVOKE') {
      return { kind: 'delete', session_phone: digits(session?.phone_number), wa_id: m.protocolMessage.key?.id };
    }
    return null;
  } else if (!text) {
    type = 'unsupported';
    text = Object.keys(m).filter((k) => k !== 'messageContextInfo').join(', ');
  }

  const quoted = m.extendedTextMessage?.contextInfo?.stanzaId || m[mediaKey]?.contextInfo?.stanzaId || null;
  const ts = Number(msg.messageTimestamp || 0);

  return {
    kind: 'message',
    session_phone: digits(session?.phone_number),
    session_name: session?.name || null,
    wa_id: key.id,
    direction: fromMe ? 'out' : 'in',
    sent_by: fromMe ? (isBotSend ? 'bot' : 'phone') : null,
    chat_phone: phone || null,
    chat_lid: lid || null,
    push_name: fromMe ? null : (msg.pushName || null),
    type,
    text: text || null,
    quoted_wa_id: quoted,
    ts: ts ? (ts < 1e12 ? ts * 1000 : ts) : Date.now(),
    ...out,
  };
}

// Convierte un payload de webhook en eventos para la bandeja.
export async function buildInboxEvents(payload, session, { isBotSend } = {}) {
  const event = payload?.event || '';
  const data = payload?.data;
  const events = [];

  if (event === 'messages.update') {
    for (const u of Array.isArray(data) ? data : [data]) {
      const st = STATUS[u?.update?.status];
      if (u?.key?.id && st) events.push({ kind: 'status', session_phone: digits(session?.phone_number), wa_id: u.key.id, status: st });
    }
    return events;
  }
  if (event === 'messages.delete') {
    for (const k of data?.keys || []) events.push({ kind: 'delete', session_phone: digits(session?.phone_number), wa_id: k.id });
    return events;
  }
  if (!/^messages\.(received|upsert)$|^message\.sent$|^messages-personal\.received$/.test(event)) return events;
  if (event === 'message.sent' && data?.success === false) return events;

  for (const msg of toList(data)) {
    const text = msg.messageBody || msg.message?.conversation || '';
    const ev = await normalizeMessage(msg, session, msg.key?.fromMe && isBotSend?.(text));
    if (ev) events.push(ev);
  }
  return events;
}

export async function forwardToInbox(events) {
  const url = process.env.INBOX_INGEST_URL;
  const secret = process.env.INBOX_SECRET;
  if (!url || !secret || !events.length) return { skipped: true };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-inbox-secret': secret },
      body: JSON.stringify({ events }),
      signal: ctrl.signal,
    });
    return { status: r.status };
  } catch (e) {
    console.error('inbox forward error:', e.message);
    return { error: e.message };
  } finally {
    clearTimeout(t);
  }
}
