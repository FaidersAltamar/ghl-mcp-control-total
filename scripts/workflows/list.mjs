#!/usr/bin/env node
/** Lista workflows activos y draft. Uso: node scripts/workflows/list.mjs */
import { loadEnv } from '../../lib/env.mjs';
import { ghlWorkflowFetch, getLocationId } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

const locationId = getLocationId();
if (!locationId) {
  console.error('ERROR: GHL_LOCATION_ID is not set in .env');
  process.exit(1);
}

async function main() {
  const list = await ghlWorkflowFetch(
    `/workflow/${locationId}/list?type=workflow&limit=100&offset=0`
  );

  const workflows = [];

  for (const row of list.rows) {
    try {
      const detail = await ghlWorkflowFetch(
        `/workflow/${locationId}/${row._id}?includeScheduledPauseInfo=true&sessionId=test`
      );
      workflows.push({
        name: row.name || '(sin nombre)',
        id: row._id,
        status: detail.status,
        version: detail.version,
        updatedAt: row.updatedAt
      });
    } catch (e) {
      workflows.push({
        name: row.name || '(sin nombre)',
        id: row._id,
        status: 'unknown',
        error: e.message
      });
    }
  }

  const active = workflows.filter((w) => w.status === 'published');
  const draft = workflows.filter((w) => w.status === 'draft');

  console.log(`\n=== Workflows encontrados: ${workflows.length} ===\n`);
  console.log(`Activos (published): ${active.length}`);
  for (const w of active) {
    console.log(`  ✅ ${w.name} (id: ${w.id})`);
  }

  console.log(`\nDraft / inactivos: ${draft.length}`);
  for (const w of draft) {
    console.log(`  📝 ${w.name} (id: ${w.id})`);
  }

  if (workflows.some((w) => w.status !== 'published' && w.status !== 'draft')) {
    console.log('\nOtros estados:');
    for (const w of workflows.filter(
      (w) => w.status !== 'published' && w.status !== 'draft'
    )) {
      console.log(`  ❓ ${w.name} → ${w.status}`);
    }
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
