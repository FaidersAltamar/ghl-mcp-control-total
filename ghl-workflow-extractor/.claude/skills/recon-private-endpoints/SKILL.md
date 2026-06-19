---
name: recon-private-endpoints
description: Use when reverse-engineering the private/undocumented HTTP API of a SaaS SPA (GoHighLevel, HubSpot admin, Linear, etc.) to build an integration, extension, or automation. Walks through Playwright-driven network recon — navigate, trigger UI, capture headers/payloads/responses, validate via replay, then document. Triggered by phrases like "find the endpoint", "how does X call its API", "reverse engineer", "what does GHL POST when I click X", "intercept the request", "non public API", "internal endpoint", "undocumented endpoint".
---

# Reverse-engineering private SPA endpoints via Playwright

For when the product has no public API (or the public API is missing the operation you need) and you want to use the same calls the official UI uses. Methodology is generic; gotchas at the bottom are GHL-specific (this skill ships with the `ghl-workflow-exporter` repo).

## Mental model

Your job is to be a polite tourist of someone else's network. You watch the official UI perform a task, copy what it does verbatim, then replay it from your code. No guessing. No "this header is probably optional." If GHL sends it, you send it.

The methodology is:

1. **Open Playwright** as the user (manual login if needed).
2. **Trigger the UI action** that performs the operation you care about.
3. **Capture** the request method, URL, **all** request headers, the request body, the response status, and the response body.
4. **Validate** by replaying the same request from `browser_evaluate` with only the captured headers. If it returns 200 with the same shape, you understand the call.
5. **Document** in a markdown table — URL, method, required headers, payload schema, response schema, when it fires.

Do not write production code until step 5 is done.

## Prerequisites

