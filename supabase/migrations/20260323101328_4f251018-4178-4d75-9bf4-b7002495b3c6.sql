-- Table 1: telegram_bot_configs - stores per-user bot tokens (service_role only)
CREATE TABLE public.telegram_bot_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_token text NOT NULL,
  bot_username text,
  telegram_chat_id bigint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.telegram_bot_configs ENABLE ROW LEVEL SECURITY;

-- Only service_role can access this table (bot tokens are sensitive)
CREATE POLICY "service_role_full_access" ON public.telegram_bot_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Table 2: telegram_bot_state - singleton for polling offset
CREATE TABLE public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.telegram_bot_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed the single row
INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

-- Table 3: telegram_messages - audit log for incoming messages
CREATE TABLE public.telegram_messages (
  update_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  text text,
  raw_update jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON public.telegram_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages (chat_id);
CREATE INDEX idx_telegram_messages_processed ON public.telegram_messages (processed) WHERE NOT processed;