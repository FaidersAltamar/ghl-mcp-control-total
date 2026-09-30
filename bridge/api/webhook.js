// Webhook de WasenderApi -> GHL.
// Captura historial completo: mensajes entrantes Y salientes, matcheando por teléfono o por LID.
import {
  normalizePhone,
  lidEmail,
  findContactByPhone,
  findContactByEmail,
  upsertContact,
  updateContactPhone,
  createInboundMessage,
  createOutboundMessage,
  appendContactHistory,
  setContactCustomField,
  listUpcomingEvents,
  WA_CUSTOM_FIELDS,
} from '../lib/ghl.js';
import { aiChatMessages, buildSystemPrompt, summarizeConversation } from '../lib/ai.js';
import { getKnowledge } from '../lib/knowledge.js';
import { sendText, findSessionBySecret } from '../lib/wasender.js';
import { buildInboxEvents, forwardToInbox } from '../lib/inbox.js';

// Calendarios que el bot puede consultar para responder "qué reuniones hay pendientes".
const AGENDA_CALS = [
  { id: 'bJT5h32OkoOdSfV2zd4O', name: 'Meta Ads' },
  { id: 'o6c2SOIoEkjEfKtBPUNN', name: 'TikTok Ads' },
  { id: 'JGiNpYTCf6w3BwpAdChw', name: 'Contingencias Facebook' },
  { id: '2vVaqq8c1uZ2xSpXW6Cr', name: 'Contingencias TikTok' },
];

function fmtAgendaWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
  } catch { return iso; }
}

// Convierte la lista de citas reales en un bloque de texto para el prompt.
function formatAgenda(events) {
  const head = '## AGENDA REAL (próximos 7 días)\n';
  if (!events.length) return head + 'No hay reuniones agendadas en los próximos 7 días.';
  const lines = events.map((e, i) => {
    const partes = [
      `${i + 1}) [${e.calendarName || 'Cita'}] ${e.title || 'Reunión'}`,
      `   📅 ${fmtAgendaWhen(e.startTime)}`,
      e.contactName ? `   👤 ${e.contactName}` : '',
      e.email ? `   📧 ${e.email}` : '',
      e.phone ? `   📱 ${e.phone}` : '',
      e.meetingLocation ? `   🔗 ${e.meetingLocation}` : (e.location ? `   📍 ${e.location}` : ''),
    ];
    return partes.filter(Boolean).join('\n');
  });
  return head + lines.join('\n');
}

// --- Detección de eco del bot (mensaje.sent que dispara WASenderApi al enviar nosotros) ---
// Se guarda en memoria del proceso (no en GHL) para evitar la race condition al leer/escribir
// el campo customField concurrentemente. Clave: teléfono normalizado. Valor: { text, ts }.
const botSends = new Map();

function recordBotSend(phone, text) {
  if (!phone || !text) return;
  botSends.set(phone, { text, ts: Date.now() });
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [k, v] of botSends) if (v.ts < cutoff) botSends.delete(k);
}

function isRecentBotText(text) {
  const t = (text || '').trim();
  if (!t) return false;
  for (const v of botSends.values()) if (v.text === t && Date.now() - v.ts < 90 * 1000) return true;
  return false;
}

// ¿El mensaje saliente es el eco de lo que acabamos de enviar nosotros?
function isBotEcho(phone, text, memory) {
  const textLow = (text || '').trim();
  const rec = botSends.get(phone);
  if (rec && rec.text === textLow && (Date.now() - rec.ts) < 90 * 1000) return true;
  // Fallback (cold start / otra instancia): coincide con el último texto que marcó el bot.
  const lastBotText = (memory?.handover?.lastBotText || '').trim();
  if (lastBotText && textLow === lastBotText) return true;
  return false;
}

