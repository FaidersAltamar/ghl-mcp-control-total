# GHL MCP Integration — Agent Guide

## Project Scope
Connect OpenCode (and Claude/Cursor) to GoHighLevel via MCP + direct API fallback. **This configuration now targets the operational location `Control Ads` (`kNcygEmVTrhIueZQMDXM`); the previous `DropKiller` location was used only for initial testing.**

## Credentials (locked to this location)
- **PIT Token**: `pit-e6fe67b8-03a5-4be2-984b-808ae4231a62`
- **Location ID**: `kNcygEmVTrhIueZQMDXM`
- **Company ID**: `Z1tBjx04W5ynDkgSEiEt`
- **Base URL**: `https://services.leadconnectorhq.com`

## Location Profile (Auto-discovered)
- **Name**: Control Ads
- **City**: Cali, Valle del Cauca, CO
- **Timezone**: America/Bogota
- **Email**: soft@scale.com.co
- **Phone**: +573104383692
- **Address**: Faidersaltamarcontingencias@gmail.com Teléfono: 3104383692 Calle 15A #5-83 piso 3
- **Users**: 3 (Faiders Altamar, plus team members)
- **Contacts**: 3+ (johan camilo torres, etc.)

## MCP Servers

### 1. Public API MCP (contacts, payments, calendars, etc.)
- **Package**: `@nerdsnipe-inc/ghl-mcp-server` v1.2.0
- **Transport**: stdio (`npx -y @nerdsnipe-inc/ghl-mcp-server`)
- **Tools**: 127 tools across contacts, conversations, calendars, pipelines, invoices, workflows list, etc.
- **Status**: Tested & confirmed working (2026-06-18)

### 2. Workflow Builder MCP (full workflow CRUD)
- **Path**: `ghl-workflow-builder/mcp-server/server.js`
- **Transport**: stdio (`node ghl-workflow-builder/mcp-server/server.js`)
- **Tools**: `ghl_list_workflows`, `ghl_get_workflow`, `ghl_create_workflow`, `ghl_add_trigger`, `ghl_add_action`, `ghl_publish_workflow`, `ghl_delete_workflow`
- **Status**: Connected to GHL internal API (`backend.leadconnectorhq.com`) via Firebase refresh token; list/create/update/publish/delete tested (2026-06-18). Derived from `drleadflow/ghl-automation-builder`.
- **Use this server** whenever the user asks about workflows, automations, triggers, or actions.
- **Known state (post-cleanup)**: location has 22 workflows total, 2 active (`Compra producto`, `Correos de confirmación de compra/carros abandonados`). 5 Instagram draft workflows exist with keywords: `dropi`, `curso/mentoria/Contingencia`, `Scalesoft`, `GPT/IA`, `ZOOM/llamada`.

## Agent Rules
1. **Prefer MCP first** — use the exposed tools for every GHL operation.
2. **For workflows/automations**, use the `ghl-workflow-builder` MCP server tools (`ghl_*`).
3. **If MCP fails or the tool does not exist**, fallback immediately to direct API calls via `curl` or a Node script using the PIT token.
4. **Always confirm destructive actions** (delete, void, bulk ops) with the user before executing.
5. **Never commit credentials** — `.mcp.json`, `.opencode/mcp.json`, and `ghl-workflow-builder/mcp-server/.env` are in `.gitignore`.
6. **Keep this file updated** — if the token rotates or location changes, update credentials here and in the JSON configs.

## Direct API Fallback (when MCP is not enough)
Always include headers:
```bash
-H "Authorization: Bearer pit-e6fe67b8-03a5-4be2-984b-808ae4231a62"
-H "Content-Type: application/json"
-H "Version: 2021-07-28"
```

