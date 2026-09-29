#!/usr/bin/env node
/**
 * Pull RUSH/Skool members via skooltor MCP and upsert into cdp.people.
 *
 * Env:
 *   SKOOLTOR_MCP_URL
 *   SKOOLTOR_MCP_KEY
 *   (optional) SKOOLTOR_COMMUNITY_ID
 *
 * Usage:
 *   node scripts/cdp/import-rush-skool.mjs
 *   node scripts/cdp/import-rush-skool.mjs --dry
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const p = resolve('.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const URL = process.env.SKOOLTOR_MCP_URL;
const KEY = process.env.SKOOLTOR_MCP_KEY;
if (!URL || !KEY) {
  console.error('Missing SKOOLTOR_MCP_URL / SKOOLTOR_MCP_KEY in .env');
  process.exit(1);
}

const DRY = process.argv.includes('--dry');
const headersBase = {
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};
let sessionId = null;
let rpcId = 1;

function parseSseOrJson(text) {
  const trimmed = String(text || '').trim();
  if (trimmed.startsWith('data:')) {
    const payloads = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.replace(/^data:\s*/, ''))
      .filter(Boolean);
    const last = payloads[payloads.length - 1];
    return JSON.parse(last);
  }
  return JSON.parse(trimmed);
}

async function rpc(method, params = {}) {
  const headers = { ...headersBase };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const body =
    method === 'notifications/initialized'
      ? JSON.stringify({ jsonrpc: '2.0', method, params })
      : JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params });
  const res = await fetch(URL, { method: 'POST', headers, body });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  if (method === 'notifications/initialized') return null;
  const text = await res.text();
  const parsed = parseSseOrJson(text);
  if (parsed.error) throw new Error(JSON.stringify(parsed.error));
  return parsed.result;
}

async function callTool(name, args = {}) {
  const result = await rpc('tools/call', { name, arguments: args });
  const content = result?.content;
  if (Array.isArray(content)) {
    const text = content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');
    try {
      return JSON.parse(text);
    } catch {
      return { _raw: text };
    }
  }
  return result;
}

function asMemberRows(page) {
  if (!page) return [];
  if (Array.isArray(page)) return page;
  if (Array.isArray(page?.data?.users)) return page.data.users;
  if (Array.isArray(page?.users)) return page.users;
  for (const key of ['members', 'data', 'items', 'results', 'rows', 'users']) {
    if (Array.isArray(page[key])) return page[key];
  }
  if (page.data && typeof page.data === 'object') {
    for (const key of ['members', 'items', 'results', 'rows', 'users']) {
      if (Array.isArray(page.data[key])) return page.data[key];
    }
  }
  return [];
}

