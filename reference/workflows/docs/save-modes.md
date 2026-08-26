# Save Modes

GHL workflows have multiple save mechanisms that serve different purposes. Using the wrong one causes data to be invisible in the UI or lost entirely.

## Overview

| Save Method | Endpoint | What It Does | When to Use |
|-------------|----------|-------------|-------------|
| **Regular PUT** | `PUT /workflow/{loc}/{wfId}` | Saves steps to MongoDB + Firebase Storage | Saving/updating action steps |
| **Auto-Save** | `PUT /workflow/{loc}/{wfId}/auto-save` | Syncs to Firebase/Firestore for advanced canvas | After steps + triggers are saved, to make them visible in advanced canvas |
| **Change Status** | `PUT /workflow/{loc}/change-status/{wfId}` | Publish or unpublish | Going live or reverting to draft |
| **Create with Steps** | `POST /workflow/{loc}` | Creates workflow + inline steps | New workflow with initial steps |

## Regular PUT Save (`save_steps`)

The standard save updates workflow metadata and action steps in MongoDB, which then syncs to Firebase Storage.

**Endpoint:** `PUT /workflow/{locationId}/{workflowId}`

**Key requirement:** The `version` field is **mandatory** and must match the current version. Each successful PUT increments the version, so you must re-fetch between sequential saves.

**MCP Tool:** `ghl_workflow_builder_save_steps`

```bash
# 1. Get current version
VERSION=$(curl -s "$BASE/workflow/$LOC/$WF_ID" "${HEADERS[@]}" | jq '.version')

# 2. Save with version
curl -s -X PUT "$BASE/workflow/$LOC/$WF_ID" \
  "${HEADERS[@]}" \
  -d '{
    "version": '"$VERSION"',
    "workflowData": {
      "templates": [
        {
          "id": "step-001",
          "order": 0,
          "name": "Tag Contact",
          "type": "add_contact_tag",
          "attributes": {"tags": ["new-lead"]},
          "next": "step-002",
          "parentKey": null
        }
      ]
    }
  }'
```

**What happens internally:**
1. Validates `version` matches current (rejects stale versions)
2. Writes step data to MongoDB
3. Uploads `templates` array to Firebase Storage at the workflow's `fileUrl` path
4. Increments `version` by 1

**Limitations:**
- Does NOT update the advanced canvas view
- Triggers are NOT included in this payload
- Must re-fetch version before next save

## Auto-Save (Advanced Canvas Sync)

Auto-save is the mechanism GHL's advanced canvas builder uses internally. It syncs steps AND triggers to Firebase Storage/Firestore so the advanced canvas UI can render them.

**Endpoint:** `PUT /workflow/{locationId}/{workflowId}/auto-save`

**MCP Tool:** `ghl_workflow_builder_auto_save`

**When to use:** Call auto-save AFTER you've already saved steps (via regular PUT) and created triggers (via trigger API). Auto-save is the final sync step that makes everything visible in the advanced canvas.

### Auto-Save Payload Structure

The auto-save payload is significantly more complex than a regular save. The MCP worker builds it automatically:

```json
{
  "status": "draft",
  "meta": {
    "advanceCanvasMeta": {
      "enabled": true,
      "enabledAt": "2026-03-24T10:00:00.000Z"
    }
  },
  "workflowData": {
    "templates": [
      {
        "id": "step-001",
        "order": 0,
        "name": "Tag Contact",
        "type": "add_contact_tag",
        "attributes": {"tags": ["new-lead"]},
        "next": "step-002",
        "parentKey": null,
        "cat": "",
        "advanceCanvasMeta": {
          "position": {"x": 400, "y": 0}
        }
      }
    ]
  },
  "triggersChanged": true,
  "oldTriggers": [/* trigger objects */],
  "newTriggers": [/* trigger objects */],
  "isAutoSave": true,
  "autoSaveSession": {
    "workflowId": "uuid",
    "id": "random-uuid",
    "userId": "user-id",
    "version": 1,
    "inProgress": true
  },
  "scheduledPauseDates": [],
  "modifiedSteps": [],
  "deletedSteps": [],
  "createdSteps": [],
  "senderAddress": {},
  "eventStartDate": ""
}
```

### Key Fields Unique to Auto-Save

| Field | Purpose |
|-------|---------|
| `meta.advanceCanvasMeta.enabled` | Enables the advanced canvas view for this workflow |
| `advanceCanvasMeta.position` | X/Y coordinates for each step on the canvas |
| `triggersChanged` | Set `true` if triggers should be synced |
| `oldTriggers` / `newTriggers` | Trigger state before/after (MCP sets both to current state) |
| `isAutoSave` | Signals this is an auto-save (not a manual user save) |
| `autoSaveSession` | Session tracking with unique ID, version, and user |

