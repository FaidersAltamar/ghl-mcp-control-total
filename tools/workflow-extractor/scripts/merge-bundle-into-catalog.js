// Merge the internal action + trigger registries extracted from the SPA bundle
// into the existing catalog produced by build-catalog.js.
//
// Inputs:
//   catalog/ghl-workflow-catalog.json      (from assets endpoint, missing internals)
//   docs/recon-samples/bundle-cache/_registry_full.js   (internal actions)
//   docs/recon-samples/bundle-cache/_triggers_registry.js (internal triggers)
//   docs/recon-samples/ghl-workflow-detail.json + autosave-with-action.json
//     (real-world examples of internal action `attributes` shapes)
//
// Output:
//   catalog/ghl-workflow-catalog.json   (with internals merged in, marked as source:bundle)
//   catalog/ghl-workflow-catalog.md     (regenerated index)
//
// Usage: node scripts/merge-bundle-into-catalog.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'catalog', 'ghl-workflow-catalog.json');
const MD_PATH = path.join(ROOT, 'catalog', 'ghl-workflow-catalog.md');
const ACTIONS_JSON = path.join(ROOT, 'catalog', 'actions.json');
const TRIGGERS_JSON = path.join(ROOT, 'catalog', 'triggers.json');
const ACTIONS_SLICE = path.join(ROOT, 'docs', 'recon-samples', 'bundle-cache', '_registry_full.js');
const TRIGGERS_SLICE = path.join(ROOT, 'docs', 'recon-samples', 'bundle-cache', '_triggers_registry.js');

// --- Parse actions registry from the bundle slice ---

function parseActionsRegistry(slice) {
  // Same stubbing pattern as extract-internal-actions.js
  const CONST_MAP = {
    'MULTI_PATH': '"multi-path"',
    'CONVERSATION_AI': '"conversation_ai"',
    'FB_INTERACTIVE_MESSENGER': '"fb_interactive_messenger"',
    'IG_INTERACTIVE_MESSENGER': '"ig_interactive_messenger"',
    'CustomObjectActionTypes.CREATE': '"create_custom_object"',
    'CustomObjectActionTypes.UPDATE': '"update_custom_object"',
    'CustomObjectActionTypes.CLEAR_FIELDS': '"clear_custom_object_fields"'
  };
  let src = slice;
  for (const [k, v] of Object.entries(CONST_MAP)) src = src.split(k).join(v);
  src = src.replace(/code:\s*[A-Za-z_][A-Za-z0-9_]*Validator/g, 'code:null');
  src = src.replace(/!0/g, 'true').replace(/!1/g, 'false');
  return new Function('return ' + src)();
}

// --- Parse triggers registry from bundle slice ---

function parseTriggersRegistry(slice) {
  const entries = [];
  let i = 1; // skip outer [
  while (i < slice.length) {
    if (slice[i] !== '{') { i++; continue; }
    let depth = 1, j = i + 1;
    while (j < slice.length && depth > 0) {
      const c = slice[j];
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') depth--;
      j++;
    }
    const block = slice.substring(i, j);
    const oIdx = block.indexOf('options:[');
    if (oIdx !== -1) {
      const optStart = oIdx + 'options:['.length;
      let d = 1, e = optStart;
      while (e < block.length && d > 0) {
        if (block[e] === '[' || block[e] === '{') d++;
        else if (block[e] === ']' || block[e] === '}') d--;
        e++;
      }
      const opts = block.substring(optStart, e - 1);
      let od = 0, os = -1;
      for (let k = 0; k < opts.length; k++) {
        const c = opts[k];
        if (c === '{') { if (od === 0) os = k; od++; }
        else if (c === '}') { od--; if (od === 0 && os !== -1) { entries.push(opts.substring(os, k + 1)); os = -1; } }
        else if (c === '[') od++;
        else if (c === ']') od--;
      }
    }
    i = j;
  }

  const matchers = {
    title: /title:"([^"]+)"/,
    description: /description:"([^"]+)"/,
    value: /value:"([^"]+)"/,
    icon: /icon:"([^"]+)"/,
    color: /color:"([^"]*)"/,
    category: /category:"([^"]*)"/,
    labsKey: /labsKey:"([^"]+)"/
  };
  return entries.map(o => {
    const f = {};
    for (const [k, re] of Object.entries(matchers)) {
      const m = o.match(re);
      if (m) f[k] = m[1];
    }
    return f;
  }).filter(e => e.value);
}

// --- Extract real-world `attributes` examples from captured workflows ---

function extractAttributesExamples() {
  const dir = path.join(ROOT, 'docs', 'recon-samples');
  const examples = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    let raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (_) { continue; }
    function scan(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(scan); return; }
      if (typeof obj.type === 'string' && obj.attributes && typeof obj.attributes === 'object') {
        if (!examples[obj.type]) examples[obj.type] = { name: obj.name, attributes: obj.attributes };
      }
      for (const k of Object.keys(obj)) scan(obj[k]);
    }
    scan(raw);
  }
  return examples;
}

// --- Load existing catalog ---

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const beforeActions = Object.keys(catalog.actions).length;
const beforeTriggers = Object.keys(catalog.triggers).length;

// --- Parse and merge actions ---

const actionsSlice = fs.readFileSync(ACTIONS_SLICE, 'utf8');
const actionsRegistry = parseActionsRegistry(actionsSlice);
const examples = extractAttributesExamples();

