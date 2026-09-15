#!/usr/bin/env node
/**
 * Audit + fix GLUGLU story DM automation:
 * - broader keyword variants
 * - DM-first action
 * - reply all pending inbound matches
 */
import { randomUUID } from 'crypto';
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

// Retry Firebase auth when rate-limited
async function withFirebaseRetry(fn, tries = 8) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String(e.message || e);
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota')) {
        const wait = Math.min(15000 * (i + 1), 90000);
        console.log(`Firebase rate limit — waiting ${wait / 1000}s (try ${i + 1}/${tries})...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

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
const FAIDERS_IG = '17841453138427759';

// Broad variants people actually type
const KEYWORD_VARIANTS = [
  // base
  'gluglu',
  'GLUGLU',
  'Gluglu',
  'GluGlu',
  'gLuGlU',
  // spaced
  'glu glu',
  'Glu Glu',
  'GLU GLU',
  'Glu glu',
  // accents (seen live: Gluglú / GLUGLÚ)
  'gluglú',
  'Gluglú',
  'GLUGLÚ',
  'glúglu',
  'Glúglu',
  'glú glú',
  'glu glú',
  'Glu glú',
  // punctuation / quotes (seen live: “Gluglu”)
  'gluglu!',
  'gluglu.',
  'gluglu?',
  '"gluglu"',
  "'gluglu'",
  '“gluglu”',
  '“Gluglu”',
  '«gluglu»',
  '#gluglu',
  // typos / elongations
  'glugluu',
  'gluuglu',
  'gluglus',
  'glugluuu',
  'gluglúú',
];

const DM_TEXT = `🔥 Miren esta oferta

Aunque el caso es de gambling y no de e-commerce, vale muchísimo la pena analizarlo.

Desde el otro lado del mundo están creando ofertas cada vez más completas y creativas para conseguir resultados enormes.

👉 Nosotros en e-commerce tenemos que empezar a pensar igual: no se trata solamente de encontrar un producto, sino de construir una oferta irresistible alrededor de él.

Les dejo el caso para que lo lean y saquemos ideas:

LEER EL CASO COMPLETO → ${LINK}`;

function matchesKeyword(text = '') {
  const n = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // glu glu / gluglu / glugluu etc.
  return /\bglu\s*glu+\b/.test(n) || n.includes('gluglu');
}

async function pit(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...h, ...(init.headers || {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

console.log('=== AUDIT pending DMs (PIT) ===');
const search = await pit(
  `/conversations/search?locationId=${loc}&limit=100&sortBy=last_message_date&sortOrder=desc`
);
const convos = search.body.conversations || [];
const pending = [];

for (const c of convos) {
  const msgsRes = await pit(`/conversations/${c.id}/messages?limit=15`);
  const msgs = msgsRes.body.messages?.messages || msgsRes.body.messages || [];
  const recentInbound = msgs.filter(
    (m) => m.direction === 'inbound' && matchesKeyword(m.body || '')
  );
  if (!recentInbound.length) continue;

  const lastKeyword = recentInbound[0];
  const repliedAfter = msgs.some(
    (m) =>
      m.direction === 'outbound' &&
      (m.body || '').includes('Miren esta oferta') &&
      new Date(m.dateAdded) >= new Date(lastKeyword.dateAdded)
  );

  pending.push({
    name: c.fullName || c.contactName,
    contactId: c.contactId,
    convoId: c.id,
    keywordMsg: lastKeyword.body,
    keywordAt: lastKeyword.dateAdded,
    alreadyReplied: repliedAfter,
  });
}

console.log(JSON.stringify(pending, null, 2));

console.log('\n=== REPLY PENDING NOW (antes del fix Firebase) ===');
let sentEarly = 0;
for (const p of pending.filter((x) => !x.alreadyReplied)) {
  console.log('Sending to', p.name, p.contactId, '| keyword:', p.keywordMsg);
  const send = await pit('/conversations/messages', {
    method: 'POST',
    body: JSON.stringify({ type: 'IG', contactId: p.contactId, message: DM_TEXT }),
  });
  console.log(' ', send.status, JSON.stringify(send.body).slice(0, 180));
  if (send.ok) {
    sentEarly++;
    p.alreadyReplied = true;
  }
}
console.log('Manual sends early:', sentEarly);

console.log('\n=== FIX workflow triggers/actions ===');
const stepDm = randomUUID();
const stepTimeout = randomUUID();
const stepBtn = randomUUID();

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

const current = await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/${wfId}?includeScheduledPauseInfo=true&sessionId=test`)
);
console.log('Current', current.status, 'v' + current.version);

