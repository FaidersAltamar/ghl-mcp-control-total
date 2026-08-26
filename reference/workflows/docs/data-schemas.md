# Data Schemas

## Workflow Metadata Object

Returned by `GET /workflow/{locationId}/{workflowId}`. Stored in MongoDB.

```json
{
  "_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "locationId": "2hP6rCb3COd2HUjD25w2",
  "companyId": "R1HWQKyMMoj4PJ5mAYed",
  "name": "Welcome Sequence",
  "version": 3,
  "dataVersion": 7,
  "status": "published",
  "type": "workflow",
  "parentId": null,
  "allowMultiple": false,
  "timezone": "account",
  "removeContactFromLastStep": true,
  "stopOnResponse": false,
  "autoMarkAsRead": false,
  "filePath": "location/2hP6rCb3COd2HUjD25w2/workflows/a1b2c3d4-e5f6-7890-abcd-ef1234567890/3",
  "fileUrl": "https://firebasestorage.googleapis.com/v0/b/automation-workflows-production/o/...",
  "triggersFilePath": "location/2hP6rCb3COd2HUjD25w2/workflow-triggers/a1b2c3d4-e5f6-7890-abcd-ef1234567890/3",
  "permission": 380,
  "updatedBy": "YewkebOufK3hmeP1gx4B",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-16T14:30:00.000Z",
  "deleted": false,
  "creationSource": "builder",
  "originType": "user",
  "workflowData": {}
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `_id` | string (UUID) | Unique workflow identifier |
| `locationId` | string | GHL location this workflow belongs to |
| `companyId` | string | GHL company/agency ID |
| `name` | string | Display name |
| `version` | number | Increments on every save. **Must be included in PUT requests.** |
| `dataVersion` | number | Internal schema version |
| `status` | `"draft"` or `"published"` | Workflow state |
| `type` | `"workflow"` or `"directory"` | Workflow or folder |
| `parentId` | string or null | Parent folder ID (null = root) |
| `allowMultiple` | boolean | Allow contact in workflow multiple times simultaneously |
| `timezone` | string | `"account"` or IANA timezone |
| `removeContactFromLastStep` | boolean | Auto-remove contact when reaching final step |
| `stopOnResponse` | boolean | Pause workflow when contact responds |
| `autoMarkAsRead` | boolean | Mark conversation as read when contact enters |
| `filePath` | string | Firebase Storage path for templates JSON |
| `fileUrl` | string | Signed URL to download templates JSON |
| `triggersFilePath` | string | Firebase Storage path for triggers JSON |
| `permission` | number | Bitmask for access control |
| `updatedBy` | string | User ID who last modified |
| `deleted` | boolean | Soft delete flag |
| `creationSource` | string | `"builder"`, `"recipe"`, `"snapshot"` |
| `originType` | string | `"user"`, `"system"` |
| `workflowData` | object | Empty in GET; used in POST/PUT with `{templates: [...]}` |

### Firebase Storage

Workflow action steps and triggers are stored in two separate Firebase Storage buckets:

| Data | Bucket | Path Pattern |
|------|--------|-------------|
| Action steps (templates) | `automation-workflows-production` | `location/{locId}/workflows/{wfId}/{version}` |
| Triggers | `highlevel-backend.appspot.com` | `location/{locId}/workflow-triggers/{wfId}/{version}` |

To build a download URL for triggers:
```
https://firebasestorage.googleapis.com/v0/b/highlevel-backend.appspot.com/o/{URL_ENCODED_PATH}?alt=media
```

---

## Action Step (Template) Structure

Each element in the `templates` array represents one action step in the workflow.

```json
{
  "id": "step-uuid",
  "order": 0,
  "name": "Step Display Name",
  "type": "action_type_string",
  "attributes": {},
  "next": "next-step-uuid",
  "parentKey": "previous-step-uuid"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique step identifier |
| `order` | number | Position in the sequence (0-based) |
| `name` | string | Display name shown in the UI |
| `type` | string | Action type (see below) |
| `attributes` | object | Action-specific configuration |
| `next` | string, array, or null | Next step ID(s). String for linear flow, array for branching. |
| `parentKey` | string or null | Previous step ID. Null for the first step. |

### Step Linking

Steps form a linked list via `next` (forward pointer) and `parentKey` (backward pointer).

**Linear flow:**
```
Step A (next: "B") -> Step B (next: "C", parentKey: "A") -> Step C (next: null, parentKey: "B")
```

**Branching (if/else, find_opportunity):**
```
If/Else (next: ["branch-yes", "branch-no"])
  ├── Branch Yes (parentKey: "if-else-id")
  └── Branch No  (parentKey: "if-else-id")
```

---

## Action Types

### add_contact_tag

Adds one or more tags to the contact.

```json
{
  "type": "add_contact_tag",
  "attributes": {
    "tags": ["tag1", "tag2"]
  }
}
```

---

### remove_contact_tag

Removes tags from the contact.

```json
{
  "type": "remove_contact_tag",
  "attributes": {
    "tags": ["tag1"],
    "type": "remove_contact_tag"
  }
}
```

---

### sms

Sends an SMS message. Supports template variables.

```json
{
  "type": "sms",
  "attributes": {
    "body": "Hi {{contact.first_name}}, your appointment is confirmed for {{appointment.start_time}}."
  }
}
```

---

### email

Sends an email. Supports HTML body and template variables.

```json
{
  "type": "email",
  "attributes": {
    "subject": "Welcome to {{location.name}}, {{contact.first_name}}!",
    "html": "<p>Hi {{contact.first_name}},</p><p>Thanks for signing up.</p>",
    "from_name": "Support Team",
    "from_email": "hello@example.com"
  }
}
```

---

### wait

Pauses the workflow for a specified duration or until an event.

```json
{
  "type": "wait",
  "attributes": {
    "type": "time",
    "startAfter": {
      "type": "minutes",
      "value": 30,
      "when": "after"
    },
    "name": "Wait 30 Minutes",
    "isHybridAction": true,
    "hybridActionType": "wait"
  }
}
```

**Duration types for `startAfter.type`:** `"minutes"`, `"hours"`, `"days"`

**Wait types for `attributes.type`:** `"time"`, `"appointment"`

---

### if_else

Conditional branching. The `next` field must be an array with one UUID per branch.

```json
{
  "type": "if_else",
  "attributes": {
    "conditions": [
      {
        "operator": "contains",
        "field": "contact.tags",
        "value": "vip",
        "title": "Contact has VIP tag"
      }
    ]
  },
  "next": ["yes-branch-step-id", "no-branch-step-id"]
}
```

**Condition operators:** `"contains"`, `"=="`, `"!="`, `">"`, `"<"`, `">="`, `"<="`

**Condition fields:** `"contact.tags"`, `"contact.name"`, `"contact.email"`, `"contact.phone"`, and any custom field key.

---

### assign_user

Assigns a GHL user to the contact.

```json
{
  "type": "assign_user",
  "attributes": {
    "user_list": ["userId1", "userId2"],
    "traffic_split": "equally",
    "only_unassigned_contact": false
  }
}
```

**Traffic split options:** `"equally"`, `"round_robin"`

---

### add_to_workflow

Adds the contact to another workflow.

```json
{
  "type": "add_to_workflow",
  "attributes": {
    "workflowId": "target-workflow-uuid"
  }
}
```

---

### remove_from_workflow

Removes the contact from workflows.

```json
{
  "type": "remove_from_workflow",
  "attributes": {
    "allWorkflows": true,
    "includeCurrent": false
  }
}
```

---

### update_contact_field

Updates a contact field value.

```json
{
  "type": "update_contact_field",
  "attributes": {
    "fieldKey": "contact.city",
    "fieldValue": "New York"
  }
}
```

---

### find_opportunity

Searches for an opportunity in a pipeline. This is a multi-path action with "Found" and "Not Found" branches.

```json
{
  "type": "find_opportunity",
  "attributes": {
    "sorting": "latest",
    "__customInputFields__": [
      {
        "value": "eq",
        "secondValue": "pipeline-id",
        "filterField": "pipeline_id"
      }
    ],
    "cat": "multi-path",
    "convertToMultipath": true,
    "transitions": [
      {"id": "found-branch-uuid", "name": "Found"},
      {"id": "not-found-branch-uuid", "name": "Not Found"}
    ]
  },
  "next": ["found-branch-uuid", "not-found-branch-uuid"]
}
```

---

### internal_create_opportunity

Creates a new opportunity in a pipeline.

```json
{
  "type": "internal_create_opportunity",
  "attributes": {
    "pipelineId": "pipeline-id",
    "stageId": "stage-id"
  }
}
```

---

### internal_update_opportunity

Moves an opportunity to a different stage.

```json
{
  "type": "internal_update_opportunity",
  "attributes": {
    "pipelineId": "pipeline-id",
    "pipelineStageId": "stage-id",
    "allowBackward": false
  }
}
```

---

### internal_notification

Sends an internal notification to team members.

```json
{
  "type": "internal_notification",
  "attributes": {
    "type": "email",
    "email": {
      "subject": "New lead: {{contact.first_name}} {{contact.last_name}}",
      "userType": "assign"
    }
  }
}
```

---

### slack_message

Sends a message to a Slack channel (requires Slack integration).

```json
{
  "type": "slack_message",
  "attributes": {
    "channel": {"id": "C01234567", "name": "general"},
    "text": "New lead from {{contact.first_name}}",
    "action": {"id": "", "name": ""},
    "integration": {"id": "integration-id", "name": "Workspace Name"}
  }
}
```

---

### goto

Jumps to a specific step in the workflow (loop/redirect).

```json
{
  "type": "goto",
  "attributes": {
    "targetId": "target-step-uuid"
  }
}
```

---

### transition

Branch path marker used with multi-path actions (find_opportunity). Has no attributes of its own -- it serves as the entry point for a branch.

```json
{
  "type": "transition",
  "attributes": {}
}
```

---

## Trigger Structure

```json
{
  "id": "trigger-uuid",
  "type": "contact_tag_added",
  "name": "Tag Added: new-lead",
  "active": true,
  "masterType": "highlevel",
  "workflow_id": "workflow-uuid",
  "location_id": "location-id",
  "conditions": [
    {
      "operator": "==",
      "field": "contact.tags",
      "value": "new-lead",
      "title": "Tag",
      "type": "select"
    }
  ],
  "actions": [
    {
      "workflow_id": "workflow-uuid",
      "type": "add_to_workflow"
    }
  ],
  "schedule_config": {}
}
```

### Trigger Types (Confirmed)

| Type | Description |
|------|-------------|
| `contact_tag_added` | Fires when a specific tag is added to a contact |
| `appointment` | Fires on appointment events (booked, confirmed, cancelled) |
| `contact_created` | Fires when a new contact is created |
| `form_submitted` | Fires when a form is submitted |

### Trigger Condition Fields

| Field | Used With | Description |
|-------|-----------|-------------|
| `contact.tags` | `contact_tag_added` | Tag name to match |
| `appointment.eventType` | `appointment` | `"normal"`, `"collective"`, etc. |
| `appointment.status` | `appointment` | `"confirmed"`, `"cancelled"`, `"showed"`, `"noshow"` |
| `calendar.id` | `appointment` | Specific calendar ID to filter |

---

## Template Variables

GHL supports variable interpolation in SMS, email, and notification templates.

### Contact Variables
| Variable | Description |
|----------|-------------|
| `{{contact.first_name}}` | Contact first name |
| `{{contact.last_name}}` | Contact last name |
| `{{contact.email}}` | Contact email |
| `{{contact.phone}}` | Contact phone |
| `{{contact.name}}` | Contact full name |

### Appointment Variables
| Variable | Description |
|----------|-------------|
| `{{appointment.start_time}}` | Appointment start time |
| `{{appointment.only_start_date}}` | Appointment date only |
| `{{appointment.end_time}}` | Appointment end time |

### Location Variables
| Variable | Description |
|----------|-------------|
| `{{location.name}}` | Business/location name |
| `{{location.phone}}` | Location phone number |
| `{{location.address}}` | Location address |
