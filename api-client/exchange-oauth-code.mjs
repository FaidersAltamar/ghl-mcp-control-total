/**
 * Intercambia el Authorization Code de la Marketplace OAuth app por tokens.
 *
 * Lee Client ID y Client Secret desde variables de entorno o .env
 * y recibe el Authorization Code como argumento.
 *
 * Uso:
 *   node exchange-oauth-code.mjs <authCode>
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
    // .env no existe, usamos process.env directamente
  }
}

loadEnv();

const BASE_URL = "https://services.leadconnectorhq.com";
const authCode = process.argv[2] || process.env.GHL_OAUTH_AUTH_CODE;
const clientId = process.env.GHL_OAUTH_CLIENT_ID;
const clientSecret = process.env.GHL_OAUTH_CLIENT_SECRET;

if (!authCode || !clientId || !clientSecret) {
  console.error("Faltan datos. Uso:");
  console.error("  node exchange-oauth-code.mjs <authCode>");
  console.error("\nAsegurate de tener en .env:");
  console.error("  GHL_OAUTH_CLIENT_ID=tu-client-id");
  console.error("  GHL_OAUTH_CLIENT_SECRET=tu-client-secret");
  process.exit(1);
}

async function exchangeCode() {
  const response = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: authCode,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Error intercambiando codigo:", response.status, data);
    process.exit(1);
  }

  console.log("\n=== Tokens obtenidos ===\n");
  console.log(JSON.stringify(data, null, 2));
  console.log("\n=== Guarda esto en .env ===");
  console.log(`GHL_OAUTH_ACCESS_TOKEN=${data.access_token}`);
  console.log(`GHL_OAUTH_REFRESH_TOKEN=${data.refresh_token}`);
  console.log("\nEl access_token dura ~24h. Usa refresh con:");
  console.log("  node oauth-helper.js refresh <clientId> <clientSecret> <refreshToken>");
}

exchangeCode().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