function sqlStr(v) {
  if (v == null) return 'null';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function normalizeEmail(v) {
  return String(v || '')
    .toLowerCase()
    .trim();
}

function pickEmail(m) {
  return (
    normalizeEmail(m.email) ||
    normalizeEmail(m.inviteEmail) ||
    normalizeEmail(m.searchAnswerEmail) ||
    normalizeEmail(m.fallbackEmail) ||
    normalizeEmail(m.user_email) ||
    normalizeEmail(m.member_email) ||
    normalizeEmail(m?.user?.email) ||
    ''
  );
}

function pickName(m) {
  return (
    m.fullName ||
    m.name ||
    m.display_name ||
    [m.firstName || m.first_name, m.lastName || m.last_name]
      .filter(Boolean)
      .join(' ') ||
    m.handle ||
    m?.user?.name ||
    null
  );
}

function pickSkoolId(m) {
  return (
    m.id ||
    m.skool_user_id ||
    m.user_id ||
    m.memberId ||
    m.member_id ||
    m?.user?.id ||
    null
  );
}

await rpc('initialize', {
  protocolVersion: '2025-03-26',
  capabilities: {},
  clientInfo: { name: 'ghl-mcp-cdp', version: '1.0' },
});
await rpc('notifications/initialized', {});

const communities = await callTool('list_communities');
writeFileSync(
  'reports/rush-communities.json',
  JSON.stringify(communities, null, 2)
);

const list = Array.isArray(communities)
  ? communities
  : communities?.communities || communities?.data || [];
if (!list.length) {
  console.error('No communities returned', communities);
  process.exit(1);
}

const preferred =
  process.env.SKOOLTOR_COMMUNITY_ID ||
  list.find((c) => /rush/i.test(c.name || c.slug || c.title || ''))?.id ||
  list[0].id ||
  list[0].community_id;

const community =
  list.find((c) => (c.id || c.community_id) === preferred) || list[0];
const communityId = community.id || community.community_id;
console.log(
  JSON.stringify(
    {
      communityId,
      name: community.name || community.title || community.slug,
      communities: list.map((c) => ({
        id: c.id || c.community_id,
        name: c.name || c.title || c.slug,
      })),
    },
    null,
    2
  )
);

const stats = await callTool('get_community_stats', { community_id: communityId });
writeFileSync('reports/rush-stats.json', JSON.stringify(stats, null, 2));

const members = [];
let cursor = undefined;
let pages = 0;
let firstPageDump = null;
while (pages < 100) {
  const args = { community_id: communityId, limit: 100 };
  if (cursor) args.cursor = cursor;
  const page = await callTool('list_all_members', args);
  pages++;
  if (!firstPageDump) {
    firstPageDump = page;
    writeFileSync(
      'reports/rush-members-page1.json',
      JSON.stringify(page, null, 2)
    );
  }
  const rows = asMemberRows(page);
  if (!rows.length) {
    console.error(
      JSON.stringify({
        empty_page: true,
        page: pages,
        keys: page && typeof page === 'object' ? Object.keys(page) : typeof page,
        sample: page,
      })
    );
    break;
  }
  members.push(...rows);
  cursor = page?.next_cursor || page?.cursor || page?.nextCursor || page?.next || null;
  if (typeof cursor === 'object') cursor = cursor?.value || cursor?.id || null;
  console.log(
    JSON.stringify({
      page: pages,
      got: rows.length,
      total: members.length,
      cursor,
    })
  );
  if (!cursor) break;
}

mkdirSync('reports', { recursive: true });
writeFileSync(
  'reports/rush-members.json',
  JSON.stringify(
    {
      communityId,
      communityName: community.name || community.title || community.slug,
      stats,
      count: members.length,
      members,
    },
    null,
    2
  )
);

const byEmail = new Map();
let noEmail = 0;
for (const m of members) {
  const email = pickEmail(m);
  if (!email) {
    noEmail++;
    continue;
  }
  const skoolId = pickSkoolId(m);
  const prev = byEmail.get(email) || {
    email,
    name: null,
    external_ids: {},
    business_units: ['rush'],
    meta: {},
  };
  prev.name = pickName(m) || prev.name;
  if (skoolId) prev.external_ids.skool_user_id = String(skoolId);
  prev.external_ids.skool_community_id = String(communityId);
  prev.business_units = ['rush'];
  prev.meta = {
    ...prev.meta,
    rush: {
      handle: m.handle || null,
      role: m.role || null,
      level: m.level ?? null,
      points: m.points ?? null,
      status: m.status || null,
      joined_at: m.joinedAt || m.joined_at || m.created_at || null,
      is_admin: !!m.isAdmin,
      member_id: m.memberId || null,
    },
  };
  byEmail.set(email, prev);
}

const people = [...byEmail.values()];
writeFileSync(
  'reports/rush-people-seed.json',
  JSON.stringify({ count: people.length, noEmail, people }, null, 2)
);

console.log(
  JSON.stringify(
    {
      members_raw: members.length,
      with_email: people.length,
      no_email: noEmail,
      dry: DRY,
      sample: people.slice(0, 3),
    },
    null,
    2
  )
);

if (DRY) process.exit(0);

// Emit SQL for MCP import (parent agent / execute_sql)
const BATCH = 150;
mkdirSync('reports/cdp-rush-sql', { recursive: true });
let n = 0;
for (let i = 0; i < people.length; i += BATCH) {
  const chunk = people.slice(i, i + BATCH);
  const payload = JSON.stringify(
    chunk.map((p) => ({
      email: p.email,
      name: p.name,
      external_ids: p.external_ids,
      business_units: p.business_units,
      offer_fit: ['comunidad'],
      lifecycle: 'activated',
      meta: p.meta,
    }))
  ).replace(/'/g, "''");

  const sql = `insert into cdp.people (
  email, name, external_ids, business_units, lifecycle, offer_fit, meta
)
select
  email,
  name,
  coalesce(external_ids, '{}'::jsonb),
  coalesce(business_units, '{}'),
  coalesce(lifecycle, 'activated'),
  coalesce(offer_fit, '{}'),
  coalesce(meta, '{}'::jsonb)
from jsonb_to_recordset('${payload}'::jsonb) as x(
  email text,
  name text,
  external_ids jsonb,
  business_units text[],
  lifecycle text,
  offer_fit text[],
  meta jsonb
)
on conflict (email) do update set
  name = coalesce(excluded.name, cdp.people.name),
  external_ids = cdp.people.external_ids || excluded.external_ids,
  business_units = (
    select array_agg(distinct u order by u)
    from unnest(cdp.people.business_units || excluded.business_units) as u
  ),
  offer_fit = (
    select coalesce(array_agg(distinct u order by u), '{}')
    from unnest(cdp.people.offer_fit || excluded.offer_fit) as u
  ),
  meta = cdp.people.meta || excluded.meta,
  updated_at = now(),
  lifecycle = case
    when cdp.people.lifecycle in ('buyer','repeat','vip','banned','churn_risk') then cdp.people.lifecycle
    else excluded.lifecycle
  end;`;

  writeFileSync(
    `reports/cdp-rush-sql/batch-${String(n).padStart(3, '0')}.sql`,
    sql
  );
  n++;
}

console.log(JSON.stringify({ sql_batches: n, dir: 'reports/cdp-rush-sql' }));
