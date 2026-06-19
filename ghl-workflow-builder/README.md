# GHL Automation Builder

Programmatic workflow builder for GoHighLevel. Full CRUD on workflows, triggers, actions, steps, and branches via reverse-engineered internal API.

## What This Is

GHL's public API only exposes `GET /workflows/` (list metadata). No create, update, delete, or step content. The community has 122+ votes requesting this. We reverse-engineered the internal API and built 16 MCP tools that give full programmatic control.

## Architecture

```
Claude Code Skills/Agents
    │
    ├── MCP Tools (16 workflow builder tools)
    │   └── dlf-agency Cloudflare Worker
    │       ├── Firebase JWT Auth (auto-refresh via KV)
    │       └── backend.leadconnectorhq.com (internal API)
    │
    ├── GHL Internal API
    │   ├── Workflow CRUD (MongoDB metadata)
    │   ├── Trigger CRUD (Firebase Storage)
    │   └── Action Steps (Firebase Storage)
    │
    └── New Workflow Builder v2 (separate microfrontend)
        └── Loaded via workflowServiceURL at runtime
```

## Folder Structure

| Path | Purpose |
|------|---------|
| `docs/` | Architecture, auth, API reference, platform research |
| `schemas/` | Complete action/trigger type schemas with attribute definitions |
| `scripts/` | Token retrieval, verification pipeline scripts |
| `verified/` | Confirmed API type strings from live workflow data |

## Available MCP Tools (16 total)

All tools prefixed `ghl_workflow_builder_*` on the `dlf-agency` worker.

| Tool | What it does |
|------|-------------|
| `list` | List workflows/folders in a location |
| `create` | Create a new workflow |
| `get` | Get workflow metadata |
| `get_steps` | Get action steps (templates) from Firebase Storage |
| `get_triggers` | Get trigger configs from Firebase Storage |
| `update` | Update workflow name/settings (version required) |
| `save_steps` | Save action steps (JSON templates array) |
| `publish` | Publish a workflow |
| `draft` | Set workflow to draft |
| `delete` | Delete a workflow |
| `create_trigger` | Create a trigger |
| `update_trigger` | Update a trigger |
| `delete_trigger` | Delete a trigger |
| `create_folder` | Create a folder |
| `clone` | Clone a workflow (read + remap UUIDs + recreate) |
| `error_count` | Get error notification count |

## Quick Reference

- **95 action types** across 14 categories
- **93 trigger types** across 14 categories
- **22 condition operators**
- **100+ template variables** across 12 namespaces
- **39 message types** (TYPE_CALL through TYPE_NO_SHOW)
- **17 confirmed** API type strings (live captures)
- **21 additional confirmed** from campaign builder JS source

## Auth

Firebase JWT via `token-id` header. Refresh token never expires, stored as Cloudflare secret. Auto-refresh with 55-min KV cache. See `docs/auth.md`.

## Key Limitation

Firebase JWT is scoped per-user/location. Current token covers Christians Testing only. Need separate tokens for DLF, TVAAI, etc.

## Next Steps

1. Refresh expired Firebase JWT (extract from browser IndexedDB)
2. Run verification pipeline (create test workflows with each action/trigger type)
3. Discover workflow builder v2 service URL
4. Build Claude Code skill for easy workflow management commands

## Sources

- Reverse-engineered from `app.gohighlevel.com` network traffic (2026-03-18)
- GHL frontend JS bundles (`static.leadconnectorhq.com/1190/app.js`)
- GHL help center (complete action/trigger lists)
- Open-source community MCP implementations
- GHL marketplace documentation
