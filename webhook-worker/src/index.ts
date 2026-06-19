/**
 * Cloudflare Worker receptor de webhooks de GoHighLevel.
 *
 * Endpoints:
 *   POST /webhooks/ghl  -> recibe webhooks de GHL, verifica firma, almacena y responde 200.
 *   GET  /webhooks/ghl  -> lista los ultimos webhooks recibidos (requiere ?token=ADMIN_SECRET).
 *   GET  /health        -> health check.
 */

export interface Env {
  GHL_WEBHOOK_PUBLIC_KEY?: string;
  GHL_WEBHOOK_LEGACY_PUBLIC_KEY?: string;
  GHL_WEBHOOK_ADMIN_SECRET?: string;
  GHL_WEBHOOK_PATH?: string;
  GHL_WEBHOOK_MAX_STORED?: string;
}

const DEFAULT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

const DEFAULT_LEGACY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6d
O0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfBcs
edpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpvux
mZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF3k
voV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKUJ06
2fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXpIoc
maiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzNh/AM
fHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhCHULgC
snuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJPQe7z0
cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAykT1hhTia
CeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

interface StoredWebhook {
  id: string;
  receivedAt: string;
  type: string;
  headers: Record<string, string>;
  body: unknown;
  verification: { ok: boolean; reason: string | null };
}

// Almacenamiento en memoria dentro de una instancia del Worker.
// NOTA: en Cloudflare Workers esto NO es global entre invocaciones, solo util para debug/dev.
const recentWebhooks: StoredWebhook[] = [];

function getConfig(env: Env) {
  return {
    path: (env.GHL_WEBHOOK_PATH ?? "/webhooks/ghl").replace(/\/$/, ""),
    adminSecret: env.GHL_WEBHOOK_ADMIN_SECRET ?? "",
    maxStored: parseInt(env.GHL_WEBHOOK_MAX_STORED ?? "100", 10) || 100,
    publicKey: env.GHL_WEBHOOK_PUBLIC_KEY?.trim() || DEFAULT_PUBLIC_KEY,
    legacyPublicKey: env.GHL_WEBHOOK_LEGACY_PUBLIC_KEY?.trim() || DEFAULT_LEGACY_PUBLIC_KEY,
  };
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importEd25519Key(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(pem),
    { name: "Ed25519" },
    false,
    ["verify"]
  );
}

async function importRsaKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function verifyEd25519(
  payload: string,
  signatureB64: string,
  publicKeyPem: string
): Promise<boolean> {
  try {
    const key = await importEd25519Key(publicKeyPem);
    const signature = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const data = new TextEncoder().encode(payload);
    return crypto.subtle.verify("Ed25519", key, signature, data);
  } catch {
    return false;
  }
}

async function verifyRsa(
  payload: string,
  signatureB64: string,
  publicKeyPem: string
): Promise<boolean> {
  try {
    const key = await importRsaKey(publicKeyPem);
    const signature = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    const data = new TextEncoder().encode(payload);
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
  } catch {
    return false;
  }
}

async function handlePost(request: Request, env: Env): Promise<Response> {
  const config = getConfig(env);
  const payload = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const ghlSig = headers["x-ghl-signature"];
  const legacySig = headers["x-wh-signature"];

  let verification: { ok: boolean; reason: string | null } = {
    ok: false,
    reason: "no signature",
  };

  if (ghlSig) {
    const ok = await verifyEd25519(payload, ghlSig, config.publicKey);
    verification = { ok, reason: ok ? null : "Ed25519 verify failed" };
  } else if (legacySig) {
    const ok = await verifyRsa(payload, legacySig, config.legacyPublicKey);
    verification = { ok, reason: ok ? null : "RSA verify failed" };
  }

  let body: unknown = null;
  try {
    body = JSON.parse(payload);
  } catch {
    body = { raw: payload };
  }

  const webhook: StoredWebhook = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    type: typeof body === "object" && body !== null && "type" in body ? String((body as { type: unknown }).type) : "unknown",
    headers,
    body,
    verification,
  };

  recentWebhooks.unshift(webhook);
  while (recentWebhooks.length > config.maxStored) {
    recentWebhooks.pop();
  }

  console.log(JSON.stringify({
    message: "Webhook received",
    id: webhook.id,
    type: webhook.type,
    verified: verification.ok,
    verificationReason: verification.reason,
  }));

  if (!verification.ok) {
    return Response.json(
      { success: false, error: "Invalid signature", reason: verification.reason },
      { status: 401 }
    );
  }

  return Response.json({ success: true, id: webhook.id }, { status: 200 });
}

async function handleGet(request: Request, env: Env): Promise<Response> {
  const config = getConfig(env);
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!config.adminSecret || token !== config.adminSecret) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    success: true,
    count: recentWebhooks.length,
    webhooks: recentWebhooks,
  });
}

async function handleHealth(): Promise<Response> {
  return Response.json({ ok: true, service: "ghl-control-ads-webhook-worker" });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const config = getConfig(env);
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, "");

    try {
      if (pathname === "/health") {
        return handleHealth();
      }

      if (pathname === config.path) {
        if (request.method === "POST") {
          return handlePost(request, env);
        }
        if (request.method === "GET") {
          return handleGet(request, env);
        }
        return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
      }

      return Response.json({ success: false, error: "Not found" }, { status: 404 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ message: "Worker error", error: message }));
      return Response.json({ success: false, error: message }, { status: 500 });
    }
  },
};
