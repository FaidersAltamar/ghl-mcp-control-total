#!/usr/bin/env node
/**
 * Build cdp.people seed rows from local exports and emit SQL upsert batches.
 *
 * Usage:
 *   node scripts/cdp/build-people-seed.mjs
 *   node scripts/cdp/build-people-seed.mjs --sql-dir reports/cdp-sql
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

function extractRows(raw) {
  let text = raw;
  try {
    const outer = JSON.parse(raw);
    if (typeof outer.result === 'string') text = outer.result;
    else if (Array.isArray(outer)) return normalizeRows(outer);
    else if (Array.isArray(outer.data)) return normalizeRows(outer.data);
  } catch {
    // ignore
  }
  if (text.includes('\\n') && !text.includes('\n[{')) {
    text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  const marker = '<untrusted-data-';
  let searchFrom = 0;
  while (true) {
    const open = text.indexOf(marker, searchFrom);
    if (open < 0) break;
    const gt = text.indexOf('>', open);
    const close = text.indexOf('</untrusted-data-', gt);
    if (gt > 0 && close > gt) {
      const payload = text.slice(gt + 1, close).trim();
      if (payload.startsWith('[') || payload.startsWith('{')) {
        return normalizeRows(JSON.parse(payload));
      }
    }
    searchFrom = open + marker.length;
  }
  const i = text.indexOf('[{');
  const j = text.lastIndexOf('}]');
  if (i >= 0 && j > i) return normalizeRows(JSON.parse(text.slice(i, j + 2)));
  throw new Error('No rows found');
}

function normalizeRows(parsed) {
  if (!Array.isArray(parsed)) return [];
  if (parsed.length === 1 && Array.isArray(parsed[0]?.data)) return parsed[0].data;
  if (parsed.every((r) => r && r.email)) return parsed;
  if (parsed.every((r) => r && r.data && Array.isArray(r.data))) {
    return parsed.flatMap((r) => r.data);
  }
  return parsed;
}

function sqlStr(v) {
  if (v == null) return 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlTextArray(arr) {
  if (!arr?.length) return `'{}'`;
  return `ARRAY[${arr.map(sqlStr).join(',')}]::text[]`;
}

function lifecycleFor({ total_recharged, is_banned, hasGhl, hasSorry }) {
  if (is_banned) return 'banned';
  const r = Number(total_recharged || 0);
  if (r >= 200) return 'vip';
  if (r > 0) return 'buyer';
  if (hasSorry) return 'activated';
  if (hasGhl) return 'lead';
  return 'lead';
}

function offerFitFor({ total_recharged, hasGhl, hasSorry }) {
  const fit = [];
  const r = Number(total_recharged || 0);
  if (hasSorry && r === 0) fit.push('low_ticket');
  if (r > 0) fit.push('low_ticket');
  if (hasGhl) fit.push('comunidad', 'mentoria');
  if (r >= 100) fit.push('dfy');
  return [...new Set(fit)];
}

const agentTools =
  process.env.AGENT_TOOLS ||
  'C:/Users/faiders/.cursor/projects/d-Proyectos-GHL-MCP/agent-tools';

const sorryFiles = [
  '0354eadd-7431-4db7-bdf5-c85bdd2838c0.txt',
  'da949548-5879-4505-9891-e429f1cb867f.txt',
  '399c8a46-1b93-4243-b2a7-ad209786163b.txt',
];

const byEmail = new Map();

for (const f of sorryFiles) {
  const rows = extractRows(readFileSync(join(agentTools, f), 'utf8'));
  for (const r of rows) {
    const email = String(r.email || '')
      .toLowerCase()
      .trim();
    if (!email) continue;
    const prev = byEmail.get(email) || {
      email,
      name: null,
      phones: [],
      external_ids: {},
      business_units: [],
      total_recharged: 0,
      is_banned: false,
    };
    prev.external_ids.sorrymark_id = r.sorrymark_id;
    prev.total_recharged = Number(r.total_recharged || 0);
    prev.is_banned = !!r.is_banned;
    if (!prev.business_units.includes('sorrymark')) prev.business_units.push('sorrymark');
    byEmail.set(email, prev);
  }
}

const ghl = JSON.parse(readFileSync('reports/ghl-emails.json', 'utf8'));
for (const [emailRaw, g] of Object.entries(ghl.map)) {
  const email = String(emailRaw).toLowerCase().trim();
  if (!email) continue;
  const prev = byEmail.get(email) || {
    email,
    name: null,
    phones: [],
    external_ids: {},
    business_units: [],
    total_recharged: 0,
    is_banned: false,
  };
  prev.external_ids.ghl_id = g.id;
  if (g.name) prev.name = g.name;
  if (g.phone) prev.phones = [...new Set([...(prev.phones || []), g.phone])];
  if (!prev.business_units.includes('control_ads')) prev.business_units.push('control_ads');
  if (Array.isArray(g.tags) && g.tags.length) {
    prev.meta = { ...(prev.meta || {}), ghl_tags: g.tags };
  }
  byEmail.set(email, prev);
}

const people = [...byEmail.values()].map((p) => {
  const hasGhl = !!p.external_ids.ghl_id;
  const hasSorry = !!p.external_ids.sorrymark_id;
  return {
    ...p,
    lifecycle: lifecycleFor({
      total_recharged: p.total_recharged,
      is_banned: p.is_banned,
      hasGhl,
      hasSorry,
    }),
    offer_fit: offerFitFor({
      total_recharged: p.total_recharged,
      hasGhl,
      hasSorry,
    }),
    persona: null,
  };
});

mkdirSync('reports', { recursive: true });
writeFileSync('reports/cdp-people-seed.json', JSON.stringify({ count: people.length, people }, null, 2));

const sqlDir = 'reports/cdp-sql';
mkdirSync(sqlDir, { recursive: true });
const BATCH = 150;
let batchIdx = 0;
for (let i = 0; i < people.length; i += BATCH) {
  const chunk = people.slice(i, i + BATCH);
  const values = chunk
    .map((p) => {
      const ext = sqlStr(JSON.stringify(p.external_ids || {}));
      const meta = sqlStr(JSON.stringify(p.meta || {}));
      return `(${sqlStr(p.email)}, ${sqlStr(p.name)}, ${sqlTextArray(p.phones || [])}, ${ext}::jsonb, ${sqlTextArray(p.business_units)}, ${sqlStr(p.persona)}, ${sqlStr(p.lifecycle)}, ${sqlTextArray(p.offer_fit)}, ${Number(p.total_recharged || 0)}, ${p.is_banned ? 'true' : 'false'}, ${meta}::jsonb)`;
    })
    .join(',\n');

  const sql = `insert into cdp.people (
  email, name, phones, external_ids, business_units, persona, lifecycle, offer_fit, total_recharged, is_banned, meta
) values
${values}
on conflict (email) do update set
  name = coalesce(excluded.name, cdp.people.name),
  phones = case when cardinality(excluded.phones) > 0 then excluded.phones else cdp.people.phones end,
  external_ids = cdp.people.external_ids || excluded.external_ids,
  business_units = (
    select array_agg(distinct x order by x)
    from unnest(cdp.people.business_units || excluded.business_units) as x
  ),
  persona = coalesce(excluded.persona, cdp.people.persona),
  lifecycle = excluded.lifecycle,
  offer_fit = (
    select coalesce(array_agg(distinct x order by x), '{}')
    from unnest(cdp.people.offer_fit || excluded.offer_fit) as x
  ),
  total_recharged = greatest(cdp.people.total_recharged, excluded.total_recharged),
  is_banned = cdp.people.is_banned or excluded.is_banned,
  meta = cdp.people.meta || excluded.meta,
  updated_at = now();`;

  writeFileSync(join(sqlDir, `batch-${String(batchIdx).padStart(3, '0')}.sql`), sql);
  batchIdx++;
}

const both = people.filter(
  (p) => p.external_ids.sorrymark_id && p.external_ids.ghl_id
).length;
const onlyS = people.filter(
  (p) => p.external_ids.sorrymark_id && !p.external_ids.ghl_id
).length;
const onlyG = people.filter(
  (p) => !p.external_ids.sorrymark_id && p.external_ids.ghl_id
).length;

console.log(
  JSON.stringify(
    {
      people: people.length,
      both,
      only_sorrymark: onlyS,
      only_ghl: onlyG,
      sql_batches: batchIdx,
      sql_dir: sqlDir,
      seed: 'reports/cdp-people-seed.json',
    },
    null,
    2
  )
);