- Playwright MCP server installed (`mcp__plugin_playwright_playwright__*` tools available).
- A user account on the target product (you'll log in interactively in the Playwright browser).
- A scratch directory for sample payloads (`docs/recon-samples/` if you're in this repo).

## Tools you'll use

| Tool | What for |
|---|---|
| `mcp__plugin_playwright_playwright__browser_navigate` | Go to the page. |
| `mcp__plugin_playwright_playwright__browser_wait_for` | Wait `time` seconds for the SPA to settle. |
| `mcp__plugin_playwright_playwright__browser_snapshot` | Accessibility tree of the current page (or a sub-element via `target`). Use this to find buttons and inputs. |
| `mcp__plugin_playwright_playwright__browser_click` | Click an element by `ref` from a snapshot. |
| `mcp__plugin_playwright_playwright__browser_type` | Fill a textbox by `ref`. |
| `mcp__plugin_playwright_playwright__browser_network_requests` | List all XHR/fetch since the page loaded. Filter with `filter` regexp on URL. |
| `mcp__plugin_playwright_playwright__browser_network_request` | Get a specific request's `request-headers`, `request-body`, `response-headers`, or `response-body` by 1-based `index` from the list. Save to a file with `filename`. |
| `mcp__plugin_playwright_playwright__browser_evaluate` | Run arbitrary JS in the **top page** context. Useful for replaying a captured request. Cannot access cross-origin iframes' DOM directly — see the "iframe gotcha" below. |
| `mcp__plugin_playwright_playwright__browser_close` | Close the browser when done. |

## Phase 1 — Land on the right URL

```text
1. Identify the EXACT page where the operation lives. For GHL, the SPA
   lives inside an iframe at client-app-automation-workflows.leadconnectorhq.com,
   not at the white-label wrapper domain.
2. Navigate via browser_navigate to the wrapper URL.
3. browser_wait_for with time: 5-8 to let auth, hydration, and feature flags
   resolve. Skipping this is the #1 source of "empty network log" mistakes.
```

If the operation runs inside an iframe (very common):

- You cannot read its DOM from `browser_evaluate` on the top page (cross-origin block).
- BUT `browser_click`/`browser_type` use Playwright's frame locators and DO work across origins. Just pass a `ref` taken from a snapshot of the iframe.
- To get an iframe-scoped snapshot, call `browser_snapshot` with `target: "<iframe-ref-from-top-snapshot>"`.

## Phase 2 — Trigger the operation manually

Snapshot the page, find the button that triggers your operation, click it. If a dialog opens, fill the inputs with `browser_type` and submit. The goal is to produce one or more real HTTP calls.

Tip: do the smallest possible action. If you want to capture "save workflow", don't make 14 edits — make one toggle and click Save. Less noise in the network log.

## Phase 3 — Inspect the network log

```text
browser_network_requests({ static: false, filter: "REGEX_ON_URL" })
```

`filter` is a regex matched against the **full URL**. Useful patterns:

- `backend\.your-product\.com` — only the production API host
- `POST|PUT|DELETE` — does NOT work (method isn't in URL). Look at the column instead.
- `\/workflow|\/forms|\/your-feature` — narrow by path

Note the response codes column. A 200 with a tiny body might be `[]` (legitimately empty), and a 401 means you're calling the wrong service or missing headers.

If you don't see your call, the page probably hasn't finished loading. Wait 3-5s more and re-list.

## Phase 4 — Capture the full transaction

For each interesting request (use its 1-based `index` from the listing):

```text
browser_network_request({ index: 580, part: "request-headers" })
browser_network_request({ index: 580, part: "request-body", filename: "create-foo-payload.json" })
browser_network_request({ index: 580, part: "response-body", filename: "create-foo-response.json" })
```

Read the headers carefully. Anything that's NOT a stock browser header (`user-agent`, `accept`, `accept-language`, `sec-*`, `referer`) is suspect — it's probably required. In GHL's case we found `source: WEB_USER` and `version: 2021-04-15` were required by the marketplace service but not by the workflow service.

If the body is small enough to be readable, get it inline (no `filename`). If it's big, save to a file in `docs/recon-samples/` and read it with Node.

## Phase 5 — Validate by replay

This is the step everyone skips and regrets. Before you write production code that calls this endpoint, replay the call **from `browser_evaluate`** to prove your understanding:

```js
browser_evaluate({
  function: `async () => {
    const token = '<paste the captured token-id verbatim>';
    const r = await fetch('<paste the exact URL>', {
      method: 'POST',
      headers: {
        'token-id': token,
        'channel': 'APP',
        'source': 'WEB_USER',
        'version': '2021-04-15',
        'content-type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({ /* paste the captured body */ }),
      credentials: 'omit'
    });
    return { status: r.status, body: (await r.text()).substring(0, 400) };
  }`
})
```

If you get 200, you've understood the call. If you get 401/403, you're missing a header — diff your replay headers against the captured ones, character by character. If you get 400, your body shape is wrong.

Do this **before** writing the extension code. Saves hours.

## Phase 6 — Document

Add the endpoint to `docs/<product>-recon.md`. One entry per endpoint, with:

- HTTP verb + URL pattern
- Full required headers table
- Request body schema (with field meanings, not just types)
- Response shape
- When the SPA fires it (which UI action)
- Sensitive fields that need scrubbing if you commit the sample (signed URLs, tenant IDs)

Save the cleaned sample payloads to `docs/recon-samples/` and gitignore the folder (they often contain personal IDs).

## Sanity guardrails

- **Don't write your tool first and reverse-engineer second.** The order is recon → spec → code. If you're "coding while waiting for the recon", you're guessing.
- **Don't infer headers from one example and another's defaults.** Different microservices behind the same domain require different headers.
- **Don't trust localStorage as auth source.** SPAs typically keep a Firebase/identity-toolkit refresh token there, then trade it for a short-lived bearer held in memory. Always capture the live bearer from outgoing request headers — see the `page-hook.js` pattern in this repo.
- **Don't replay against production until your replay returns 200 in Playwright first.** Especially for write operations (POST/PUT/DELETE). The user is logged in; a buggy script can delete real data.
- **Don't push raw captures to a public repo.** They contain JWTs (short-lived but still), location IDs, signed URLs that grant read access to private files. Gitignore `docs/recon-samples/`. Document the schema in `.md` instead.

## GHL-specific gotchas (learned the hard way)

| Gotcha | Detail |
|---|---|
| Wrong origin | The white-label wrapper (`app.<agency>.com`) shows the page, but the SPA + all API calls run inside an iframe at `client-app-automation-workflows.leadconnectorhq.com`. Target that origin for content scripts. |
| Auth split | `localStorage.refreshedToken` is a Firebase identity-toolkit **refresh** token (audience `identitytoolkit.googleapis.com`). Not the API bearer. The bearer is `token-id` in outgoing request headers — only visible at runtime. |
| Marketplace headers | `/marketplace/*` and `/workflows-marketplace/*` require `source: WEB_USER` and `version: 2021-04-15` on top of `token-id` + `channel: APP`. Workflow endpoints (`/workflow/*`) do not. Without those two extras → 401. |
| Empty `installed=true` | `/marketplace/core/search/module?...&isInstalled=true` returns `[]` for tenants with no third-party apps installed. That's a feature, not a bug. Use the same URL without `isInstalled=true` to get the full catalog. |
| The auto-save endpoint | Saving a workflow uses `PUT /workflow/{locId}/{wfId}/auto-save` with the FULL workflow body + diff arrays (`createdSteps`, `modifiedSteps`, `deletedSteps`). The diffs identify what changed; the body contains the new state. |
| NaiveUI checkboxes | GHL's list checkboxes are not `<input type="checkbox">`. They're `<div class="n-checkbox" role="checkbox" aria-checked="true|false">`. Don't query for native inputs. |
| Workflow/folder UUIDs in DOM | Row UUIDs live in `td[data-col-key="name"] a[id]` — the `id` attribute holds the UUID. There's no href to scrape. |
| ZIP files in MV3 service workers | `URL.createObjectURL(blob)` URLs are NOT reachable from `chrome.downloads.download` in MV3 service workers. Convert the blob to a data: URL (base64) first. |

## Example: full session from zero to documented endpoint

```text
1. browser_navigate(url: "https://app.<your-tenant>.com/...")
2. browser_wait_for(time: 6)
3. browser_snapshot()  → find the button you need
4. browser_click(target: "<ref>", element: "Create Foo button")
5. browser_snapshot()  → confirm a dialog opened
6. browser_type(target: "<input-ref>", text: "Test")
7. browser_click(target: "<submit-ref>", element: "Submit")
8. browser_wait_for(time: 2)
9. browser_network_requests(static: false, filter: "your-feature")
   → spot the POST at index N
10. browser_network_request(index: N, part: "request-headers")
11. browser_network_request(index: N, part: "request-body", filename: "create-foo.json")
12. browser_network_request(index: N, part: "response-body")
13. browser_evaluate(function: <replay script with captured headers>)
   → expect 200
14. Add the endpoint to docs/<product>-recon.md
15. browser_close()
```

If step 13 returns a non-2xx, go back to step 10 and diff your headers more carefully. Don't skip ahead to writing the extension.
