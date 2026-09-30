#!/usr/bin/env node
/**
 * Prueba la bandeja: envía un mensaje por el bridge (/api/inbox-send).
 * Uso: node scripts/whatsapp/test-inbox.mjs <to> "<texto>" [from=17863728411] [imageUrl]
 */
import { loadEnv } from '../../lib/env.mjs';

loadEnv({ required: true });
const [to, text, from = '17863728411', imageUrl] = process.argv.slice(2);
const r = await fetch('https://bridge-iota-opal.vercel.app/api/inbox-send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-inbox-secret': process.env.INBOX_SECRET },
  body: JSON.stringify({ from, to, text, ...(imageUrl ? { mediaUrl: imageUrl, mediaType: 'image' } : {}) }),
});
console.log(r.status, (await r.text()).slice(0, 300));