let addedActions = 0;
for (const [section, entries] of Object.entries(actionsRegistry)) {
  if (!Array.isArray(entries)) continue;
  for (const e of entries) {
    if (!e || !e.type) continue;
    if (catalog.actions[e.type]) continue; // already in catalog from assets endpoint
    const example = examples[e.type];
    catalog.actions[e.type] = {
      key: e.type,
      name: e.name && e.name.startsWith('workflow.') ? humanizeKey(e.type) : e.name,
      nameI18nKey: e.name && e.name.startsWith('workflow.') ? e.name : null,
      app: e.category || section,
      description: null,
      icon: e.icon || null,
      executionType: null,
      inputs: [],
      _bundleMeta: {
        cat: e.cat,
        color: e.color || null,
        keywords: e.keywords || [],
        isPremium: !!e.isPremiumAction,
        isBeta: !!e.beta,
        disabled: !!e.disabled,
        labsKey: e.labsKey || null
      },
      source: 'spa-bundle',
      example: example ? { name: example.name, attributes: example.attributes } : null
    };
    addedActions++;
  }
}

// --- Parse and merge triggers ---

const triggersSlice = fs.readFileSync(TRIGGERS_SLICE, 'utf8');
const triggerEntries = parseTriggersRegistry(triggersSlice);
let addedTriggers = 0;
for (const e of triggerEntries) {
  if (catalog.triggers[e.value]) continue;
  catalog.triggers[e.value] = {
    key: e.value,
    name: humanizeKey(e.title || e.value),
    nameI18nKey: e.title || null,
    descriptionI18nKey: e.description || null,
    app: e.category || null,
    description: null,
    icon: e.icon || null,
    type: null,
    filters: [],
    _bundleMeta: {
      color: e.color || null,
      labsKey: e.labsKey || null
    },
    source: 'spa-bundle'
  };
  addedTriggers++;
}

// --- Refresh stats ---

const appStatsA = {};
const appStatsT = {};
for (const a of Object.values(catalog.actions)) appStatsA[a.app] = (appStatsA[a.app] || 0) + 1;
for (const t of Object.values(catalog.triggers)) appStatsT[t.app] = (appStatsT[t.app] || 0) + 1;

catalog.stats = {
  actionTypes: Object.keys(catalog.actions).length,
  triggerTypes: Object.keys(catalog.triggers).length,
  actionApps: Object.keys(appStatsA).length,
  triggerApps: Object.keys(appStatsT).length,
  perApp: { actions: appStatsA, triggers: appStatsT }
};
catalog.lastMergedAt = new Date().toISOString();
catalog.sources = {
  marketplaceAssets: 'GET /workflows-marketplace/location/{locId}/assets — most app integrations (Linear, Asana, etc.) and some native actions/triggers',
  spaBundle: 'client-app-automation-workflows SPA bundle (assets/index-DrASS8UJ.js) — builder primitives (If/Else, Wait, Drip, Webhook, ...) and core triggers (opportunity, shopify, courses, IVR, ...)'
};

// --- Write outputs ---

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
fs.writeFileSync(ACTIONS_JSON, JSON.stringify({ stats: appStatsA, actions: catalog.actions }, null, 2));
fs.writeFileSync(TRIGGERS_JSON, JSON.stringify({ stats: appStatsT, triggers: catalog.triggers }, null, 2));

// Rebuild markdown index
const md = [];
md.push('# GHL Workflow Catalog');
md.push('');
md.push(`Captured: ${catalog.capturedAt ? catalog.capturedAt.slice(0, 10) : '—'} · merged: ${catalog.lastMergedAt.slice(0, 10)}`);
md.push(`${catalog.stats.actionTypes} action types · ${catalog.stats.triggerTypes} trigger types`);
md.push('');
md.push('Sources:');
md.push('- **Marketplace assets**: third-party integrations + some native (richest input schemas).');
md.push('- **SPA bundle**: builder primitives + core triggers (icons + categories; `inputs[]` empty because each type uses a bespoke Vue config component).');
md.push('');
md.push('Entries marked `(bundle)` come from the SPA bundle and have `inputs: []`. To learn their `attributes` shape, see `example` on each entry or export real workflows that use them.');
md.push('');
md.push('---');
md.push('');
md.push('## Actions by app');
md.push('');
for (const app of Object.keys(appStatsA).sort()) {
  md.push(`### ${app} (${appStatsA[app]})`);
  const items = Object.values(catalog.actions).filter(a => a.app === app);
  for (const a of items) {
    const tag = a.source === 'spa-bundle' ? ' _(bundle)_' : '';
    const desc = a.description ? ` — ${a.description.replace(/\n/g, ' ').substring(0, 100)}` : '';
    md.push(`- \`${a.key}\` · **${a.name}**${tag}${desc}`);
  }
  md.push('');
}
md.push('## Triggers by app');
md.push('');
for (const app of Object.keys(appStatsT).sort()) {
  md.push(`### ${app} (${appStatsT[app]})`);
  const items = Object.values(catalog.triggers).filter(t => t.app === app);
  for (const t of items) {
    const tag = t.source === 'spa-bundle' ? ' _(bundle)_' : '';
    const desc = t.description ? ` — ${t.description.replace(/\n/g, ' ').substring(0, 100)}` : '';
    md.push(`- \`${t.key}\` · **${t.name}**${tag}${desc}`);
  }
  md.push('');
}
fs.writeFileSync(MD_PATH, md.join('\n'));

console.log('Merged.');
console.log('  Actions:  ' + beforeActions + ' → ' + catalog.stats.actionTypes + ' (+' + addedActions + ' from bundle)');
console.log('  Triggers: ' + beforeTriggers + ' → ' + catalog.stats.triggerTypes + ' (+' + addedTriggers + ' from bundle)');
console.log('  Action apps:  ' + catalog.stats.actionApps);
console.log('  Trigger apps: ' + catalog.stats.triggerApps);

function humanizeKey(s) {
  if (!s) return s;
  if (s.startsWith('workflow.')) {
    // Try to extract last segment
    const parts = s.split('.');
    return parts[parts.length - 1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
