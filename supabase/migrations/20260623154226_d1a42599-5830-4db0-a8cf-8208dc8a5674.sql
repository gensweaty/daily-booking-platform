ALTER TABLE public.screenshot_requests
  ADD COLUMN IF NOT EXISTS popup_target TEXT;

COMMENT ON COLUMN public.screenshot_requests.popup_target IS
  'Optional dashboard popup/dialog to open before screenshot capture, such as profile or add_task.';