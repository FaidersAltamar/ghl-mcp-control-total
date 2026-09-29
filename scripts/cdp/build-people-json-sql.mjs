#!/usr/bin/env node
/**
 * Emit compact jsonb_to_recordset SQL batches for cdp.people upsert.
 * node scripts/cdp/build-people-json-sql.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const { people } = JSON.parse(readFileSync('reports/cdp-people-seed.json', 'utf8'));
const BATCH = 200;
const sqlDir = 'reports/cdp-json-sql';
mkdirSync(sqlDir, { recursive: true });

function esc(obj) {
  return JSON.stringify(obj).replace(/'/g, "''");
}

let n = 0;
for (let i = 0; i < people.length; i += BATCH) {
  const chunk = people.slice(i, i + BATCH).map((p) => ({
    email: p.email,
    name: p.name,
    phones: p.phones || [],
    external_ids: p.external_ids || {},
    business_units: p.business_units || [],
    persona: p.persona,
    lifecycle: p.lifecycle,
    offer_fit: p.offer_fit || [],
    total_recharged: Number(p.total_recharged || 0),
    is_banned: !!p.is_banned,
    meta: p.meta || {},
  }));

  const sql = `insert into cdp.people (
  email, name, phones, external_ids, business_units, persona, lifecycle, offer_fit, total_recharged, is_banned, meta
)
select
  email,
  name,
  coalesce(phones, '{}'),
  coalesce(external_ids, '{}'::jsonb),
  coalesce(business_units, '{}'),
  persona,
  coalesce(lifecycle, 'lead'),
  coalesce(offer_fit, '{}'),
  coalesce(total_recharged, 0),
  coalesce(is_banned, false),
  coalesce(meta, '{}'::jsonb)
from jsonb_to_recordset('${esc(chunk)}'::jsonb) as x(
  email text,
  name text,
  phones text[],
  external_ids jsonb,
  business_units text[],
  persona text,
  lifecycle text,
  offer_fit text[],
  total_recharged numeric,
  is_banned boolean,
  meta jsonb
)
on conflict (email) do update set
  name = coalesce(excluded.name, cdp.people.name),
  phones = case when cardinality(excluded.phones) > 0 then excluded.phones else cdp.people.phones end,
  external_ids = cdp.people.external_ids || excluded.external_ids,
  business_units = (
    select array_agg(distinct u order by u)
    from unnest(cdp.people.business_units || excluded.business_units) as u
  ),
  persona = coalesce(excluded.persona, cdp.people.persona),
  lifecycle = excluded.lifecycle,
  offer_fit = (
    select coalesce(array_agg(distinct u order by u), '{}')
    from unnest(cdp.people.offer_fit || excluded.offer_fit) as u
  ),
  total_recharged = greatest(cdp.people.total_recharged, excluded.total_recharged),
  is_banned = cdp.people.is_banned or excluded.is_banned,
  meta = cdp.people.meta || excluded.meta,
  updated_at = now();`;

  writeFileSync(`${sqlDir}/batch-${String(n).padStart(3, '0')}.sql`, sql);
  n++;
}

console.log(JSON.stringify({ people: people.length, batches: n, sqlDir }));
