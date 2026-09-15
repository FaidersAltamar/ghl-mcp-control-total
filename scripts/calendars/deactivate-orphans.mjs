#!/usr/bin/env node
/**
 * Desactiva calendarios huérfanos acordados.
 * Uso: node scripts/calendars/deactivate-orphans.mjs [--dry-run]
 */
import { loadEnv, getPitToken } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const VERSION = process.env.GHL_API_VERSION || '2021-07-28';
const PIT = getPitToken();
const DRY = process.argv.includes('--dry-run');

const ORPHANS = [
  { id: 'bjiLn57ccGDzOylXMoUT', name: 'contingencias' },
  { id: '2vVaqq8c1uZ2xSpXW6Cr', name: 'Contingencias TikTok' },
  { id: 'j8amkbGOOY5fRVrrdPuF', name: 'nuevo' },
  { id: 'hP8SgNFMwUKcLZpgewI2', name: 'Scalesoft' },
  { id: 'udEMrWtLj56RbaNqgLtG', name: 'Scalesoft Nor' },
  { id: '9iC6NCqxT7tgQJfT3zJE', name: 'moreno don bm' },
  { id: 'gdMW5gzKhfMFTK7Mcuc3', name: 'LM Personal Calendar' },
  { id: 'qSuATyE5ul1V3eqd19bn', name: 'Conéctate con RUSH' },
  { id: 'mc7RyRFMg1WfnGoWKQN3', name: "FABI EL BEBE's Personal Calendar" },
];

const h = {
  Authorization: `Bearer ${PIT}`,
  Version: VERSION,
  'Content-Type': 'application/json',
};

const FALLBACK_USER = 'd4QvP27fL7tIKcutJNfd'; // Faiders — required when calendar has no team

for (const cal of ORPHANS) {
  if (DRY) {
    console.log(`[dry-run] would deactivate: ${cal.name} (${cal.id})`);
    continue;
  }
  let body = { isActive: false };
  let res = await fetch(`${BASE}/calendars/${cal.id}`, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status === 400) {
    body.teamMembers = [{ userId: FALLBACK_USER, priority: 0.5, selected: true, isPrimary: true }];
    res = await fetch(`${BASE}/calendars/${cal.id}`, {
      method: 'PUT',
      headers: h,
      body: JSON.stringify(body),
    });
  }
  const text = await res.text();
  const status = res.ok ? 'OK' : 'FAIL';
  console.log(`${status} ${cal.name} → HTTP ${res.status}${res.ok ? '' : ': ' + text.slice(0, 200)}`);
}
