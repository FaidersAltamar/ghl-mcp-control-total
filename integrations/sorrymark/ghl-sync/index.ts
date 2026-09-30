// Supabase Edge Function (proyecto SorryMark): sincroniza clientes de SorryMark -> contactos de GHL.
// POST con header x-sync-secret. Body opcional: { "limit": 80 }.
// Config en public.ghl_sync_config (GHL_PIT_TOKEN, GHL_LOCATION_ID, SYNC_SECRET, FIELD_IDS).
import { createClient } from "npm:@supabase/supabase-js@2";

const GHL = "https://services.leadconnectorhq.com";
const BUDGET_MS = 110_000;

type Summary = {
  email: string; name: string | null; phone: string | null; registro: string | null; saldo: number;
  pedidos: number; comprado: number; ultimo: string | null; productos: string | null; recargado: number;
  metodo: string | null; reembolsos: number; disputas: number; estado: "cliente" | "baneado" | "registrado";
};
type Pending = { user_id: string; summary: Summary; hash: string; ghl_contact_id: string | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normPhone(raw: string | null) {
  let p = String(raw ?? "").replace(/\D/g, "");
  if (!p) return null;
  if (p.startsWith("00")) p = p.slice(2);
  if (p.length === 10 && p.startsWith("3")) p = "57" + p;
  return p.length >= 8 ? "+" + p : null;
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfgRows } = await db.from("ghl_sync_config").select("key,value");
  const cfg = Object.fromEntries((cfgRows ?? []).map((r) => [r.key, r.value]));
  if (!cfg.SYNC_SECRET || req.headers.get("x-sync-secret") !== cfg.SYNC_SECRET) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const fields: Record<string, string> = JSON.parse(cfg.FIELD_IDS || "{}");
  const loc = cfg.GHL_LOCATION_ID;
  const headers = { Authorization: `Bearer ${cfg.GHL_PIT_TOKEN}`, Version: "2021-07-28", "Content-Type": "application/json", Accept: "application/json" };

  async function ghl(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
    for (let i = 0; i < 4; i++) {
      const r = await fetch(`${GHL}${path}`, { ...init, headers });
      if (r.status === 429) { await sleep(2000 * (i + 1)); continue; }
      const text = await r.text();
      let body: any; try { body = JSON.parse(text); } catch { body = text; }
      return { status: r.status, body };
    }
    return { status: 429, body: "rate limited" };
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit) || 80, 200);
  const t0 = Date.now();
  const { data: pending, error } = await db.rpc("ghl_sync_pending", { p_limit: limit });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let created = 0, updated = 0, failed = 0, skipped = 0;
  const errors: string[] = [];

  async function syncOne(p: Pending) {
    const s = p.summary;
    const customFields = [
      ["total_recargado", s.recargado], ["total_comprado", s.comprado], ["pedidos", s.pedidos],
      ["ultimo_pedido", s.ultimo], ["productos", s.productos], ["saldo", s.saldo], ["registro", s.registro],
      ["metodo_pago", s.metodo], ["reembolsos", s.reembolsos], ["disputas", s.disputas], ["estado", s.estado],
      ["user_id", p.user_id],
    ].filter(([k, v]) => fields[k as string] && v !== null && v !== undefined && v !== "")
      .map(([k, v]) => ({ id: fields[k as string], field_value: v }));
    const tags = ["sorrymark"];
    if (s.estado === "cliente" || s.pedidos > 0) tags.push("sorrymark-cliente");
    if (s.estado === "baneado") tags.push("sorrymark-baneado");
    if (s.disputas > 0) tags.push("sorrymark-disputa");
    const phone = normPhone(s.phone);

    let contactId = p.ghl_contact_id;
    let contactPhone: string | null = null;
    if (!contactId) {
      const found = await ghl("/contacts/search", {
        method: "POST",
        body: JSON.stringify({ locationId: loc, pageLimit: 1, filters: [{ field: "email", operator: "eq", value: s.email }] }),
      });
      const c = found.body?.contacts?.[0];
      if (c) { contactId = c.id; contactPhone = c.phone || null; }
    }

    let isNew = false;
    if (!contactId) {
      const r = await ghl("/contacts/", {
        method: "POST",
        body: JSON.stringify({
          locationId: loc, email: s.email, firstName: s.name || s.email.split("@")[0],
          ...(phone ? { phone } : {}), source: "SorryMark", tags, customFields,
        }),
      });
      contactId = r.body?.contact?.id || r.body?.meta?.contactId || null;
      if (!contactId) throw new Error(`create ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
      isNew = !!r.body?.contact?.id;
    }

    if (!isNew) {
      const upd = await ghl(`/contacts/${contactId}`, {
        method: "PUT",
        body: JSON.stringify({ customFields, ...(phone && !contactPhone ? { phone } : {}) }),
      });
      if (upd.status === 400 && phone && !contactPhone) {
        await ghl(`/contacts/${contactId}`, { method: "PUT", body: JSON.stringify({ customFields }) });
      } else if (upd.status >= 300) {
        throw new Error(`update ${upd.status}: ${JSON.stringify(upd.body).slice(0, 200)}`);
      }
      await ghl(`/contacts/${contactId}/tags`, { method: "POST", body: JSON.stringify({ tags }) });
    }

    await db.from("ghl_sync_state").upsert({
      user_id: p.user_id, ghl_contact_id: contactId, hash: p.hash, synced_at: new Date().toISOString(), error: null, attempts: 0,
    });
    isNew ? created++ : updated++;
  }

  const queue = [...((pending ?? []) as Pending[])];
  async function worker() {
    while (queue.length) {
      if (Date.now() - t0 > BUDGET_MS) { skipped += queue.length; queue.length = 0; return; }
      const p = queue.shift()!;
      try {
        await syncOne(p);
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        if (errors.length < 5) errors.push(msg);
        const { data: st } = await db.from("ghl_sync_state").select("attempts").eq("user_id", p.user_id).maybeSingle();
        await db.from("ghl_sync_state").upsert({ user_id: p.user_id, error: msg.slice(0, 500), attempts: (st?.attempts ?? 0) + 1 });
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);

  const { count } = await db.rpc("ghl_sync_pending", { p_limit: 10000 }, { count: "exact", head: true });
  return Response.json({ ok: true, processed: (pending ?? []).length, created, updated, failed, skipped, remaining: count ?? null, errors, ms: Date.now() - t0 });
});
