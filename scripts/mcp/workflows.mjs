#!/usr/bin/env node
import { loadEnv } from '../../lib/env.mjs';

loadEnv({ required: true });

await import('../../mcp/workflows/server.js');
