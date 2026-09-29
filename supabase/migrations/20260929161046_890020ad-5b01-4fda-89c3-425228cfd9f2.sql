CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  resend_id text,
  recipient text NOT NULL,
  subject text,
  purpose text,
  status text NOT NULL DEFAULT 'sent',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view own email logs" ON public.email_logs FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owners delete own email logs" ON public.email_logs FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE INDEX email_logs_owner_created_idx ON public.email_logs (owner_id, created_at DESC);
CREATE INDEX email_logs_resend_idx ON public.email_logs (resend_id);