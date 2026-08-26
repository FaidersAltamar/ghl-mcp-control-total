#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { tools as publicTools } from '@nerdsnipe-inc/ghl-mcp-server';
import { loadEnv } from '../../lib/env.mjs';

// Herramientas específicas de workflows
const workflowTools = [
  {
    name: 'ghl_workflow_builder_list',
    description: 'List all workflows in the location',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max number of workflows to return' },
        folderId: { type: 'string', description: 'Filter by folder ID' }
      }
    },
    handler: async ({ limit = 10, folderId }) => {
      const url = new URL(`${BACKEND}/workflow/${process.env.GHL_DEFAULT_LOCATION_ID}/list`);
      if (limit) url.searchParams.set('limit', limit);
      if (folderId) url.searchParams.set('folderId', folderId);
      const res = await fetch(url.toString(), {
        headers: { 'token-id': await getIdToken(), 'channel': 'APP' }
      });
      return res.json();
    }
  },
  {
    name: 'ghl_workflow_builder_get',
    description: 'Get a workflow by ID',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Workflow ID' }
      },
      required: ['workflowId']
    },
    handler: async ({ workflowId }) => {
      const res = await fetch(`${BACKEND}/workflow/${process.env.GHL_DEFAULT_LOCATION_ID}/${workflowId}`, {
        headers: { 'token-id': await getIdToken(), 'channel': 'APP' }
      });
      return res.json();
    }
  }
];

loadEnv({ required: true });

// Keep legacy alias in sync for any code that still reads GHL_DEFAULT_LOCATION_ID
if (process.env.GHL_LOCATION_ID && !process.env.GHL_DEFAULT_LOCATION_ID) {
  process.env.GHL_DEFAULT_LOCATION_ID = process.env.GHL_LOCATION_ID;
}

const BACKEND = 'https://backend.leadconnectorhq.com';
const FIREBASE_API_KEY = 'AIzaSyB_w3vXmsI7WeQtrIOkjR6xTRVN5uOieiE';

// Auth modes:
// 1. Direct Bearer JWT (GHL_INTERNAL_JWT) — the `authorization: Bearer <...>` token the crm web
//    app uses with `channel: APP` + `source: WEB_USER`. Verified working against /workflow/* on
//    2026-08-03 for the Control Ads location.
// 2. Firebase refresh (GHL_FIREBASE_REFRESH_TOKEN) — `token-id` mode. PREFERRED: the refresh
//    token never expires, so the server self-renews the ~1h id_token automatically (vs the Bearer
//    JWT which is a short-lived session token). Verified working on 2026-08-04 via
//    securetoken.googleapis.com -> id_token -> `token-id` header against /workflow/*.
// Exactly one must be provided.
let refreshToken = process.env.GHL_FIREBASE_REFRESH_TOKEN || '';
let internalJwt = process.env.GHL_INTERNAL_JWT || '';

if (!internalJwt && !refreshToken) {
  console.error('ERROR: neither GHL_INTERNAL_JWT nor GHL_FIREBASE_REFRESH_TOKEN is set in .env (project root)');
  console.error('GHL_INTERNAL_JWT = the `authorization: Bearer <...>` JWT from the crm.dropi.co web app network tab.');
  console.error('or extract the Firebase refresh token from GHL IndexedDB (firebaseLocalStorageDb) and paste it in .env.');
  process.exit(1);
}

let cachedIdToken = null;
let tokenExpiry = 0;

async function getIdToken() {
  if (internalJwt) {
    return internalJwt;
  }
  const now = Date.now();
  if (cachedIdToken && tokenExpiry > now + 60000) {
    return cachedIdToken;
  }
  const resp = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Firebase refresh failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  cachedIdToken = data.id_token;
  tokenExpiry = now + (parseInt(data.expires_in, 10) * 1000);
  return cachedIdToken;
}

