import { loadEnv } from '../../lib/env.mjs';
import { getContact, setContactCustomField } from '../../bridge/lib/ghl.js';

loadEnv({ required: true });

const FIELD_ID = 'h9iYCwBTvvaxSLvTqYBu';
const ids = ['OfxvpHjgAQbrIUBc480m']; // Faiders Altamar (owner)

for (const id of ids) {
  const c = await getContact(id);
  const cf = (c.customFields || []).find((f) => f.id === FIELD_ID);
  let memory = { resumen: '', reciente: [], handover: {} };
  if (cf && (cf.value || cf.field_value)) {
    try {
      const parsed = JSON.parse(cf.value || cf.field_value);
      if (Array.isArray(parsed)) {
        memory = { resumen: '', reciente: parsed, handover: {} };
      } else {
        memory = {
          resumen: parsed.resumen || '',
          reciente: parsed.reciente || [],
          handover: {}, // reset handover state
        };
      }
    } catch { /* invalid */ }
  }
  await setContactCustomField(id, FIELD_ID, JSON.stringify(memory));
  console.log('reset handover ->', id, [c.firstName, c.lastName].filter(Boolean).join(' '));
}
