#!/usr/bin/env node
// Exporta contactos, grupos y participantes del número +57 (sesión 121367) a reports/wa-export-57/.
import { PROJECT_ROOT } from '../../lib/env.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const KEY = '9c6f0edb4254684e510700cd9a5b767715c2bc657d75b1ade4b97bad5bb74592'; // sesión +57
const BASE = 'https://www.wasenderapi.com';
const OUT = join(PROJECT_ROOT, 'reports', 'wa-export-57');
mkdirSync(OUT, { recursive: true });

async function wget(path) {
  const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + KEY } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(path + ' -> ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
  return j;
}

const contacts = (await wget('/api/contacts')).data || [];
const groups = (await wget('/api/groups')).data || [];

const phoneContacts = [];
const lidOnly = [];
for (const c of contacts) {
  const id = c.id || '';
  if (id.endsWith('@s.whatsapp.net')) {
    const p = id.split('@')[0].replace(/\D/g, '');
    if (p) phoneContacts.push({ phone: p, name: c.name || c.notify || c.verifiedName || '', jid: id, lid: c.lid || '' });
  } else {
    lidOnly.push(c);
  }
}

writeFileSync(join(OUT, 'contacts.json'), JSON.stringify(contacts, null, 1));
writeFileSync(join(OUT, 'groups.json'), JSON.stringify(groups, null, 1));

const participants = {};
let totalParts = 0;
for (const g of groups) {
  try {
    const p = await wget('/api/groups/' + encodeURIComponent(g.id) + '/participants');
    const list = p.data || [];
    participants[g.id] = list;
    totalParts += list.length;
  } catch (e) {
    participants[g.id] = { error: e.message };
  }
  if (Object.keys(participants).length % 25 === 0) console.log('grupos procesados:', Object.keys(participants).length);
}
writeFileSync(join(OUT, 'participants.json'), JSON.stringify(participants, null, 1));

const summary = {
  totalContacts: contacts.length,
  withPhone: phoneContacts.length,
  lidOnly: lidOnly.length,
  totalGroups: groups.length,
  totalParticipants: totalParts,
  uniquePhones: new Set(phoneContacts.map((p) => p.phone)).size,
};
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