### Verified Working Endpoints (API v1)
```bash
BASE="https://services.leadconnectorhq.com"
LID="kNcygEmVTrhIueZQMDXM"
CID="Z1tBjx04W5ynDkgSEiEt"  # companyId
TOKEN="pit-e6fe67b8-03a5-4be2-984b-808ae4231a62"

# Contacts
curl -s "$BASE/contacts/?locationId=$LID&limit=100"
curl -s "$BASE/contacts/<CONTACT_ID>"
curl -s "$BASE/contacts/<CONTACT_ID>/tasks"
curl -s "$BASE/contacts/<CONTACT_ID>/notes"
curl -s "$BASE/contacts/<CONTACT_ID>/appointments"

# Conversations (use /search/ path, not root)
curl -s "$BASE/conversations/search?locationId=$LID&limit=100"
curl -s "$BASE/conversations/search?locationId=$LID&contactId=<CONTACT_ID>"
curl -s "$BASE/conversations/search?locationId=$LID&status=unread"

# Location & Settings
curl -s "$BASE/locations/$LID"
curl -s "$BASE/locations/$LID/tags"
curl -s "$BASE/locations/$LID/customFields"
curl -s "$BASE/locations/$LID/customValues"
curl -s "$BASE/locations/$LID/templates?limit=10&skip=0"

# Users
curl -s "$BASE/users/?locationId=$LID"
curl -s "$BASE/users/search?companyId=$CID&locationId=$LID&limit=10&skip=0"

# Pipelines & Opportunities
curl -s "$BASE/opportunities/pipelines?locationId=$LID"
curl -s "$BASE/opportunities/lost-reason?locationId=$LID&limit=10&skip=0"
curl -s "$BASE/opportunities/search?location_id=$LID&limit=10"

# Payments (require altId + altType)
curl -s "$BASE/payments/orders?altId=$LID&altType=location"
curl -s "$BASE/payments/subscriptions?altId=$LID&altType=location"
curl -s "$BASE/payments/transactions?altId=$LID&altType=location"
curl -s "$BASE/payments/coupon/list?altId=$LID&altType=location"

# Phone Numbers (v3 style query param)
curl -s "$BASE/phone-system/numbers?locationId=$LID"

# Custom Objects (use /objects/, not /custom-objects/)
curl -s "$BASE/objects/?locationId=$LID"

# Trigger Links (use /links/, not /trigger-links/)
curl -s "$BASE/links/?locationId=$LID"

# Store / Shipping
curl -s "$BASE/store/shipping-zone?altId=$LID&altType=location"
curl -s "$BASE/store/shipping-carrier?altId=$LID&altType=location"
curl -s "$BASE/store/store-setting?altId=$LID&altType=location"

# Campaigns
curl -s "$BASE/campaigns/?locationId=$LID"

# Forms & Surveys
curl -s "$BASE/forms/?locationId=$LID"
curl -s "$BASE/forms/submissions?locationId=$LID&limit=10&page=1"
curl -s "$BASE/surveys/?locationId=$LID"
curl -s "$BASE/surveys/submissions?locationId=$LID&limit=10&page=1"

# Products
curl -s "$BASE/products/?locationId=$LID&limit=10&offset=0"
curl -s "$BASE/products/inventory?altId=$LID&altType=location&limit=10&offset=0"

# Proposals
curl -s "$BASE/proposals/document?locationId=$LID&limit=10&skip=0"
curl -s "$BASE/proposals/templates?locationId=$LID&limit=10&skip=0"

# Voice AI
curl -s "$BASE/voice-ai/agents?locationId=$LID"

# Marketplace Billing
curl -s "$BASE/marketplace/billing/charges?limit=10&skip=0"

# Ad Manager
curl -s "$BASE/ad-publishing/facebook/conversation-forms?locationId=$LID"

# Affiliate Manager
curl -s "$BASE/affiliate-manager/$LID/affiliates?limit=10&skip=0"
curl -s "$BASE/affiliate-manager/$LID/payouts?limit=10&skip=0"
curl -s "$BASE/affiliate-manager/$LID/commissions?limit=10&skip=0"

# Agent Studio
curl -s "$BASE/agent-studio/agent?locationId=$LID&limit=10&offset=0"

# Brand Boards
curl -s "$BASE/brand-boards/$LID?limit=10&offset=0"

# Associations
curl -s "$BASE/associations/?locationId=$LID&skip=0&limit=10"

# Blogs (require `limit` & `offset` where noted)
curl -s "$BASE/blogs/site/all?locationId=$LID"
curl -s "$BASE/blogs/posts/all?locationId=$LID&blogId=<BLOG_ID>&limit=10&offset=0"
curl -s "$BASE/blogs/authors?locationId=$LID&limit=10&offset=0"
curl -s "$BASE/blogs/categories?locationId=$LID&limit=10&offset=0"

# Email Builder & Campaigns
curl -s "$BASE/emails/builder?locationId=$LID&limit=10"
curl -s "$BASE/emails/schedule?locationId=$LID&limit=10"

# Funnels
curl -s "$BASE/funnels/funnel/list?locationId=$LID&limit=100"
curl -s "$BASE/funnels/page?locationId=$LID&funnelId=<FUNNEL_ID>&limit=100"
curl -s "$BASE/funnels/page/count?locationId=$LID&funnelId=<FUNNEL_ID>"
curl -s "$BASE/funnels/lookup/redirect/list?locationId=$LID&limit=100"

# Social Media Posting (locationId is a path param here)
curl -s "$BASE/social-media-posting/$LID/accounts"
curl -s -X POST "$BASE/social-media-posting/$LID/posts/list" \
  -H "Content-Type: application/json" \
  -d '{"limit":"10"}'

# Tasks
curl -s "$BASE/contacts/<CONTACT_ID>/tasks"
curl -s -X POST "$BASE/locations/$LID/tasks/search" \
  -H "Content-Type: application/json" \
  -d '{"limit":10}'
curl -s "$BASE/locations/$LID/recurring-tasks"

# Advanced Search (POST)
curl -s -X POST "$BASE/contacts/search" \
  -H "Content-Type: application/json" \
  -d '{"locationId":"'"$LID"'","page":1,"pageLimit":10}'
curl -s -X POST "$BASE/opportunities/search" \
  -H "Content-Type: application/json" \
  -d '{"locationId":"'"$LID"'","limit":10}'
curl -s -X POST "$BASE/objects/<SCHEMA_KEY>/records/search" \
  -H "Content-Type: application/json" \
  -d '{"locationId":"'"$LID"'","page":1,"pageLimit":10}'

# Invoices & Estimates (require altId + altType + offset as string)
curl -s "$BASE/invoices/?altId=$LID&altType=location&limit=10&offset=0"
curl -s "$BASE/invoices/estimate/list?altId=$LID&altType=location&limit=10&offset=0"

# Media Files (require altId + altType + type)
curl -s "$BASE/medias/files?altId=$LID&altType=location&limit=10&type=file"

# Knowledge Base
curl -s "$BASE/knowledge-bases/?locationId=$LID&limit=10"

# Trigger Links
curl -s "$BASE/links/?locationId=$LID"
curl -s "$BASE/links/search?locationId=$LID&limit=10&skip=0"

# Phone System
curl -s "$BASE/phone-system/numbers?locationId=$LID"
curl -s "$BASE/phone-system/number-pools?locationId=$LID"

# Social Media Posting extras
curl -s "$BASE/social-media-posting/$LID/categories?limit=10&skip=0"
curl -s "$BASE/social-media-posting/$LID/tags?limit=10&skip=0"
curl -s "$BASE/social-media-posting/$LID/csv?userId=<USER_ID>&limit=10&skip=0"

# Calendars extras
curl -s "$BASE/calendars/groups?locationId=$LID"
curl -s "$BASE/calendars/resources/rooms?locationId=$LID&limit=10&skip=0"

# Other Lists (may return empty if no data exists)
curl -s "$BASE/workflows/?locationId=$LID"
curl -s "$BASE/businesses/?locationId=$LID"
curl -s "$BASE/knowledge-base/?locationId=$LID"
```

