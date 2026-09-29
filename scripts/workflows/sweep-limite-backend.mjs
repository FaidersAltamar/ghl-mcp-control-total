#!/usr/bin/env node
/**
 * Barrido "limite" por el BACKEND de GHL (Firebase, token-id) — NO usa el PIT API,
 * por lo que NO está sujeto al rate limit diario de 200k del PIT.
 *
 * Uso:
 *   node scripts/workflows/sweep-limite-backend.mjs              # una pasada
 *   node scripts/workflows/sweep-limite-backend.mjs --watch      # continuo
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { getIdToken, BACKEND } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, '../../.tmp');
const STATE_FILE = join(STATE_DIR, 'limite-backend-state.json');

const LID = getLocationId();
const LINK = 'https://www.skool.com/rush/aumenta-tu-limite-diario-con-meta-ai-sin-complicaciones';

const WATCH = process.argv.includes('--watch');
const INTERVAL_MS = Number(process.env.LIMITE_SWEEP_INTERVAL_MS || 60000);

const DM_TEXT = `🔥 Aquí tienes el post que te prometí.

Te muestro cómo funciona el proceso para aumentar el límite diario de Meta y qué debes hacer para solicitarlo correctamente.

👇 Léelo completo aquí:
VER EL POST →

${LINK}`;

async function bfetch(path, init = {}) {
  const token = await getIdToken();
  const headers = {
    'token-id': token,
    channel: 'APP',
    source: 'WEB_USER',
    version: '2021-07-28',
    accept: 'application/json',
    ...(init.headers || {}),
  };
  if (init.body && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(`${BACKEND}${path}`, { ...init, headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

function loadState() {
  try {
    if (!existsSync(STATE_FILE)) return { sentKeys: {} };
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { sentKeys: {} };
  }
}

function saveState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  const keys = Object.keys(state.sentKeys || {});
  if (keys.length > 2000) {
    const sorted = keys.sort();
    const keep = sorted.slice(sorted.length - 2000);
    state.sentKeys = Object.fromEntries(keep.map((k) => [k, state.sentKeys[k]]));
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function matchesKeyword(text = '') {
  const n = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /\blimi+te+\b/.test(n) || n.includes('limite');
}

async function sweepOnce(state) {
  const search = await bfetch(
    `/conversations/search?locationId=${LID}&limit=50&sortBy=last_message_date&sortOrder=desc`
  );
  if (!search.ok) {
    throw new Error(`search ${search.status}: ${JSON.stringify(search.body).slice(0, 200)}`);
  }

  const convos = search.body.conversations || [];
  let pending = 0;
  let sent = 0;
  let skipped = 0;
  const details = [];

  for (const c of convos) {
    // Only Instagram conversations whose last message matches the keyword
    const lastBody = c.lastMessageBody || c.lastMessage?.body || '';
    if (!lastBody || !matchesKeyword(lastBody)) continue;

    const msgsRes = await bfetch(`/conversations/${c.id}/messages?limit=20`);
    if (!msgsRes.ok) {
      details.push({ name: c.fullName || c.contactName, kw: lastBody, status: msgsRes.status });
      continue;
    }
    const msgs = msgsRes.body.messages?.messages || msgsRes.body.messages || [];
    const lastKw = msgs.find((m) => m.direction === 'inbound' && matchesKeyword(m.body || ''));
    if (!lastKw) continue;

    const key = `${c.contactId}:${lastKw.id || lastKw.dateAdded}:${(lastKw.body || '').slice(0, 40)}`;
    const alreadyOutbound = msgs.some(
      (m) =>
        m.direction === 'outbound' &&
        (m.body || '').includes('Aquí tienes el post') &&
        new Date(m.dateAdded) >= new Date(lastKw.dateAdded)
    );

    if (alreadyOutbound || state.sentKeys[key]) {
      skipped++;
      continue;
    }

    pending++;
    const name = c.fullName || c.contactName || c.contactId;
    const send = await bfetch('/conversations/messages', {
      method: 'POST',
      body: JSON.stringify({ type: 'IG', contactId: c.contactId, message: DM_TEXT }),
    });

    details.push({ name, kw: lastKw.body, status: send.status });
    if (send.ok) {
      sent++;
      state.sentKeys[key] = new Date().toISOString();
    } else {
      details[details.length - 1].error = JSON.stringify(send.body).slice(0, 120);
    }
  }

  saveState(state);
  return { pending, sent, skipped, details };
}

const state = loadState();
const started = Date.now();
let pass = 0;

console.log(
  `[limite-backend] mode=${WATCH ? 'watch' : 'once'} interval=${INTERVAL_MS}ms`
);

do {
  pass++;
  const stamp = new Date().toISOString();
  try {
    const r = await sweepOnce(state);
    console.log(
      `[${stamp}] #${pass} pending=${r.pending} sent=${r.sent} skipped=${r.skipped}`,
      r.details.length ? JSON.stringify(r.details) : ''
    );
  } catch (e) {
    console.log(`[${stamp}] #${pass} ERROR`, e.message);
  }

  if (!WATCH) break;
  await new Promise((r) => setTimeout(r, INTERVAL_MS));
} while (true);
