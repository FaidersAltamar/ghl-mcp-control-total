/**
 * Test local rapido del worker sin levantar wrangler.
 * Requiere Node.js >= 20 (crypto.subtle disponible globalmente).
 */
import worker from "./src/index.ts";

async function main() {
  const env = {
    GHL_WEBHOOK_ADMIN_SECRET: "test-secret",
  };

  const health = await worker.fetch(new Request("http://localhost/health"), env);
  console.log("health:", health.status, await health.json());

  const getNoAuth = await worker.fetch(new Request("http://localhost/webhooks/ghl"), env);
  console.log("get no auth:", getNoAuth.status);

  const postBad = await worker.fetch(
    new Request("http://localhost/webhooks/ghl", {
      method: "POST",
      headers: { "x-ghl-signature": "invalid" },
      body: JSON.stringify({ type: "ContactCreate" }),
    }),
    env
  );
  console.log("post invalid sig:", postBad.status, await postBad.json());

  const postNoSig = await worker.fetch(
    new Request("http://localhost/webhooks/ghl", {
      method: "POST",
      body: JSON.stringify({ type: "ContactCreate" }),
    }),
    env
  );
  console.log("post no sig:", postNoSig.status);

  const getAuth = await worker.fetch(
    new Request("http://localhost/webhooks/ghl?token=test-secret"),
    env
  );
  const list = await getAuth.json();
  console.log("get auth:", getAuth.status, "count:", list.count);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