await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/${wfId}`, {
    method: 'PUT',
    body: JSON.stringify({
      version: current.version,
      name: 'DM- Instagram FAIDERS - GLUGLU (caso Scalbook)',
      status: 'published',
      allowMultiple: true,
      removeContactFromLastStep: true,
      workflowData: { templates },
    }),
  })
);

const triggers = await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/trigger?workflowId=${wfId}`)
);
console.log(
  'Existing triggers:',
  triggers.map((t) => `${t.type}:${t.id}:${t.active}`)
);

// Recreate customer_reply cleanly with broad contains variants
for (const t of triggers) {
  if (t.type === 'customer_reply' || t.type === 'ig_comment_on_post') {
    try {
      await withFirebaseRetry(() =>
        ghlWorkflowFetch(`/workflow/${loc}/trigger/${t.id}`, { method: 'DELETE' })
      );
      console.log('Deleted old trigger', t.id, t.type);
    } catch (e) {
      console.log('Delete warn', t.id, e.message.slice(0, 120));
    }
  }
}

const trigDm = await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/trigger`, {
    method: 'POST',
    body: JSON.stringify({
      workflowId: wfId,
      type: 'customer_reply',
      name: 'Historia/DM Instagram - gluglu (variaciones)',
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
          value: KEYWORD_VARIANTS,
          title: 'Message',
          type: 'string',
          id: 'FCs7L9Z6PZvh70orN9oj',
        },
      ],
      actions: [{ workflow_id: wfId, type: 'add_to_workflow' }],
    }),
  })
);
const trigDmId = trigDm.id || trigDm._id;
console.log('Created DM trigger', trigDmId);
await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/trigger/${trigDmId}`, {
    method: 'PUT',
    body: JSON.stringify({ targetActionId: stepDm, active: true }),
  })
);

// Also keep comment trigger with contains-like list (exact match list of variants)
const trigComment = await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/trigger`, {
    method: 'POST',
    body: JSON.stringify({
      workflowId: wfId,
      type: 'ig_comment_on_post',
      name: 'Comentario gluglu (variaciones)',
      active: true,
      conditions: [
        {
          operator: 'string-matches-any-of',
          field: 'ig.body',
          value: KEYWORD_VARIANTS,
          title: 'Exact match',
          type: 'input',
        },
        {
          operator: '==',
          field: 'ig.pageId',
          value: FAIDERS_IG,
          title: 'Page is',
          type: 'select',
        },
      ],
      actions: [{ workflow_id: wfId, type: 'add_to_workflow' }],
    }),
  })
);
const trigCommentId = trigComment.id || trigComment._id;
console.log('Created comment trigger', trigCommentId);
await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/trigger/${trigCommentId}`, {
    method: 'PUT',
    body: JSON.stringify({ targetActionId: stepDm, active: true }),
  })
);

await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/change-status/${wfId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'published', updatedBy: USER_ID }),
  })
);

const after = await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/${wfId}?includeScheduledPauseInfo=true&sessionId=test`)
);
const afterTriggers = await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/trigger?workflowId=${wfId}`)
);
console.log('\n=== AFTER ===');
console.log({
  status: after.status,
  version: after.version,
  allowMultiple: after.allowMultiple,
});
for (const t of afterTriggers) {
  console.log(
    t.type,
    t.active,
    t.name,
    JSON.stringify(t.conditions?.find((c) => c.title === 'Message' || c.field?.includes('body'))?.value)
  );
}

console.log('\n=== REPLY ANY NEW PENDING ===');
const search2 = await pit(
  `/conversations/search?locationId=${loc}&limit=100&sortBy=last_message_date&sortOrder=desc`
);
let sent = 0;
for (const c of search2.body.conversations || []) {
  const msgsRes = await pit(`/conversations/${c.id}/messages?limit=12`);
  const msgs = msgsRes.body.messages?.messages || msgsRes.body.messages || [];
  const lastKeyword = msgs.find((m) => m.direction === 'inbound' && matchesKeyword(m.body || ''));
  if (!lastKeyword) continue;
  const repliedAfter = msgs.some(
    (m) =>
      m.direction === 'outbound' &&
      (m.body || '').includes('Miren esta oferta') &&
      new Date(m.dateAdded) >= new Date(lastKeyword.dateAdded)
  );
  if (repliedAfter) continue;
  console.log('Sending to', c.fullName || c.contactName, '|', lastKeyword.body);
  const send = await pit('/conversations/messages', {
    method: 'POST',
    body: JSON.stringify({ type: 'IG', contactId: c.contactId, message: DM_TEXT }),
  });
  console.log(' ', send.status, JSON.stringify(send.body).slice(0, 180));
  if (send.ok) sent++;
}
console.log('Manual sends late:', sent);
