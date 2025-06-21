
-- Add event_name column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_name TEXT;
