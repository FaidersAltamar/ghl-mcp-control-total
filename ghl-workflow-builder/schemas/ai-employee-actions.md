# AI Employee (Conversation AI) Action Types

These are the actions available within the AI Employee system — distinct from workflow builder actions. AI employees are conversation agents that can perform these actions during chat interactions.

## AI Employee Action Types (16)

| Action Type | Description | Config Fields |
|------------|-------------|---------------|
| `appointmentBooking` | Book appointment through AI bot | calendarLink, timeZone, slots, groupedSlots, isAppointmentBooked, isCalendarLink, cancel/reschedule enabled |
| `appointmentCancelReschedule` | Cancel/reschedule appointment via AI | cancelLabel, cancelDescription, rescheduleLabel, rescheduleDescription |
| `triggerWorkflow` | Trigger a workflow from the AI bot | workflowId, triggerCondition, triggerConditionDescription |
| `transferBot` | Transfer conversation to another AI bot | selectedBot, selectedChannel, status (primary), currentBot |
| `stopBot` | Stop/deactivate the bot | examplePhrases, finalMessage, reactivateBot, triggerConditionHint, stopBotDetectionType |
| `humanHandover` | Hand conversation to a human agent | examplePhrases, triggerCondition, finalMessage, createTask, reactivateBot, enterNumber |
| `advancedFollowup` | Advanced follow-up actions | — |
| `updateContactField` | Update contact field from AI conversation | fieldKey, fieldValue |
| `sendBotToSleep` | Put bot to sleep (with optional timed reactivation) | sleepTime, sleepTimeUnit |
| `reactivateBot` | Reactivate a sleeping bot | — |
| `create_booking` | Create a booking (calendar action) | calendarId |
| `cancel_booking` | Cancel a booking | — |
| `workflow_action` | Generic workflow action reference | workflowId |
| `multiple_calendars_appointment_booking` | Multi-calendar appointment booking | calendarIds[] |
| `log_action` | Log an action | — |
| `conv_ai_trigger` | Conversation AI trigger event | — |

## AI Employee Bot Types

| Type | Description |
|------|-------------|
| `FORM_BASED_BOT` | Form-based bot (structured question flow) |
| `PROMPT_BASED_BOT` | Prompt/instruction-based bot (free-form AI) |
| `FLOW_BUILDER_BOT` | Flow builder-based bot (visual flow) |

## AI Employee Intent Types

| Intent | Description |
|--------|-------------|
| `GENERAL_SUPPORT` | General support intent |
| `APPOINTMENT_BOOKING` | Appointment booking intent |
| `APPOINTMENT_BOOKING_FLOW` | Appointment booking flow intent |
| `CUSTOM` | Custom intent |
| `OBJECTIVE` | Objective-based |

## AI Employee Modes

| Mode | Description |
|------|-------------|
| `off` | Bot disabled |
| `suggestive` | Suggests responses (human approves before sending) |
| `auto-pilot` | Fully autonomous |

## AI Employee Channels

| Channel | Internal Key |
|---------|-------------|
| Instagram | `IG` |
| Facebook | `FB` |
| SMS | `SMS` |
| Web Chat | `WebChat` |
| Live Chat | `Live_Chat` |
| Google My Business | `GMB` |
| WhatsApp | `WhatsApp` |

## AI Employee Notification Types

| Type | Description |
|------|-------------|
| `CUSTOM_EMAIL` | Custom email notification |
| `SPECIFIC_USERS` | Notify specific users |
| `ALL_USERS` | Notify all users |
| `ALL_ADMINS` | Notify all admins |
| `CONTACTS_ASSIGNED_USERS` | Notify assigned user(s) |

## AI Employee Action Metrics

| Metric | What it tracks |
|--------|---------------|
| `totalAppointmentsBookedActions` | Appointments booked by AI |
| `totalAppointmentCancelActions` | Appointments cancelled by AI |
| `totalAppointmentRescheduledActions` | Appointments rescheduled by AI |
| `totalAppointmentLinkSharedActions` | Booking links shared |
| `totalContactInfoUpdatedActions` | Contact fields updated |
| `totalHumanHandoverActions` | Human handovers triggered |
| `totalHumanHandoverTriggeredActions` | Human handover events |
| `totalStopBotTriggeredActions` | Bot stop events |
| `totalTransferBotActions` | Bot transfers |
| `totalWorkflowsTriggeredActions` | Workflows triggered by AI |
| `totalAdvancedFollowupActions` | Advanced follow-ups |

## AI Employee Product Types

| Type | Description |
|------|-------------|
| `CONVERSATION_AI` / `CONVERSATIONS_AI` | Conversation AI product |
| `AI_EMPLOYEE` | AI Employee product |
| `AGENT_STUDIO` | Agent Studio |
| `DUMMY_KB` | Dummy knowledge base |
| `UPDATE_FIELD` | Update field action |

## Bulk Operations (18 types)

These are CRM-level bulk operations, not workflow steps, but part of the automation surface area.

| Bulk Type | Description |
|-----------|-------------|
| `bulk-edit` | Bulk edit records |
| `bulk-import` / `bulk-import-v2` | Bulk import contacts |
| `bulk-ops-delete` / `bulk-delete-v2` | Bulk delete operations |
| `bulk-campaign` / `bulk-campaign-v2` | Bulk add to campaign |
| `bulk-contact-delete` | Bulk delete contacts |
| `bulk-contacts-to-company` | Bulk assign contacts to company |
| `bulk-email` / `bulk-email-v2` | Bulk email send |
| `bulk-email-verification` | Bulk email verification |
| `bulk-export` / `bulk-export-v2` | Bulk export records |
| `bulk-merge-contact` | Bulk merge duplicate contacts |
| `bulk-ops` / `bulk_ops_v2` | Bulk operations on opportunities |
| `bulk-review-request` / `bulk-review-request-v2` | Bulk review request |
| `bulk-sms` / `bulk-sms-v2` | Bulk SMS send |
| `bulk-rcs-sms` | Bulk RCS/SMS variant |
| `bulk-tag-add` | Bulk add tags |
| `bulk-tag-remove` | Bulk remove tags |
| `bulk-whatsapp` | Bulk WhatsApp message |
| `bulk-workflow` / `bulk-workflow-v2` | Bulk add to workflow |

### Bulk Schedule Types

| Type | Description |
|------|-------------|
| `SEND_ALL_AT_ONCE` / `NOW` | Send immediately |
| `SEND_IN_DRIP_MODE` / `DRIP` | Send gradually |
| `SEND_AT_SCHEDULED_TIME` / `SCHEDULED` | Send at specified time |
