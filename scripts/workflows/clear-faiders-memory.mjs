import { loadEnv } from '../../lib/env.mjs';
import { setContactCustomField } from '../../bridge/lib/ghl.js';

loadEnv({ required: true });

const id = 'OfxvpHjgAQbrIUBc480m';
const r = await setContactCustomField(id, 'h9iYCwBTvvaxSLvTqYBu', JSON.stringify({ resumen: '', reciente: [] }));
const c = r.contact || r;
console.log('cleared ->', JSON.stringify({ id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(' ') }));
