#!/bin/bash
# clone-workflow.sh
#
# Clones a GHL workflow from one location to another (or within the same location).
# Exports the full workflow definition (metadata + action steps from Firebase),
# then recreates it in the target location with new step IDs.
#
# Usage:
#   export TOKEN="your-firebase-jwt"
#   export SOURCE_LOC="source-location-id"
#   export TARGET_LOC="target-location-id"
#   export WF_ID="workflow-id-to-clone"
#   ./clone-workflow.sh
#
# Optional:
#   export TARGET_FOLDER="folder-id"    # Place clone in a specific folder
#   export PREFIX="[CLONE] "            # Prefix for cloned workflow name

set -euo pipefail

BASE="https://backend.leadconnectorhq.com"

# --- Validate environment ---
if [ -z "${TOKEN:-}" ] || [ -z "${SOURCE_LOC:-}" ] || [ -z "${WF_ID:-}" ]; then
  echo "ERROR: Required environment variables not set."
  echo "  export TOKEN=\"your-firebase-jwt\""
  echo "  export SOURCE_LOC=\"source-location-id\""
  echo "  export WF_ID=\"workflow-id-to-clone\""
  echo "  export TARGET_LOC=\"target-location-id\"   # optional, defaults to SOURCE_LOC"
  exit 1
fi

TARGET_LOC="${TARGET_LOC:-$SOURCE_LOC}"
TARGET_FOLDER="${TARGET_FOLDER:-}"
PREFIX="${PREFIX:-[Clone] }"

HEADERS=(-H "token-id: $TOKEN" -H "channel: APP" -H "Content-Type: application/json")

# --- Step 1: Fetch source workflow metadata ---
echo "=== Step 1: Fetching source workflow ==="
echo "  Location: $SOURCE_LOC"
echo "  Workflow: $WF_ID"
echo ""

METADATA=$(curl -s "$BASE/workflow/$SOURCE_LOC/$WF_ID" "${HEADERS[@]}")

WF_NAME=$(echo "$METADATA" | jq -r '.name')
FILE_URL=$(echo "$METADATA" | jq -r '.fileUrl // empty')
VERSION=$(echo "$METADATA" | jq -r '.version')

if [ -z "$WF_NAME" ] || [ "$WF_NAME" = "null" ]; then
  echo "ERROR: Could not fetch workflow. Check WF_ID and TOKEN."
  echo "Response: $METADATA"
  exit 1
fi

echo "  Name:    $WF_NAME"
echo "  Version: $VERSION"
echo "  Status:  $(echo "$METADATA" | jq -r '.status')"

# --- Step 2: Download action steps from Firebase ---
echo ""
echo "=== Step 2: Downloading action steps ==="

TEMPLATES="[]"

if [ -n "$FILE_URL" ]; then
  FIREBASE_DATA=$(curl -s "$FILE_URL")
  TEMPLATES=$(echo "$FIREBASE_DATA" | jq '.templates // []')
  STEP_COUNT=$(echo "$TEMPLATES" | jq 'length')
  echo "  Downloaded $STEP_COUNT action steps from Firebase."
else
  echo "  No fileUrl found -- workflow has no action steps."
fi

# --- Step 3: Fetch triggers from Firebase ---
echo ""
echo "=== Step 3: Fetching triggers ==="

TRIGGERS_PATH=$(echo "$METADATA" | jq -r '.triggersFilePath // empty')
TRIGGERS="[]"

if [ -n "$TRIGGERS_PATH" ]; then
  ENCODED_PATH=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TRIGGERS_PATH', safe=''))")
  TRIGGERS_URL="https://firebasestorage.googleapis.com/v0/b/highlevel-backend.appspot.com/o/${ENCODED_PATH}?alt=media"

  TRIGGERS_DATA=$(curl -s "$TRIGGERS_URL" 2>/dev/null || echo "[]")

  # Firebase may return an error object instead of an array
  if echo "$TRIGGERS_DATA" | jq -e 'type == "array"' > /dev/null 2>&1; then
    TRIGGERS="$TRIGGERS_DATA"
    TRIGGER_COUNT=$(echo "$TRIGGERS" | jq 'length')
    echo "  Downloaded $TRIGGER_COUNT triggers."
  else
    echo "  Could not fetch triggers (may not exist or access denied)."
  fi
else
  echo "  No triggersFilePath -- workflow has no triggers."
fi

# --- Step 4: Remap step IDs ---
echo ""
echo "=== Step 4: Remapping step IDs ==="

# Build a mapping of old IDs to new IDs
ID_MAP_FILE=$(mktemp)

# Extract all step IDs and generate new ones
echo "$TEMPLATES" | jq -r '.[].id' | while read -r OLD_ID; do
  NEW_ID=$(uuidgen | tr 'A-Z' 'a-z')
  echo "$OLD_ID $NEW_ID" >> "$ID_MAP_FILE"
done

# Apply the mapping to the templates JSON
REMAPPED_TEMPLATES="$TEMPLATES"

