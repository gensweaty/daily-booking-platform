CREATE TABLE public.inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  channel text NOT NULL,
  sender text NOT NULL,
  recipient text,
  subject text,
  body text,
  html text,
  provider_id text,
  is_read boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.inbound_messages TO authenticated;
GRANT ALL ON public.inbound_messages TO service_role;
ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view own replies" ON public.inbound_messages FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners update own replies" ON public.inbound_messages FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete own replies" ON public.inbound_messages FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE INDEX inbound_messages_owner_idx ON public.inbound_messages(owner_id, received_at DESC);
CREATE UNIQUE INDEX inbound_messages_provider_uidx ON public.inbound_messages(channel, provider_id) WHERE provider_id IS NOT NULL;