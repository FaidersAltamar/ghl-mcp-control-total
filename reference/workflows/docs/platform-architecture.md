# GHL Platform Architecture — Automation Layer

## App Architecture

GHL uses **Module Federation** (webpack micro-frontends). The main app bootstraps from a manifest and lazy-loads ~105 federated apps from CDN.

### Manifest
```
https://production.app-manifest.leadconnectorhq.com/latest/manifest.json
```
- Main app version: `1190` (as of 2026-03-22)
- Static assets: `https://static.leadconnectorhq.com/{version}/app.js`
- Federated apps: `https://appcdn.leadconnectorhq.com/{domain}/{app}/{version}/remoteEntry.js`

### Key Federated Apps (Automation Domain)

| App | CDN Path | Purpose |
|-----|----------|---------|
| `appointmentModalApp` | `automation/appointment-modal/339` | Appointment booking modal |
| `calendarSettingsApp` | `automation/calendar-settings/318` | Calendar configuration |
| `calendarServicesApp` | `automation/calendar-services/342` | Service-based booking |
| `calendarComponentsApp` | `automation/calendar-components/327` | Shared calendar UI |
| `calendarRentalsApp` | `automation/calendar-rentals/344` | Rental booking |
| `featureDiscoveryApp` | `automation/feature-discovery/343` | Feature discovery |
| `reportingApp` | `automation-reporting/reporting/195` | Workflow reporting |
| `notificationApp` | `automation-reporting/notification/183` | Notification system |

### Workflow Builder v2 = Separate Microfrontend

The new visual workflow builder is NOT in the main app bundle. It loads via the `Ft` component from a runtime-configured `workflowServiceURL`. Routes:
- `/automation/new-workflow`
- `/automation/workflows`
- `/automation/workflows/settings`
- `/automation/overview`
- `/automation/setup-workflow`
- `/automation/flowguard`

## Internal API Architecture

| Aspect | Public API | Internal API (workflow builder) |
|--------|-----------|-------------------------------|
| Base URL | `services.leadconnectorhq.com` | `backend.leadconnectorhq.com` |
| Auth header | `Authorization: Bearer {PIT_TOKEN}` | `token-id: {FIREBASE_JWT}` |
| Extra header | `Version: 2021-07-28` | `channel: APP` |
| Workflow CRUD | GET list only | Full CRUD + steps + triggers |
| Token type | PIT (per location, long-lived) | Firebase JWT (per user, 1hr expiry) |
| Token scope | Per-location | Per-user, scoped to locations[] in JWT |

## Data Storage

| Data | Storage | Access |
|------|---------|--------|
| Workflow metadata | MongoDB (via internal API) | REST endpoints |
| Action steps (templates) | Firebase Storage (`automation-workflows-production`) | Signed URLs from metadata |
| Trigger configs | Firebase Storage (`highlevel-backend.appspot.com`) | Signed URLs from metadata |
| Workflow versions | Firestore (`workflow_versions` collection) | Internal API |
| OAuth tokens | D1 (`ghl-accounts`) | Cloudflare Worker |
| Firebase ID token cache | KV (`ghl-mcp-oauth`) | Cloudflare Worker |

## Premium Billing

| Product | Code | Price | What it gates |
|---------|------|-------|---------------|
| Workflow Premium Features | `starter_plus_workflow_premium_actions_triggers` | $0.01/execution (100 free) | Google Sheets, Slack, Custom Webhook, AI Actions |
| Workflow External AI Models | separate | Pass-through cost | OpenAI, Anthropic, etc. |
| AI Employee | separate | $0.02/message | Conversation AI |
| Reviews AI | separate | $0.08/review response | Review response generation |
| Content AI | separate | $0.09/1000 words (500 free) | Content generation |

### Premium Feature Check
```
Product code: starter_plus_workflow_premium_actions_triggers
Settings path: /settings/workflow-premium-features
Reselling API: GET /product?productCode=starter_plus_workflow_premium_actions_triggers
```

