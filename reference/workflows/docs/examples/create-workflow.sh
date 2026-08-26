#!/bin/bash
# create-workflow.sh
#
# Creates a multi-step GHL workflow with:
#   1. Add tag "new-lead"
#   2. Send welcome SMS
#   3. Wait 5 minutes
#   4. If/else: check for "vip" tag
#   5a. (Yes branch) Send VIP email
#   5b. (No branch) Send standard email
#
# Then attaches a trigger: fires when "new-lead" tag is added.
#
# Usage:
#   export TOKEN="your-firebase-jwt"
#   export LOC="your-location-id"
#   export USER_ID="your-ghl-user-id"
#   ./create-workflow.sh

set -euo pipefail

BASE="https://backend.leadconnectorhq.com"

# --- Validate environment ---
if [ -z "${TOKEN:-}" ] || [ -z "${LOC:-}" ]; then
  echo "ERROR: Set TOKEN and LOC environment variables first."
  echo "  export TOKEN=\"your-firebase-jwt\""
  echo "  export LOC=\"your-location-id\""
  exit 1
fi

USER_ID="${USER_ID:-}"

# --- Generate step IDs ---
STEP_TAG=$(uuidgen | tr 'A-Z' 'a-z')
STEP_SMS=$(uuidgen | tr 'A-Z' 'a-z')
STEP_WAIT=$(uuidgen | tr 'A-Z' 'a-z')
STEP_IFELSE=$(uuidgen | tr 'A-Z' 'a-z')
STEP_VIP_EMAIL=$(uuidgen | tr 'A-Z' 'a-z')
STEP_STD_EMAIL=$(uuidgen | tr 'A-Z' 'a-z')

echo "=== Creating workflow ==="

RESPONSE=$(curl -s -X POST "$BASE/workflow/$LOC" \
  -H "token-id: $TOKEN" \
  -H "channel: APP" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API-Created Welcome Flow",
    "workflowData": {
      "templates": [
        {
          "id": "'"$STEP_TAG"'",
          "order": 0,
          "name": "Tag as New Lead",
          "type": "add_contact_tag",
          "attributes": {"tags": ["new-lead", "api-created"]},
          "next": "'"$STEP_SMS"'",
          "parentKey": null
        },
        {
          "id": "'"$STEP_SMS"'",
          "order": 1,
          "name": "Send Welcome SMS",
          "type": "sms",
          "attributes": {"body": "Hi {{contact.first_name}}, thanks for reaching out to {{location.name}}! We will be in touch shortly."},
          "next": "'"$STEP_WAIT"'",
          "parentKey": "'"$STEP_TAG"'"
        },
        {
          "id": "'"$STEP_WAIT"'",
          "order": 2,
          "name": "Wait 5 Minutes",
          "type": "wait",
          "attributes": {
            "type": "time",
            "startAfter": {"type": "minutes", "value": 5, "when": "after"},
            "name": "Wait 5 Minutes",
            "isHybridAction": true,
            "hybridActionType": "wait"
          },
          "next": "'"$STEP_IFELSE"'",
          "parentKey": "'"$STEP_SMS"'"
        },
        {
          "id": "'"$STEP_IFELSE"'",
          "order": 3,
          "name": "Is VIP?",
          "type": "if_else",
          "attributes": {
            "conditions": [
              {"operator": "contains", "field": "contact.tags", "value": "vip", "title": "Has VIP tag"}
            ]
          },
          "next": ["'"$STEP_VIP_EMAIL"'", "'"$STEP_STD_EMAIL"'"],
          "parentKey": "'"$STEP_WAIT"'"
        },
        {
          "id": "'"$STEP_VIP_EMAIL"'",
          "order": 4,
          "name": "Send VIP Email",
          "type": "email",
          "attributes": {
            "subject": "Welcome to the VIP program, {{contact.first_name}}!",
            "html": "<h1>Welcome, {{contact.first_name}}!</h1><p>As a VIP member, you get exclusive access to our premium services.</p>",
            "from_name": "VIP Team",
            "from_email": "vip@example.com"
          },
          "next": null,
          "parentKey": "'"$STEP_IFELSE"'"
        },
        {
          "id": "'"$STEP_STD_EMAIL"'",
          "order": 5,
          "name": "Send Standard Email",
          "type": "email",
          "attributes": {
            "subject": "Welcome, {{contact.first_name}}!",
            "html": "<h1>Welcome!</h1><p>Thanks for joining us, {{contact.first_name}}. We look forward to serving you.</p>",
            "from_name": "Support",
            "from_email": "support@example.com"
          },
          "next": null,
          "parentKey": "'"$STEP_IFELSE"'"
        }
      ]
    }
  }')

echo "$RESPONSE" | jq .

WF_ID=$(echo "$RESPONSE" | jq -r '.id')

if [ "$WF_ID" = "null" ] || [ -z "$WF_ID" ]; then
  echo "ERROR: Failed to create workflow."
  echo "Response: $RESPONSE"
  exit 1
fi

echo ""
echo "Workflow created: $WF_ID"

# --- Create trigger ---
echo ""
echo "=== Creating trigger (contact_tag_added: new-lead) ==="

TRIGGER_RESPONSE=$(curl -s -X POST "$BASE/workflow/$LOC/trigger" \
  -H "token-id: $TOKEN" \
  -H "channel: APP" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "contact_tag_added",
    "name": "Tag Added: new-lead",
    "active": true,
    "workflowId": "'"$WF_ID"'",
    "conditions": [
      {"operator": "==", "field": "contact.tags", "value": "new-lead", "title": "Tag", "type": "select"}
    ],
    "actions": [{"workflow_id": "'"$WF_ID"'", "type": "add_to_workflow"}]
  }')

echo "$TRIGGER_RESPONSE" | jq .

TRIGGER_ID=$(echo "$TRIGGER_RESPONSE" | jq -r '.id')
echo "Trigger created: $TRIGGER_ID"

# --- Publish workflow ---
if [ -n "$USER_ID" ]; then
  echo ""
  echo "=== Publishing workflow ==="

  curl -s -X PUT "$BASE/workflow/$LOC/change-status/$WF_ID" \
    -H "token-id: $TOKEN" \
    -H "channel: APP" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "published",
      "updatedBy": "'"$USER_ID"'"
    }' | jq .

  echo "Workflow published."
else
  echo ""
  echo "Skipping publish (set USER_ID to auto-publish)."
  echo "  export USER_ID=\"your-ghl-user-id\""
fi

echo ""
echo "=== Done ==="
echo "Workflow ID: $WF_ID"
echo "Trigger ID:  $TRIGGER_ID"
echo ""
echo "View in GHL: https://app.gohighlevel.com/location/$LOC/workflows/$WF_ID"
