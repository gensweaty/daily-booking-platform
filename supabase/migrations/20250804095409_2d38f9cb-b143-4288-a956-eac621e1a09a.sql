
-- Add email reminder fields to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS email_reminder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Create index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_events_reminder_at ON events(reminder_at)
WHERE email_reminder_enabled = TRUE AND reminder_sent_at IS NULL;