## User Permission Flags

```json
{
  "workflows_enabled": true,
  "workflows_read_only": false,
  "triggers_enabled": true,
  "campaigns_enabled": true,
  "tags_enabled": true,
  "opportunities_enabled": true,
  "contacts_enabled": true,
  "appointments_enabled": true,
  "reviews_enabled": true,
  "phone_call_enabled": true,
  "conversations_enabled": true,
  "marketing_enabled": true,
  "bot_service": false,
  "websites_enabled": true,
  "membership_enabled": true,
  "social_planner": true,
  "blogging_enabled": true,
  "affiliate_manager_enabled": true,
  "communities_enabled": true,
  "certificates_enabled": true
}
```

## Feature Flags

Stored per-location and per-company via `/labs/featureFlags`.

| Flag | Purpose |
|------|---------|
| `enable_company_automation` | Company-level automation |
| `pipelines.permissions` | Pipeline-level permissions |
| `conversations.internalChat` | Internal chat feature |
| `membership.settingsRevamp` | Membership settings redesign |
| `membership.themesV2` | Membership themes v2 |

## Message Type Enum (39 types)

| Type | ID | Type | ID |
|------|-----|------|-----|
| TYPE_CALL | 1 | TYPE_WHATSAPP | 19 |
| TYPE_SMS | 2 | TYPE_CUSTOM_SMS | 20 |
| TYPE_EMAIL | 3 | TYPE_CUSTOM_EMAIL | 21 |
| TYPE_SMS_REVIEW_REQUEST | 4 | TYPE_CUSTOM_PROVIDER_SMS | 22 |
| TYPE_WEBCHAT | 5 | TYPE_CUSTOM_PROVIDER_EMAIL | 23 |
| TYPE_SMS_NO_SHOW_REQUEST | 6 | TYPE_IVR_CALL | 24 |
| TYPE_CAMPAIGN_SMS | 7 | TYPE_ACTIVITY_CONTACT | 25 |
| TYPE_CAMPAIGN_CALL | 8 | TYPE_ACTIVITY_INVOICE | 26 |
| TYPE_CAMPAIGN_EMAIL | 9 | TYPE_ACTIVITY_PAYMENT | 27 |
| TYPE_CAMPAIGN_VOICEMAIL | 10 | TYPE_ACTIVITY_OPPORTUNITY | 28 |
| TYPE_FACEBOOK | 11 | TYPE_LIVE_CHAT | 29 |
| TYPE_CAMPAIGN_FACEBOOK | 12 | TYPE_LIVE_CHAT_INFO_MESSAGE | 30 |
| TYPE_CAMPAIGN_MANUAL_CALL | 13 | TYPE_ACTIVITY_APPOINTMENT | 31 |
| TYPE_CAMPAIGN_MANUAL_SMS | 14 | TYPE_INFO_FACEBOOK_COMMENT | 32 |
| TYPE_GMB | 15 | TYPE_INFO_INSTAGRAM_COMMENT | 33 |
| TYPE_CAMPAIGN_GMB | 16 | TYPE_CUSTOM_CALL | 34 |
| TYPE_REVIEW | 17 | TYPE_GROUP_SMS | 35 |
| TYPE_INSTAGRAM | 18 | TYPE_INTERNAL_CHAT | 36 |
| | | TYPE_INTERNAL_COMMENT | 37 |
| | | TYPE_ACTIVITY_EMPLOYEE_ACTION_LOG | 38 |
| | | TYPE_NO_SHOW | 100 |

## Agency Plan Tiers

| Tier | Price | Annual | Key |
|------|-------|--------|-----|
| Starter | $97/mo | $970/yr | — |
| Unlimited | $297/mo | $2,970/yr | — |
| SaaS Pro | $497/mo | $4,970/yr | `isAgency497Check` |

SaaS Pro agencies can rebill premium features to sub-accounts.
