#!/usr/bin/env node
/**
 * Verifica la clasificación de la ficha del cliente: cruza teléfonos contra todos los pagos de GHL.
 * Uso: node scripts/contacts/verify-history.mjs "57300...:lead,57310...:cliente_anterior"
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });
const LID = getLocationId();
const h = { Authorization: `Bearer ${getPitToken()}`, Version: '2021-07-28', 'Content-Type': 'application/json' };
const api = async (p, body) => (await fetch(`https://services.leadconnectorhq.com${p}`, body ? { method: 'POST', headers: h, body: JSON.stringify(body) } : { headers: h })).json();

const byContact = new Map();
for (let offset = 0; ; offset += 100) {
  const r = await api(`/payments/transactions?altId=${LID}&altType=location&limit=100&offset=${offset}`);
  const d = r.data || [];
  for (const t of d) {
    const s = byContact.get(t.contactId) || { ok: 0, other: 0 };
    t.status === 'succeeded' ? s.ok++ : s.other++;
    byContact.set(t.contactId, s);
  }
  if (d.length < 100) break;
}
console.log('contactos con pagos:', byContact.size);

for (const pair of process.argv[2].split(',')) {
  const [phone, status] = pair.split(':');
  const s = await api('/contacts/search', { locationId: LID, pageLimit: 5, filters: [{ field: 'phone', operator: 'eq', value: '+' + phone }] });
  const agg = { ok: 0, other: 0 };
  for (const c of s.contacts || []) {
    const x = byContact.get(c.id);
    if (x) { agg.ok += x.ok; agg.other += x.other; }
  }
  const expected = agg.ok ? 'cliente' : agg.other ? 'intento_compra' : 'lead';
  const match = status.startsWith(expected) || (expected === 'lead' && status === 'lead');
  console.log(match ? '✓' : '✗', '…' + phone.slice(-4), 'sitio:', status, '| GHL pagos ok/otros:', agg.ok, agg.other, '| contactos:', (s.contacts || []).length);
}
