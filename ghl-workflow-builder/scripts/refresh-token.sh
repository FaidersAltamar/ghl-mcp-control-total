#!/bin/bash
# Refresh Firebase ID token using the stored refresh token
# The refresh token is stored as a Cloudflare secret (GHL_FIREBASE_REFRESH_TOKEN)
# This script refreshes locally for testing

FIREBASE_API_KEY="AIzaSyB_w3vXmsI7WeQtrIOkjR6xTRVN5uOieiE"

# Get refresh token from Cloudflare secret or env
if [ -z "$GHL_FIREBASE_REFRESH_TOKEN" ]; then
  echo "ERROR: GHL_FIREBASE_REFRESH_TOKEN not set"
  echo ""
  echo "To extract a new refresh token:"
  echo "1. Open app.gohighlevel.com in Chrome"
  echo "2. Log in to the target location"
  echo "3. Open DevTools > Application > IndexedDB > firebaseLocalStorageDb"
  echo "4. Find the refresh token in the stored user object"
  echo "5. Export: export GHL_FIREBASE_REFRESH_TOKEN='your_token_here'"
  exit 1
fi

echo "Refreshing Firebase ID token..."

RESPONSE=$(curl -s -X POST \
  "https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=${GHL_FIREBASE_REFRESH_TOKEN}")

ID_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id_token','ERROR'))" 2>/dev/null)
REFRESH_TOKEN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('refresh_token','ERROR'))" 2>/dev/null)
EXPIRES_IN=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('expires_in','ERROR'))" 2>/dev/null)

if [ "$ID_TOKEN" = "ERROR" ] || [ -z "$ID_TOKEN" ]; then
  echo "FAILED to refresh token:"
  echo "$RESPONSE"
  exit 1
fi

echo "SUCCESS - ID token refreshed (expires in ${EXPIRES_IN}s)"
echo ""
echo "ID Token (first 50 chars): ${ID_TOKEN:0:50}..."
echo ""

# Test the token
echo "Testing token against GHL internal API..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://backend.leadconnectorhq.com/workflow/2hP6rCb3COd2HUjD25w2/list?parentId=root&limit=5&type=workflow" \
  -H "token-id: ${ID_TOKEN}" \
  -H "channel: APP")

if [ "$HTTP_STATUS" = "200" ]; then
  echo "TOKEN VALID - API returned 200"
else
  echo "TOKEN INVALID - API returned ${HTTP_STATUS}"
fi

echo ""
echo "To update Cloudflare secret:"
echo "  cd ~/Desktop/GITHUB/dlf-ghl-mcp-server/dlf-ghl-mcp-server"
echo "  echo '${REFRESH_TOKEN}' | npx wrangler secret put GHL_FIREBASE_REFRESH_TOKEN"
echo "  echo '${ID_TOKEN}' | npx wrangler secret put GHL_FIREBASE_TOKEN"
