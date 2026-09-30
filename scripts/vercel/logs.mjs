#!/usr/bin/env node
/**
 * Muestra los logs de runtime recientes del despliegue de producción del bridge.
 * Uso: node scripts/vercel/logs.mjs [filtro]
 */
import { loadEnv } from '../../lib/env.mjs';

loadEnv({ required: true });

const h = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
const PID = process.env.VERCEL_PROJECT_ID;
const filter = process.argv[2] || '';

const d = (await (await fetch(`https://api.vercel.com/v6/deployments?projectId=${PID}&target=production&limit=1`, { headers: h })).json()).deployments[0];
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 8000);
let buf = '';
try {
  const r = await fetch(`https://api.vercel.com/v1/projects/${PID}/deployments/${d.uid}/runtime-logs`, { headers: h, signal: ctrl.signal });
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value);
  }
} catch {
  // el stream queda abierto; se imprime lo recibido
}
print(buf);

function print(text) {
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      const msg = `${new Date(j.timestampInMs).toISOString().slice(11, 19)} ${j.requestPath || ''} ${j.message || ''}`;
      if (!filter || msg.includes(filter)) console.log(msg.slice(0, 400));
    } catch { /* ignorar */ }
  }
}
