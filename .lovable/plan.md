

## Telegram Integration as Alternative Interface for Smartbookly AI

### Overview
Enable users to connect their own Telegram bot to Smartbookly AI, so they can send/receive messages via Telegram that are processed by the same AI engine powering the dashboard chat. The Telegram bot acts as a transparent bridge -- messages flow in from Telegram, get processed by the existing `ai-chat` edge function, and responses are sent back to Telegram.

### Architecture

```text
User's Telegram Bot
       ↕ (messages)
[telegram-poll] edge function  ←── pg_cron every 1 min
       ↓ incoming message
       ↓ lookup user by telegram_bot_token → find owner_id
       ↓ find/create AI channel for that user
       ↓ save user message to chat_messages
       ↓ call ai-chat edge function internally
       ↓ get AI response
       ↓ send response back to Telegram via gateway
       ↓ (AI response already saved to chat_messages by ai-chat)
```

### Database Changes

**1. New table: `telegram_bot_configs`**
Stores per-user Telegram bot configuration:
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, the dashboard owner)
- `bot_token_encrypted` (text, the bot token -- stored encrypted or as-is since service_role only)
- `bot_username` (text, e.g. "Smartbookly_bot")
- `telegram_chat_id` (bigint, the Telegram chat_id for the user who set it up)
- `is_active` (boolean, default true)
- `created_at`, `updated_at`
- RLS: service_role only (no client reads of bot tokens)

**2. New table: `telegram_bot_state`**
Singleton for polling offset tracking:
- `id` (int, PK, CHECK id=1)
- `update_offset` (bigint, default 0)
- `updated_at` (timestamptz)

**3. New table: `telegram_messages`**
Stores raw incoming Telegram updates for audit/debugging:
- `update_id` (bigint, PK)
- `chat_id` (bigint)
- `text` (text)
- `raw_update` (jsonb)
- `created_at` (timestamptz)

### Edge Function Changes

**4. New edge function: `telegram-setup`**
- Called by the AI chatbot when user provides a bot token
- Validates the token by calling Telegram `getMe` via the connector gateway
- Stores the token in `telegram_bot_configs`
- Returns success with bot username

**5. New edge function: `telegram-poll`**
- Runs via pg_cron every minute
- Queries all active `telegram_bot_configs`
- For each config, calls `getUpdates` with stored offset
- For each incoming message:
  - Finds or creates the user's AI channel
  - Inserts user message into `chat_messages`
  - Calls the `ai-chat` edge function with the message
  - Sends the AI response back to Telegram via `sendMessage`
  - Updates offset
- Uses the Telegram connector gateway for API calls

**6. Modify `ai-chat/index.ts`**
- Add a new AI tool: `setup_telegram_bot`
  - When user says "connect my Telegram bot" or provides a bot token
  - Calls `telegram-setup` edge function
  - Returns confirmation message
- This is a small addition to the existing tools array (similar to how reminder tools work)

### Frontend Changes

**7. No major UI changes needed**
- Users interact with Telegram setup through the existing AI chat
- The AI recognizes intent like "connect Telegram" or "set up Telegram bot" and guides the user
- Messages sent via Telegram appear in the dashboard AI chat in real-time (via existing realtime subscriptions on `chat_messages`)

### How It Works for Users

1. User opens Smartbookly AI chat and says "I want to connect Telegram"
2. AI explains: create a bot via @BotFather, copy the token, and send it here
3. User pastes the bot token
4. AI validates it, stores it, confirms: "Your bot @Smartbookly_bot is now connected!"
5. User opens Telegram, finds their bot, sends "/start" then any message
6. Message appears in dashboard AI chat, AI responds both in Telegram and dashboard

### Security Considerations
- Bot tokens stored in a table with RLS disabled for clients (service_role only access)
- Each user's Telegram messages are routed to their own AI channel with their own `owner_id`
- The existing `ai-chat` security checks (channel validation, owner matching) still apply
- Sub-users on external boards can also set up their own Telegram bots (routed via their board owner's AI channel with proper sender attribution)

### Implementation Order
1. Create migration with 3 new tables
2. Create `telegram-setup` edge function
3. Create `telegram-poll` edge function  
4. Add `setup_telegram_bot` tool to `ai-chat/index.ts`
5. Set up pg_cron job for polling
6. Link the Telegram connector to the project

### Technical Notes
- The Telegram connector gateway (`connector-gateway.lovable.dev/telegram`) handles bot API calls
- The `LOVABLE_API_KEY` and `TELEGRAM_API_KEY` env vars are needed in edge functions
- However, for per-user bot tokens (each user has their own bot), we need to call the Telegram API directly with the user's token rather than through the connector gateway (which uses a single shared bot token)
- This means the connector is useful for initial validation but per-user polling will use direct `api.telegram.org` calls with each user's stored bot token

