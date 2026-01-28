
Goal
- Restore Smartbookly AI responses for:
  - Internal dashboard users (authenticated)
  - External/public board sub-users (unauthenticated)
- Do it in a way that does not disturb other parts of the app (tasks, calendar, CRM, notifications).

What I found (root cause hypothesis backed by evidence)
- The ai-chat edge function is currently working and generating responses:
  - Edge logs show “AI Chat request … Calling Lovable AI … AI response received”.
  - The database contains recent rows from sender_name = “Smartbookly AI”.
- So the failure is not “AI is down”; it’s “the UI is not reliably showing the newly inserted AI message”.
- Today the UI relies on either:
  1) Realtime subscription events, or
  2) Polling that later picks up the new DB row
- Those mechanisms can fail or be delayed (especially on public boards and when the insert is done by service role), causing users to see “no reply” even though the reply exists in the DB.

High-confidence fix strategy
- Make the AI response display deterministic:
  - When ai-chat finishes, return the inserted AI message (id, created_at, content, channel_id, owner_id, sender fields) in the HTTP response.
  - Immediately dispatch a client event to render that AI message locally (same pipeline used by realtime/poll: the “chat-message-received” event).
- Keep realtime/polling as a backup (not the primary way the AI response appears).

Implementation plan (isolated changes)
Phase 1 — Make AI replies appear immediately (core fix)
1) Update edge function: supabase/functions/ai-chat/index.ts
   - For every path that inserts an AI message into public.chat_messages, change the insert to:
     - Use .select(...).single() so we get the inserted row back.
     - Return that row in the function JSON response as aiMessage (along with success and content).
   - Ensure this is done in both cases:
     - Direct response (no tool calls)
     - Tool-call flow “finalResponse” branch
     - Any fast-path branches that insert AI text into chat_messages
   - Standardize returned shape:
     - { success: true, content: string, aiMessage: { id, channel_id, owner_id, sender_type, sender_name, content, created_at, has_attachments, message_type, ... }, toolCalls?: [] }
   - Add logging for insert failures and for the message id returned (for quick diagnosis without touching other systems).
   - Keep authentication behavior unchanged (do not rework verify_jwt again; it’s already configured to allow public boards).

2) Update client: src/components/chat/MessageInput.tsx (AI path only)
   - After supabase.functions.invoke('ai-chat') returns:
     - If data?.aiMessage exists:
       - Dispatch: window.dispatchEvent(new CustomEvent('chat-message-received', { detail: { message: data.aiMessage } }))
       - This leverages existing ChatProvider/ChatArea message pipelines and dedupe (by id).
     - If data?.success is true but aiMessage is missing:
       - Run a fallback fetch after a short delay (250–400ms) and dispatch the newest AI message:
         - Internal users: call get_chat_messages_for_channel RPC and pick last row where sender_name = “Smartbookly AI” and created_at >= callStartTime
         - Public boards: call list_channel_messages_public_v2 RPC and pick last row similarly
       - Dispatch the found row as chat-message-received.
   - Do not change how user messages are stored (current “persist immediately” behavior remains intact).
   - Do not modify ChatProvider logic; we only “feed it” the missing message event deterministically.

Why this won’t ruin other things
- Changes are confined to:
  - ai-chat edge function response payload + selecting inserted row
  - MessageInput’s AI invoke success handling
- No changes to tasks, reminders, CRM, calendar, auth, routing, or notification storage keys.
- Existing realtime/polling remains, but AI no longer depends on it to show the reply.

Phase 2 — Make external-board Dynamic Island deep-links reliable (separate but related UX fix)
Problem pattern
- Public board notification clicks can fire before the destination tab/component is mounted, so the “open task/event/chat” event can be missed.

Fix strategy
- Introduce a tiny “pending intent” queue so clicks never get lost:
  - Store one pending navigation intent in sessionStorage (or a window global) when the notification is clicked.
  - Switch tab first.
  - When the destination tab component mounts, it consumes the pending intent and opens the right dialog/item.

Concrete steps
1) src/components/dashboard/PublicDynamicIsland.tsx
   - Keep dispatching the existing events (open-chat-channel, open-ai-chat, open-task, open-event-edit, switch-public-tab).
   - Additionally (or instead), write a pending intent object to sessionStorage:
     - { tab: 'chat'|'tasks'|'calendar'|'crm', action: 'open-task'|'open-event'|'open-chat-channel'|'open-ai-chat', id?: string, createdAt: number }

2) src/components/PublicBoardNavigation.tsx
   - On notification click events:
     - Validate permission for the target tab
     - Switch tab
     - Leave pending intent in storage (do not clear here)

3) Destination components consume the intent on mount:
   - src/components/tasks/PublicTaskList.tsx: on mount, if pending intent is open-task and taskId exists, open it, then clear intent
   - src/components/calendar/PublicCalendarList.tsx: on mount, if pending intent is open-event-edit and eventId exists, open it, then clear intent
   - Chat is already bridged via open-chat-ai / chat-open-channel; we can optionally add the same “consume intent” logic in ChatProvider after initialization to guarantee it opens even if ChatProvider mounts late.

Verification checklist (must pass before considering fixed)
A) Internal dashboard (admin)
- Open dashboard, open AI channel, send “hi”.
- Expected:
  - AI response appears without refreshing.
  - No duplicate AI responses (dedupe by message id).
  - Refresh page: response is still in chat history.

B) External public board (sub-user)
- Enter a public board, open AI channel, send “hi”.
- Expected:
  - AI response appears without refresh.
  - No auth errors/toasts.
  - Refresh page: response persists.

C) Cross-user messaging + notifications
- Admin sends message to a sub-user.
- Expected:
  - Sub-user sees notification.
  - Clicking the Dynamic Island notification opens the correct place (chat/task/event) reliably.

D) Regression sweep (quick)
- Create/edit a task, create/edit an event, open CRM list, check reminders list.
- Expected: no new errors, no missing data.

If anything unexpected shows up
- Add targeted logs only around:
  - MessageInput AI invoke request/response (status, presence of aiMessage)
  - ChatProvider “chat-message-received” pipeline (message id/channel id)
- Avoid touching global configs (main.tsx, global CSS, app routing) to keep scope isolated.

Optional: fast debugging links
- Edge function logs for ai-chat:
  https://supabase.com/dashboard/project/mrueqpffzauvdxmuwhfa/functions/ai-chat/logs
