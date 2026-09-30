#!/usr/bin/env node
/**
 * Explora qué datos de historial de clientes hay en GHL (etiquetas, pipelines, pagos)
 * y la ficha de un contacto por teléfono.
 * Uso: node scripts/contacts/history-survey.mjs [telefono]
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });
const LID = getLocationId();
const H = (v = '2021-07-28') => ({ Authorization: `Bearer ${getPitToken()}`, Version: v, Accept: 'application/json', 'Content-Type': 'application/json' });
const get = async (p, v) => {
  const r = await fetch(`https://services.leadconnectorhq.com${p}`, { headers: H(v) });
  return r.ok ? r.json() : { error: r.status, body: (await r.text()).slice(0, 150) };
};
const post = async (p, body) => {
  const r = await fetch(`https://services.leadconnectorhq.com${p}`, { method: 'POST', headers: H(), body: JSON.stringify(body) });
  return r.ok ? r.json() : { error: r.status, body: (await r.text()).slice(0, 150) };
};

const tags = await get(`/locations/${LID}/tags`);
console.log('TAGS', (tags.tags || []).length, (tags.tags || []).map((t) => t.name).join(' | ').slice(0, 1500), tags.error || '');

const pipes = await get(`/opportunities/pipelines?locationId=${LID}`);
for (const p of pipes.pipelines || []) console.log('PIPELINE', p.id, p.name, '→', (p.stages || []).map((s) => s.name).join(' > '));

const tx = await get(`/payments/transactions?altId=${LID}&altType=location&limit=5`);
console.log('TRANSACTIONS total', tx.totalCount ?? tx.total ?? (tx.data || []).length, tx.error || '', JSON.stringify((tx.data || []).slice(0, 2)).slice(0, 600));
const orders = await get(`/payments/orders?altId=${LID}&altType=location&limit=5`);
console.log('ORDERS total', orders.totalCount ?? (orders.data || []).length, orders.error || '', JSON.stringify((orders.data || []).slice(0, 1)).slice(0, 500));

const opps = await get(`/opportunities/search?location_id=${LID}&limit=5`);
console.log('OPPORTUNITIES total', opps.meta?.total, opps.error || '', JSON.stringify((opps.opportunities || []).slice(0, 2).map((o) => ({ name: o.name, status: o.status, value: o.monetaryValue, pipe: o.pipelineId, stage: o.pipelineStageId, source: o.source }))));

const cf = await get(`/locations/${LID}/customFields`);
console.log('CUSTOM FIELDS', (cf.customFields || []).map((f) => f.name).join(' | ').slice(0, 1500));

const phone = process.argv[2];
if (phone) {
  const s = await post('/contacts/search', { locationId: LID, pageLimit: 5, filters: [{ field: 'phone', operator: 'eq', value: phone }] });
  for (const c of s.contacts || []) {
    console.log('\nCONTACT', c.id, c.firstName, c.lastName, c.email, 'tags:', (c.tags || []).join(','), 'source:', c.source, 'created:', c.dateAdded);
    const o = await get(`/opportunities/search?location_id=${LID}&contact_id=${c.id}`);
    console.log('  opps', JSON.stringify((o.opportunities || []).map((x) => ({ name: x.name, status: x.status, value: x.monetaryValue }))));
    const a = await get(`/contacts/${c.id}/appointments`, '2021-04-15');
    console.log('  appts', (a.events || []).length);
    const t = await get(`/payments/transactions?altId=${LID}&altType=location&contactId=${c.id}&limit=10`);
    console.log('  tx', (t.data || []).length, t.error || '');
  }
}
