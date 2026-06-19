# Verification Pipeline

Step-by-step process to confirm all inferred action/trigger type strings against the live GHL API.

## Prerequisites

1. Valid Firebase JWT (run `./refresh-token.sh` first)
2. Access to Christians Testing location (`2hP6rCb3COd2HUjD25w2`)
3. MCP tools available (`ghl_workflow_builder_*` on dlf-agency)

## Strategy

Create test workflows in the GHL UI (one per category), then read them back via the internal API to capture exact type strings and default attribute schemas.

## Step 1: Create Test Workflows in GHL UI

Log into app.gohighlevel.com > Christians Testing > Automation > Workflows.
Create one workflow per category, add every available action:

| Workflow Name | Actions to Add |
|--------------|----------------|
| `__VERIFY_Contact` | Create Contact, Find Contact, Update Field, Add Tag, Remove Tag, Assign User, Remove User, Edit Conversation, DND, Add Note, Add Task, Copy Contact, Delete Contact, Engagement Score, Followers |
| `__VERIFY_Communication` | SMS, Email, Call, Voicemail, Slack, FB Messenger, IG DM, WhatsApp, GMB, Live Chat, Manual Action, Notification, Review Request, Conv AI, FB Interactive, IG Interactive, Reply Comments |
| `__VERIFY_SendData` | Webhook, Custom Webhook, Google Sheets |
| `__VERIFY_InternalTools` | If/Else, Wait, Goal, Split, GoTo, Add/Remove Workflow, Custom Value, Drip, Text Formatter, Number Formatter, Date Formatter, Math, Custom Code, Arrays |
| `__VERIFY_AI` | AI Prompt, AI Summarize, Eliza Booking, Eliza Agent |
| `__VERIFY_Pipeline` | Create Opp, Update Opp, Find Opp, Remove Opp |
| `__VERIFY_Payments` | Stripe Charge, Send Invoice, Send Document |
| `__VERIFY_Marketing` | GA, AdWords, FB Add Audience, FB Remove Audience, FB CAPI |
| `__VERIFY_IVR` | Gather Input, Play Message, Connect Call, End Call, Record Voicemail |
| `__VERIFY_Membership` | Grant Offer, Revoke Offer, Grant Group, Revoke Group |

Also create trigger-specific workflows:

| Workflow Name | Triggers to Add |
|--------------|-----------------|
| `__VERIFY_Triggers_Contact` | All 12 contact triggers |
| `__VERIFY_Triggers_Events` | All 22 event triggers |
| `__VERIFY_Triggers_Appointment` | All 4 appointment triggers |
| `__VERIFY_Triggers_Opportunity` | All 5 opportunity triggers |
| `__VERIFY_Triggers_Payment` | All 12 payment triggers |
| `__VERIFY_Triggers_Other` | All remaining triggers |

## Step 2: Read Back via API

For each workflow:
```bash
# Get workflow metadata
ghl_workflow_builder_get --locationId 2hP6rCb3COd2HUjD25w2 --workflowId {id}

# Get action steps
ghl_workflow_builder_get_steps --locationId 2hP6rCb3COd2HUjD25w2 --workflowId {id}

# Get triggers
ghl_workflow_builder_get_triggers --locationId 2hP6rCb3COd2HUjD25w2 --workflowId {id}
```

## Step 3: Document

For each action/trigger found:
1. Record exact `type` string
2. Record full `attributes` object (default values)
3. Note any fields not documented
4. Update `verified/confirmed-type-strings.md`

## Step 4: Cleanup

Delete all `__VERIFY_*` workflows after verification is complete.
