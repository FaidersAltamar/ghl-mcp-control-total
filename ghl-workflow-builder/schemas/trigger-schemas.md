# GHL Trigger Type Schemas

Extracted from GHL workflow builder JS bundle (`client-app-automation-workflows.leadconnectorhq.com`).
Last updated: 2026-03-23

## CRITICAL: Type String Corrections

29 of 54 trigger type strings differ between UI name and API value.
**Always use the API Value column.**

## Complete Trigger Registry (54 types)

### Contact Triggers
| UI Name | API Value | Validator | Required Conditions |
|---------|----------|-----------|-------------------|
| Contact Tag Added/Removed | `contact_tag` | contactTagValidator | `[{field:"tagsAdded", operator:"index-of-true", value:"TAG_NAME", title:"Tag Added", type:"select", id:"tag-added"}]` |
| Contact Created | `contact_created` | contactCreatedValidator | `[]` (no conditions required) |
| Contact Changed | `contact_changed` | contactChangedValidator | Filter by changed field (optional): `[{field:"contact.customFields", ...}]` |
| Contact DND | `dnd_contact` | contactDndValidator | Needs DND type condition |
| Birthday Reminder | `birthday_reminder` | birthdayReminderValidator | `[]` (no conditions required) |

### Communication Triggers
| UI Name | API Value | Validator | Required Conditions |
|---------|----------|-----------|-------------------|
| Customer Replied | `customer_reply` | customerReplyValidator | `[]` (optional channel filter) |
| Call Details | `call_status` | callStatusValidator | Optional: `[{field:"call.status", ...}]` |
| Email Events | `mailgun_email_event` | emailEventsValidator | Optional event type filter |

### Form & Survey Triggers
| UI Name | API Value | Validator | Required Conditions |
|---------|----------|-----------|-------------------|
| Form Submitted | `form_submission` | formSubmissionValidator | `[{field:"form.id", operator:"is", value:"FORM_ID", title:"Form", type:"select"}]` |
| Survey Submitted | `survey_submission` | surveySubmissionValidator | `[{field:"survey.id", operator:"is", value:"SURVEY_ID", title:"Survey", type:"select"}]` |
| Trigger Link Clicked | `trigger_link` | triggerLinkValidator | Needs link selection |
| Video Tracking | `video_event` | videoEventValidator | Needs video event config |

### Appointment Triggers
| UI Name | API Value | Validator | Required Conditions |
|---------|----------|-----------|-------------------|
| Appointment Status | `appointment` | appointmentValidator | `[{field:"calendar.id", operator:"is", value:"CALENDAR_ID", title:"Calendar", type:"select"}]` |
| Customer Booked Appointment | `customer_appointment` | appointmentValidator | Same as appointment |

### Opportunity/Pipeline Triggers
| UI Name | API Value | Validator | Required Conditions |
|---------|----------|-----------|-------------------|
| Opportunity Status Changed | `opportunity_status_changed` | opportunityValidator | `[{field:"opportunity.pipelineId", operator:"is", value:"PIPELINE_ID"}, {field:"opportunity.pipelineStageId", operator:"is", value:"STAGE_ID"}]` |
| Opportunity Created | `opportunity_created` | opportunityValidator | Same pipeline/stage conditions |
| Opportunity Changed | `opportunity_changed` | opportunityValidator | Same pipeline/stage conditions |
| Pipeline Stage Changed | `pipeline_stage_updated` | opportunityValidator | Same pipeline/stage conditions |
| Stale Opportunities | `opportunity_decay` | opportunityValidator | Same pipeline/stage conditions |

### Payment & Commerce Triggers
| UI Name | API Value | Validator | Required Conditions |
|---------|----------|-----------|-------------------|
| Payment Received | `payment_received` | paymentReceivedValidator | `[{field:"payment.calendar.id", ...}]` or `[{field:"payment.form.id", ...}]` |
| Invoice | `invoice` | invoiceValidator | Optional: `[{field:"invoice.status", ...}]` |
| Order Submitted | `order_submission` | orderSubmissionValidator | Optional conditions |
| Order Form Submission | `two_step_form_submission` | twoStepOrderFormValidator | `[{field:"twoStepOrderForm.funnelId", ...}, {field:"twoStepOrderForm.pageId", ...}]` |

### Shopify Triggers
| UI Name | API Value | Validator | Required Conditions |
|---------|----------|-----------|-------------------|
| Abandoned Checkout | `shopify_abandoned_cart` | shopifyTriggerValidator | Shopify connection required |
| Order Placed | `shopify_order_placed` | shopifyTriggerValidator | Shopify connection required |
| Order Fulfilled | `shopify_order_fulfilled` | shopifyTriggerValidator | Shopify connection required |

