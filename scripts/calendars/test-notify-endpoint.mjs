#!/usr/bin/env node
/**
 * Dispara una notificación de PRUEBA al endpoint de producción, con el
 * payload estándar del webhook de GHL.
 * Uso: node scripts/calendars/test-notify-endpoint.mjs [meta|tiktok]
 */
import { loadEnv } from '../../lib/env.mjs';

loadEnv({ required: true });

const team = process.argv[2] || 'meta';
const cal = team === 'tiktok' ? 'o6c2SOIoEkjEfKtBPUNN' : 'bJT5h32OkoOdSfV2zd4O';
const url = `https://bridge-iota-opal.vercel.app/api/appointment-notify?secret=${process.env.APPOINTMENT_NOTIFY_SECRET}&kind=booked&cal=${cal}`;

const r = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    first_name: 'PRUEBA',
    last_name: 'Sistema de avisos',
    email: 'prueba@controlads.com.co',
    phone: '+570000000000',
    calendar: { id: cal, title: 'PRUEBA — ignorar este aviso', startTime: new Date(Date.now() + 86400000).toISOString() },
  }),
});
console.log(r.status, await r.text());
