
-- Add reminder_time column to events table if it doesn't exist
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_time TIMESTAMP WITH TIME ZONE;