### Example: Create Contact
curl -s -X POST \
  -H "Authorization: Bearer pit-e6fe67b8-03a5-4be2-984b-808ae4231a62" \
  -H "Content-Type: application/json" \
  -H "Version: 2021-07-28" \
  -d '{"locationId":"kNcygEmVTrhIueZQMDXM","firstName":"Test","email":"test@example.com"}' \
  "https://services.leadconnectorhq.com/contacts/"

## Alternative Paths Map (discovered via research)
Many endpoints that return 404 with obvious paths work via alternative routes:

| What you want | Path that fails | Path that works |
|---|---|---|
| Custom Objects | `/custom-objects?locationId=` ❌ | `/objects/?locationId=` ✅ |
| Trigger Links | `/trigger-links?locationId=` ❌ | `/links/?locationId=` ✅ |
| Phone Numbers | `/phone-numbers?locationId=` ❌ | `/phone-system/numbers?locationId=` ✅ |
| Conversations | `/conversations?locationId=` ❌ | `/conversations/search?locationId=` ✅ |
| Custom Fields | `/custom-fields?locationId=` ❌ | `/locations/$LID/customFields` ✅ |
| Custom Values | `/custom-values?locationId=` ❌ | `/locations/$LID/customValues` ✅ |
| Templates | `/templates?locationId=` ❌ | `/locations/$LID/templates` ✅ |
| Payments Orders | `/payments/orders?locationId=` ❌ | `/payments/orders?altId=$LID&altType=location` ✅ |
| Subscriptions | `/payments/subscriptions?locationId=` ❌ | `/payments/subscriptions?altId=$LID&altType=location` ✅ |
| Transactions | `/payments/transactions?locationId=` ❌ | `/payments/transactions?altId=$LID&altType=location` ✅ |
| Coupons | `/coupons?locationId=` ❌ | `/payments/coupon/list?altId=$LID&altType=location` ✅ |
| Store Shipping | `/store/shipping-zones?locationId=` ❌ | `/store/shipping-zone?altId=$LID&altType=location` ✅ |
| Blogs list | `/blogs?locationId=` ❌ | `/blogs/site/all?locationId=` ✅ |
| Blog posts | `/blog/posts?locationId=` ❌ | `/blogs/posts/all?locationId=&blogId=` ✅ |
| Blog authors | `/blogs/authors?locationId=` (missing params) ❌ | `/blogs/authors?locationId=&limit=&offset=` ✅ |
| Blog categories | `/blogs/categories?locationId=` (missing params) ❌ | `/blogs/categories?locationId=&limit=&offset=` ✅ |
| Email templates | `/email-builder?locationId=` ❌ | `/emails/builder?locationId=` ✅ |
| Email campaigns | `/emails?locationId=` ❌ | `/emails/schedule?locationId=` ✅ |
| Funnels list | `/funnels/?locationId=` ❌ | `/funnels/funnel/list?locationId=` ✅ |
| Funnel pages | `/funnels/page?locationId=` (missing funnelId) ❌ | `/funnels/page?locationId=&funnelId=` ✅ |
| Social accounts | `/social-media-posting/accounts?locationId=` ❌ | `/social-media-posting/{locationId}/accounts` ✅ |
| Social posts | `/social-media-posting/posts?locationId=` ❌ | `/social-media-posting/{locationId}/posts/list` ✅ |
| Location tasks | `/tasks?locationId=` ❌ | `/locations/{locationId}/tasks/search` ✅ |
| Recurring tasks | `/recurring-tasks?locationId=` ❌ | `/locations/{locationId}/recurring-tasks` ✅ |
| Invoices | `/invoices?locationId=` ❌ | `/invoices/?altId=$LID&altType=location` ✅ |
| Estimates | `/invoices/estimate/list?locationId=` ❌ | `/invoices/estimate/list?altId=$LID&altType=location` ✅ |
| Media files | `/medias/files?locationId=` ❌ | `/medias/files?altId=$LID&altType=location` ✅ |
| Opportunities Search | `/opportunities/search?locationId=` ❌ | `/opportunities/search?location_id=` ✅ |
| Users search | `/users/search?locationId=` ❌ | `/users/search?companyId=&locationId=` ✅ |
| Brand boards | `/brand-boards?locationId=` ❌ | `/brand-boards/{locationId}` ✅ |
| Campaigns | `/campaigns?limit=` ❌ | `/campaigns/?locationId=` (sin `limit`) ✅ |
| Custom fields | `/custom-fields?locationId=` ❌ | `/locations/{locationId}/customFields` ✅ |
| Locations templates | `/locations/{id}/templates?type=` ❌ | `/locations/{id}/templates` ✅ |
| Voice AI agents | `/voice-ai/agents?limit=` ❌ | `/voice-ai/agents?locationId=` ✅ |
| Social categories | `/social-media-posting/categories?locationId=` ❌ | `/social-media-posting/{locationId}/categories` ✅ |
| Social tags | `/social-media-posting/tags?locationId=` ❌ | `/social-media-posting/{locationId}/tags` ✅ |
| Social CSV | `/social-media-posting/csv?locationId=` ❌ | `/social-media-posting/{locationId}/csv?userId=` ✅ |
| Calendar rooms | `/calendars/resources?locationId=` ❌ | `/calendars/resources/rooms?locationId=` ✅ |

