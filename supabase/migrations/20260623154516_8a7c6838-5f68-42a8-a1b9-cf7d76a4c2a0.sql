ALTER TABLE public.screenshot_requests
  ADD COLUMN IF NOT EXISTS owner_id UUID;

COMMENT ON COLUMN public.screenshot_requests.owner_id IS
  'Dashboard owner/workspace id for posting the screenshot result back into the correct chat.';