// Parse the internal action registry extracted from the GHL workflows SPA bundle
// and merge it into catalog/internal-action-examples.json so the master catalog
// covers the truly-internal builder primitives (if_else, wait, drip, etc.) which
// are NOT served by the /workflows-marketplace/assets endpoint.
//
// Input:  docs/recon-samples/bundle-cache/_registry_full.js  (the registry slice)
// Output: catalog/internal-actions-from-bundle.json
// Also rebuilds: catalog/ghl-workflow-catalog.json (merged via build-catalog.js)
//
// Usage: node scripts/extract-internal-actions.js

const fs = require('fs');
const path = require('path');

const SLICE = path.join(__dirname, '..', 'docs', 'recon-samples', 'bundle-cache', '_registry_full.js');
const OUT = path.join(__dirname, '..', 'catalog', 'internal-actions-from-bundle.json');

const raw = fs.readFileSync(SLICE, 'utf8');

// --- Step 1: replace identifier references with string equivalents ---

// Known constants from the bundle:
const CONST_MAP = {
  'MULTI_PATH': '"multi-path"',
  'CONVERSATION_AI': '"conversation_ai"',
  'FB_INTERACTIVE_MESSENGER': '"fb_interactive_messenger"',
  'IG_INTERACTIVE_MESSENGER': '"ig_interactive_messenger"',
  'CustomObjectActionTypes.CREATE': '"create_custom_object"',
  'CustomObjectActionTypes.UPDATE': '"update_custom_object"',
  'CustomObjectActionTypes.CLEAR_FIELDS': '"clear_custom_object_fields"'
};

let src = raw;
for (const [k, v] of Object.entries(CONST_MAP)) {
  src = src.split(k).join(v);
}

// --- Step 2: stub validator references with null ---
// Pattern: validation:{code:foo Validator} → validation:{code:null}
// Pattern: validation:{errorMessage:"",code:foo Validator} → validation:{errorMessage:"",code:null}
src = src.replace(/code:\s*[A-Za-z_][A-Za-z0-9_]*Validator/g, 'code:null');

// --- Step 3: replace `!0` and `!1` (minified true/false) ---
src = src.replace(/!0/g, 'true').replace(/!1/g, 'false');

// --- Step 4: evaluate via Function ---
let registry;
try {
  registry = new Function('return ' + src)();
} catch (e) {
  console.error('Failed to parse registry:', e.message);
  // Save what we have for inspection
  fs.writeFileSync(SLICE.replace('_full.js', '_resolved.js'), src);
  console.error('Wrote partially-resolved version to _registry_resolved.js for inspection.');
  process.exit(1);
}

// --- Step 5: normalize entries ---
function normalize(entry, sectionName) {
  return {
    key: entry.type,
    name: entry.name && entry.name.startsWith('workflow.') ? null : entry.name, // workflow.* keys are i18n IDs, not human labels
    nameI18nKey: entry.name && entry.name.startsWith('workflow.') ? entry.name : null,
    app: entry.category || sectionName,
    section: sectionName,
    cat: entry.cat,
    color: entry.color || null,
    icon: entry.icon || null,
    keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
    isPremium: !!entry.isPremiumAction,
    isBeta: !!entry.beta,
    disabled: !!entry.disabled,
    labsKey: entry.labsKey || null,
    inputs: null, // not in the bundle registry; defined by the Vue config component per type
    source: 'bundle:index-DrASS8UJ.js'
  };
}

const flat = {};
for (const [section, entries] of Object.entries(registry)) {
  if (!Array.isArray(entries)) continue;
  for (const e of entries) {
    if (!e || !e.type) continue;
    flat[e.type] = normalize(e, section);
  }
}

const out = {
  $schema: 'ghl-internal-actions/v1',
  extractedFrom: 'client-app-automation-workflows.leadconnectorhq.com bundle (assets/index-DrASS8UJ.js)',
  note: 'These are the builder primitives that are NOT served by /workflows-marketplace/assets. Field inputs is null here because each type has a bespoke Vue config component that defines its own form. Use this list to know WHICH internal types exist; cross-reference with real workflow exports to learn the attributes shape per type.',
  count: Object.keys(flat).length,
  actions: flat
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

console.log('Extracted', out.count, 'internal actions from bundle registry.');
console.log('Categories:');
const byCat = {};
for (const a of Object.values(flat)) {
  const c = a.section;
  byCat[c] = (byCat[c] || 0) + 1;
}
for (const c of Object.keys(byCat).sort()) console.log('  ' + c + ': ' + byCat[c]);
console.log('Wrote:', OUT);
