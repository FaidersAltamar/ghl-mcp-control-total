// Build a clean, Claude-friendly catalog of GHL workflow primitives.
//
// Input:  docs/recon-samples/cat-assets.json (captured from the live API)
// Output: catalog/ghl-workflow-catalog.json   (single source of truth, indexed by key)
//         catalog/ghl-workflow-catalog.md     (human-readable index)
//         catalog/actions.json                (just actions, indexed by key)
//         catalog/triggers.json               (just triggers, indexed by key)
//
// Strips noise (Mongo _ids, timestamps, tenant arrays, internal billing fields)
// and normalizes the input/filter schema so every action looks the same.
//
// Usage:  node scripts/build-catalog.js

const fs = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, '..', 'docs', 'recon-samples', 'cat-assets.json');
const OUTDIR = path.join(__dirname, '..', 'catalog');

function normalizeInput(f) {
  // Field schema → only the useful parts.
  const out = {
    field: f.field,
    label: f.title,
    type: f.fieldType
  };
  if (f.required) out.required = true;
  if (f.placeholder) out.placeholder = f.placeholder;
  if (f.value !== undefined && f.value !== '' && f.value !== null) out.default = f.value;
  if (Array.isArray(f.options) && f.options.length) {
    out.options = f.options.map(o => ({ label: o.label, value: o.value }));
  }
  if (f.mappedTo) out.mappedTo = f.mappedTo; // hints e.g. USERS, TAGS, CALENDARS
  if (f.dynamicFieldsConfig) {
    out.dynamicFrom = {
      service: f.dynamicFieldsConfig.serviceName,
      route: f.dynamicFieldsConfig.route
    };
  }
  if (Array.isArray(f.validations) && f.validations.length) {
    out.validations = f.validations;
  }
  if (f.altersDynamicField) out.altersDynamicField = true;
  if (f.allowCustomInputPicker) out.allowCustomInputPicker = true;
  // Drop: eventListeners, resetValue, sortOptions, internal Vue props.
  return out;
}

function normalizeAction(a, appName) {
  const info = a.info || {};
  const out = {
    key: a.key,
    name: info.name || a.key,
    app: appName,
    description: info.description || info.summary || null,
    icon: info.icon || null,
    executionType: a.workflowsActionType || null,
    inputs: Array.isArray(a.inputs) ? a.inputs.map(normalizeInput) : []
  };
  if (Array.isArray(a.customVars) && a.customVars.length) out.customVars = a.customVars;
  if (a.saveResponse) out.saveResponse = true;
  if (a.waitForReply) out.waitForReply = true;
  if (a.customVarPrefix) out.customVarPrefix = a.customVarPrefix;
  if (a.section) out.section = a.section;
  if (a.isHidden) out.isHidden = true;
  return out;
}

function normalizeTrigger(t, appName) {
  const info = t.info || {};
  const out = {
    key: t.key,
    name: info.name || t.key,
    app: appName,
    description: info.description || info.summary || null,
    icon: info.icon || null,
    type: t.workflowsTriggerType || null,
    filters: Array.isArray(t.filters) ? t.filters.map(normalizeInput) : []
  };
  if (t.customVarPrefix) out.customVarPrefix = t.customVarPrefix;
  if (Array.isArray(t.internalCustomVariablesMapping) && t.internalCustomVariablesMapping.length) {
    out.contextVariables = t.internalCustomVariablesMapping;
  }
  return out;
}

