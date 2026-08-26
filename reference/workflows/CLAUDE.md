# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A knowledge base and toolset for programmatic GHL workflow management via reverse-engineered internal APIs. This is **not a traditional codebase** -- it's documentation, schemas, and scripts. There is no build system, no tests, and no application code.

The GHL public API only supports `GET /workflows/` (metadata only). This repo documents the internal API that provides full CRUD on workflows, triggers, and action steps.

## Key Commands

```bash
# Refresh Firebase JWT for local testing (requires GHL_FIREBASE_REFRESH_TOKEN env var)
./scripts/refresh-token.sh

# Quick API test against Christians Testing location
export TOKEN="<firebase-jwt>"
export LOC="2hP6rCb3COd2HUjD25w2"
curl -s "https://backend.leadconnectorhq.com/workflow/$LOC/list?limit=5" \
  -H "token-id: $TOKEN" -H "channel: APP" | jq .
```

## Architecture: Dual Storage Model

GHL workflows split across two storage systems:

- **MongoDB** -- workflow metadata (name, status, version, timestamps). Accessed via REST at `backend.leadconnectorhq.com`.
- **Firebase Storage** -- actual workflow logic (`templates` array of action steps) and trigger definitions. Accessed via signed URLs returned in workflow metadata (`fileUrl`, `triggersFilePath`).

The public API only reads MongoDB, which is why it can't return action steps.

## Auth: Firebase JWT (NOT OAuth)

Internal API uses `token-id` header with Firebase JWT, **not** `Authorization: Bearer`. Every request also requires `channel: APP`.

- Firebase project: `highlevel-backend`
- JWT expires in ~1 hour; refresh via `securetoken.googleapis.com/v1/token`
- Refresh token never expires; stored as Cloudflare secret `GHL_FIREBASE_REFRESH_TOKEN`
- MCP worker caches ID token in KV with 55-min TTL

## MCP Tools (16 total)

Deployed on `dlf-agency` Cloudflare Worker at `https://dlf-agency.skool-203.workers.dev`. All prefixed `ghl_workflow_builder_*`. Full CRUD: `list`, `create`, `get`, `get_steps`, `get_triggers`, `update`, `save_steps`, `publish`, `draft`, `delete`, `create_trigger`, `update_trigger`, `delete_trigger`, `create_folder`, `clone`, `error_count`.

## Critical Gotchas

- **`version` field is mandatory on PUT** -- must match current version. GHL increments on each save. Stale versions are rejected.
- **Many doc type strings are WRONG** -- `create_contact` is actually `create_update_contact`, `openai_completion` is `chatgpt`, `split` is `workflow_split`, `date_formatter` is `datetime_formatter`, `internal_create_opportunity` is `create_opportunity`. Always use type strings from `verified/confirmed-type-strings.md`.
- **Action save API validates type strings strictly** -- invalid types return `"corrupted type"` 400 error. 56 types confirmed, others rejected (some need different strings or specific integrations enabled).
- **Trigger API does NOT validate type strings** -- all 44 tested trigger types were accepted. Validation happens at execution time.
- **Wait step "hours" must be "hour" (singular)** -- GHL canvas uses inconsistent unit strings: `minutes` (plural), `hour` (SINGULAR), `days` (plural). Using "hours" renders the value but not the unit label. Confirmed 2026-03-23.
- **Triggers need `targetActionId`** -- After POST creating a trigger, PUT update it with `targetActionId` pointing to the first step ID. Without this, the trigger floats disconnected on the advanced canvas.
- **Location tags must be created before trigger references them** -- `POST /workflow/{loc}/tags/create` with `{"tag": "name"}` before creating a trigger with that tag condition. Otherwise the tag renders blank.
- **Auto-save is required for advanced canvas rendering** -- `PUT /workflow/{loc}/{wfId}/auto-save` syncs steps and triggers to Firebase Storage/Firestore. Without auto-save, the advanced canvas view has no data.
- **Triggers created via API not immediately readable** -- stored in MongoDB but NOT synced to Firebase Storage. `get_triggers` reads from Firebase, so new triggers invisible until workflow is saved/published through full update cycle.
- **Workflow builder v2 is a separate microfrontend** loaded via runtime `workflowServiceURL`, not in the main app bundle.

## Test Account

| Field | Value |
|-------|-------|
| Location | `2hP6rCb3COd2HUjD25w2` (Christians Testing) |
| Company | `R1HWQKyMMoj4PJ5mAYed` |
| User | `YewkebOufK3hmeP1gx4B` |
| Test Folder | `ca2666ec-84af-4155-9d0a-1774430c98b7` (++ Agent Testing) |

## File Map

| Path | What's In It |
|------|-------------|
| `docs/api-reference.md` | Complete endpoint reference with curl examples for all CRUD operations |
| `docs/auth.md` | Firebase JWT auth flow, token refresh, permission model |
| `docs/save-modes.md` | Regular PUT vs auto-save vs publish — when to use each, build sequence |
| `docs/data-schemas.md` | Workflow metadata object schema, Firebase Storage paths |
| `docs/platform-architecture.md` | Module Federation, premium billing, feature flags, message type enum |
| `schemas/action-trigger-types.md` | 95 action types + 93 trigger types with API type strings |
| `schemas/action-schemas.md` | Attribute schemas per action type |
| `schemas/ai-employee-actions.md` | AI Employee / Conversation AI action schemas |
| `verified/confirmed-type-strings.md` | 56 action + 44 trigger type strings confirmed from live API (2026-03-22) |
| `templates/actions/*.json` | Verified JSON templates per action type with attribute schemas |
| `templates/triggers/*.json` | Verified JSON templates per trigger type |
| `templates/registry.json` | Master index of all templates |
| `results/tracker.json` | Pass/fail tracker for all type strings |
| `results/mismatches.json` | Type string corrections (doc name vs actual API name) |
| `runs/2026-03-22/` | Run logs from verification pipeline |
| `scripts/refresh-token.sh` | Firebase JWT refresh script (requires `GHL_FIREBASE_REFRESH_TOKEN` env var) |
| `docs/superpowers/specs/` | Design specs for verification system |
