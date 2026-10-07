
-- ============ SMS provider configuration ============
CREATE TABLE public.sms_provider_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'smsgate_cloud',
  base_url text NOT NULL DEFAULT 'https://api.sms-gate.app/3rdparty/v1',
  username text,
  password text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  webhook_id text,
  webhook_secret text,
  is_connected boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  last_error text,
  sms_enabled boolean NOT NULL DEFAULT false,
  send_on_booking_confirmed boolean NOT NULL DEFAULT true,
  send_on_reminder boolean NOT NULL DEFAULT true,
  send_on_rescheduled boolean NOT NULL DEFAULT true,
  send_on_cancelled boolean NOT NULL DEFAULT true,
  routing_mode text NOT NULL DEFAULT 'auto',
  preferred_device_id text,
  preferred_sim_number int,
  default_country_code text NOT NULL DEFAULT '+995',
  message_ttl_seconds int NOT NULL DEFAULT 86400,
  quiet_hours_start text,
  quiet_hours_end text,
  rate_limit_per_minute int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_provider_configs TO authenticated;
GRANT ALL ON public.sms_provider_configs TO service_role;
ALTER TABLE public.sms_provider_configs ENABLE ROW LEVEL SECURITY;

-- Owners may read a safe view of their config through the edge function only;
-- direct client reads are limited to their own row (secrets are never selected by the UI).
CREATE POLICY "Owners manage their sms config"
  ON public.sms_provider_configs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ Discovered Android devices ============
CREATE TABLE public.sms_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  external_id text NOT NULL,
  name text,
  last_seen_at timestamptz,
  is_online boolean NOT NULL DEFAULT false,
  sim_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, external_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_devices TO authenticated;
GRANT ALL ON public.sms_devices TO service_role;
ALTER TABLE public.sms_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their sms devices"
  ON public.sms_devices FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ SMS outbox / history ============
CREATE TABLE public.sms_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  recipient text NOT NULL,
  body text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  purpose text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'queued',
  provider text NOT NULL DEFAULT 'smsgate_cloud',
  provider_message_id text,
  device_external_id text,
  sim_number int,
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz,
  expires_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  error text,
  event_id uuid,
  customer_id uuid,
  booking_request_id uuid,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sms_messages_dedupe_key_idx
  ON public.sms_messages (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX sms_messages_queue_idx
  ON public.sms_messages (status, next_attempt_at);
CREATE INDEX sms_messages_user_created_idx
  ON public.sms_messages (user_id, created_at DESC);
CREATE INDEX sms_messages_event_idx ON public.sms_messages (event_id);
CREATE INDEX sms_messages_provider_msg_idx ON public.sms_messages (provider_message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_messages TO authenticated;
GRANT ALL ON public.sms_messages TO service_role;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their sms messages"
  ON public.sms_messages FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============ Templates ============
CREATE TABLE public.sms_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  purpose text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, purpose, language)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their sms templates"
  ON public.sms_templates FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at triggers (function already exists in this project)
CREATE TRIGGER update_sms_provider_configs_updated_at
  BEFORE UPDATE ON public.sms_provider_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_devices_updated_at
  BEFORE UPDATE ON public.sms_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_messages_updated_at
  BEFORE UPDATE ON public.sms_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sms_templates_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