## Complete MCP Tools Reference (127 tools)

### Contacts (21 tools)
`ghl_get_contacts`, `ghl_get_contact`, `ghl_create_contact`, `ghl_update_contact`, `ghl_delete_contact`, `ghl_upsert_contact`, `ghl_search_contacts`, `ghl_add_contact_tags`, `ghl_remove_contact_tags`, `ghl_get_contact_notes`, `ghl_create_contact_note`, `ghl_update_contact_note`, `ghl_delete_contact_note`, `ghl_get_contact_tasks`, `ghl_create_contact_task`, `ghl_update_contact_task`, `ghl_delete_contact_task`, `ghl_get_contact_appointments`, `ghl_add_contact_to_workflow`, `ghl_remove_contact_from_workflow`

### Conversations & Messaging (9 tools)
`ghl_search_conversations`, `ghl_get_conversation`, `ghl_create_conversation`, `ghl_get_messages`, `ghl_send_message`, `ghl_send_email`, `ghl_update_message_status`, `ghl_cancel_scheduled_message`, `ghl_add_inbound_message`

### Calendars & Appointments (10 tools)
`ghl_get_calendars`, `ghl_get_calendar`, `ghl_get_free_slots`, `ghl_get_calendar_events`, `ghl_create_appointment`, `ghl_get_appointment`, `ghl_update_appointment`, `ghl_delete_calendar_event`, `ghl_create_block_slot`, `ghl_get_calendar_groups`

### Opportunities & Pipeline (8 tools)
`ghl_get_pipelines`, `ghl_search_opportunities`, `ghl_get_opportunity`, `ghl_create_opportunity`, `ghl_update_opportunity`, `ghl_update_opportunity_status`, `ghl_upsert_opportunity`, `ghl_delete_opportunity`

### Location Settings (16 tools)
`ghl_get_location`, `ghl_get_location_tags`, `ghl_create_location_tag`, `ghl_delete_location_tag`, `ghl_get_custom_fields`, `ghl_create_custom_field`, `ghl_update_custom_field`, `ghl_delete_custom_field`, `ghl_get_custom_values`, `ghl_create_custom_value`, `ghl_update_custom_value`, `ghl_delete_custom_value`, `ghl_get_users`, `ghl_search_users`, `ghl_get_user`, `ghl_create_user`, `ghl_update_user`, `ghl_delete_user`

### Payments & Invoices (12 tools)
`ghl_get_orders`, `ghl_get_order`, `ghl_get_transactions`, `ghl_get_subscriptions`, `ghl_get_coupons`, `ghl_create_coupon`, `ghl_get_invoices`, `ghl_get_invoice`, `ghl_create_invoice`, `ghl_send_invoice`, `ghl_void_invoice`, `ghl_record_invoice_payment`

### Funnels, Forms & Surveys (5 tools)
`ghl_get_funnels`, `ghl_get_funnel_pages`, `ghl_get_funnel_page_count`, `ghl_get_forms`, `ghl_get_form_submissions`, `ghl_get_surveys`, `ghl_get_survey_submissions`

