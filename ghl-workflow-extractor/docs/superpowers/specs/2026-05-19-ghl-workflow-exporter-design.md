# GHL Workflow Exporter — Design

**Date:** 2026-05-19
**Status:** Approved, ready for implementation plan.

## Goal

Chrome extension that, on any GoHighLevel-based platform (including white-labeled
instances), detects when the user is on the workflows page and adds a button
that exports workflows as JSON — individually selected, or all at once. Output is
re-usable for downstream editing with Claude (no GHL UI roundtrip).

## Scope

In scope:
- Detect we're on a GHL workflows page (white-label-agnostic).
- Capture workflow data (metadata, **triggers**, **actions/settings**) passively
  from network traffic the GHL app already generates.
- Auto-fetch the rest with the user's existing auth token when bulk export is
  requested.
- Inject an "Export ▾" dropdown button in the workflows toolbar.
- Export formats: ZIP of one JSON per workflow, or a single combined JSON.

Out of scope (at the time this spec was written — see note below):
- ~~Re-importing JSONs back into GHL (no public import API).~~
  **Superseded.** A second recon round (2026-05-19) found undocumented
  POST/PUT endpoints used internally by the SPA. Import was subsequently
  implemented; see the "Write endpoints (for import)" section in
  `docs/ghl-recon.md` and the import code in `content.js`.
- ~~Modifying workflows (read-only export).~~ Same — import now writes.
- Capturing canvas/layout positions from the Firebase Storage `fileUrl`
  (the `workflowData.templates[]` linked structure is sufficient for editing).
- Capturing per-step stats (`enroll-stats-cache`, `count-per-step`).
- Firefox/Safari support — Chrome/Edge MV3 only for now.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  Top page: <your-white-label-domain> (or any white-label)       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ iframe[name="workflow-builder"]                          │  │
│  │ origin: client-app-automation-workflows.leadconnectorhq  │  │
│  │                                                          │  │
│  │   ┌─────────────────────────────────────────────────┐    │  │
│  │   │ GHL workflows SPA                               │    │  │
│  │   │   ↕ XHR/fetch                                   │    │  │
│  │   │   backend.leadconnectorhq.com/workflow/...      │    │  │
│  │   └─────────────────────────────────────────────────┘    │  │
│  │                                                          │  │
│  │   ⇣ EXTENSION CONTENT SCRIPT runs here ⇣                 │  │
│  │   - injects MAIN-world hook (fetch/XHR override)         │  │
│  │   - injects "Export ▾" button in toolbar                 │  │
│  │   - communicates with background via runtime messages    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                          ↕ chrome.runtime
                  ┌───────────────────────┐
                  │  Service worker (BG)  │
                  │  - chrome.downloads   │
                  │  - ZIP composition    │
                  └───────────────────────┘
