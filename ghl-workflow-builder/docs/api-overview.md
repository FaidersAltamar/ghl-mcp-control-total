# GHL Workflow API -- Undocumented Internal Reference

## What This Is

GoHighLevel's workflow engine is the backbone of their automation platform, but there is **no public API documentation** for creating, updating, or managing workflows programmatically. The official API only exposes a read-only `GET /workflows/` endpoint that returns metadata -- no actions, no triggers, no way to build anything.

This repository contains **confirmed, tested API endpoints** for the internal workflow engine that powers the GHL UI. Every endpoint documented here was discovered through traffic analysis and validated with working requests against live GHL accounts.

## What You Can Do With This

- **Create workflows** with named action steps (SMS, email, tags, wait, if/else, opportunities)
- **Read full workflow definitions** including all action steps and their configurations
- **Update workflows** -- add/remove/reorder steps, change step attributes
- **Clone workflows** across locations by exporting and re-importing the templates array
- **Manage triggers** -- create, update, and delete workflow triggers programmatically
- **Publish/unpublish** workflows via status change endpoint
- **Organize** workflows into folders (directories)

## Key Discovery: Dual Storage Architecture

GHL workflows use a split storage model:

1. **MongoDB** stores workflow metadata (name, status, version, timestamps, permissions)
2. **Firebase Storage** stores the actual workflow logic (`templates` array of action steps) and trigger definitions

When you `GET` a workflow, the response includes a `fileUrl` (signed Firebase URL) pointing to the templates JSON. When you `PUT` a workflow with `workflowData.templates`, GHL writes the templates to Firebase and returns the new signed URL.

This is why the public API only returns metadata -- it reads MongoDB but never fetches the Firebase payload.

## Quick Start

```bash
# Set your credentials
export TOKEN="your-firebase-jwt"
export LOC="your-location-id"
export BASE="https://backend.leadconnectorhq.com"

# List all workflows
curl -s "$BASE/workflow/$LOC/list?limit=50&offset=0" \
  -H "token-id: $TOKEN" \
  -H "channel: APP" | jq '.rows[] | {id: ._id, name: .name, status: .status}'

# Create a workflow with an SMS step
curl -s -X POST "$BASE/workflow/$LOC" \
  -H "token-id: $TOKEN" \
  -H "channel: APP" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Workflow",
    "workflowData": {
      "templates": [{
        "id": "'$(uuidgen | tr A-Z a-z)'",
        "order": 0,
        "name": "Send Welcome SMS",
        "type": "sms",
        "attributes": {"body": "Hi {{contact.first_name}}, welcome!"},
        "next": null,
        "parentKey": null
      }]
    }
  }' | jq .
```

## Documentation

| File | Contents |
|------|----------|
| [api-reference.md](api-reference.md) | Complete endpoint reference with curl examples |
| [data-schemas.md](data-schemas.md) | Workflow, trigger, and action type schemas |
| [auth.md](auth.md) | Authentication flow, JWT structure, token refresh |
| [examples/create-workflow.sh](examples/create-workflow.sh) | Working script to create a multi-step workflow |
| [examples/clone-workflow.sh](examples/clone-workflow.sh) | Script to clone a workflow across locations |

## Important Caveats

- **Firebase JWTs expire in ~1 hour.** There is no long-lived token. You need the Firebase SDK or a custom token refresh flow for sustained programmatic access.
- **The `version` field is critical.** Every PUT must include the current version number. GHL increments it on each save. Stale versions are rejected.
- **This is an internal API.** GHL can change it without notice. Endpoints were confirmed working as of 2025, but no stability guarantees exist.
- **The `token-id` header is NOT `Authorization: Bearer`.** This trips up everyone on first attempt.

## Test Account

All examples in this repo were validated against:

| Field | Value |
|-------|-------|
| Location | `2hP6rCb3COd2HUjD25w2` (Christians Testing) |
| Company | `R1HWQKyMMoj4PJ5mAYed` |
| User | `YewkebOufK3hmeP1gx4B` |
| Test Folder | `ca2666ec-84af-4155-9d0a-1774430c98b7` (++ Agent Testing) |

## License

This is research documentation. Use at your own risk. Not affiliated with or endorsed by GoHighLevel.
