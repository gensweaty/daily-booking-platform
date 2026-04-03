
Goal: make each personal AI bot remember its own context safely for admins and sub-users, so when a reminder/task/event/customer/statistics topic comes back later, the bot can answer with the original context and quote the source without leaking anything across users.

What is going wrong now
- The current AI request only sends the last 20 chat messages, and it only sends `sender_type + content`.
- In `MessageInput.tsx`, old messages are mapped almost entirely as `user` messages. Since AI replies are stored as normal chat messages (`sender_type: 'admin'`, `sender_name: 'Smartbookly AI'`), past bot replies are not reliably reconstructed as `assistant` messages.
- Reminder delivery in `process-reminders` inserts a plain `reminder_alert` chat message with recipient metadata, but not a strong link to the original scheduling context.
- Result: when the reminder fires and you ask “where is it / what is this / when did I ask this?”, the model often has too little structured history and no saved reminder-origin context to look up.

Safest design
1. Fix conversation reconstruction first
- Rebuild `conversationHistory` from chat messages using a real role resolver:
  - `Smartbookly AI` messages => `assistant`
  - human/admin/sub-user messages => `user`
- Include more useful message context:
  - message id
  - attachments summary
  - metadata needed for reminder/task/event/customer references
- Increase history strategy safely:
  - recent raw messages
  - plus compact stored memory summaries
  - not unlimited full history

2. Add a separate AI memory store
- Create a new table for private AI memory snapshots, separate from reminders/tasks/events/customers.
- Each memory record should be identity-scoped:
  - owner_id
  - audience_type: `admin | sub_user`
  - audience_sub_user_id nullable
  - channel_id
  - source_kind: `reminder | task | event | customer | statistics | general`
  - source_record_id nullable
  - source_message_ids
  - source_quote
  - summary
  - structured_context JSONB
  - created_at / updated_at
- This keeps memory isolated and avoids stuffing fragile context into plain chat text.

3. Save memory at the moment of action
- When AI creates or updates a reminder/task/event/customer/statistics output, store a memory snapshot at that same time.
- For reminders, save:
  - original user request
  - nearby chat context
  - linked event/task/customer ids if present
  - safe AI summary of what the reminder is about
  - exact source quote for later explanation
- Do the same pattern for AI-created/AI-updated tasks, events, customers, and important statistical discussions.

4. Link reminders to their memory
- Add a direct `context_memory_id` reference on `custom_reminders`.
- When a reminder is delivered in `process-reminders`, include in `chat_messages.metadata`:
  - reminder_id
  - context_memory_id
  - recipient targeting metadata
- This gives the later AI reply an exact context anchor instead of guessing from old messages.

5. Teach the AI edge function to load memory before answering
- In `supabase/functions/ai-chat/index.ts`, before calling the model:
  - detect whether the new prompt refers to a recent reminder/task/event/customer/statistics discussion
  - load matching identity-scoped memory snapshots with service-role logic
  - load linked records when needed
  - inject a compact “saved context” block into the backend prompt
- Important behavior:
  - answer directly when memory is strong
  - quote the saved source when relevant
  - ask a short clarification only if memory is weak or ambiguous

6. Keep strict isolation
- Memory must be per bot identity, not just per board owner.
- Admin memory and sub-user memory must never mix.
- For public-board sub-users, identity resolution should continue using the existing secure sub-user identity pattern/RPC path.
- Memory reads/writes should happen only in edge functions with explicit identity checks, not from the client.

Implementation steps
1. Audit and fix role reconstruction in `src/components/chat/MessageInput.tsx`.
2. Add new migration for AI memory table and `custom_reminders.context_memory_id`.
3. Update `ai-chat` edge function to:
- create memory snapshots when actions happen
- load relevant memories for follow-up questions
- inject quoted source + structured summary into backend prompt
4. Update reminder fast-path in `ai-chat` so reminder creation stores memory immediately.
5. Update `process-reminders` so reminder alert messages carry `reminder_id + context_memory_id` metadata.
6. Optionally extend the same memory-write helper to task/event/customer/statistics action branches in `ai-chat`.
7. Test admin and sub-user flows end-to-end on internal board and public board.

Technical details
- Best storage pattern: new dedicated table, not only more chat text.
- Best security pattern: service-role access from edge functions only, with identity scoping in code.
- Best retrieval pattern:
  - recent message window
  - plus saved memories
  - plus entity lookup for linked task/event/customer
- Best quoting pattern:
  - store `source_quote`
  - store `summary`
  - store `source_message_ids`
  - never rely only on model memory
- Best low-risk rollout:
  - phase 1: reminders + conversation reconstruction
  - phase 2: tasks/events/customers/statistics
  - phase 3: better ranking/search across older memories

Risk controls so nothing else gets ruined
- Keep all new logic isolated to chat/reminder edge-function flow.
- Do not change existing notification routing rules.
- Do not expose memory table directly to public client reads.
- Preserve existing recipient metadata logic in `ChatProvider`.
- Use fallback behavior: if no memory exists, AI still works with current conversation history.

Validation plan
- Admin schedules a reminder with context, reminder fires, asks follow-up, AI answers with source quote.
- Sub-user schedules a reminder on public board, reminder fires, only that sub-user gets the memory-backed answer.
- Admin cannot accidentally retrieve sub-user memory.
- Old reminders without memory still behave normally.
- General chat, file uploads, and non-action conversations continue to work.

Recommended rollout
- Start with reminders first because that is the broken case you reported.
- Once that is stable, apply the same memory snapshot pattern to task/event/customer/statistics action flows so the bot becomes consistently context-aware across the platform.
