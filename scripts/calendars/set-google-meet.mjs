#!/usr/bin/env node
/**
 * Pone Google Meet como ubicación de reunión para todos los miembros de los
 * 4 calendarios de contingencias (GHL genera el enlace por cita).
 * Uso: node scripts/calendars/set-google-meet.mjs
 */
import { loadEnv, getPitToken } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = 'https://services.leadconnectorhq.com';
const h = { Authorization: `Bearer ${getPitToken()}`, Version: '2021-04-15', Accept: 'application/json', 'Content-Type': 'application/json' };

const CALS = ['bJT5h32OkoOdSfV2zd4O', 'JGiNpYTCf6w3BwpAdChw', 'o6c2SOIoEkjEfKtBPUNN', '2vVaqq8c1uZ2xSpXW6Cr'];
for (const id of CALS) {
  const c = (await (await fetch(`${BASE}/calendars/${id}`, { headers: h })).json()).calendar;
  const teamMembers = (c.teamMembers || []).map((m) => ({
    userId: m.userId,
    priority: m.priority,
    isPrimary: m.isPrimary,
    locationConfigurations: [{ kind: 'google_conference', location: '', position: 0 }],
  }));
  const r = await fetch(`${BASE}/calendars/${id}`, { method: 'PUT', headers: h, body: JSON.stringify({ teamMembers }) });
  const after = (await r.json()).calendar;
  console.log(`${c.name}: HTTP ${r.status} ->`, JSON.stringify((after?.teamMembers || []).map((m) => m.locationConfigurations?.[0]?.kind)));
}
