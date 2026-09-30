#!/usr/bin/env node
/**
 * Prueba el envío de email con seguimiento que usa appointment-notify.
 * Uso: node scripts/calendars/test-tracked-email.mjs destino@correo.com
 */
import { loadEnv } from '../../lib/env.mjs';
import { sendTrackedEmail } from '../../bridge/lib/ghl.js';

loadEnv({ required: true });

const to = process.argv[2];
if (!to) throw new Error('Falta el email destino');
const r = await sendTrackedEmail({
  to,
  subject: 'Prueba notificación de citas — Control Ads',
  html: '<p>Prueba del nuevo aviso de citas por correo. Si ves este mensaje, llegan bien.</p>',
  fromName: 'Citas Control Ads',
});
console.log(JSON.stringify(r));