### Phone Numbers (5 tools)
`ghl_get_phone_numbers`, `ghl_search_available_phone_numbers`, `ghl_purchase_phone_number`, `ghl_update_phone_number`, `ghl_release_phone_number`

### Social & Media (8 tools)
`ghl_get_social_accounts`, `ghl_get_social_posts`, `ghl_create_social_post`, `ghl_delete_social_post`, `ghl_get_media_files`, `ghl_delete_media_file`, `ghl_get_trigger_links`, `ghl_create_trigger_link`, `ghl_delete_trigger_link`

### Email Builder & Campaigns (9 tools)
`ghl_get_email_builder_templates`, `ghl_get_email_builder_template`, `ghl_create_email_builder_template`, `ghl_update_email_builder_template`, `ghl_delete_email_builder_template`, `ghl_get_email_campaigns`, `ghl_get_email_campaign`, `ghl_create_email_campaign`, `ghl_delete_email_campaign`

### Knowledge Base, FAQs & Crawler (14 tools)
`ghl_list_knowledge_bases`, `ghl_get_knowledge_base`, `ghl_create_knowledge_base`, `ghl_update_knowledge_base`, `ghl_delete_knowledge_base`, `ghl_list_faqs`, `ghl_create_faq`, `ghl_update_faq`, `ghl_delete_faq`, `ghl_discover_website`, `ghl_get_crawler_status`, `ghl_list_crawler_urls`, `ghl_train_crawler_urls`, `ghl_delete_crawler_urls`

### Workflows & Campaigns (2 tools)
`ghl_get_workflows`, `ghl_get_campaigns`

## GHL Best Practices
- **PIT tokens are sub-account scoped** — this token only works for location `kNcygEmVTrhIueZQMDXM`.
- **Rate limit**: 100 requests / 10 seconds. Retry with exponential backoff on `429`.
- **Phone numbers**: always E.164 (`+15551234567`).
- **Dates**: always ISO 8601.
- **Token rotation**: if you get `401 Unauthorized`, the token may be revoked — notify the user immediately.
- **Scopes**: the PIT must have the required scopes enabled in GHL Settings > Private Integrations.
- **Never log the full PIT** in output or committed files.
- **API Version**: Use `Version: 2021-07-28` for v1 endpoints, `Version: 2023-02-21` for v3 endpoints.
- **Empty lists are normal**: If endpoints return `[]`, it means the location simply has no data yet (forms, surveys, workflows, etc. are empty in this account).

