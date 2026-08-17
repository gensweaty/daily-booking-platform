CREATE TABLE public.render_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  page_hint text,
  popup_target text,
  screenshot_request_id uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 seconds'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.render_tokens TO service_role;

ALTER TABLE public.render_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "render_tokens_service_only"
ON public.render_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_render_tokens_expires_at ON public.render_tokens (expires_at);