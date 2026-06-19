/**
 * Refresca el Location Access Token de la Marketplace OAuth app.
 *
 * Lee Client ID, Client Secret y Refresh Token desde .env.
 *
 * Uso:
 *   node refresh-oauth-token.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, ".env");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0 && !key.startsWith("#")) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    }
  } catch {
    // .env no existe
  }
}

loadEnv();

const BASE_URL = "https://services.leadconnectorhq.com";
const clientId = process.env.GHL_OAUTH_CLIENT_ID;
const clientSecret = process.env.GHL_OAUTH_CLIENT_SECRET;
const refreshToken = process.env.GHL_OAUTH_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
  console.error("Faltan datos en .env:");
  console.error("  GHL_OAUTH_CLIENT_ID");
  console.error("  GHL_OAUTH_CLIENT_SECRET");
  console.error("  GHL_OAUTH_REFRESH_TOKEN");
  process.exit(1);
}

async function refresh() {
  const response = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Error refrescando token:", response.status, data);
    process.exit(1);
  }

  console.log("\n=== Tokens renovados ===\n");
  console.log(JSON.stringify(data, null, 2));
  console.log("\n=== Actualiza .env ===");
  console.log(`GHL_OAUTH_ACCESS_TOKEN=${data.access_token}`);
  if (data.refresh_token) {
    console.log(`GHL_OAUTH_REFRESH_TOKEN=${data.refresh_token}`);
  }
}

refresh().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
