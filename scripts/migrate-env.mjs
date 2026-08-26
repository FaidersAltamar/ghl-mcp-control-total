#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PROJECT_ROOT, ENV_PATH, parseEnvFile } from '../lib/env.mjs';

const sources = [
  join(PROJECT_ROOT, 'mcp/workflows/.env'),
  join(PROJECT_ROOT, 'ghl-workflow-builder/mcp-server/.env'),
  join(PROJECT_ROOT, 'tools/api-client/.env'),
  join(PROJECT_ROOT, 'api-client/.env'),
  join(PROJECT_ROOT, '.env')
];

const merged = {};

for (const path of sources) {
  if (!existsSync(path)) continue;
  Object.assign(merged, parseEnvFile(readFileSync(path, 'utf8')));
}

const mcpPath = join(PROJECT_ROOT, '.mcp.json');
if (existsSync(mcpPath)) {
  try {
    const mcp = JSON.parse(readFileSync(mcpPath, 'utf8'));
    for (const server of Object.values(mcp.mcpServers || {})) {
      const env = server.env || {};
      if (env.GHL_PIT_TOKEN) merged.GHL_PIT_TOKEN = env.GHL_PIT_TOKEN;
      if (env.GHL_LOCATION) merged.GHL_LOCATION_ID = env.GHL_LOCATION;
      if (env.GHL_DEFAULT_LOCATION_ID) merged.GHL_DEFAULT_LOCATION_ID = env.GHL_DEFAULT_LOCATION_ID;
      if (env.GHL_FIREBASE_REFRESH_TOKEN) {
        merged.GHL_FIREBASE_REFRESH_TOKEN = env.GHL_FIREBASE_REFRESH_TOKEN;
      }
    }
  } catch {
    // ignore invalid json
  }
}

if (merged.GHL_DEFAULT_LOCATION_ID && !merged.GHL_LOCATION_ID) {
  merged.GHL_LOCATION_ID = merged.GHL_DEFAULT_LOCATION_ID;
}
delete merged.GHL_DEFAULT_LOCATION_ID;
delete merged.GHL_LOCATION;

const PLACEHOLDER = /^(tu-|your_|change-me|xxx|placeholder|example)/i;

function isRealValue(value) {
  if (value == null) return false;
  const v = String(value).trim();
  if (!v) return false;
  if (PLACEHOLDER.test(v)) return false;
  return true;
}

for (const [key, value] of Object.entries(merged)) {
  if (!isRealValue(value)) delete merged[key];
}

const order = [
  'GHL_LOCATION_ID',
  'GHL_COMPANY_ID',
  'GHL_PIT_TOKEN',
  'GHL_FIREBASE_REFRESH_TOKEN',
  'GHL_INTERNAL_JWT',
  'GHL_API_VERSION',
  'GHL_API_BASE',
  'GHL_OAUTH_CLIENT_ID',
  'GHL_OAUTH_CLIENT_SECRET',
  'GHL_OAUTH_ACCESS_TOKEN',
  'GHL_OAUTH_REFRESH_TOKEN',
  'GHL_WEBHOOK_PORT',
  'GHL_WEBHOOK_ADMIN_SECRET',
  'GHL_WEBHOOK_PATH',
  'GHL_WEBHOOK_MAX_STORED'
];

const lines = [
  '# GHL MCP — credentials (DO NOT commit this file)',
  '# Generated/updated by scripts/migrate-env.mjs',
  ''
];

const written = new Set();
for (const key of order) {
  if (isRealValue(merged[key])) {
    lines.push(`${key}=${merged[key]}`);
    written.add(key);
  }
}
for (const [key, value] of Object.entries(merged)) {
  if (!written.has(key) && isRealValue(value)) lines.push(`${key}=${value}`);
}

writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8');
console.log(`Wrote ${ENV_PATH} with ${Object.keys(merged).length} variables.`);
