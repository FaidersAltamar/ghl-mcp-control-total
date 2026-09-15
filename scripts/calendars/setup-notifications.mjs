#!/usr/bin/env node
/**
 * Configura notificaciones email completas en calendarios oficiales.
 * Copia plantillas desde Contingencias facebook (source).
 *
 * Uso: node scripts/calendars/setup-notifications.mjs
 */
import { loadEnv, getPitToken } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const VERSION = process.env.GHL_API_VERSION || '2021-07-28';
const PIT = getPitToken();

const SOURCE_ID = 'JGiNpYTCf6w3BwpAdChw';
const TARGETS = ['bJT5h32OkoOdSfV2zd4O', 'o6c2SOIoEkjEfKtBPUNN'];
const ADMIN_EMAILS = ['faiders@scale.com.co', 'soft@scale.com.co'];

const h = {
  Authorization: `Bearer ${PIT}`,
  Version: VERSION,
  'Content-Type': 'application/json',
};

async function getNotifs(calId) {
  const res = await fetch(`${BASE}/calendars/${calId}/notifications`, { headers: h });
  return res.json();
}

const sourceNotifs = (await getNotifs(SOURCE_ID)).filter((n) => n.channel === 'email');

for (const calId of TARGETS) {
  const targetNotifs = (await getNotifs(calId)).filter((n) => n.channel === 'email');
  console.log(`\n=== ${calId} ===`);

  for (const tgt of targetNotifs) {
    const src = sourceNotifs.find(
      (s) => s.notificationType === tgt.notificationType && s.receiverType === tgt.receiverType
    );
    if (!src) continue;

    const body = {
      channel: 'email',
      notificationType: tgt.notificationType,
      receiverType: tgt.receiverType,
      beforeTime: [],
      afterTime: [],
      subject: src.subject,
      body: src.body,
      isActive: true,
      ...(tgt.receiverType === 'emails' ? { additionalEmailIds: ADMIN_EMAILS } : {}),
    };

    const res = await fetch(`${BASE}/calendars/${calId}/notifications/${tgt._id}`, {
      method: 'PUT',
      headers: h,
      body: JSON.stringify(body),
    });
    const ok = res.ok ? 'OK' : 'FAIL';
    console.log(`${ok} ${tgt.notificationType}/${tgt.receiverType} → HTTP ${res.status}`);
  }

  await fetch(`${BASE}/calendars/${calId}`, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({ googleInvitationEmails: true }),
  });
}

console.log('\nDone. Admin copy:', ADMIN_EMAILS.join(', '));
