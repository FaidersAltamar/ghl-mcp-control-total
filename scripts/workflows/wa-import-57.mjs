#!/usr/bin/env node
// Importa TODOS los contactos del número +57 a GHL (deduplicando).
// - Con teléfono: upsert por teléfono + LID en campo personalizado.
// - Solo LID: upsert por email sintético + Nick + LID en campos personalizados.
import { loadEnv, PROJECT_ROOT, getLocationId, getPitToken } from '../../lib/env.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

loadEnv({ required: true });
const LID = getLocationId();
const PIT = getPitToken();
const B = 'https://services.leadconnectorhq.com';
const H = { Authorization: 'Bearer ' + PIT, Version: '2021-07-28', 'Content-Type': 'application/json' };
const NICK_FIELD = { id: 'Q9eibeWdzLHZy5fyXUyT' };
const LID_FIELD = { id: 'FxpuicULvRokRR05SdKH' };
const OUT = join(PROJECT_ROOT, 'reports', 'wa-export-57');

const contacts = JSON.parse(readFileSync(join(OUT, 'contacts.json'), 'utf8'));

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
}

async function upsert(body) {
  const r = await fetch(B + '/contacts/upsert', { method: 'POST', headers: H, body: JSON.stringify({ locationId: LID, ...body }) });
  return r;
}

let ok = 0, err = 0;
const errors = [];
const TOTAL = contacts.length;

for (let i = 0; i < contacts.length; i++) {
  const c = contacts[i];
  const id = c.id || '';
  const isPhone = id.endsWith('@s.whatsapp.net');
  const customFields = [];

  try {
    if (isPhone) {
      const digits = id.split('@')[0].replace(/\D/g, '');
      if (!digits || digits.length < 7) { continue; }
      const { firstName, lastName } = splitName(c.name);
      if (c.lid) customFields.push({ ...LID_FIELD, value: c.lid });
      const r = await upsert({ phone: '+' + digits, firstName, lastName, tags: ['whatsapp'], customFields });
      if (r.ok) ok++; else { err++; errors.push({ phone: digits, status: r.status, body: (await r.text()).slice(0, 140) }); }
    } else {
      const lid = id.endsWith('@lid') ? id : (c.lid || id);
      const local = (lid.split('@')[0] || '').replace(/[^a-zA-Z0-9._-]/g, '') || ('wa' + Math.random().toString(36).slice(2, 10));
      const email = local + '@wa.invalid';
      const nick = (c.name || c.notify || c.verifiedName || '').trim();
      const { firstName, lastName } = splitName(nick);
      if (nick) customFields.push({ ...NICK_FIELD, value: nick });
      customFields.push({ ...LID_FIELD, value: lid });
      const r = await upsert({ email, firstName, lastName, tags: ['whatsapp'], customFields });
      if (r.ok) ok++; else { err++; errors.push({ email, status: r.status, body: (await r.text()).slice(0, 140) }); }
    }
  } catch (e) {
    err++;
    errors.push({ id, error: e.message });
  }

  if ((ok + err) % 200 === 0) console.log('progreso:', ok + err, '/', TOTAL, '| ok:', ok, '| err:', err);
  await new Promise((res) => setTimeout(res, 50));
}

writeFileSync(join(OUT, 'import-errors.json'), JSON.stringify(errors, null, 2));
console.log('IMPORTADO. ok:', ok, '| err:', err, '| total procesados:', ok + err);