## Endpoint Status Map (Tested 2026-06-18)
| Endpoint | Status | Notes |
|---|---|---|
| `/contacts/` | 200 | Primary CRM endpoint |
| `/contacts/{id}` | 200 | Get single contact |
| `/contacts/{id}/tasks` | 200 | Contact tasks |
| `/contacts/{id}/notes` | 200 | Contact notes |
| `/contacts/{id}/appointments` | 200 | Contact appointments |
| `/contacts/search/duplicate` | 200 | Duplicate contact search |
| `/contacts/search` | 200 | POST advanced contact search; use `page`/`pageLimit` |
| `/conversations/search` | 200 | **Alternative path** (root `/conversations/` is 404) |
| `/opportunities/search` | 201/200 | POST advanced search works; GET uses `location_id` |
| `/objects/{schemaKey}/records/search` | 201 | POST; custom object records search |
| `/opportunities/pipelines` | 200 | Pipeline definitions |
| `/opportunities/lost-reason` | 200 | Requires `limit` & `skip` |
| `/calendars/` | 200 | Calendar list |
| `/workflows/` | 200 | Workflow list (empty) |
| `/campaigns/` | 200 | Campaign list (empty) |
| `/forms/` | 200 | Form list (empty) |
| `/forms/submissions` | 200 | Requires `page` as number |
| `/surveys/` | 200 | Survey list (empty) |
| `/surveys/submissions` | 200 | Requires `page` as number |
| `/products/` | 200 | Product catalog |
| `/products/inventory` | 200 | Requires `altId` + `altType` |
| `/businesses/` | 200 | Business list (empty) |
| `/users/` | 200 | 3 users found |
| `/users/search` | 200 | Requires `companyId` + `locationId` |
| `/campaigns/` | 200 | No `limit` param accepted |
| `/locations/{id}` | 200 | Location details |
| `/locations/{id}/tags` | 200 | Tags list (empty) |
| `/locations/{id}/customFields` | 200 | Custom fields (empty) |
| `/locations/{id}/customValues` | 200 | Custom values (empty) |
| `/locations/{id}/templates` | 200 | Templates (empty) |
| `/knowledge-base/` | 200 | KB list (empty) |
| `/knowledge-bases/` | 200 | Alternative KB path |
| `/ad-publishing/facebook/conversation-forms` | 200 | Ad Manager forms |
| `/social-media-posting/{id}/categories` | 200 | Social categories |
| `/social-media-posting/{id}/tags` | 200 | Social tags |
| `/social-media-posting/{id}/csv` | 200 | CSV upload status; requires `userId` |
| `/affiliate-manager/{id}/affiliates` | 200 | Affiliate list |
| `/affiliate-manager/{id}/payouts` | 200 | Payouts list |
| `/affiliate-manager/{id}/commissions` | 200 | Commissions list |
| `/agent-studio/agent` | 200 | AI agents |
| `/associations/` | 200 | Associations list |
| `/brand-boards/{id}` | 200 | Brand boards |
| `/marketplace/billing/charges` | 200 | Marketplace billing |
| `/proposals/document` | 200 | Proposals/documents |
| `/proposals/templates` | 200 | Proposal templates |
| `/voice-ai/agents` | 200 | Voice AI agents |
| `/calendars/groups` | 200 | Calendar groups |
| `/calendars/resources/rooms` | 200 | Calendar rooms/resources |
| `/links/search` | 200 | Trigger links search |
| `/phone-system/number-pools` | 200 | Number pools |
| `/payments/orders` | 200 | Requires `?altId=$LID&altType=location` |
| `/payments/subscriptions` | 200 | Requires `?altId=$LID&altType=location` |
| `/payments/transactions` | 200 | Requires `?altId=$LID&altType=location` |
| `/payments/coupon/list` | 200 | Requires `?altId=$LID&altType=location` |
| `/phone-system/numbers` | 200 | Requires `?locationId=$LID` |
| `/objects/` | 200 | Custom objects; requires `?locationId=$LID` |
| `/links/` | 200 | Trigger links; requires `?locationId=$LID` |
| `/store/shipping-zone` | 200 | Requires `?altId=$LID&altType=location` |
| `/blogs/site/all` | 200 | Empty blog sites list |
| `/blogs/authors` | 200 | Requires `limit` & `offset` |
| `/blogs/categories` | 200 | Requires `limit` & `offset` |
| `/blogs/posts/all` | 400/200 | Requires `blogId`, `limit`, `offset` (400 without blogId) |
| `/emails/builder` | 200 | Email builder templates (empty) |
| `/emails/schedule` | 200 | Email campaigns / schedules (empty) |
| `/funnels/funnel/list` | 200 | Funnels list (empty) |
| `/funnels/page` | 422 | Requires `funnelId`, `offset` |
| `/funnels/lookup/redirect/list` | 200 | URL redirects (empty) |
| `/social-media-posting/{locationId}/accounts` | 200 | Social accounts (empty) |
| `/social-media-posting/{locationId}/posts/list` | 201 | Requires `limit` as number string in body |
| `/contacts/{id}/tasks` | 200 | Contact tasks |
| `/locations/{locationId}/tasks/search` | 201 | POST; location task search |
| `/locations/{locationId}/recurring-tasks` | 200 | Recurring tasks (empty) |
| `/payments/integrations` | 401 | Needs `payments.readonly` scope |
| `/companies/{id}` | 401 | Needs **agency** token/scope |
| `/saas-api/*` | 401 | Needs **agency** token/scope |
| `/snapshots/*` | 401 | Needs **agency** token/scope |
| `/oauth/installedLocations` | 401 | Needs Marketplace OAuth app token |
| `/custom-menus/*` | 401 | Needs additional scope |
| `/associations/key/{keyName}` | 401 | Needs additional scope |
| `/invoices/` | 200 | Requires `?altId=$LID&altType=location&limit=&offset=0` |
| `/invoices/estimate/list` | 200 | Requires `?altId=$LID&altType=location&limit=&offset=0` |
| `/medias/files` | 200 | Requires `?altId=$LID&altType=location&type=file` |
| `/medias/upload-file` | 200 | `multipart/form-data`; max 25 MB |
| `/opportunities/search` | 200 | Uses `location_id` (underscore), not `locationId` |

### Endpoints NOT available via direct API v1 (use MCP instead)
These endpoints consistently return 404 in v1, are not exposed by the official SDK, or require Marketplace OAuth app configuration. The MCP server may handle them via internal or v3 APIs:
- **Courses** — The official SDK only exposes `/courses/courses-exporter/public/import`; no list/get endpoints were found under `/courses` or `/memberships/courses`.
- **Webhooks** — The SDK only provides a webhook **receiver** (`ghl.webhooks.subscribe()` / `ghl.webhooks.verifySignature()`). Webhook **registration/management** is configured inside a Marketplace OAuth app, not via the PIT-scoped API.
- **Root `/tasks`** — use `/contacts/{contactId}/tasks` or `/locations/{locationId}/tasks/search` instead.

## Full Access Setup (Acceso Total)
The PIT token already covers most endpoints, but a few features require extra steps.

### 1. SDK-based fallback scripts (created in `api-client/`)
A local Node.js wrapper around the official `@gohighlevel/api-client` is ready:
```bash
cd api-client
cp .env.example .env
# Edita .env si quieres cambiar token/location/version

# Llamar cualquier servicio del SDK
node ghl-client.js service contacts getContacts '{"locationId":"kNcygEmVTrhIueZQMDXM","limit":10}'

# Llamada raw a cualquier endpoint
node ghl-client.js raw GET /contacts/ '{"locationId":"kNcygEmVTrhIueZQMDXM","limit":10}'

# Listar todos los servicios y métodos disponibles
node ghl-client.js discover
```

