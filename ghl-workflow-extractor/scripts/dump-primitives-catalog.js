// GHL Workflow Primitives Catalog dumper.
//
// What it does:
//   Downloads a JSON file with the FULL catalog of GHL workflow primitives:
//   triggers, actions, integration apps — including their input field schemas.
//
// How to use:
//   1. Open a GHL workflows page in Chrome (any white-label works).
//   2. F12 → DevTools → Console.
//   3. In the console's "context" dropdown (top of the panel), pick
//      `workflow-builder` (the iframe). NOT `top`.
//   4. Paste this entire script. Press Enter.
//   5. Click around the workflow UI for a moment (open a workflow or click
//      "Add Action" / "Add Trigger") so a real GHL API request fires.
//      The script captures the live token-id from that request.
//   6. Wait. A file `ghl-primitives-catalog-YYYY-MM-DD.json` lands in Downloads.
//
// Why the click matters:
//   The token-id JWT we need is held in memory by the SPA, not in localStorage.
//   The script hooks fetch to capture it from any outgoing request. Triggering
//   navigation is the simplest way to make one fire.
//
// Endpoints hit (all GET, all with the same auth headers):
//   token-id + channel: APP + source: WEB_USER + version: 2021-04-15
//   1. /workflows-marketplace/location/{locId}/assets?workflowTypes=default,contacts
//      → native triggers + actions with full input field schemas (the gold)
//   2. /workflows-marketplace/integration-apps?locationId={locId}
//      → 3rd-party marketplace apps with auth schemas + rate limits
//   3. /marketplace/core/search/module?type=actions   (and =triggers)
//      → marketplace catalog (installed-only + all variants)
//
// Note: source=WEB_USER + version=2021-04-15 are REQUIRED. Without them,
// the marketplace service returns 401 even with a valid token-id.

(async () => {
  let token = window.__ghlExporterToken || null;

  if (!token) {
    console.log('[catalog] Hooking fetch. Click anywhere in the workflows UI to trigger a request.');
    const orig = window.fetch;
    window.fetch = function (input, init) {
      try {
        const h = (init && init.headers) || (input && input.headers);
        if (h && !token) {
          const t = (typeof h.get === 'function') ? h.get('token-id') : (h['token-id'] || h['Token-Id']);
          if (t) { token = t; console.log('[catalog] Captured live token-id'); }
        }
      } catch (_) {}
      return orig.apply(this, arguments);
    };
    for (let i = 0; i < 60; i++) {
      if (token) break;
      await new Promise(function (r) { setTimeout(r, 1000); });
    }
    window.fetch = orig;
  }

  if (!token) { console.error('[catalog] No token captured after 60s. Click a workflow row, then re-run.'); return; }

  let companyId = null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    companyId = payload.company_id;
  } catch (_) {}
  if (!companyId) { console.error('[catalog] companyId missing from JWT.'); return; }

  const locMatch = location.pathname.match(/\/location\/([^/]+)/);
  if (!locMatch) { console.error('[catalog] Not on /location/.../ URL'); return; }
  const locationId = locMatch[1];

  const BACKEND = 'https://backend.leadconnectorhq.com';
  const HEADERS = {
    'token-id': token,
    'channel': 'APP',
    'source': 'WEB_USER',
    'version': '2021-04-15',
    'accept': 'application/json, text/plain, */*'
  };

  const get = async function (url) {
    const r = await fetch(url, { headers: HEADERS, credentials: 'omit' });
    if (!r.ok) throw new Error(r.status + ' ' + url);
    return r.json();
  };

  const results = {};
  const tries = [
    ['assets',             BACKEND + '/workflows-marketplace/location/' + locationId + '/assets?workflowTypes=default,contacts'],
    ['integration_apps',   BACKEND + '/workflows-marketplace/integration-apps?locationId=' + locationId],
    ['actions_all',        BACKEND + '/marketplace/core/search/module?locationId=' + locationId + '&companyId=' + companyId + '&type=actions&skip=0&limit=500'],
    ['triggers_all',       BACKEND + '/marketplace/core/search/module?locationId=' + locationId + '&companyId=' + companyId + '&type=triggers&skip=0&limit=500'],
    ['actions_installed',  BACKEND + '/marketplace/core/search/module?locationId=' + locationId + '&companyId=' + companyId + '&type=actions&skip=0&limit=500&isInstalled=true'],
    ['triggers_installed', BACKEND + '/marketplace/core/search/module?locationId=' + locationId + '&companyId=' + companyId + '&type=triggers&skip=0&limit=500&isInstalled=true']
  ];

  for (const t of tries) {
    try { results[t[0]] = await get(t[1]); console.log('[catalog] OK', t[0]); }
    catch (e) { results[t[0]] = { __error: e.message }; console.warn('[catalog] FAIL', t[0], e.message); }
  }

  const catalog = {
    capturedAt: new Date().toISOString(),
    source: { locationId: locationId, companyId: companyId },
    notes: {
      hint: 'assets.actions[] and assets.triggers[] hold the native catalog with input schemas.',
      requiredHeaders: ['token-id', 'channel: APP', 'source: WEB_USER', 'version: 2021-04-15']
    }
  };
  for (const k of Object.keys(results)) catalog[k] = results[k];

  // Quick summary
  console.log('[catalog] Summary:');
  try {
    const a = catalog.assets;
    if (a && a.actions) {
      const ta = a.actions.reduce(function (s, g) { return s + (g.actions ? g.actions.length : 0); }, 0);
      console.log('  native actions:', ta, 'across', a.actions.length, 'apps');
    }
    if (a && a.triggers) {
      const tt = a.triggers.reduce(function (s, g) { return s + (g.triggers ? g.triggers.length : 0); }, 0);
      console.log('  native triggers:', tt, 'across', a.triggers.length, 'apps');
    }
  } catch (_) {}

  const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ghl-primitives-catalog-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  window.__ghlCatalog = catalog;
  console.log('[catalog] Downloaded. Also: window.__ghlCatalog');
})();
