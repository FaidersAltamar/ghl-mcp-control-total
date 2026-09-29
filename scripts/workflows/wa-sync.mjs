#!/usr/bin/env node
// Cruza contactos de WhatsApp con GHL y (opcional) importa los que faltan.
// Uso: node scripts/workflows/wa-sync.mjs [--import]
import { loadEnv, PROJECT_ROOT, getLocationId, getPitToken } from '../../lib/env.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

loadEnv({ required: true });
const LID = getLocationId();
const PIT = getPitToken();
const B = 'https://services.leadconnectorhq.com';
const GH = { Authorization: 'Bearer ' + PIT, Version: '2021-07-28', 'Content-Type': 'application/json' };
const IMPORT = process.argv.includes('--import');
const OUT = join(PROJECT_ROOT, 'reports', 'wa-export');

const contacts = JSON.parse(readFileSync(join(OUT, 'contacts.json'), 'utf8'));
const waPhones = [];
const seen = new Set();
for (const c of contacts) {
  const id = c.id || '';
  if (!id.endsWith('@s.whatsapp.net')) continue;
  const digits = id.split('@')[0].replace(/\D/g, '');
  if (!digits || digits.length < 7 || seen.has(digits)) continue;
  seen.add(digits);
  let name = c.name || c.notify || c.verifiedName || '';
  if (/[+*#]/.test(name) || /\d{4,}/.test(name)) name = '';
  waPhones.push({ digits, name });
}

const ghl = new Map();
const ghlNat = new Map();
let page = 1;
const pageLimit = 100;
while (true) {
  const r = await fetch(B + '/contacts/search', { method: 'POST', headers: GH, body: JSON.stringify({ locationId: LID, page, pageLimit }) });
  const j = await r.json();
  const list = j.contacts || [];
  for (const c of list) {
    const digits = (c.phone || '').replace(/\D/g, '');
    if (!digits) continue;
    if (!ghl.has(digits)) ghl.set(digits, { id: c.id, name: ((c.firstName || '') + ' ' + (c.lastName || '')).trim() });
    const nat = digits.slice(-10);
    if (!ghlNat.has(nat)) ghlNat.set(nat, []);
    ghlNat.get(nat).push(digits);
  }
  if (list.length < pageLimit) break;
  page++;
  if (page > 1000) break;
  await new Promise((res) => setTimeout(res, 120));
}

const existing = [];
const possible = [];
const missing = [];
for (const w of waPhones) {
  if (ghl.has(w.digits)) {
    const g = ghl.get(w.digits);
    existing.push({ phone: w.digits, name: w.name, ghlId: g.id, ghlName: g.name });
  } else {
    const nat = w.digits.slice(-10);
    if (ghlNat.has(nat)) {
      possible.push({ phone: w.digits, name: w.name, ghlPhones: ghlNat.get(nat) });
    } else {
      missing.push(w);
    }
  }
}

console.log('WA contactos con telefono:', waPhones.length);
console.log('GHL contactos con telefono:', ghl.size);
console.log('Ya en GHL (match exacto):', existing.length);
console.log('Posible duplicado (10 digitos):', possible.length);
console.log('Nuevos:', missing.length);
writeFileSync(join(OUT, 'sync-report.json'), JSON.stringify({ existing, possible, missing }, null, 2));

if (IMPORT) {
  let imported = 0;
  for (const w of missing) {
    const phone = '+' + w.digits;
    let name = w.name || '';
    if (/[+*#]/.test(name) || /\d{4,}/.test(name)) name = '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    try {
      const r = await fetch(B + '/contacts/upsert', { method: 'POST', headers: GH, body: JSON.stringify({ locationId: LID, phone, firstName, lastName, tags: ['whatsapp'], customFields: [] }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) imported++;
      else console.log('ERR', phone, r.status, JSON.stringify(j).slice(0, 120));
    } catch (e) { console.log('ERR', w.digits, e.message); }
    await new Promise((res) => setTimeout(res, 150));
  }
  console.log('Importados:', imported);
}
