#!/usr/bin/env node
/**
 * Auditoría completa de la location GHL: qué módulos están configurados y en uso.
 * Salida: reports/ghl-audit.json (detalle) + resumen en consola.
 * Uso: node scripts/audit/full-audit.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });
const L = getLocationId();
const BASE = 'https://services.leadconnectorhq.com';
const TOKEN = process.env.GHL_PIT_TOKEN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = 'GET', body, version = '2021-07-28' } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const resp = await fetch(BASE + path, {
      method,
      headers: { Authorization: 'Bearer ' + TOKEN, Version: version, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (resp.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    const text = await resp.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: resp.status, json };
  }
  return { status: 429, json: null };
}

const out = { generatedAt: new Date().toISOString(), locationId: L, sections: {} };
const put = (k, v) => { out.sections[k] = v; };
const arr = (j, ...keys) => { for (const k of keys) if (Array.isArray(j?.[k])) return j[k]; return Array.isArray(j) ? j : []; };

// --- Location ---
{
  const r = await api(`/locations/${L}`);
  const loc = r.json?.location || {};
  put('location', { name: loc.name, timezone: loc.timezone, email: loc.email, phone: loc.phone, website: loc.website, country: loc.country });
}

// --- Contactos ---
{
  const total = await api('/contacts/search', { method: 'POST', body: { locationId: L, page: 1, pageLimit: 1 } });
  const since30 = Date.now() - 30 * 86400000;
  const recent = await api('/contacts/search', {
    method: 'POST',
    body: { locationId: L, page: 1, pageLimit: 1, filters: [{ field: 'dateAdded', operator: 'range', value: { gt: new Date(since30).toISOString(), lt: new Date().toISOString() } }] },
  });
  put('contacts', { total: total.json?.total ?? null, last30d: recent.json?.total ?? null });
}

// --- Tags y campos ---
{
  const tags = arr((await api(`/locations/${L}/tags`)).json, 'tags');
  const fields = arr((await api(`/locations/${L}/customFields`)).json, 'customFields');
  const values = arr((await api(`/locations/${L}/customValues`)).json, 'customValues');
  put('tags', { count: tags.length, names: tags.map((t) => t.name) });
  put('customFields', { count: fields.length, names: fields.map((f) => `${f.name} [${f.dataType}]`) });
  put('customValues', { count: values.length, names: values.map((v) => v.name) });
}

// --- Usuarios ---
{
  const users = arr((await api(`/users/?locationId=${L}`)).json, 'users');
  put('users', { count: users.length, list: users.map((u) => ({ name: u.name, role: u.roles?.role, type: u.roles?.type })) });
}

// --- Pipelines y oportunidades ---
{
  const pipes = arr((await api(`/opportunities/pipelines?locationId=${L}`)).json, 'pipelines');
  const pl = [];
  for (const p of pipes) {
    const o = await api('/opportunities/search?' + new URLSearchParams({ location_id: L, pipeline_id: p.id, limit: '1' }));
    const open = await api('/opportunities/search?' + new URLSearchParams({ location_id: L, pipeline_id: p.id, status: 'open', limit: '1' }));
    pl.push({ name: p.name, stages: (p.stages || []).map((s) => s.name), opportunities: o.json?.meta?.total ?? null, open: open.json?.meta?.total ?? null });
  }
  const all = await api('/opportunities/search?' + new URLSearchParams({ location_id: L, limit: '1' }));
  put('pipelines', { count: pipes.length, totalOpportunities: all.json?.meta?.total ?? null, list: pl });
}

// --- Calendarios ---
{
  const cals = arr((await api(`/calendars/?locationId=${L}`)).json, 'calendars');
  const list = [];
  const s = Date.now() - 30 * 86400000, e = Date.now() + 30 * 86400000;
  for (const c of cals) {
    const ev = arr((await api(`/calendars/events?locationId=${L}&calendarId=${c.id}&startTime=${s}&endTime=${e}`)).json, 'events');
    list.push({ name: c.name, active: c.isActive, type: c.calendarType, events60d: ev.length, confirmed: ev.filter((x) => x.appointmentStatus === 'confirmed').length, noshow: ev.filter((x) => x.appointmentStatus === 'noshow').length, showed: ev.filter((x) => x.appointmentStatus === 'showed').length });
  }
  put('calendars', { count: cals.length, active: cals.filter((c) => c.isActive).length, list });
}

// --- Formularios y encuestas ---
{
  const forms = arr((await api(`/forms/?locationId=${L}&limit=100`)).json, 'forms');
  const fsub = await api(`/forms/submissions?locationId=${L}&limit=1&page=1`);
  const surveys = arr((await api(`/surveys/?locationId=${L}&limit=100`)).json, 'surveys');
  const ssub = await api(`/surveys/submissions?locationId=${L}&limit=1&page=1`);
  put('forms', { count: forms.length, names: forms.map((f) => f.name), submissionsTotal: fsub.json?.meta?.total ?? null });
  put('surveys', { count: surveys.length, names: surveys.map((f) => f.name), submissionsTotal: ssub.json?.meta?.total ?? null });
}

// --- Funnels y sitios ---
{
  const funnels = arr((await api(`/funnels/funnel/list?locationId=${L}&limit=100`)).json, 'funnels');
  const list = funnels.map((f) => ({ name: f.name, type: f.type, steps: (f.steps || []).length, domain: f.domainURL || f.url || '', updatedAt: f.updatedAt }));
  put('funnels', { count: funnels.length, list });
}

// --- Productos y pagos ---
{
  const prods = arr((await api(`/products/?locationId=${L}&limit=100&offset=0`)).json, 'products');
  const tx = await api(`/payments/transactions?altId=${L}&altType=location&limit=100&offset=0`);
  const txs = arr(tx.json, 'data');
  const since30 = Date.now() - 30 * 86400000;
  const t30 = txs.filter((t) => new Date(t.createdAt).getTime() >= since30 && t.status === 'succeeded');
  const orders = await api(`/payments/orders?altId=${L}&altType=location&limit=1&offset=0`);
  const subs = await api(`/payments/subscriptions?altId=${L}&altType=location&limit=1&offset=0`);
  const coupons = await api(`/payments/coupon/list?altId=${L}&altType=location&limit=100&offset=0`);
  const integ = await api(`/payments/integrations/provider/whitelabel?altId=${L}&altType=location`);
  put('payments', {
    products: prods.length,
    productNames: prods.map((p) => p.name),
    transactionsTotal: tx.json?.totalCount ?? txs.length,
    last30dSucceeded: t30.length,
    last30dAmount: Math.round(t30.reduce((a, t) => a + (t.amount || 0), 0) * 100) / 100,
    currency: t30[0]?.currency || txs[0]?.currency || '',
    ordersTotal: orders.json?.totalCount ?? null,
    subscriptionsTotal: subs.json?.totalCount ?? null,
    coupons: arr(coupons.json, 'data').length,
    paymentProvidersStatus: integ.status,
  });
}

// --- Workflows (API interna: incluye estado y tipo de trigger) ---
{
  let wfs = [];
  try {
    const r = await ghlWorkflowFetch(`/workflow/${L}/list?parentId=root&limit=200&offset=0&sortBy=name&sortOrder=asc&includeCustomObjects=true&includeObjectiveBuilder=true`);
    wfs = r.rows || r.workflows || r.data || [];
  } catch {
    wfs = arr((await api(`/workflows/?locationId=${L}`)).json, 'workflows');
  }
  const list = wfs.filter((w) => w.type !== 'directory').map((w) => ({ name: w.name, status: w.status }));
  put('workflows', { count: list.length, published: list.filter((w) => w.status === 'published').length, list });
}

// --- Email ---
{
  const tpl = await api(`/emails/builder?locationId=${L}&limit=100&offset=0`);
  const camp = await api(`/emails/schedule?locationId=${L}&limit=100&offset=0`);
  const templates = arr(tpl.json, 'builders', 'templates', 'data');
  const campaigns = arr(camp.json, 'schedules', 'campaigns', 'data');
  put('email', { templates: templates.length, campaigns: campaigns.length, templateNames: templates.map((t) => t.name).slice(0, 30) });
}

// --- Canales ---
{
  const phones = await api(`/phone-system/numbers?locationId=${L}`);
  const social = await api(`/social-media-posting/${L}/accounts`);
  const convUnread = await api(`/conversations/search?locationId=${L}&status=unread&limit=1`);
  const convAll = await api(`/conversations/search?locationId=${L}&limit=1`);
  const accs = social.json?.results?.accounts || social.json?.accounts || [];
  put('channels', {
    phoneNumbers: arr(phones.json, 'numbers', 'phoneNumbers').length,
    socialAccounts: accs.map((a) => `${a.platform}:${a.name}`),
    conversationsTotal: convAll.json?.total ?? null,
    conversationsUnread: convUnread.json?.total ?? null,
  });
}

// --- IA, trigger links, cursos/comunidades, afiliados, reputación ---
{
  const kb = await api(`/knowledge-bases/?locationId=${L}&limit=50`);
  const agents = await api(`/agent-studio/agent?locationId=${L}&limit=50&offset=0`);
  const voice = await api(`/voice-ai/agents?locationId=${L}`);
  const links = await api(`/links/?locationId=${L}`);
  const aff = await api(`/affiliate-manager/${L}/affiliates?limit=10&skip=0`);
  const blogs = await api(`/blogs/site/all?locationId=${L}&limit=10&skip=0`);
  const objects = await api(`/objects/?locationId=${L}`);
  const docs = await api(`/proposals/document?locationId=${L}&limit=10&skip=0`);
  put('extras', {
    knowledgeBases: arr(kb.json, 'knowledgeBases', 'data').length,
    agentStudioAgents: arr(agents.json, 'agents', 'data').length,
    voiceAgents: arr(voice.json, 'agents', 'data').length,
    triggerLinks: arr(links.json, 'links').length,
    affiliates: arr(aff.json, 'affiliates', 'data').length,
    blogs: arr(blogs.json, 'data', 'blogs').length,
    customObjects: arr(objects.json, 'objects').length,
    proposals: arr(docs.json, 'documents', 'data').length,
  });
}

mkdirSync('reports', { recursive: true });
writeFileSync('reports/ghl-audit.json', JSON.stringify(out, null, 2));

// Resumen en consola
const s = out.sections;
console.log(JSON.stringify({
  location: s.location,
  contacts: s.contacts,
  tags: s.tags.count, customFields: s.customFields.count, customValues: s.customValues.count,
  users: s.users,
  pipelines: s.pipelines,
  calendars: { count: s.calendars.count, active: s.calendars.active, withEvents: s.calendars.list.filter((c) => c.events60d) },
  forms: s.forms, surveys: s.surveys,
  funnels: s.funnels,
  payments: s.payments,
  workflows: { count: s.workflows.count, published: s.workflows.published, publishedList: s.workflows.list.filter((w) => w.status === 'published').map((w) => w.name) },
  email: s.email,
  channels: s.channels,
  extras: s.extras,
}, null, 2));