### 2. Activar scopes adicionales en GHL UI (para endpoints 401)
Algunos endpoints devuelven 401 hasta que el scope correspondiente esté activo en **GHL Settings > Private Integrations > [Tu PIT]**:
- `/payments/integrations` → activar `payments.readonly`
- Revisar también: `funnels.readonly`, `social.readonly`, `blogs.readonly`, etc.

Pasos:
1. Inicia sesión en GoHighLevel como admin de la location.
2. Ve a **Settings > Integrations > Private Integrations**.
3. Selecciona el token PIT usado aquí.
4. Marca **todos los scopes** disponibles (read + write).
5. Guarda y espera 1-2 minutos.

### 3. Webhooks (requiere Marketplace OAuth app)
Los webhooks no se pueden registrar con un PIT. Se configuran dentro de una **Marketplace OAuth app privada**. A continuación el flujo completo:

#### 3.1 Crear la app en GHL Marketplace
1. Ve a https://marketplace.gohighlevel.com e inicia sesión con una cuenta de admin de la location.
2. Crea una **nueva app privada** (Private App).
3. En **Auth > Advanced**, selecciona **todos los scopes** disponibles (read + write).
4. En **Webhooks > Advanced**:
   - Webhook URL: tu endpoint público, ej. `https://tudominio.com/webhooks/ghl` (para pruebas locales usa ngrok).
   - Suscribe los eventos que necesites. Recomendados para Control Ads:
     - `ContactCreate`, `ContactUpdate`, `ContactTagUpdate`
     - `OpportunityCreate`, `OpportunityStatusUpdate`, `OpportunityStageUpdate`
     - `InvoiceCreate`, `InvoicePaid`, `InvoiceVoided`
     - `PaymentCreate`, `PaymentRefund`
     - `AppointmentCreate`, `AppointmentUpdate`
5. Guarda la app. Anota el **Client ID** y **Client Secret**.
6. Instala la app en la location `kNcygEmVTrhIueZQMDXM`. Durante la instalación recibirás un **código de autorización** en la redirect URI configurada.

#### 3.2 Preparar el receptor (producción)
El receptor de producción es un **Cloudflare Worker** en `webhook-worker/`. Verifica firmas Ed25519 (`X-GHL-Signature`) y legacy RSA (`X-WH-Signature`).

```bash
cd webhook-worker
npm install
npx wrangler login
npx wrangler secret put GHL_WEBHOOK_ADMIN_SECRET
npx wrangler deploy
```

La URL será algo como:
```
https://ghl-control-ads-webhook-worker.tu-cuenta.workers.dev/webhooks/ghl
```

#### 3.2.1 Receptor local (solo pruebas)
Si quieres probar localmente con ngrok:
```bash
# Terminal 1
cd api-client
npm install express  # solo la primera vez
GHL_WEBHOOK_PORT=3000 node webhook-server.js

# Terminal 2 (si no tienes ngrok, instálalo: https://ngrok.com/download)
ngrok http 3000
# Copia la URL https de ngrok (ej. https://abc123.ngrok.io) y pégala en Webhooks > Advanced.
```

#### 3.3 Obtener el Location Access Token
Usa `api-client/oauth-helper.js` o los helpers basados en `.env` para intercambiar el auth code o refrescar el token:

```bash
cd api-client

# Opción A: pasar todo por argumentos
node oauth-helper.js authorize <clientId> <clientSecret> <authCode>
node oauth-helper.js refresh <clientId> <clientSecret> <refreshToken>

# Opción B: leer Client ID / Client Secret desde .env (más cómodo)
# Asegurate de tener GHL_OAUTH_CLIENT_ID y GHL_OAUTH_CLIENT_SECRET en .env
node exchange-oauth-code.mjs <authCode>
node refresh-oauth-token.mjs
```

La respuesta incluye:
```json
{
  "access_token": "at-...",
  "refresh_token": "rt-...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "location_id": "kNcygEmVTrhIueZQMDXM"
}
```

#### 3.4 Verificar que funciona
Con el Location Access Token puedes llamar a la API como si fuera un PIT, pero con scopes de Marketplace:
```bash
TOKEN="at-..."
curl -s "https://services.leadconnectorhq.com/contacts/?locationId=kNcygEmVTrhIueZQMDXM&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Version: 2021-07-28"
```

Y en `api-client/webhooks.log` verás llegar los eventos suscritos.

### 4. Cursos / Memberships
La API pública solo expone el endpoint de importación:
```bash
POST /courses/courses-exporter/public/import
```
No hay endpoints de listado/lectura de cursos vía PIT. Si necesitas control total sobre cursos, las opciones son:
- Usar el MCP pago `@elitedcs/ghl-mcp` (~$97/mes; anuncia soporte de cursos, funnel editor y webhooks nativos).
- Crear una Marketplace OAuth app con scopes de courses (si GHL los expone para tu app).
- Alternativas open source evaluadas (`basicmachines-co/open-ghl-mcp`, `BusyBee3333/Go-High-Level-MCP-2026-Complete`, `uxieee/uxie-ghl-mcp-server`) no ofrecen CRUD de cursos ni funnel editor.

