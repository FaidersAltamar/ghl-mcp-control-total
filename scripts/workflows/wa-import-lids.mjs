#!/usr/bin/env node
// Importa contactos de WhatsApp sin número (solo nick + LID) a GHL usando un email sintético.
// Los campos personalizados "WhatsApp Nick" y "WhatsApp LID" guardan nick e identificador.
import { loadEnv, PROJECT_ROOT, getLocationId, getPitToken } from '../../lib/env.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

loadEnv({ required: true });
const LID = getLocationId();
const PIT = getPitToken();
const B = 'https://services.leadconnectorhq.com';
const GH = { Authorization: 'Bearer ' + PIT, Version: '2021-07-28', 'Content-Type': 'application/json' };

const NICK_FIELD = { id: 'Q9eibeWdzLHZy5fyXUyT', key: 'contact.whatsapp_nick' };
const LID_FIELD = { id: 'FxpuicULvRokRR05SdKH', key: 'contact.whatsapp_lid' };

const contacts = JSON.parse(readFileSync(join(PROJECT_ROOT, 'reports/wa-export/contacts.json'), 'utf8'));

const targets = [];
for (const c of contacts) {
  const id = c.id || '';
  if (id.endsWith('@s.whatsapp.net')) continue; // ya importados por teléfono
  const nick = (c.name || c.notify || c.verifiedName || '').trim();
  if (!nick) continue; // sin nick no hay nada identificable
  targets.push({ nick, waid: id });
}

console.log('LID contacts con nick a importar:', targets.length);

let ok = 0;
let err = 0;
const errors = [];
for (const t of targets) {
  const local = (t.waid.split('@')[0] || '').replace(/[^a-zA-Z0-9._-]/g, '') || ('wa' + Math.random().toString(36).slice(2, 10));
  const email = local + '@wa.invalid';
  const parts = t.nick.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  const body = {
    locationId: LID,
    email,
    firstName,
    lastName,
    tags: ['whatsapp'],
    customFields: [
      { ...NICK_FIELD, field_value: t.nick },
      { ...LID_FIELD, field_value: t.waid },
    ],
  };
  try {
    const r = await fetch(B + '/contacts/upsert', { method: 'POST', headers: GH, body: JSON.stringify(body) });
    if (r.ok) ok++;
    else {
      err++;
      errors.push({ email, status: r.status, body: (await r.text()).slice(0, 140) });
    }
  } catch (e) {
    err++;
    errors.push({ email, error: e.message });
  }
  if ((ok + err) % 100 === 0) console.log('progreso:', ok + err);
  await new Promise((res) => setTimeout(res, 60));
}

writeFileSync(join(PROJECT_ROOT, 'reports/wa-export/lid-import-errors.json'), JSON.stringify(errors, null, 2));
console.log('Importados:', ok, '| Errores:', err);
