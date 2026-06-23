
CREATE TABLE public.screenshot_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  page_hint TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  image_url TEXT,
  via_telegram BOOLEAN NOT NULL DEFAULT false,
  ai_channel_id UUID,
  caption TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMPTZ
);

CREATE INDEX idx_screenshot_requests_user_pending
  ON public.screenshot_requests (user_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.screenshot_requests TO authenticated;
GRANT ALL ON public.screenshot_requests TO service_role;

ALTER TABLE public.screenshot_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own screenshot requests"
  ON public.screenshot_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update their own screenshot requests"
  ON public.screenshot_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users insert their own screenshot requests"
  ON public.screenshot_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.screenshot_requests;
ALTER TABLE public.screenshot_requests REPLICA IDENTITY FULL;
