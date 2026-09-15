#!/usr/bin/env node
/**
 * Auto-reply Instagram story/DM keyword "gluglu" (variaciones).
 * El workflow GHL falla de forma intermitente en respuestas a historia;
 * este sweeper cubre los huecos por API directa.
 *
 * Uso:
 *   node scripts/workflows/sweep-gluglu.mjs              # una pasada
 *   node scripts/workflows/sweep-gluglu.mjs --watch      # continuo (sin límite)
 *   node scripts/workflows/sweep-gluglu.mjs --watch --minutes=120
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = join(__dirname, '../../.tmp');
const STATE_FILE = join(STATE_DIR, 'gluglu-sweep-state.json');

const TOKEN = getPitToken();
const LID = getLocationId();
const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const VERSION = process.env.GHL_API_VERSION || '2021-07-28';
const LINK = 'https://scalbook.com/u/mjt287';

const WATCH = process.argv.includes('--watch');
const minutesArg = process.argv.find((a) => a.startsWith('--minutes='));
const WATCH_MS = minutesArg
  ? Math.max(1, Number(minutesArg.split('=')[1]) || 0) * 60 * 1000
  : 0; // 0 = forever
const INTERVAL_MS = Number(process.env.GLUGLU_SWEEP_INTERVAL_MS || 15000);

const DM_TEXT = `🔥 Miren esta oferta

Aunque el caso es de gambling y no de e-commerce, vale muchísimo la pena analizarlo.

Desde el otro lado del mundo están creando ofertas cada vez más completas y creativas para conseguir resultados enormes.

👉 Nosotros en e-commerce tenemos que empezar a pensar igual: no se trata solamente de encontrar un producto, sino de construir una oferta irresistible alrededor de él.

Les dejo el caso para que lo lean y saquemos ideas:

LEER EL CASO COMPLETO → ${LINK}`;

const h = {
  Authorization: `Bearer ${TOKEN}`,
  Version: VERSION,
  'Content-Type': 'application/json',
};

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
  // keep last 2000 keys
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
  return /\bglu\s*glu+\b/.test(n) || n.includes('gluglu');
}

async function pit(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...h, ...(init.headers || {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

async function sweepOnce(state) {
  const search = await pit(
    `/conversations/search?locationId=${LID}&limit=100&sortBy=last_message_date&sortOrder=desc`
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
    const msgsRes = await pit(`/conversations/${c.id}/messages?limit=20`);
    const msgs = msgsRes.body.messages?.messages || msgsRes.body.messages || [];
    const lastKw = msgs.find((m) => m.direction === 'inbound' && matchesKeyword(m.body || ''));
    if (!lastKw) continue;

    const key = `${c.contactId}:${lastKw.id || lastKw.dateAdded}:${(lastKw.body || '').slice(0, 40)}`;
    const alreadyOutbound = msgs.some(
      (m) =>
        m.direction === 'outbound' &&
        (m.body || '').includes('Miren esta oferta') &&
        new Date(m.dateAdded) >= new Date(lastKw.dateAdded)
    );

    if (alreadyOutbound || state.sentKeys[key]) {
      skipped++;
      continue;
    }

    pending++;
    const name = c.fullName || c.contactName || c.contactId;
    const send = await pit('/conversations/messages', {
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
  `[gluglu-sweep] mode=${WATCH ? 'watch' : 'once'} interval=${INTERVAL_MS}ms limit=${
    WATCH_MS ? WATCH_MS / 60000 + 'min' : 'forever'
  }`
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
  if (WATCH_MS && Date.now() - started >= WATCH_MS) {
    console.log('[gluglu-sweep] time limit reached — stopping');
    break;
  }
  await new Promise((r) => setTimeout(r, INTERVAL_MS));
} while (true);
