
-- Add event_name column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_name character varying;

-- Also add event_name column to booking_requests table if it doesn't exist
ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS event_name character varying;
