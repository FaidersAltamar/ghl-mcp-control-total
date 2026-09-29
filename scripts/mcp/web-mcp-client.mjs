#!/usr/bin/env node
// Cliente MCP sobre SSE para el servidor web-mcp (control de navegador).
// Lee la petición desde un archivo JSON para evitar problemas de quoting en shell.
// Formato del archivo: {"tool":"switch-tab","args":{"id":712655513}}
//                      o {"method":"tools/list","params":{}}
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { URL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let SSE_URL = process.env.WEB_MCP_SSE || '';

const argv = process.argv.slice(2);
let reqPath = join(__dirname, '.web-mcp-request.json');
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--file' && argv[i + 1]) reqPath = argv[i + 1];
  if (argv[i] === '--url' && argv[i + 1]) SSE_URL = argv[i + 1];
}

let req;
try {
  req = JSON.parse(readFileSync(reqPath, 'utf8'));
} catch (e) {
  console.error('No se pudo leer el archivo de request:', reqPath, e.message);
  process.exit(1);
}

let rawMethod, rawParams;
if (req.method) {
  rawMethod = req.method;
  rawParams = req.params || {};
} else if (req.tool) {
  rawMethod = 'tools/call';
  rawParams = { name: req.tool, arguments: req.args || {} };
} else {
  console.error('Request inválido. Usa {"tool":...} o {"method":...}');
  process.exit(1);
}

function parseEventStream(chunk, state) {
  state.buf += chunk;
  const events = [];
  let idx;
  while ((idx = state.buf.indexOf('\n\n')) >= 0) {
    const raw = state.buf.slice(0, idx);
    state.buf = state.buf.slice(idx + 2);
    const ev = {};
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) ev.event = line.slice(6).trim();
      else if (line.startsWith('data:')) ev.data = line.slice(5).trim();
    }
    if (ev.data !== undefined) events.push(ev);
  }
  return events;
}

const base = new URL(SSE_URL);
const MESSAGE_BASE = base.origin;

const sseRes = await fetch(SSE_URL, { headers: { accept: 'text/event-stream' } });
if (!sseRes.ok) throw new Error('SSE connect failed: ' + sseRes.status);
const reader = sseRes.body.getReader();
const dec = new TextDecoder();
const state = { buf: '' };

let endpointPath = null;
while (!endpointPath) {
  const { done, value } = await reader.read();
  if (done) throw new Error('SSE closed before endpoint');
  for (const ev of parseEventStream(dec.decode(value, { stream: true }), state)) {
    if (ev.event === 'endpoint') endpointPath = ev.data;
  }
}

const msgUrl = MESSAGE_BASE + endpointPath;
let nextId = 100;

function post(id, method, params) {
  return fetch(msgUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

await post(nextId, 'initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'faiders-cli', version: '1.0.0' },
});
nextId++;
await post(nextId, 'notifications/initialized', {});
nextId++;

const callId = nextId;
await post(callId, rawMethod, rawParams);

let done = false;
const timer = setTimeout(() => { done = true; console.error('[[timeout]]'); }, 180000);
while (!done) {
  const { done: rd, value } = await reader.read();
  if (rd) break;
  const events = parseEventStream(dec.decode(value, { stream: true }), state);
  for (const ev of events) {
    if (ev.event !== 'message') continue;
    let msg;
    try { msg = JSON.parse(ev.data); } catch { continue; }
    if (msg.id === callId) {
      clearTimeout(timer);
      done = true;
      console.log(JSON.stringify(msg, null, 2));
      break;
    }
  }
}
process.exit(0);
