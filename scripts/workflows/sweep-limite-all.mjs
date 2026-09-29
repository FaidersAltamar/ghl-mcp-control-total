#!/usr/bin/env node
// Página hacia atrás en el tiempo para encontrar TODOS los chats IG "limite" sin responder.
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { getIdToken, BACKEND } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });
const LID = getLocationId();
const SEND = process.argv.includes('--send');

const LINK = 'https://www.skool.com/rush/aumenta-tu-limite-diario-con-meta-ai-sin-complicaciones';
const DM_TEXT = `🔥 Aquí tienes el post que te prometí.\n\nTe muestro cómo funciona el proceso para aumentar el límite diario de Meta y qué debes hacer para solicitarlo correctamente.\n\n👇 Léelo completo aquí:\nVER EL POST →\n\n${LINK}`;

const token = await getIdToken();
const hd = { 'token-id': token, channel: 'APP', source: 'WEB_USER', version: '2021-07-28', accept: 'application/json' };

async function b(path, method = 'GET', body) {
  const headers = { ...hd };
  if (body) headers['content-type'] = 'application/json';
  const r = await fetch(BACKEND + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}

function matchesKeyword(text = '') {
  const n = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return /\blimi+te+\b/.test(n) || n.includes('limite');
}

// 1) primera página (más recientes)
let cursor = null; // fecha del último resultado
const allConvos = new Map();
const MAX_PAGES = 6;
for (let page = 0; page < MAX_PAGES; page++) {
  const extra = cursor ? `&startBeforeDate=${cursor}` : '';
  const r = await b(`/conversations/search?locationId=${LID}&limit=100&query=limite&sortBy=last_message_date&sortOrder=desc${extra}`);
  const cs = r.body?.conversations || [];
  console.log(`página ${page + 1}: ${cs.length} resultados (total=${r.body?.total})${cursor ? ' cursor=' + cursor : ''}`);
  if (!cs.length) break;
  for (const c of cs) {
    if (!allConvos.has(c.id)) allConvos.set(c.id, c);
  }
  const last = cs[cs.length - 1];
  const newCursor = last?.lastMessageDate;
  if (!newCursor || newCursor === cursor) break;
  cursor = newCursor;
}
const convos = [...allConvos.values()];
console.log(`\nConversaciones "limite" únicas: ${convos.length}`);

const igConvos = convos.filter((c) => (c.lastMessageType || '').toUpperCase().includes('INSTAGRAM'));
console.log(`De Instagram: ${igConvos.length}`);

const pending = [];
let answered = 0;
let noKeyword = 0;
for (const c of igConvos) {
  const msgsRes = await b(`/conversations/${c.id}/messages?limit=40`);
  const msgs = msgsRes.body?.messages?.messages || msgsRes.body?.messages || [];
  const inboundKw = msgs.filter((m) => m.direction === 'inbound' && matchesKeyword(m.body || ''));
  if (!inboundKw.length) { noKeyword++; continue; }
  const lastKw = inboundKw[inboundKw.length - 1];
  const hasOutboundAfter = msgs.some((m) => m.direction === 'outbound' && new Date(m.dateAdded) >= new Date(lastKw.dateAdded));
  if (hasOutboundAfter) { answered++; continue; }
  pending.push({ contactId: c.contactId, name: c.fullName || c.contactName || c.contactId, text: (lastKw.body || '').slice(0, 60), date: lastKw.dateAdded });
}

console.log(`\n=== RESULTADO ===`);
console.log(`Con keyword y respondidos: ${answered}`);
console.log(`Sin keyword: ${noKeyword}`);
console.log(`PENDIENTES: ${pending.length}`);
for (const p of pending) console.log(`  - ${p.name} "${p.text}" @ ${p.date}`);

if (SEND && pending.length) {
  let sent = 0;
  for (const p of pending) {
    const send = await b('/conversations/messages', 'POST', { type: 'IG', contactId: p.contactId, message: DM_TEXT });
    if (send.status === 200 || send.status === 201) { sent++; console.log(`  ✅ ${p.name}`); }
    else console.log(`  ❌ ${p.name} -> ${send.status}`);
  }
  console.log(`\nEnviados: ${sent}/${pending.length}`);
}
