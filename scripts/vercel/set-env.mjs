#!/usr/bin/env node
/**
 * Crea o actualiza variables de entorno del proyecto bridge en Vercel.
 * Uso: node scripts/vercel/set-env.mjs CLAVE=valor [CLAVE2=valor2 ...]
 */
import { loadEnv } from '../../lib/env.mjs';

loadEnv({ required: true });

const TOKEN = process.env.VERCEL_TOKEN;
const PID = process.env.VERCEL_PROJECT_ID;
if (!TOKEN || !PID) throw new Error('VERCEL_TOKEN y VERCEL_PROJECT_ID requeridos en .env');

const h = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const API = `https://api.vercel.com`;

const existing = await (await fetch(`${API}/v10/projects/${PID}/env`, { headers: h })).json();

for (const arg of process.argv.slice(2)) {
  const i = arg.indexOf('=');
  const key = arg.slice(0, i);
  const value = arg.slice(i + 1);
  const found = (existing.envs || []).find((e) => e.key === key);
  const r = found
    ? await fetch(`${API}/v9/projects/${PID}/env/${found.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ value }) })
    : await fetch(`${API}/v10/projects/${PID}/env`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ key, value, target: ['production', 'preview', 'development'], type: 'encrypted' }),
    });
  console.log(`${key} ${found ? 'actualizada' : 'creada'} -> HTTP ${r.status}`);
}