// --- Memoria (contexto IA) del contacto ---
function parseMemory(contact) {
  const ctxField = (contact?.customFields || []).find((f) => f.id === WA_CUSTOM_FIELDS.contextoIA.id);
  if (ctxField && (ctxField.value || ctxField.field_value)) {
    try {
      const parsed = JSON.parse(ctxField.value || ctxField.field_value);
      if (Array.isArray(parsed)) return { resumen: '', reciente: parsed, handover: {} };
      return {
        resumen: parsed.resumen || '',
        reciente: parsed.reciente || [],
        handover: parsed.handover || {},
      };
    } catch (e) { /* formato inválido */ }
  }
  return { resumen: '', reciente: [], handover: {} };
}

async function saveMemory(contactId, memory) {
  try {
    await setContactCustomField(contactId, WA_CUSTOM_FIELDS.contextoIA.id, JSON.stringify(memory));
  } catch (e) { console.error('ctx save error:', e.message); }
}

// Avisa a Faiders (dueño) por WhatsApp cuando un lead está esperando respuesta.
async function notifyOwner({ phone, name, text, sessionApiKey }) {
  const ownerPhone = normalizePhone(process.env.NOTIFY_OWNER_PHONE || '+573165559823');
  if (!ownerPhone) return;
  if (phone && phone === ownerPhone) return; // no auto-avisarse
  const msg = [
    '🔔 *Lead esperando respuesta*',
    name ? `👤 ${name}` : '',
    phone ? `📱 ${phone}` : '',
    text ? `💬 ${text.slice(0, 140)}` : '',
  ].filter(Boolean).join('\n');
  try {
    await sendText(ownerPhone, msg, sessionApiKey);
  } catch (e) { console.error('notify owner error:', e.message); }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = (req.headers['x-webhook-signature'] || '').toString();
  const secrets = (process.env.WASENDER_WEBHOOK_SECRET || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (secrets.length) {
    if (!sig || !secrets.includes(sig)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const payload = req.body;
  const event = payload?.event;

  // Bandeja de chats del sitio: recibe todo (multimedia, estados, reacciones), no solo texto.
  let inbox = null;
  try {
    const session = await findSessionBySecret(sig);
    const events = await buildInboxEvents(payload, session, { isBotSend: isRecentBotText });
    inbox = await forwardToInbox(events);
  } catch (e) {
    console.error('inbox error:', e.message);
  }

  const msg = payload?.data?.messages;
  if (!msg) return res.status(200).json({ received: true, skipped: 'no-message', inbox });

  const fromMe = msg.key?.fromMe === true;
  const isInbound = event === 'messages.received';
  const isOutbound = event === 'message.sent' || fromMe;

  // Solo mensajes de chat (no status/upsert duplicados)
  if (!isInbound && !isOutbound) {
    return res.status(200).json({ received: true, skipped: event });
  }

  const text = msg.messageBody || msg.message?.conversation || '';
  if (!text) return res.status(200).json({ received: true, skipped: 'no-text' });

  try {
    const remoteJid = msg.key?.remoteJid || '';
    const senderPn = msg.key?.cleanedSenderPn || msg.key?.cleanedParticipantPn || '';
    let phone = normalizePhone(senderPn);

    // Si remoteJid es un teléfono (no @lid) y no hay cleanedSenderPn, extraer de ahí
    if (!phone && !remoteJid.endsWith('@lid')) {
      phone = normalizePhone(remoteJid.split('@')[0]);
    }
    const lid = remoteJid.endsWith('@lid') ? remoteJid : '';

    // 1) Buscar contacto existente por teléfono o por LID (email sintético)
    let contact = null;
    if (phone) contact = await findContactByPhone(phone);
    if (!contact && lid) contact = await findContactByEmail(lidEmail(lid));

    let contactId;
    let hasPhone = !!phone;
    if (contact) {
      contactId = contact.id;
      hasPhone = !!(contact.phone || phone);
      // Backfill: el contacto era lid-only (sin phone) y ahora tenemos su teléfono real
      if (phone && !contact.phone) {
        try { await updateContactPhone(contactId, phone); } catch (e) { /* no fatal */ }
      }
    } else {
      const created = await upsertContact({
        phone: phone || undefined,
        email: lid ? lidEmail(lid) : undefined,
        customFields: lid ? [{ ...WA_CUSTOM_FIELDS.lid, field_value: lid }] : [],
        tags: ['whatsapp'],
      });
      contactId = created.id;
      hasPhone = !!phone;
    }

    // --- Handover: detección de toma de control por un humano (Faiders) ---
    let memory = parseMemory(contact);
    if (isOutbound && hasPhone) {
      const handover = memory.handover || {};
      const now = Date.now();
      const textLow = (text || '').trim();
      if (/^bot\s*:/i.test(textLow)) {
        // Comando para devolverle el control al bot
        memory.handover = { human: false, lastHumanTs: null, lastBotText: '', lastBotTs: null, lastNotifyTs: handover.lastNotifyTs || null };
        await saveMemory(contactId, memory);
      } else if (!isBotEcho(phone, text, memory)) {
        // Mensaje saliente que NO es eco del bot => el humano tomó el control.
        memory.handover = { ...handover, human: true, lastHumanTs: now };
        await saveMemory(contactId, memory);
      }
    }

    // 2) Registrar el mensaje
    let result;
    if (hasPhone) {
      // Historial completo en la conversación nativa de GHL
      result = isOutbound
        ? await createOutboundMessage({ contactId, text })
        : await createInboundMessage({ contactId, text });
    } else {
      // Sin teléfono: guardar en el campo "WhatsApp Historial" (fallback)
      const ts = new Date().toISOString();
      const entry = `[${ts}] ${isOutbound ? 'Saliente' : 'Entrante'}: ${text}`;
      result = await appendContactHistory(contactId, entry);
    }

    // 3) Chatbot IA (solo mensajes entrantes, si está habilitado y la sesión está permitida)
    let botReply = null;
    if (isInbound && phone && process.env.WA_BOT_ENABLED === 'true') {
      try {
        const session = await findSessionBySecret(sig);
        const sessionPhone = normalizePhone(session?.phone_number || '');
        const allowed = (process.env.WA_BOT_PHONES || '')
          .split(',')
          .map((p) => normalizePhone(p))
          .filter(Boolean);
        // Si hay lista blanca (WA_BOT_PHONES), el bot solo responde en esas sesiones.
        const botAllowed = !allowed.length || allowed.includes(sessionPhone);
        if (session && session.api_key && botAllowed) {
          const MAX_RECENT = parseInt(process.env.WA_BOT_MEMORY_TURNS || '10', 10) * 2; // N turnos = 2N mensajes

          const nombre = (contact && (contact.firstName || contact.lastName)) ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') : '';

          // Staff/owner: estos números SIEMPRE reciben respuesta (no se les aplica mute de handover).
          const staffPhones = [
            ...(process.env.AGENDA_AUTHORIZED_PHONES || '').split(','),
            ...(process.env.NOTIFY_OWNER_PHONE || '+573165559823').split(','),
          ].map((p) => normalizePhone(p)).filter(Boolean);
          const isStaff = staffPhones.includes(phone);

          // Handover: si el humano tomó el control, el bot NO responde (mute 24h o espera instrucciones).
          const handover = memory.handover || {};
          const nowTs = Date.now();
          if (handover.human && handover.lastHumanTs && !isStaff) {
            const hoursSince = (nowTs - handover.lastHumanTs) / 3600000;
            if (hoursSince < 24) {
              return res.status(200).json({ received: true, direction: 'inbound', contactId, phone, botReplied: false, muted: 'human-active' });
            }
            // Humano lleva +24h sin responder: avisar a Faiders y esperar instrucciones.
            const lastNotify = handover.lastNotifyTs || 0;
            if (nowTs - lastNotify > 6 * 3600000) {
              await notifyOwner({ phone, name: nombre, text, sessionApiKey: session.api_key });
              handover.lastNotifyTs = nowTs;
              memory.handover = handover;
              await saveMemory(contactId, memory);
            }
            return res.status(200).json({ received: true, direction: 'inbound', contactId, phone, botReplied: false, muted: 'waiting-instructions' });
          }

          // Conocimiento dinámico (Supabase) con fallback al estático
          const knowledge = await getKnowledge();

          // AGENDA: si el remitente está autorizado y pregunta por agenda/reuniones/citas,
          // inyectar las citas reales de GHL para que responda con datos concretos.
          const authorizedAgenda = (process.env.AGENDA_AUTHORIZED_PHONES || '')
            .split(',')
            .map((p) => normalizePhone(p))
            .filter(Boolean);
          const asksAgenda = /agenda|reunio|cita|calendario|pendiente|meeting|llamada.*(semana|hoy|pr.ximo)|pr.ximo.*(llamada|reunio)/i.test(text);
          let agendaContext = '';
          if (asksAgenda && authorizedAgenda.includes(phone)) {
            try {
              const events = await listUpcomingEvents({
                calendarIds: AGENDA_CALS.map((c) => c.id),
                days: 7,
                calendarNames: Object.fromEntries(AGENDA_CALS.map((c) => [c.id, c.name])),
              });
              agendaContext = formatAgenda(events);
            } catch (e) { /* no fatal: el bot responde sin agenda */ }
          }

          const systemContent = buildSystemPrompt(nombre, memory.resumen, knowledge) + (agendaContext ? '\n\n' + agendaContext : '');

          const history = [
            { role: 'system', content: systemContent },
            ...memory.reciente.slice(-MAX_RECENT),
            { role: 'user', content: text },
          ];

          const reply = await aiChatMessages(history);
          if (reply) {
            // Marcar el último mensaje del bot ANTES de enviar (evita confundirlo con un mensaje humano).
            memory.handover = { ...(memory.handover || {}), human: false, lastBotText: reply, lastBotTs: Date.now() };
            await saveMemory(contactId, memory);

            // Registrar en memoria del proceso para detectar el eco sin depender de GHL.
            recordBotSend(phone, reply);

            await sendText(phone, reply, session.api_key);
            botReply = reply;

            // Si el bot ofrece pasar a un asesor, avisar a Faiders (1 vez/día por contacto).
            const hd = memory.handover || {};
            if (/\basesor\b/i.test(reply) && (Date.now() - (hd.lastLeadNotifyTs || 0) > 24 * 3600000)) {
              hd.lastLeadNotifyTs = Date.now();
              memory.handover = hd;
              await notifyOwner({ phone, name: nombre, text, sessionApiKey: session.api_key });
            }

            // Actualizar memoria: añadir turno + resumir lo que se salga de la ventana
            memory.reciente.push({ role: 'user', content: text });
            memory.reciente.push({ role: 'assistant', content: reply });
            if (memory.reciente.length > MAX_RECENT) {
              const overflow = memory.reciente.splice(0, memory.reciente.length - MAX_RECENT);
              try {
                memory.resumen = await summarizeConversation({ previousSummary: memory.resumen, turns: overflow });
              } catch (e2) {
                // Si falla el resumen, conservar lo anterior (no perder nada)
                memory.reciente.unshift(...overflow);
              }
            }
            try {
              await setContactCustomField(contactId, WA_CUSTOM_FIELDS.contextoIA.id, JSON.stringify(memory));
            } catch (e3) { console.error('ctx save error:', e3.message); }
          }
        }
      } catch (e) {
        console.error('bot error:', e.message);
      }
    }

    return res.status(200).json({
      received: true,
      direction: isOutbound ? 'outbound' : 'inbound',
      contactId,
      phone,
      lid,
      storedIn: hasPhone ? 'conversation' : 'historial',
      botReplied: !!botReply,
      result,
    });
  } catch (e) {
    console.error('webhook error:', e.message);
    return res.status(500).json({ received: false, error: e.message });
  }
}
