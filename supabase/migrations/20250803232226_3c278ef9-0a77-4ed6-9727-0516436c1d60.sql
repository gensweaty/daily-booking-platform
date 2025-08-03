
-- Add email reminder fields to the events table
ALTER TABLE events 
ADD COLUMN email_reminder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN reminder_at TIMESTAMPTZ,
ADD COLUMN reminder_sent_at TIMESTAMPTZ;

-- Add an index on reminder_at for better performance when querying due reminders
CREATE INDEX idx_events_reminder_at ON events(reminder_at) WHERE email_reminder_enabled = TRUE AND reminder_sent_at IS NULL;

-- Create a function to check for due reminders
CREATE OR REPLACE FUNCTION get_due_event_reminders()
RETURNS TABLE(
  id UUID,
  title VARCHAR,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,
  user_id UUID
) 
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    e.id,
    e.title,
    e.start_date,
    e.end_date,
    e.reminder_at,
    e.user_id
  FROM events e
  WHERE e.email_reminder_enabled = TRUE
    AND e.reminder_at <= NOW()
    AND e.reminder_sent_at IS NULL
    AND e.deleted_at IS NULL
  ORDER BY e.reminder_at ASC;
$$;

-- Create a function to mark reminder as sent
CREATE OR REPLACE FUNCTION mark_reminder_sent(event_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
AS $$
  UPDATE events 
  SET reminder_sent_at = NOW()
  WHERE id = event_id;
$$;
