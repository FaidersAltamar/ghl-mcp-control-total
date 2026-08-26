import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = join(__dirname, '..');
export const ENV_PATH = join(PROJECT_ROOT, '.env');

export function parseEnvFile(content) {
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

export function loadEnv(options = {}) {
  const { required = false, path = ENV_PATH } = options;

  if (!existsSync(path)) {
    if (required) {
      throw new Error(
        `Missing ${path}. Copy .env.example to .env and fill in your credentials.`
      );
    }
    return {};
  }

  const parsed = parseEnvFile(readFileSync(path, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return parsed;
}

export function getLocationId() {
  // Canonical: GHL_LOCATION_ID. Legacy aliases kept for old .env files.
  return (
    process.env.GHL_LOCATION_ID ||
    process.env.GHL_DEFAULT_LOCATION_ID ||
    process.env.GHL_LOCATION
  );
}

export function getPitToken() {
  return process.env.GHL_PIT_TOKEN;
}

export function getFirebaseRefreshToken() {
  return process.env.GHL_FIREBASE_REFRESH_TOKEN;
}
