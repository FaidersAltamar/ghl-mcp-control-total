# GHL Workflow Catalog

Captured: 2026-05-19 · merged: 2026-05-26
313 action types · 159 trigger types

Sources:
- **Marketplace assets**: third-party integrations + some native (richest input schemas).
- **SPA bundle**: builder primitives + core triggers (icons + categories; `inputs[]` empty because each type uses a bespoke Vue config component).

Entries marked `(bundle)` come from the SPA bundle and have `inputs: []`. To learn their `attributes` shape, see `example` on each entry or export real workflows that use them.

---

## Actions by app

### AI (1)
- `kb_search` · **Knowledge Base Search** — Search across one or more Knowledge Bases for the most relevant content for a query. Available only 

### AI Actions (4)
- `workflow_ai_translate_content` · **AI Translate** — Translate your default content to contact language
- `workflow_ai_summarize_text` · **AI Summarize** — Enter a text and generate a summary
- `workflow_ai_intent_detection` · **AI Intent Detection** — Generate an analysis of the sentiment of the input text
- `workflow_ai_decision_maker` · **AI Decision Maker** — Let AI decide which branch to go into

### Agent Studio (1)
- `agent_studio_execution` · **Invoke Agent in Agent Studio** — Invokes an Agent Studio agent (trigger type: Workflow) that’s been promoted to Production.

### Airtable (5)
- `airtable_create_record` · **Create Record** — Create a new record in an Airtable base.
- `airtable_update_record` · **Update Record** — Update a record in an Airtable base with specified fields.
- `airtable_delete_record` · **Delete Record** — Deletes a record from a specified Airtable base and table.
- `airtable_retrieve_record` · **Find Record** — Fetches a specific record from an Airtable base and table by either applying a formula or searching 
- `airtable_find_record_by_id` · **Find Record By ID** — Retrieve a specific record from an Airtable base using its record ID.

### Apify (8)
- `lc_custom_apify_fetch_dataset_items` · **Fetch Dataset Items** — Fetch items from an Apify Dataset (often from a Run’s defaultDatasetId).
- `lc_custom_apify_find_last_task_run` · **Find Last Task Run** — Get details of the most recent Apify Task run (optionally filtered by status).
- `lc_custom_apify_scrape_single_url` · **Scrape Single URL** — Start an async scrape of a single web page using Apify Website Content Crawler and return run detail
- `lc_custom_apify_run_task` · **Run a Task** — Start an Apify Task run (optionally wait up to 30 seconds for it to finish).
- `lc_custom_apify_set_key_value_store_record` · **Set Key-Value Store Record** — Write a record to an Apify Key-Value Store by key.
- `lc_custom_apify_find_last_actor_run` · **Find Last Actor Run** — Get details of the most recent Apify Actor run (optionally filtered by status).
- `lc_custom_apify_fetch_key_value_store_record` · **Fetch Key-Value Store Record** — Fetch a record from an Apify Key-Value Store by key.
- `lc_apify_run_a_actor` · **Run A Actor** — Start an Apify Actor run (optionally wait up to 30 seconds for it to finish).

### Asana (15)
- `asana_ia_asana_create_task` · **Create Task** — Create a new task in Asana
- `asana_ia_asana_update_task` · **Update Task** — Update an existing task in Asana with various properties.
- `asana_ia_asana_get_task` · **Find Task** — Retrieve details of a specific task from Asana
- `asana_ia_asana_create_section` · **Create Section** — Create a new section in a specified Asana project.
- `asana_ia_find_comment_from_task` · **Find Comment(s) From Task** — Retrieve comments from a task in Asana.
- `asana_ia_asana_add_task_to_section` · **Add Task To Section Of Project** — Add a task to a specific section in an Asana project.
- `asana_ia_find_all_tasks_from_project` · **Find All Tasks From Project** — Retrieve all tasks from a specified project in Asana.
- `asana_ia_find_task_in_project` · **Find Task In Project** — Search for a task within the project. This may return multiple matching tasks.
- `asana_ia_asana_create_comment` · **Create Comment/story** — Add a comment or story to a task in Asana.
- `asana_ia_asana_create_subtask` · **Create Subtask** — Create a new subtask in Asana.
- `asana_ia_asana_create_project` · **Create Project** — Create a new project in Asana with specified details.
- `asana_ia_find_comment_from_task_id` · **Find Comments(s) by Task Id** — Retrieve comments associated with a specific task in Asana.
- `asana_ia_asana_find_task_by_id` · **Find Task By Id** — Retrieve details of a specific task from Asana
- `lc_custom_asana_find_section` · **Find Section** — Search for sections in an Asana project by name (partial match).
- `lc_custom_asana_get_project_by_id` · **Find Project** — Retrieve details of specific asana project and its ID

