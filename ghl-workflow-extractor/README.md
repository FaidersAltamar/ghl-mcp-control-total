# GHL Workflow Exporter

Chrome extension that exports GoHighLevel workflows (triggers + actions +
settings) as JSON or ZIP. Works on every white-label GHL instance because it
targets the underlying `client-app-automation-workflows.leadconnectorhq.com`
iframe rather than the wrapper domain.

## Install (Chrome / Edge)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this folder: `Desktop/ghl-workflow-exporter`.
5. Pin the extension if you want it visible in the toolbar.

## Use

1. Open your GHL dashboard and navigate to **Automation → Workflows**.
2. An **Export / Import ▾** button appears next to **Create Workflow**.
3. Click it for one of:
   - **Export selected as ZIP** — uses the row checkboxes you already ticked.
   - **Export selected as single JSON** — same, but as one combined file.
   - **Export ALL workflows as ZIP** — bulk-fetches everything, builds a tree.
   - **Export ALL workflows as single JSON** — same, one big file.
   - **Import workflow(s) from JSON or ZIP…** — opens a file picker.
4. Exports download to your default Downloads folder.

## Import

The Import action accepts:
- A **single workflow JSON** exported by this extension.
- A **combined JSON** (the bulk "single JSON" format) — every workflow inside is imported.
- A **ZIP** previously exported by this tool — every `.workflow.json` inside is imported.

For each workflow, the extension:
1. Creates an empty draft workflow with the original name.
2. POSTs every trigger from the source.
3. PUTs the full step tree (`workflowData.templates[]`) onto the new workflow.

### Important caveats

- **Cross-tenant references won't auto-remap.** If a workflow references a
  pipeline ID, calendar ID, custom field ID, user ID, etc. from the source
  location, those IDs are imported as-is. Steps that depend on missing IDs
  will be saved but won't function until you fix them manually.
- **Imported workflows land as `draft`.** You publish manually after reviewing.
- **No deduplication.** Importing the same JSON twice creates two workflows
  with the same name.

## What you get

### Single workflow JSON
```json
{
  "$schema": "ghl-workflow-export/v1",
  "exportedAt": "2026-05-19T22:00:00.000Z",
  "exporter": { "name": "ghl-workflow-exporter", "version": "0.1.0" },
  "source": { "locationId": "...", "workflowId": "...", "host": "..." },
  "workflow": { /* full workflow doc with workflowData.templates[] */ },
  "triggers": [ /* full triggers array */ ]
}
```

### ZIP layout
```
{folder-slug}/{workflow-slug}.workflow.json    # workflows inside a GHL folder
_root/{workflow-slug}.workflow.json            # workflows with no folder
_index.json                                     # manifest of everything in the zip
```

### Combined JSON (bulk)
Same envelope as single, but `source/workflow/triggers` are wrapped in a
`workflows: []` array.

## Notes

- The first time you open a workflow page, the extension passively captures
  list/detail/trigger responses as the GHL SPA loads them. For **Export ALL**,
  the extension will re-fetch any workflows you haven't opened yet, silently,
  using your existing auth token.
- If you see *"No auth token captured — open at least one workflow first"*,
  click into any workflow once and try again. The token refreshes per-page-load.
- Works for any white-labeled GHL — the extension matches on the inner SPA
  origin, not on your wrapper domain.

## File layout

```
ghl-workflow-exporter/
├── manifest.json
├── background.js        # service worker: ZIP, downloads
├── content.js           # isolated-world: cache, UI, export orchestration
├── page-hook.js         # MAIN-world: fetch/XHR capture
├── styles.css
├── lib/jszip.min.js
├── icons/{16,48,128}.png
├── scripts/make-icons.js
└── docs/
    ├── ghl-recon.md
    ├── recon-samples/   # captured live payloads
    └── superpowers/specs/2026-05-19-ghl-workflow-exporter-design.md
```

## Reverse-engineered endpoints

All calls are GET against `https://backend.leadconnectorhq.com`, with the
`token-id` Firebase JWT (auto-managed by GHL) and `channel: APP` header:

| Endpoint | Returns |
|---|---|
| `/workflow/{locationId}/list?parentId=root` | Top-level folders |
| `/workflow/{locationId}/list?type=workflow` | All workflows (paginated) |
| `/workflow/{locationId}/{workflowId}?includeScheduledPauseInfo=true&sessionId=...` | Workflow doc incl. `workflowData.templates[]` (actions) |
| `/workflow/{locationId}/trigger?workflowId={workflowId}` | Triggers array |

Schemas are documented in `docs/ghl-recon.md` and live samples in `docs/recon-samples/`.

## Out of scope for v1

- Canvas/layout positions (would need to fetch the Firebase Storage `fileUrl`).
- Sticky notes.
- Per-step enrollment stats.
- Cross-tenant ID remapping (pipeline / calendar / custom field / user IDs in
  imported workflows still point at the source tenant — see Import caveats above).

## License

Personal use. Reverse-engineered against the GHL public-facing client API; no
private credentials, secrets, or undocumented internals are bundled.
