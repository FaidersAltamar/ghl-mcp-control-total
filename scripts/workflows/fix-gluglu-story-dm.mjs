#!/usr/bin/env node
/**
 * Ajusta GLUGLU para historias (DM interno) y responde pendientes.
 * Uso: node scripts/workflows/fix-gluglu-story-dm.mjs
 */
import { randomUUID } from 'crypto';
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

const loc = getLocationId();
const TOKEN = getPitToken();
const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const VERSION = process.env.GHL_API_VERSION || '2021-07-28';
const h = {
  Authorization: `Bearer ${TOKEN}`,
  Version: VERSION,
  'Content-Type': 'application/json',
};
const USER_ID = 'd4QvP27fL7tIKcutJNfd';
const wfId = '83e79cb9-5b9a-437a-81c6-aef48d278e8a';
const LINK = 'https://scalbook.com/u/mjt287';

const DM_TEXT = `🔥 Miren esta oferta

Aunque el caso es de gambling y no de e-commerce, vale muchísimo la pena analizarlo.

Desde el otro lado del mundo están creando ofertas cada vez más completas y creativas para conseguir resultados enormes.

👉 Nosotros en e-commerce tenemos que empezar a pensar igual: no se trata solamente de encontrar un producto, sino de construir una oferta irresistible alrededor de él.

Les dejo el caso para que lo lean y saquemos ideas:

LEER EL CASO COMPLETO → ${LINK}`;

const stepDm = randomUUID();
const stepTimeout = randomUUID();
const stepBtn = randomUUID();

// Historias → DM interno: NO usar respond_on_comment (falla sin post comment)
const templates = [
  {
    id: stepDm,
    order: 0,
    parentKey: null,
    type: 'ig_interactive_messenger',
    name: 'Instagram Interactive Messenger',
    attributes: {
      name: 'Instagram Interactive Messenger',
      cat: 'multi-path',
      transitions: [
        {
          id: stepTimeout,
          name: 'Default Timeout',
          condition: 'default',
          conditionType: 'default',
          currentStepEnd: false,
        },
        {
          id: stepBtn,
          name: 'LEER EL CASO COMPLETO',
          condition: 'web_url',
          subCondition: LINK,
          conditionType: 'user-defined',
          currentStepEnd: false,
        },
      ],
      nonBranchingTransitions: [],
      timeout: 1,
      replyType: 'comment_reply',
      message: DM_TEXT,
      attachments: [],
      actionType: 'buttons',
      urlAttachments: [],
      quickReplies: { transitions: [] },
    },
    cat: 'multi-path',
    next: [stepTimeout, stepBtn],
  },
  {
    id: stepTimeout,
    parentKey: stepDm,
    parent: stepDm,
    type: 'transition',
    name: 'Default Timeout',
    attributes: {},
    order: 1,
    cat: 'transition',
    currentStepEnd: false,
  },
  {
    id: stepBtn,
    parentKey: stepDm,
    parent: stepDm,
    type: 'transition',
    name: 'LEER EL CASO COMPLETO',
    attributes: {},
    order: 1,
    cat: 'transition',
    currentStepEnd: false,
  },
];

console.log('1) Update workflow → DM first (story replies)...');
const current = await ghlWorkflowFetch(
  `/workflow/${loc}/${wfId}?includeScheduledPauseInfo=true&sessionId=test`
);
await ghlWorkflowFetch(`/workflow/${loc}/${wfId}`, {
  method: 'PUT',
  body: JSON.stringify({
    version: current.version,
    name: 'DM- Instagram FAIDERS - GLUGLU (caso Scalbook)',
    status: 'published',
    allowMultiple: true,
    workflowData: { templates },
  }),
});

console.log('2) Retarget triggers...');
const triggers = await ghlWorkflowFetch(`/workflow/${loc}/trigger?workflowId=${wfId}`);
for (const t of triggers) {
  if (t.type === 'customer_reply') {
    await ghlWorkflowFetch(`/workflow/${loc}/trigger/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        targetActionId: stepDm,
        active: true,
        conditions: [
          {
            operator: '==',
            field: 'message.type',
            value: 18,
            title: 'Canal de respuesta',
            type: 'select',
          },
          {
            operator: 'string-contains-any-of',
            field: 'contact.FCs7L9Z6PZvh70orN9oj',
            value: ['gluglu', 'GLUGLU', 'Gluglu'],
            title: 'Message',
            type: 'string',
            id: 'FCs7L9Z6PZvh70orN9oj',
          },
        ],
      }),
    });
    console.log('  customer_reply OK', t.id);
  }
  if (t.type === 'ig_comment_on_post') {
    await ghlWorkflowFetch(`/workflow/${loc}/trigger/${t.id}`, {
      method: 'PUT',
      body: JSON.stringify({ targetActionId: stepDm, active: true }),
    });
    console.log('  ig_comment retargeted', t.id);
  }
}

await ghlWorkflowFetch(`/workflow/${loc}/change-status/${wfId}`, {
  method: 'PUT',
  body: JSON.stringify({ status: 'published', updatedBy: USER_ID }),
});

const after = await ghlWorkflowFetch(
  `/workflow/${loc}/${wfId}?includeScheduledPauseInfo=true&sessionId=test`
);
console.log('3) Status:', after.status, 'v' + after.version, 'allowMultiple=', after.allowMultiple);
if (after.fileUrl) {
  const t = await (await fetch(after.fileUrl)).json();
  console.log(
    '   steps:',
    t.templates?.map((s) => s.type + ' | ' + (s.attributes?.body || '').slice(0, 50))
  );
}

// Reply pending conversations with inbound gluglu and no outbound offer after it
console.log('4) Find & reply pending gluglu DMs...');
const search = await (
  await fetch(
    `${BASE}/conversations/search?locationId=${loc}&limit=50&sortBy=last_message_date&sortOrder=desc`,
    { headers: h }
  )
).json();
const convos = search.conversations || [];
let replied = 0;

for (const c of convos) {
  const body = (c.lastMessageBody || '').toLowerCase();
  if (!body.includes('gluglu')) continue;

  const msgsRes = await (
    await fetch(`${BASE}/conversations/${c.id}/messages?limit=10`, { headers: h })
  ).json();
  const msgs = msgsRes.messages?.messages || msgsRes.messages || [];
  const lastInbound = msgs.find((m) => m.direction === 'inbound');
  const lastOutbound = msgs.find((m) => m.direction === 'outbound');
  const inboundIsGluglu = (lastInbound?.body || '').toLowerCase().includes('gluglu');
  const outboundIsOffer =
    lastOutbound &&
    (lastOutbound.body || '').includes('Miren esta oferta') &&
    new Date(lastOutbound.dateAdded) >= new Date(lastInbound?.dateAdded || 0);

  if (!inboundIsGluglu || outboundIsOffer) continue;

  const contactId = c.contactId;
  console.log('  Pending:', c.fullName || c.contactName, contactId, c.id);
  // Try IG message type variants used by GHL
  const payloads = [
    { type: 'IG', contactId, message: DM_TEXT },
    { type: 'Instagram', contactId, message: DM_TEXT },
    { type: 18, contactId, message: DM_TEXT },
  ];
  let ok = false;
  for (const payload of payloads) {
    const send = await fetch(`${BASE}/conversations/messages`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify(payload),
    });
    const text = await send.text();
    console.log('  Send', payload.type, send.status, text.slice(0, 180));
    if (send.ok) {
      ok = true;
      break;
    }
  }
  if (ok) replied++;
}

console.log('\nDone. Manual replies sent:', replied);
