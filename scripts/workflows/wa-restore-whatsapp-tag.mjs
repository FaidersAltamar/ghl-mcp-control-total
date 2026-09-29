#!/usr/bin/env node
// Re-agrega la etiqueta "whatsapp" a los contactos etiquetados como "comparte_grupo"
// (el PUT anterior reemplazó tags; este script los restaura).
import { loadEnv, getLocationId, getPitToken } from '../../lib/env.mjs';

loadEnv({ required: true });
const LID = getLocationId();
const PIT = getPitToken();
const B = 'https://services.leadconnectorhq.com';
const H = { Authorization: 'Bearer ' + PIT, Version: '2021-07-28', 'Content-Type': 'application/json' };

async function allContactsByTag(tag) {
  const out = [];
  let page = 1;
  const pageLimit = 100;
  while (true) {
    const r = await fetch(B + '/contacts/search', { method: 'POST', headers: H, body: JSON.stringify({ locationId: LID, page, pageLimit, filters: [{ field: 'tags', operator: 'eq', value: tag }] }) });
    const j = await r.json();
    const list = j.contacts || [];
    out.push(...list);
    if (list.length < pageLimit) break;
    page++;
    if (page > 100) break;
    await new Promise((res) => setTimeout(res, 100));
  }
  return out;
}

const targets = await allContactsByTag('comparte_grupo');
console.log('Contactos con compartegrupo:', targets.length);

let ok = 0, err = 0;
for (const c of targets) {
  try {
    const r = await fetch(B + '/contacts/' + c.id + '/tags', { method: 'POST', headers: H, body: JSON.stringify({ tags: ['whatsapp'] }) });
    if (r.ok) ok++;
    else { err++; console.log('ERR', c.id, r.status); }
  } catch (e) { err++; }
  if ((ok + err) % 100 === 0) console.log('progreso:', ok + err);
  await new Promise((res) => setTimeout(res, 60));
}
console.log('Restaurados:', ok, '| Errores:', err);
