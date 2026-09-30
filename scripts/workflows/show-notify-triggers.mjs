#!/usr/bin/env node
/**
 * Muestra los disparadores y pasos de los workflows de aviso de citas al equipo.
 * Uso: node scripts/workflows/show-notify-triggers.mjs
 */
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });
const LOC = getLocationId();

const IDS = { TikTok: '74ae799e-650f-4109-8a9b-0835ab1b9a9d', Meta: '8f124c53-25a4-44aa-bfa4-18d0507a132e' };
for (const [label, id] of Object.entries(IDS)) {
  const wf = await ghlWorkflowFetch(`/workflow/${LOC}/${id}?includeScheduledPauseInfo=true&sessionId=x`);
  console.log(`\n=== ${label}: ${wf.name} status=${wf.status} ===`);
  const trig = await ghlWorkflowFetch(`/workflow/${LOC}/trigger?workflowId=${id}`).catch((e) => ({ error: e.message }));
  for (const t of trig.triggers || trig || []) {
    console.log('trigger', t.type, t.status || t.active, JSON.stringify(t.conditions || t.filters || []).slice(0, 400));
  }
  if (trig.error) console.log('trigger error', trig.error.slice(0, 200));
  for (const s of wf.workflowData?.templates || []) {
    const url = (s.attributes?.url || '').replace(/secret=[^&]+/, 'secret=***');
    console.log('step', s.type, s.name, url);
  }
}
