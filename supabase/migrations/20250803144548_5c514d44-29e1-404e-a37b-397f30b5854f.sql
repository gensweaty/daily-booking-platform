
-- Add reminder_time column to events table if it doesn't exist
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS reminder_time TIMESTAMP WITH TIME ZONE;

-- Add index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_events_reminder_time 
ON events(reminder_time) 
WHERE reminder_time IS NOT NULL;
