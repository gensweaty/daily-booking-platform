
-- Add reminder fields to events table
ALTER TABLE events 
ADD COLUMN reminder_at timestamp with time zone,
ADD COLUMN reminder_sent_at timestamp with time zone,
ADD COLUMN email_reminder_enabled boolean DEFAULT false;

-- Create index for efficient reminder queries
CREATE INDEX idx_events_reminder_at ON events(reminder_at) WHERE reminder_at IS NOT NULL AND reminder_sent_at IS NULL;
