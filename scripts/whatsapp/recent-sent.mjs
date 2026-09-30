#!/usr/bin/env node
/**
 * Muestra los últimos mensajes enviados por una sesión de WASender.
 * Uso: node scripts/whatsapp/recent-sent.mjs [telefonoSesion=17863728411] [n=10]
 */
import { loadEnv } from '../../lib/env.mjs';
import { listSessions } from '../../bridge/lib/wasender.js';

loadEnv({ required: true });

const phone = (process.argv[2] || '17863728411').replace(/\D/g, '');
const n = Number(process.argv[3] || 10);
const sessions = (await listSessions()).data || [];
const s = sessions.find((x) => (x.phone_number || '').replace(/\D/g, '').endsWith(phone));
if (!s) throw new Error('Sesión no encontrada');
console.log('sesión', s.id, s.status);
const r = await fetch(`https://www.wasenderapi.com/api/whatsapp-sessions/${s.id}/message-logs?per_page=${n}`, {
  headers: { Authorization: `Bearer ${process.env.WASENDER_PAT}` },
});
const j = await r.json();
for (const m of j.data?.data || j.data || []) {
  const to = String(m.to || m.recipient || '').replace(/\d(?=\d{4})/g, '•');
  console.log(`${m.created_at} ${m.status} → ${to} | ${String(m.content?.text || m.content?.message || (typeof m.content === 'object' ? JSON.stringify(m.content) : m.content) || m.message || '').replace(/\n/g, ' ⏎ ').slice(0, 220)}`);
}