function build() {
  if (!fs.existsSync(INPUT)) {
    console.error('Missing input:', INPUT);
    console.error('Run scripts/dump-primitives-catalog.js in your browser first, then');
    console.error('move the downloaded ghl-primitives-catalog-*.json content into');
    console.error('docs/recon-samples/cat-assets.json (or update the path above).');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

  const actions = {};
  const triggers = {};
  const appStatsA = {}; // app -> count
  const appStatsT = {};

  for (const group of (raw.actions || [])) {
    const appName = group.appName || 'unknown';
    appStatsA[appName] = 0;
    for (const a of (group.actions || [])) {
      if (!a.key) continue;
      const n = normalizeAction(a, appName);
      if (actions[n.key]) {
        // Duplicate key — disambiguate with app suffix
        actions[`${n.key}__${appName}`] = n;
      } else {
        actions[n.key] = n;
      }
      appStatsA[appName]++;
    }
  }
  for (const group of (raw.triggers || [])) {
    const appName = group.appName || 'unknown';
    appStatsT[appName] = 0;
    for (const t of (group.triggers || [])) {
      if (!t.key) continue;
      const n = normalizeTrigger(t, appName);
      if (triggers[n.key]) {
        triggers[`${n.key}__${appName}`] = n;
      } else {
        triggers[n.key] = n;
      }
      appStatsT[appName]++;
    }
  }

  const stats = {
    actionTypes: Object.keys(actions).length,
    triggerTypes: Object.keys(triggers).length,
    actionApps: Object.keys(appStatsA).length,
    triggerApps: Object.keys(appStatsT).length,
    perApp: { actions: appStatsA, triggers: appStatsT }
  };

  const catalog = {
    $schema: 'ghl-workflow-catalog/v1',
    capturedAt: new Date().toISOString(),
    description: 'GHL workflow primitives catalog. Use this as reference when generating or validating workflows. Each entry is keyed by its workflow `type` field (the value that appears in workflowData.templates[].type for actions, or trigger.type for triggers).',
    stats,
    actions,
    triggers
  };

  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, 'ghl-workflow-catalog.json'), JSON.stringify(catalog, null, 2));
  fs.writeFileSync(path.join(OUTDIR, 'actions.json'), JSON.stringify({ stats: appStatsA, actions }, null, 2));
  fs.writeFileSync(path.join(OUTDIR, 'triggers.json'), JSON.stringify({ stats: appStatsT, triggers }, null, 2));

  // Markdown index
  const md = [];
  md.push('# GHL Workflow Catalog');
  md.push('');
  md.push(`Captured: ${catalog.capturedAt.slice(0, 10)} · ${stats.actionTypes} action types · ${stats.triggerTypes} trigger types`);
  md.push('');
  md.push('Use `catalog/ghl-workflow-catalog.json` as input when generating workflows with Claude.');
  md.push('');
  md.push('---');
  md.push('');
  md.push('## Actions by app');
  md.push('');
  for (const app of Object.keys(appStatsA).sort()) {
    md.push(`### ${app} (${appStatsA[app]})`);
    const items = Object.values(actions).filter(a => a.app === app);
    for (const a of items) {
      const desc = a.description ? ` — ${a.description.replace(/\n/g, ' ').substring(0, 100)}` : '';
      md.push(`- \`${a.key}\` · **${a.name}**${desc}`);
    }
    md.push('');
  }
  md.push('## Triggers by app');
  md.push('');
  for (const app of Object.keys(appStatsT).sort()) {
    md.push(`### ${app} (${appStatsT[app]})`);
    const items = Object.values(triggers).filter(t => t.app === app);
    for (const t of items) {
      const desc = t.description ? ` — ${t.description.replace(/\n/g, ' ').substring(0, 100)}` : '';
      md.push(`- \`${t.key}\` · **${t.name}**${desc}`);
    }
    md.push('');
  }
  fs.writeFileSync(path.join(OUTDIR, 'ghl-workflow-catalog.md'), md.join('\n'));

  // README inside catalog/
  const readme = `# GHL workflow primitives catalog

Generated by \`scripts/build-catalog.js\` from a live capture of the GHL
\`/workflows-marketplace/location/{locId}/assets\` endpoint.

## Files

| File | Purpose |
|---|---|
| \`ghl-workflow-catalog.json\` | **Master reference.** Single JSON containing all actions and triggers, indexed by their \`key\` (the workflow \`type\` value). Hand this to Claude when asking it to generate workflows. |
| \`ghl-workflow-catalog.md\` | Human-readable index, grouped by app, one line per primitive. Browse with your eyes. |
| \`actions.json\` | Subset with only actions, same shape. |
| \`triggers.json\` | Subset with only triggers, same shape. |

## Schema (per action)

\`\`\`json
{
  "key": "add_contact_tag",
  "name": "Add Contact Tag",
  "app": "contact",
  "description": "...",
  "icon": "fa-tag",
  "executionType": "INTERNAL",
  "inputs": [
    { "field": "tags", "label": "Tags", "type": "tag_input", "required": true,
      "options": [ ... ], "default": ..., "mappedTo": "TAGS",
      "dynamicFrom": { "service": "...", "route": "..." } }
  ]
}
\`\`\`

## Schema (per trigger)

\`\`\`json
{
  "key": "contact_created",
  "name": "Contact Created",
  "app": "contact",
  "description": "...",
  "type": "INTERNAL",
  "filters": [ { "field": "...", "label": "...", "type": "...", "required": ... } ],
  "contextVariables": ["CONTACT"]
}
\`\`\`

## Rebuild

\`\`\`bash
node scripts/build-catalog.js
\`\`\`

Re-capture the source data with the browser console script at
\`scripts/dump-primitives-catalog.js\`, then put the contents of the
\`assets\` field into \`docs/recon-samples/cat-assets.json\` and rerun.
`;
  fs.writeFileSync(path.join(OUTDIR, 'README.md'), readme);

  console.log('✓ Wrote', path.join(OUTDIR, 'ghl-workflow-catalog.json'));
  console.log('✓ Wrote', path.join(OUTDIR, 'ghl-workflow-catalog.md'));
  console.log('✓ Wrote', path.join(OUTDIR, 'actions.json'));
  console.log('✓ Wrote', path.join(OUTDIR, 'triggers.json'));
  console.log('✓ Wrote', path.join(OUTDIR, 'README.md'));
  console.log('');
  console.log(`Stats: ${stats.actionTypes} actions across ${stats.actionApps} apps · ${stats.triggerTypes} triggers across ${stats.triggerApps} apps`);
}

build();