### How the MCP Worker Builds Auto-Save

The `autoSaveWorkflow()` method in `workflow-builder.ts`:

1. **Fetches current workflow state** via `GET /workflow/{loc}/{wfId}`
2. **Enables advanced canvas** by setting `meta.advanceCanvasMeta.enabled = true`
3. **Adds canvas positions** to each step (default: `x: 400 + idx * 300, y: 0`)
4. **Formats triggers** with required fields (`workflow_id`, `location_id`, `belongs_to`, `advanceCanvasMeta`)
5. **Builds full payload** merging current state with new data
6. **Sends PUT** to `/workflow/{loc}/{wfId}/auto-save`

### Trigger Format for Auto-Save

Triggers in the auto-save payload need extra fields compared to the trigger CRUD API:

```json
{
  "type": "contact_tag_added",
  "name": "Tag Added",
  "active": true,
  "workflow_id": "wf-uuid",
  "location_id": "loc-id",
  "belongs_to": "workflow",
  "deleted": false,
  "date_added": "2026-03-24T10:00:00.000Z",
  "date_updated": "2026-03-24T10:00:00.000Z",
  "advanceCanvasMeta": {
    "position": {"x": 57.5, "y": -73}
  }
}
```

## Change Status (Publish / Draft)

Publishes or unpublishes a workflow. Does NOT modify steps or triggers.

**Endpoint:** `PUT /workflow/{locationId}/change-status/{workflowId}`

**MCP Tools:** `ghl_workflow_builder_publish`, `ghl_workflow_builder_draft`

```bash
# Publish
curl -s -X PUT "$BASE/workflow/$LOC/change-status/$WF_ID" \
  "${HEADERS[@]}" \
  -d '{
    "status": "published",
    "updatedBy": "USER_ID"
  }'

# Unpublish (back to draft)
curl -s -X PUT "$BASE/workflow/$LOC/change-status/$WF_ID" \
  "${HEADERS[@]}" \
  -d '{
    "status": "draft",
    "updatedBy": "USER_ID"
  }'
```

**Requirements:**
- `updatedBy` is mandatory (your GHL user ID)
- Does not require a `version` number
- Does not affect workflow steps or triggers

## Recommended Build Sequence

For programmatic workflow builds (what the MCP tools do), follow this exact order:

```
1. POST /workflow/{loc}                    → Create workflow (get ID)
2. PUT  /workflow/{loc}/{wfId}             → Save action steps (with version)
3. POST /workflow/{loc}/trigger            → Create trigger(s)
4. PUT  /workflow/{loc}/trigger/{id}       → Update trigger with targetActionId
5. PUT  /workflow/{loc}/{wfId}/auto-save   → Sync everything to advanced canvas
6. PUT  /workflow/{loc}/change-status/{id} → Publish (optional)
```

**Why this order matters:**
- Steps must exist before triggers can reference `targetActionId`
- Triggers must exist before auto-save can sync them
- Auto-save must run before the advanced canvas will show anything
- Publishing should be last (only publish when everything is verified)

## Common Pitfalls

### "Steps saved but invisible in advanced canvas"
**Cause:** Auto-save was not called after saving steps.
**Fix:** Call `ghl_workflow_builder_auto_save` with the current templates array.

### "Trigger floats disconnected on canvas"
**Cause:** Trigger was created but `targetActionId` was not set.
**Fix:** `PUT /workflow/{loc}/trigger/{triggerId}` with `targetActionId` pointing to the first step ID.

### "Version conflict on save"
**Cause:** The `version` in your PUT payload doesn't match the server's current version.
**Fix:** Re-fetch the workflow (`GET`) to get the latest version, then retry the save.

### "Triggers created but not readable via get_triggers"
**Cause:** Triggers created via POST are stored in MongoDB but NOT synced to Firebase Storage. The `get_triggers` tool reads from Firebase.
**Fix:** Call auto-save after creating triggers. This syncs them to Firebase via the `triggersChanged` + `newTriggers` fields.

### "Steps visible in standard builder but not advanced canvas"
**Cause:** Regular PUT saves to MongoDB/Firebase Storage, but the advanced canvas reads from Firestore (a different Firebase product).
**Fix:** Auto-save is the only way to populate the Firestore data that the advanced canvas reads.
