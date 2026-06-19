#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const BACKEND = 'https://backend.leadconnectorhq.com';
const FIREBASE_API_KEY = 'AIzaSyB_w3vXmsI7WeQtrIOkjR6xTRVN5uOieiE';

// Try to load refresh token from env; fallback to workflows-live.json captured token is not enough,
// we need the Firebase refresh token specifically.
let refreshToken = process.env.GHL_FIREBASE_REFRESH_TOKEN || '';

if (!refreshToken) {
  console.error('ERROR: GHL_FIREBASE_REFRESH_TOKEN not set in .env');
  console.error('Extract it from GHL browser IndexedDB (firebaseLocalStorageDb) and paste it in .env');
  process.exit(1);
}

let cachedIdToken = null;
let tokenExpiry = 0;

async function getIdToken() {
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
    'token-id': token,
    'channel': 'APP',
    'accept': 'application/json, text/plain, */*'
  }, init.headers || {});
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