## Workflow Details via Chrome Extension (PIT cannot read workflow internals)
The official API / SDK only lists workflows (`/workflows/`) but does **not** expose the internal triggers, actions, or step tree of a workflow. To get full workflow internals for analysis in OpenCode/Claude Code, use the local Chrome extension in `ghl-workflow-extractor/`.

It targets GHL's private SPA API (`backend.leadconnectorhq.com`) using the live browser session token, captures:
- Workflow list + folders
- Full workflow document (`workflowData.templates[]` = actions)
- Triggers array

And sends everything to a local server that writes `workflows-live.json`.

### Quick start
```bash
# Terminal 1 — start receiver
cd ghl-workflow-extractor
node server.js

# Terminal 2 — load the extension in Chrome:
# 1. Open chrome://extensions, enable Developer mode.
# 2. Click Load unpacked, select ghl-workflow-extractor/.
# 3. In GHL go to Automation → Workflows.
# 4. Click the new "Enviar a OpenCode" button next to Create Workflow.
# 5. Return to this chat and ask: "Ya extraje los workflows, muéstrame qué hacen."
```

**Security notes:**
- `workflows-live.json` and any session token files are gitignored.
- The local server only listens on `localhost:8765`.
- The captured session token expires in ~1 hour.

See `ghl-workflow-extractor/README-OPENCODE.md` for full instructions and troubleshooting.

## When to use Direct API
- Bulk operations beyond MCP tool limits.
- Custom reports or aggregations.
- Endpoints not yet exposed by the MCP server (check `@nerdsnipe-inc/ghl-mcp-server` updates).
- File uploads or binary operations.
- When you need v3 API features not in MCP tools.

## Troubleshooting
- `401` → token expired/revoked. Regenerate in GHL.
- `403` → token does not match location ID or missing scope.
- `422` → invalid payload. Check required fields and formats.
- `429` → rate limited. Wait and retry.
- MCP server not responding → restart OpenCode / Claude or run `npx -y @nerdsnipe-inc/ghl-mcp-server` manually to test.
- Empty results `[]` → not an error; the location simply has no data in that category.

## Research Notes (2026-06-18)
- Investigated GHL API v3 docs, official SDK `@gohighlevel/api-client`, and 40+ endpoint variations.
- Discovered that many v3 endpoints use **different paths** than intuitive guesses (e.g., `/objects/` instead of `/custom-objects/`, `/links/` instead of `/trigger-links/`, `/phone-system/numbers?locationId=` instead of `/phone-numbers/`). GHL does **not** use a `/v3/` URL prefix; version is sent via the `Version` header.
- Payments endpoints consistently require `altId` + `altType=location` instead of `locationId`.
- Some endpoints (invoices, estimates, media files) return 422 because they need **mandatory query params** not documented in the root path — use MCP tools for these.
- SDK source-code audit revealed working direct paths for **blogs**, **emails**, **funnels**, **social media posting**, **tasks**, **invoices**, **estimates**, **media files**, and **opportunities search** that were previously marked 404/422.
- Created local fallback scripts (`api-client/ghl-client.js`, `api-client/webhook-server.js`, `api-client/oauth-helper.js`) using the official SDK.
- Performed a mass audit of **576 endpoints across 41 SDK services** for location `kNcygEmVTrhIueZQMDXM`. Results: 54 endpoints returned 200 with default params; 75 returned 422 (fixable with correct params); 25 returned 401 (missing scopes/agency token); 27 returned 404.
- Official GHL docs confirm webhooks are managed through a **Marketplace OAuth app**, not the PIT token.
- **Courses** and **webhooks** remain unavailable via PIT-scoped direct API: courses only have a public import endpoint, and webhooks are managed through a Marketplace OAuth app.
- **File upload** (`POST /medias/upload-file`) confirmed working with `multipart/form-data`; max 25 MB.
- **Revenue snapshot** for `kNcygEmVTrhIueZQMDXM`: 292 succeeded transactions = USD 25,383.99; 9 refunded = USD 1,239.00; **net received = USD 24,144.99**. Top product: `Contingencia SUDO 2025 Matias` (157 sales / USD 18,523.00). Location has 8 active sales funnels.
- Evaluated free/open-source MCP alternatives: `@nerdsnipe-inc/ghl-mcp-server` (127 tools, already in use), `basicmachines-co/open-ghl-mcp`, `BusyBee3333/Go-High-Level-MCP-2026-Complete`, `uxieee/uxie-ghl-mcp-server` (lists courses), `drausal/gohighlevel-mcp`. None provide workflow builder write access, funnel/page editor, or native webhooks; our custom workflow MCP server already covers workflow CRUD.
- Pushed the complete project to GitHub: `https://github.com/FaidersAltamar/ghl-mcp-control-total`.

## Last Updated
2026-06-19 (cleaned workflows; added alternatives, revenue snapshot, GitHub repo)
