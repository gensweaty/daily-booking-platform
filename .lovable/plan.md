## Goal
Make Smartbookly AI reliably cancel reminders it created and understand reply context from Telegram and website chat, without changing unrelated AI behavior or platform functionality.

## Confirmed current problems
- Reminder cancellation currently depends on the LLM choosing `cancel_reminder`. In the shown case, it answered “I cannot cancel...” without tool execution, so the reminder still fired.
- Website/Telegram reply context is passed as quoted text, but not resolved to a concrete reminder row or exact prior chat message relationship.
- The `custom_reminders` table already has safe cancellation fields (`deleted_at`, `reminder_sent_at`, `email_sent`), so this can be fixed without risky schema changes.

## Plan
1. **Add a deterministic reminder-cancel fast path in `ai-chat`**
   - Before the LLM call, detect clear cancel/delete/deactivate reminder requests in English, Georgian, Spanish, and Russian.
   - Resolve the target safely:
     - If replying to a reminder confirmation/alert, extract the reminder title/time from that quoted content.
     - If saying “that reminder” right after a reminder confirmation, use the most recently created pending reminder in the same channel/user scope.
     - If a title is mentioned, match pending reminders by title.
     - If multiple matches exist, ask one clarification question instead of guessing.
   - Mark the reminder as cancelled using existing fields: `deleted_at`, `reminder_sent_at`, and `email_sent`, scoped by `ownerId` and sub-user identity when applicable.
   - Return and save a direct confirmation message only after the database update succeeds.

2. **Improve reply-context payload quality**
   - Website chat: include `reply_to_id`, sender, content, message type, created time, and attachments metadata when invoking `ai-chat`.
   - Telegram: include Telegram reply sender/content plus the recent Smartbookly chat history so backend can map replied bot text to the matching reminder.
   - Keep this additive, so normal messages without replies behave the same.

3. **Make reply references stronger inside `ai-chat`**
   - Build a small `replyContext` object server-side.
   - If the quote looks like a reminder confirmation or reminder alert, lookup the matching `custom_reminders` row using title/time/channel/user context.
   - Inject that resolved context into the prompt for non-cancel actions too, so “recreate this reminder”, “turn this into a task”, or “change this” targets the replied item instead of the latest unrelated item.

4. **Keep existing AI principles intact**
   - Do not change model routing, tools unrelated to reminders, task/event/customer creation, file analysis, Telegram file handling, or notification processors.
   - Keep the current anti-hallucination guard, but make cancellation no longer rely on it for clear cancel commands.

5. **Validation after implementation**
   - Test by creating a short reminder, then sending “cancel that reminder” before it fires; verify `deleted_at/reminder_sent_at/email_sent` update and no alert is sent.
   - Test a reply to an older reminder message and verify the older referenced reminder is targeted, not the latest reminder.
   - Test Georgian cancel phrases and an ambiguous case with two similar pending reminders to ensure it asks for clarification instead of cancelling the wrong one.
