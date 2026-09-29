#!/usr/bin/env node
/**
 * Crea + publica workflow Instagram keyword "LIMITE" → DM con post de RUSH (Meta límite diario).
 * Uso: node scripts/workflows/create-limite.mjs
 * Variaciones amplias (acentos, mayúsculas, puntuación, elongaciones).
 */
import { randomUUID } from 'crypto';
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

const loc = getLocationId();
const USER_ID = 'd4QvP27fL7tIKcutJNfd';
const FAIDERS_IG = '17841453138427759';
const LINK = 'https://www.skool.com/rush/aumenta-tu-limite-diario-con-meta-ai-sin-complicaciones';

const DM_TEXT = `🔥 Aquí tienes el post que te prometí.

Te muestro cómo funciona el proceso para aumentar el límite diario de Meta y qué debes hacer para solicitarlo correctamente.

👇 Léelo completo aquí:
VER EL POST →

${LINK}`;

// Variantes amplias que la gente realmente escribe
const KEYWORD_VARIANTS = [
  // base + case
  'limite',
  'LIMITE',
  'Limite',
  'límite',
  'Límite',
  'LÍMITE',
  // puntuación / comillas
  'limite!',
  'limite.',
  'limite?',
  '"limite"',
  "'limite'",
  '“límite”',
  '“Limite”',
  '«límite»',
  '«limite»',
  '“limite”',
  '#limite',
  '#límite',
  // typos / elongaciones
  'limitee',
  'limiteee',
  'limites',
  'limiite',
  'limiitee',
  'límitee',
  'límiite',
  'limiiite',
];

// Retry ante rate-limit de Firebase
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
        console.log(`Firebase rate limit — esperando ${wait / 1000}s (intento ${i + 1}/${tries})...`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

const stepDm = randomUUID();
const stepTimeout = randomUUID();
const stepBtn = randomUUID();

// DM-first (cubre historias → DM interno, igual que el final de GLUGLU)
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
          name: 'VER EL POST',
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
    name: 'VER EL POST',
    attributes: {},
    order: 1,
    cat: 'transition',
    currentStepEnd: false,
  },
];

console.log('1) Creando workflow...');
const created = await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'DM- Instagram FAIDERS - LIMITE (post Meta)',
      workflowData: { templates },
    }),
  })
);
const wfId = created.id || created._id || created.workflowId;
console.log('Created:', wfId);

console.log('2) Guardando steps...');
const current = await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/${wfId}?includeScheduledPauseInfo=true&sessionId=test`)
);
await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/${wfId}`, {
    method: 'PUT',
    body: JSON.stringify({
      version: current.version,
      name: 'DM- Instagram FAIDERS - LIMITE (post Meta)',
      status: 'draft',
      allowMultiple: true,
      removeContactFromLastStep: true,
      workflowData: { templates },
    }),
  })
);

console.log('3) Trigger DM/Historia (limite + variaciones)...');
const trigDm = await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/trigger`, {
    method: 'POST',
    body: JSON.stringify({
      workflowId: wfId,
      type: 'customer_reply',
      name: 'Historia/DM Instagram - limite (variaciones)',
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
console.log('DM trigger:', trigDmId);
await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/trigger/${trigDmId}`, {
    method: 'PUT',
    body: JSON.stringify({ targetActionId: stepDm, active: true }),
  })
);

console.log('4) Trigger comentario (limite + variaciones)...');
const trigComment = await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/trigger`, {
    method: 'POST',
    body: JSON.stringify({
      workflowId: wfId,
      type: 'ig_comment_on_post',
      name: 'Comentario limite (variaciones)',
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
console.log('Comment trigger:', trigCommentId);
await withFirebaseRetry(() =>
  ghlWorkflowFetch(`/workflow/${loc}/trigger/${trigCommentId}`, {
    method: 'PUT',
    body: JSON.stringify({ targetActionId: stepDm, active: true }),
  })
);

console.log('5) Publicando...');
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
console.log('\n=== LISTO ===');
console.log(
  JSON.stringify(
    {
      workflowId: wfId,
      status: after.status,
      version: after.version,
      keyword: 'limite',
      link: LINK,
      dmTrigger: trigDmId,
      commentTrigger: trigCommentId,
      triggers: afterTriggers.map((t) => `${t.type}:${t.active}:${t.name}`),
    },
    null,
    2
  )
);
