CREATE TABLE public.agent_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_api_keys TO authenticated;
GRANT ALL ON public.agent_api_keys TO service_role;
ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own agent keys" ON public.agent_api_keys FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.agent_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key_id uuid REFERENCES public.agent_api_keys(id) ON DELETE SET NULL,
  agent_name text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_activity_log_user_idx ON public.agent_activity_log(user_id, created_at DESC);
GRANT SELECT ON public.agent_activity_log TO authenticated;
GRANT ALL ON public.agent_activity_log TO service_role;
ALTER TABLE public.agent_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own agent activity" ON public.agent_activity_log FOR SELECT TO authenticated USING (auth.uid() = user_id);