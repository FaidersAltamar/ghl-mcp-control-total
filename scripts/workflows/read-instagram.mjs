#!/usr/bin/env node
/** Inspecciona el primer workflow de Instagram. Uso: node scripts/workflows/read-instagram.mjs */
import { loadEnv } from '../../lib/env.mjs';
import { ghlWorkflowFetch, getLocationId } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

const locationId = getLocationId();

async function main() {
  const list = await ghlWorkflowFetch(
    `/workflow/${locationId}/list?type=workflow&limit=100&offset=0`
  );
  const igWf = list.rows.find((r) => r.name && r.name.toLowerCase().includes('instagram'));
  if (!igWf) {
    console.log('No se encontró workflow de Instagram');
    return;
  }

  console.log('Workflow encontrado:', igWf.name, igWf._id, igWf.status);

  const detail = await ghlWorkflowFetch(
    `/workflow/${locationId}/${igWf._id}?includeScheduledPauseInfo=true&sessionId=test`
  );
  console.log('\n--- METADATA ---');
  console.log(
    JSON.stringify(
      {
        status: detail.status,
        version: detail.version,
        filePath: detail.filePath,
        triggersFilePath: detail.triggersFilePath,
        fileUrl: detail.fileUrl
      },
      null,
      2
    )
  );

  if (detail.fileUrl) {
    const templatesResp = await fetch(detail.fileUrl);
    const templates = await templatesResp.json();
    console.log('\n--- TEMPLATES (ACTIONS) ---');
    console.log(JSON.stringify(templates, null, 2));
  }

  const triggers = await ghlWorkflowFetch(
    `/workflow/${locationId}/trigger?workflowId=${igWf._id}`
  );
  console.log('\n--- TRIGGERS ---');
  console.log(JSON.stringify(triggers, null, 2));
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
