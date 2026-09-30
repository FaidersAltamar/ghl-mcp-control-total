#!/usr/bin/env node
/**
 * Ejecuta la sincronización SorryMark -> GHL (Edge Function ghl-sync).
 * Uso: node scripts/sorrymark/run-sync.mjs [limit=80] [--all]
 *   --all repite hasta que no queden pendientes (carga inicial).
 */
import { loadEnv } from '../../lib/env.mjs';

loadEnv({ required: true });
const limit = Number(process.argv[2]) || 80;
const all = process.argv.includes('--all');

for (let i = 1; ; i++) {
  const r = await fetch('https://mpojxlotpsmblaibxaem.supabase.co/functions/v1/ghl-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sync-secret': process.env.SORRYMARK_SYNC_SECRET },
    body: JSON.stringify({ limit }),
  });
  const j = await r.json().catch(async () => ({ raw: (await r.text()).slice(0, 300) }));
  console.log(`#${i}`, r.status, JSON.stringify(j));
  if (!all || !j.ok || !j.processed || (j.remaining ?? 0) === 0) break;
}
