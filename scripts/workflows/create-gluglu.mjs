#!/usr/bin/env node
/**
 * Crea workflow Instagram keyword "gluglu" → DM con caso Scalbook.
 * Uso: node scripts/workflows/create-gluglu.mjs
 * Queda en DRAFT (no publica).
 */
import { randomUUID } from 'crypto';
import { loadEnv } from '../../lib/env.mjs';
import { ghlWorkflowFetch, getLocationId } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

const locationId = getLocationId();
const FAIDERS_IG = '17841453138427759';
const LINK = 'https://scalbook.com/u/mjt287';

const DM_TEXT = `🔥 Miren esta oferta

Aunque el caso es de gambling y no de e-commerce, vale muchísimo la pena analizarlo.

Desde el otro lado del mundo están creando ofertas cada vez más completas y creativas para conseguir resultados enormes.

👉 Nosotros en e-commerce tenemos que empezar a pensar igual: no se trata solamente de encontrar un producto, sino de construir una oferta irresistible alrededor de él.

Les dejo el caso para que lo lean y saquemos ideas:

LEER EL CASO COMPLETO → ${LINK}`;

const stepComment = randomUUID();
const stepDm = randomUUID();
const stepTimeout = randomUUID();
const stepBtn = randomUUID();

const templates = [
  {
    id: stepComment,
    order: 0,
    name: 'Respond On Comment',
    type: 'respond_on_comment',
    attributes: {
      commentResponse: [
        '¡Claro! Ya te envié el caso a tu DM. 🔥',
        'Listo, revisa tu DM — ahí te dejé el enlace. 🙌🏼',
        'Te lo mandé al DM. Ábrelo y lee el caso completo. 👀',
      ],
      likeComment: true,
    },
    next: stepDm,
  },
  {
    id: stepDm,
    parentKey: stepComment,
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
    order: 1,
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
    order: 2,
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
    order: 2,
    cat: 'transition',
    currentStepEnd: false,
  },
];

console.log('1) Creating workflow...');
const created = await ghlWorkflowFetch(`/workflow/${locationId}`, {
  method: 'POST',
  body: JSON.stringify({
    name: 'DM- Instagram FAIDERS - GLUGLU (caso Scalbook)',
    workflowData: { templates },
  }),
});
const wfId = created.id || created._id || created.workflowId;
console.log('Created:', wfId);

console.log('2) Fetching current...');
const current = await ghlWorkflowFetch(
  `/workflow/${locationId}/${wfId}?includeScheduledPauseInfo=true&sessionId=test`
);
console.log('version', current.version, 'status', current.status);

console.log('3) Saving steps...');
await ghlWorkflowFetch(`/workflow/${locationId}/${wfId}`, {
  method: 'PUT',
  body: JSON.stringify({
    version: current.version,
    name: current.name || 'DM- Instagram FAIDERS - GLUGLU (caso Scalbook)',
    status: 'draft',
    workflowData: { templates },
  }),
});

console.log('4) IG comment trigger (gluglu)...');
const trigComment = await ghlWorkflowFetch(`/workflow/${locationId}/trigger`, {
  method: 'POST',
  body: JSON.stringify({
    workflowId: wfId,
    type: 'ig_comment_on_post',
    name: 'Instagram - Comentario gluglu',
    active: true,
    conditions: [
      {
        operator: 'string-matches-any-of',
        field: 'ig.body',
        value: ['gluglu', 'GLUGLU', 'Gluglu'],
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
});
const commentTrigId = trigComment.id || trigComment._id;
console.log('Comment trigger:', commentTrigId);

if (commentTrigId) {
  await ghlWorkflowFetch(`/workflow/${locationId}/trigger/${commentTrigId}`, {
    method: 'PUT',
    body: JSON.stringify({ targetActionId: stepComment }),
  });
}

console.log('5) DM reply trigger (gluglu)...');
const trigDm = await ghlWorkflowFetch(`/workflow/${locationId}/trigger`, {
  method: 'POST',
  body: JSON.stringify({
    workflowId: wfId,
    type: 'customer_reply',
    name: 'DM Instagram - gluglu',
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
        value: ['gluglu'],
        title: 'Message',
        type: 'string',
        id: 'FCs7L9Z6PZvh70orN9oj',
      },
    ],
    actions: [{ workflow_id: wfId, type: 'add_to_workflow' }],
  }),
});
const dmTrigId = trigDm.id || trigDm._id;
console.log('DM trigger:', dmTrigId);

if (dmTrigId) {
  await ghlWorkflowFetch(`/workflow/${locationId}/trigger/${dmTrigId}`, {
    method: 'PUT',
    body: JSON.stringify({ targetActionId: stepComment }),
  });
}

// Auto-save for canvas visibility
console.log('6) Auto-save...');
try {
  const after = await ghlWorkflowFetch(
    `/workflow/${locationId}/${wfId}?includeScheduledPauseInfo=true&sessionId=test`
  );
  await ghlWorkflowFetch(`/workflow/${locationId}/${wfId}/auto-save`, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'draft',
      workflowData: { templates },
      triggersChanged: true,
    }),
  });
  console.log('Auto-save OK (version was', after.version, ')');
} catch (e) {
  console.log('Auto-save skip/warn:', e.message.slice(0, 200));
}

console.log('\n=== READY (DRAFT) ===');
console.log(
  JSON.stringify(
    {
      workflowId: wfId,
      status: 'draft',
      keyword: 'gluglu',
      igAccount: 'faidersaltamar',
      link: LINK,
      linkWarning: 'Scalbook mjt287 still returns Link no encontrado',
      commentTrigger: commentTrigId,
      dmTrigger: dmTrigId,
    },
    null,
    2
  )
);
