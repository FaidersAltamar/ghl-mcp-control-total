#!/usr/bin/env node
/**
 * Espera a que el último despliegue de producción del bridge quede READY.
 * Uso: node scripts/vercel/wait-deploy.mjs
 */
import { loadEnv } from '../../lib/env.mjs';

loadEnv({ required: true });

const h = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
const PID = process.env.VERCEL_PROJECT_ID;

for (let i = 0; i < 40; i++) {
  const r = await (await fetch(`https://api.vercel.com/v6/deployments?projectId=${PID}&target=production&limit=1`, { headers: h })).json();
  const d = r.deployments?.[0];
  console.log(`${d?.uid} ${d?.state} ${d?.meta?.githubCommitSha?.slice(0, 7) || ''}`);
  if (d && ['READY', 'ERROR', 'CANCELED'].includes(d.state)) process.exit(d.state === 'READY' ? 0 : 1);
  await new Promise((res) => setTimeout(res, 8000));
}
process.exit(1);
