# Authentication

## Overview

The GHL internal API uses Firebase Authentication, not OAuth Bearer tokens. The auth model is fundamentally different from the public API.

| Aspect | Public API | Internal API |
|--------|-----------|--------------|
| Base URL | `services.leadconnectorhq.com` | `backend.leadconnectorhq.com` |
| Auth header | `Authorization: Bearer <pit-token>` | `token-id: <firebase-jwt>` |
| Token type | PIT (Private Integration Token) or OAuth | Firebase ID Token (JWT) |
| Token lifetime | Long-lived (PIT) or refreshable (OAuth) | ~1 hour |
| Scope | Per-endpoint scopes | Full user permissions |

## Required Headers

Every request to the internal API requires these headers:

```
token-id: <firebase-jwt>
channel: APP
Content-Type: application/json    # for POST/PUT requests
```

The `channel: APP` header is mandatory. Requests without it are rejected.

## Firebase JWT Structure

The JWT is issued by Firebase Authentication for the `highlevel-backend` project.

### JWT Header
```json
{
  "alg": "RS256",
  "kid": "<key-id>",
  "typ": "JWT"
}
```

### JWT Payload
```json
{
  "user_id": "YewkebOufK3hmeP1gx4B",
  "company_id": "R1HWQKyMMoj4PJ5mAYed",
  "role": "admin",
  "type": "agency",
  "version": 2,
  "locations": ["2hP6rCb3COd2HUjD25w2", "W7BRJwzJCvFs9r0xZHrE"],
  "permissions": {
    "workflows_enabled": true,
    "workflows_read_only": false
  },
  "iss": "securetokern.google.com/highlevel-backend",
  "aud": "highlevel-backend",
  "auth_time": 1700000000,
  "sub": "YewkebOufK3hmeP1gx4B",
  "iat": 1700000000,
  "exp": 1700003600
}
```

### Key Fields

| Field | Purpose |
|-------|---------|
| `user_id` | GHL user ID -- used in `updatedBy` fields |
| `company_id` | GHL agency/company ID |
| `role` | `admin`, `user` -- determines write access |
| `locations` | Array of location IDs the user can access |
| `permissions.workflows_enabled` | Whether user can access workflows |
| `permissions.workflows_read_only` | If true, user can only read (no create/update/delete) |
| `exp` | Expiration timestamp (~1 hour from issue) |

## Obtaining a Token

### Method 1: Browser DevTools (Manual)

1. Log into `app.gohighlevel.com`
2. Open DevTools > Network tab
3. Navigate to Automations > Workflows
4. Find any request to `backend.leadconnectorhq.com`
5. Copy the `token-id` header value

This token is valid for ~1 hour from the time it was issued.

### Method 2: Firebase SDK (Programmatic)

GHL's frontend uses the Firebase JS SDK to manage authentication. The flow:

1. User logs in via GHL's auth form
2. GHL backend issues a Firebase custom token
3. Firebase SDK exchanges custom token for an ID token
4. ID token auto-refreshes via Firebase SDK's `onIdTokenChanged` listener
5. Every API call uses the current ID token as `token-id`

