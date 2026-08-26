#!/usr/bin/env node
/** Resumen detallado de workflows. Uso: node scripts/workflows/summarize.mjs */
import { loadEnv } from '../../lib/env.mjs';
import { ghlWorkflowFetch, getLocationId } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

const locationId = getLocationId();

async function main() {
  const list = await ghlWorkflowFetch(
    `/workflow/${locationId}/list?type=workflow&limit=100&offset=0&sortBy=name&sortOrder=asc`
  );

  console.log('# Resumen de automatizaciones\n');
  for (const row of list.rows) {
    const detail = await ghlWorkflowFetch(
      `/workflow/${locationId}/${row._id}?includeScheduledPauseInfo=true&sessionId=test`
    );
    const triggers = await ghlWorkflowFetch(
      `/workflow/${locationId}/trigger?workflowId=${row._id}`
    );

    let templates = [];
    if (detail.fileUrl) {
      try {
        const tResp = await fetch(detail.fileUrl);
        const tData = await tResp.json();
        templates = tData.templates || [];
      } catch {
        // ignore
      }
    }

    console.log(`## ${row.name || '(sin nombre)'} (${detail.status})`);
    console.log(`- ID: ${row._id}`);
    console.log(`- Versión: ${detail.version}`);
    console.log(`- Triggers: ${triggers.length}`);
    for (const t of triggers) {
      const conditions = (t.conditions || [])
        .map((c) => `${c.field} ${c.operator} ${JSON.stringify(c.value)}`)
        .join('; ');
      console.log(
        `  - ${t.type}${conditions ? ' | ' + conditions : ''} ${t.active ? '(activo)' : '(inactivo)'}`
      );
    }
    console.log(`- Pasos: ${templates.length}`);
    for (const s of templates) {
      console.log(`  - [${s.type}] ${s.name}`);
    }
    console.log();
  }
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