```

**Key insight:** GHL's white-label only customizes the outer wrapper. The iframe
always loads `client-app-automation-workflows.leadconnectorhq.com`. We target
**that origin** in `content_scripts.matches`, so the extension works on every
white-label automatically.

## Components

### 1. Manifest (MV3)

```json
{
  "manifest_version": 3,
  "name": "GHL Workflow Exporter",
  "version": "0.1.0",
  "permissions": ["downloads", "storage"],
  "host_permissions": [
    "https://client-app-automation-workflows.leadconnectorhq.com/*",
    "https://backend.leadconnectorhq.com/*"
  ],
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [
    {
      "matches": ["https://client-app-automation-workflows.leadconnectorhq.com/*"],
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": true
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["page-hook.js"],
      "matches": ["https://client-app-automation-workflows.leadconnectorhq.com/*"]
    }
  ],
  "action": { "default_title": "GHL Workflow Exporter" },
  "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

Notes:
- `all_frames: true` — the SPA loads in an iframe of the white-label wrapper, so
  we must inject inside frames.
- No `webRequest` permission: response bodies aren't available via that API in
  MV3. We capture via the page hook instead.
- `host_permissions` to `backend.leadconnectorhq.com` enables the active-fallback
  fetches from the content script.

### 2. Page hook (`page-hook.js`) — MAIN world

Runs in the page's JavaScript context (not the isolated content script world)
so it can monkeypatch `window.fetch` and `XMLHttpRequest`.

Responsibilities:
- Wrap `window.fetch`:
  - Forward the call untouched.
  - When the URL matches a workflow endpoint pattern (see "Patterns to capture"),
    clone the response, parse JSON, and dispatch a `CustomEvent('ghl-export:capture', {detail:{url, body}})`.
- Wrap `XMLHttpRequest.prototype.open` + `send` similarly for any XHR-based
  endpoints (GHL appears to use `fetch` for these, but we cover both for
  resilience).
- Also intercept the **request headers** so we can capture the live
  `token-id` JWT and replay it for active-fallback fetches.

Patterns to capture (regex against full URL):
- `^https://backend\.leadconnectorhq\.com/workflow/[^/]+/list\?` → folder/workflow list
- `^https://backend\.leadconnectorhq\.com/workflow/[^/]+/[a-f0-9-]{36}\?` → workflow detail
- `^https://backend\.leadconnectorhq\.com/workflow/[^/]+/trigger\?workflowId=` → triggers

### 3. Content script (`content.js`) — isolated world

Responsibilities:
1. **Inject the page hook** by appending a `<script src="chrome-extension://…/page-hook.js">` to the page (web_accessible_resources).
2. **Listen for capture events** from the hook (`window.addEventListener('ghl-export:capture', …)`).
3. **Maintain an in-memory cache**:
   - `workflowsByLocation: Map<locationId, Map<workflowId, {meta, detail?, triggers?}>>`
   - `latestToken: string` (token-id JWT, refreshed from each captured request)
4. **Detect we're on the workflows route** (URL path `/location/{locId}/...` or
   the SPA's internal route). Use `window.location` + a MutationObserver to
   re-evaluate on SPA navigation.
5. **Inject the toolbar button** when the workflows list toolbar appears
   (MutationObserver scoped to the SPA's root). Anchor: the existing
   "Create Workflow" button — we insert a sibling `<button class="ghl-export-btn">Export ▾</button>` immediately before it.
6. **Render the dropdown menu** on click with 4 actions:
   - Export selected as ZIP
   - Export selected as single JSON
   - Export ALL as ZIP
   - Export ALL as single JSON
7. **Read selection** from the existing GHL list checkboxes (DOM scrape — they're
   in the same origin/document, so this is fine).
8. **On export, resolve missing data via active fallback**:
   - Build the target workflow ID list.
   - For each, if `detail`/`triggers` missing in cache → `fetch(...)` to the
     same backend endpoints with `token-id` header from `latestToken`.
   - Aggregate into the export structure.
9. **Send the composed export** to the service worker for ZIP packaging and download.

### 4. Service worker (`background.js`)

Responsibilities:
- Receive `{ kind: 'export', format: 'zip'|'json', workflows: […] }` messages.
- For `format=zip`: load JSZip (bundled), produce a Blob, call
  `chrome.downloads.download({ url: URL.createObjectURL(blob), filename })`.
- For `format=json`: build the combined JSON, `JSON.stringify`, download.
- Filename:
  - Single workflow: `{slug(name)}.workflow.json`
  - ZIP: `ghl-workflows-{slug(locationName||locationId)}-{YYYYMMDD-HHmm}.zip`
  - Combined JSON: `ghl-workflows-{slug(locationName||locationId)}-{YYYYMMDD-HHmm}.json`
- ZIP layout:
  ```
  {folder-slug}/{workflow-slug}.workflow.json   # workflows in folders
  _root/{workflow-slug}.workflow.json           # workflows with no folder
  _index.json                                    # array of {id, name, folder, file}
  ```

### 5. Export schema (per workflow JSON)

```json
{
  "$schema": "ghl-workflow-export/v1",
  "exportedAt": "2026-05-19T22:00:00.000Z",
  "exporter": { "name": "ghl-workflow-exporter", "version": "0.1.0" },
  "source": {
    "locationId": "<locationId>",
    "workflowId": "<workflowId>",
    "host": "client-app-automation-workflows.leadconnectorhq.com"
  },
  "workflow": { /* full response from /workflow/{locId}/{workflowId} */ },
  "triggers": [ /* array from /workflow/{locId}/trigger?workflowId=… */ ]
}
```

The combined JSON keeps the same top-level envelope (`$schema`, `exportedAt`,
`exporter`) and replaces the per-workflow fields (`source`, `workflow`, `triggers`)
with a `workflows` array, each entry containing those three keys:

```json
{
  "$schema": "ghl-workflow-export/v1",
  "exportedAt": "...",
  "exporter": { ... },
  "workflows": [
    {
      "source": { "locationId": "...", "workflowId": "...", "host": "..." },
      "workflow": { ... },
      "triggers": [ ... ]
    }
  ]
}
```

## Data flow

**Passive capture path (preferred):**
1. User opens GHL workflows page.
2. SPA fetches `/list?parentId=…`, `/{workflowId}?…`, `/trigger?…`.
3. Page hook intercepts each response, posts to content script.
4. Content script caches by workflow ID + extracts `token-id` from request headers.

**Export click path:**
1. User clicks "Export ▾" → "Export ALL as ZIP".
2. Content script enumerates all workflow IDs (from cached `/list` responses;
   if no list cached, fetches `/list?type=workflow&limit=999` once).
3. For each workflow: if `detail` or `triggers` not in cache → active-fetch with
   captured token. Show inline progress ("Fetching 4/12…").
4. Aggregate into envelopes, send to service worker.
5. Service worker zips and triggers `chrome.downloads.download`.

## Error handling

- **Token missing / expired (401)**: prompt user to reload the page; the token
  refreshes automatically on SPA load. Don't try to refresh ourselves —
  too brittle.
- **Rate limit (429)**: backoff with jitter (1s → 2s → 4s, max 3 retries). For
  this user's account, `isLocationRateLimited: false` was observed in `/list`.
- **Empty response / non-JSON**: skip workflow, append to `_errors[]` in the
  export envelope, surface a toast at the end ("Exported 11/12; 1 failed").
- **No workflows captured & no token**: button is shown but clicking it shows
  "Open at least one workflow first, then retry."

## UI specifics

- Button styling: matches the GHL "Create Workflow" button (same height, same
  font, but with a discreet gray fill to signal it's third-party). Inspect at
  install time, copy class names if possible; otherwise hardcode a stylesheet
  that mimics the look using the SPA's CSS variables.
- Dropdown: simple absolutely-positioned `<ul>` with 4 items, closes on outside
  click or Escape.
- Progress toast: bottom-right corner, `position: fixed`, 320px wide, shows
  "Exporting N/M…" with a thin progress bar. Removes itself 3s after completion.

## Open considerations (not blockers)

- **Multi-tenant agencies**: the token may include multiple `locations[]`. We
  scope the export to the location whose ID is in the current iframe URL, even
  if the token grants more.
- **Pagination**: `/list` returns `limit=10` per page. For bulk-loading the list
  ourselves we'll use `limit=999` (verify with one call); if backend caps it,
  loop with `offset`.
- **Sticky notes & canvas positions**: omitted from v1. Easy to add later by
  capturing `/sticky-notes-all` and merging the Firebase `fileUrl` snapshot.

## Testing approach

- Manual smoke test: install unpacked, visit GHL workflows page, verify the
  Export button appears, export one workflow, validate JSON in an editor, export
  all as ZIP, validate ZIP contents.
- Captured fixture: `docs/ghl-recon.md` references the live captured payloads
  (`ghl-workflow-detail.json`, `ghl-workflow-triggers.json`) which serve as the
  schema reference for assertions if we add unit tests later.

## File layout

```
ghl-workflow-exporter/
├── manifest.json
├── background.js
├── content.js
├── page-hook.js
├── lib/
│   └── jszip.min.js          # vendored (~100 KB)
├── ui/
│   ├── button.css
│   └── menu.css
├── icons/
│   ├── 16.png
│   ├── 48.png
│   └── 128.png
└── docs/
    ├── ghl-recon.md
    └── superpowers/specs/2026-05-19-ghl-workflow-exporter-design.md
```
