// Extracts GHL auth tokens from a live browser session via CDP and writes them
// into the workflow MCP server .env file.
//
// It reads TWO sources:
//   1. IndexedDB `firebaseLocalStorageDb`  -> Firebase refresh token (legacy auth)
//   2. localStorage keys                    -> Bearer JWT (current backend auth, channel: APP)
//
// Prereq: run `launch-chrome.ps1` (or launch-chrome.mjs) and log into GHL, then run this.
//
// Usage:
//   node extract-auth.mjs                 # auto-detect, write to project root .env
//   node extract-auth.mjs --stdout         # print redacted preview only, do not write
//   node extract-auth.mjs --env file.env   # write to a specific .env file

import { connectTab } from './cdp-lib.mjs';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENV = join(__dirname, '..', '..', '.env');
const args = process.argv.slice(2);
const stdoutOnly = args.includes('--stdout');
const envArg = args.length > 0 && !args[0].startsWith('-') ? args[0] : args.find((a, i) => a === '--env' && args[i + 1]);
const targetEnv = envArg ? resolve(envArg) : DEFAULT_ENV;

function redact(v) {
  if (!v) return v;
  const s = String(v);
  if (s.length <= 12) return s;
  return s.slice(0, 8) + '...' + s.slice(-6) + ` (len ${s.length})`;
}

function findTokenInRows(rows) {
  // rows: array of { store/serviceName, rows: [...] } entries
  const found = { refreshToken: null, bearerJwt: null, idToken: null };
  for (const d of rows) {
    for (const store of d.data || []) {
      const list = Array.isArray(store.rows) ? store.rows : [];
      for (const row of list) {
        if (row === null || row === undefined) continue;
        const str = typeof row === 'string' ? row : (() => {
          try { return JSON.stringify(row); } catch (_) { return ''; }
        })();
        const match = (rowValue) => {
          const s = String(rowValue);
          // refresh token
          if (/refreshToken|refresh_token/.test(s) && /[A-Za-z0-9._-]{40,}/.test(s)) {
            const m = s.match(/("[^"]*(?:refreshToken|refresh_token)[^"]*"\s*[,:]\s*"([A-Za-z0-9._-]{40,})")/s);
            if (m) found.refreshToken = m[2];
          }
        };
        if (typeof row === 'object') {
          const v = row.value ?? row;
          const raw = typeof v === 'string' ? v : JSON.stringify(v);
          // Bearer JWT often stored as JSON string with "token"/"access_token"
          if (found.bearerJwt === null && raw && raw.includes('"token"') && /eyJ[A-Za-z0-9_-]{10,}\.(?:[A-Za-z0-9_-]{10,}\.){2}[A-Za-z0-9_-]+/.test(raw)) {
            const jwt = raw.match(/"?token"?\s*:\s*"?(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/);
            if (jwt) found.bearerJwt = jwt[1];
          }
          if (found.refreshToken === null && raw && /refreshToken|refresh_token/.test(raw)) {
            const m = raw.match(/"(?:refreshToken|refresh_token)"\s*:\s*"([^"]{40,})"/);
            if (m) found.refreshToken = m[1];
          }
          if (match(v)) match(v);
          if (found.idToken === null && v && typeof v === 'object' && v.idToken) found.idToken = v.idToken;
        }
      }
    }
  }
  return found;
}

async function main() {
  let cdp = null;
  try {
    cdp = await connectTab({ host: '127.0.0.1', port: 9222, matchUrl: 'crm', createUrl: 'https://crm.dropi.co/' });

    console.log('Connected to page:', (await cdp.evaluate(`location.href`)));
    const [idbRaw, lsRaw] = await Promise.all([
      cdp.getAllDbs(),
      cdp.getLocalStorage()
    ]);
    const idb = JSON.parse(idbRaw);
    const ls = JSON.parse(lsRaw);

    console.log('\n=== IndexedDB ===');
    for (const d of idb.dbs || []) {
      console.log(`  DB: ${d.name} v${d.version}`);
      for (const s of d.data || []) console.log(`    store ${s.store}: ${s.count} rows`);
    }
    console.log('\n=== localStorage (redacted) ===');
    for (const k of ls.keys || []) {
      console.log(`  ${k.key} = ${redact(typeof k.value === 'string' ? k.value : JSON.stringify(k.value))}`);
    }

    // gather all rows for token scanning
    const found = findTokenInRows(idb.dbs || []);
    // also scan localStorage for bearer token
    for (const k of ls.keys || []) {
      const val = k.value;
      const str = typeof val === 'string' ? val : JSON.stringify(val);
      if (found.bearerJwt === null && str && /eyJ[A-Za-z0-9_-]{10,}\.(?:[A-Za-z0-9_-]{10,}\.){2}[A-Za-z0-9_-]+/.test(str)) {
        const m = str.match(/(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/);
        if (m) found.bearerJwt = m[1];
      }
      if (str && /refreshToken|refresh_token/i.test(k.key) && /[A-Za-z0-9._-]{40,}/.test(str)) {
        const m = str.match(/([A-Za-z0-9._-]{40,})/);
        if (m) found.refreshToken = found.refreshToken || m[1];
      }
    }

    console.log('\n=== Result ===');
    console.log('  refresh token (Firebase) :', found.refreshToken ? redact(found.refreshToken) : '(not found)');
    console.log('  bearer JWT (current)      :', found.bearerJwt ? redact(found.bearerJwt) : '(not found)');
    console.log('  idToken (Firebase)        :', found.idToken ? redact(found.idToken) : '(not found)');

    if (stdoutOnly) { console.log('\n[dry-run: --stdout, nothing written]'); return; }

    // Build / merge .env. Only overwrite keys where we found a value, so we never
    // wipe a working credential when one of the sources came back empty.
    const values = {
      GHL_LOCATION_ID: process.env.GHL_LOCATION_ID || 'kNcygEmVTrhIueZQMDXM',
      GHL_FIREBASE_REFRESH_TOKEN: found.refreshToken || undefined,
      GHL_INTERNAL_JWT: found.bearerJwt || undefined
    };
    const existing = existsSync(targetEnv) ? readFileSync(targetEnv, 'utf8') : '';
    const kept = [];
    for (const line of existing.split('\n')) {
      const key = line.split('=')[0].trim();
      if (!key || Object.prototype.hasOwnProperty.call(values, key)) continue;
      kept.push(line);
    }
    const additions = Object.entries(values)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`);
    const out = [...kept, ...additions].filter(Boolean).join('\n') + '\n';
    writeFileSync(targetEnv, out, 'utf8');
    console.log(`\nWrote ${targetEnv}`);
  } finally {
    if (cdp) cdp.close();
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