### Social & Ads Triggers
| UI Name | API Value | Validator | Required Conditions |
|---------|----------|-----------|-------------------|
| Facebook Lead Form | `facebook_lead_gen` | facebookLeadGenValidator | `[{field:"facebook.formId", ...}]` |
| TikTok Form | `tik_tok_form_submitted` | tiktokFormValidator | `[{field:"tiktok.formId", ...}]` |
| Facebook Comment | `facebook_comment_on_post` | facebookCommentValidator | FB page connection required |
| Instagram Comment | `ig_comment_on_post` | instagramCommentValidator | IG account connection required |

### Membership/Course Triggers
| UI Name | API Value | Validator | Required Conditions |
|---------|----------|-----------|-------------------|
| Membership New Signup | `membership_contact_created` | membershipCourseValidator | Optional course filter |
| Category Started | `category_started` | membershipCourseValidator | Optional course filter |
| Category Completed | `category_completed` | membershipCourseValidator | Optional course filter |
| Lesson Started | `lesson_started` | membershipCourseValidator | Optional course filter |
| Lesson Completed | `lesson_completed` | membershipCourseValidator | Optional course filter |
| Offer Access Granted | `offer_access_granted` | membershipCourseValidator | Optional course filter |
| Offer Access Removed | `offer_access_removed` | membershipCourseValidator | Optional course filter |
| Product Access Granted | `product_access_granted` | membershipCourseValidator | Optional course filter |
| Product Access Removed | `product_access_removed` | membershipCourseValidator | Optional course filter |
| Product Started | `product_started` | membershipCourseValidator | Optional course filter |
| Product Completed | `product_completed` | membershipCourseValidator | Optional course filter |
| User Login | `user_log_in` | membershipCourseValidator | Optional course filter |

### Task & Note Triggers
| UI Name | API Value | Validator | Required Conditions |
|---------|----------|-----------|-------------------|
| Note Added | `note_add` | notesTriggerValidator | `[]` (optional) |
| Note Changed | `note_changed` | notesTriggerValidator | `[]` (optional) |
| Task Added | `task_added` | taskAddedValidator | Optional conditions |
| Task Reminder | `task_due_date_reminder` | taskDueDateReminderValidator | Optional conditions |

### Other Triggers
| UI Name | API Value | Validator | Required Conditions |
|---------|----------|-----------|-------------------|
| Manual Trigger | `manual_trigger` | — | `[]` (no conditions) |
| Inbound Webhook | `inbound_webhook` | inboundWebhookValidator | Webhook URL auto-generated |
| Custom Date Reminder | `custom_date_reminder` | customDateReminderValidator | Date field selection |
| Scheduler | `scheduler_trigger` | schedulerValidator | Schedule interval config |
| Number Validation | `validation_error` | validationErrorValidator | Phone number config |
| Affiliate Created | `affiliate_created` | affiliateCreatedValidator | `[]` (optional) |
| Start IVR | `ivr_incoming_call` | ivrIncomingCallValidator | `[{field:"inbound_number", ...}]` |
| Custom Object Created | `custom_object_created` | customObjectTriggerValidator | Object type selection |
| Custom Object Changed | `custom_object_changed` | customObjectTriggerValidator | Object type selection |
| Conversation AI | `conv_ai_trigger` | — | AI employee config |
| Conversation AI Autonomous | `conv_ai_autonomous_trigger` | — | AI employee config |

## Condition Schema Format

All conditions follow this pattern:
```json
{
  "field": "entity.property",
  "operator": "is|index-of-true|contains|eq",
  "value": "selected_value_or_id",
  "title": "Display Name",
  "type": "select|text|multiselect",
  "id": "condition-unique-id"
}
```

## Triggers That Work Without Conditions

These triggers can be created with empty conditions `[]`:
- `contact_created`
- `birthday_reminder`
- `note_add`
- `note_changed`
- `manual_trigger`
- `affiliate_created`
- `customer_reply` (optional channel filter)
- `call_status` (optional status filter)

## Triggers That REQUIRE Conditions

These triggers show "choose a trigger" or errors without proper conditions:
- `form_submission` — needs `form.id`
- `survey_submission` — needs `survey.id`
- `appointment` / `customer_appointment` — needs `calendar.id`
- `opportunity_*` / `pipeline_stage_updated` / `opportunity_decay` — needs `opportunity.pipelineId`
- `payment_received` — needs `payment.calendar.id` or `payment.form.id`
- `facebook_lead_gen` — needs `facebook.formId`
- `tik_tok_form_submitted` — needs `tiktok.formId`
- `two_step_form_submission` — needs `twoStepOrderForm.funnelId` + `.pageId`
- `ivr_incoming_call` — needs `inbound_number`
- `contact_tag` — needs `tagsAdded` or `tagsRemoved` value

## Action Dependencies

Some actions require specific triggers or parent structures:
- `respond_on_comment` — requires `facebook_comment_on_post` or `ig_comment_on_post` trigger
- `goto` — must be inside an `if_else` branch (needs parent structure)
- `transition` — must be child of `workflow_split`, `if_else`, or `wait` (multi-path)
- `find_opportunity` — needs `pipeline_id` attribute (corrupted type without it)