async function ghlFetch(path, init = {}) {
  const token = await getIdToken();
  const url = `${BACKEND}${path}`;
  const headers = Object.assign({
    'channel': 'APP',
    'source': 'WEB_USER',
    'accept': 'application/json, text/plain, */*'
  }, init.headers || {});
  if (internalJwt) {
    headers['authorization'] = `Bearer ${token}`;
  } else {
    headers['token-id'] = token;
  }
  if (init.body && !headers['content-type']) {
    headers['content-type'] = 'application/json';
  }
  const resp = await fetch(url, Object.assign({ method: 'GET' }, init, { headers }));
  const text = await resp.text();
  let body = null;
  try { body = JSON.parse(text); } catch (_) { body = text; }
  if (!resp.ok) {
    throw new Error(`GHL API ${resp.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function listWorkflows(locationId, limit = 100, offset = 0) {
  return ghlFetch(`/workflow/${locationId}/list?type=workflow&limit=${limit}&offset=${offset}&sortBy=name&sortOrder=asc`);
}

async function getWorkflow(locationId, workflowId) {
  return ghlFetch(`/workflow/${locationId}/${workflowId}?includeScheduledPauseInfo=true&sessionId=${crypto.randomUUID()}`);
}

async function createWorkflow(locationId, name, parentId = null) {
  const body = { name, status: 'draft' };
  if (parentId) body.parentId = parentId;
  return ghlFetch(`/workflow/${locationId}`, { method: 'POST', body: JSON.stringify(body) });
}

async function updateWorkflow(locationId, workflowId, payload) {
  return ghlFetch(`/workflow/${locationId}/${workflowId}`, { method: 'PUT', body: JSON.stringify(payload) });
}

async function getTriggers(locationId, workflowId) {
  return ghlFetch(`/workflow/${locationId}/trigger?workflowId=${workflowId}`);
}

async function createTrigger(locationId, workflowId, trigger) {
  return ghlFetch(`/workflow/${locationId}/trigger`, { method: 'POST', body: JSON.stringify(trigger) });
}

async function publishWorkflow(locationId, workflowId, version) {
  // GET current, flip status to published, PUT back
  const current = await getWorkflow(locationId, workflowId);
  const payload = Object.assign({}, current, { status: 'published', version: current.version });
  // Remove fields that may cause issues on PUT
  delete payload._id;
  delete payload.createdAt;
  delete payload.updatedAt;
  return updateWorkflow(locationId, workflowId, payload);
}

async function deleteWorkflow(locationId, workflowId) {
  return ghlFetch(`/workflow/${locationId}/${workflowId}`, { method: 'DELETE' });
}

const server = new Server(
  { name: 'ghl-workflow-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'ghl_list_workflows',
      description: 'List all workflows in a GHL location',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'GHL location ID' },
          limit: { type: 'number', default: 100 },
          offset: { type: 'number', default: 0 }
        },
        required: ['locationId']
      }
    },
    {
      name: 'ghl_get_workflow',
      description: 'Get full workflow details including triggers and action steps',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
          workflowId: { type: 'string' }
        },
        required: ['locationId', 'workflowId']
      }
    },
    {
      name: 'ghl_create_workflow',
      description: 'Create a new empty workflow',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
          name: { type: 'string' },
          parentId: { type: 'string' }
        },
        required: ['locationId', 'name']
      }
    },
    {
      name: 'ghl_add_action',
      description: 'Add or replace action steps in a workflow',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
          workflowId: { type: 'string' },
          templates: { type: 'array', description: 'Array of action step objects' }
        },
        required: ['locationId', 'workflowId', 'templates']
      }
    },
    {
      name: 'ghl_add_trigger',
      description: 'Add a trigger to a workflow',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
          workflowId: { type: 'string' },
          type: { type: 'string', description: 'Trigger type e.g. customer_reply, ig_comment_on_post' },
          name: { type: 'string' },
          conditions: { type: 'array' }
        },
        required: ['locationId', 'workflowId', 'type', 'name']
      }
    },
    {
      name: 'ghl_publish_workflow',
      description: 'Publish a workflow so it runs live',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
          workflowId: { type: 'string' }
        },
        required: ['locationId', 'workflowId']
      }
    },
    {
      name: 'ghl_delete_workflow',
      description: 'Delete a workflow',
      inputSchema: {
        type: 'object',
        properties: {
          locationId: { type: 'string' },
          workflowId: { type: 'string' }
        },
        required: ['locationId', 'workflowId']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === 'ghl_list_workflows') {
      const data = await listWorkflows(args.locationId, args.limit, args.offset);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'ghl_get_workflow') {
      const data = await getWorkflow(args.locationId, args.workflowId);
      const triggers = await getTriggers(args.locationId, args.workflowId);
      return { content: [{ type: 'text', text: JSON.stringify({ workflow: data, triggers }, null, 2) }] };
    }
    if (name === 'ghl_create_workflow') {
      const data = await createWorkflow(args.locationId, args.name, args.parentId);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'ghl_add_action') {
      const current = await getWorkflow(args.locationId, args.workflowId);
      const payload = Object.assign({}, current, {
        version: current.version,
        workflowData: { templates: args.templates }
      });
      delete payload._id;
      delete payload.createdAt;
      delete payload.updatedAt;
      const data = await updateWorkflow(args.locationId, args.workflowId, payload);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'ghl_add_trigger') {
      const body = {
        workflowId: args.workflowId,
        type: args.type,
        name: args.name,
        conditions: args.conditions || [],
        active: true,
        status: 'draft'
      };
      const data = await createTrigger(args.locationId, args.workflowId, body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'ghl_publish_workflow') {
      const data = await publishWorkflow(args.locationId, args.workflowId);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    if (name === 'ghl_delete_workflow') {
      const data = await deleteWorkflow(args.locationId, args.workflowId);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
