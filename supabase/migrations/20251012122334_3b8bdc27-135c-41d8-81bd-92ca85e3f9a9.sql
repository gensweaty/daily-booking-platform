-- Create custom_reminders table for AI-scheduled reminders
CREATE TABLE IF NOT EXISTS public.custom_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  remind_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_sent_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.custom_reminders ENABLE ROW LEVEL SECURITY;

-- Users can manage their own custom reminders
CREATE POLICY "Users can manage their own custom reminders"
ON public.custom_reminders
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_custom_reminders_user_remind ON public.custom_reminders(user_id, remind_at) WHERE deleted_at IS NULL;

-- Create function to get upcoming custom reminders
CREATE OR REPLACE FUNCTION get_upcoming_custom_reminders(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  message TEXT,
  remind_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.title,
    cr.message,
    cr.remind_at
  FROM custom_reminders cr
  WHERE cr.user_id = p_user_id
    AND cr.deleted_at IS NULL
    AND cr.remind_at <= NOW() + INTERVAL '5 minutes'
    AND cr.remind_at > NOW() - INTERVAL '5 minutes'
    AND (cr.reminder_sent_at IS NULL OR cr.email_sent = false)
  ORDER BY cr.remind_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;