while read -r OLD_ID NEW_ID; do
  # Replace all occurrences of the old ID with the new ID
  REMAPPED_TEMPLATES=$(echo "$REMAPPED_TEMPLATES" | sed "s/$OLD_ID/$NEW_ID/g")
done < "$ID_MAP_FILE"

REMAP_COUNT=$(wc -l < "$ID_MAP_FILE" | tr -d ' ')
echo "  Remapped $REMAP_COUNT step IDs."

rm -f "$ID_MAP_FILE"

# --- Step 5: Create cloned workflow ---
echo ""
echo "=== Step 5: Creating cloned workflow ==="
echo "  Target location: $TARGET_LOC"
echo "  Name: ${PREFIX}${WF_NAME}"

CREATE_BODY=$(jq -n \
  --arg name "${PREFIX}${WF_NAME}" \
  --arg parentId "$TARGET_FOLDER" \
  --argjson templates "$REMAPPED_TEMPLATES" \
  '{
    name: $name,
    workflowData: {templates: $templates}
  } + (if $parentId != "" then {parentId: $parentId} else {} end)')

CREATE_RESPONSE=$(curl -s -X POST "$BASE/workflow/$TARGET_LOC" \
  "${HEADERS[@]}" \
  -d "$CREATE_BODY")

NEW_WF_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')

if [ "$NEW_WF_ID" = "null" ] || [ -z "$NEW_WF_ID" ]; then
  echo "ERROR: Failed to create cloned workflow."
  echo "Response: $CREATE_RESPONSE"
  exit 1
fi

echo "  Created: $NEW_WF_ID"

# --- Step 6: Recreate triggers (if same location) ---
echo ""
echo "=== Step 6: Recreating triggers ==="

if [ "$SOURCE_LOC" != "$TARGET_LOC" ]; then
  echo "  SKIPPED: Triggers reference location-specific resources (calendars, forms, etc.)."
  echo "  Cross-location trigger cloning requires manual remapping of resource IDs."
else
  TRIGGER_COUNT=$(echo "$TRIGGERS" | jq 'length')

  if [ "$TRIGGER_COUNT" -eq 0 ]; then
    echo "  No triggers to recreate."
  else
    echo "$TRIGGERS" | jq -c '.[]' | while read -r TRIGGER; do
      TRIGGER_NAME=$(echo "$TRIGGER" | jq -r '.name')
      TRIGGER_TYPE=$(echo "$TRIGGER" | jq -r '.type')
      TRIGGER_ACTIVE=$(echo "$TRIGGER" | jq -r '.active')
      TRIGGER_CONDITIONS=$(echo "$TRIGGER" | jq '.conditions')

      TRIGGER_BODY=$(jq -n \
        --arg type "$TRIGGER_TYPE" \
        --arg name "$TRIGGER_NAME" \
        --argjson active "$TRIGGER_ACTIVE" \
        --arg workflowId "$NEW_WF_ID" \
        --argjson conditions "$TRIGGER_CONDITIONS" \
        '{
          type: $type,
          name: $name,
          active: $active,
          workflowId: $workflowId,
          conditions: $conditions,
          actions: [{workflow_id: $workflowId, type: "add_to_workflow"}]
        }')

      TRIGGER_RESULT=$(curl -s -X POST "$BASE/workflow/$TARGET_LOC/trigger" \
        "${HEADERS[@]}" \
        -d "$TRIGGER_BODY")

      NEW_TRIGGER_ID=$(echo "$TRIGGER_RESULT" | jq -r '.id // "FAILED"')
      echo "  Trigger '$TRIGGER_NAME' ($TRIGGER_TYPE) -> $NEW_TRIGGER_ID"
    done
  fi
fi

# --- Step 7: Export summary ---
echo ""
echo "=== Step 7: Export summary ==="

# Save full export to file
EXPORT_FILE="workflow-export-${WF_ID}.json"
jq -n \
  --arg source_id "$WF_ID" \
  --arg source_loc "$SOURCE_LOC" \
  --arg source_name "$WF_NAME" \
  --arg clone_id "$NEW_WF_ID" \
  --arg clone_loc "$TARGET_LOC" \
  --arg clone_name "${PREFIX}${WF_NAME}" \
  --argjson original_templates "$TEMPLATES" \
  --argjson remapped_templates "$REMAPPED_TEMPLATES" \
  --argjson triggers "$TRIGGERS" \
  '{
    export_date: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
    source: {id: $source_id, locationId: $source_loc, name: $source_name},
    clone: {id: $clone_id, locationId: $clone_loc, name: $clone_name},
    original_templates: $original_templates,
    remapped_templates: $remapped_templates,
    triggers: $triggers
  }' > "$EXPORT_FILE"

echo "  Export saved to: $EXPORT_FILE"

echo ""
echo "=== Done ==="
echo "  Source:  $WF_NAME ($WF_ID)"
echo "  Clone:   ${PREFIX}${WF_NAME} ($NEW_WF_ID)"
echo "  Location: $TARGET_LOC"
echo ""
echo "  View in GHL: https://app.gohighlevel.com/location/$TARGET_LOC/workflows/$NEW_WF_ID"
