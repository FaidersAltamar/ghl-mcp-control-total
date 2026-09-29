#!/usr/bin/env node
/**
 * Espera a que se resetee el rate limit diario de GHL (429) y luego lanza el
 * sweeper de "limite" en modo watch para responder todos los pendientes y
 * seguir respondiendo.
 *
 * Uso: node scripts/workflows/recover-limite.mjs
 */
import { spawn } from 'child_process';
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const TOKEN = getPitToken();
const LID = getLocationId();
const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const VERSION = process.env.GHL_API_VERSION || '2021-07-28';
const h = {
  Authorization: `Bearer ${TOKEN}`,
  Version: VERSION,
  'Content-Type': 'application/json',
};

const PROBE_MS = Number(process.env.RECOVER_PROBE_MS || 5 * 60 * 1000);

async function probe() {
  try {
    const r = await fetch(
      `${BASE}/conversations/search?locationId=${LID}&limit=1&sortBy=last_message_date&sortOrder=desc`,
      { headers: h }
    );
    return r.status;
  } catch (e) {
    return 'ERR';
  }
}

console.log('[recover-limite] Esperando a que se resetee el rate limit diario de GHL...');
console.log(`[recover-limite] Probe cada ${PROBE_MS / 60000} min`);

let attempts = 0;
while (true) {
  attempts++;
  const status = await probe();
  if (status === 429) {
    const mins = (attempts * PROBE_MS) / 60000;
    console.log(
      `[recover-limite] 429 rate limit (intento ${attempts}, ~${Math.round(mins)} min esperando). Reintento en ${PROBE_MS / 60000} min...`
    );
    await new Promise((r) => setTimeout(r, PROBE_MS));
    continue;
  }

  console.log(
    `[recover-limite] Rate limit liberado (status ${status}). Lanzando sweeper en modo watch...`
  );
  const child = spawn(process.execPath, ['scripts/workflows/sweep-limite.mjs', '--watch'], {
    stdio: 'inherit',
  });
  child.on('exit', (code) => process.exit(code ?? 1));
  break;
}
