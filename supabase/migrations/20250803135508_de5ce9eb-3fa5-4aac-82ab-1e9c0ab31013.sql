
-- Add event reminder fields to the events table
ALTER TABLE events 
ADD COLUMN reminder_at timestamptz,        -- Timestamp for when to send the reminder  
ADD COLUMN email_reminder_enabled boolean DEFAULT true,  -- Flag to control reminder  
ADD COLUMN reminder_sent_at timestamptz;   -- Timestamp of when reminder was sent

-- Add index for efficient querying of due reminders
CREATE INDEX idx_events_reminder_due ON events (reminder_at, email_reminder_enabled) 
WHERE reminder_at IS NOT NULL AND email_reminder_enabled = true;
