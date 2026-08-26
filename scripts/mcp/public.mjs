#!/usr/bin/env node
import { spawn } from 'child_process';
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const token = getPitToken();
const location = getLocationId();

if (!token) {
  console.error('ERROR: GHL_PIT_TOKEN is not set in .env');
  process.exit(1);
}
if (!location) {
  console.error('ERROR: GHL_LOCATION_ID is not set in .env');
  process.exit(1);
}

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['-y', '@nerdsnipe-inc/ghl-mcp-server'],
  {
    env: {
      ...process.env,
      GHL_PIT_TOKEN: token,
      GHL_LOCATION: location
    },
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
);

child.on('exit', (code) => process.exit(code ?? 1));