### Associations (4)
- `remove_associated_records_from_workflow` · **Remove Associated Records From Workflow** —   (attributes) => { const associatedObject = attributes?.inputs?.associatedObject?.value; const asso
- `add_associated_records_to_workflow` · **Add associated records to workflow** —   (attributes) => { const associatedObject = attributes?.inputs?.associatedObject?.value; const asso
- `remove_associated_record` · **Remove Associated Record** — This action removes the relationship between records. No records will be deleted.
- `associate_records` · **Associate Records** — (attributes)=>`Create an association between the ${attributes?.customObjectLabel?.singular} object a

### BaseCamp (19)
- `basecamp_create_todo_list` · **Create To-do List** — Create a new to-do list in a Basecamp project
- `basecamp_create_todo` · **Create To-do** — Create a new to-do item in a Basecamp project.
- `basecamp_get_todo` · **Get To-do** — Retrieve a specific to-do item from Basecamp
- `basecamp_create_message` · **Create Message** — Create a new message in a BaseCamp project
- `basecamp_create_campfire_message` · **Create Campfire Message** — Send a message to a BaseCamp Campfire chat room.
- `basecamp_update_todo` · **Update To-do** — Update a to-do item in BaseCamp
- `add_person_to_project` · **Add Person to Project** — Send a message to a BaseCamp Campfire chat room.
- `basecamp_create_comment_on_message` · **Create Comment On Message** — Add a comment to a specific message in BaseCamp.
- `basecamp_create_project_from_template` · **Create Project From Template** — Create a new project in Basecamp using a specified template.
- `basecamp_create_document` · **Create Document** — Create a new document in a Basecamp project
- `basecamp_upload_file` · **Upload File** — Uploads a file to a specific project in BaseCamp.
- `basecamp_create_schedule_entry` · **Create Schedule Entry** — Create a new schedule entry in a BaseCamp project.
- `basecamp_find_to_do` · **Find To-Do** — Find To Do Item in BaseCamp
- `basecamp_find_project` · **Find Project** — Retrieve details of a specific project in BaseCamp.
- `basecamp_create_comment_on_todo` · **Create Comment On Todo** — Add a comment to a specific todo item in BaseCamp.
- `basecamp_find_to_do_list` · **Find To-do List** — Retrieve a specific to-do list from BaseCamp by its ID.
- `create_basecamp_project` · **Create Project** — Create a new project in BaseCamp
- `basecamp_find_person` · **Find Person** — Find a person in BaseCamp by their ID or email.
- `basecamp_find_document` · **Find Document** — Search for a document in BaseCamp by its name or other attributes.

### Cal.com (4)
- `lc_cal_com_cancel_booking` · **Cancel booking** — Cancel an existing booking in Cal.com
- `lc_cal_com_reschedule_booking` · **Reschedule booking** — Reschedule an existing Cal.com booking to a new time.
- `lc_cal_com_find_booking` · **Find booking** — Search and retrieve bookings from Cal.com, optionally filtered by status.
- `lc_cal_com_create_booking` · **Create booking** — Create a new booking in Cal.com for a specific event type.

### ClickUp (18)
- `create_new_document` · **Create New Document** — Create a new document in ClickUp
- `create_new_document_page` · **Create New Document Page** — Create a new document page in ClickUp.
- `edit_document_page` · **Edit Document Page** — Edit a document page in ClickUp
- `clickup_archive_task` · **Archive Task** — Archives a specified task in ClickUp.
- `clickup_add_comment` · **Add Comment To Task** — Adds a comment to a specified task in ClickUp.
- `find_task_by_id` · **Find Task By Id** — Retrieve details of a specific task in ClickUp using its ID.
- `find_documents` · **Find Documents** — Search and retrieve documents from ClickUp based on specified criteria.
- `find_custom_fields` · **Find Custom Fields** — Retrieve a list of custom fields for a specific ClickUp list.
- `clickup_create_list` · **Create List** — Creates a new list in a specified ClickUp folder.
- `find_all_tasks` · **Find Tasks** — Retrieve a comprehensive list of all tasks from ClickUp.
- `clickup_ia_create_space` · **Create Space** — Creates a new space in a specified ClickUp team.
- `clickup_ia_create_folder` · **Create Folder** — Creates a new folder in a specified ClickUp space.
- `clickup_ia_create_task` · **Create Task** — Creates a new task in ClickUp.
- `clickup_new_checklist` · **Add Checklist To Task** — Add a checklist to a specific task in ClickUp.
- `clickup_ia_delete_task` · **Delete Task** — Deletes a specified task in ClickUp.
- `clickup_ia_update_task` · **Update Task** — Updates the existing task in ClickUp
- `clickup_ia_create_sub_task` · **Create Sub Task** — Create a new sub task in ClickUp
- `create_task_attachment` · **Post Attachment** — Attach a file to a specific task in ClickUp.

### Communities (6)
- `custom-push-notification` · **Smart Push Notification** — Send push notifications to client-portal mobile app and browser based on triggers for real-time enga
- `grant-group-access` · **Grant Group Access** — Grant contact access to a specific membership community group
- `revoke-group-access` · **Revoke Group Access** — Remove contact's access to a specified membership community group
- `grant-private-channel-access` · **Grant Private Channel Access** — Grants access to a specific community group's private channel
- `revoke-private-channel-access` · **Revoke Private Channel Access** — Removes contact's access from a specific community group's private channel
- `grant_user_group_gamification_points` · **Grant Community Group Leaderboard Points** — This action allows you to grant points to a community group member's leaderboard. You can specify th

### Company (3)
- `create_and_associate_company` · **Create And Associate Company** — Create a new company record and automatically associate it with the contact in this workflow.
- `update_associated_company` · **Update Associated Company** — Updates the details of the primary company associated with the contact. If no company is associated,
- `clear_associated_company_fields` · **Clear Associated Company Fields** — Clear selected fields of the primary company associated with the contact. If no company is associate

### Conversation AI (9)
- `conversationai_objective` · **AI Capture Information** — Define an individual goal your bot should achieve, like collecting a name, email, or phone before en
- `conversationai_book_appointment` · **Book Appointment** — Define the logic for booking an appointment
- `conversationai_end` · **End Conversation** — End or Stop the conversation with the contact
- `conversationai_ai_splitter` · **AI Splitter** — Let AI determine the best response path by analyzing user input and directing to the correct convers
- `conversationai_ai_message` · **AI Message** — Bot will send a message based on the prompt
- `conversationai_custom_message` · **Custom Message** — Bot will send a custom message as it is
- `conversationai_transfer_bot` · **Transfer Bot** — Hand over the conversation to another bot when needed.
- `conversationai_continue` · **Continue Conversation** — The bot will continue to engage with the contact using the Knowledge base and Global prompt 
- `conversationai_services_booking` · **Services Booking** — Use it to add Services you want to book using Conversation AI Flow Builder Bot

### Fathom (3)
- `lc_fathom_list_recordings` · **List recordings** — Retrieve the List of recordings from Fathom.
- `lc_fathom_fetch_transcript` · **Fetch transcript** — Fetch the transcript of recording by recording id.
- `lc_fathom_fetch_summary` · **Fetch summary** — Fetch the summary of recording by recording id.

### Google Contacts (6)
- `googlecontacts_create_contact_group` · **Create Contact Group** — Create a new contact group in Google Contacts.
- `googlecontacts_find` · **Find Contact** — Search for a contact in Google Contacts by name or email.
- `googlecontacts_update_contact` · **Update Contact** — Update an existing contact in Google Contacts.
- `add_contact_to_groups` · **Add Contact To Groups** — Add a contact to one or more groups in Google Contacts.
- `googlecontact_create_contact` · **Create Contact** — Update an existing contact in Google Contacts.
- `find_or_create_contact` · **Find Or Create Contact** — Finds an existing contact by email or creates a new contact if none is found. 

### Google Forms (4)
- `lc_gform_find_responses` · **Find Responses** — Retrieve responses from a specific Google Form.
- `lc_gforms_find_forms_by_name` · **Find Forms By Name** — Retrieve the details of a specific Google Form by searching for it using its name.
- `lc_gforms_find_response_by_id` · **Find Response By ID** — Retrieve response from a specific Google Form and Response Id.
- `lc_gforms_find_form_by_id` · **Find Form By ID** — Retrieve details of a specific Google Form using its form ID.

### Google Slides (3)
- `lc_gs_refresh_charts` · **Refresh charts synced to google sheets** — Refreshes charts in a Google Slides presentation that are synced to Google Sheets.
- `lc_gs_find_presentation` · **Find Presentation** — Retrieves Google Slides presentations by Name
- `lc_gs_create_presentation_from_template` · **Create Presentation From Template** — Creates a new Google Slides presentation from a specified template.

### Google Tasks (5)
- `lc_google_tasks_create_task_list` · **Create Task List** — Creates a new task list in Google Tasks.
- `lc_google_tasks_update_task` · **Update Task** — Updates an existing task in Google Tasks.
- `lc_google_tasks_create_task` · **Create Task** — Creates a new task in a specified task list in Google Tasks.
- `lc_google_tasks_find_task` · **Find Task** — Searches for an existing task by title in a task list.
- `lc_google_tasks_get_tasks_by_list` · **Get Tasks By List** — Retrieves all tasks from a specified task list.

### HubSpot (2)
- `lc_hubspot_find_contact` · **Find Contact** — Search for a contact in HubSpot by their name.
- `lc_hubspot_create_contact` · **Create Contact** — Create a new contact in HubSpot.

### Linear (13)
- `lc_linear_create_issue` · **Create issue** — Creates a new issue in Linear.
- `lc_linear_create_comment` · **Create comment** — Creates a new comment on an issue in Linear.
- `lc_linear_update_issue` · **Update issue** — Updates an existing issue in Linear.
- `lc_linear_find_issues` · **Find issues** — Searches for Linear issues matching filter criteria.
- `lc_linear_create_attachment` · **Create issue attachment** — Creates a new URL attachment on an issue in Linear.
- `lc_linear_remove_label` · **Remove label from issue** — Removes a label from an existing issue in Linear.
- `lc_linear_create_customer` · **Create customer** — Creates a new customer in Linear.
- `lc_linear_find_customer` · **Find customer** — Finds a customer in Linear.
- `lc_linear_add_label_to_issue` · **Add label to issue** — Adds a label to an existing issue in Linear.
- `lc_linear_create_customer_need` · **Create customer need** — Creates a new customer need in Linear.
- `lc_linear_create_project` · **Create project** — Creates a new project in Linear.
- `lc_linear_find_issue_by_id` · **Get issue** — Gets a Linear issue by selecting from a dropdown or providing an ID.
- `lc_linear_find_project_by_id` · **Find project** — Finds a project in Linear.

### Manus AI (6)
- `lc_manus_get_task` · **Get Task** — Retrieve details of a specific task using Manus AI's API.
- `lc_manus_create_task` · **Create Task** — Create a new task in Manus AI. </br> The task in Manus may take some time to complete. It’s best pra
- `lc_manus_update_task` · **Update Task** — Update a task in Manus AI with specified details
- `lc_manus_delete_task` · **Delete Task** — Deletes a task from Manus AI
- `lc_manus_fetch_task` · **Fetch Tasks** — Retrieve a list of tasks from Manus AI
- `lc_manus_continue_task` · **Continue Task With Prompt** — Use Manus AI to continue a task by providing a prompt.</br> The task in Manus may take some time to 

### Mistral AI (3)
- `lc_mistral_ai_create_chat_completion` · **Create Chat Completion** — Generate a chat completion using Mistral AI models (Mistral Large, Medium, Small, Ministral, Magistr
- `lc_mistral_ai_create_embeddings` · **Create Embeddings** — Generate vector embeddings for text using Mistral AI embedding models. Useful for semantic search, c
- `lc_mistral_ai_analyze_image_vision` · **Analyze Image (Vision)** — Analyze an image with a vision-capable Mistral model (Pixtral, Mistral Large/Medium/Small) via Chat 

### Monday.com (14)
- `lc_monday_create_item` · **Create New Item** — Create a new item in a specified board on Monday.com
- `lc_monday_delete_item` · **Delete Item** — Delete an item from a board in Monday.com
- `lc_monday_update_item` · **Update Item** — Update an item in Monday.com with specified fields
- `lc_monday_create_board` · **Create New Board** — Create a new board in Monday.com
- `lc_monday_create_column` · **Create New Column For Board** — Create a new column in a specified board on Monday.com
- `lc_monday_create_group` · **Create New Group For Board** — Create a new group in a specified board on Monday.com
- `lc_monday_delete_group` · **Delete Group** — Delete a group from a board in Monday.com
- `lc_monday_archieve_board` · **Archive Board** — Archieve a board in Monday.com
- `lc_monday_archive_group` · **Archive Group** — Archieve a board in Monday.com
- `lc_monday_create_subitem` · **Create New SubItem** — Create a new subitem in a specified board on Monday.com
- `lc_monday_update_subitem` · **Update SubItem** — Update an Sub Item in Monday.com with specified fields
- `lc_monday_get_items` · **Get Board Items** — Retrieve items from a specific board in Monday.com
- `lc_monday_find_items_by_id` · **Find Item By ID** — Find item by item Id
- `lc_monday_find_by_column` · **Find Items By Column Value** — Find items by Column Value

### Notion (12)
- `notion_create_database_item` · **Create Database Item** — Create a new item in a Notion database
- `notion_retrieve_page` · **Retrieve Page** — Fetches detailed information about a specific Notion page using its page ID.
- `notion_add_content_to_page` · **Add Content To Page** — Add content blocks to a specified Notion page.
- `notion_create_page` · **Create Page** — Create a new page inside a Notion page
- `notion_restore_database_item` · **Restore Database Item** — Restores a previously deleted item in a Notion database.
- `notion_find_database_item` · **Find Database Item** — Search for an item in a Notion database using specific criteria.
- `notion_add_comment` · **Add Comment** — Add a comment to a specific Notion page using the Notion API.
- `find_notion_comment` · **Find Comment** — Retrieve a specific comment from a Notion page or database.
- `notion_get_page_comments` · **Get Page Comments** — Retrieve comments from a specific Notion page.
- `notion_get_page_and_children` · **Get Page And Children** — Retrieve a Notion page and its child blocks.
- `notion_update_database_item` · **Update Database Item** — Update an item in a Notion database with specified properties.
- `find-notion-page-by-title` · **Find Page By Title** — Fetches detailed information about a specific Notion page using its page title.

### OpenRouter (1)
- `lc_openrouter_generate_response` · **Generate Response** — Runs your prompt through the selected model and returns the generated reply.

### Staging Test (1)
- `test_compilation` · **test compilation**

### Survey Monkey (5)
- `survey_monkey_ia_create_contact` · **Create Contact** — Create a new contact in Survey Monkey
- `survey_monkey_ia_send_survey` · **Send Survey** — Send a survey to a list of recipients using SurveyMonkey.
- `survey_monkey_ia_search_contact` · **Search Contact** — Search for a contact in SurveyMonkey by specific fields and return results.
- `survey_monkey_ia_delete_survey` · **Delete Survey** — Deletes a specified survey from Survey Monkey.
- `survey_monkey_ia_inputs` · **Find Collector** — Retrieve and process survey inputs using Survey Monkey's API with dropdown collectors.

### Todoist (12)
- `lc_todoist_create_task` · **Create task** — Creates a new task in Todoist with optional project, section, labels, priority, and due date.
- `lc_todoist_update_task` · **Update task** — Updates an existing task in Todoist. Modify title, priority, due date, labels, or assignee.
- `lc_todoist_complete_task` · **Mark task as completed** — Marks an existing Todoist task as completed/closed.
- `lc_todoist_add_comment_to_task` · **Add comment to task** — Adds a comment to a specific Todoist task. Available for Todoist Pro and Business plan users.
- `lc_todoist_add_comment_to_project` · **Add comment to project** — Adds a comment to a specific Todoist project. Available for Todoist Pro and Business plan users.
- `lc_todoist_create_project` · **Create project** — Creates a new project in Todoist with optional color, parent project, and view style.
- `lc_todoist_move_task_to_section` · **Move task to section** — Moves an existing task to a different section within a project.
- `lc_todoist_find_task` · **Find Task** — Searches for a task by name within an optional project. Returns the first matching task.
- `lc_todoist_find_project` · **Find Project** — Searches for a Todoist project by name. Returns the first matching project.
- `lc_todoist_find_user` · **Find User** — Finds a Todoist user by email by searching collaborators across all projects.
- `lc_todoist_get_project_collaborators` · **Get project collaborators** — Retrieves the list of collaborators for a specific Todoist project.
- `lc_todoist_invite_user_to_project` · **Invite user to project** — Invites a user to collaborate on a Todoist project by email.

### Typeform (4)
- `typeform_create_form` · **Create Empty Form** — Create a new form in Typeform with specified fields and settings.
- `typeform_duplicate_existing_form` · **Duplicate Existing Form** — Create a duplicate of an existing form in Typeform.
- `typeform_search_responses` · **Search Responses in a form** — Search and retrieve responses from a specific Typeform form.
- `lc_tf_create_form` · **Create Empty Form** — Create a new form in Typeform with specified fields and settings.

### Vapi.ai (8)
- `lc_vapi_delete_chat` · **Delete Chat Data** — Delete a chat data.
- `lc_vapi_delete_call_data` · **Delete Call Data** — Delete a call data.
- `lc_vapi_create_chat` · **Create Chat** — Create a new chat with Vapi.
- `lc_vapi_create_call` · **Create Call** — Creates an outbound phone call using a Vapi voice assistant.
- `lc_vapi_delete_file` · **Delete File** — Delete a file.
- `lc_vapi_update_call` · **Update Call Name** — Update an existing call name.
- `lc_vapi_find_call` · **Find Call** — Finds a call.
- `lc_vapi_upload_file` · **Upload File** — Upload a file to Vapi.

### Voice AI (1)
- `voice_ai_outbound_call` · **Voice AI Outbound Call** — Place an outbound call from your AI Agent

### affiliate (6)
- `am-add-lead` · **Add Leads under an Affiliate** — Adds leads under the selected affiliate campaign and affiliate
- `am-add-manual-commission` · **Add manual sales for an Affiliate** — Adds manual sales for the selected affiliate campaign and affiliate. The commissions will be calcula
- `add_to_affiliate_manager` · **add_to_affiliate_manager** _(bundle)_
- `update_affiliate` · **update_affiliate** _(bundle)_
- `add_to_affiliate_campaign` · **add_to_affiliate_campaign** _(bundle)_
- `remove_from_affiliate_campaign` · **remove_from_affiliate_campaign** _(bundle)_

### appointments (3)
- `calendars_create_appointment_note` · **Create Appointment / Booking Note** — Create note for a calendar appointment, service booking or rental booking
- `calendars_generate_one_time_booking_link` · **Generate One Time Booking Link** — Generate one time booking link for a calendar
- `update_appointment_status` · **update_appointment_status** _(bundle)_

### certificates (1)
- `issue_certificates_workflow` · **Issue certificate** — Choose a certificate to send. The selected certificate template will be sent out as email. (* Some c

### communication (28)
- `whatsapp_24h_window` · **WhatsApp: Customer Service Window Check** — When a WhatsApp user sends you a message, a 24-hour Customer Service Window is open, during which yo
- `send_whatsapp_flow` · **WhatsApp: Send Flows** — Send WhatsApp Flows to your customers, allowing them to seamlessly book appointments directly on you
- `live_chat_response` · **Send Live Chat Message** — Automatically send response message to the live chat
- `appointment_booking_conversation_ai` · **Appointment Booking Conversation AI Bot** — Book an appointment with conversation AI bot, click <a target="_blank" href="https://help.leadconnec
- `update_conversation_ai_status` · **Update Conversation AI Bot and Status** — Updates the Conversation AI bot and status for the contact
- `appointment_booking` · **Book Appointment** — Automatically schedules appointments using standard or dynamic time slots, with the flexibility to o
- `log-external-call` · **Log External Call** — Add an external call to the conversation. If you are using Inbound Webhook Trigger to pass the call 
- `whatsapp_v2` · **WhatsApp** — Sends a whatsapp message to the contact
- `send_whatsapp_message` · **WhatsApp** — Sends a whatsapp message to the contact
- `whatsapp_media` · **WhatsApp Media** — Upload your attachment for the WhatsApp message. Ensure the file meets WhatsApp's supported formats 
- `whatsapp_interactive_messages` · **WhatsApp Interactive Messages** — Send Interactive Messages on WhatsApp from Workflows
- `tiktok-dm` · **TikTok Interactive Messenger** — Sends a TikTok message to the contact (contact needs to have previously messaged a connected TikTok 
- `email` · **send_email** _(bundle)_
- `sms` · **send_sms** _(bundle)_
- `slack_message` · **slack** _(bundle)_
- `call` · **call** _(bundle)_
- `voicemail` · **voicemail** _(bundle)_
- `messenger` · **messenger** _(bundle)_
- `instagram-dm` · **instagram_dm** _(bundle)_
- `manual-sms` · **manual_sms** _(bundle)_
- `manual-call` · **manual_call** _(bundle)_
- `gmb` · **gmb_messaging** _(bundle)_
- `internal_notification` · **send_internal_notification** _(bundle)_
- `review_request` · **send_review_request** _(bundle)_
- `conversation_ai` · **conversation_ai** _(bundle)_
- `fb_interactive_messenger` · **fb_interactive_messenger** _(bundle)_
- `ig_interactive_messenger` · **ig_interactive_messenger** _(bundle)_
- `respond_on_comment` · **reply_in_comments** _(bundle)_

### contact (21)
- `edit_conversation` · **Edit Conversation** — workflow.asideSection.description.editConversation
- `task-notification` · **Add Task** — workflow.asideSection.description.addTask
- `internal-delete-contact` · **Delete Contact** — This action permanently deletes the contact from this account and all workflows.
- `contact_engagement_score` · **Modify Contact Engagement Score** — Use this action to modify a contact's engagement score based on triggers
- `internal-add-contact-followers` · **Add Contact Followers** — Adds the specified users as followers to the contact.
- `internal-remove-contact-followers` · **Remove Contact Followers** — Removes all or the specified users as followers from the contact.
- `assign_to_user_tool` · **Assign To User** — Assign a user to contact
- `add_contact_tag_tool` · **Add Contact Tag** — Used for adding tags to the existing contact
- `remove_contact_tag_tool` · **Remove Contact Tags** — Used for removing tags to the existing contact
- `lc_merge_contact` · **Merge Contact** — Identifies duplicate contacts and merges the newer contact record into the oldest existing record. O
- `contact_email_verification` · **Email Verification** — Verify the email before sending
- `create_update_contact` · **Create Update Contact** _(bundle)_
- `find_contact` · **Find Contact** _(bundle)_
- `update_contact_field` · **update_contact_field** _(bundle)_
- `add_contact_tag` · **add_contact_tag** _(bundle)_
- `remove_contact_tag` · **remove_contact_tag** _(bundle)_
- `assign_user` · **assign_to_user** _(bundle)_
- `remove_assigned_user` · **remove_assigned_user** _(bundle)_
- `dnd_contact` · **set_contact_dnd** _(bundle)_
- `add_notes` · **add_to_notes** _(bundle)_
- `copy_contact_to_subaccount` · **Copy Contact To Subaccount** _(bundle)_

### customObjects (1)
- `find_associated_record` · **Find Associated Record** — Find an associated record using selected fields and filters.

### custom_objects (3)
- `create_custom_object` · **create_object** _(bundle)_
- `update_custom_object` · **update_object** _(bundle)_
- `clear_custom_object_fields` · **clear_object_fields** _(bundle)_

### eliza (2)
- `add_appointment_booking_ai_bot` · **ai_appointment_booking_bot** _(bundle)_
- `send_to_eliza` · **send_to_eliza_agent_platform** _(bundle)_

### external_ai_models (1)
- `chatgpt` · **gpt_by_open_ai** _(bundle)_

### internal (16)
- `if_else` · **if_else** _(bundle)_
- `wait` · **wait** _(bundle)_
- `workflow_goal` · **Workflow Goal** _(bundle)_
- `workflow_split` · **Workflow Split** _(bundle)_
- `update_custom_value` · **update_custom_value** _(bundle)_
- `goto` · **Goto** _(bundle)_
- `datetime_formatter` · **Datetime Formatter** _(bundle)_
- `number_formatter` · **number_formatter** _(bundle)_
- `math_operation` · **math_operation** _(bundle)_
- `event_start_date` · **set_event_start_date** _(bundle)_
- `add_to_workflow` · **add_to_workflow** _(bundle)_
- `remove_from_workflow` · **remove_from_workflow** _(bundle)_
- `array_functions` · **array_functions** _(bundle)_
- `drip` · **drip** _(bundle)_
- `text_formatter` · **text_formatter** _(bundle)_
- `custom_code` · **custom_code** _(bundle)_

### ivr (5)
- `ivr_gather` · **gather_input_on_call** _(bundle)_
- `ivr_say` · **say_or_play_message** _(bundle)_
- `ivr_connect_call` · **connect_to_call** _(bundle)_
- `ivr_hangup` · **end_call** _(bundle)_
- `ivr_collect_voicemail` · **record_voicemail** _(bundle)_

### marketing (6)
- `generate_marketing_audit_report` · **Generate Marketing Audit Report** — Audit reports generated by this action will appear in your Prospecting Dashboard (Marketing → Prospe
- `google_analytics` · **add_to_google_analytics** _(bundle)_
- `google_adword` · **add_to_google_ads** _(bundle)_
- `facebook_add_to_custom_audience` · **facebook_add_to_custom_audience** _(bundle)_
- `facebook_remove_from_custom_audience` · **facebook_remove_from_custom_audience** _(bundle)_
- `facebook_conversion_api` · **facebook_conversion_api** _(bundle)_

### membership (2)
- `membership_grant_offer` · **course_grant_offer** _(bundle)_
- `membership_revoke_offer` · **course_revoke_offer** _(bundle)_

### opportunity (9)
- `internal-add-opportunity-owner` · **Add Owner to Opportunity** — Assign a new owner to the opportunity. If contact and opportunity owners are synced, both will be up
- `internal-remove-opportunity-owner` · **Remove Owner from Opportunity** — Removes any assigned users leaving the opportunity unassigned.
- `internal-add-opportunities-followers` · **Add Follower(s) to Opportunity** — Adds the specified users as followers to the Opportunities.
- `internal-remove-opportunities-followers` · **Remove Follower(s) from Opportunity** — Removes all or the specified users as followers from the Opportunities.
- `find_opportunity` · **Find Opportunity** — Find an opportunity with matching values
- `internal_create_opportunity` · **Create Opportunity** — Creates a new opportunity using the fields below. If duplicate opportunities are disabled and an opp
- `internal_update_opportunity` · **Update opportunity** — If a 'Find Opportunity' action is present, it updates the matching record. Otherwise, it updates the
- `create_opportunity` · **create_update_opportunity** _(bundle)_
- `remove_opportunity` · **remove_opportunity** _(bundle)_

### payment (4)
- `payments_create_invoice` · **Send Invoice**
- `payments_create_estimate` · **Send Estimate** — Automatically send estimate using estimate templates
- `proposals_estimates_send_document` · **Send Documents & Contracts** — Automatically send documents & contracts templates
- `create_recurring_invoice` · **Send Recurring Invoice**

### payments (1)
- `stripe_one_time_charge` · **stripe_one_time_charge** _(bundle)_

### send_data (3)
- `webhook` · **webhook** _(bundle)_
- `custom_webhook` · **custom_webhook** _(bundle)_
- `google_sheets` · **google_sheets** _(bundle)_

### workflow_ai (1)
- `ai_agent` · **ai_agent** _(bundle)_

## Triggers by app

### Airtable (2)
- `airtable_new_record_created` · **New Record Created** — Triggers when a new record is created in Airtable.
- `airtable_record_updated` · **Record Updated** — Triggered when a record in Airtable is updated.

### Apify (2)
- `apify_actor_run_finished` · **Finished actor run** — Triggers when an Apify Actor run finishes (succeeds or fails).
- `apify_task_run_finished` · **Finished task run** — Triggers when an Apify Task run finishes (succeeds or fails).

### Asana (9)
- `asana_it_asana_task_created` · **New Task** — Trigger when a new task is created in Asana.
- `asana_it_asana_task_deleted` · **Task Deleted** — Triggers when a task is deleted in Asana.
- `asana_it_asana_task_updated` · **Task Updated** — Triggers when a task in Asana is updated.
- `asana_it_asana_project_created` · **New Project** — Trigger when a new project is created in Asana.
- `asana_it_asana_comment_on_task` · **New Comment Added To Task** — Triggers instantly when a new comment is added to a task in Asana.
- `asana_it_asana_tag_added_to_task` · **Tag Added To Task** — Triggers when a tag is added to a task in Asana.
- `asana_it_asana_task_moved_to_section` · **Task Moved** — Triggered when a task is moved to a different section in Asana.
- `asana_it_asana_attachment_added_to_task` · **New Attachment Added to Task** — Triggered when a new attachment is added for a task.
- `asana_it_asana_new_subtask` · **New Subtask** — Trigger when a new task is created in Asana.

### BaseCamp (7)
- `basecamp_new_todo_created` · **New To-do** — Triggers when a new to-do is created in a Basecamp project.
- `basecamp_new_comment_added` · **New Comment Added** — Triggers when a new comment is added to a Basecamp project.
- `basecamp_new_document` · **New Document** — Triggers when a new document is created in BaseCamp.
- `basecamp_project_created` · **New Project** — Triggers when a new project is created in Basecamp.
- `basecamp_new_message_posted` · **New Message Posted** — Trigger when a new message is posted in a Basecamp project.
- `basecamp_new_activity` · **New Activity** — Triggers when there is new activity in BaseCamp.
- `basecamp_new_todo_list` · **New To-do List** — Triggers when a new to-do list is created in BaseCamp.

### Cal.com (6)
- `lc_cal_com_booking_created` · **Booking created** — Triggers when a new booking is created in Cal.com.
- `lc_cal_com_booking_cancelled` · **Booking cancelled** — Triggers when a booking is cancelled in Cal.com.
- `lc_cal_com_booking_rescheduled` · **Booking rescheduled** — Triggers when a booking is rescheduled in Cal.com.
- `lc_cal_com_meeting_ended` · **Meeting ended** — Triggers when a Cal.com meeting ends.
- `lc_cal_com_ooo_created` · **Out of office created / updated** — Triggers when an out-of-office entry is created or updated in Cal.com.
- `lc_cal_com_recording_ready` · **New Recording** — Triggers when a recording is ready in Cal.com.

### ClickUp (7)
- `clickup_task_updated` · **Task Changes** — Trigger when a task is updated in ClickUp.
- `clickup_new_time_entry` · **New Time Entry** — Triggers when a new time entry is logged in ClickUp.
- `clickup_new_task` · **New Task** — Triggers when a new task is created in a specified ClickUp list.
- `clickup_new_list` · **New List** — Triggers when a new list is created in ClickUp.
- `clickup_new_folder` · **New Folder** — Triggers when a new folder is created in ClickUp.
- `clickup_comment_created` · **New Comment on a Task** — Triggers when a new comment is created in ClickUp.
- `lc_cu_task_changes_internal` · **Task Changes [Internal]** — Trigger when a task is updated in ClickUp.

### Ecommerce Stores (3)
- `ecommerce_order_fulfilled_trigger` · **Order Fulfilled** — Triggers when an order is fulfilled
- `leadgen_ecommerce_review_submitted` · **Product Review Submitted** — Triggers when a Product Review is submitted for E-commerce Stores
- `abandoned_checkout` · **Abandoned Checkout** — Triggers when a cart is abandoned

### Fathom (1)
- `lc_fathom_new_recording` · **New recording** — Triggered when a new recording is created in Fathom.

### Google Ads (1)
- `google_lead_form_submitted` · **Google Lead Form Submitted**

### Google Contacts (2)
- `google_contacts_contact_created` · **New Contact** — Trigger when a new contact is created in Google Contacts.
- `google_contacts_new_group` · **New Group** — Triggered when a new contact group is created in Google Contacts.

### Google Forms (1)
- `lc_gforms_new_updated_response` · **New or Updated Response** — Triggers when a new response is received in a Google Form.

### HubSpot (1)
- `lc_hubspot_contact_created` · **New Contact Created** — Triggers when a new contact is created in HubSpot. Polls every 60 seconds.

### Linear (12)
- `lc_linear_new_issue` · **New Issue** — Triggers when a new issue is created in Linear.
- `lc_linear_updated_issue` · **Updated Issue** — Triggers when an issue is updated in Linear.
- `lc_linear_new_issue_comment` · **New Issue Comment** — Triggers when a new issue comment is created in Linear.
- `lc_linear_new_project` · **New Project** — Triggers when a new project is created in Linear.
- `lc_linear_new_project_update` · **New Project Update** — Triggers when a new project update is created in Linear.
- `lc_linear_updated_project_update` · **Updated Project Update** — Triggers when a project update is updated in Linear.
- `lc_linear_new_customer` · **New Customer** — Triggers when a new customer is created in Linear.
- `lc_linear_new_customer_need` · **New Customer Need** — Triggers when a new customer request is created in Linear.
- `lc_linear_updated_customer_need` · **Updated Customer Need** — Triggers when a customer request is updated in Linear.
- `lc_linear_new_document_comment` · **New Document Comment** — Triggers when a new document comment is created in Linear.
- `lc_linear_new_initiative_update` · **New Initiative Update** — Triggers when a new initiative update is created in Linear.
- `lc_linear_updated_customer` · **Updated Customer** — Triggers when a customer is updated in Linear.

### Manus AI (2)
- `lc_manus_new_task_created` · **New Task Created** — Triggers when a new task is created in Manus AI.
- `lc_manus_task_stopped` · **Task Stopped** — Trigger when a task is stopped in Manus AI.

### Monday.com (7)
- `lc_monday_board_created` · **New Board** — This will trigger when a new board is created.
- `lc_monday_new_item_created` · **New Item In A Board** — Triggers when a new item is created in a board in Monday.com
- `lc_monday_user_added_to_board` · **New User** — Triggers when a user is added in Monday.com.
- `lc_monday_new_update_in_board` · **New Update in Board** — Triggers when a new update is posted on a board in Monday.com
- `lc_monday_any_column_value_changed` · **Any Column Value Changed In Board** — Triggers when any column value is changed in board.
- `lc_monday_item_moved_to_any_group` · **Item Moved to Any Group** — Triggers when a item is moved to any group in the board.
- `lc_monday_new_subitem_created` · **New SubItem In Board** — Triggers when a new subitem is created in a board in Monday.com

### Notion (4)
- `notion_new_database_item` · **New Database Item** — Triggers when a new item is added to a specified Notion database.
- `notion_updated_database_item` · **Updated Database Item** — Triggers when a database item is updated in Notion.
- `notion_page_updated` · **Page Updated** — Trigger when a page is updated in Notion.
- `notion_comment_added` · **Comment Added** — Triggered when a new comment is added to a Notion page.

### Survey Monkey (1)
- `survey_monkey_it_response_completed` · **Survey Monkey Response Completed** — Trigger when a response is completed on a SurveyMonkey survey.

### Todoist (3)
- `lc_todoist_new_task` · **New Incomplete Task** — Triggers when a new incomplete task is added to a project.
- `lc_todoist_task_completed` · **New Completed Task** — Triggers when a task is completed in Todoist.
- `lc_todoist_new_project` · **New Project** — Triggers when a new project is created in Todoist.

### Typeform (1)
- `typeform_new_entry` · **New Entry** — Triggers when a new entry is submitted in Typeform.

### affiliate (3)
- `affiliate_sales` · **New Affiliate Sales** — Runs when a new sales transaction is recorded for an affiliate.
- `affiliate_campaign_enroll` · **Affiliate enrolled in campaign** — Runs when a Affiliate will be added in the campaign.
- `affiliate_new_lead` · **Lead Created** — Runs when a new affiliate lead is created

### affiliates (1)
- `affiliate_created` · **Affiliate Created** _(bundle)_

### appointments (4)
- `service_booking` · **Service Booking** — Triggers the workflow when a Service Booking is created or updated.
- `rental_booking` · **Rental Booking** — Triggers the workflow when a Rental Booking is created or updated.
- `appointment` · **Appointment Status** _(bundle)_
- `customer_appointment` · **Customer Booked Appointment** _(bundle)_

### certificates (1)
- `certificates_issued_workflow` · **Certificates Issued** — Runs when a certificate is issued.

### communication (3)
- `tiktok_comment_on_post` · **TikTok - Comment(s) on a Video** — by default applicable to all videos, if nothing is selected
- `transcript_generated` · **Transcript Generated** — Triggers when a transcript generated
- `ig_follower_added` · **Instagram New Follower** — To auto DM new followers, add the Instagram DM or Interactive Messenger Action to this workflow trig

### communities (5)
- `group_access_granted` · **Group Access Granted** — Community Group Access Granted trigger
- `group_access_revoked` · **Group Access Revoked** — Triggers when a contact's access is revoked from community group's private channel
- `private_channel_access_granted` · **Private Channel Access Granted** — Triggers when a contact is granted access to community group's private channel
- `private_channel_access_revoked` · **Private Channel Access Revoked** — Community Private Channel Access Revoked trigger
- `user_group_gamification_level_changed` · **Community Group Member Leaderboard Level Changed** — This trigger enables you to create automated actions when a community group member's gamification le

### contact (12)
- `task_completed` · **Task Completed** — Task completed trigger.
- `contact_engagement_score` · **Contact Engagement Score** — Use this trigger to initiate workflow when a contact's engagement score meets a specific condition
- `birthday_reminder` · **Birthday Reminder** _(bundle)_
- `contact_changed` · **Contact Changed** _(bundle)_
- `contact_created` · **Contact Created** _(bundle)_
- `dnd_contact` · **Contact Dnd** _(bundle)_
- `contact_tag` · **Contact Tag** _(bundle)_
- `custom_date_reminder` · **Custom Date Reminder** _(bundle)_
- `note_add` · **Note Added** _(bundle)_
- `note_changed` · **Note Changed** _(bundle)_
- `task_added` · **Task Added** _(bundle)_
- `task_due_date_reminder` · **Task Reminder** _(bundle)_

### courses (12)
- `category_started` · **Category Started** _(bundle)_
- `category_completed` · **Category Completed** _(bundle)_
- `lesson_started` · **Lesson Started** _(bundle)_
- `lesson_completed` · **Lesson Completed** _(bundle)_
- `membership_contact_created` · **Membership New Signup** _(bundle)_
- `offer_access_granted` · **Offer Access Granted** _(bundle)_
- `offer_access_removed` · **Offer Access Removed** _(bundle)_
- `product_access_granted` · **Product Access Granted** _(bundle)_
- `product_access_removed` · **Product Access Removed** _(bundle)_
- `product_started` · **Product Started** _(bundle)_
- `product_completed` · **Product Completed** _(bundle)_
- `user_log_in` · **User Login** _(bundle)_

### events (23)
- `messaging_errors` · **Messaging Error - SMS** — Triggered based on the error received for an undelivered message. This can be used for taking releva
- `linkedin_form_submitted` · **LinkedIn Lead Form Submitted** — LinkedIn Lead Form Submitted Trigger.
- `funnel_website_pageview` · **Funnel/Website PageView** — Runs when a contact has viewed a page
- `quiz_submitted` · **Quiz Submitted** — Runs when a quiz is submitted.
- `reputation_review_received` · **New Review Received** — This trigger allows you to create automated actions when new reviews come in from Facebook or Google
- `new_prospect_received_workflow` · **Prospect Generated** — This trigger allows you to create automated actions when new prospects are received. You can filter 
- `whatsapp_referral` · **Click to WhatsApp Ads** — Triggers when an inbound WhatsApp message is received via a referral message.
- `external_tracking` · **External Tracking Event** — Runs when external tracking form is viewed/submitted
- `inbound_webhook` · **Inbound Webhook** _(bundle)_
- `scheduler_trigger` · **Scheduler** _(bundle)_
- `call_status` · **Call Details** _(bundle)_
- `mailgun_email_event` · **Email Events** _(bundle)_
- `customer_reply` · **Customer Replied** _(bundle)_
- `inbound_trigger` · **Inbound Trigger** _(bundle)_
- `conv_ai_trigger` · **Conv Ai Trigger** _(bundle)_
- `conv_ai_autonomous_trigger` · **Conv Ai Autonomous Trigger** _(bundle)_
- `form_submission` · **Form Submitted** _(bundle)_
- `survey_submission` · **Survey Submitted** _(bundle)_
- `trigger_link` · **Trigger Link Clicked** _(bundle)_
- `facebook_lead_gen` · **Facebook Lead Form Submitted** _(bundle)_
- `tik_tok_form_submitted` · **Tiktok Form Submitted** _(bundle)_
- `video_event` · **Video Tracking** _(bundle)_
- `validation_error` · **Number Validation** _(bundle)_

### fb_ig_events (2)
- `facebook_comment_on_post` · **Facebook Comment On Post** _(bundle)_
- `ig_comment_on_post` · **Instagram Comment On Post** _(bundle)_

### ivr (1)
- `ivr_incoming_call` · **Start Ivr Trigger** _(bundle)_

### opportunities (5)
- `opportunity_status_changed` · **Opportunity Status Changed** _(bundle)_
- `opportunity_created` · **Opportunity Created** _(bundle)_
- `opportunity_changed` · **Opportunity Changed** _(bundle)_
- `pipeline_stage_updated` · **Pipeline Stage Changed** _(bundle)_
- `opportunity_decay` · **Stale Opportunities** _(bundle)_

### payments (12)
- `proposal_estimate_update` · **Documents & Contracts** — Documents & Contracts Trigger
- `estimate_update` · **Estimates** — Estimates Trigger
- `subscription` · **Subscription** — Runs when a new subscription is created or subscription status changes
- `refund` · **Refund** — Runs when a refund is initiated for a transaction
- `coupon_code_applied` · **Coupon Code Applied** — Fires when a coupon code is applied to an order during checkout, regardless of checkout completion.
- `coupon_redemption_limit_reached` · **Coupon Redemption Limit Reached** — Fires when a coupon code reaches its maximum allowed number of redemptions. Should be triggered afte
- `coupon_code_expired` · **Coupon Code Expired** — Fires when a coupon code reaches its scheduled expiration date and becomes inactive.
- `coupon_code_redeemed` · **Coupon Code Redeemed** — Fires when a coupon code is successfully redeemed in a completed transaction.
- `invoice` · **Invoice** _(bundle)_
- `payment_received` · **Payment Received** _(bundle)_
- `two_step_form_submission` · **Order Form Submission** _(bundle)_
- `order_submission` · **Order Submitted** _(bundle)_

### shopify (3)
- `shopify_abandoned_cart` · **Abandoned Checkout** _(bundle)_
- `shopify_order_placed` · **Order Placed** _(bundle)_
- `shopify_order_fulfilled` · **Order Fulfilled** _(bundle)_