To replicate programmatically, you would need:
- Firebase project config for `highlevel-backend`
- A valid Firebase custom token (issued by GHL's auth endpoint)
- Firebase Admin SDK or REST API for token exchange

### Method 3: Firebase REST Token Refresh

If you have a Firebase refresh token, you can exchange it for a new ID token:

```bash
# Exchange refresh token for new ID token
curl -s -X POST "https://securetoken.googleapis.com/v1/token?key=FIREBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "YOUR_REFRESH_TOKEN"
  }'
```

Response:
```json
{
  "access_token": "new-firebase-jwt...",
  "expires_in": "3600",
  "token_type": "Bearer",
  "refresh_token": "new-refresh-token",
  "id_token": "new-firebase-jwt...",
  "user_id": "YewkebOufK3hmeP1gx4B",
  "project_id": "highlevel-backend"
}
```

Use the `id_token` value as your `token-id` header.

## Token Expiry Handling

Firebase ID tokens expire after approximately 1 hour. When a token expires:

- API returns `401 Unauthorized`
- You must obtain a fresh token before continuing

For scripts that run longer than 1 hour, implement a refresh loop:

```bash
#!/bin/bash
# Check if token is still valid before each request
check_token() {
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    "$BASE/workflow/$LOC/list?limit=1" \
    -H "token-id: $TOKEN" \
    -H "channel: APP")

  if [ "$response" = "401" ]; then
    echo "Token expired, refreshing..."
    refresh_token  # your refresh implementation
  fi
}
```

## MCP Worker Auto-Refresh Architecture

The `dlf-agency` Cloudflare Worker implements automatic token refresh so MCP tools never hit expired tokens during automation builds.

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `FIREBASE_API_KEY` | `AIzaSyB_w3vXmsI7WeQtrIOkjR6xTRVN5uOieiE` | Firebase project key for `highlevel-backend` |
| `KV_TOKEN_KEY` | `ghl_firebase_id_token` | KV key for cached ID token |
| `KV_TOKEN_TTL` | `3300` (55 minutes) | Cache duration -- refresh 5 min before Firebase's 60-min expiry |

### Refresh Flow

The worker uses a **cache-first** strategy with automatic 401 retry:

```
┌─────────────────────────────────────────────────────────┐
│ MCP Tool Call (e.g., save_steps)                        │
│                                                         │
│  1. getValidToken()                                     │
│     ├─ Check KV for "ghl_firebase_id_token"             │
│     ├─ FOUND (within 55-min TTL) → use cached token     │
│     └─ NOT FOUND → refreshFirebaseToken()               │
│         ├─ POST securetoken.googleapis.com/v1/token     │
│         ├─ Store new ID token in KV (TTL: 3300s)        │
│         └─ Return fresh token                           │
│                                                         │
│  2. Send API request with token-id header               │
│                                                         │
│  3. If 401 or 403 response:                             │
│     ├─ Force refresh: refreshFirebaseToken()             │
│     ├─ Update KV cache with new token                   │
│     ├─ Retry request ONCE with new token                │
│     └─ If retry fails: throw error (no further retries) │
└─────────────────────────────────────────────────────────┘
```

### Refresh Function (from `workflow-builder.ts`)

```typescript
async function refreshFirebaseToken(refreshToken: string) {
  const resp = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    }
  );
  const data = await resp.json();
  return { idToken: data.id_token, refreshToken: data.refresh_token };
}
```

### Cache-First Token Retrieval

```typescript
async function getValidToken(config) {
  // 1. Try KV cache first (zero latency)
  const cached = await config.kv.get(KV_TOKEN_KEY);
  if (cached) return cached;

  // 2. Cache miss -- refresh from Firebase
  const { idToken } = await refreshFirebaseToken(config.refreshToken);
  await config.kv.put(KV_TOKEN_KEY, idToken, { expirationTtl: KV_TOKEN_TTL });
  return idToken;
}
```

### 401/403 Auto-Retry (from `internalRequest()`)

```typescript
if ((resp.status === 401 || resp.status === 403) && config.kv && config.refreshToken) {
  // Force refresh -- token was invalidated mid-session
  const { idToken } = await refreshFirebaseToken(config.refreshToken);
  await config.kv.put(KV_TOKEN_KEY, idToken, { expirationTtl: KV_TOKEN_TTL });
  headers["token-id"] = idToken;

  // Single retry with fresh token
  const retry = await fetch(`${INTERNAL_BASE}${path}`, { method, headers, body });
  if (!retry.ok) throw new Error(`GHL Internal API ${retry.status}`);
  return retry.json();
}
```

### Admin Token Management Endpoints

The worker exposes admin endpoints for token inspection and manual refresh:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/token/status` | GET | Check cached token expiry (parses JWT `exp` claim) |
| `/admin/token/refresh` | POST | Force refresh with dynamic TTL: `min(expiresIn - 300, 3300)` |
| `/admin/token/seed` | POST | Store a new refresh token (no TTL -- persists until revoked) |
| `/cli/token` | GET | Return cached ID token for CLI scripts |

### Multi-Module Token Sharing

Both the workflow builder and site builder share the same KV cache key (`ghl_firebase_id_token`). This means:
- First module to need a refresh performs it; second module reads cached result
- No duplicate Firebase API calls within the 55-minute window
- Site builder additionally requires `Authorization: Bearer` header (same JWT value)

### Refresh Token Sources

| Source | Storage | TTL |
|--------|---------|-----|
| Cloudflare secret `GHL_FIREBASE_REFRESH_TOKEN` | Environment variable | Never expires |
| KV key `ghl_refresh_token` | KV namespace | No TTL (persists until revoked) |
| D1 `sub_accounts.refreshToken` | Database column | Never expires |

### Extracting a New Refresh Token

If the refresh token stops working (account password change, session revocation):

1. Open `app.gohighlevel.com` in Chrome
2. Log in to the target location
3. DevTools > Application > IndexedDB > `firebaseLocalStorageDb`
4. Find the `spikey` object > extract `refreshToken`
5. Update Cloudflare secret:
   ```bash
   cd ~/Desktop/GITHUB/dlf-ghl-mcp-server/dlf-ghl-mcp-server
   echo 'NEW_TOKEN' | npx wrangler secret put GHL_FIREBASE_REFRESH_TOKEN
   ```

## Permission Model

The JWT's `permissions` object controls access:

| Permission | Effect |
|-----------|--------|
| `workflows_enabled: true` | Can access workflow endpoints |
| `workflows_enabled: false` | All workflow endpoints return 403 |
| `workflows_read_only: true` | Can GET but not POST/PUT/DELETE |
| `workflows_read_only: false` | Full CRUD access |

The `role` field also matters:
- `admin` -- full access to all locations in the company
- `user` -- access restricted to locations in the `locations` array

## Security Notes

- Firebase JWTs contain your full user context. Treat them as secrets.
- Never commit tokens to version control.
- The `token-id` header is sent in plaintext over HTTPS -- the connection is encrypted but the header name is non-standard, which may confuse security tooling.
- GHL's internal API does not use CSRF tokens or API keys -- the Firebase JWT is the sole auth mechanism.
