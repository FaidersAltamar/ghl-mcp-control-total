#!/usr/bin/env node
/**
 * Verifica que el bridge funcione solo en la nube: variables en Vercel, deploy al día,
 * webhooks de WASender y del workflow de GHL apuntando a Vercel.
 * Uso: node scripts/vercel/cloud-check.mjs
 */
import { execSync } from 'node:child_process';
import { loadEnv } from '../../lib/env.mjs';
import { listSessions } from '../../bridge/lib/wasender.js';

loadEnv({ required: true });

const NEEDED = [
  'GHL_LOCATION_ID', 'GHL_PIT_TOKEN', 'GHL_FIREBASE_REFRESH_TOKEN',
  'WASENDER_API_KEY', 'WASENDER_PAT', 'WASENDER_WEBHOOK_SECRET',
  'WA_BOT_ENABLED', 'WA_BOT_PHONES', 'AI_API_KEY',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'APPOINTMENT_NOTIFY_SECRET', 'TIKTOK_TEAM_PHONES', 'META_TEAM_PHONES',
  'TIKTOK_TEAM_EMAILS', 'META_TEAM_EMAILS',
  'INBOX_INGEST_URL', 'INBOX_SECRET',
];

const h = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
const PID = process.env.VERCEL_PROJECT_ID;
const envs = (await (await fetch(`https://api.vercel.com/v10/projects/${PID}/env`, { headers: h })).json()).envs || [];
const keys = new Set(envs.filter((e) => (e.target || []).includes('production')).map((e) => e.key));
console.log('== Variables en Vercel (producción)');
for (const k of NEEDED) console.log(keys.has(k) ? '  ✓' : '  ✗ FALTA', k);

const dep = (await (await fetch(`https://api.vercel.com/v6/deployments?projectId=${PID}&target=production&limit=1`, { headers: h })).json()).deployments?.[0];
const head = execSync('git rev-parse origin/main').toString().trim();
console.log('\n== Deploy producción:', dep?.state || dep?.readyState, dep?.meta?.githubCommitSha?.slice(0, 7), '| origin/main:', head.slice(0, 7),
  dep?.meta?.githubCommitSha === head ? '✓ al día' : '✗ desfasado');

const health = await fetch('https://bridge-iota-opal.vercel.app/api/health').then((r) => r.json()).catch((e) => ({ error: e.message }));
console.log('\n== /api/health:', JSON.stringify(health));

console.log('\n== Webhooks WASender');
for (const s of (await listSessions()).data || []) console.log(' ', s.name, s.status, s.webhook_enabled ? s.webhook_url : 'WEBHOOK APAGADO');

const inbox = await fetch(process.env.INBOX_INGEST_URL, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-inbox-secret': process.env.INBOX_SECRET }, body: '{"events":[]}',
});
console.log('\n== Bandeja del sitio con clave:', inbox.status, inbox.status === 200 ? '✓' : '✗');
