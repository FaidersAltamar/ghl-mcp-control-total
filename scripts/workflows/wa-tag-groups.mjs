#!/usr/bin/env node
// Etiqueta contactos que comparten grupos de WhatsApp y guarda los nombres de los grupos.
import { loadEnv, PROJECT_ROOT, getLocationId, getPitToken } from '../../lib/env.mjs';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

loadEnv({ required: true });
const LID = getLocationId();
const PIT = getPitToken();
const B = 'https://services.leadconnectorhq.com';
const H = { Authorization: 'Bearer ' + PIT, Version: '2021-07-28', 'Content-Type': 'application/json' };
const GRUPOS_FIELD = { id: 'u4a1WER9n7lzi1xj0w9B', key: 'contact.grupos_compartidos' };
const TAG = 'comparte_grupo';
const OUT = join(PROJECT_ROOT, 'reports', 'wa-export');

const contacts = JSON.parse(readFileSync(join(OUT, 'contacts.json'), 'utf8'));
const groups = JSON.parse(readFileSync(join(OUT, 'groups.json'), 'utf8'));
const parts = JSON.parse(readFileSync(join(OUT, 'participants.json'), 'utf8'));

const gname = {};
for (const g of groups) gname[g.id] = g.name || '';

const lidGroups = new Map();
for (const gid in parts) {
  const list = parts[gid];
  if (!Array.isArray(list)) continue;
  for (const p of list) {
    const lid = p && p.id;
    if (!lid) continue;
    if (!lidGroups.has(lid)) lidGroups.set(lid, new Set());
    lidGroups.get(lid).add(gid);
  }
}

async function searchContact(filters) {
  const r = await fetch(B + '/contacts/search', { method: 'POST', headers: H, body: JSON.stringify({ locationId: LID, page: 1, pageLimit: 1, filters }) });
  const j = await r.json();
  return (j.contacts && j.contacts[0]) || null;
}

const targets = [];
for (const c of contacts) {
  const id = c.id || '';
  const isPhone = id.endsWith('@s.whatsapp.net');
  const lid = isPhone ? (c.lid || '') : id;
  if (!lid || !lidGroups.has(lid)) continue;
  const names = [...lidGroups.get(lid)].map((g) => gname[g] || g).filter(Boolean);
  if (isPhone) {
    targets.push({ type: 'phone', phone: '+' + id.split('@')[0].replace(/\D/g, ''), names });
  } else {
    targets.push({ type: 'email', email: lid.split('@')[0] + '@wa.invalid', names });
  }
}

console.log('Contactos que comparten grupo:', targets.length);

let ok = 0, skip = 0, err = 0;
const errors = [];
for (const t of targets) {
  try {
    const filters = t.type === 'phone'
      ? [{ field: 'phone', operator: 'eq', value: t.phone }]
      : [{ field: 'email', operator: 'eq', value: t.email }];
    const c = await searchContact(filters);
    if (!c) { skip++; continue; }
    const value = t.names.join(', ');
    const r = await fetch(B + '/contacts/' + c.id, { method: 'PUT', headers: H, body: JSON.stringify({ tags: [TAG], customFields: [{ ...GRUPOS_FIELD, value }] }) });
    if (r.ok) ok++;
    else { err++; errors.push({ id: c.id, status: r.status, body: (await r.text()).slice(0, 120) }); }
  } catch (e) { err++; errors.push({ error: e.message }); }
  if ((ok + skip + err) % 100 === 0) console.log('progreso:', ok + skip + err);
  await new Promise((res) => setTimeout(res, 60));
}

writeFileSync(join(OUT, 'group-tag-errors.json'), JSON.stringify(errors, null, 2));
console.log('Etiquetados:', ok, '| Sin contacto:', skip, '| Errores:', err);
